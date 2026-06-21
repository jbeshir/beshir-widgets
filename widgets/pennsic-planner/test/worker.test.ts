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

async function call(method: string, path: string, opts: CallOpts = {}): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
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

async function createCalendar(name: string, sessionIds: string[]) {
  const res = await call('POST', '/api/calendar', { body: { name, sessionIds } });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; editSecret: string; eventId: string };
}

describe('POST /api/calendar', () => {
  it('creates a calendar attached to the default event and returns id + secret', async () => {
    const res = await call('POST', '/api/calendar', { body: { name: 'War College', sessionIds: ['p53-1', 'p53-2'] } });
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const data = (await res.json()) as Record<string, unknown>;
    expect(typeof data.id).toBe('string');
    expect((data.id as string).length).toBeGreaterThanOrEqual(16);
    expect(typeof data.editSecret).toBe('string');
    expect((data.editSecret as string).length).toBeGreaterThanOrEqual(32);
    expect(data.eventId).toBe('pennsic-53');
  });

  it('rejects a non-JSON body (400) and a non-array sessionIds (400)', async () => {
    const noCt = await call('POST', '/api/calendar', { headers: {}, body: undefined });
    expect(noCt.status).toBe(400);

    const badIds = await call('POST', '/api/calendar', { body: { name: 'x', sessionIds: 'nope' } });
    expect(badIds.status).toBe(400);
  });

  it('defaults a blank name and dedupes session ids', async () => {
    const created = await createCalendar('   ', ['p53-9', 'p53-9', 'p53-10']);
    const got = (await (await call('GET', `/api/calendar/${created.id}`)).json()) as Record<string, unknown>;
    expect(got.name).toBe('Untitled calendar');
    expect(got.sessionIds).toEqual(['p53-9', 'p53-10']);
  });
});

describe('GET /api/calendar/:id', () => {
  it('round-trips a created calendar and never leaks the secret hash', async () => {
    const created = await createCalendar('My Plan', ['p53-100', 'p53-101']);
    const res = await call('GET', `/api/calendar/${created.id}`);
    expect(res.status).toBe(200);
    const c = (await res.json()) as Record<string, unknown>;
    expect(c.id).toBe(created.id);
    expect(c.name).toBe('My Plan');
    expect(c.eventId).toBe('pennsic-53');
    expect(c.rev).toBe(1);
    expect(c.sessionIds).toEqual(['p53-100', 'p53-101']);
    expect('edit_secret_hash' in c).toBe(false);
    expect('editSecret' in c).toBe(false);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await call('GET', '/api/calendar/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('returns 404 (not 500) for a malformed percent-encoded id', async () => {
    const res = await call('GET', '/api/calendar/%');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/calendar/:id', () => {
  it('edits with the correct secret and bumps the revision', async () => {
    const created = await createCalendar('Before', ['p53-1']);
    const put = await call('PUT', `/api/calendar/${created.id}`, {
      body: { name: 'After', sessionIds: ['p53-2', 'p53-3'] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(put.status).toBe(200);
    const pd = (await put.json()) as Record<string, unknown>;
    expect(pd.rev).toBe(2);

    const after = (await (await call('GET', `/api/calendar/${created.id}`)).json()) as Record<string, unknown>;
    expect(after.name).toBe('After');
    expect(after.sessionIds).toEqual(['p53-2', 'p53-3']);
    expect(after.rev).toBe(2);
  });

  it('rejects a missing secret (401) and a wrong secret (403)', async () => {
    const created = await createCalendar('Guarded', ['p53-1']);

    const noAuth = await call('PUT', `/api/calendar/${created.id}`, {
      body: { name: 'Hacked', sessionIds: [] },
      headers: { 'If-Match': '1' },
    });
    expect(noAuth.status).toBe(401);

    const wrong = await call('PUT', `/api/calendar/${created.id}`, {
      body: { name: 'Hacked', sessionIds: [] },
      headers: { Authorization: 'Bearer not-the-secret', 'If-Match': '1' },
    });
    expect(wrong.status).toBe(403);

    // The calendar is untouched.
    const after = (await (await call('GET', `/api/calendar/${created.id}`)).json()) as Record<string, unknown>;
    expect(after.name).toBe('Guarded');
    expect(after.rev).toBe(1);
  });

  it('requires If-Match (400) and rejects a stale revision (409)', async () => {
    const created = await createCalendar('Concurrent', ['p53-1']);

    const noIfMatch = await call('PUT', `/api/calendar/${created.id}`, {
      body: { name: 'x', sessionIds: [] },
      headers: { Authorization: `Bearer ${created.editSecret}` },
    });
    expect(noIfMatch.status).toBe(400);

    // First edit succeeds, taking rev 1 → 2.
    const ok = await call('PUT', `/api/calendar/${created.id}`, {
      body: { name: 'v2', sessionIds: ['p53-2'] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(ok.status).toBe(200);

    // A second writer that still thinks it is on rev 1 is rejected.
    const stale = await call('PUT', `/api/calendar/${created.id}`, {
      body: { name: 'v2-conflict', sessionIds: ['p53-9'] },
      headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
    });
    expect(stale.status).toBe(409);

    // Unchanged since the successful edit.
    const after = (await (await call('GET', `/api/calendar/${created.id}`)).json()) as Record<string, unknown>;
    expect(after.name).toBe('v2');
    expect(after.rev).toBe(2);
  });

  it('returns 404 when editing an unknown id', async () => {
    const res = await call('PUT', '/api/calendar/nope', {
      body: { name: 'x', sessionIds: [] },
      headers: { Authorization: 'Bearer whatever', 'If-Match': '1' },
    });
    expect(res.status).toBe(404);
  });
});
describe('POST /api/calendar rate limiting', () => {
  it('returns 429 after 10 requests from the same IP', async () => {
    // Use a dedicated IP so this test's counter is independent of the other tests, which all
    // use the 'unknown' key (no CF-Connecting-IP header). limit is 10/60s per key.
    const ip = '192.0.2.1';
    for (let i = 0; i < 10; i++) {
      const res = await call('POST', '/api/calendar', {
        body: { name: `RL test ${i}`, sessionIds: [] },
        headers: { 'CF-Connecting-IP': ip },
      });
      expect(res.status).toBe(201);
    }
    const limited = await call('POST', '/api/calendar', {
      body: { name: 'RL over limit', sessionIds: [] },
      headers: { 'CF-Connecting-IP': ip },
    });
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as Record<string, unknown>;
    expect(body.error).toBe('rate_limited');
  });
});
