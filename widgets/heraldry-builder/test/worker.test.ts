// Offline Worker/D1 tests. These run in the workers runtime (workerd) against a local Miniflare D1
// via @cloudflare/vitest-pool-workers — no real Cloudflare account or network. The committed
// migrations are applied to the local D1 before the suite (test/apply-migrations.ts), and the
// Worker's fetch handler is exercised directly.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../worker/index';
import sample from '../src/data/sample-registry.json';
import {
  FIELD_SHAPES, blazon, candidateKey, checkUnique, parseSearchParams, resolve, searchEntries, signature,
  type RegistryEntryLike, type SearchParams,
} from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';

interface CallOpts {
  body?: unknown;
  headers?: Record<string, string>;
}

// The create route is rate-limited per CF-Connecting-IP *before* the body is parsed, so every
// POST /api/arms — including the ones that 400 on a bad body — counts against its IP's 10/60s
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

type Json = Record<string, any>;

async function bodyOf(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

// ── designs ──────────────────────────────────────────────────────────────────────────────────

const plain = (tincture: string) => ({ kind: 'plain', tincture });

/** A unique, valid design per n: Azure/Gules/… field, a charge Or/Argent, varied by charge and count. */
const CHARGE_POOL = ['mullet', 'rose', 'key', 'crown', 'heart', 'sword', 'anchor', 'gear', 'crescent', 'lightbulb'];
function uniqueDesign(n: number) {
  const fields = ['azure', 'gules', 'vert', 'sable', 'purpure'];
  return {
    v: 1,
    field: plain(fields[n % fields.length]),
    ordinary: null,
    charges: {
      charge: CHARGE_POOL[Math.floor(n / fields.length) % CHARGE_POOL.length],
      count: 1 + (Math.floor(n / (fields.length * CHARGE_POOL.length)) % 3),
      placement: 'field',
      tincture: 'or',
    },
  };
}
let designCounter = 0;
const freshDesign = () => uniqueDesign(designCounter++);

const wolfBordure = (posture: string) => ({
  v: 1,
  field: plain('sable'),
  ordinary: { type: 'bordure', tincture: 'argent' },
  charges: { charge: 'wolf', count: 1, placement: 'field', posture, tincture: 'or' },
});

async function register(design: unknown, extra: Json = {}) {
  const res = await call('POST', '/api/arms', { body: { displayName: 'Test Person', design, ...extra } });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
  return (await res.json()) as { id: string; editSecret: string; registry: { id: string; name: string }; rev: number; blazon: string; signature: string };
}

async function addRegistry(id: string, name: string) {
  await env.DB.prepare(`INSERT OR IGNORE INTO registries (id, name, is_default, created_at) VALUES (?, ?, 0, ?)`)
    .bind(id, name, '2026-10-02T00:00:00Z')
    .run();
}

// ── registries ───────────────────────────────────────────────────────────────────────────────

describe('GET /api/registries', () => {
  it('lists the seeded default registry', async () => {
    const res = await call('GET', '/api/registries');
    expect(res.status).toBe(200);
    const list = (await res.json()) as Json[];
    expect(list[0]).toEqual({ id: 'default', name: 'Default', isDefault: true });
  });

  it('rejects other methods (405)', async () => {
    const res = await call('POST', '/api/registries', { body: {} });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
  });
});

// ── create ───────────────────────────────────────────────────────────────────────────────────

describe('POST /api/arms', () => {
  it('accepts celestine designs and rejects celestine on another metal', async () => {
    const ok = await call('POST', '/api/arms', {
      body: {
        displayName: 'Sky Marlowe',
        contact: null,
        design: { v: 1, field: plain('vert'), ordinary: { type: 'chevron', tincture: 'celestine' }, charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'argent' } },
      },
    });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const data = await bodyOf(ok);
    expect(data.blazon).toBe('Vert, a chevron Celestine between three roses Argent');
    expect(data.signature).toContain('O:chevron:ce');
    const tags = await env.DB.prepare(`SELECT tag FROM arms_tags WHERE arms_id = ?`).bind(data.id).all<{ tag: string }>();
    expect(tags.results.map((r) => r.tag)).toEqual(expect.arrayContaining(['ordinary-tincture:celestine', 'tincture:celestine']));

    const check = await call('POST', '/api/arms/check', {
      body: { design: { v: 1, field: plain('celestine'), charges: { charge: 'stag', count: 1, placement: 'field', tincture: 'sable' } } },
    });
    expect(check.status).toBe(200);
    expect((await bodyOf(check)).verdict).toBe('ok');

    const bad = await call('POST', '/api/arms', {
      body: { displayName: 'Metal Metal', contact: null, design: { v: 1, field: plain('argent'), ordinary: { type: 'fess', tincture: 'celestine' } } },
    });
    expect(bad.status).toBe(400);
    const err = await bodyOf(bad);
    expect(err.error).toBe('invalid_design');
    expect(err.issues.map((i: Json) => i.message).join(' ')).toMatch(/metal on metal/);
  });

  it('registers in the default registry, returns id + secret, and stores only the hash', async () => {
    const res = await call('POST', '/api/arms', {
      body: {
        displayName: 'Rowan Ashby',
        contact: 'by the fire pit',
        design: { v: 1, field: plain('vert'), ordinary: { type: 'pale', tincture: 'argent' }, charges: null },
      },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const data = await bodyOf(res);
    expect(data.id.length).toBeGreaterThanOrEqual(16);
    expect(data.editSecret.length).toBeGreaterThanOrEqual(32);
    expect(data.registry).toEqual({ id: 'default', name: 'Default' });
    expect(data.rev).toBe(1);
    expect(data.blazon).toBe('Vert, a pale Argent');
    expect(data.signature).toBe('v1|F:plain:vt|O:pale:ar|C:-');

    const row = await env.DB.prepare(`SELECT * FROM arms WHERE id = ?`).bind(data.id).first<Json>();
    expect(row!.edit_secret_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.edit_secret_hash).not.toBe(data.editSecret);
    expect(JSON.stringify(row)).not.toContain(data.editSecret);
    expect(row!.field_division).toBe('plain');
    expect(row!.ordinary).toBe('pale');
    expect(row!.charge).toBeNull();
    expect(row!.readability).toBe('bold');

    const tags = await env.DB.prepare(`SELECT tag, registry_id FROM arms_tags WHERE arms_id = ?`).bind(data.id).all<Json>();
    const tagList = tags.results.map((t) => t.tag);
    expect(tagList).toContain('ordinary:pale');
    expect(tagList).toContain('field:plain');
    expect(tags.results.every((t) => t.registry_id === 'default')).toBe(true);

    const got = await bodyOf(await call('GET', `/api/arms/${data.id}`));
    expect(got).not.toHaveProperty('editSecret');
    expect(got).not.toHaveProperty('edit_secret_hash');
    expect(JSON.stringify(got)).not.toContain(row!.edit_secret_hash);
  });

  it('ignores a forged client blazon/signature and computes its own', async () => {
    const design = freshDesign();
    const res = await call('POST', '/api/arms', {
      body: { displayName: 'Forger', design: { ...design }, blazon: 'Or, a lie', signature: 'v1|F:plain:or|O:-|C:-' },
    });
    expect(res.status).toBe(201);
    const data = await bodyOf(res);
    expect(data.blazon).not.toBe('Or, a lie');
    expect(data.signature).not.toBe('v1|F:plain:or|O:-|C:-');
    const row = await env.DB.prepare(`SELECT blazon, signature, design FROM arms WHERE id = ?`).bind(data.id).first<Json>();
    expect(row!.blazon).toBe(data.blazon);
    expect(JSON.parse(row!.design)).toEqual(resolve(design).ok && (resolve(design) as any).design);
  });

  it('rejects an exact duplicate (409) with the conflicting id — including an equivalent wording', async () => {
    const first = await register({ v: 1, field: plain('gules'), ordinary: null, charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'argent' } });
    // Explicitly stating the default arrangement normalises to the same signature.
    const res = await call('POST', '/api/arms', {
      body: {
        displayName: 'Copycat',
        design: { v: 1, field: plain('gules'), charges: { charge: 'mullet', count: 3, placement: 'field', arrangement: 'two-and-one', tincture: 'argent' } },
      },
    });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('duplicate');
    expect(data.conflictId).toBe(first.id);
    expect(data.conflict.displayName).toBe('Test Person');
    expect(data.conflict).not.toHaveProperty('contact');
  });

  it('rejects a design that is too close (409) and lists the minor differences', async () => {
    const first = await register(wolfBordure('passant'));
    const res = await call('POST', '/api/arms', { body: { displayName: 'Close Call', design: wolfBordure('statant') } });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('too_close');
    expect(data.conflictId).toBe(first.id);
    expect(data.differences).toEqual(['posture (statant ↔ passant)']);
    // A clear difference (posture group) is fine.
    await register(wolfBordure('rampant'));
  });

  it('rejects a rule-of-tincture violation (400 invalid_design) even with a forged signature', async () => {
    const res = await call('POST', '/api/arms', {
      body: {
        displayName: 'Colour on colour',
        design: { v: 1, field: plain('azure'), charges: { charge: 'lion', count: 1, placement: 'field', posture: 'rampant', tincture: 'gules' } },
        signature: 'v1|F:plain:az|O:-|C:lion:1:field:single:rampant:or',
        blazon: 'Azure, a lion rampant Or',
      },
    });
    expect(res.status).toBe(400);
    const data = await bodyOf(res);
    expect(data.error).toBe('invalid_design');
    expect(data.issues.some((i: Json) => i.code === 'tincture')).toBe(true);
    expect(typeof data.message).toBe('string');
  });

  it('rejects malformed designs (400 invalid_design)', async () => {
    const bad: unknown[] = [
      undefined,
      'Azure, a bend Or',
      { v: 1, field: plain('azure'), charges: { charge: 'kraken', count: 1, placement: 'field', tincture: 'or' } },
      // laptop and paintbrush are no longer charges
      { v: 1, field: plain('purpure'), charges: { charge: 'laptop', count: 1, placement: 'field', tincture: 'argent' } },
      { v: 1, field: plain('vert'), charges: { charge: 'paintbrush', count: 3, placement: 'field', tincture: 'or' } },
      { v: 2, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } },
      { v: 1, field: plain('azure') }, // plain field alone: too generic
      { v: 1, kind: 'badge', field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } },
    ];
    for (const design of bad) {
      const res = await call('POST', '/api/arms', { body: { displayName: 'Bad', design } });
      expect(res.status, JSON.stringify(design)).toBe(400);
      expect((await bodyOf(res)).error).toBe('invalid_design');
    }
  });

  it('rejects non-JSON and non-object bodies (400)', async () => {
    const res1 = await call('POST', '/api/arms', { body: 'x', headers: { 'Content-Type': 'text/plain' } });
    expect(res1.status).toBe(400);
    const res2 = await call('POST', '/api/arms', { body: [1, 2] });
    expect(res2.status).toBe(400);
    expect((await bodyOf(res2)).error).toBe('bad_request');
  });

  it('validates and sanitises the public text fields', async () => {
    const blank = await call('POST', '/api/arms', { body: { displayName: '   ', design: freshDesign() } });
    expect(blank.status).toBe(400);
    expect((await bodyOf(blank)).field).toBe('displayName');

    const long = await call('POST', '/api/arms', { body: { displayName: 'x'.repeat(61), design: freshDesign() } });
    expect(long.status).toBe(400);
    const longContact = await call('POST', '/api/arms', { body: { displayName: 'Ok', contact: 'y'.repeat(81), design: freshDesign() } });
    expect(longContact.status).toBe(400);
    expect((await bodyOf(longContact)).field).toBe('contact');

    // Exactly at the caps (counted in code points) is fine; controls, newlines and bidi overrides go.
    const okName = 'é'.repeat(59) + '🦁';
    const created = await register(freshDesign(), { displayName: okName, contact: '  ' });
    const got1 = await bodyOf(await call('GET', `/api/arms/${created.id}`));
    expect(got1.displayName).toBe(okName);
    expect(got1.contact).toBeNull();

    const created2 = await register(freshDesign(), {
      displayName: '  Evil\u202Eeman\u0007\n  Name ',
      contact: 'line one\r\nline\u2066two',
    });
    const got2 = await bodyOf(await call('GET', `/api/arms/${created2.id}`));
    expect(got2.displayName).toBe('Evileman Name');
    expect(got2.contact).toBe('line one linetwo');

    const nfd = await register(freshDesign(), { displayName: 'Jose\u0301' });
    expect((await bodyOf(await call('GET', `/api/arms/${nfd.id}`))).displayName).toBe('Jos\u00e9');
  });

  it('404s an unknown registry', async () => {
    const res = await call('POST', '/api/arms', { body: { registry: 'nowhere', displayName: 'X', design: freshDesign() } });
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error).toBe('not_found');
  });

  it('scopes uniqueness per registry', async () => {
    await addRegistry('other', 'Another party');
    const design = freshDesign();
    await register(design);
    const res = await register(design, { registry: 'other' });
    expect(res.registry).toEqual({ id: 'other', name: 'Another party' });
  });

  it('maps a UNIQUE-index race to 409 duplicate', async () => {
    // Simulate a concurrent winner: a row with the same signature that the pre-insert scan can't
    // read (unparseable design), so only the UNIQUE index catches it.
    await addRegistry('race', 'Race track');
    const design = freshDesign();
    const sig = (await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'race', design } }))).signature;
    await env.DB.prepare(
      `INSERT INTO arms (id, registry_id, display_name, contact, design, signature, blazon, field_division,
         ordinary, charge, readability, edit_secret_hash, rev, created_at, updated_at)
       VALUES ('race-winner', 'race', 'Winner', NULL, 'not json', ?, 'x', 'plain', NULL, NULL, 'bold', 'h', 1, ?, ?)`
    ).bind(sig, '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z').run();
    const res = await call('POST', '/api/arms', { body: { registry: 'race', displayName: 'Loser', design } });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('duplicate');
    expect(data.conflictId).toBe('race-winner');
    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM arms WHERE registry_id = 'race'`).first<Json>();
    expect(count!.n).toBe(1);
    const orphanTags = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM arms_tags t WHERE NOT EXISTS (SELECT 1 FROM arms a WHERE a.id = t.arms_id)`
    ).first<Json>();
    expect(orphanTags!.n).toBe(0);
  });

  it('caps a registry at 2000 entries (409 registry_full)', async () => {
    await addRegistry('full', 'Full house');
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
       INSERT INTO arms (id, registry_id, display_name, contact, design, signature, blazon, field_division,
         ordinary, charge, readability, edit_secret_hash, rev, created_at, updated_at)
       SELECT 'full-' || i, 'full', 'Filler', NULL, 'null', 'sig-' || i, 'x', 'plain', NULL, NULL, 'bold', 'h', 1,
         '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z' FROM n`
    ).run();
    const res = await call('POST', '/api/arms', { body: { registry: 'full', displayName: 'One more', design: freshDesign() } });
    expect(res.status).toBe(409);
    expect((await bodyOf(res)).error).toBe('registry_full');
  });

  it('rejects other methods on the collection (405)', async () => {
    const res = await call('DELETE', '/api/arms');
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, POST');
  });
});

// ── check ────────────────────────────────────────────────────────────────────────────────────

describe('POST /api/arms/check', () => {
  it('reports ok / duplicate / too-close with the server-computed blazon and signature', async () => {
    await addRegistry('checks', 'Check party');
    const design = { v: 1, field: plain('or'), charges: { charge: 'dragon', count: 1, placement: 'field', posture: 'rampant', tincture: 'gules' } };

    const ok = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design } }));
    expect(ok.verdict).toBe('ok');
    expect(ok.blazon).toBe('Or, a dragon segreant Gules');
    expect(ok.signature).toBe('v1|F:plain:or|O:-|C:dragon:1:field:single:rampant:gu');
    expect(ok.readability).toBe('bold');
    expect(ok.registry).toEqual({ id: 'checks', name: 'Check party' });
    expect(ok).not.toHaveProperty('conflict');

    const created = await register(design, { registry: 'checks', displayName: 'Hana' });
    const dup = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design } }));
    expect(dup.verdict).toBe('duplicate');
    expect(dup.conflict).toMatchObject({ id: created.id, displayName: 'Hana', blazon: 'Or, a dragon segreant Gules' });
    expect(dup.conflict.design).toEqual((resolve(design) as any).design);

    const passant = { ...design, charges: { ...design.charges, posture: 'passant' } };
    const stillOk = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design: passant } }));
    expect(stillOk.verdict).toBe('ok'); // rampant vs passant: different posture groups = clear

    await register(wolfBordure('statant'), { registry: 'checks' });
    const close = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design: wolfBordure('passant') } }));
    expect(close.verdict).toBe('too-close');
    expect(close.differences).toEqual(['posture (passant ↔ statant)']);
  });

  it('400s an invalid design with issues and 404s an unknown registry', async () => {
    const bad = await call('POST', '/api/arms/check', {
      body: { design: { v: 1, field: plain('gules'), charges: { charge: 'lion', count: 1, placement: 'field', posture: 'rampant', tincture: 'azure' } } },
    });
    expect(bad.status).toBe(400);
    const data = await bodyOf(bad);
    expect(data.error).toBe('invalid_design');
    expect(data.issues[0].layer).toBe('charges');

    const unknown = await call('POST', '/api/arms/check', { body: { registry: 'nope', design: freshDesign() } });
    expect(unknown.status).toBe(404);
  });

  it('is not rate-limited', async () => {
    for (let i = 0; i < 12; i++) {
      const res = await call('POST', '/api/arms/check', { body: { design: freshDesign() }, headers: { 'CF-Connecting-IP': '192.0.2.50' } });
      expect(res.status).toBe(200);
    }
  });

  it('only accepts POST (405)', async () => {
    const res = await call('GET', '/api/arms/check');
    expect(res.status).toBe(405);
  });
});

// ── search ───────────────────────────────────────────────────────────────────────────────────

describe('GET /api/arms (search)', () => {
  const SEARCH = 'searchtest';
  const idByName = new Map<string, string>();

  beforeAll(async () => {
    await addRegistry(SEARCH, 'Search test');
    // Register the 17 sample entries in order through the real API.
    for (const e of sample.entries) {
      const res = await call('POST', '/api/arms', {
        body: { registry: SEARCH, displayName: e.displayName, contact: e.contact, design: e.design, shape: e.shape },
      });
      expect(res.status).toBe(201);
      idByName.set(e.displayName, (await bodyOf(res)).id);
    }
  });

  async function find(params: Record<string, string | number>) {
    const qs = new URLSearchParams({ registry: SEARCH, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const res = await call('GET', `/api/arms?${qs}`);
    expect(res.status, await res.clone().text()).toBe(200);
    return bodyOf(res);
  }
  const names = (page: Json) => page.items.map((i: Json) => i.displayName).sort();

  it('returns the page shape, newest first, with no contact in results', async () => {
    const page = await find({});
    expect(page.registry).toEqual({ id: SEARCH, name: 'Search test' });
    expect(page.total).toBe(17);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(24);
    expect(page.items).toHaveLength(17);
    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual(['blazon', 'createdAt', 'design', 'displayName', 'id', 'readability', 'shape', 'signature']);
      expect(item).not.toHaveProperty('contact');
    }
    expect(JSON.stringify(page)).not.toContain('snack table');
    const times = page.items.map((i: Json) => i.createdAt);
    expect(times).toEqual(times.slice().sort().reverse());
    // The sample's blazons/signatures are reproduced server-side.
    const bySig = new Map(sample.entries.map((e) => [e.signature, e.blazon]));
    for (const item of page.items) expect(item.blazon).toBe(bySig.get(item.signature));
    // …and each comes back in the shape it was registered in.
    const shapeBySig = new Map(sample.entries.map((e) => [e.signature, e.shape]));
    for (const item of page.items) expect(item.shape).toBe(shapeBySig.get(item.signature));
  });

  it('filters by charge, posture, ordinary, tincture, charge tincture and division', async () => {
    expect(names(await find({ charge: 'wolf' }))).toEqual(['Cass Merriweather', 'Dev Halloran']);
    expect(names(await find({ charge: 'wolf', posture: 'passant' }))).toEqual(['Cass Merriweather', 'Dev Halloran']);
    expect(names(await find({ posture: 'statant' }))).toEqual(['Noor Pike']);
    expect(names(await find({ ordinary: 'bordure' }))).toEqual(['Dev Halloran', 'Noor Pike']);
    expect(names(await find({ ordinary: 'bend' }))).toEqual(['Ada Brightwater', 'Basil Thorne']);
    expect(names(await find({ chargeTincture: 'azure' }))).toEqual(['Mina Castellanos', 'Noor Pike']);
    expect(names(await find({ tincture: 'purpure' }))).toEqual(['Gus Pemberton', 'Kit Abernathy']);
    expect(names(await find({ division: 'per-pale' }))).toEqual(['Cass Merriweather']);
    expect(names(await find({ division: 'quarterly' }))).toEqual(['Gus Pemberton']);
    expect((await find({ division: 'plain' })).total).toBe(14);
    // AND of several components; no match → empty page.
    expect(names(await find({ ordinary: 'bordure', tincture: 'gules' }))).toEqual(['Noor Pike']);
    const none = await find({ charge: 'dragon', ordinary: 'bordure' });
    expect(none.total).toBe(0);
    expect(none.items).toEqual([]);
  });

  it('finds celestine arms by its filter and by everyday colour words in q', async () => {
    expect(names(await find({ tincture: 'celestine' }))).toEqual(['Quinn Ashworth']);
    expect(names(await find({ chargeTincture: 'celestine' }))).toEqual([]);
    for (const q of ['cyan', 'sky blue', 'light blue', 'Turquoise', 'celestine']) expect(names(await find({ q })), q).toEqual(['Quinn Ashworth']);
    expect(names(await find({ q: 'cyan', charge: 'crescent' }))).toEqual(['Quinn Ashworth']);
  });

  it('matches q case-insensitively on name or blazon, with LIKE wildcards escaped', async () => {
    expect(names(await find({ q: 'UNICORN' }))).toEqual(['Basil Thorne']);
    expect(names(await find({ q: 'pike' }))).toEqual(['Noor Pike']);
    expect(names(await find({ q: 'or, a' }))).toEqual(['Hana Roe']);
    expect((await find({ q: '%' })).total).toBe(0);
    expect((await find({ q: '_' })).total).toBe(0);
    expect((await find({ q: 'a\\' })).total).toBe(0);
    expect(names(await find({ q: 'wolf', ordinary: 'bordure' }))).toEqual(['Dev Halloran']);
  });

  it('paginates with bounded limit/offset', async () => {
    const p1 = await find({ limit: 5 });
    const p2 = await find({ limit: 5, offset: 5 });
    const p4 = await find({ limit: 5, offset: 15 });
    expect(p1.items).toHaveLength(5);
    expect(p2.items).toHaveLength(5);
    expect(p4.items).toHaveLength(2);
    expect(p1.total).toBe(17);
    const ids = [...p1.items, ...p2.items].map((i: Json) => i.id);
    expect(new Set(ids).size).toBe(10);
    expect((await find({ offset: 5000 })).items).toEqual([]);
    expect((await find({ limit: 50 })).limit).toBe(50);

    for (const bad of [{ limit: 0 }, { limit: 51 }, { limit: 'ten' }, { offset: -1 }, { offset: 5001 }, { limit: '2.5' }]) {
      const qs = new URLSearchParams({ registry: SEARCH, ...Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, String(v)])) });
      const res = await call('GET', `/api/arms?${qs}`);
      expect(res.status, qs.toString()).toBe(400);
      expect((await bodyOf(res)).param).toBe(Object.keys(bad)[0]);
    }
  });

  it('400s a bad filter value or an over-long q, and 404s an unknown registry', async () => {
    for (const [param, value] of [['charge', 'kraken'], ['tincture', 'pink'], ['posture', 'dancing'], ['ordinary', 'bar'], ['division', 'per-wave'], ['chargeTincture', 'gold']]) {
      const res = await call('GET', `/api/arms?registry=${SEARCH}&${param}=${value}`);
      expect(res.status, param).toBe(400);
      const data = await bodyOf(res);
      expect(data.error).toBe('bad_request');
      expect(data.param).toBe(param);
    }
    const longQ = await call('GET', `/api/arms?registry=${SEARCH}&q=${'a'.repeat(61)}`);
    expect(longQ.status).toBe(400);
    const unknown = await call('GET', '/api/arms?registry=nowhere');
    expect(unknown.status).toBe(404);
  });

  it('defaults to the default registry', async () => {
    const page = await bodyOf(await call('GET', '/api/arms'));
    expect(page.registry).toEqual({ id: 'default', name: 'Default' });
  });

  it('agrees with the shared offline search over the sample (parity)', async () => {
    const entries = sample.entries.map((e) => ({
      id: e.id, displayName: e.displayName, blazon: e.blazon, createdAt: e.registeredAt, design: (resolve(e.design) as any).design,
    }));
    const cases: SearchParams[] = [
      {}, { charge: 'mullet' }, { ordinary: 'chief' }, { tincture: 'or' }, { tincture: 'argent', division: 'plain' },
      { chargeTincture: 'or' }, { posture: 'rampant' }, { division: 'per-bend-sinister' }, { q: 'Sable' },
      { q: 'a', tincture: 'vert' }, { ordinary: 'saltire', chargeTincture: 'azure' }, { charge: 'rose', ordinary: 'chevron' },
      { tincture: 'celestine' }, { q: 'cyan' }, { q: 'sky blue', division: 'plain' },
    ];
    for (const params of cases) {
      const parsed = parseSearchParams({ ...params, limit: 50 });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const local = searchEntries(entries, parsed.query);
      const remote = await find({ ...(params as Record<string, string>), limit: 50 });
      expect(remote.total, JSON.stringify(params)).toBe(local.total);
      expect(names(remote), JSON.stringify(params)).toEqual(local.items.map((i) => i.displayName).sort());
    }
  });
});

// ── read ─────────────────────────────────────────────────────────────────────────────────────

describe('GET /api/arms/:id', () => {
  it('returns one entry including the public contact', async () => {
    const created = await register(freshDesign(), { displayName: 'Contactable', contact: '@me@example.social' });
    const res = await call('GET', `/api/arms/${created.id}`);
    expect(res.status).toBe(200);
    const e = await bodyOf(res);
    expect(e).toMatchObject({
      id: created.id,
      registry: { id: 'default', name: 'Default' },
      displayName: 'Contactable',
      contact: '@me@example.social',
      blazon: created.blazon,
      signature: created.signature,
      rev: 1,
    });
    expect(e.design.v).toBe(1);
    expect(['bold', 'fine', 'busy']).toContain(e.readability);
    expect(typeof e.createdAt).toBe('string');
    expect(typeof e.updatedAt).toBe('string');
  });

  it('404s an unknown id and malformed encoding', async () => {
    expect((await call('GET', '/api/arms/nope')).status).toBe(404);
    expect((await call('GET', '/api/arms/%E0%A4%A')).status).toBe(404);
    expect((await call('GET', '/api/arms/a/b')).status).toBe(404);
    expect((await call('GET', '/api/nothing')).status).toBe(404);
  });

  it('rejects other methods on an item (405)', async () => {
    const res = await call('PATCH', '/api/arms/whatever');
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, PUT, DELETE');
  });
});

// ── update ───────────────────────────────────────────────────────────────────────────────────

describe('field shape', () => {
  const put = (id: string, body: unknown, secret: string, rev: number) =>
    call('PUT', `/api/arms/${id}`, { body, headers: { Authorization: `Bearer ${secret}`, 'If-Match': String(rev) } });

  it('registers in every shape and returns the shape from GET and the list', async () => {
    await addRegistry('shapes', 'Shapes');
    for (const shape of FIELD_SHAPES) {
      const c = await register(freshDesign(), { registry: 'shapes', displayName: `In ${shape}`, shape });
      const got = await bodyOf(await call('GET', `/api/arms/${c.id}`));
      expect(got.shape).toBe(shape);
      const row = await env.DB.prepare(`SELECT field_shape, design, signature FROM arms WHERE id = ?`).bind(c.id).first<Json>();
      expect(row!.field_shape).toBe(shape);
      // Display only: the shape is in neither the stored design nor the signature.
      expect(JSON.parse(row!.design)).not.toHaveProperty('shape');
      expect(row!.signature).toBe(c.signature);
    }
    const page = await bodyOf(await call('GET', '/api/arms?registry=shapes'));
    expect(page.items.map((i: Json) => [i.displayName, i.shape]).sort()).toEqual(FIELD_SHAPES.map((s) => [`In ${s}`, s]).sort());
  });

  it('defaults a request without a shape to the heater shield', async () => {
    const c = await register(freshDesign());
    expect((await bodyOf(await call('GET', `/api/arms/${c.id}`))).shape).toBe('heater');
  });

  it('treats two designs that differ only in shape as the same arms (409 duplicate)', async () => {
    const design = freshDesign();
    const first = await register(design, { shape: 'round' });
    for (const shape of FIELD_SHAPES) {
      const res = await call('POST', '/api/arms', { body: { displayName: 'Copycat', design, shape } });
      expect(res.status, shape).toBe(409);
      const b = await bodyOf(res);
      expect(b).toMatchObject({ error: 'duplicate', conflictId: first.id, conflict: { id: first.id, shape: 'round' } });
    }
    const check = await bodyOf(await call('POST', '/api/arms/check', { body: { design } }));
    expect(check).toMatchObject({ verdict: 'duplicate', signature: first.signature, conflict: { id: first.id, shape: 'round' } });
  });

  it('rejects an unknown shape (400) on register and edit, naming the field', async () => {
    for (const shape of ['kite', 'Heater', '', 3, null, ['round']]) {
      const res = await call('POST', '/api/arms', { body: { displayName: 'Bad shape', design: freshDesign(), shape } });
      expect(res.status, JSON.stringify(shape)).toBe(400);
      expect(await bodyOf(res)).toMatchObject({ error: 'bad_request', field: 'shape' });
    }
    const design = freshDesign();
    const c = await register(design);
    const res = await put(c.id, { displayName: 'X', design, shape: 'kite' }, c.editSecret, 1);
    expect(res.status).toBe(400);
    expect(await bodyOf(res)).toMatchObject({ error: 'bad_request', field: 'shape' });
    expect((await bodyOf(await call('GET', `/api/arms/${c.id}`))).rev).toBe(1);
  });

  it('lets the owner change only the shape: same signature and tags, new rev', async () => {
    const design = freshDesign();
    const c = await register(design, { shape: 'heater' });
    const tagsBefore = await env.DB.prepare(`SELECT tag FROM arms_tags WHERE arms_id = ? ORDER BY tag`).bind(c.id).all();
    const res = await put(c.id, { displayName: 'Test Person', design, shape: 'lozenge' }, c.editSecret, 1);
    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toMatchObject({ shape: 'lozenge', signature: c.signature, rev: 2 });
    expect((await bodyOf(await call('GET', `/api/arms/${c.id}`))).shape).toBe('lozenge');
    const tagsAfter = await env.DB.prepare(`SELECT tag FROM arms_tags WHERE arms_id = ? ORDER BY tag`).bind(c.id).all();
    expect(tagsAfter.results).toEqual(tagsBefore.results);
    expect(tagsAfter.results.some((t) => JSON.stringify(t).includes('lozenge'))).toBe(false);
  });

  it('is constrained to the four shapes in the database itself', async () => {
    const c = await register(freshDesign());
    await expect(env.DB.prepare(`UPDATE arms SET field_shape = 'kite' WHERE id = ?`).bind(c.id).run()).rejects.toThrow(/CHECK/i);
  });
});

describe('PUT /api/arms/:id', () => {
  const put = (id: string, body: unknown, headers: Record<string, string>) => call('PUT', `/api/arms/${id}`, { body, headers });

  it('edits with the secret and bumps rev', async () => {
    const design = freshDesign();
    const c = await register(design, { displayName: 'Before' });
    const res = await put(c.id, { displayName: 'After', contact: 'new contact', design }, { Authorization: `Bearer ${c.editSecret}`, 'If-Match': '1' });
    expect(res.status).toBe(200);
    const e = await bodyOf(res);
    expect(e).toMatchObject({ id: c.id, displayName: 'After', contact: 'new contact', rev: 2, signature: c.signature });
    expect(e).not.toHaveProperty('edit_secret_hash');
    const got = await bodyOf(await call('GET', `/api/arms/${c.id}`));
    expect(got.displayName).toBe('After');
    expect(got.rev).toBe(2);
    // Quoted ETag form is accepted too.
    const res2 = await put(c.id, { displayName: 'Again', design }, { Authorization: `Bearer ${c.editSecret}`, 'If-Match': '"2"' });
    expect(res2.status).toBe(200);
    expect((await bodyOf(res2)).contact).toBeNull();
  });

  it('401 without a secret, 403 with a wrong one, and leaves the entry untouched', async () => {
    const design = freshDesign();
    const c = await register(design, { displayName: 'Guarded' });
    const r401 = await put(c.id, { displayName: 'Hacked', design }, { 'If-Match': '1' });
    expect(r401.status).toBe(401);
    expect((await bodyOf(r401)).error).toBe('unauthorized');
    const r403 = await put(c.id, { displayName: 'Hacked', design }, { Authorization: 'Bearer wrong', 'If-Match': '1' });
    expect(r403.status).toBe(403);
    expect((await bodyOf(r403)).error).toBe('forbidden');
    const got = await bodyOf(await call('GET', `/api/arms/${c.id}`));
    expect(got.displayName).toBe('Guarded');
    expect(got.rev).toBe(1);
  });

  it('400 without If-Match, 409 on a stale rev, 404 on an unknown id', async () => {
    const design = freshDesign();
    const c = await register(design);
    const auth = { Authorization: `Bearer ${c.editSecret}` };
    expect((await put(c.id, { displayName: 'X', design }, auth)).status).toBe(400);
    expect((await put(c.id, { displayName: 'X', design }, { ...auth, 'If-Match': 'abc' })).status).toBe(400);
    expect((await put(c.id, { displayName: 'X', design }, { ...auth, 'If-Match': '1' })).status).toBe(200);
    const stale = await put(c.id, { displayName: 'Y', design }, { ...auth, 'If-Match': '1' });
    expect(stale.status).toBe(409);
    expect((await bodyOf(stale)).error).toBe('conflict');
    expect((await put('missing-id', { displayName: 'X', design }, { ...auth, 'If-Match': '1' })).status).toBe(404);
  });

  it('re-validates the body and re-checks uniqueness on a design change', async () => {
    const taken = await register(freshDesign(), { displayName: 'Taken' });
    const takenDesign = (await bodyOf(await call('GET', `/api/arms/${taken.id}`))).design;
    const mine = freshDesign();
    const c = await register(mine);
    const h = { Authorization: `Bearer ${c.editSecret}`, 'If-Match': '1' };

    const invalid = await put(c.id, { displayName: 'Mine', design: { v: 1, field: plain('azure'), ordinary: { type: 'fess', tincture: 'gules' } } }, h);
    expect(invalid.status).toBe(400);
    expect((await bodyOf(invalid)).error).toBe('invalid_design');
    expect((await put(c.id, { displayName: '', design: mine }, h)).status).toBe(400);

    const dup = await put(c.id, { displayName: 'Mine', design: takenDesign }, h);
    expect(dup.status).toBe(409);
    const dupBody = await bodyOf(dup);
    expect(dupBody.error).toBe('duplicate');
    expect(dupBody.conflictId).toBe(taken.id);

    // A genuinely new design is accepted and the search tags follow it.
    const newDesign = { v: 1, field: plain('argent'), ordinary: { type: 'cross', tincture: 'vert' }, charges: { charge: 'bee', count: 1, placement: 'ordinary', tincture: 'or' } };
    const ok = await put(c.id, { displayName: 'Mine', design: newDesign }, h);
    expect(ok.status, await ok.clone().text()).toBe(200);
    const e = await bodyOf(ok);
    expect(e.blazon).toBe('Argent, on a cross Vert a bee Or');
    expect(e.rev).toBe(2);
    const tags = (await env.DB.prepare(`SELECT tag FROM arms_tags WHERE arms_id = ?`).bind(c.id).all<Json>()).results.map((t) => t.tag);
    expect(tags).toContain('charge:bee');
    expect(tags).toContain('ordinary:cross');
    expect(tags.some((t) => t === `charge:${mine.charges.charge}`)).toBe(false);
    const row = await env.DB.prepare(`SELECT charge, ordinary, field_division FROM arms WHERE id = ?`).bind(c.id).first<Json>();
    expect(row).toEqual({ charge: 'bee', ordinary: 'cross', field_division: 'plain' });
  });

  it('does not treat an unchanged design as a duplicate of itself', async () => {
    const design = { ...wolfBordure('sejant'), charges: { charge: 'lion', count: 1, placement: 'field', posture: 'sejant', tincture: 'or' } };
    const c = await register(design);
    const res = await put(c.id, { displayName: 'Renamed', design }, { Authorization: `Bearer ${c.editSecret}`, 'If-Match': '1' });
    expect(res.status).toBe(200);
  });
});

// ── withdraw ─────────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/arms/:id', () => {
  it('requires the secret (401/403), then deletes the row and tags and frees the signature', async () => {
    const design = freshDesign();
    const c = await register(design);
    expect((await call('DELETE', `/api/arms/${c.id}`)).status).toBe(401);
    expect((await call('DELETE', `/api/arms/${c.id}`, { headers: { Authorization: 'Bearer nope' } })).status).toBe(403);
    expect((await call('GET', `/api/arms/${c.id}`)).status).toBe(200);

    const res = await call('DELETE', `/api/arms/${c.id}`, { headers: { Authorization: `Bearer ${c.editSecret}` } });
    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toEqual({ id: c.id, withdrawn: true });

    expect((await call('GET', `/api/arms/${c.id}`)).status).toBe(404);
    const tags = await env.DB.prepare(`SELECT COUNT(*) AS n FROM arms_tags WHERE arms_id = ?`).bind(c.id).first<Json>();
    expect(tags!.n).toBe(0);
    expect((await call('DELETE', `/api/arms/${c.id}`, { headers: { Authorization: `Bearer ${c.editSecret}` } })).status).toBe(404);

    const again = await register(design);
    expect(again.signature).toBe(c.signature);
  });
});

// ── rate limiting ────────────────────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('limits registrations per IP before parsing the body (429)', async () => {
    const headers = { 'CF-Connecting-IP': '192.0.2.1' };
    for (let i = 0; i < 10; i++) {
      // Even junk bodies spend the budget: the limiter runs before parsing.
      const res = await call('POST', '/api/arms', { body: { junk: true }, headers });
      expect(res.status).toBe(400);
    }
    const res = await call('POST', '/api/arms', { body: { displayName: 'Late', design: freshDesign() }, headers });
    expect(res.status).toBe(429);
    expect((await bodyOf(res)).error).toBe('rate_limited');
    // Other IPs are unaffected.
    await register(freshDesign());
  });
});

// ── hardening ────────────────────────────────────────────────────────────────────────────────

describe('API response headers', () => {
  it('are no-store and nosniff on success and error JSON alike', async () => {
    const ok = await call('GET', '/api/registries');
    const missing = await call('GET', '/api/nope');
    const wrongMethod = await call('DELETE', '/api/registries');
    const invalid = await call('POST', '/api/arms/check', { body: { design: 5 } });
    for (const res of [ok, missing, wrongMethod, invalid]) {
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
    expect([ok.status, missing.status, wrongMethod.status, invalid.status]).toEqual([200, 404, 405, 400]);
  });
});

describe('request body cap', () => {
  const oversize = { displayName: 'x'.repeat(17 * 1024), design: freshDesign() };

  it('refuses a body whose Content-Length is over 16 KB (413 payload_too_large)', async () => {
    const res = await call('POST', '/api/arms/check', { body: oversize });
    expect(res.status).toBe(413);
    expect((await bodyOf(res)).error).toBe('payload_too_large');
  });

  it('refuses an over-long body even when Content-Length is absent', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(oversize)));
        controller.close();
      },
    });
    const request = new Request('https://widget.test/api/arms/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.9.9.9' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect(request.headers.get('Content-Length')).toBeNull();
    const ctx = createExecutionContext();
    const res = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(413);
    expect((await bodyOf(res)).error).toBe('payload_too_large');
  });

  it('still accepts a normal body', async () => {
    const res = await call('POST', '/api/arms/check', { body: { design: freshDesign() } });
    expect(res.status).toBe(200);
  });
});

describe('unexpected errors', () => {
  it('log one structured line without request content and answer a generic 500', async () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
    const broken = { ...env, DB: { prepare: () => { throw new Error('database exploded'); } } } as unknown as typeof env;
    try {
      const request = new Request('https://widget.test/api/arms/secret-id-123', {
        method: 'PUT',
        headers: { Authorization: 'Bearer top-secret-value', 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Private Person', contact: 'me@example.com' }),
      });
      const ctx = createExecutionContext();
      const res = await worker.fetch(request, broken, ctx);
      await waitOnExecutionContext(ctx);
      expect(res.status).toBe(500);
      expect((await bodyOf(res)).error).toBe('internal_error');
    } finally {
      console.error = original;
    }
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      event: 'unhandled_error',
      route: '/api/arms/:id',
      method: 'PUT',
      errorName: 'Error',
      errorMessage: 'database exploded',
    });
    for (const secret of ['top-secret-value', 'Private Person', 'me@example.com', 'secret-id-123']) {
      expect(lines[0]).not.toContain(secret);
    }
  });
});

describe('default registry', () => {
  it('is the one flagged default, and a second default cannot be added', async () => {
    await expect(
      env.DB.prepare(`INSERT INTO registries (id, name, is_default, created_at) VALUES ('rival', 'Rival', 1, 'now')`).run()
    ).rejects.toThrow(/UNIQUE/i);
    const res = await call('GET', '/api/arms');
    expect((await bodyOf(res)).registry).toEqual({ id: 'default', name: 'Default' });
  });
});

describe('withdrawal cascades to tags', () => {
  it('leaves no tags behind when the row is deleted directly', async () => {
    const c = await register(freshDesign());
    const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM arms_tags WHERE arms_id = ?`).bind(c.id).first<Json>();
    expect(before!.n).toBeGreaterThan(0);
    await env.DB.prepare(`DELETE FROM arms WHERE id = ?`).bind(c.id).run();
    const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM arms_tags WHERE arms_id = ?`).bind(c.id).first<Json>();
    expect(after!.n).toBe(0);
  });
});

describe('too-close candidate lookup', () => {
  it('gives the verdict a full scan of the stored registry gives', async () => {
    await addRegistry('prefilter', 'Prefilter');
    const stored = generatedDesigns(1, 60);
    const entries: RegistryEntryLike[] = [];
    for (const [i, design] of stored.entries()) {
      const sig = signature(design);
      if (entries.some((e) => e.signature === sig)) continue;
      const key = candidateKey(design);
      await env.DB.prepare(
        `INSERT INTO arms (id, registry_id, display_name, contact, design, signature, blazon, field_division,
           ordinary, charge, readability, edit_secret_hash, rev, created_at, updated_at)
         VALUES (?, 'prefilter', 'Stored', NULL, ?, ?, ?, ?, ?, ?, 'bold', 'h', 1, ?, ?)`
      ).bind(
        `pf-${i}`, JSON.stringify(design), sig, blazon(design), key.fieldDivision, key.ordinary, key.charge,
        `2026-10-03T00:00:${String(i).padStart(2, '0')}Z`, `2026-10-03T00:00:${String(i).padStart(2, '0')}Z`
      ).run();
      entries.push({ id: `pf-${i}`, signature: sig, design });
    }

    const verdicts = new Set<string>();
    for (const probe of generatedDesigns(50_000, 120)) {
      const full = checkUnique(probe, signature(probe), entries);
      const res = await call('POST', '/api/arms/check', { body: { registry: 'prefilter', design: probe } });
      expect(res.status).toBe(200);
      const data = await bodyOf(res);
      expect(data.verdict).toBe(full.kind);
      if (full.kind !== 'ok') expect(data.conflictId ?? data.conflict.id).toBe(full.of);
      verdicts.add(data.verdict);
    }
    expect([...verdicts].sort()).toEqual(['duplicate', 'ok', 'too-close']);
  });
});
