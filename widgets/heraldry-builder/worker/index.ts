// Cloudflare Worker for the Heraldry Builder.
//
// It owns the `/api/*` routes that back the community armorial; every other request is served from
// the static SPA bundle (the assets binding). A registration is a structured design (field,
// ordinary, charges) plus a public display name and optional public contact, stored in D1 under one
// registry. The Worker never trusts the client's blazon, signature or tags: it re-normalises and
// re-validates the design with the shared heraldry library and computes everything itself.
//
// Uniqueness is per registry: an exact duplicate (same canonical signature) is blocked by a UNIQUE
// index, and a design with no clear difference from an existing entry is "too close". The edit
// secret is the capability for editing/withdrawing: we store only its SHA-256 hash and compare in
// constant time.
//
// Routes:
//   GET    /api/registries      -> [{ id, name, isDefault }]
//   GET    /api/arms?…          -> public search (no contact in results)
//   POST   /api/arms/check      -> availability check for a design (not rate-limited)
//   POST   /api/arms            -> register; returns { id, editSecret, registry, rev, blazon, signature } (201)
//   GET    /api/arms/:id        -> one entry, including the public contact
//   PUT    /api/arms/:id        -> edit;     Authorization: Bearer <secret>, If-Match: <rev>
//   DELETE /api/arms/:id        -> withdraw; Authorization: Bearer <secret>; deletes the row + tags

import {
  blazon, checkUnique, cleanContact, cleanDisplayName, deriveTags, explainDifferences,
  fieldDivision, likePattern, normalise, parseSearchParams, readability, resolve, searchParamsFromUrl,
  signature, type Issue, type NormDesign, type RegistryEntryLike,
} from '../src/lib/heraldry';

interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  CREATE_LIMITER: RateLimit;
}

// A registry holds at most this many entries; the too-close scan reads them all, so this also
// bounds the work of a check. Generous for a community armorial (FINDINGS §10).
const MAX_ENTRIES_PER_REGISTRY = 2000;
const MAX_REGISTRY_ID_LEN = 64;

interface RegistryRow {
  id: string;
  name: string;
  is_default: number;
}

interface ArmsRow {
  id: string;
  registry_id: string;
  display_name: string;
  contact: string | null;
  design: string;
  signature: string;
  blazon: string;
  readability: string;
  edit_secret_hash: string;
  rev: number;
  created_at: string;
  updated_at: string;
}

type ScanRow = Pick<ArmsRow, 'id' | 'display_name' | 'design' | 'signature' | 'blazon'>;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

      if (pathname.startsWith('/api/')) {
        return jsonError(404, 'not_found', 'Unknown API route.');
      }

      // Non-API requests fall through to the static assets (SPA). With run_worker_first scoped to
      // /api/*, these normally never reach the Worker, but delegating keeps it correct if they do.
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch {
      // Defense in depth: never surface a bare runtime error (e.g. a D1 failure) to the client.
      return jsonError(500, 'internal_error', 'Unexpected error.');
    }
  },
} satisfies ExportedHandler<Env>;

