// Offline Worker/D1 tests. These run in the workers runtime (workerd) against a local Miniflare D1
// via @cloudflare/vitest-pool-workers — no real Cloudflare account or network. The committed
// migrations are applied to the local D1 before the suite (test/apply-migrations.ts), and the
// Worker's fetch handler is exercised directly.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import worker, { loadCandidates } from '../worker/index';
import sample from '../src/data/sample-registry.json';
import {
  FIELD_SHAPES, MIXED_PRIMARY, blazon, candidateKey, checkUnique, keysMayConflict, parseSearchParams, resolve, searchEntries, signature,
  type RegistryEntryLike,
} from '../src/lib/heraldry';
import { generatedDesigns, generatedRichDesigns } from './design-generator';
import { sampleSearchEntries } from './sample-search-entries';
import { arms, charge, div, group, nd, ordinary, searchParams, type SearchArgs } from './helpers';

interface CallOpts {
  body?: unknown;
  headers?: Record<string, string>;
  /** The Worker's bindings; the test environment (no RESEND_API_KEY) when not given. */
  bindings?: typeof env;
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
  const res = await worker.fetch(request, opts.bindings ?? env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

type Json = Record<string, any>;

async function bodyOf(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

// ── designs ──────────────────────────────────────────────────────────────────────────────────


/** A loose design of one picture on a plain field. */
const lone = (field: string, id: string, tincture: string, extra: object = {}, itemExtra: object = {}) =>
  arms(field, group(charge(id, itemExtra), tincture, extra));

/**
 * A unique, valid design per n. Designs with different primary pictures or bands differ substantially; designs
 * with the same one differ in both the field and the tincture, which is two distinct changes (SENA A5A).
 */
const CHARGE_POOL = ['mullet', 'rose', 'key', 'crown', 'heart', 'sword', 'anchor', 'gear', 'crescent', 'lightbulb', 'flame', 'tree', 'fish', 'bee', 'eagle', 'fleur-de-lis'];
const BAND_POOL = ['fess', 'pale', 'bend', 'chevron', 'saltire', 'cross'];
const FIELD_AND_TINCTURE = [['azure', 'or'], ['gules', 'argent'], ['or', 'vert'], ['argent', 'purpure']] as const;
const UNIQUE_DESIGNS = (CHARGE_POOL.length + BAND_POOL.length) * FIELD_AND_TINCTURE.length;
function uniqueDesign(n: number) {
  if (n >= UNIQUE_DESIGNS) throw new Error('uniqueDesign: out of designs');
  const items = [...CHARGE_POOL.map((id) => charge(id)), ...BAND_POOL.map((type) => ordinary(type))];
  const [field, tincture] = FIELD_AND_TINCTURE[Math.floor(n / items.length)];
  return arms(field, group(items[n % items.length], tincture));
}
let designCounter = 0;
const OWNER_EMAIL = 'owner@example.com';
const freshDesign = () => uniqueDesign(designCounter++);

/** A wolf in the given posture and tincture on a sable field within an argent bordure. */
const wolfBordure = (posture: string, tincture: string) =>
  arms('sable', group(ordinary('bordure'), 'argent'), group(charge('wolf', { posture }), tincture));

async function register(design: unknown, extra: Json = {}) {
  const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Test Person', design, ...extra } });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
  return (await res.json()) as { id: string; editSecret: string; registry: { id: string; name: string }; rev: number; blazon: string; signature: string };
}

async function addRegistry(id: string, name: string) {
  await env.DB.prepare(`INSERT OR IGNORE INTO registries (id, name, is_default, created_at) VALUES (?, ?, 0, ?)`)
    .bind(id, name, '2026-10-02T00:00:00Z')
    .run();
}

describe('unknown API routes', () => {
  it('404s the registry list, which the API does not offer', async () => {
    expect((await call('GET', '/api/registries')).status).toBe(404);
  });
});

// ── create ───────────────────────────────────────────────────────────────────────────────────

describe('POST /api/arms', () => {
  it('accepts celestine designs and rejects celestine on another metal', async () => {
    const ok = await call('POST', '/api/arms', {
      body: {
        email: OWNER_EMAIL, displayName: 'Sky Marlowe',
        contact: null,
        design: arms('vert', group(ordinary('chevron'), 'celestine'), group(charge('rose'), 'argent', { count: 3 })),
      },
    });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const data = await bodyOf(ok);
    expect(data.blazon).toBe('Vert, a chevron celestine between three roses argent.');
    expect(data.signature).toBe('arms|vt|P:o.chevron:1:single:ce|S>:c.rose:3:host:ar');
    const tags = await env.DB.prepare(`SELECT tag FROM arms_tags WHERE arms_id = ?`).bind(data.id).all<{ tag: string }>();
    expect(tags.results.map((r) => r.tag)).toEqual(expect.arrayContaining(['ordinary-tincture:celestine', 'tincture:celestine']));

    const check = await call('POST', '/api/arms/check', {
      body: { design: lone('celestine', 'stag', 'sable') },
    });
    expect(check.status).toBe(200);
    expect((await bodyOf(check)).verdict).toBe('ok');

    const bad = await call('POST', '/api/arms', {
      body: { email: OWNER_EMAIL, displayName: 'Metal Metal', contact: null, design: arms('argent', group(ordinary('fess'), 'celestine')) },
    });
    expect(bad.status).toBe(400);
    const err = await bodyOf(bad);
    expect(err.error).toBe('invalid_design');
    expect(err.issues.map((i: Json) => i.message).join(' ')).toMatch(/metal on metal/);
  });

  it('registers in the default registry, returns id + secret, and stores only the hash', async () => {
    const res = await call('POST', '/api/arms', {
      body: {
        email: OWNER_EMAIL, displayName: 'Rowan Ashby',
        contact: { discord: 'rowan.ashby' },
        design: arms('vert', group(ordinary('pile'), 'argent')),
      },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const data = await bodyOf(res);
    expect(data.id.length).toBeGreaterThanOrEqual(16);
    expect(data.editSecret.length).toBeGreaterThanOrEqual(32);
    expect(data.registry).toEqual({ id: 'default', name: 'Default' });
    expect(data.rev).toBe(1);
    expect(data.blazon).toBe('Vert, a pile argent.');
    expect(data.signature).toBe('arms|vt|P:o.pile:1:single:ar');

    const row = await env.DB.prepare(`SELECT * FROM arms WHERE id = ?`).bind(data.id).first<Json>();
    expect(row!.edit_secret_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.edit_secret_hash).not.toBe(data.editSecret);
    expect(JSON.stringify(row)).not.toContain(data.editSecret);
    expect(row!).toMatchObject({ partition_key: 'plain', primary_key: 'ordinary:pile' });
    expect(row!.readability).toBe('bold');

    const tags = await env.DB.prepare(`SELECT tag, registry_id FROM arms_tags WHERE arms_id = ?`).bind(data.id).all<Json>();
    const tagList = tags.results.map((t) => t.tag);
    expect(tagList).toContain('ordinary:pile');
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
      body: { email: OWNER_EMAIL, displayName: 'Forger', design: { ...design }, blazon: 'Or, a lie', signature: 'arms|or|' },
    });
    expect(res.status).toBe(201);
    const data = await bodyOf(res);
    expect(data.blazon).not.toBe('Or, a lie');
    expect(data.signature).not.toBe('arms|or|');
    const row = await env.DB.prepare(`SELECT blazon, signature, design FROM arms WHERE id = ?`).bind(data.id).first<Json>();
    expect(row!.blazon).toBe(data.blazon);
    expect(JSON.parse(row!.design)).toEqual(resolve(design).ok && (resolve(design) as any).design);
  });

  it('rejects an exact duplicate (409) with the conflicting id — including an equivalent wording', async () => {
    const first = await register(lone('gules', 'mullet', 'argent', { count: 3 }));
    // Explicitly stating the default arrangement normalises to the same signature.
    const res = await call('POST', '/api/arms', {
      body: {
        email: OWNER_EMAIL, displayName: 'Copycat',
        design: lone('gules', 'mullet', 'argent', { count: 3, arrangement: 'rows-2-1' }),
      },
    });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('duplicate');
    expect(data.conflict.id).toBe(first.id);
    expect(data.conflict.displayName).toBe('Test Person');
    expect(data.conflict).not.toHaveProperty('contact');
  });

  it('rejects a design that is too close (409) and lists the differences', async () => {
    const first = await register(wolfBordure('passant', 'or'));
    const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Close Call', design: wolfBordure('passant', 'argent') } });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('too-close');
    expect(data.conflict.id).toBe(first.id);
    expect(data.differences.map((n: Json) => n.text)).toEqual(['colour of pictures (Argent ↔ Or)']);
    expect(data.differences[0]).toMatchObject({ attr: 'tincture', kind: 'dc' });
    // A change of posture is no difference at all in SENA, so it is as close as can be.
    const same = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Same Pose', design: wolfBordure('statant', 'or') } });
    expect(same.status).toBe(409);
    expect((await bodyOf(same)).differences).toEqual([]);
    // Two distinct changes are clear.
    await register(arms('azure', group(ordinary('bordure'), 'or'), group(charge('wolf'), 'argent')));
  });

  it('rejects a rule-of-tincture violation (400 invalid_design) even with a forged signature', async () => {
    const res = await call('POST', '/api/arms', {
      body: {
        email: OWNER_EMAIL, displayName: 'Colour on colour',
        design: lone('azure', 'lion', 'gules'),
        signature: 'arms|az|P:c.lion:1:single:or',
        blazon: 'Azure, a lion rampant Or.',
      },
    });
    expect(res.status).toBe(400);
    const data = await bodyOf(res);
    expect(data.error).toBe('invalid_design');
    expect(data.issues.some((i: Json) => i.code === 'tincture')).toBe(true);
    expect(typeof data.message).toBe('string');
  });

  it('accepts counterchanged charges on a metal-and-colour field and rejects them elsewhere', async () => {
    const counterchanged = (field: unknown, ...more: object[]) =>
      arms(field, group(charge('crown'), 'counterchanged', { count: 3 }), ...more);
    const purpureAndOr = div('per-pale', 'purpure', 'or');
    const ok = await register(counterchanged(purpureAndOr));
    expect(ok.blazon).toBe('Per pale purpure and Or, three crowns counterchanged.');
    expect(ok.signature).toBe('arms|per-pale(pu,or)|P:c.crown:3:rows-2-1:cc');
    // The same design in a single tincture is clearly different, not too close.
    await register(arms(purpureAndOr, group(charge('crown'), 'argent', { count: 3, arrangement: 'in-pale' })));
    const rejected: Array<[unknown, RegExp]> = [
      [counterchanged(div('per-pale', 'or', 'argent')), /metal on metal/],
      [counterchanged(div('quarterly', 'gules', 'vert')), /colour on colour/],
      [counterchanged('purpure'), /needs a divided field/],
      [arms(div('per-fess', 'or', 'azure'), group(ordinary('fess'), 'gules', { charged: [group(charge('crown'), 'counterchanged', { count: 3 })] })), /counterchanged charges on a band or charge aren't available/],
    ];
    for (const [design, message] of rejected) {
      const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Counterchange', design } });
      expect(res.status, JSON.stringify(design)).toBe(400);
      const data = await bodyOf(res);
      expect(data.error).toBe('invalid_design');
      expect(data.issues.map((i: Json) => `${i.code}: ${i.message}`).join(' | ')).toMatch(message);
    }
  });

  it('rejects malformed designs (400 invalid_design)', async () => {
    const bad: unknown[] = [
      undefined,
      'Azure, a bend Or',
      lone('azure', 'kraken', 'or'),
      // laptop and paintbrush are no longer charges
      lone('purpure', 'laptop', 'argent'),
      lone('vert', 'paintbrush', 'or', { count: 3 }),
      { v: 1, field: 'azure', groups: [group(ordinary('bend'), 'or')] }, // an old format version
      arms('azure'), // plain field alone: too generic
      { ...arms('azure', group(ordinary('bend'), 'or')), kind: 'badge' }, // badges have no field (and are not drawn yet)
      arms('azure', group(ordinary('bend'), 'gules')), // colour on colour
    ];
    for (const design of bad) {
      const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Bad', design } });
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

  it('validates and sanitises the public name and Discord contact', async () => {
    const blank = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: '   ', design: freshDesign() } });
    expect(blank.status).toBe(400);
    expect((await bodyOf(blank)).field).toBe('displayName');

    const long = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'x'.repeat(61), design: freshDesign() } });
    expect(long.status).toBe(400);
    for (const contact of [{ discord: 'a..b' }, { discord: 'y'.repeat(33) }, 'free text', ['x']]) {
      const bad = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Ok', contact, design: freshDesign() } });
      expect(bad.status, JSON.stringify(contact)).toBe(400);
      expect((await bodyOf(bad)).field).toBe('discord');
    }

    // Exactly at the caps (counted in code points) is fine; controls, newlines and bidi overrides go.
    const okName = 'é'.repeat(59) + '🦁';
    const created = await register(freshDesign(), { displayName: okName, contact: { discord: '  ' } });
    const got1 = await bodyOf(await call('GET', `/api/arms/${created.id}`));
    expect(got1.displayName).toBe(okName);
    expect(got1.contact).toEqual({ discord: null });

    const created2 = await register(freshDesign(), {
      displayName: '  Evil\u202Eeman\u0007\n  Name ',
      contact: { discord: ' @Line.One_2 ' },
    });
    const got2 = await bodyOf(await call('GET', `/api/arms/${created2.id}`));
    expect(got2.displayName).toBe('Evileman Name');
    expect(got2.contact).toEqual({ discord: 'line.one_2' });

    const nfd = await register(freshDesign(), { displayName: 'Jose\u0301' });
    expect((await bodyOf(await call('GET', `/api/arms/${nfd.id}`))).displayName).toBe('Jos\u00e9');
  });

  it('404s an unknown registry', async () => {
    const res = await call('POST', '/api/arms', { body: { registry: 'nowhere', email: OWNER_EMAIL, displayName: 'X', design: freshDesign() } });
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error).toBe('not_found');
  });

  it('scopes uniqueness per registry', async () => {
    await addRegistry('other', 'Another group');
    const design = freshDesign();
    await register(design);
    const res = await register(design, { registry: 'other' });
    expect(res.registry).toEqual({ id: 'other', name: 'Another group' });
  });

  it('maps a UNIQUE-index race to 409 duplicate, naming the winner', async () => {
    // Simulate a concurrent winner: a row with the same signature that the pre-insert scan can't
    // see (it is filed under other conflict keys), so only the UNIQUE index catches it.
    await addRegistry('race', 'Race track');
    const design = freshDesign();
    const sig = (await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'race', design } }))).signature;
    await env.DB.prepare(
      `INSERT INTO arms (id, registry_id, display_name, contact_discord, design, signature, blazon,
         partition_key, primary_key, readability, edit_secret_hash, rev, created_at, updated_at)
       VALUES ('race-winner', 'race', 'Winner', NULL, ?, ?, 'x', 'elsewhere', NULL, 'bold', 'h', 1, ?, ?)`
    ).bind(JSON.stringify(nd(design)), sig, '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z').run();
    const res = await call('POST', '/api/arms', { body: { registry: 'race', email: OWNER_EMAIL, displayName: 'Loser', design } });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('duplicate');
    expect(data.conflict.id).toBe('race-winner');
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
       INSERT INTO arms (id, registry_id, display_name, contact_discord, design, signature, blazon,
         partition_key, primary_key, readability, edit_secret_hash, rev, created_at, updated_at)
       SELECT 'full-' || i, 'full', 'Filler', NULL, 'null', 'sig-' || i, 'x', 'plain', NULL, 'bold', 'h', 1,
         '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z' FROM n`
    ).run();
    const res = await call('POST', '/api/arms', { body: { registry: 'full', email: OWNER_EMAIL, displayName: 'One more', design: freshDesign() } });
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
    await addRegistry('checks', 'Check group');
    const design = lone('or', 'dragon', 'gules');

    const ok = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design } }));
    expect(ok.verdict).toBe('ok');
    expect(ok.blazon).toBe('Or, a dragon gules.');
    expect(ok.signature).toBe('arms|or|P:c.dragon.rampant:1:single:gu');
    expect(ok.readability).toBe('bold');
    expect(ok.registry).toEqual({ id: 'checks', name: 'Check group' });
    expect(ok).not.toHaveProperty('conflict');

    const created = await register(design, { registry: 'checks', displayName: 'Hana' });
    const dup = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design } }));
    expect(dup.verdict).toBe('duplicate');
    expect(dup.conflict).toMatchObject({ id: created.id, displayName: 'Hana', blazon: 'Or, a dragon gules.' });
    expect(dup.conflict.design).toEqual((resolve(design) as any).design);

    const passant = lone('or', 'dragon', 'gules', {}, { posture: 'passant' });
    const stillOk = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design: passant } }));
    expect(stillOk.verdict).toBe('ok'); // segreant vs passant: different posture groups = clear

    await register(wolfBordure('passant', 'or'), { registry: 'checks' });
    const close = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'checks', design: wolfBordure('passant', 'argent') } }));
    expect(close.verdict).toBe('too-close');
    expect(close.differences.map((n: Json) => n.text)).toEqual(['colour of pictures (Argent ↔ Or)']);
  });

  it('400s an invalid design with issues and 404s an unknown registry', async () => {
    const bad = await call('POST', '/api/arms/check', {
      body: { design: lone('gules', 'lion', 'azure') },
    });
    expect(bad.status).toBe(400);
    const data = await bodyOf(bad);
    expect(data.error).toBe('invalid_design');
    expect(data.issues[0]).toMatchObject({ code: 'tincture', at: { k: 'group', path: [0] } });

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
    // Register the 20 sample entries in order through the real API.
    for (const e of sample.entries) {
      const res = await call('POST', '/api/arms', {
        body: { registry: SEARCH, email: OWNER_EMAIL, displayName: e.displayName, contact: e.contact, design: e.design, shape: e.shape },
      });
      expect(res.status).toBe(201);
      idByName.set(e.displayName, (await bodyOf(res)).id);
    }
  });

  async function find(params: SearchArgs) {
    const qs = new URLSearchParams({ registry: SEARCH, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const res = await call('GET', `/api/arms?${qs}`);
    expect(res.status, await res.clone().text()).toBe(200);
    return bodyOf(res);
  }
  const names = (page: Json) => page.items.map((i: Json) => i.displayName).sort();

  it('returns the page shape, newest first, with no contact in results', async () => {
    const page = await find({});
    expect(page.registry).toEqual({ id: SEARCH, name: 'Search test' });
    expect(page.total).toBe(20);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(24);
    expect(page.items).toHaveLength(20);
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
    expect(names(await find({ ordinary: 'bordure' }))).toEqual(['Dev Halloran', 'Mae Okonkwo', 'Noor Pike']);
    expect(names(await find({ ordinary: 'bend' }))).toEqual(['Ada Brightwater', 'Basil Thorne']);
    expect(names(await find({ chargeTincture: 'azure' }))).toEqual(['Mina Castellanos', 'Noor Pike']);
    expect(names(await find({ tincture: 'purpure' }))).toEqual(['Gus Pemberton', 'Kit Abernathy']);
    expect(names(await find({ division: 'per-pale' }))).toEqual(['Cass Merriweather', 'Wren Halloway']);
    expect(names(await find({ chargeTincture: 'counterchanged' }))).toEqual(['Mae Okonkwo', 'Tobias Fennimore', 'Wren Halloway']);
    expect(names(await find({ division: 'quarterly' }))).toEqual(['Gus Pemberton']);
    expect((await find({ division: 'plain' })).total).toBe(14);
    // AND of several components; no match → empty page.
    expect(names(await find({ ordinary: 'bordure', tincture: 'gules' }))).toEqual(['Mae Okonkwo', 'Noor Pike']);
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

  it('matches q case-insensitively as whole words of name, blazon or gloss; punctuation matches nothing', async () => {
    expect(names(await find({ q: 'UNICORN' }))).toEqual(['Basil Thorne']);
    expect(names(await find({ q: 'pike' }))).toEqual(['Noor Pike']);
    expect(names(await find({ q: 'pik' }))).toEqual([]);
    expect(names(await find({ q: 'five-pointed star' }))).toEqual(['Elin Sato', 'Wren Halloway']);
    expect((await find({ q: '%' })).total).toBe(0);
    expect((await find({ q: '_' })).total).toBe(0);
    expect((await find({ q: 'a\\' })).total).toBe(0);
    expect(names(await find({ q: 'wolf', ordinary: 'bordure' }))).toEqual(['Dev Halloran']);
  });

  it('paginates with bounded limit/offset', async () => {
    const p1 = await find({ limit: 5 });
    const p2 = await find({ limit: 5, offset: 5 });
    const p4 = await find({ limit: 5, offset: 18 });
    expect(p1.items).toHaveLength(5);
    expect(p2.items).toHaveLength(5);
    expect(p4.items).toHaveLength(2);
    expect(p1.total).toBe(20);
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
    for (const [param, value] of [['charge', 'kraken'], ['tincture', 'pink'], ['posture', 'dancing'], ['ordinary', 'beam'], ['division', 'per-wave'], ['chargeTincture', 'gold']]) {
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

  it('400s a parameter the API does not define, naming it', async () => {
    for (const bad of ['colour=red', 'category2=bird', 'Q=wolf', 'offsets=1']) {
      const res = await call('GET', `/api/arms?registry=${SEARCH}&${bad}`);
      expect(res.status, bad).toBe(400);
      expect(await bodyOf(res)).toMatchObject({ error: 'unknown_param', param: bad.split('=')[0] });
    }
  });

  it('filters by charge category and field tincture', async () => {
    expect(names(await find({ category: 'monster' }))).toEqual(['Basil Thorne', 'Hana Roe']);
    expect(names(await find({ category: 'geometric', fieldTincture: 'gules' }))).toEqual(['Elin Sato', 'Jules Okafor']);
    expect(names(await find({ fieldTincture: 'sable' }))).toEqual(['Dev Halloran', 'Jules Okafor']);
    for (const [param, value] of [['category', 'bird2'], ['fieldTincture', 'gold']]) {
      const res = await call('GET', `/api/arms?registry=${SEARCH}&${param}=${value}`);
      expect(res.status, param).toBe(400);
      expect(await bodyOf(res)).toMatchObject({ error: 'bad_request', param });
    }
  });

  it('answers plain-English queries like the shared offline search (parity over the sample)', async () => {
    const idOfName = new Map(sampleSearchEntries.map((e) => [e.displayName, e.id]));
    for (const params of PARITY_CASES) {
      const parsed = parseSearchParams(searchParams({ ...params, limit: 50 }));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const local = searchEntries(sampleSearchEntries, parsed.query);
      const remote = await find({ ...params, limit: 50 });
      const remoteIds = remote.items.map((i: Json) => idOfName.get(i.displayName));
      expect(remoteIds, JSON.stringify(params)).toEqual(local.items.map((i) => i.id));
      expect(remote.total, JSON.stringify(params)).toBe(local.total);
    }
  });

  it('stores search text with the gloss and name, and never the contact or email', async () => {
    const { results } = await env.DB.prepare(`SELECT display_name, search_text FROM arms WHERE registry_id = ?`).bind(SEARCH).all<{ display_name: string; search_text: string }>();
    expect(results).toHaveLength(20);
    const cass = results.find((r) => r.display_name === 'Cass Merriweather')!;
    expect(cass.search_text).toBe(' cass merriweather per pale azure and vert a wolf passant argent a shield split vertically blue on the left and green on the right with a white wolf walking ');
    const basil = results.find((r) => r.display_name === 'Basil Thorne')!;
    expect(basil.search_text).not.toContain('snack');
    for (const r of results) expect(r.search_text).not.toContain(OWNER_EMAIL);
  });
});

/** Parameter sets the Worker and the offline sample search must answer with identical id lists. */
const PARITY_CASES: SearchArgs[] = [
  {}, { charge: 'mullet' }, { ordinary: 'chief' }, { tincture: 'or' }, { tincture: 'argent', division: 'plain' },
  { chargeTincture: 'or' }, { posture: 'rampant' }, { division: 'per-bend-sinister' }, { category: 'beast' }, { fieldTincture: 'azure' },
  { tincture: 'celestine' }, { q: 'Sable' }, { q: 'cyan' }, { q: 'sky blue', division: 'plain' }, { q: 'a', tincture: 'vert' },
  { q: 'yellow' }, { q: 'gold lion' }, { q: 'passant wolf' }, { q: 'wolf passant' }, { q: 'walking wolf' }, { q: 'standing goat' },
  { q: 'bird' }, { q: 'white border' }, { q: 'star' }, { q: 'wolves' }, { q: 'Or' }, { q: 'or', ordinary: 'bend' }, { q: 'animal' },
  { q: 'yellow animal on black with a white border' }, { q: 'a red dragon' }, { q: 'rearing dragon' }, { q: 'segreant' },
  { q: 'stripe' }, { q: 'x' }, { q: 'cross-shaped' }, { q: 'moon' }, { q: 'fire' }, { q: 'cog' }, { q: 'dog' }, { q: 'lily' },
  { q: 'fleurs-de-lis' }, { q: 'the' }, { q: '%' }, { q: 'pike' }, { q: 'pik' }, { q: 'Ada Brightwater' }, { q: 'purple', category: 'object' },
];

describe('GET /api/arms (plain-English search of registered entries)', () => {
  const PLAIN = 'plainsearch';
  const search = async (q: string) => {
    const res = await call('GET', `/api/arms?${new URLSearchParams({ registry: PLAIN, q })}`);
    expect(res.status).toBe(200);
    return ((await bodyOf(res)).items as Json[]).map((i) => i.displayName);
  };
  let lion: { id: string; editSecret: string };

  beforeAll(async () => {
    await addRegistry(PLAIN, 'Plain search');
    const wolf = lone('sable', 'wolf', 'or', { count: 3 }, { posture: 'passant' });
    lion = await register(
      lone('azure', 'lion', 'or'),
      { registry: PLAIN, displayName: 'Morgan Lyon', contact: { discord: 'lyon.user' } },
    );
    await register(wolf, { registry: PLAIN, displayName: 'Wolfgang Pack' });
  });

  it('finds a gold lion, a yellow animal, a plural, and not part of a word', async () => {
    expect(await search('gold lion')).toEqual(['Morgan Lyon']);
    expect(await search('yellow cat on blue')).toEqual(['Morgan Lyon']);
    expect(await search('yellow animal')).toEqual(['Wolfgang Pack', 'Morgan Lyon']);
    expect(await search('three wolves')).toEqual(['Wolfgang Pack']);
    expect(await search('passant dog')).toEqual(['Wolfgang Pack']);
    expect(await search('Or')).toEqual(['Wolfgang Pack', 'Morgan Lyon']);
    expect(await search('morgan')).toEqual(['Morgan Lyon']);
    expect(await search('morg')).toEqual([]);
    expect(await search('wolf')).toEqual(['Wolfgang Pack']);
  });

  it('keeps search text in step with an edit, and out of the contact', async () => {
    const edited = await call('PUT', `/api/arms/${lion.id}`, {
      body: {
        displayName: 'Morgan Lyon',
        design: lone('vert', 'owl', 'argent'),
      },
      headers: { Authorization: `Bearer ${lion.editSecret}`, 'If-Match': '1' },
    });
    expect(edited.status, await edited.clone().text()).toBe(200);
    expect(await search('gold lion')).toEqual([]);
    expect(await search('white bird on green')).toEqual(['Morgan Lyon']);
    expect(await search('lyon.user')).toEqual([]);
    const row = await env.DB.prepare(`SELECT search_text FROM arms WHERE id = ?`).bind(lion.id).first<{ search_text: string }>();
    expect(row!.search_text).not.toContain('user');
    expect(row!.search_text).not.toContain(OWNER_EMAIL);
  });
});

// ── read ─────────────────────────────────────────────────────────────────────────────────────

describe('GET /api/arms/:id', () => {
  it('returns one entry including the public contact', async () => {
    const design = freshDesign();
    const created = await register(design, { displayName: 'Contactable', contact: { discord: '@Me_Contact' } });
    const res = await call('GET', `/api/arms/${created.id}`);
    expect(res.status).toBe(200);
    const e = await bodyOf(res);
    expect(e).toMatchObject({
      id: created.id,
      registry: { id: 'default', name: 'Default' },
      displayName: 'Contactable',
      contact: { discord: 'me_contact' },
      blazon: created.blazon,
      signature: created.signature,
      rev: 1,
    });
    expect(e.design).toEqual(nd(design));
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
      const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Copycat', design, shape } });
      expect(res.status, shape).toBe(409);
      const b = await bodyOf(res);
      expect(b).toMatchObject({ error: 'duplicate', conflict: { id: first.id, shape: 'round' } });
    }
    const check = await bodyOf(await call('POST', '/api/arms/check', { body: { design } }));
    expect(check).toMatchObject({ verdict: 'duplicate', signature: first.signature, conflict: { id: first.id, shape: 'round' } });
  });

  it('rejects an unknown shape (400) on register and edit, naming the field', async () => {
    for (const shape of ['kite', 'Heater', '', 3, null, ['round']]) {
      const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Bad shape', design: freshDesign(), shape } });
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

  it('keeps the stored shape when an edit sends none', async () => {
    const design = freshDesign();
    const c = await register(design, { shape: 'lozenge' });
    const res = await put(c.id, { displayName: 'Renamed', design }, c.editSecret, 1);
    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toMatchObject({ shape: 'lozenge', rev: 2 });
    expect((await bodyOf(await call('GET', `/api/arms/${c.id}`))).shape).toBe('lozenge');
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
    const res = await put(c.id, { displayName: 'After', contact: { discord: 'new.contact' }, design }, { Authorization: `Bearer ${c.editSecret}`, 'If-Match': '1' });
    expect(res.status).toBe(200);
    const e = await bodyOf(res);
    expect(e).toMatchObject({ id: c.id, displayName: 'After', contact: { discord: 'new.contact' }, rev: 2, signature: c.signature });
    expect(e).not.toHaveProperty('edit_secret_hash');
    const got = await bodyOf(await call('GET', `/api/arms/${c.id}`));
    expect(got.displayName).toBe('After');
    expect(got.rev).toBe(2);
    // Quoted ETag form is accepted too.
    const res2 = await put(c.id, { displayName: 'Again', design }, { Authorization: `Bearer ${c.editSecret}`, 'If-Match': '"2"' });
    expect(res2.status).toBe(200);
    // Leaving the contact out removes it.
    expect((await bodyOf(res2)).contact).toEqual({ discord: null });
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

    const invalid = await put(c.id, { displayName: 'Mine', design: arms('azure', group(ordinary('fess'), 'gules')) }, h);
    expect(invalid.status).toBe(400);
    expect((await bodyOf(invalid)).error).toBe('invalid_design');
    expect((await put(c.id, { displayName: '', design: mine }, h)).status).toBe(400);

    const dup = await put(c.id, { displayName: 'Mine', design: takenDesign }, h);
    expect(dup.status).toBe(409);
    const dupBody = await bodyOf(dup);
    expect(dupBody.error).toBe('duplicate');
    expect(dupBody.conflict.id).toBe(taken.id);

    // A genuinely new design is accepted and the search tags follow it.
    const newDesign = arms('argent', group(ordinary('cross'), 'vert', { charged: [group(charge('bee'), 'or')] }));
    const ok = await put(c.id, { displayName: 'Mine', design: newDesign }, h);
    expect(ok.status, await ok.clone().text()).toBe(200);
    const e = await bodyOf(ok);
    expect(e.blazon).toBe('Argent, on a cross vert a bee Or.');
    expect(e.rev).toBe(2);
    const tags = (await env.DB.prepare(`SELECT tag FROM arms_tags WHERE arms_id = ?`).bind(c.id).all<Json>()).results.map((t) => t.tag);
    expect(tags).toContain('charge:bee');
    expect(tags).toContain('ordinary:cross');
    expect(tags.filter((t) => t.startsWith('charge:'))).toEqual(['charge:bee']);
    const row = await env.DB.prepare(
      `SELECT partition_key, primary_key FROM arms WHERE id = ?`
    ).bind(c.id).first<Json>();
    expect(row).toEqual({ partition_key: 'plain', primary_key: 'ordinary:cross' });
  });

  it('does not treat an unchanged design as a duplicate of itself', async () => {
    const design = arms('sable', group(ordinary('bordure'), 'argent'), group(charge('lion', { posture: 'sejant' }), 'or'));
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
    const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, displayName: 'Late', design: freshDesign() }, headers });
    expect(res.status).toBe(429);
    expect((await bodyOf(res)).error).toBe('rate_limited');
    // Other IPs are unaffected.
    await register(freshDesign());
  });
});

// ── hardening ────────────────────────────────────────────────────────────────────────────────

describe('API response headers', () => {
  it('are no-store and nosniff on success and error JSON alike', async () => {
    const ok = await call('GET', '/api/arms');
    const missing = await call('GET', '/api/nope');
    const wrongMethod = await call('DELETE', '/api/arms');
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
  it('returns exactly the rows whose key may conflict, a fieldless badge (null partition) matching every partition', async () => {
    await addRegistry('keys', 'Keys');
    const partitions = [null, 'plain', 'per-pale'];
    const primaries = [null, 'charge:lion', 'charge:rose', MIXED_PRIMARY];
    const stored = partitions.flatMap((partition) => primaries.map((primary) => ({ partition, primary })));
    for (const [i, key] of stored.entries()) {
      await env.DB.prepare(
        `INSERT INTO arms (id, registry_id, display_name, design, signature, blazon, partition_key, primary_key, readability, edit_secret_hash, created_at, updated_at)
         VALUES (?, 'keys', 'Stored', '{}', ?, '', ?, ?, 'bold', 'h', ?, ?)`
      ).bind(`k-${i}`, `sig-${i}`, key.partition, key.primary, `2026-10-03T00:00:${String(i).padStart(2, '0')}Z`, `2026-10-03T00:00:${String(i).padStart(2, '0')}Z`).run();
    }
    for (const probe of stored) {
      const found = (await loadCandidates(env, 'keys', probe)).map((r) => r.id);
      expect(found, JSON.stringify(probe)).toEqual(stored.flatMap((key, i) => (keysMayConflict(probe, key) ? [`k-${i}`] : [])));
    }
  });

  it('gives the verdict a full scan of the stored registry gives', async () => {
    await addRegistry('prefilter', 'Prefilter');
    // Designs with two main pictures are keyed '*' and found by entries of any primary.
    const pairs = (seed: number, count: number) => generatedRichDesigns(seed, 1200).filter((d) => d.groups.filter((g) => g.role === 'primary').length === 2).slice(0, count);
    const stored = [...generatedDesigns(1, 100), ...pairs(1, 40)];
    const entries: RegistryEntryLike[] = [];
    for (const [i, design] of stored.entries()) {
      const sig = signature(design);
      if (entries.some((e) => e.signature === sig)) continue;
      const key = candidateKey(design);
      const at = `2026-10-03T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`;
      await env.DB.prepare(
        `INSERT INTO arms (id, registry_id, display_name, contact_discord, design, signature, blazon,
           partition_key, primary_key, readability, edit_secret_hash, rev, created_at, updated_at)
         VALUES (?, 'prefilter', 'Stored', NULL, ?, ?, ?, ?, ?, 'bold', 'h', 1, ?, ?)`
      ).bind(`pf-${i}`, JSON.stringify(design), sig, blazon(design), key.partition, key.primary, at, at).run();
      entries.push({ id: `pf-${i}`, signature: sig, design });
    }

    const verdicts = new Set<string>();
    for (const probe of [...generatedDesigns(50_000, 300), ...pairs(60_000, 40)]) {
      const full = checkUnique(probe, signature(probe), entries);
      const res = await call('POST', '/api/arms/check', { body: { registry: 'prefilter', design: probe } });
      expect(res.status).toBe(200);
      const data = await bodyOf(res);
      expect(data.verdict).toBe(full.kind);
      if (full.kind === 'ok') {
        expect(data.closest?.conflict.id ?? null).toBe(full.closest?.of ?? null);
        verdicts.add(full.closest ? 'ok-on-two-dcs' : 'ok');
      } else {
        expect(data.conflict.id).toBe(full.of);
        verdicts.add(full.kind);
      }
    }
    expect([...verdicts].sort()).toEqual(['duplicate', 'ok', 'ok-on-two-dcs', 'too-close']);
    expect(entries.some((e) => candidateKey(e.design).primary === '*')).toBe(true);
  }, 30_000);
});

describe('distinct changes', () => {
  const lion = (id: string, tincture: string, field: string) => arms(field, group(charge(id), tincture));
  const dcs = { registry: 'dcs', displayName: 'Distinct' };

  beforeAll(async () => {
    await addRegistry('dcs', 'Distinct changes');
  });

  it('stores the conflict key the too-close lookup keys on', async () => {
    const design = arms(div('per-bend-sinister', 'vert', 'gules'), group(ordinary('bend-sinister'), 'argent'), group(charge('sun'), 'or', { count: 2 }));
    const c = await register(design, dcs);
    const row = await env.DB.prepare(`SELECT partition_key, primary_key FROM arms WHERE id = ?`).bind(c.id).first<Json>();
    const key = candidateKey(nd(design));
    expect(row).toEqual({ partition_key: key.partition, primary_key: key.primary });
    expect(key.primary).not.toBeNull();
  });

  it('rejects one distinct change as too close, explaining it', async () => {
    const first = await register(lion('lion', 'or', 'azure'), dcs);
    const res = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, ...dcs, design: lion('lion', 'or', 'gules') } });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('too-close');
    expect(data.conflict.id).toBe(first.id);
    expect(data.differences).toHaveLength(1);
    expect(data.differences[0]).toMatchObject({ attr: 'field-tincture', kind: 'dc', rule: expect.stringMatching(/^A5/) });
    expect(data.differences[0].why).toContain('SENA');
  });

  it('rejects an edit into one distinct change from another entry', async () => {
    const mine = await register(lion('lion', 'sable', 'or'), dcs);
    const res = await call('PUT', `/api/arms/${mine.id}`, {
      body: { displayName: 'Distinct', design: lion('lion', 'or', 'gules') },
      headers: { Authorization: `Bearer ${mine.editSecret}`, 'If-Match': '1' },
    });
    expect(res.status).toBe(409);
    const data = await bodyOf(res);
    expect(data.error).toBe('too-close');
  });

  it('lets two distinct changes through and names the entry it only just passed', async () => {
    const res = await call('POST', '/api/arms/check', { body: { registry: 'dcs', design: lion('lion', 'argent', 'purpure') } });
    const data = await bodyOf(res);
    expect(data.verdict).toBe('ok');
    expect(data.closest.conflict.blazon).toBe('Azure, a lion Or.');
    expect(data.closest.differences.map((n: Json) => [n.attr, n.kind])).toEqual([['field-tincture', 'dc'], ['tincture', 'dc']]);
    const plainOk = await bodyOf(await call('POST', '/api/arms/check', { body: { registry: 'dcs', design: freshDesign() } }));
    expect(plainOk).toMatchObject({ verdict: 'ok', closest: null });
  });

  it('ignores the field shape', async () => {
    const design = lion('goat', 'or', 'sable');
    await register(design, { ...dcs, shape: 'banner' });
    const same = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, ...dcs, shape: 'round', design } });
    expect(same.status).toBe(409);
    expect((await bodyOf(same)).error).toBe('duplicate');
    const close = await call('POST', '/api/arms', { body: { email: OWNER_EMAIL, ...dcs, shape: 'lozenge', design: lion('goat', 'argent', 'sable') } });
    expect(close.status).toBe(409);
    expect((await bodyOf(close)).error).toBe('too-close');
  });
});

// ── ownership by email ───────────────────────────────────────────────────────────────────────

/** The bindings with Resend configured; every send goes to a mocked fetch, never the network. */
const mailBindings = { ...env, RESEND_API_KEY: 're_test_key' } as typeof env;

interface SentMail { url: string; authorization: string | null; from: string; to: string[]; subject: string; text: string }

/** Mock fetch so Resend calls are captured (and answered with `status`) instead of sent. */
function mockResend(status = 200): SentMail[] {
  const sent: SentMail[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    sent.push({
      url: String(input), authorization: new Headers(init?.headers).get('Authorization'),
      from: body.from, to: body.to, subject: body.subject, text: body.text,
    });
    return new Response(JSON.stringify(status === 200 ? { id: 'mail-1' } : { message: 'nope' }), { status });
  });
  return sent;
}

/** Capture console output while `fn` runs. */
async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
  const error = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
  try {
    await fn();
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
  return lines.join('\n');
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(message: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Every row of every table the Worker writes, as one string, to search for leaked values. */
async function databaseDump(): Promise<string> {
  const tables = ['registries', 'arms', 'arms_tags', 'owner_emails', 'owner_tokens'];
  const rows = await Promise.all(tables.map((t) => env.DB.prepare(`SELECT * FROM ${t}`).all()));
  return JSON.stringify(rows.map((r) => r.results));
}

const ownerCheck = (id: string, secret: string | null) =>
  call('GET', `/api/arms/${id}/owner`, { headers: secret === null ? {} : { Authorization: `Bearer ${secret}` } });

/** The recovery tokens in a recovery email, in order. */
function tokensIn(mail: SentMail): string[] {
  return [...mail.text.matchAll(/https:\/\/widget\.test\/#\/recover\/([A-Za-z0-9_-]+)/g)].map((m) => decodeURIComponent(m[1]));
}

async function recoverFor(email: string, bindings = mailBindings): Promise<Response> {
  return call('POST', '/api/recover', { body: { email }, bindings });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registration email', () => {
  it('is required, and validated before anything is stored', async () => {
    for (const email of [undefined, null, '', '   ', 'not-an-address', 'a@b', 42]) {
      const res = await call('POST', '/api/arms', { body: { displayName: 'No Email', email, design: freshDesign() } });
      expect(res.status, String(email)).toBe(400);
      expect(await bodyOf(res)).toMatchObject({ error: 'bad_request', field: 'email' });
    }
    const stored = await env.DB.prepare(`SELECT COUNT(*) AS n FROM arms WHERE display_name = 'No Email'`).first<Json>();
    expect(stored!.n).toBe(0);
  });

  it('is stored only as an HMAC of the normalised address, with its key version', async () => {
    const typed = '  Hmac.Person+Arms@Example.ORG ';
    const created = await register(freshDesign(), { email: typed, displayName: 'Hmac Person' });
    const row = await env.DB.prepare(`SELECT * FROM owner_emails WHERE arms_id = ?`).bind(created.id).first<Json>();
    expect(row).toMatchObject({
      arms_id: created.id,
      email_hmac: await hmacHex('test-email-hmac-key', 'hmac.person+arms@example.org'),
      key_version: 1,
    });
    const dump = (await databaseDump()).toLowerCase();
    expect(dump).not.toContain('hmac.person');
    expect(dump).not.toContain('example.org');
  });

  it('is never returned by any API response', async () => {
    const email = 'never.returned@example.net';
    const sent = mockResend();
    const createdRes = await call('POST', '/api/arms', { body: { displayName: 'Private Owner', email, design: freshDesign(), contact: { discord: 'private.owner' } }, bindings: mailBindings });
    const created = await bodyOf(createdRes.clone());
    const responses = [
      createdRes,
      await call('GET', `/api/arms/${created.id}`),
      await call('GET', '/api/arms?q=Private'),
      await ownerCheck(created.id, created.editSecret),
      await call('PUT', `/api/arms/${created.id}`, {
        body: { displayName: 'Private Owner', design: (await bodyOf(await call('GET', `/api/arms/${created.id}`))).design },
        headers: { Authorization: `Bearer ${created.editSecret}`, 'If-Match': '1' },
      }),
      await recoverFor(email),
    ];
    const token = tokensIn(sent[1])[0];
    responses.push(await call('POST', '/api/recover/lookup', { body: { token } }));
    responses.push(await call('POST', '/api/recover/redeem', { body: { token } }));
    for (const res of responses) {
      expect(res.status, res.url).toBeLessThan(300);
      expect((await res.text()).toLowerCase()).not.toContain('never.returned');
    }
  });

  it('sends the edit link by email and reports it was sent', async () => {
    const sent = mockResend();
    const res = await call('POST', '/api/arms', {
      body: { displayName: 'Mailed Person', email: 'Mailed@Example.com', design: freshDesign() },
      bindings: mailBindings,
    });
    expect(res.status).toBe(201);
    const data = await bodyOf(res);
    expect(data.editLinkEmail).toBe('sent');
    expect(sent).toHaveLength(1);
    const [mail] = sent;
    expect(mail.url).toBe('https://api.resend.com/emails');
    expect(mail.authorization).toBe('Bearer re_test_key');
    expect(mail.from).toBe('Heraldry Builder <heraldry@widgets.test>');
    expect(mail.to).toEqual(['mailed@example.com']);
    expect(mail.subject).not.toContain('Mailed');
    expect(mail.text).toContain('Your arms are registered as "Mailed Person":');
    expect(mail.text).not.toContain('Default');
    expect(mail.text).toContain(data.blazon);
    expect(mail.text).toContain(`https://widget.test/#/a/${data.id}/${data.editSecret}`);
    expect(mail.text).toContain(`https://widget.test/#/a/${data.id}\n`);
    expect(mail.text).toContain('Withdraw these arms');
    expect(mail.text).toContain('Lost your link? / Withdraw my registration');
    expect(mail.text).toContain('https://widget.test/#/recover');
  });

  it('still registers when sending fails, and says so without logging the address or link', async () => {
    mockResend(500);
    let data: Json = {};
    const logs = await captureLogs(async () => {
      const res = await call('POST', '/api/arms', { body: { displayName: 'Unlucky', email: 'unlucky@example.com', design: freshDesign() }, bindings: mailBindings });
      expect(res.status).toBe(201);
      data = await bodyOf(res);
    });
    expect(data.editLinkEmail).toBe('failed');
    expect((await bodyOf(await ownerCheck(data.id, data.editSecret))).owner).toBe(true);
    expect(logs).toContain('mail_failed');
    for (const secret of ['unlucky@example.com', data.editSecret, data.id]) expect(logs).not.toContain(secret);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));
    const thrown = await call('POST', '/api/arms', { body: { displayName: 'Unluckier', email: 'unluckier@example.com', design: freshDesign() }, bindings: mailBindings });
    expect(thrown.status).toBe(201);
    expect((await bodyOf(thrown)).editLinkEmail).toBe('failed');
  });

  it('is skipped without RESEND_API_KEY, logging one line without the address or link', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let data: Json = {};
    const logs = await captureLogs(async () => {
      data = await register(freshDesign(), { email: 'dev.person@example.com', displayName: 'Dev Person' });
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((data as Json).editLinkEmail).toBe('disabled');
    expect(JSON.parse(logs)).toEqual({ event: 'mail_skipped', reason: 'no_api_key', subject: 'Your Heraldry Builder edit link' });
    for (const secret of ['dev.person', data.editSecret, data.id]) expect(logs).not.toContain(secret);
  });
});

