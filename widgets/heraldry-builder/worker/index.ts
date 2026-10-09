// Cloudflare Worker for the Heraldry Builder.
//
// It owns the `/api/*` routes that back the community armorial; every other request is served from
// the static SPA bundle (the assets binding). A registration is a structured design (field,
// ordinary, charges), the field shape it is displayed in, a public display name, an optional public
// Discord username and the owner's (private) email address, stored in D1 under one registry. The
// shape is display only: it is stored beside the design and never enters the signature, blazon,
// tags or uniqueness check. The Worker never trusts the client's blazon, signature or tags: it
// re-normalises and re-validates the design with the shared heraldry library and computes
// everything itself.
//
// Uniqueness is per registry: an exact duplicate (same canonical signature) is blocked by a UNIQUE
// index, and a design with no clear difference from an existing entry is "too close". The edit
// secret is the capability for editing/withdrawing: we store only its SHA-256 hash and compare in
// constant time.
//
// Ownership by email: the owner's address is required at registration, used there to email the
// edit link, and stored only as an HMAC (EMAIL_HMAC_KEY) so "Lost your link?" can find the owner's
// entries when they type the address again. Recovery emails a single-use, 30-minute token per entry
// (stored hashed, delivered in the link's fragment); redeeming it rotates the edit secret or
// withdraws the entry. No API ever returns the address.
//
// Routes:
//   GET    /api/registries        -> [{ id, name, isDefault }]
//   GET    /api/arms?…            -> public search (no contact in results)
//   POST   /api/arms/check        -> availability check for a design (not rate-limited)
//   POST   /api/arms              -> register { displayName, email, contact, design, shape };
//                                    returns { id, editSecret, registry, rev, blazon, signature, editLinkEmail } (201)
//   GET    /api/arms/:id          -> one entry, including the public contact
//   GET    /api/arms/:id/owner    -> 200 when Authorization: Bearer <secret> is this entry's edit secret
//   PUT    /api/arms/:id          -> edit;     Authorization: Bearer <secret>, If-Match: <rev>
//   DELETE /api/arms/:id          -> withdraw; Authorization: Bearer <secret>; deletes the row + tags
//   POST   /api/recover           -> { email }; always 202; emails recovery links for that address's entries
//   POST   /api/recover/lookup    -> { token }; the entry a recovery token is for (does not use it up)
//   POST   /api/recover/redeem    -> { token }; uses the token, rotates the edit secret, returns the new one
//   POST   /api/recover/withdraw  -> { token }; uses the token and withdraws the entry

import {
  DEFAULT_FIELD_SHAPE, FIELD_SHAPES, blazon, candidateKey, checkUnique, cleanContact, cleanDisplayName, cleanEmail,
  buildSearchText, deriveTags, explainDifferences, isFieldShape, normalise, parseSearchParams, readability, resolve,
  searchParamsFromUrl, signature, type Contact, type FieldShape, type Issue, type NormDesign, type RegistryEntryLike,
} from '../src/lib/heraldry';
import { RECOVER_HASH, entryHash, ownerHash, recoverTokenHash } from '../src/lib/hashes';
import { sendMail, type MailEnv } from './mail';

interface Env extends MailEnv {
  DB: D1Database;
  ASSETS?: Fetcher;
  CREATE_LIMITER: RateLimit;
  /** Secret key for the owner-email HMAC. */
  EMAIL_HMAC_KEY: string;
  /** Which EMAIL_HMAC_KEY is current (a positive integer); stored beside every HMAC it makes. */
  EMAIL_HMAC_KEY_VERSION: string;
}

// A registry holds at most this many entries; generous for a community armorial.
const MAX_ENTRIES_PER_REGISTRY = 2000;
// Request bodies are a design plus a name, email and contact, well under 2 KB; anything past this is refused.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_REGISTRY_ID_LEN = 64;
// How long an emailed recovery link works.
const RECOVERY_TOKEN_TTL_MS = 30 * 60 * 1000;
// Recovery tokens and edit secrets are base64url; anything longer than this is not one of ours.
const MAX_TOKEN_LEN = 128;

interface RegistryRow {
  id: string;
  name: string;
  is_default: number;
}

interface ArmsRow {
  id: string;
  registry_id: string;
  display_name: string;
  contact_discord: string | null;
  design: string;
  field_shape: FieldShape;
  signature: string;
  blazon: string;
  readability: string;
  search_text: string;
  edit_secret_hash: string;
  rev: number;
  created_at: string;
  updated_at: string;
}

