// Tests of the SPA store seam (src/store.ts). They run in the same workerd pool as the Worker tests;
// there is no `location` there, which is exactly the store's offline (file://) mode. The online path
// is exercised by stubbing `location` and `fetch`. localStorage is absent too, which also checks
// that the device helpers degrade silently.
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as store from '../src/store';
import sample from '../src/data/sample-registry.json';

const plain = (tincture: string) => ({ kind: 'plain', tincture });

afterEach(() => {
  vi.unstubAllGlobals();
});

function goOnline(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('location', { protocol: 'https:', origin: 'https://x.test', pathname: '/', search: '' });
  const spy = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('store (offline / file://)', () => {
  it('serves the sample registry without touching the network', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(store.isOffline()).toBe(true);
    const regs = await store.listRegistries();
    expect(regs).toEqual({ ok: true, registries: [{ id: 'sample', name: 'Sample armorial (offline demo)', isDefault: true }], sample: true });
    const page = await store.search({});
    expect(page.ok && page.page.total).toBe(17);
    expect(page.ok && page.page.sample).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('filters the sample with the Worker semantics (tags AND, q, newest first, bounds)', async () => {
    const r = await store.search({ ordinary: 'bordure' });
    expect(r.ok && r.page.items.map((i) => i.id)).toEqual(['demo-014', 'demo-004']);
    const none = await store.search({ charge: 'dragon', ordinary: 'bordure' });
    expect(none.ok && none.page.total).toBe(0);
    const q = await store.search({ q: 'UNICORN' });
    expect(q.ok && q.page.items.map((i) => i.id)).toEqual(['demo-002']);
    const paged = await store.search({ limit: 5, offset: 15 });
    expect(paged.ok && paged.page.items.map((i) => i.id)).toEqual(['demo-002', 'demo-001']);
    const bad = await store.search({ charge: 'kraken' });
    expect(bad).toMatchObject({ ok: false, kind: 'http', status: 400, param: 'charge' });
    // List results never carry the contact.
    expect(r.ok && r.page.items.every((i) => !('contact' in i))).toBe(true);
  });

  it('checks availability locally against the sample', async () => {
    const dup = await store.check(null, { v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } });
    expect(dup.ok && dup.result.verdict).toBe('duplicate');
    expect(dup.ok && dup.result.conflict?.id).toBe('demo-001');

    const close = await store.check(null, {
      v: 1,
      field: plain('sable'),
      ordinary: { type: 'bordure', tincture: 'argent' },
      charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'statant', tincture: 'or' },
    });
    expect(close.ok && close.result.verdict).toBe('too-close');
    expect(close.ok && close.result.conflict?.id).toBe('demo-004');
    expect(close.ok && close.result.differences).toEqual(['posture (statant ↔ passant)']);

    const ok = await store.check(null, { v: 1, field: plain('vert'), ordinary: { type: 'cross', tincture: 'or' } });
    expect(ok.ok && ok.result).toMatchObject({ verdict: 'ok', blazon: 'Vert, a cross Or', sample: true });

    const invalid = await store.check(null, { v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'gules' } });
    expect(invalid).toMatchObject({ ok: false, code: 'invalid_design' });
  });

  it('refuses writes with a friendly offline message', async () => {
    const design = { v: 1, field: plain('vert'), ordinary: { type: 'cross', tincture: 'or' } };
    expect(await store.register({ registry: null, displayName: 'X', design, shape: 'heater' })).toEqual({
      ok: false, kind: 'offline', message: store.OFFLINE_WRITE_MESSAGE,
    });
    expect((await store.update('demo-001', 's', 1, { displayName: 'X', design, shape: 'heater' })).ok).toBe(false);
    expect((await store.withdraw('demo-001', 's')).ok).toBe(false);
  });

  it('reads sample entries (with contact) and the offline sample accessor', async () => {
    const e = await store.getEntry('demo-002');
    expect(e.ok && e.entry.contact).toBe('Ask for Basil at the snack table');
    expect((await store.getEntry('nope')).ok).toBe(false);
    const s = store.offlineSample();
    expect(s.registry.id).toBe('sample');
    expect(s.entries).toHaveLength(sample.entries.length);
    expect(s.entries.map((e) => e.shape)).toEqual(sample.entries.map((e) => e.shape));
  });

  it('carries each entry\'s field shape into search results and conflicts', async () => {
    const page = await store.search({ q: 'Quinn' });
    expect(page.ok && page.page.items.map((i) => i.shape)).toEqual(['heater']);
    const lozenge = await store.getEntry('demo-009');
    expect(lozenge.ok && lozenge.entry.shape).toBe('lozenge');
    // demo-006 is displayed round; the same design checked from the builder conflicts with it.
    const dup = await store.check(null, sample.entries[5].design);
    expect(dup.ok && dup.result.conflict).toMatchObject({ id: 'demo-006', shape: 'round' });
  });

  it('degrades silently without localStorage', () => {
    expect(store.deviceArms()).toEqual([]);
    expect(store.loadDraft()).toBeNull();
    store.saveDraft({ design: { v: 1, field: { kind: 'plain', tincture: 'or' }, ordinary: null, charges: null }, shape: 'round' });
    store.rememberArms({ id: 'a', registry: 'r', displayName: 'n', blazon: 'b', shield: null, secret: null });
  });
});

