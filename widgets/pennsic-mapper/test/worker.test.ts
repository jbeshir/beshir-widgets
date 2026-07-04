// Offline Worker/D1 tests. These run in the workers runtime (workerd) against a local Miniflare D1
// via @cloudflare/vitest-pool-workers — no real Cloudflare account or network. schema.sql is applied
// to the local D1 before the suite, and the Worker's fetch handler is exercised directly.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../worker/index';
import schemaSql from '../schema.sql?raw';

beforeAll(async () => {
  // Apply the committed schema (the same file the owner applies in production). Strip line comments
  // and run each statement; our schema has no semicolons inside literals, so a naive split is safe.
  const cleaned = schemaSql.replace(/--[^\n]*(?:\n|$)/g, '\n');
  for (const stmt of cleaned.split(';').map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
});

interface CallOpts {
  body?: unknown;
  headers?: Record<string, string>;
}

// The create route is rate-limited per CF-Connecting-IP *before* the body is parsed, so every
// POST /api/map — including the ones that 400 on a bad body — counts against its IP's 10/60s
// budget. To keep each test independent, default every request to its own unique IP; a test that
// deliberately exercises the limiter (below) opts back in to a single shared IP explicitly.
let ipCounter = 0;

async function call(method: string, path: string, opts: CallOpts = {}): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  if (!('CF-Connecting-IP' in headers)) {
    ipCounter += 1;
    headers['CF-Connecting-IP'] = `10.0.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  }
  let body: string | undefined;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    if (!('Content-Type' in headers)) headers['Content-Type'] = 'application/json';
  }
  const request = new Request(`https://widget.test${path}`, { method, headers, body });
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

interface TestPin {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
}

function pin(id: string, overrides: Partial<TestPin> = {}): TestPin {
  return { id, x: 0.5, y: 0.5, color: 'rose', label: '', ...overrides };
}

async function createMap(name: string, pins: TestPin[]) {
  const res = await call('POST', '/api/map', { body: { name, pins } });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; editSecret: string; eventId: string };
}

describe('POST /api/map', () => {
  it('creates a map attached to the default event and returns id + secret', async () => {
    const res = await call('POST', '/api/map', {
      body: { name: 'Camp Layout', pins: [pin('a', { label: 'Kitchen' }), pin('b', { x: 0.2, y: 0.8 })] },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const data = (await res.json()) as Record<string, unknown>;
    expect(typeof data.id).toBe('string');
    expect((data.id as string).length).toBeGreaterThanOrEqual(16);
    expect(typeof data.editSecret).toBe('string');
    expect((data.editSecret as string).length).toBeGreaterThanOrEqual(32);
    expect(data.eventId).toBe('pennsic-53');
  });

  it('rejects a non-JSON body (400) and a non-array pins (400)', async () => {
    const noCt = await call('POST', '/api/map', { headers: {}, body: undefined });
    expect(noCt.status).toBe(400);

    const badPins = await call('POST', '/api/map', { body: { name: 'x', pins: 'nope' } });
    expect(badPins.status).toBe(400);
  });

  it('defaults a blank name, dedupes pin ids, and preserves pin order', async () => {
    const created = await createMap('   ', [pin('p1', { label: 'First' }), pin('p1', { label: 'Dup' }), pin('p2', { label: 'Second' })]);
    const got = (await (await call('GET', `/api/map/${created.id}`)).json()) as Record<string, unknown>;
    expect(got.name).toBe('Untitled map');
    const pins = got.pins as TestPin[];
    expect(pins.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(pins[0].label).toBe('First'); // first-seen wins over the later duplicate id
  });

  it('rejects a bad pin: x out of [0,1] range', async () => {
    const res = await call('POST', '/api/map', { body: { name: 'x', pins: [pin('a', { x: 1.5 })] } });
    expect(res.status).toBe(400);
  });

  it('rejects a bad pin: color not in the fixed palette', async () => {
    const res = await call('POST', '/api/map', { body: { name: 'x', pins: [pin('a', { color: 'not-a-colour' })] } });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/map/:id', () => {
  it('round-trips a created map and never leaks the secret hash', async () => {
    const created = await createMap('My Map', [pin('a', { x: 0.1, y: 0.9, color: 'teal', label: 'Gate' })]);
    const res = await call('GET', `/api/map/${created.id}`);
    expect(res.status).toBe(200);
    const m = (await res.json()) as Record<string, unknown>;
    expect(m.id).toBe(created.id);
    expect(m.name).toBe('My Map');
    expect(m.eventId).toBe('pennsic-53');
    expect(m.rev).toBe(1);
    expect(m.pins).toEqual([{ id: 'a', x: 0.1, y: 0.9, color: 'teal', label: 'Gate' }]);
    expect('edit_secret_hash' in m).toBe(false);
    expect('editSecret' in m).toBe(false);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await call('GET', '/api/map/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns 404 (not 500) for a malformed percent-encoded id', async () => {
    const res = await call('GET', '/api/map/%');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/map/:id', () => {
  it('edits with the correct secret and bumps the revision', async () => {
    const created = await createMap('Before', [pin('a')]);
    const put = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'After', pins: [pin('b', { color: 'gold' }), pin('c', { color: 'green' })] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(put.status).toBe(200);
    const pd = (await put.json()) as Record<string, unknown>;
    expect(pd.rev).toBe(2);

    const after = (await (await call('GET', `/api/map/${created.id}`)).json()) as Record<string, unknown>;
    expect(after.name).toBe('After');
    expect((after.pins as TestPin[]).map((p) => p.id)).toEqual(['b', 'c']);
    expect(after.rev).toBe(2);
  });

  it('rejects a missing secret (401) and a wrong secret (403)', async () => {
    const created = await createMap('Guarded', [pin('a')]);

    const noAuth = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'Hacked', pins: [] },
      headers: { 'If-Match': '1' },
    });
    expect(noAuth.status).toBe(401);

    const wrong = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'Hacked', pins: [] },
      headers: { Authorization: 'Bearer not-the-secret', 'If-Match': '1' },
    });
    expect(wrong.status).toBe(403);

    // The map is untouched.
    const after = (await (await call('GET', `/api/map/${created.id}`)).json()) as Record<string, unknown>;
    expect(after.name).toBe('Guarded');
    expect(after.rev).toBe(1);
  });

  it('requires If-Match (400) and rejects a stale revision (409)', async () => {
    const created = await createMap('Concurrent', [pin('a')]);

    const noIfMatch = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'x', pins: [] },
      headers: { Authorization: `Bearer ${created.editSecret}` },
    });
    expect(noIfMatch.status).toBe(400);

    // First edit succeeds, taking rev 1 → 2.
    const ok = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'v2', pins: [pin('b')] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(ok.status).toBe(200);

    // A second writer that still thinks it is on rev 1 is rejected.
    const stale = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'v2-conflict', pins: [pin('z')] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(stale.status).toBe(409);

    // Unchanged since the successful edit.
    const after = (await (await call('GET', `/api/map/${created.id}`)).json()) as Record<string, unknown>;
    expect(after.name).toBe('v2');
    expect(after.rev).toBe(2);
  });

  it('rejects a bad pin on edit (label too long)', async () => {
    const created = await createMap('Labelled', [pin('a')]);
    const res = await call('PUT', `/api/map/${created.id}`, {
      body: { name: 'x', pins: [pin('a', { label: 'x'.repeat(81) })] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when editing an unknown id', async () => {
    const res = await call('PUT', '/api/map/nope', {
      body: { name: 'x', pins: [] },
      headers: { Authorization: 'Bearer whatever', 'If-Match': '1' },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/map rate limiting', () => {
  it('returns 429 after 10 requests from the same IP', async () => {
    // Pin a single shared IP so all 11 requests below land on the same limiter key; every other
    // test defaults to its own unique per-call IP (see `call`), so nothing else touches it.
    // limit is 10/60s per key.
    const ip = '192.0.2.2';
    for (let i = 0; i < 10; i++) {
      const res = await call('POST', '/api/map', {
        body: { name: `RL test ${i}`, pins: [] },
        headers: { 'CF-Connecting-IP': ip },
      });
      expect(res.status).toBe(201);
    }
    const limited = await call('POST', '/api/map', {
      body: { name: 'RL over limit', pins: [] },
      headers: { 'CF-Connecting-IP': ip },
    });
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as Record<string, unknown>;
    expect(body.error).toBe('rate_limited');
  });
});