type ScanRow = Pick<ArmsRow, 'id' | 'display_name' | 'design' | 'field_shape' | 'signature' | 'blazon'>;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (pathname === '/api/registries' || pathname === '/api/registries/') {
        if (request.method === 'GET') return await listRegistries(env);
        return methodNotAllowed('GET');
      }

      if (pathname === '/api/arms' || pathname.startsWith('/api/arms/')) {
        return await handleArmsApi(request, env, url);
      }

      if (pathname === '/api/recover' || pathname.startsWith('/api/recover/')) {
        return await handleRecoverApi(request, env, ctx, url);
      }

      if (pathname.startsWith('/api/')) {
        return jsonError(404, 'not_found', 'Unknown API route.');
      }

      // Non-API requests fall through to the static assets (SPA). With run_worker_first scoped to
      // /api/*, these normally never reach the Worker, but delegating keeps it correct if they do.
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (e) {
      // Defense in depth: never surface a bare runtime error (e.g. a D1 failure) to the client.
      // One structured line for the logs: no body, headers, ids or contact details.
      const { pathname } = new URL(request.url);
      console.error(JSON.stringify({
        event: 'unhandled_error',
        route: routeLabel(pathname),
        method: request.method,
        errorName: e instanceof Error ? e.name : typeof e,
        errorMessage: e instanceof Error ? e.message : String(e),
      }));
      return jsonError(500, 'internal_error', 'Unexpected error.');
    }
  },
} satisfies ExportedHandler<Env>;

/** The route for logs, with entry ids replaced so a log line never names an entry. */
function routeLabel(pathname: string): string {
  if (!pathname.startsWith('/api/arms/') || pathname === '/api/arms/check') return pathname;
  return pathname.endsWith('/owner') ? '/api/arms/:id/owner' : '/api/arms/:id';
}

async function handleArmsApi(request: Request, env: Env, url: URL): Promise<Response> {
  const rest = url.pathname.slice('/api/arms'.length); // '' | '/' | '/check' | '/<id>' | ...

  // Collection: GET (search) / POST (register) /api/arms
  if (rest === '' || rest === '/') {
    if (request.method === 'GET') return searchArms(env, url);
    if (request.method === 'POST') return createArms(request, env, url);
    return methodNotAllowed('GET, POST');
  }

  if (rest === '/check') {
    if (request.method === 'POST') return checkArms(request, env);
    return methodNotAllowed('POST');
  }

  // Item: /api/arms/:id, or its owner check /api/arms/:id/owner
  const item = /^\/([^/]+)(\/owner)?$/.exec(rest);
  if (!item) return jsonError(404, 'not_found', 'Unknown arms route.');
  const ownerCheck = item[2] !== undefined;
  let id: string;
  try {
    id = decodeURIComponent(item[1]);
  } catch {
    return jsonError(404, 'not_found', 'Unknown arms route.'); // malformed percent-encoding
  }
  if (id.includes('/')) {
    return jsonError(404, 'not_found', 'Unknown arms route.');
  }

  if (ownerCheck) {
    if (request.method === 'GET') return checkOwner(request, env, id);
    return methodNotAllowed('GET');
  }
  if (request.method === 'GET') return readArms(env, id);
  if (request.method === 'PUT') return updateArms(request, env, id);
  if (request.method === 'DELETE') return withdrawArms(request, env, id);
  return methodNotAllowed('GET, PUT, DELETE');
}

// ── registries ───────────────────────────────────────────────────────────────────────────────

