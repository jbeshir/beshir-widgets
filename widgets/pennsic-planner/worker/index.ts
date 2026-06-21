// Cloudflare Worker for the Pennsic Planner.
//
// It owns the `/api/calendar` routes that back shareable calendars; every other request is served
// from the static SPA bundle (the assets binding). A calendar is a named set of session ids that
// belong to one event, stored in D1 and reached by a capability URL. The edit secret is the
// capability: we store only its SHA-256 hash and compare in constant time, so a calendar's id alone
// grants read-only access while id + secret grants editing.
//
// Routes:
//   POST /api/calendar         -> create; returns { id, editSecret, eventId }   (201)
//   GET  /api/calendar/:id     -> read;   returns { id, name, sessionIds, eventId, rev, updatedAt }
//   PUT  /api/calendar/:id     -> edit;   Authorization: Bearer <secret>, If-Match: <rev>
//
// The default event id is a constant here, kept in sync with the SPA's DEFAULT_EVENT_ID. New
// calendars always attach to the current default event; the event is never carried in the URL.

interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  CREATE_LIMITER: RateLimit;
}

// Kept in sync with src/data/events.ts DEFAULT_EVENT_ID and the seed row in schema.sql.
const DEFAULT_EVENT_ID = 'pennsic-53';

// Input caps. Pennsic has ~1,800 sessions, so 4,000 ids is a generous ceiling that still bounds a
// single row. Session ids are short slugs (e.g. "p53-1131"); 64 chars is plenty.
const MAX_NAME_LEN = 200;
const MAX_SESSION_IDS = 4000;
const MAX_SESSION_ID_LEN = 64;
const DEFAULT_NAME = 'Untitled calendar';

interface CalendarRow {
  id: string;
  event_id: string;
  name: string;
  session_ids: string;
  edit_secret_hash: string;
  rev: number;
  created_at: string;
  updated_at: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const { pathname } = new URL(request.url);

      if (pathname === '/api/calendar' || pathname.startsWith('/api/calendar/')) {
        return await handleCalendarApi(request, env, pathname);
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
};

async function handleCalendarApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const rest = pathname.slice('/api/calendar'.length); // '' | '/<id>' | '/<id>/...'

  // Collection: POST /api/calendar
  if (rest === '' || rest === '/') {
    if (request.method === 'POST') return createCalendar(request, env);
    return methodNotAllowed('POST');
  }

  // Item: /api/calendar/:id
  let id: string;
  try {
    id = decodeURIComponent(rest.replace(/^\//, ''));
  } catch {
    return jsonError(404, 'not_found', 'Unknown calendar route.'); // malformed percent-encoding
  }
  if (id === '' || id.includes('/')) {
    return jsonError(404, 'not_found', 'Unknown calendar route.');
  }

  if (request.method === 'GET') return readCalendar(env, id);
  if (request.method === 'PUT') return updateCalendar(request, env, id);
  return methodNotAllowed('GET, PUT');
}

async function createCalendar(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.CREATE_LIMITER.limit({ key: ip });
  if (!success) return jsonError(429, 'rate_limited', 'Too many calendars created — try again shortly.');
  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed.error;
  const input = validateCalendarInput(parsed.body);
  if ('error' in input) return input.error;

  const id = randomToken(16); // ~128-bit
  const editSecret = randomToken(32); // ~256-bit
  const editSecretHash = await sha256hex(editSecret);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO calendars (id, event_id, name, session_ids, edit_secret_hash, rev, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, DEFAULT_EVENT_ID, input.name, JSON.stringify(input.sessionIds), editSecretHash, now, now)
    .run();

  return json(201, { id, editSecret, eventId: DEFAULT_EVENT_ID });
}

async function readCalendar(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, event_id, name, session_ids, rev, updated_at FROM calendars WHERE id = ?`
  )
    .bind(id)
    .first<Pick<CalendarRow, 'id' | 'event_id' | 'name' | 'session_ids' | 'rev' | 'updated_at'>>();

  if (!row) return jsonError(404, 'not_found', 'No calendar with that id.');
  return json(200, rowToPublic(row));
}

async function updateCalendar(request: Request, env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, event_id, name, session_ids, edit_secret_hash, rev, updated_at FROM calendars WHERE id = ?`
  )
    .bind(id)
    .first<CalendarRow>();

  if (!row) return jsonError(404, 'not_found', 'No calendar with that id.');

  // Capability check: Bearer secret, hashed and compared in constant time against the stored hash.
  const secret = bearerToken(request.headers.get('Authorization'));
  if (secret == null) return jsonError(401, 'unauthorized', 'Missing edit secret.');
  const presentedHash = await sha256hex(secret);
  if (!timingSafeEqual(presentedHash, row.edit_secret_hash)) {
    return jsonError(403, 'forbidden', 'Wrong edit secret.');
  }

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
  const input = validateCalendarInput(parsed.body);
  if ('error' in input) return input.error;

  const now = new Date().toISOString();
  // Conditional UPDATE on rev closes the race between the SELECT above and this write.
  const result = await env.DB.prepare(
    `UPDATE calendars SET name = ?, session_ids = ?, rev = rev + 1, updated_at = ?
     WHERE id = ? AND rev = ?`
  )
    .bind(input.name, JSON.stringify(input.sessionIds), now, id, expectedRev)
    .run();

  if (!result.meta.changes) {
    return jsonError(409, 'conflict', 'Stale revision; reload before saving.');
  }

  return json(200, {
    id: row.id,
    name: input.name,
    sessionIds: input.sessionIds,
    eventId: row.event_id,
    rev: expectedRev + 1,
    updatedAt: now,
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

function rowToPublic(row: Pick<CalendarRow, 'id' | 'event_id' | 'name' | 'session_ids' | 'rev' | 'updated_at'>) {
  return {
    id: row.id,
    name: row.name,
    sessionIds: parseSessionIds(row.session_ids),
    eventId: row.event_id,
    rev: row.rev,
    updatedAt: row.updated_at,
  };
}

function parseSessionIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
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

type ValidatedInput = { name: string; sessionIds: string[] } | { error: Response };

function validateCalendarInput(body: unknown): ValidatedInput {
  if (body == null || typeof body !== 'object') {
    return { error: jsonError(400, 'bad_request', 'Body must be a JSON object.') };
  }
  const obj = body as Record<string, unknown>;

  let name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name === '') name = DEFAULT_NAME;
  if (name.length > MAX_NAME_LEN) {
    return { error: jsonError(400, 'bad_request', `name exceeds ${MAX_NAME_LEN} characters.`) };
  }

  const rawIds = obj.sessionIds;
  if (!Array.isArray(rawIds)) {
    return { error: jsonError(400, 'bad_request', 'sessionIds must be an array.') };
  }
  if (rawIds.length > MAX_SESSION_IDS) {
    return { error: jsonError(400, 'bad_request', `sessionIds exceeds ${MAX_SESSION_IDS} entries.`) };
  }
  const seen = new Set<string>();
  const sessionIds: string[] = [];
  for (const v of rawIds) {
    if (typeof v !== 'string' || v.length === 0 || v.length > MAX_SESSION_ID_LEN) {
      return { error: jsonError(400, 'bad_request', 'sessionIds must be non-empty strings under 64 chars.') };
    }
    if (!seen.has(v)) {
      seen.add(v);
      sessionIds.push(v);
    }
  }

  return { name, sessionIds };
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
