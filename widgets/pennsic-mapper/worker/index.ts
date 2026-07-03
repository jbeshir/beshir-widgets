// Cloudflare Worker for the Pennsic Mapper.
//
// It owns the `/api/map` routes that back shareable maps; every other request is served from the
// static SPA bundle (the assets binding). A map is a named set of coloured, labelled pins that
// belong to one event, stored in D1 and reached by a capability URL. The edit secret is the
// capability: we store only its SHA-256 hash and compare in constant time, so a map's id alone
// grants read-only access while id + secret grants editing.
//
// Routes:
//   POST /api/map         -> create; returns { id, editSecret, eventId }   (201)
//   GET  /api/map/:id     -> read;   returns { id, name, pins, eventId, rev, updatedAt }
//   PUT  /api/map/:id     -> edit;   Authorization: Bearer <secret>, If-Match: <rev>
//
// The default event id is a constant here, kept in sync with the SPA's DEFAULT_EVENT_ID. New
// maps always attach to the current default event; the event is never carried in the URL.

import { isPaletteKey } from '../src/lib/palette';

interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  CREATE_LIMITER: RateLimit;
}

// Kept in sync with src/data/events.ts DEFAULT_EVENT_ID and the seed row in schema.sql.
const DEFAULT_EVENT_ID = 'pennsic-53';

// Input caps. 2,000 pins is a generous ceiling for a personal camp map that still bounds a single
// row; pin ids are short client-generated slugs, 64 chars is plenty.
const MAX_NAME_LEN = 200;
const MAX_PINS = 2000;
const MAX_PIN_ID_LEN = 64;
const MAX_LABEL_LEN = 80;
const DEFAULT_NAME = 'Untitled map';

interface Pin {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
}