async function listRegistries(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, is_default FROM registries ORDER BY is_default DESC, name, id`
  ).all<RegistryRow>();
  return json(200, results.map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default === 1 })));
}

type RegistryLookup = { registry: { id: string; name: string } } | { error: Response };

/** Resolve a registry id (blank → the default registry). Unknown → 404. */
async function lookupRegistry(env: Env, raw: unknown): Promise<RegistryLookup> {
  if (raw !== undefined && raw !== null && typeof raw !== 'string') {
    return { error: jsonError(400, 'bad_request', 'registry must be a string.') };
  }
  const id = (raw ?? '').trim();
  if (id.length > MAX_REGISTRY_ID_LEN) return { error: jsonError(404, 'not_found', 'Unknown registry.') };
  const row = id
    ? await env.DB.prepare(`SELECT id, name, is_default FROM registries WHERE id = ?`).bind(id).first<RegistryRow>()
    : await env.DB.prepare(
        `SELECT id, name, is_default FROM registries WHERE is_default = 1 LIMIT 1`
      ).first<RegistryRow>();
  if (!row) return { error: jsonError(404, 'not_found', 'Unknown registry.') };
  return { registry: { id: row.id, name: row.name } };
}

// ── search ───────────────────────────────────────────────────────────────────────────────────

async function searchArms(env: Env, url: URL): Promise<Response> {
  const fromUrl = searchParamsFromUrl(url.searchParams);
  if (!fromUrl.ok) return json(400, { error: fromUrl.code, message: fromUrl.message, param: fromUrl.param });
  const parsed = parseSearchParams(fromUrl.params);
  if (!parsed.ok) return json(400, { error: parsed.code, message: parsed.message, param: parsed.param });
  const reg = await lookupRegistry(env, fromUrl.params.registry);
  if ('error' in reg) return reg.error;
  const { tags, q, words, limit, offset } = parsed.query;

  // Tag-AND: one EXISTS per required tag, each served by the (arms_id, tag) primary key.
  const where = ['a.registry_id = ?'];
  const binds: unknown[] = [reg.registry.id];
  for (const tag of tags) {
    where.push('EXISTS (SELECT 1 FROM arms_tags t WHERE t.arms_id = a.id AND t.tag = ?)');
    binds.push(tag);
  }
  // Free text: each word needs one of its alternatives as a whole word of search_text (stored with a
  // space at each end), so one JSON array per word keeps the bind count small. No searchable word
  // matches nothing.
  if (q && words.length === 0) where.push('0');
  for (const alternatives of q ? words : []) {
    where.push(`EXISTS (SELECT 1 FROM json_each(?) w WHERE instr(a.search_text, ' ' || w.value || ' ') > 0)`);
    binds.push(JSON.stringify(alternatives));
  }
  const whereSql = where.join(' AND ');

  const [countRes, pageRes] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM arms a WHERE ${whereSql}`).bind(...binds),
    env.DB.prepare(
      `SELECT a.id, a.display_name, a.design, a.field_shape, a.signature, a.blazon, a.readability, a.created_at
       FROM arms a WHERE ${whereSql}
       ORDER BY a.created_at DESC, a.id
       LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset),
  ]);
  const total = Number((countRes.results[0] as { n: number } | undefined)?.n ?? 0);
  const rows = pageRes.results as Array<Pick<ArmsRow, 'id' | 'display_name' | 'design' | 'field_shape' | 'signature' | 'blazon' | 'readability' | 'created_at'>>;

  // Public list results never include the contact (no harvesting affordance).
  const items = rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    design: parseStoredDesign(r.design),
    shape: r.field_shape,
    blazon: r.blazon,
    signature: r.signature,
    readability: r.readability,
    createdAt: r.created_at,
  }));
  return json(200, { registry: reg.registry, total, offset, limit, items });
}

// ── check / create ───────────────────────────────────────────────────────────────────────────

/** Everything the Worker derives from a validated design. Client-sent values are ignored. */
interface Derived {
  design: NormDesign;
  signature: string;
  blazon: string;
  tags: string[];
  readability: string;
}

type DesignResult = { derived: Derived } | { error: Response };

function deriveDesign(raw: unknown): DesignResult {
  if (raw === undefined) {
    return { error: invalidDesign([{ code: 'shape', layer: 'design', message: 'A design is required.' }]) };
  }
  const n = normalise(raw);
  if (!n.ok) return { error: invalidDesign(n.errors) };
  const design = n.design;
  return {
    derived: {
      design,
      signature: signature(design),
      blazon: blazon(design),
      tags: deriveTags(design),
      readability: readability(design).band,
    },
  };
}

function invalidDesign(issues: Issue[]): Response {
  return json(400, {
    error: 'invalid_design',
    message: issues[0]?.message ?? 'The design is not valid.',
    issues,
  });
}

/**
 * The registry entries that could be a duplicate of, or too close to, `nd`: those sharing its field
 * division, ordinary and charge (served by arms_registry_similarity), in registration order.
 */
async function loadCandidates(env: Env, registryId: string, nd: NormDesign): Promise<ScanRow[]> {
  const key = candidateKey(nd);
  const { results } = await env.DB.prepare(
    `SELECT id, display_name, design, field_shape, signature, blazon FROM arms
     WHERE registry_id = ? AND field_division = ? AND ordinary IS ? AND charge IS ?
     ORDER BY created_at, id`
  )
    .bind(registryId, key.fieldDivision, key.ordinary, key.charge)
    .all<ScanRow>();
  return results;
}

async function countEntries(env: Env, registryId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM arms WHERE registry_id = ?`)
    .bind(registryId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

type Uniqueness =
  | { kind: 'ok' }
  | { kind: 'duplicate'; conflict: ScanRow }
  | { kind: 'too-close'; conflict: ScanRow; differences: string[] };

function uniqueness(d: Derived, rows: ScanRow[], excludeId?: string): Uniqueness {
  const byId = new Map<string, ScanRow>();
  const entries: RegistryEntryLike[] = [];
  for (const r of rows) {
    const design = parseStoredDesign(r.design);
    if (!design) continue;
    byId.set(r.id, r);
    entries.push({ id: r.id, signature: r.signature, design });
  }
  const v = checkUnique(d.design, d.signature, entries, excludeId);
  if (v.kind === 'ok') return v;
  const conflict = byId.get(v.of)!;
  if (v.kind === 'duplicate') return { kind: 'duplicate', conflict };
  return {
    kind: 'too-close',
    conflict,
    differences: explainDifferences(d.design, parseStoredDesign(conflict.design)!),
  };
}

function conflictSummary(r: ScanRow) {
  return { id: r.id, displayName: r.display_name, blazon: r.blazon, design: parseStoredDesign(r.design), shape: r.field_shape };
}

function uniquenessError(u: Exclude<Uniqueness, { kind: 'ok' }>): Response {
  if (u.kind === 'duplicate') {
    return json(409, {
      error: 'duplicate',
      message: `These arms are already registered by ${u.conflict.display_name}.`,
      conflictId: u.conflict.id,
      conflict: conflictSummary(u.conflict),
    });
  }
  return json(409, {
    error: 'too_close',
    message: `Too close to the arms of ${u.conflict.display_name}: no clear difference.`,
    conflictId: u.conflict.id,
    conflict: conflictSummary(u.conflict),
    differences: u.differences,
  });
}

async function checkArms(request: Request, env: Env): Promise<Response> {
  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed.error;
  const body = asObject(parsed.body);
  if (!body) return jsonError(400, 'bad_request', 'Body must be a JSON object.');

  const reg = await lookupRegistry(env, body.registry);
  if ('error' in reg) return reg.error;
  const d = deriveDesign(body.design);
  if ('error' in d) return d.error;

  const u = uniqueness(d.derived, await loadCandidates(env, reg.registry.id, d.derived.design));
  const base = {
    registry: reg.registry,
    blazon: d.derived.blazon,
    signature: d.derived.signature,
    readability: d.derived.readability,
  };
  if (u.kind === 'ok') return json(200, { verdict: 'ok', ...base });
  if (u.kind === 'duplicate') return json(200, { verdict: 'duplicate', conflict: conflictSummary(u.conflict), ...base });
  return json(200, {
    verdict: 'too-close',
    conflict: conflictSummary(u.conflict),
    differences: u.differences,
    ...base,
  });
}

type EntryInput = { displayName: string; contact: Contact; shape: FieldShape; derived: Derived } | { error: Response };

function validateEntryInput(body: Record<string, unknown>): EntryInput {
  const name = cleanDisplayName(body.displayName);
  if (!name.ok) return { error: fieldError('displayName', name.message) };
  const contact = cleanContact(body.contact);
  if (!contact.ok) return { error: fieldError(contact.field, contact.message) };
  // A request without a shape (e.g. from an SPA bundle older than field shapes) gets the default.
  const shape = body.shape === undefined ? DEFAULT_FIELD_SHAPE : body.shape;
  if (!isFieldShape(shape)) return { error: fieldError('shape', `The field shape must be one of: ${FIELD_SHAPES.join(', ')}.`) };
  const d = deriveDesign(body.design);
  if ('error' in d) return d;
  return { displayName: name.value, contact: contact.value, shape, derived: d.derived };
}

async function createArms(request: Request, env: Env, url: URL): Promise<Response> {
  // Rate-limited before the body is even parsed, so junk requests also spend the budget.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.CREATE_LIMITER.limit({ key: ip });
  if (!success) return jsonError(429, 'rate_limited', 'Too many registrations — try again shortly.');

  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed.error;
  const body = asObject(parsed.body);
  if (!body) return jsonError(400, 'bad_request', 'Body must be a JSON object.');

  const input = validateEntryInput(body);
  if ('error' in input) return input.error;
  const email = cleanEmail(body.email);
  if (!email.ok) return fieldError('email', email.message);
  const reg = await lookupRegistry(env, body.registry);
  if ('error' in reg) return reg.error;

  if ((await countEntries(env, reg.registry.id)) >= MAX_ENTRIES_PER_REGISTRY) {
    return jsonError(409, 'registry_full', 'This registry is full.');
  }
  const u = uniqueness(input.derived, await loadCandidates(env, reg.registry.id, input.derived.design));
  if (u.kind !== 'ok') return uniquenessError(u);

  const id = randomToken(16); // ~128-bit
  const editSecret = randomToken(32); // ~256-bit
  const editSecretHash = await sha256hex(editSecret);
  const owner = await emailHmac(env, email.value);
  const now = new Date().toISOString();
  const d = input.derived;
  const nd = d.design;
  const key = candidateKey(nd);

  try {
    // One transaction: the row, its tags and its owner's email HMAC land together or not at all.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO arms (id, registry_id, display_name, contact_discord, design, field_shape, signature, blazon,
           field_division, ordinary, charge, readability, search_text, edit_secret_hash, rev, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(
        id, reg.registry.id, input.displayName, input.contact.discord, JSON.stringify(nd), input.shape, d.signature, d.blazon,
        key.fieldDivision, key.ordinary, key.charge, d.readability,
        buildSearchText({ displayName: input.displayName, blazon: d.blazon, design: nd }),
        editSecretHash, now, now
      ),
      insertTags(env, id, reg.registry.id, d.tags),
      env.DB.prepare(`INSERT INTO owner_emails (arms_id, email_hmac, key_version, created_at) VALUES (?, ?, ?, ?)`)
        .bind(id, owner.hmac, owner.keyVersion, now),
    ]);
  } catch (e) {
    // Lost a race with a concurrent registration of the same signature.
    if (isUniqueViolation(e)) return await raceDuplicate(env, reg.registry.id, d.signature);
    throw e;
  }

  // The registration stands whether or not the email goes out; the response says which, so the
  // success screen can tell the owner to save the link themselves.
  const site = siteUrl(url);
  const editLinkEmail = await sendMail(env, {
    to: email.value,
    subject: 'Your Heraldry Builder edit link',
    text: registrationMailText({
      displayName: input.displayName, blazon: d.blazon, registryName: reg.registry.name,
      editUrl: site + ownerHash(id, editSecret), shareUrl: site + entryHash(id), recoverUrl: site + RECOVER_HASH,
    }),
  });

  return json(201, {
    id,
    editSecret,
    registry: reg.registry,
    rev: 1,
    blazon: d.blazon,
    signature: d.signature,
    editLinkEmail,
  });
}