describe('GET /api/arms/:id/owner', () => {
  it('is 200 for the edit secret, 401 without one, 403 for a wrong or truncated one, 404 for an unknown id', async () => {
    const c = await register(freshDesign());
    const ok = await ownerCheck(c.id, c.editSecret);
    expect(ok.status).toBe(200);
    expect(await bodyOf(ok)).toEqual({ id: c.id, owner: true });
    expect((await ownerCheck(c.id, null)).status).toBe(401);
    expect((await ownerCheck(c.id, c.editSecret.slice(0, -3))).status).toBe(403);
    expect((await ownerCheck(c.id, 'x')).status).toBe(403);
    expect((await ownerCheck('no-such-id', c.editSecret)).status).toBe(404);
    const post = await call('POST', `/api/arms/${c.id}/owner`, { body: {} });
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET');
    expect((await call('GET', `/api/arms/${c.id}/other`)).status).toBe(404);
  });
});

describe('Discord contact', () => {
  it('is normalised, editable and removable by the owner, and never in list results', async () => {
    const design = freshDesign();
    const c = await register(design, { displayName: 'Discordant', contact: { discord: '@Disc.Ordant' } });
    expect((await bodyOf(await call('GET', `/api/arms/${c.id}`))).contact).toEqual({ discord: 'disc.ordant' });
    const row = await env.DB.prepare(`SELECT contact_discord FROM arms WHERE id = ?`).bind(c.id).first<Json>();
    expect(row!.contact_discord).toBe('disc.ordant');

    const list = await call('GET', '/api/arms?q=Discordant');
    const text = await list.text();
    expect(JSON.parse(text).items).toHaveLength(1);
    expect(text).not.toContain('disc.ordant');
    expect(JSON.parse(text).items[0]).not.toHaveProperty('contact');

    const auth = (rev: number) => ({ Authorization: `Bearer ${c.editSecret}`, 'If-Match': String(rev) });
    const edited = await call('PUT', `/api/arms/${c.id}`, { body: { displayName: 'Discordant', contact: { discord: 'new_name' }, design }, headers: auth(1) });
    expect((await bodyOf(edited)).contact).toEqual({ discord: 'new_name' });
    const removed = await call('PUT', `/api/arms/${c.id}`, { body: { displayName: 'Discordant', contact: { discord: null }, design }, headers: auth(2) });
    expect((await bodyOf(removed)).contact).toEqual({ discord: null });
  });

  it('is constrained to valid usernames in the database itself', async () => {
    const c = await register(freshDesign());
    for (const bad of ['UPPER', 'a..b', 'x', 'y'.repeat(33), 'sp ace']) {
      await expect(env.DB.prepare(`UPDATE arms SET contact_discord = ? WHERE id = ?`).bind(bad, c.id).run(), bad).rejects.toThrow(/CHECK/i);
    }
  });
});