interface MapRow {
  id: string;
  event_id: string;
  name: string;
  pins: string;
  edit_secret_hash: string;
  rev: number;
  created_at: string;
  updated_at: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    try {
      const { pathname } = new URL(request.url);

      if (pathname === '/api/map' || pathname.startsWith('/api/map/')) {
        return await handleMapApi(request, env, pathname);
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

async function handleMapApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const rest = pathname.slice('/api/map'.length); // '' | '/<id>' | '/<id>/...'

  // Collection: POST /api/map
  if (rest === '' || rest === '/') {
    if (request.method === 'POST') return createMap(request, env);
    return methodNotAllowed('POST');
  }

  // Item: /api/map/:id
  let id: string;
  try {
    id = decodeURIComponent(rest.replace(/^\//, ''));
  } catch {
    return jsonError(404, 'not_found', 'Unknown map route.'); // malformed percent-encoding
  }
  if (id === '' || id.includes('/')) {
    return jsonError(404, 'not_found', 'Unknown map route.');
  }

  if (request.method === 'GET') return readMap(env, id);
  if (request.method === 'PUT') return updateMap(request, env, id);
  return methodNotAllowed('GET, PUT');
}

async function createMap(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.CREATE_LIMITER.limit({ key: ip });
  if (!success) return jsonError(429, 'rate_limited', 'Too many maps created — try again shortly.');
  const parsed = await parseBody(request);
  if ('error' in parsed) return parsed.error;
  const input = validateMapInput(parsed.body);
  if ('error' in input) return input.error;

  const id = randomToken(16); // ~128-bit
  const editSecret = randomToken(32); // ~256-bit
  const editSecretHash = await sha256hex(editSecret);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO maps (id, event_id, name, pins, edit_secret_hash, rev, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, DEFAULT_EVENT_ID, input.name, JSON.stringify(input.pins), editSecretHash, now, now)
    .run();

  return json(201, { id, editSecret, eventId: DEFAULT_EVENT_ID });
}

async function readMap(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, event_id, name, pins, rev, updated_at FROM maps WHERE id = ?`
  )
    .bind(id)
    .first<Pick<MapRow, 'id' | 'event_id' | 'name' | 'pins' | 'rev' | 'updated_at'>>();

  if (!row) return jsonError(404, 'not_found', 'No map with that id.');
  return json(200, rowToPublic(row));
}

async function updateMap(request: Request, env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, event_id, name, pins, edit_secret_hash, rev, updated_at FROM maps WHERE id = ?`
  )
    .bind(id)
    .first<MapRow>();

  if (!row) return jsonError(404, 'not_found', 'No map with that id.');

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
  const input = validateMapInput(parsed.body);
  if ('error' in input) return input.error;

  const now = new Date().toISOString();
  // Conditional UPDATE on rev closes the race between the SELECT above and this write.
  const result = await env.DB.prepare(
    `UPDATE maps SET name = ?, pins = ?, rev = rev + 1, updated_at = ?
     WHERE id = ? AND rev = ?`
  )
    .bind(input.name, JSON.stringify(input.pins), now, id, expectedRev)
    .run();

  if (!result.meta.changes) {
    return jsonError(409, 'conflict', 'Stale revision; reload before saving.');
  }

  return json(200, {
    id: row.id,
    name: input.name,
    pins: input.pins,
    eventId: row.event_id,
    rev: expectedRev + 1,
    updatedAt: now,
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

function rowToPublic(row: Pick<MapRow, 'id' | 'event_id' | 'name' | 'pins' | 'rev' | 'updated_at'>) {
  return {
    id: row.id,
    name: row.name,
    pins: parsePins(row.pins),
    eventId: row.event_id,
    rev: row.rev,
    updatedAt: row.updated_at,
  };
}

function parsePins(raw: string): Pin[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v.filter(isStoredPin) as Pin[]) : [];
  } catch {
    return [];
  }
}

function isStoredPin(v: unknown): v is Pin {
  if (v == null || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.color === 'string' &&
    typeof p.label === 'string'
  );
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

type ValidatedInput = { name: string; pins: Pin[] } | { error: Response };

function validateMapInput(body: unknown): ValidatedInput {
  if (body == null || typeof body !== 'object') {
    return { error: jsonError(400, 'bad_request', 'Body must be a JSON object.') };
  }
  const obj = body as Record<string, unknown>;

  let name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name === '') name = DEFAULT_NAME;
  if (name.length > MAX_NAME_LEN) {
    return { error: jsonError(400, 'bad_request', `name exceeds ${MAX_NAME_LEN} characters.`) };
  }

  const rawPins = obj.pins;
  if (!Array.isArray(rawPins)) {
    return { error: jsonError(400, 'bad_request', 'pins must be an array.') };
  }
  if (rawPins.length > MAX_PINS) {
    return { error: jsonError(400, 'bad_request', `pins exceeds ${MAX_PINS} entries.`) };
  }

  const seen = new Set<string>();
  const pins: Pin[] = [];
  for (const v of rawPins) {
    const pin = validatePin(v);
    if (pin == null) {
      return { error: jsonError(400, 'bad_request', 'A pin is malformed (id/x/y/color/label).') };
    }
    // Preserve first-seen order; drop later duplicates of the same id.
    if (!seen.has(pin.id)) {
      seen.add(pin.id);
      pins.push(pin);
    }
  }

  return { name, pins };
}

function validatePin(v: unknown): Pin | null {
  if (v == null || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;

  if (typeof p.id !== 'string' || p.id.length === 0 || p.id.length > MAX_PIN_ID_LEN) return null;
  if (typeof p.x !== 'number' || !Number.isFinite(p.x) || p.x < 0 || p.x > 1) return null;
  if (typeof p.y !== 'number' || !Number.isFinite(p.y) || p.y < 0 || p.y > 1) return null;
  if (!isPaletteKey(p.color)) return null;
  if (typeof p.label !== 'string') return null;

  const label = p.label.trim();
  if (label.length > MAX_LABEL_LEN) return null;

  return { id: p.id, x: p.x, y: p.y, color: p.color, label };
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