async function handleArmsApi(request: Request, env: Env, url: URL): Promise<Response> {
  const rest = url.pathname.slice('/api/arms'.length); // '' | '/' | '/check' | '/<id>' | ...

  // Collection: GET (search) / POST (register) /api/arms
  if (rest === '' || rest === '/') {
    if (request.method === 'GET') return searchArms(env, url);
    if (request.method === 'POST') return createArms(request, env);
    return methodNotAllowed('GET, POST');
  }

  if (rest === '/check') {
    if (request.method === 'POST') return checkArms(request, env);
    return methodNotAllowed('POST');
  }

  // Item: /api/arms/:id
  let id: string;
  try {
    id = decodeURIComponent(rest.replace(/^\//, ''));
  } catch {
    return jsonError(404, 'not_found', 'Unknown arms route.'); // malformed percent-encoding
  }
  if (id === '' || id.includes('/')) {
    return jsonError(404, 'not_found', 'Unknown arms route.');
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
        `SELECT id, name, is_default FROM registries WHERE is_default = 1 ORDER BY id LIMIT 1`
      ).first<RegistryRow>();
  if (!row) return { error: jsonError(404, 'not_found', 'Unknown registry.') };
  return { registry: { id: row.id, name: row.name } };
}

// ── search ───────────────────────────────────────────────────────────────────────────────────

async function searchArms(env: Env, url: URL): Promise<Response> {
  const params = searchParamsFromUrl(url.searchParams);
  const parsed = parseSearchParams(params);
  if (!parsed.ok) return json(400, { error: 'bad_request', message: parsed.message, param: parsed.param });
  const reg = await lookupRegistry(env, params.registry);
  if ('error' in reg) return reg.error;
  const { tags, q, limit, offset } = parsed.query;

  // Tag-AND: one EXISTS per required tag, each served by the (arms_id, tag) primary key.
  const where = ['a.registry_id = ?'];
  const binds: unknown[] = [reg.registry.id];
  for (const tag of tags) {
    where.push('EXISTS (SELECT 1 FROM arms_tags t WHERE t.arms_id = a.id AND t.tag = ?)');
    binds.push(tag);
  }
  if (q) {
    where.push(`(a.display_name LIKE ? ESCAPE '\\' OR a.blazon LIKE ? ESCAPE '\\')`);
    const pattern = likePattern(q);
    binds.push(pattern, pattern);
  }
  const whereSql = where.join(' AND ');

  const [countRes, pageRes] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM arms a WHERE ${whereSql}`).bind(...binds),
    env.DB.prepare(
      `SELECT a.id, a.display_name, a.design, a.signature, a.blazon, a.readability, a.created_at
       FROM arms a WHERE ${whereSql}
       ORDER BY a.created_at DESC, a.id
       LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset),
  ]);
  const total = Number((countRes.results[0] as { n: number } | undefined)?.n ?? 0);
  const rows = pageRes.results as Array<Pick<ArmsRow, 'id' | 'display_name' | 'design' | 'signature' | 'blazon' | 'readability' | 'created_at'>>;

  // Public list results never include the contact (no harvesting affordance).
  const items = rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    design: parseStoredDesign(r.design),
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