function insertTags(env: Env, armsId: string, registryId: string, tags: string[]): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO arms_tags (arms_id, registry_id, tag) SELECT ?, ?, value FROM json_each(?)`
  ).bind(armsId, registryId, JSON.stringify(tags));
}

function isUniqueViolation(e: unknown): boolean {
  return /UNIQUE constraint failed/i.test(String((e as { message?: unknown })?.message ?? e));
}

async function raceDuplicate(env: Env, registryId: string, sig: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, display_name, design, field_shape, signature, blazon FROM arms WHERE registry_id = ? AND signature = ?`
  )
    .bind(registryId, sig)
    .first<ScanRow>();
  if (!row) return jsonError(409, 'duplicate', 'These arms were just registered by someone else.');
  return uniquenessError({ kind: 'duplicate', conflict: row });
}

// ── read / update / withdraw ─────────────────────────────────────────────────────────────────

async function readArms(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT a.id, a.registry_id, a.display_name, a.contact_discord, a.design, a.field_shape, a.signature, a.blazon,
            a.readability, a.rev, a.created_at, a.updated_at, r.name AS registry_name
     FROM arms a JOIN registries r ON r.id = a.registry_id WHERE a.id = ?`
  )
    .bind(id)
    .first<Omit<ArmsRow, 'edit_secret_hash'> & { registry_name: string }>();

  if (!row) return jsonError(404, 'not_found', 'No arms with that id.');
  return json(200, rowToEntry(row, row.registry_name));
}

/** The single-entry response (GET and PUT): includes the public contact, never the secret hash. */
function rowToEntry(row: Omit<ArmsRow, 'edit_secret_hash'>, registryName: string) {
  return {
    id: row.id,
    registry: { id: row.registry_id, name: registryName },
    displayName: row.display_name,
    contact: { discord: row.contact_discord },
    design: parseStoredDesign(row.design),
    shape: row.field_shape,
    blazon: row.blazon,
    signature: row.signature,
    readability: row.readability,
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type Authorised = { row: ArmsRow & { registry_name: string } } | { error: Response };

/** 404 → 401 → 403, as the siblings: the Bearer secret is hashed and compared in constant time. */
async function authorise(request: Request, env: Env, id: string): Promise<Authorised> {
  const row = await env.DB.prepare(
    `SELECT a.*, r.name AS registry_name FROM arms a JOIN registries r ON r.id = a.registry_id WHERE a.id = ?`
  )
    .bind(id)
    .first<ArmsRow & { registry_name: string }>();
  if (!row) return { error: jsonError(404, 'not_found', 'No arms with that id.') };

  const secret = bearerToken(request.headers.get('Authorization'));
  if (secret == null) return { error: jsonError(401, 'unauthorized', 'Missing edit secret.') };
  const presentedHash = await sha256hex(secret);
  if (!timingSafeEqual(presentedHash, row.edit_secret_hash)) {
    return { error: jsonError(403, 'forbidden', 'Wrong edit secret.') };
  }
  return { row };
}

async function updateArms(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await authorise(request, env, id);
  if ('error' in auth) return auth.error;
  const { row } = auth;

  // Optimistic concurrency: the client must declare which revision it edited.
  const ifMatch = request.headers.get('If-Match');
  const expectedRev = parseRev(ifMatch);
  if (expectedRev == null) {
    return jsonError(400, 'bad_request', 'Missing or malformed If-Match revision.');
  }
  if (expectedRev !== row.rev) {
    return jsonError(409, 'conflict', 'Stale revision; reload before saving.');
  }

  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed.error;
  const body = asObject(parsed.body);
  if (!body) return jsonError(400, 'bad_request', 'Body must be a JSON object.');
  const input = validateEntryInput(body);
  if ('error' in input) return input.error;

  // A design change must still be unique within the registry (ignoring this entry itself).
  const d = input.derived;
  const nd = d.design;
  const key = candidateKey(nd);
  if (d.signature !== row.signature) {
    const u = uniqueness(d, await loadCandidates(env, row.registry_id, nd), id);
    if (u.kind !== 'ok') return uniquenessError(u);
  }

  const now = new Date().toISOString();
  const newRev = expectedRev + 1;
  // Only rewrite the tags if *our* UPDATE landed (same rev and signature ⇒ same tags), so a lost
  // race leaves the winner's tags alone. All three statements run in one transaction.
  const landed = `EXISTS (SELECT 1 FROM arms WHERE id = ? AND rev = ? AND signature = ?)`;
  let results: D1Result[];
  try {
    results = await env.DB.batch([
      // Conditional UPDATE on rev closes the race between the SELECT above and this write.
      env.DB.prepare(
        `UPDATE arms SET display_name = ?, contact_discord = ?, design = ?, field_shape = ?, signature = ?, blazon = ?,
           field_division = ?, ordinary = ?, charge = ?, readability = ?, search_text = ?, rev = rev + 1, updated_at = ?
         WHERE id = ? AND rev = ?`
      ).bind(
        input.displayName, input.contact.discord, JSON.stringify(nd), input.shape, d.signature, d.blazon,
        key.fieldDivision, key.ordinary, key.charge, d.readability,
        buildSearchText({ displayName: input.displayName, blazon: d.blazon, design: nd }),
        now, id, expectedRev
      ),
      env.DB.prepare(`DELETE FROM arms_tags WHERE arms_id = ? AND ${landed}`).bind(id, id, newRev, d.signature),
      env.DB.prepare(
        `INSERT INTO arms_tags (arms_id, registry_id, tag) SELECT ?, ?, value FROM json_each(?) WHERE ${landed}`
      ).bind(id, row.registry_id, JSON.stringify(d.tags), id, newRev, d.signature),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return await raceDuplicate(env, row.registry_id, d.signature);
    throw e;
  }

  if (!results[0].meta.changes) {
    return jsonError(409, 'conflict', 'Stale revision; reload before saving.');
  }

  return json(
    200,
    rowToEntry(
      {
        ...row,
        display_name: input.displayName,
        contact_discord: input.contact.discord,
        design: JSON.stringify(nd),
        field_shape: input.shape,
        signature: d.signature,
        blazon: d.blazon,
        readability: d.readability,
        rev: newRev,
        updated_at: now,
      },
      row.registry_name
    )
  );
}

async function withdrawArms(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await authorise(request, env, id);
  if ('error' in auth) return auth.error;

  await deleteArms(env, id);
  return json(200, { id, withdrawn: true });
}

/**
 * Withdrawal deletes the entry outright (nothing is kept), which also frees its signature. Its
 * tags, owner email HMAC and recovery tokens go with it (ON DELETE CASCADE).
 */
async function deleteArms(env: Env, id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM arms WHERE id = ?`).bind(id).run();
}