describe('store (online)', () => {
  it('maps search responses and re-validates designs', async () => {
    const spy = goOnline(async () =>
      jsonResponse(200, {
        registry: { id: 'default', name: 'Default' },
        total: 2,
        offset: 0,
        limit: 24,
        items: [
          { id: 'a', displayName: 'A', design: sample.entries[0].design, shape: 'lozenge', blazon: 'Azure, a bend Or', signature: 's', readability: 'bold', createdAt: 't' },
          { id: 'c', displayName: 'C', design: sample.entries[0].design, shape: 'kite', blazon: 'Azure, a bend Or', signature: 's', readability: 'bold', createdAt: 't' },
          { id: 'b', displayName: 'B', design: { v: 9 }, blazon: 'x', signature: 's', readability: 'bold', createdAt: 't' },
        ],
      })
    );
    const r = await store.search({ registry: 'default', charge: 'wolf', q: 'x y' });
    expect(spy.mock.calls[0][0]).toBe('/api/arms?registry=default&charge=wolf&q=x+y');
    expect(r.ok && r.page.items.map((i) => [i.id, i.shape])).toEqual([['a', 'lozenge'], ['c', 'heater']]);
    expect(r.ok && r.page.sample).toBe(false);
    // The "Show offline sample" action still works online.
    const s = await store.search({}, { sample: true });
    expect(s.ok && s.page.sample).toBe(true);
  });

  it('maps HTTP errors to kind http with the Worker code and details', async () => {
    goOnline(async () =>
      jsonResponse(409, {
        error: 'too_close',
        message: 'Too close.',
        conflictId: 'demo-004',
        conflict: { id: 'demo-004', displayName: 'Dev', blazon: 'b', design: sample.entries[3].design },
        differences: ['posture (statant ↔ passant)'],
      })
    );
    const r = await store.register({ registry: null, displayName: 'X', design: {}, shape: 'heater' });
    expect(r).toMatchObject({ ok: false, kind: 'http', status: 409, code: 'too_close', message: 'Too close.', conflictId: 'demo-004' });
    expect(!r.ok && r.conflict?.design?.charges?.charge).toBe('wolf');
    // A conflict from a Worker that sends no shape displays as a heater shield.
    expect(!r.ok && r.conflict?.shape).toBe('heater');
  });

  it('maps network failures to kind network', async () => {
    goOnline(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await store.listRegistries();
    expect(r).toMatchObject({ ok: false, kind: 'network' });
  });

  it('sends the secret and revision on update', async () => {
    const spy = goOnline(async () =>
      jsonResponse(200, {
        id: 'a', registry: { id: 'default', name: 'B' }, displayName: 'N', contact: null, design: sample.entries[0].design, shape: 'banner',
        blazon: 'Azure, a bend Or', signature: 's', readability: 'bold', rev: 3, createdAt: 't', updatedAt: 'u',
      })
    );
    const r = await store.update('a', 'sec', 2, { displayName: 'N', design: sample.entries[0].design, shape: 'banner' });
    expect(r.ok && r.entry.rev).toBe(3);
    expect(r.ok && r.entry.shape).toBe('banner');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sec');
    expect((init.headers as Record<string, string>)['If-Match']).toBe('2');
    expect(JSON.parse(init.body as string)).toMatchObject({ displayName: 'N', shape: 'banner' });
  });

  it('sends the field shape beside the design on register', async () => {
    const spy = goOnline(async () => jsonResponse(201, { id: 'n', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'b', signature: 's' }));
    await store.register({ registry: null, displayName: 'N', design: sample.entries[0].design, shape: 'round' });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.shape).toBe('round');
    expect(body.design).toEqual(sample.entries[0].design);
  });
});

describe('store device storage (drafts and Your arms)', () => {
  /** A minimal in-memory localStorage. */
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }
  const design = { v: 1, field: plain('vert'), ordinary: { type: 'cross', tincture: 'or' }, charges: null };

  it('round-trips the design and its shape', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    store.saveDraft({ design: store.offlineSample().entries[0].design, shape: 'lozenge' });
    expect(store.loadDraft()).toEqual({ design: store.offlineSample().entries[0].design, shape: 'lozenge' });
    store.clearDraft();
    expect(store.loadDraft()).toBeNull();
  });

  it('reads a draft saved before field shapes as a heater shield', () => {
    const old = JSON.stringify({ v: 1, savedAt: '2026-10-01T00:00:00Z', design });
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:draft:v1': old }));
    expect(store.loadDraft()).toEqual({ design, shape: 'heater' });
  });

  it('keeps the arms and shape of a registration for the Your arms thumbnail', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    goOnline(async () => jsonResponse(201, { id: 'n1', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'Vert, a cross Or', signature: 's' }));
    await store.register({ registry: null, displayName: 'N', design, shape: 'banner' });
    const [saved] = store.deviceArms();
    expect(saved.shield).toEqual({ design, shape: 'banner' });
  });

  it('reads a Your arms shortcut saved before thumbnails without one', () => {
    const old = [{ id: 'o', registry: 'default', displayName: 'Old', blazon: 'b', secret: 's', savedAt: '2026-10-01T00:00:00Z' }];
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:device-arms:v1': JSON.stringify(old) }));
    expect(store.deviceArms()).toEqual([{ ...old[0], shield: null }]);
  });

  it('ignores an unknown stored shape', () => {
    const bad = JSON.stringify({ v: 2, savedAt: '2026-10-01T00:00:00Z', design, shape: 'kite' });
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:draft:v1': bad }));
    expect(store.loadDraft()?.shape).toBe('heater');
  });
});