describe('POST /api/recover', () => {
  it('answers 202 with the same body whether or not the address owns anything', async () => {
    const sent = mockResend();
    await register(freshDesign(), { email: 'known.owner@example.com', displayName: 'Known' });
    const known = await recoverFor('known.owner@example.com');
    const unknown = await recoverFor('nobody.here@example.com');
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.text()).toBe(await unknown.text());
    // Only the owner of something gets an email.
    expect(sent.map((m) => m.to)).toEqual([['known.owner@example.com']]);
  });

  it('400s a malformed address, and only accepts POST', async () => {
    const res = await recoverFor('not an address');
    expect(res.status).toBe(400);
    expect((await bodyOf(res)).field).toBe('email');
    const get = await call('GET', '/api/recover');
    expect(get.status).toBe(405);
    expect((await call('POST', '/api/recover/unknown', { body: {} })).status).toBe(404);
  });

  it('emails one single-use link per owned entry, in every registry, with the token in the fragment', async () => {
    await addRegistry('recovery-two', 'Second group');
    const sent = mockResend();
    const a = await register(freshDesign(), { email: 'many@example.com', displayName: 'First Of Many' });
    const b = await register(freshDesign(), { email: 'MANY@example.com ', displayName: 'Second Of Many', registry: 'recovery-two' });
    await register(freshDesign(), { email: 'someone.else@example.com', displayName: 'Not Theirs' });
    sent.length = 0;

    expect((await recoverFor(' Many@Example.com')).status).toBe(202);
    expect(sent).toHaveLength(1);
    const [mail] = sent;
    expect(mail.to).toEqual(['many@example.com']);
    expect(mail.text).toContain('"First Of Many": ');
    expect(mail.text).toContain('"Second Of Many": ');
    expect(mail.text).not.toContain('Default');
    expect(mail.text).not.toContain('Second group');
    expect(mail.text).not.toContain('Not Theirs');
    expect(mail.text).toContain('30 minutes');
    const tokens = tokensIn(mail);
    expect(tokens).toHaveLength(2);
    for (const t of tokens) expect(t.length).toBeGreaterThanOrEqual(43); // 256 random bits, base64url

    const rows = await env.DB.prepare(`SELECT * FROM owner_tokens WHERE arms_id IN (?, ?) ORDER BY created_at`).bind(a.id, b.id).all<Json>();
    expect(rows.results).toHaveLength(2);
    expect(new Set(rows.results.map((r) => r.token_hash))).toEqual(new Set(await Promise.all(tokens.map(sha256))));
    for (const r of rows.results) {
      expect(r.used_at).toBeNull();
      expect(Date.parse(r.expires_at) - Date.parse(r.created_at)).toBe(30 * 60 * 1000);
    }
    const dump = await databaseDump();
    for (const t of tokens) expect(dump).not.toContain(t);
  });

  it('does not log the address or links when the recovery email fails', async () => {
    mockResend(503);
    await register(freshDesign(), { email: 'quiet@example.com', displayName: 'Quiet' });
    const logs = await captureLogs(async () => {
      expect((await recoverFor('quiet@example.com')).status).toBe(202);
    });
    expect(logs).toContain('mail_failed');
    expect(logs).not.toContain('quiet@');
    expect(logs).not.toContain('#/recover/');
  });
});