/** Owner check for the owner view: 200 when the Bearer secret is right (404 → 401 → 403 otherwise). */
async function checkOwner(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await authorise(request, env, id);
  if ('error' in auth) return auth.error;
  return json(200, { id, owner: true });
}

// ── recovery ("Lost your link? / Withdraw my registration") ──────────────────────────────────

async function handleRecoverApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const action = url.pathname.slice('/api/recover'.length);
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (action === '' || action === '/') return requestRecovery(request, env, ctx, url);
  if (action === '/lookup') return lookupRecoveryToken(request, env);
  if (action === '/redeem') return redeemRecoveryToken(request, env);
  if (action === '/withdraw') return withdrawByRecoveryToken(request, env);
  return jsonError(404, 'not_found', 'Unknown recovery route.');
}

/** The one answer to every well-formed recovery request, whether or not the address owns anything. */
const RECOVERY_ACCEPTED = {
  accepted: true,
  message: "If that address owns any arms, we've sent it a link. It works once, for 30 minutes.",
};

/**
 * Always 202 for a valid address. The lookup and the email happen after the response (waitUntil),
 * so neither the answer nor its timing says whether the address owns any entries. Entries in every
 * registry are included: the address identifies the owner, and they may not remember (or have) the
 * `?registry=` link they registered from.
 */