/** The registry's rows in registration order (the deterministic scan order of checkUnique). */
async function loadRegistryRows(env: Env, registryId: string): Promise<ScanRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, display_name, design, signature, blazon FROM arms
     WHERE registry_id = ? ORDER BY created_at, id LIMIT ?`
  )
    .bind(registryId, MAX_ENTRIES_PER_REGISTRY + 1)
    .all<ScanRow>();
  return results;
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
  return { id: r.id, displayName: r.display_name, blazon: r.blazon, design: parseStoredDesign(r.design) };
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

  const u = uniqueness(d.derived, await loadRegistryRows(env, reg.registry.id));
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

type EntryInput = { displayName: string; contact: string | null; derived: Derived } | { error: Response };

function validateEntryInput(body: Record<string, unknown>): EntryInput {
  const name = cleanDisplayName(body.displayName);
  if (!name.ok) return { error: fieldError('displayName', name.message) };
  const contact = cleanContact(body.contact);
  if (!contact.ok) return { error: fieldError('contact', contact.message) };
  const d = deriveDesign(body.design);
  if ('error' in d) return d;
  return { displayName: name.value!, contact: contact.value, derived: d.derived };
}

async function createArms(request: Request, env: Env): Promise<Response> {
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
  const reg = await lookupRegistry(env, body.registry);
  if ('error' in reg) return reg.error;

  const rows = await loadRegistryRows(env, reg.registry.id);
  if (rows.length >= MAX_ENTRIES_PER_REGISTRY) {
    return jsonError(409, 'registry_full', 'This registry is full.');
  }
  const u = uniqueness(input.derived, rows);
  if (u.kind !== 'ok') return uniquenessError(u);

  const id = randomToken(16); // ~128-bit
  const editSecret = randomToken(32); // ~256-bit
  const editSecretHash = await sha256hex(editSecret);
  const now = new Date().toISOString();
  const d = input.derived;
  const nd = d.design;

  try {
    // One transaction: the row and its tags land together or not at all.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO arms (id, registry_id, display_name, contact, design, signature, blazon,
           field_division, ordinary, charge, readability, edit_secret_hash, rev, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(
        id, reg.registry.id, input.displayName, input.contact, JSON.stringify(nd), d.signature, d.blazon,
        fieldDivision(nd.field), nd.ordinary?.type ?? null, nd.charges?.charge ?? null, d.readability,
        editSecretHash, now, now
      ),
      insertTags(env, id, reg.registry.id, d.tags),
    ]);
  } catch (e) {
    // Lost a race with a concurrent registration of the same signature.
    if (isUniqueViolation(e)) return await raceDuplicate(env, reg.registry.id, d.signature);
    throw e;
  }

  return json(201, {
    id,
    editSecret,
    registry: reg.registry,
    rev: 1,
    blazon: d.blazon,
    signature: d.signature,
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
    `SELECT id, display_name, design, signature, blazon FROM arms WHERE registry_id = ? AND signature = ?`
  )
    .bind(registryId, sig)
    .first<ScanRow>();
  if (!row) return jsonError(409, 'duplicate', 'These arms were just registered by someone else.');
  return uniquenessError({ kind: 'duplicate', conflict: row });
}

// ── read / update / withdraw ─────────────────────────────────────────────────────────────────

async function readArms(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT a.id, a.registry_id, a.display_name, a.contact, a.design, a.signature, a.blazon,
            a.readability, a.rev, a.created_at, a.updated_at, r.name AS registry_name
     FROM arms a JOIN registries r ON r.id = a.registry_id WHERE a.id = ?`
  )
    .bind(id)
    .first<Omit<ArmsRow, 'edit_secret_hash'> & { registry_name: string }>();

  if (!row) return jsonError(404, 'not_found', 'No arms with that id.');
  return json(200, rowToEntry(row, row.registry_name));
}

/** The single-entry shape (GET and PUT): includes the public contact, never the secret hash. */
function rowToEntry(row: Omit<ArmsRow, 'edit_secret_hash'>, registryName: string) {
  return {
    id: row.id,
    registry: { id: row.registry_id, name: registryName },
    displayName: row.display_name,
    contact: row.contact,
    design: parseStoredDesign(row.design),
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
  if (d.signature !== row.signature) {
    const u = uniqueness(d, await loadRegistryRows(env, row.registry_id), id);
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
        `UPDATE arms SET display_name = ?, contact = ?, design = ?, signature = ?, blazon = ?,
           field_division = ?, ordinary = ?, charge = ?, readability = ?, rev = rev + 1, updated_at = ?
         WHERE id = ? AND rev = ?`
      ).bind(
        input.displayName, input.contact, JSON.stringify(nd), d.signature, d.blazon,
        fieldDivision(nd.field), nd.ordinary?.type ?? null, nd.charges?.charge ?? null, d.readability,
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
        contact: input.contact,
        design: JSON.stringify(nd),
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

  // Withdrawal deletes the entry outright (nothing is kept), which also frees its signature.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM arms_tags WHERE arms_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM arms WHERE id = ?`).bind(id),
  ]);
  return json(200, { id, withdrawn: true });
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
  try {
    return { body: await request.json() };
  } catch {
    return { error: jsonError(400, 'bad_request', 'Body is not valid JSON.') };
  }
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
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
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
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return json(status, { error: code, message });
}

function methodNotAllowed(allow: string): Response {
  return json(405, { error: 'method_not_allowed', message: `Allowed: ${allow}.` }, { Allow: allow });
}
