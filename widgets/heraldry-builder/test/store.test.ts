// Tests of the SPA store seam (src/store.ts). They run in the same workerd pool as the Worker tests;
// there is no `location` there, which is exactly the store's offline (file://) mode. The online path
// is exercised by stubbing `location` and `fetch`. localStorage is absent too, which also checks
// that the device helpers degrade silently.
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as store from '../src/store';
import sample from '../src/data/sample-registry.json';
import { NO_CONTACT } from '../src/lib/heraldry';
import { arms, group, nd, ordinary, searchParams } from './helpers';


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
    const page = await store.search(searchParams({}));
    expect(page.ok && page.page.total).toBe(20);
    expect(page.ok && page.page.sample).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('filters the sample with the Worker semantics (tags AND, q, newest first, bounds)', async () => {
    const r = await store.search(searchParams({ ordinary: 'bordure' }));
    expect(r.ok && r.page.items.map((i) => i.id)).toEqual(['demo-020', 'demo-014', 'demo-004']);
    const none = await store.search(searchParams({ charge: 'dragon', ordinary: 'bordure' }));
    expect(none.ok && none.page.total).toBe(0);
    const q = await store.search(searchParams({ q: 'UNICORN' }));
    expect(q.ok && q.page.items.map((i) => i.id)).toEqual(['demo-002']);
    const paged = await store.search(searchParams({ limit: 5, offset: 18 }));
    expect(paged.ok && paged.page.items.map((i) => i.id)).toEqual(['demo-002', 'demo-001']);
    const bad = await store.search(searchParams({ charge: 'kraken' }));
    expect(bad).toMatchObject({ ok: false, kind: 'http', status: 400, code: 'bad_request', culprit: { kind: 'param', name: 'charge' } });
    // List results never carry the contact.
    expect(r.ok && r.page.items.every((i) => !('contact' in i))).toBe(true);
  });

  it('checks availability locally against the sample', async () => {
    const dup = await store.check('', arms('azure', group(ordinary('bend'), 'or')));
    expect(dup.ok && dup.result.verdict).toBe('duplicate');
    expect(dup.ok && dup.result.verdict === 'duplicate' && dup.result.conflict.id).toBe('demo-001');

    // A wolf statant is no different from a wolf passant, so the arms are too close with nothing to list…
    const same = await store.check('', arms('sable', group(ordinary('bordure'), 'argent'), group({ k: 'charge', charge: 'wolf', posture: 'statant' }, 'or')));
    expect(same.ok && same.result.verdict).toBe('too-close');
    expect(same.ok && same.result.verdict === 'too-close' && same.result.conflict.id).toBe('demo-004');
    expect(same.ok && same.result.verdict === 'too-close' && same.result.differences).toEqual([]);
    // …while one change of colour is one distinct change, still not enough.
    const close = await store.check('', arms('sable', group(ordinary('bordure'), 'argent'), group({ k: 'charge', charge: 'wolf', posture: 'passant' }, 'argent')));
    expect(close.ok && close.result.verdict).toBe('too-close');
    expect(close.ok && close.result.verdict === 'too-close' && close.result.conflict.id).toBe('demo-004');
    expect(close.ok && close.result.verdict === 'too-close' && close.result.differences).toMatchObject([
      { attr: 'tincture', kind: 'dc', rule: 'A5G3', item: 'charge', text: 'colour of pictures (Argent ↔ Or)' },
    ]);

    const ok = await store.check('', arms('vert', group(ordinary('cross'), 'or')));
    expect(ok.ok && ok.result).toMatchObject({ verdict: 'ok', blazon: 'Vert, a cross Or.', sample: true });

    const invalid = await store.check('', arms('azure', group(ordinary('bend'), 'gules')));
    expect(invalid).toMatchObject({ ok: false, code: 'invalid_design' });
  });

  it('refuses writes with a friendly offline message', async () => {
    const design = arms('vert', group(ordinary('cross'), 'or'));
    const offline = { ok: false, kind: 'offline', message: store.OFFLINE_WRITE_MESSAGE };
    expect(await store.register({ registry: '', displayName: 'X', email: 'x@example.com', contact: NO_CONTACT, design, shape: 'heater' })).toEqual(offline);
    expect((await store.update('demo-001', 's', 1, { displayName: 'X', contact: NO_CONTACT, design, shape: 'heater' })).ok).toBe(false);
    expect((await store.withdraw('demo-001', 's')).ok).toBe(false);
    // Ownership checks and recovery need the hosted registry too.
    expect(await store.checkOwner('demo-001', 's')).toEqual(offline);
    expect(await store.requestRecovery('x@example.com')).toEqual(offline);
    expect(await store.lookupRecovery('t')).toEqual(offline);
    expect(await store.redeemRecovery('t', { design: store.offlineSample().entries[0].design, shape: 'heater' })).toEqual(offline);
    expect(await store.withdrawByRecovery('t')).toEqual(offline);
  });

  it('reads sample entries (with their Discord contact) and the offline sample accessor', async () => {
    const e = await store.getEntry('demo-002');
    expect(e.ok && e.entry.contact).toEqual({ discord: 'basil.snacks' });
    const none = await store.getEntry('demo-001');
    expect(none.ok && none.entry.contact).toEqual({ discord: null });
    expect((await store.getEntry('nope')).ok).toBe(false);
    const s = store.offlineSample();
    expect(s.registry.id).toBe('sample');
    expect(s.entries).toHaveLength(sample.entries.length);
    expect(s.entries.map((e) => e.shape)).toEqual(sample.entries.map((e) => e.shape));
  });

  it('carries each entry\'s field shape into search results and conflicts', async () => {
    const page = await store.search(searchParams({ q: 'Quinn' }));
    expect(page.ok && page.page.items.map((i) => i.shape)).toEqual(['heater']);
    const lozenge = await store.getEntry('demo-009');
    expect(lozenge.ok && lozenge.entry.shape).toBe('lozenge');
    // demo-006 is displayed round; the same design checked from the builder conflicts with it.
    const dup = await store.check('', sample.entries[5].design);
    expect(dup.ok && dup.result.verdict === 'duplicate' && dup.result.conflict).toMatchObject({ id: 'demo-006', shape: 'round' });
  });

  it('degrades silently without localStorage', () => {
    expect(store.welcomeDismissed()).toBe(false);
    store.dismissWelcome();
    expect(store.examplesSeen()).toBe(true);
    store.markExamplesSeen();
    expect(store.deviceArms()).toEqual([]);
    expect(store.loadDraft()).toBeNull();
    store.saveDraft({ design: nd(arms('or')), shape: 'round' });
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
          { id: 'b', displayName: 'B', design: { v: 9 }, shape: 'heater', blazon: 'x', signature: 's', readability: 'bold', createdAt: 't' },
        ],
      })
    );
    const r = await store.search(searchParams({ registry: 'default', charge: 'wolf', q: 'x y' }));
    expect(spy.mock.calls[0][0]).toBe('/api/arms?registry=default&charge=wolf&q=x+y');
    expect(r.ok && r.page.items.map((i) => [i.id, i.shape])).toEqual([['a', 'lozenge']]);
    expect(r.ok && r.page.sample).toBe(false);
    // The "Show offline sample" action still works online.
    const s = await store.search(searchParams({}), { sample: true });
    expect(s.ok && s.page.sample).toBe(true);
  });

  it('maps a too-close answer to its code, conflict and well-formed difference notes', async () => {
    goOnline(async () =>
      jsonResponse(409, {
        error: 'too-close',
        message: 'Too close.',
        conflict: { id: 'demo-004', displayName: 'Dev', blazon: 'b', design: sample.entries[3].design, shape: 'round' },
        differences: [
          { attr: 'posture', kind: 'dc', rule: 'A5G5', text: 'posture (statant ↔ passant)', why: 'Half.', item: null },
          { attr: 'not-an-attribute', kind: 'dc', rule: 'A5G5', text: 'dropped', why: 'Malformed.', item: null },
          { attr: 'number', kind: 'dc', rule: 'not-a-rule', text: 'dropped: unknown rule', why: 'Malformed.', item: null },
          { attr: 'number', kind: 'dc', rule: 'A5G4', text: 'dropped: a note needs a reason' },
        ],
      })
    );
    const r = await store.register({ registry: '', displayName: 'X', email: 'x@example.com', contact: NO_CONTACT, design: {}, shape: 'heater' });
    expect(r).toMatchObject({ ok: false, kind: 'http', status: 409, code: 'too-close', message: 'Too close.' });
    const tooClose = !r.ok && r.kind === 'http' && r.code === 'too-close' ? r : null;
    expect(tooClose?.conflict.design.groups[0].item).toMatchObject({ k: 'charge', charge: 'wolf' });
    expect(tooClose?.conflict.shape).toBe('round');
    expect(tooClose?.differences).toEqual([{ attr: 'posture', kind: 'dc', rule: 'A5G5', text: 'posture (statant ↔ passant)', why: 'Half.', item: null }]);
  });

  it('maps network failures to kind network', async () => {
    goOnline(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await store.search(searchParams());
    expect(r).toMatchObject({ ok: false, kind: 'network' });
  });

  it('reports an answer that is not the protocol as a bad response', async () => {
    goOnline(async () => jsonResponse(200, { registry: { id: 'default', name: 'D' }, items: [] }));
    expect(await store.search(searchParams())).toMatchObject({ ok: false, kind: 'bad_response' });
    goOnline(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(await store.search(searchParams())).toMatchObject({ ok: false, kind: 'bad_response', message: 'The registry returned an error (502).' });
    goOnline(async () => jsonResponse(201, { id: 'n', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'b', signature: 's' }));
    const noMail = await store.register({ registry: '', displayName: 'N', email: 'n@example.com', contact: NO_CONTACT, design: sample.entries[0].design, shape: 'heater' });
    expect(noMail).toMatchObject({ ok: false, kind: 'bad_response' });
  });

  it('types a 400 by what it complains about', async () => {
    goOnline(async () => jsonResponse(400, { error: 'bad_request', message: 'Enter a valid email address.', field: 'email' }));
    const r = await store.register({ registry: '', displayName: 'N', email: 'bad', contact: NO_CONTACT, design: {}, shape: 'heater' });
    expect(r).toMatchObject({ ok: false, kind: 'http', code: 'bad_request', culprit: { kind: 'field', name: 'email' } });
    goOnline(async () => jsonResponse(400, { error: 'unknown_param', message: 'Unknown parameter "x".', param: 'x' }));
    expect(await store.search(searchParams())).toMatchObject({ code: 'unknown_param', culprit: { kind: 'param', name: 'x' } });
  });

  it('sends the secret and revision on update', async () => {
    const spy = goOnline(async () =>
      jsonResponse(200, {
        id: 'a', registry: { id: 'default', name: 'B' }, displayName: 'N', contact: { discord: 'n.name' }, design: sample.entries[0].design, shape: 'banner',
        blazon: 'Azure, a bend Or', signature: 's', readability: 'bold', rev: 3, createdAt: 't', updatedAt: 'u',
      })
    );
    const r = await store.update('a', 'sec', 2, { displayName: 'N', contact: { discord: 'n.name' }, design: sample.entries[0].design, shape: 'banner' });
    expect(r.ok && r.entry.rev).toBe(3);
    expect(r.ok && r.entry.contact).toEqual({ discord: 'n.name' });
    expect(r.ok && r.entry.shape).toBe('banner');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sec');
    expect((init.headers as Record<string, string>)['If-Match']).toBe('2');
    expect(JSON.parse(init.body as string)).toMatchObject({ displayName: 'N', shape: 'banner', contact: { discord: 'n.name' } });
  });

  it('sends the field shape beside the design on register', async () => {
    const spy = goOnline(async () => jsonResponse(201, { id: 'n', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'b', signature: 's', editLinkEmail: 'sent' }));
    await store.register({ registry: '', displayName: 'N', email: 'n@example.com', contact: NO_CONTACT, design: sample.entries[0].design, shape: 'round' });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.shape).toBe('round');
    expect(body.design).toEqual(sample.entries[0].design);
  });

  it('sends the email and Discord contact on register and reads whether the edit link was emailed', async () => {
    const spy = goOnline(async () => jsonResponse(201, { id: 'n', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'b', signature: 's', editLinkEmail: 'sent' }));
    const r = await store.register({ registry: '', displayName: 'N', email: 'n@example.com', contact: { discord: 'n.name' }, design: sample.entries[0].design, shape: 'heater' });
    expect(r.ok && r.created.editLinkEmail).toBe('sent');
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ email: 'n@example.com', contact: { discord: 'n.name' } });

    for (const outcome of ['failed', 'disabled'] as const) {
      goOnline(async () => jsonResponse(201, { id: 'n', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'b', signature: 's', editLinkEmail: outcome }));
      const again = await store.register({ registry: '', displayName: 'N', email: 'n@example.com', contact: NO_CONTACT, design: sample.entries[0].design, shape: 'heater' });
      expect(again.ok && again.created.editLinkEmail).toBe(outcome);
    }
  });

  it('checks an edit link with the owner route', async () => {
    const spy = goOnline(async () => jsonResponse(200, { id: 'a b', owner: true }));
    expect(await store.checkOwner('a b', 'sec')).toEqual({ ok: true, id: 'a b' });
    expect(spy.mock.calls[0][0]).toBe('/api/arms/a%20b/owner');
    expect(((spy.mock.calls[0][1] as RequestInit).headers as Record<string, string>).Authorization).toBe('Bearer sec');
    goOnline(async () => jsonResponse(403, { error: 'forbidden', message: 'Wrong edit secret.' }));
    expect(await store.checkOwner('a', 'bad')).toMatchObject({ ok: false, kind: 'http', status: 403, code: 'forbidden' });
  });

  it('requests recovery, looks a token up, and maps typed token errors', async () => {
    const spy = goOnline(async () => jsonResponse(202, { accepted: true, message: "If that address owns any arms, we've sent it a link." }));
    expect(await store.requestRecovery('n@example.com')).toEqual({ ok: true, message: "If that address owns any arms, we've sent it a link." });
    expect(spy.mock.calls[0][0]).toBe('/api/recover');
    expect(JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)).toEqual({ email: 'n@example.com' });

    const entry = { id: 'a', registry: { id: 'default', name: 'D' }, displayName: 'N', design: sample.entries[0].design, shape: 'round', blazon: 'b' };
    const lookup = goOnline(async () => jsonResponse(200, { entry, expiresAt: 'later' }));
    const found = await store.lookupRecovery('tok');
    expect(found.ok && found.entry).toMatchObject({ id: 'a', displayName: 'N', shape: 'round' });
    expect(lookup.mock.calls[0][0]).toBe('/api/recover/lookup');
    expect(JSON.parse((lookup.mock.calls[0][1] as RequestInit).body as string)).toEqual({ token: 'tok' });

    goOnline(async () => jsonResponse(410, { error: 'token_expired', message: 'That recovery link has expired.' }));
    expect(await store.lookupRecovery('tok')).toMatchObject({ ok: false, status: 410, code: 'token_expired' });
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
  const design = nd(arms('vert', group(ordinary('cross'), 'or')));

  it('round-trips the design and its shape', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    store.saveDraft({ design: store.offlineSample().entries[0].design, shape: 'lozenge' });
    expect(store.loadDraft()).toEqual({ design: store.offlineSample().entries[0].design, shape: 'lozenge' });
    store.clearDraft();
    expect(store.loadDraft()).toBeNull();
  });

  it('remembers a dismissed welcome strip', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(store.welcomeDismissed()).toBe(false);
    store.dismissWelcome();
    expect(store.welcomeDismissed()).toBe(true);
  });

  it('remembers that the examples box has been seen', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(store.examplesSeen()).toBe(false);
    store.markExamplesSeen();
    expect(store.examplesSeen()).toBe(true);
  });

  it('ignores a draft of another format or without a shape', () => {
    for (const old of [{ v: 1, design }, { v: 2, design }]) {
      vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:draft:v1': JSON.stringify({ ...old, savedAt: '2026-10-01T00:00:00Z' }) }));
      expect(store.loadDraft()).toBeNull();
    }
  });

  it('keeps the arms and shape of a registration for the Your arms thumbnail', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    goOnline(async () => jsonResponse(201, { id: 'n1', editSecret: 'e', registry: { id: 'default', name: 'D' }, rev: 1, blazon: 'Vert, a cross Or.', signature: 's', editLinkEmail: 'sent' }));
    await store.register({ registry: '', displayName: 'N', email: 'n@example.com', contact: NO_CONTACT, design, shape: 'banner' });
    const [saved] = store.deviceArms();
    expect(saved.shield).toEqual({ design, shape: 'banner' });
  });

  it('reads a Your arms shortcut saved before thumbnails without one', () => {
    const old = [{ id: 'o', registry: 'default', displayName: 'Old', blazon: 'b', secret: 's', savedAt: '2026-10-01T00:00:00Z' }];
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:device-arms:v1': JSON.stringify(old) }));
    expect(store.deviceArms()).toEqual([{ ...old[0], shield: null }]);
  });

  it('ignores a draft with an unknown shape', () => {
    const bad = JSON.stringify({ v: 2, savedAt: '2026-10-01T00:00:00Z', design, shape: 'kite' });
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:draft:v1': bad }));
    expect(store.loadDraft()).toBeNull();
  });

  it('remembers the new edit link from a redeemed recovery link, replacing the old one', async () => {
    const old = [{ id: 'r1', registry: 'default', displayName: 'Old name', blazon: 'b', shield: null, secret: 'old-secret', savedAt: '2026-10-01T00:00:00Z' }];
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:device-arms:v1': JSON.stringify(old) }));
    const spy = goOnline(async () => jsonResponse(200, { id: 'r1', editSecret: 'new-secret', registry: { id: 'default', name: 'D' }, displayName: 'N', blazon: 'Vert, a cross Or.', rev: 4 }));
    const r = await store.redeemRecovery('tok', { design: store.offlineSample().entries[0].design, shape: 'round' });
    expect(r.ok && r.recovered).toEqual({ id: 'r1', editSecret: 'new-secret', displayName: 'N', blazon: 'Vert, a cross Or.' });
    expect(spy.mock.calls[0][0]).toBe('/api/recover/redeem');
    const [saved] = store.deviceArms();
    expect(saved).toMatchObject({ id: 'r1', secret: 'new-secret', displayName: 'N', shield: { design: store.offlineSample().entries[0].design, shape: 'round' } });
  });

  it('forgets an entry withdrawn with a recovery link, and keeps it when the token is refused', async () => {
    const kept = [{ id: 'w1', registry: 'default', displayName: 'W', blazon: 'b', shield: null, secret: 's', savedAt: '2026-10-01T00:00:00Z' }];
    vi.stubGlobal('localStorage', memoryStorage({ 'heraldry-builder:device-arms:v1': JSON.stringify(kept) }));
    goOnline(async () => jsonResponse(410, { error: 'token_used', message: 'Used.' }));
    expect(await store.withdrawByRecovery('tok')).toMatchObject({ ok: false, code: 'token_used' });
    expect(store.deviceArms().map((e) => e.id)).toEqual(['w1']);
    goOnline(async () => jsonResponse(200, { id: 'w1', withdrawn: true }));
    expect(await store.withdrawByRecovery('tok')).toEqual({ ok: true, id: 'w1' });
    expect(store.deviceArms()).toEqual([]);
  });
});