async function requestRecovery(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed.error;
  const body = asObject(parsed.body);
  if (!body) return jsonError(400, 'bad_request', 'Body must be a JSON object.');
  const email = cleanEmail(body.email);
  if (!email.ok) return fieldError('email', email.message);

  ctx.waitUntil(
    sendRecoveryMail(env, email.value, siteUrl(url)).catch((e: unknown) => {
      console.error(JSON.stringify({ event: 'recovery_failed', errorName: e instanceof Error ? e.name : typeof e }));
    })
  );
  return json(202, RECOVERY_ACCEPTED);
}

interface OwnedRow {
  id: string;
  display_name: string;
  blazon: string;
  registry_name: string;
}

/** One email listing a fresh single-use token link per entry the address owns; nothing if it owns none. */
async function sendRecoveryMail(env: Env, email: string, site: string): Promise<void> {
  const owner = await emailHmac(env, email);
  const now = Date.now();
  await env.DB.prepare(`DELETE FROM owner_tokens WHERE expires_at < ?`).bind(new Date(now).toISOString()).run();
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.display_name, a.blazon, r.name AS registry_name
     FROM owner_emails o JOIN arms a ON a.id = o.arms_id JOIN registries r ON r.id = a.registry_id
     WHERE o.email_hmac = ? AND o.key_version = ?
     ORDER BY a.created_at, a.id`
  ).bind(owner.hmac, owner.keyVersion).all<OwnedRow>();
  if (results.length === 0) return;

  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + RECOVERY_TOKEN_TTL_MS).toISOString();
  const tokens = await Promise.all(results.map(async (row) => {
    const token = randomToken(32);
    return { row, token, hash: await sha256hex(token) };
  }));
  await env.DB.batch(tokens.map((t) =>
    env.DB.prepare(`INSERT INTO owner_tokens (token_hash, arms_id, created_at, expires_at) VALUES (?, ?, ?, ?)`)
      .bind(t.hash, t.row.id, createdAt, expiresAt)
  ));
  await sendMail(env, {
    to: email,
    subject: 'Your Heraldry Builder recovery link',
    text: recoveryMailText(tokens.map((t) => ({
      displayName: t.row.display_name, blazon: t.row.blazon, registryName: t.row.registry_name, url: site + recoverTokenHash(t.token),
    }))),
  });
}

interface TokenRow {
  arms_id: string;
  expires_at: string;
  used_at: string | null;
}

type TokenBody = { tokenHash: string } | { error: Response };

async function readToken(request: Request): Promise<TokenBody> {
  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed;
  const token = asObject(parsed.body)?.token;
  if (typeof token !== 'string' || token === '' || token.length > MAX_TOKEN_LEN) {
    return { error: fieldError('token', 'A recovery token is required.') };
  }
  return { tokenHash: await sha256hex(token) };
}

type TokenProblem = 'token_invalid' | 'token_used' | 'token_expired';

/** Why a token can't be used, or null when it can. */
function tokenProblem(row: TokenRow | null, now: string): TokenProblem | null {
  if (!row) return 'token_invalid';
  if (row.used_at !== null) return 'token_used';
  if (row.expires_at <= now) return 'token_expired';
  return null;
}

/** Unknown → 404; already used or expired → 410. */
function tokenError(problem: TokenProblem): Response {
  switch (problem) {
    case 'token_invalid':
      return jsonError(404, problem, "That recovery link isn't valid. Check you copied all of it, or ask for a new one.");
    case 'token_used':
      return jsonError(410, problem, 'That recovery link has already been used. Ask for a new one.');
    case 'token_expired':
      return jsonError(410, problem, 'That recovery link has expired. Ask for a new one.');
  }
}

/** The entry a token is for, without using the token up, so the owner can see it before choosing. */
async function lookupRecoveryToken(request: Request, env: Env): Promise<Response> {
  const t = await readToken(request);
  if ('error' in t) return t.error;
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT t.arms_id, t.expires_at, t.used_at, a.display_name, a.design, a.field_shape, a.blazon,
            a.registry_id, r.name AS registry_name
     FROM owner_tokens t JOIN arms a ON a.id = t.arms_id JOIN registries r ON r.id = a.registry_id
     WHERE t.token_hash = ?`
  ).bind(t.tokenHash).first<TokenRow & Pick<ArmsRow, 'display_name' | 'design' | 'field_shape' | 'blazon' | 'registry_id'> & { registry_name: string }>();
  const problem = tokenProblem(row, now);
  if (problem || !row) return tokenError(problem ?? 'token_invalid');
  return json(200, {
    entry: {
      id: row.arms_id,
      registry: { id: row.registry_id, name: row.registry_name },
      displayName: row.display_name,
      design: parseStoredDesign(row.design),
      shape: row.field_shape,
      blazon: row.blazon,
    },
    expiresAt: row.expires_at,
  });
}