describe('recovery tokens', () => {
  async function ownedEntry(email: string) {
    const sent = mockResend();
    const created = await register(freshDesign(), { email, displayName: 'Token Owner' });
    await recoverFor(email);
    const [token] = tokensIn(sent[sent.length - 1]);
    return { created, token, sent };
  }
  const post = (path: string, token: unknown) => call('POST', `/api/recover/${path}`, { body: { token } });

  it('look up the entry without using the token', async () => {
    const { created, token } = await ownedEntry('lookup@example.com');
    for (let i = 0; i < 2; i++) {
      const res = await post('lookup', token);
      expect(res.status).toBe(200);
      const data = await bodyOf(res);
      expect(data.entry).toMatchObject({ id: created.id, displayName: 'Token Owner', blazon: created.blazon, shape: 'heater', registry: { id: 'default', name: 'Default' } });
      expect(data.entry.design.v).toBe(2);
    }
    const row = await env.DB.prepare(`SELECT used_at FROM owner_tokens WHERE token_hash = ?`).bind(await sha256(token)).first<Json>();
    expect(row!.used_at).toBeNull();
  });

  it('redeem once: the edit secret is rotated (old link 403, new link 200)', async () => {
    const { created, token } = await ownedEntry('rotate@example.com');
    const res = await post('redeem', token);
    expect(res.status).toBe(200);
    const data = await bodyOf(res);
    expect(data).toMatchObject({ id: created.id, registry: { id: 'default', name: 'Default' }, displayName: 'Token Owner', blazon: created.blazon });
    expect(data.editSecret).not.toBe(created.editSecret);
    expect((await ownerCheck(created.id, created.editSecret)).status).toBe(403);
    expect((await ownerCheck(created.id, data.editSecret)).status).toBe(200);
    const row = await env.DB.prepare(`SELECT edit_secret_hash FROM arms WHERE id = ?`).bind(created.id).first<Json>();
    expect(row!.edit_secret_hash).toBe(await sha256(data.editSecret));

    // Single use: a second redeem, a withdraw or a lookup with the same token is refused.
    for (const path of ['redeem', 'withdraw', 'lookup']) {
      const again = await post(path, token);
      expect(again.status, path).toBe(410);
      expect((await bodyOf(again)).error).toBe('token_used');
    }
    expect((await ownerCheck(created.id, data.editSecret)).status).toBe(200);
  });

  it('a redeem uses up the entry\'s other outstanding tokens too', async () => {
    const { created, token, sent } = await ownedEntry('two.requests@example.com');
    await recoverFor('two.requests@example.com');
    const [second] = tokensIn(sent[sent.length - 1]);
    expect(second).not.toBe(token);
    expect((await post('redeem', second)).status).toBe(200);
    expect((await bodyOf(await post('redeem', token))).error).toBe('token_used');
    expect((await call('GET', `/api/arms/${created.id}`)).status).toBe(200);
  });

  it('expire after 30 minutes', async () => {
    const { created, token } = await ownedEntry('expiry@example.com');
    await env.DB.prepare(`UPDATE owner_tokens SET expires_at = ? WHERE token_hash = ?`)
      .bind(new Date(Date.now() - 1000).toISOString(), await sha256(token)).run();
    for (const path of ['lookup', 'redeem', 'withdraw']) {
      const res = await post(path, token);
      expect(res.status, path).toBe(410);
      expect((await bodyOf(res)).error).toBe('token_expired');
    }
    expect((await ownerCheck(created.id, created.editSecret)).status).toBe(200);
  });

  it('refuse unknown, missing and malformed tokens', async () => {
    for (const path of ['lookup', 'redeem', 'withdraw']) {
      const unknown = await post(path, 'A'.repeat(43));
      expect(unknown.status).toBe(404);
      expect((await bodyOf(unknown)).error).toBe('token_invalid');
      for (const bad of [undefined, '', 7, 'x'.repeat(129)]) {
        const res = await post(path, bad);
        expect(res.status).toBe(400);
        expect((await bodyOf(res)).field).toBe('token');
      }
    }
  });

  it('withdraw deletes the entry with its tags, email HMAC and tokens', async () => {
    const { created, token, sent } = await ownedEntry('withdraw.me@example.com');
    await recoverFor('withdraw.me@example.com');
    expect(tokensIn(sent[sent.length - 1])).toHaveLength(1);
    const { design } = (await bodyOf(await post('lookup', token))).entry;
    expect((await bodyOf(await call('POST', '/api/arms/check', { body: { design } }))).verdict).toBe('duplicate');
    const res = await post('withdraw', token);
    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toEqual({ id: created.id, withdrawn: true });
    expect((await call('GET', `/api/arms/${created.id}`)).status).toBe(404);
    for (const table of ['arms_tags', 'owner_emails', 'owner_tokens']) {
      const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE arms_id = ?`).bind(created.id).first<Json>();
      expect(left!.n, table).toBe(0);
    }
    // The design is free to register again, and the token went with the entry.
    expect((await bodyOf(await call('POST', '/api/arms/check', { body: { design } }))).verdict).toBe('ok');
    expect((await bodyOf(await post('lookup', token))).error).toBe('token_invalid');
  });
});