type Redeemed = { armsId: string } | { error: Response };

/** Use a token up: atomically marks it used if it is unused and unexpired, so it works exactly once. */
async function useToken(request: Request, env: Env): Promise<Redeemed> {
  const t = await readToken(request);
  if ('error' in t) return t;
  const now = new Date().toISOString();
  const used = await env.DB.prepare(
    `UPDATE owner_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING arms_id`
  ).bind(now, t.tokenHash, now).first<{ arms_id: string }>();
  if (used) return { armsId: used.arms_id };
  const row = await env.DB.prepare(`SELECT arms_id, expires_at, used_at FROM owner_tokens WHERE token_hash = ?`)
    .bind(t.tokenHash)
    .first<TokenRow>();
  // The UPDATE only misses a missing, used or expired token, so there is always a problem to report.
  return { error: tokenError(tokenProblem(row, now) ?? 'token_used') };
}

/**
 * A new edit secret for the token's entry. Only the secret's hash is stored, so the old edit link
 * stops working; any other outstanding recovery tokens for the entry are used up too.
 */
async function redeemRecoveryToken(request: Request, env: Env): Promise<Response> {
  const r = await useToken(request, env);
  if ('error' in r) return r.error;
  const editSecret = randomToken(32);
  const now = new Date().toISOString();
  const [rotated] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE arms SET edit_secret_hash = ?, updated_at = ? WHERE id = ?
       RETURNING id, display_name, blazon, rev, registry_id, (SELECT name FROM registries WHERE id = registry_id) AS registry_name`
    ).bind(await sha256hex(editSecret), now, r.armsId),
    env.DB.prepare(`UPDATE owner_tokens SET used_at = ? WHERE arms_id = ? AND used_at IS NULL`).bind(now, r.armsId),
  ]);
  const row = (rotated.results as Array<Pick<ArmsRow, 'id' | 'display_name' | 'blazon' | 'rev' | 'registry_id'> & { registry_name: string }>)[0];
  if (!row) return jsonError(404, 'not_found', 'No arms with that id.');
  return json(200, {
    id: row.id,
    editSecret,
    registry: { id: row.registry_id, name: row.registry_name },
    displayName: row.display_name,
    blazon: row.blazon,
    rev: row.rev,
  });
}

async function withdrawByRecoveryToken(request: Request, env: Env): Promise<Response> {
  const r = await useToken(request, env);
  if ('error' in r) return r.error;
  await deleteArms(env, r.armsId);
  return json(200, { id: r.armsId, withdrawn: true });
}

// ── owner email ──────────────────────────────────────────────────────────────────────────────

/** HMAC-SHA-256 (hex) of an already-normalised address under the current EMAIL_HMAC_KEY. */
async function emailHmac(env: Env, normalisedEmail: string): Promise<{ hmac: string; keyVersion: number }> {
  const keyVersion = Number(env.EMAIL_HMAC_KEY_VERSION);
  if (!env.EMAIL_HMAC_KEY || !Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new Error('EMAIL_HMAC_KEY and a positive integer EMAIL_HMAC_KEY_VERSION must be configured');
  }
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.EMAIL_HMAC_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalisedEmail));
  return { hmac: hex(new Uint8Array(mac)), keyVersion };
}

/** The SPA's address (the Worker serves both), for the links in emails. */
function siteUrl(url: URL): string {
  return `${url.origin}/`;
}

function registrationMailText(m: {
  displayName: string; blazon: string; registryName: string; editUrl: string; shareUrl: string; recoverUrl: string;
}): string {
  return [
    `Your arms are registered in the ${m.registryName} armorial as "${m.displayName}":`,
    m.blazon,
    '',
    'Your edit link (keep it private: anyone with it can change or withdraw the entry):',
    m.editUrl,
    '',
    'To withdraw your registration, open the edit link and choose "Withdraw these arms". If you lose',
    `this email, use "Lost your link? / Withdraw my registration" on the site to get a new link: ${m.recoverUrl}`,
    '',
    'Share link (public):',
    m.shareUrl,
    '',
    "You're getting this because this address was given when the arms were registered.",
  ].join('\n');
}

function recoveryMailText(entries: Array<{ displayName: string; blazon: string; registryName: string; url: string }>): string {
  return [
    'Someone (hopefully you) asked for new links to the arms registered with this address.',
    'Each link below works once, for 30 minutes. Open it, then choose "Get a new edit link" or',
    '"Withdraw this registration". Getting a new edit link stops the old one working.',
    '',
    ...entries.flatMap((e) => [`"${e.displayName}" (${e.registryName}): ${e.blazon}`, e.url, '']),
    "If you didn't ask for this, ignore this email: nothing changes unless a link is opened and used.",
  ].join('\n');
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

/** Stored designs were normalised on write; re-resolve defensively and return null if unreadable. */
function parseStoredDesign(raw: string): NormDesign | null {
  try {
    const r = resolve(JSON.parse(raw));
    return r.ok ? r.design : null;
  } catch {
    return null;
  }
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function fieldError(field: string, message: string): Response {
  return json(400, { error: 'bad_request', message, field });
}

type ParseResult = { body: unknown } | { error: Response };

async function parseBody(request: Request): Promise<ParseResult> {
  const ct = request.headers.get('Content-Type') ?? '';
  if (!ct.includes('application/json')) {
    return { error: jsonError(400, 'bad_request', 'Expected application/json body.') };
  }
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > MAX_BODY_BYTES) return { error: bodyTooLarge() };
  const text = await readCapped(request, MAX_BODY_BYTES);
  if (text == null) return { error: bodyTooLarge() };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { error: jsonError(400, 'bad_request', 'Body is not valid JSON.') };
  }
}

function bodyTooLarge(): Response {
  return jsonError(413, 'payload_too_large', `Request body must be at most ${MAX_BODY_BYTES} bytes.`);
}

/** The body as text, or null once it passes `limit` bytes (a missing or false Content-Length can't dodge the cap). */
async function readCapped(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function parseRev(ifMatch: string | null): number | null {
  if (ifMatch == null) return null;
  // Tolerate the quoted ETag form (If-Match: "3") as well as a bare number.
  const m = /^\s*(?:W\/)?"?(\d+)"?\s*$/.exec(ifMatch);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return hex(new Uint8Array(digest));
}

function hex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** Constant-time compare of two equal-length hex strings (both are SHA-256 digests). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function json(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return json(status, { error: code, message });
}

function methodNotAllowed(allow: string): Response {
  return json(405, { error: 'method_not_allowed', message: `Allowed: ${allow}.` }, { Allow: allow });
}
