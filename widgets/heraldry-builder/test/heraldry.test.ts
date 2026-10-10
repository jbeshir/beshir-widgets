// Pure tests of the DOM-free heraldry library (src/lib/heraldry): every worked validation
// example, the uniqueness examples, the sample registry fixture, tags and the options helper.
// Runs in the same vitest-pool-workers pool as the Worker tests.

import { describe, it, expect } from 'vitest';
import {
  ARRANGEMENTS, CHARGES, CHARGE_IDS, CHARGE_ART, COUNTS, FIELD_SHAPES, ORDINARY_TYPES, TINCTURES, isChargeId, isFieldShape, postureGloss, postureTerm,
  arrangementChoices, blazon, chargePath, chargeSlotContacts, chargeSlots, chargeStructureIssue, chargeTinctureChoices,
  checkUnique, countChoices, deriveTags, differences, explainDifferences, fieldTinctureChoices, filtersToTags, fitCharges,
  gloss, areDistinct, matchesTags, normalise, ordinaryTinctureChoices, placementChoices, postureChoices,
  BETWEEN_GLOSS, BETWEEN_SLOTS, cleanDiscord, readability, resolve, signature, slotsFor, suggestTinctureFix, validate,
  type Choice, type Count, type Design, type Issue, type Ordinary, type Placement, type SearchFilters,
} from '../src/lib/heraldry';
import sample from '../src/data/sample-registry.json';
import sampleRaw from '../src/data/sample-registry.json?raw';
import { V } from './validation-cases';
import { plain, div, nd, filters } from './helpers';

// ── helpers ─────────────────────────────────────────────────────────────────


/** Resolve (parse + defaults) a design that is expected to be well-formed. */
function issuesOf(input: unknown): Issue[] {
  const r = normalise(input);
  return r.ok ? [] : r.errors;
}

// ── worked validation examples ─────────────────────────────────────────


describe('worked validation examples', () => {
  for (const c of V) {
    it(`${c.id}: ${c.blazon ?? '(structural)'}`, () => {
      const r = normalise(c.design);
      expect(r.ok).toBe(c.valid);
      const d = r.ok ? r.design : r.design;
      expect(d).not.toBeNull();
      if (!r.ok) {
        expect(r.errors.map((e) => e.message)).toEqual(c.messages);
        expect(r.errors.map((e) => e.code)).toEqual(c.codes);
      }
      if (c.blazon) expect(blazon(d!)).toBe(c.blazon);
      if (c.gloss) expect(gloss(d!)).toBe(c.gloss);
      if (c.signature) expect(signature(d!)).toBe(c.signature);
      if (c.score !== undefined) {
        const rd = readability(d!);
        expect(rd.score).toBe(c.score);
        expect(rd.band).toBe(c.band);
      }
    });
  }

  it('the three-wolves chevron design readability breakdown matches the documented factors', () => {
    const rd = readability(nd(V.find((v) => v.id === 'V18')!.design));
    const pts = Object.fromEntries(rd.breakdown.map((b) => [b.factor, b.points]));
    expect(pts).toEqual({ tinctures: 2, division: 1, touching: 2, straddle: 0, ordinary: 1, 'on-ordinary': 0, count: 1, detail: 1, split: 0 });
  });

  it('the per-fess mullets issue names the failing slots', () => {
    const r = normalise(V.find((v) => v.id === 'V9')!.design);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].slots).toEqual([0, 1]);
  });
});

// ── Equivalences and non-equivalence ──────────────────────────────────

describe('equivalent inputs share a signature', () => {
  const cases: Array<[string, unknown, unknown, string, string]> = [
    ['E1',
      { v: 1, field: plain('gules'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'argent' } },
      { v: 1, field: plain('gules'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'argent', arrangement: 'two-and-one' } },
      'v1|F:plain:gu|O:-|C:mullet:3:field:two-and-one:-:ar', 'Gules, three mullets Argent'],
    ['E2',
      { v: 1, field: plain('azure'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'or' } },
      { v: 1, field: plain('azure'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'or', posture: 'rampant', arrangement: 'in-pale' } },
      'v1|F:plain:az|O:-|C:lion:1:field:single:rampant:or', 'Azure, a lion rampant Or'],
    ['E3',
      { v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' }, charges: { charge: 'unicorn', count: 3, placement: 'ordinary', tincture: 'vert' } },
      { v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' }, charges: { charge: 'unicorn', count: 3, placement: 'ordinary', tincture: 'vert', arrangement: 'in-bend' } },
      'v1|F:plain:az|O:bend:or|C:unicorn:3:ordinary:forced:rampant:vt', 'Azure, on a bend Or three unicorns rampant Vert'],
    ['E4',
      { v: 1, field: { kind: 'plain', tincture: 'azure' }, ordinary: { type: 'bend', tincture: 'or' } },
      { charges: null, ordinary: { tincture: 'or', type: 'bend' }, field: { tincture: 'azure', kind: 'plain' }, v: 1 },
      'v1|F:plain:az|O:bend:or|C:-', 'Azure, a bend Or'],
  ];
  for (const [id, a, b, sig, bl] of cases) {
    it(id, () => {
      const ra = normalise(a), rb = normalise(b);
      expect(ra.ok && rb.ok).toBe(true);
      if (!ra.ok || !rb.ok) return;
      expect(signature(ra.design)).toBe(sig);
      expect(signature(rb.design)).toBe(sig);
      expect(blazon(ra.design)).toBe(bl);
      expect(blazon(rb.design)).toBe(bl);
      expect(JSON.stringify(ra.design)).toBe(JSON.stringify(rb.design));
    });
  }

  it('divided-field tincture order is positional', () => {
    const a = nd({ v: 1, field: div('per-pale', 'azure', 'or') });
    const b = nd({ v: 1, field: div('per-pale', 'or', 'azure') });
    expect(signature(a)).toBe('v1|F:per-pale:az:or|O:-|C:-');
    expect(signature(b)).toBe('v1|F:per-pale:or:az|O:-|C:-');
  });
});

// ── Blazon defaults ─────────────────────────────────────────────────────────

describe('blazon defaults', () => {
  const g = (count: number, arrangement?: string, extra: Record<string, unknown> = {}) =>
    blazon(nd({ v: 1, field: plain('gules'), charges: { charge: 'mullet', count, placement: 'field', tincture: 'argent', ...(arrangement ? { arrangement } : {}) }, ...extra }));

  it('omits the default arrangement for each count and prints the others', () => {
    expect(g(2)).toBe('Gules, two mullets Argent');
    expect(g(2, 'in-pale')).toBe('Gules, two mullets Argent');
    expect(g(2, 'in-fess')).toBe('Gules, two mullets in fess Argent');
    expect(g(3, 'in-bend-sinister')).toBe('Gules, three mullets in bend sinister Argent');
    expect(g(4)).toBe('Gules, four mullets Argent');
    expect(g(4, 'in-cross')).toBe('Gules, four mullets in cross Argent');
    expect(g(5)).toBe('Gules, five mullets Argent');
    expect(g(6)).toBe('Gules, six mullets Argent');
  });

  it('always states posture, using display terms and word order number → name → posture → arrangement → tincture', () => {
    const lions = nd({ v: 1, field: plain('azure'), charges: { charge: 'lion', count: 3, placement: 'field', posture: 'passant', arrangement: 'in-pale', tincture: 'or' } });
    expect(blazon(lions)).toBe('Azure, three lions passant in pale Or');
    const lion = nd({ v: 1, field: plain('azure'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'or' } });
    expect(blazon(lion)).toBe('Azure, a lion rampant Or');
    const stag = nd({ v: 1, field: plain('vert'), charges: { charge: 'stag', count: 1, placement: 'field', posture: 'passant', tincture: 'or' } });
    expect(blazon(stag)).toBe('Vert, a stag trippant Or');
    const hare = nd({ v: 1, field: plain('vert'), charges: { charge: 'hare', count: 2, placement: 'field', posture: 'passant', tincture: 'argent' } });
    expect(blazon(hare)).toBe('Vert, two hares courant Argent');
  });

  it('uses stored articles and plurals', () => {
    const eagle = nd({ v: 1, field: plain('azure'), charges: { charge: 'eagle', count: 1, placement: 'field', tincture: 'or' } });
    expect(blazon(eagle)).toBe('Azure, an eagle displayed Or');
    expect(gloss(eagle)).toBe('A blue shield with a gold eagle with spread wings.');
    const book = nd({ v: 1, field: plain('gules'), charges: { charge: 'open-book', count: 1, placement: 'field', tincture: 'argent' } });
    expect(blazon(book)).toBe('Gules, an open book Argent');
    const fleurs = nd({ v: 1, field: plain('azure'), charges: { charge: 'fleur-de-lis', count: 3, placement: 'field', tincture: 'or' } });
    expect(blazon(fleurs)).toBe('Azure, three fleurs-de-lis Or');
    expect(gloss(fleurs)).toBe('A blue shield with three gold lilies (fleurs-de-lis), two above one.');
  });

  it('under a chief two charges can only be in fess, so the blazon leaves it unsaid', () => {
    const d = nd({ v: 1, field: plain('gules'), ordinary: { type: 'chief', tincture: 'or' }, charges: { charge: 'mullet', count: 2, placement: 'field', tincture: 'argent' } });
    expect(d.charges!.arrangement).toBe('in-fess');
    expect(validate(d)).toEqual([]);
    expect(blazon(d)).toBe('Gules, two mullets Argent, a chief Or');
    // Three under a chief have a choice, so in fess (not the default) is still said.
    const three = nd({ v: 1, field: plain('gules'), ordinary: { type: 'chief', tincture: 'or' }, charges: { charge: 'mullet', count: 3, placement: 'field', arrangement: 'in-fess', tincture: 'argent' } });
    expect(blazon(three)).toBe('Gules, three mullets in fess Argent, a chief Or');
    expect(gloss(d)).toBe('A red shield with two white five-pointed stars, in a row, and a gold band across the top.');
  });

  it('ordinary-only bodies for chief and bordure', () => {
    expect(blazon(nd({ v: 1, field: plain('azure'), ordinary: { type: 'bordure', tincture: 'argent' } }))).toBe('Azure, a bordure Argent');
    expect(blazon(nd({ v: 1, field: plain('azure'), ordinary: { type: 'bend-sinister', tincture: 'or' } }))).toBe('Azure, a bend sinister Or');
  });
});

// ── Normalisation / structure ───────────────────────────────────────────────

describe('normalise: shape and structure', () => {
  it('rejects malformed input with shape issues', () => {
    expect(issuesOf(null)[0].code).toBe('shape');
    expect(issuesOf({ v: 2, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } })[0].message).toMatch(/version/);
    expect(issuesOf({ v: 1, field: plain('azure'), extra: 1 })[0].message).toMatch(/Unknown design key "extra"/);
    expect(issuesOf({ v: 1, field: plain('teal') })[0].layer).toBe('field');
    expect(issuesOf({ v: 1, field: plain('azure'), ordinary: { type: 'bendlet', tincture: 'or' } })[0].layer).toBe('ordinary');
    expect(issuesOf({ v: 1, field: plain('azure'), charges: { charge: 'griffin', count: 1, placement: 'field', tincture: 'or' } })[0].message).toBe('Unknown charge.');
    expect(issuesOf({ v: 1, field: plain('azure'), charges: { charge: 'rose', count: 7, placement: 'field', tincture: 'or' } })[0].message).toMatch(/1 to 6/);
    expect(issuesOf({ v: 1, field: plain('azure'), charges: { charge: 'rose', count: 1, placement: 'field', tincture: 'or', colour: 'x' } })[0].message).toMatch(/Unknown charge key/);
    expect(issuesOf({ v: 1, kind: 'badge', field: plain('azure') })[0].message).toMatch(/badges/);
  });

  it('accepts the reserved kind "arms" and drops it', () => {
    const r = normalise({ v: 1, kind: 'arms', field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.design)).toEqual(['v', 'field', 'ordinary', 'charges']);
  });

  it('rejects a posture on a posture-less charge and a posture the charge is not drawn in', () => {
    expect(issuesOf({ v: 1, field: plain('azure'), charges: { charge: 'rose', count: 1, placement: 'field', posture: 'rampant', tincture: 'or' } })[0].message)
      .toBe('A rose has no posture.');
    expect(issuesOf({ v: 1, field: plain('azure'), charges: { charge: 'boar', count: 1, placement: 'field', posture: 'rampant', tincture: 'or' } })[0].message)
      .toMatch(/boar can't be rampant/);
  });

  it('enforces the structural tables', () => {
    const msg = (design: unknown) => issuesOf(design).map((i) => i.message);
    const f = (ordinary: Ordinary | null, placement: Placement, count: number, arrangement?: string) =>
      msg({ v: 1, field: plain('azure'), ordinary, charges: { charge: 'mullet', count, placement, tincture: placement === 'ordinary' ? 'gules' : 'or', ...(arrangement ? { arrangement } : {}) } });
    expect(f(null, 'ordinary', 1)).toEqual(['Add an ordinary first — charges can only sit on an ordinary once there is one.']);
    expect(f({ type: 'bordure', tincture: 'argent' }, 'ordinary', 1)).toEqual(["Charges can't sit on a bordure in this builder; put them on the field within it."]);
    expect(f({ type: 'bend', tincture: 'argent' }, 'ordinary', 4)).toEqual(['A bend can carry a single charge, two or three, not four.']);
    expect(f({ type: 'cross', tincture: 'argent' }, 'ordinary', 3)[0]).toMatch(/^A cross can carry a single charge or five/);
    expect(f({ type: 'bend', tincture: 'argent' }, 'field', 1)).toEqual(["A single charge can't be set between a bend — use two, or place it on the bend."]);
    expect(f({ type: 'chevron', tincture: 'argent' }, 'field', 2)).toEqual(['A chevron is set between exactly three charges, not two.']);
    expect(f({ type: 'chief', tincture: 'argent' }, 'field', 4)).toEqual(['Under a chief there is room for at most three charges, not four.']);
    expect(f({ type: 'chief', tincture: 'argent' }, 'field', 3, 'in-pale')).toEqual(['Under a chief, three mullets can only be arranged two and one or in fess.']);
    expect(f(null, 'field', 4, 'in-pale')).toEqual(['Four mullets can be arranged two and two, in cross — not in pale.']);
    expect(f({ type: 'bordure', tincture: 'argent' }, 'field', 5, 'in-cross')).toEqual([]);
  });

  it('chief on per fess touches only the upper part', () => {
    expect(issuesOf({ v: 1, field: div('per-fess', 'azure', 'or'), ordinary: { type: 'chief', tincture: 'argent' } })).toEqual([]);
    expect(issuesOf({ v: 1, field: div('per-chevron', 'or', 'azure'), ordinary: { type: 'chief', tincture: 'argent' } }).map((i) => i.message))
      .toEqual(['Argent chief lies on Or: metal on metal']);
    // On any other division the chief touches both parts.
    expect(issuesOf({ v: 1, field: div('per-pale', 'azure', 'or'), ordinary: { type: 'chief', tincture: 'argent' } }).map((i) => i.message))
      .toEqual([]);
    expect(issuesOf({ v: 1, field: div('per-pale', 'or', 'argent'), ordinary: { type: 'chief', tincture: 'argent' } }).map((i) => i.message))
      .toEqual(['Argent chief lies on the Argent part of the field: same tincture']);
  });

  it('charges between / under a chief may share the ordinary tincture; charges on it may not', () => {
    expect(issuesOf({ v: 1, field: plain('vert'), ordinary: { type: 'chevron', tincture: 'or' }, charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'or' } })).toEqual([]);
    expect(issuesOf({ v: 1, field: plain('vert'), ordinary: { type: 'chevron', tincture: 'or' }, charges: { charge: 'rose', count: 3, placement: 'ordinary', tincture: 'argent' } }).map((i) => i.message))
      .toEqual(['Argent roses on Or chevron: metal on metal']);
  });

  it('every structurally legal combination has exactly `count` slots', () => {
    const ordinaries: Array<Ordinary | null> = [null, ...ORDINARY_TYPES.map((type) => ({ type, tincture: 'or' as const }))];
    let legal = 0;
    for (const o of ordinaries) for (const placement of ['field', 'ordinary'] as Placement[]) for (const count of COUNTS) for (const a of ARRANGEMENTS) {
      if (chargeStructureIssue(o, placement, count, a)) continue;
      // Only arrangements normalisation can produce: fixed contexts always resolve to single/forced.
      const d = resolve({ v: 1, field: plain('azure'), ordinary: o, charges: { charge: 'mullet', count, placement, arrangement: a, tincture: 'argent' } });
      if (!d.ok || d.design.charges!.arrangement !== a) continue;
      legal++;
      for (const shape of FIELD_SHAPES) expect(slotsFor(o, placement, count, a, shape), shape).toHaveLength(count);
    }
    expect(legal).toBeGreaterThan(40);
  });
});

// ── sample registry fixture ──────────────────────────────────────────────

type SampleEntry = (typeof sample.entries)[number];

describe('sample registry fixture', () => {
  it('uses the sample registry identity', () => {
    expect(sample.schema).toBe('heraldry-builder/registry-sample@1');
    expect(sample.registry).toEqual({ id: 'sample', name: 'Sample armorial (offline demo)' });
    expect(sample.entries).toHaveLength(20);
  });

  for (const e of sample.entries as SampleEntry[]) {
    it(`${e.id} normalises to itself, passes the rule of tincture and matches signature + blazon`, () => {
      const r = normalise(e.design);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(JSON.stringify(r.design)).toBe(JSON.stringify(e.design));
      expect(signature(r.design)).toBe(e.signature);
      expect(blazon(r.design)).toBe(e.blazon);
      expect(e.displayName.length).toBeGreaterThanOrEqual(1);
      expect(e.displayName.length).toBeLessThanOrEqual(60);
      expect(cleanDiscord(e.contact.discord)).toEqual({ ok: true, value: e.contact.discord });
      expect(isFieldShape(e.shape)).toBe(true);
    });
  }

  it('is byte-exact with generator output', () => {
    const regenerated = {
      schema: sample.schema,
      registry: sample.registry,
      entries: sample.entries.map((e) => {
        const d = nd(e.design);
        return { id: e.id, displayName: e.displayName, contact: e.contact, registeredAt: e.registeredAt, shape: e.shape, design: d, signature: signature(d), blazon: blazon(d) };
      }),
    };
    expect(JSON.stringify(regenerated, null, 2) + '\n').toBe(sampleRaw);
  });

  it('is in registration order with unique ids and signatures', () => {
    const times = sample.entries.map((e) => e.registeredAt);
    expect([...times].sort()).toEqual(times);
    expect(new Set(sample.entries.map((e) => e.id)).size).toBe(20);
    expect(new Set(sample.entries.map((e) => e.signature)).size).toBe(20);
  });

  it('all 190 pairs are different enough', () => {
    const ds = sample.entries.map((e) => nd(e.design));
    let pairs = 0;
    for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
      pairs++;
      expect(areDistinct(ds[i], ds[j]), `${sample.entries[i].id} vs ${sample.entries[j].id}`).toBe(true);
    }
    expect(pairs).toBe(190);
  });

  it('each entry is unique against all the others', () => {
    const reg = sample.entries.map((e) => ({ id: e.id, signature: e.signature, design: nd(e.design) }));
    for (const e of reg) expect(checkUnique(e.design, e.signature, reg, e.id).kind).toBe('ok');
  });

  it('search sanity checks', () => {
    const search = (args: Partial<SearchFilters>) => {
      const t = filtersToTags(filters(args));
      if (!t.ok) throw new Error(t.message);
      return sample.entries.filter((e) => matchesTags(nd(e.design), t.tags)).map((e) => e.id);
    };
    expect(search({ ordinary: 'bordure' })).toEqual(['demo-004', 'demo-014', 'demo-020']);
    expect(search({ chargeTincture: 'counterchanged' })).toEqual(['demo-018', 'demo-019', 'demo-020']);
    expect(search({ chargeTincture: 'azure' })).toEqual(['demo-013', 'demo-014']);
    expect(search({ charge: 'wolf', posture: 'passant' })).toEqual(['demo-003', 'demo-004']);
    expect(search({ ordinary: 'bend' })).toEqual(['demo-001', 'demo-002']);
    expect(search({ division: 'plain', ordinary: 'bend' })).toEqual(['demo-001', 'demo-002']);
    expect(search({ division: 'quarterly' })).toEqual(['demo-007']);
    expect(search({ charge: 'dragon', ordinary: 'bordure' })).toEqual([]);
    const modern = sample.entries.filter((e) => matchesTags(nd(e.design), ['charge-category:modern'])).map((e) => e.id);
    expect(modern).toEqual(['demo-012', 'demo-013', 'demo-015']);
  });
});

// ── worked uniqueness examples ───────────────────────────────────────

describe('uniqueness worked examples', () => {
  const az = plain('azure');
  const W: Array<[string, unknown, unknown, 'ok' | 'duplicate' | 'too-close', string[]]> = [
    ['W1', { v: 1, field: az, charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'passant', tincture: 'argent' } },
      { v: 1, field: az, charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'statant', tincture: 'argent' } }, 'too-close', ['charge-posture']],
    ['W2', { v: 1, field: plain('vert'), charges: { charge: 'mullet', count: 4, placement: 'field', tincture: 'or' } },
      { v: 1, field: plain('vert'), charges: { charge: 'mullet', count: 5, placement: 'field', tincture: 'or' } }, 'too-close', ['charge-count']],
    ['W3', { v: 1, field: plain('gules'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'argent' } },
      { v: 1, field: plain('gules'), charges: { charge: 'mullet', count: 3, placement: 'field', arrangement: 'two-and-one', tincture: 'argent' } }, 'duplicate', []],
    ['W4', { v: 1, field: plain('or'), charges: { charge: 'dragon', count: 1, placement: 'field', tincture: 'gules' } },
      { v: 1, field: plain('or'), charges: { charge: 'dragon', count: 1, placement: 'field', posture: 'rampant', tincture: 'gules' } }, 'duplicate', []],
    ['W5', { v: 1, field: az, charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'passant', tincture: 'argent' } },
      { v: 1, field: az, charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'rampant', tincture: 'argent' } }, 'ok', ['charge-posture']],
    ['W6', { v: 1, field: az, ordinary: { type: 'bend', tincture: 'or' } },
      { v: 1, field: az, ordinary: { type: 'bend-sinister', tincture: 'or' } }, 'too-close', ['ordinary-type']],
    ['W7', { v: 1, field: div('per-pale', 'azure', 'or') }, { v: 1, field: div('per-pale', 'or', 'azure') }, 'too-close', ['field-tincture']],
    ['W8', { v: 1, field: plain('vert'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'or' } },
      { v: 1, field: plain('vert'), charges: { charge: 'mullet', count: 3, placement: 'field', arrangement: 'in-fess', tincture: 'or' } }, 'ok', ['charge-arrangement']],
    ['W9', { v: 1, field: az, charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'or' } },
      { v: 1, field: az, charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'argent' } }, 'ok', ['charge-tincture']],
    ['W10', { v: 1, field: az, ordinary: { type: 'bend', tincture: 'or' } },
      { v: 1, field: az, ordinary: { type: 'bend', tincture: 'or' }, charges: { charge: 'unicorn', count: 3, placement: 'ordinary', tincture: 'vert' } }, 'ok', ['charges-presence']],
    ['W11', { v: 1, field: plain('vert'), charges: { charge: 'mullet', count: 5, placement: 'field', tincture: 'or' } },
      { v: 1, field: plain('vert'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'or' } }, 'ok', ['charge-count', 'charge-arrangement']],
    // NB the "new" W12 design (Argent roses on an Or chevron) breaks the rule of tincture; only its difference is tested.
    ['W12', { v: 1, field: az, ordinary: { type: 'chevron', tincture: 'or' }, charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'argent' } },
      { v: 1, field: az, ordinary: { type: 'chevron', tincture: 'or' }, charges: { charge: 'rose', count: 3, placement: 'ordinary', tincture: 'argent' } }, 'ok', ['charge-placement']],
  ];
  for (const [id, existing, fresh, verdict, attrs] of W) {
    it(`${id}: ${verdict}`, () => {
      const e = nd(existing), n = nd(fresh);
      const v = checkUnique(n, signature(n), [{ id: 'existing', signature: signature(e), design: e }]);
      expect(v.kind).toBe(verdict);
      expect(differences(n, e).map((d) => d.attr)).toEqual(attrs);
      if (v.kind === 'too-close') expect(v.differences.map((d) => d.attr)).toEqual(attrs);
    });
  }

  it('explains differences in words', () => {
    const a = nd({ v: 1, field: plain('sable'), ordinary: { type: 'bordure', tincture: 'argent' }, charges: { charge: 'wolf', count: 1, placement: 'field', posture: 'statant', tincture: 'or' } });
    const demo004 = nd(sample.entries[3].design);
    const v = checkUnique(a, signature(a), sample.entries.map((e) => ({ id: e.id, signature: e.signature, design: nd(e.design) })));
    expect(v).toEqual({ kind: 'too-close', of: 'demo-004', differences: [{ attr: 'charge-posture', weight: 'minor', reason: 'similar-postures' }] });
    expect(explainDifferences(a, demo004)).toEqual([{
      attr: 'charge-posture', weight: 'minor', text: 'posture (statant ↔ passant)',
      why: "Standing (statant) and walking (passant) look almost the same — that's only half a difference.",
    }]);
  });

  it('the Azure-bend-Or journey design is a duplicate of demo-001', () => {
    const a = nd({ v: 1, field: plain('azure'), ordinary: { type: 'bend', tincture: 'or' } });
    const v = checkUnique(a, signature(a), sample.entries.map((e) => ({ id: e.id, signature: e.signature, design: nd(e.design) })));
    expect(v).toEqual({ kind: 'duplicate', of: 'demo-001' });
  });

  it('an arrangement placed by the ordinary is not compared on its own', () => {
    // Two roses between a fess (forced) vs two roses in fess under a chief: the ordinary type decides.
    const a = nd({ v: 1, field: plain('azure'), ordinary: { type: 'fess', tincture: 'argent' }, charges: { charge: 'rose', count: 2, placement: 'field', tincture: 'or' } });
    const b = nd({ v: 1, field: plain('azure'), ordinary: { type: 'chief', tincture: 'argent' }, charges: { charge: 'rose', count: 2, placement: 'field', tincture: 'or' } });
    expect(differences(a, b)).toEqual([{ attr: 'ordinary-type', weight: 'clear' }]);
  });
});

// ── Tags ────────────────────────────────────────────────────────────────────

describe('tags', () => {
  it('derives the full vocabulary for the unicorns-on-a-bend design', () => {
    expect(deriveTags(nd(V[1].design))).toEqual([
      'field:plain', 'field-tincture:azure', 'ordinary:bend', 'ordinary-tincture:or',
      'charge:unicorn', 'charge-category:monster', 'charge-tincture:vert', 'charge-count:3',
      'posture:rampant', 'posture-group:G1', 'arrangement:forced', 'placement:on-ordinary',
      'tincture:azure', 'tincture:or', 'tincture:vert', 'readability:busy',
    ]);
  });

  it('marks between placement, divisions and de-duplicates tinctures', () => {
    const t = deriveTags(nd(V.find((v) => v.id === 'V18')!.design));
    expect(t).toContain('division:per-pale');
    expect(t).toContain('placement:between');
    expect(t).toContain('posture-group:G2');
    expect(t).toContain('readability:busy');
    expect(t.filter((x) => x.startsWith('tincture:'))).toEqual(['tincture:azure', 'tincture:vert', 'tincture:argent', 'tincture:or']);
    const chief = deriveTags(nd(V.find((v) => v.id === 'V11')!.design));
    expect(chief.some((x) => x.startsWith('placement:'))).toBe(false);
    expect(chief).not.toContain('posture-group:G1');
  });

  it('validates filter values', () => {
    expect(filtersToTags(filters({ tincture: 'teal' }))).toEqual({ ok: false, param: 'tincture', message: 'Unknown tincture "teal".' });
    expect(filtersToTags(filters({ division: 'plain', charge: '' }))).toEqual({ ok: true, tags: ['field:plain'] });
    expect(filtersToTags(filters({ chargeTincture: 'or', division: 'per-bend' }))).toEqual({ ok: true, tags: ['charge-tincture:or', 'division:per-bend'] });
  });
});

// ── Options helper ──────────────────────────────────────────────────────────

function byValue<T>(choices: Choice<T>[], v: T): Choice<T> {
  const c = choices.find((x) => x.value === v);
  if (!c) throw new Error(`no choice ${String(v)}`);
  return c;
}

describe('options helper', () => {
  const gulesLion = nd({ v: 1, field: plain('gules'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'or' } });

  it('blocks colour-on-colour charge tinctures with a reason, allows metals', () => {
    const ch = chargeTinctureChoices(gulesLion);
    expect(byValue(ch, 'or').allowed).toBe(true);
    expect(byValue(ch, 'argent').allowed).toBe(true);
    const az = byValue(ch, 'azure');
    expect(az.allowed).toBe(false);
    expect(az.reason).toBe('Azure on Gules would be colour on colour. Colours must sit on metals (Or, Argent or Celestine).');
    expect(byValue(ch, 'gules').reason).toBe("Gules on Gules would vanish — the lion can't share the tincture it lies on.");
  });

  it('names the slots when only some of them clash', () => {
    const d = nd(V.find((v) => v.id === 'V9')!.design);
    const gu = byValue(chargeTinctureChoices(d), 'gules');
    expect(gu.allowed).toBe(false);
    expect(gu.reason).toBe('The two upper mullets lie on Azure. Gules on Azure would be colour on colour. Colours must sit on metals (Or, Argent or Celestine).');
    // Upper mullets on Azure need a metal, the lower one on Or needs a colour: no single tincture
    // fits, but counterchanged gives each the opposite of what it lies on.
    expect(chargeTinctureChoices(d).filter((c) => c.allowed).map((c) => c.value)).toEqual(['counterchanged']);
    expect(byValue(chargeTinctureChoices(d), 'argent').reason)
      .toBe('The lower mullet lies on Or. Argent on Or would be metal on metal. Metals must sit on colours (Gules, Azure, Vert, Sable or Purpure).');
    expect(byValue(chargeTinctureChoices(d), 'or').reason)
      .toBe("Or on Or would vanish — the lower mullet can't share the tincture it lies on.");
  });

  it('explains straddling a two-colour field', () => {
    const d = nd(V.find((v) => v.id === 'V8')!.design);
    expect(byValue(chargeTinctureChoices(d), 'gules').reason)
      .toBe('The wolf lies across Azure and Vert — both colours — so it must be a metal (Or, Argent or Celestine).');
  });

  it('blocks ordinary tinctures against the field and charge tinctures against the ordinary they sit on', () => {
    const d = nd(V[1].design); // Azure, on a bend Or three unicorns Vert
    expect(byValue(ordinaryTinctureChoices(d), 'vert').reason).toBe('Vert on Azure would be colour on colour. Colours must sit on metals (Or, Argent or Celestine).');
    expect(byValue(ordinaryTinctureChoices(d), 'argent').allowed).toBe(true);
    expect(byValue(chargeTinctureChoices(d), 'argent').reason)
      .toBe('Argent on Or would be metal on metal. Metals must sit on colours (Gules, Azure, Vert, Sable or Purpure).');
    expect(byValue(chargeTinctureChoices(d), 'sable').allowed).toBe(true);
  });

  it('field halves block only each other', () => {
    const d = nd({ v: 1, field: div('per-pale', 'azure', 'vert') });
    const first = fieldTinctureChoices(d, 0);
    expect(byValue(first, 'vert').allowed).toBe(false);
    expect(byValue(first, 'vert').reason).toMatch(/two different tinctures/);
    expect(first.filter((c) => c.allowed)).toHaveLength(7);
    expect(fieldTinctureChoices(gulesLion).every((c) => c.allowed)).toBe(true);
  });

  it('blocks structurally illegal counts, placements and arrangements with reasons', () => {
    const onBend = nd(V[1].design);
    const counts = countChoices(onBend);
    expect(counts.filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2, 3]);
    expect(byValue(counts, 4 as Count).reason).toBe('A bend can carry a single charge, two or three, not four.');

    const between = nd(V.find((v) => v.id === 'V10')!.design);
    expect(countChoices(between).filter((c) => c.allowed).map((c) => c.value)).toEqual([3]);
    expect(byValue(placementChoices(between), 'ordinary').allowed).toBe(true);

    const chief = nd(V.find((v) => v.id === 'V11')!.design);
    expect(byValue(countChoices(chief), 4 as Count).reason).toBe('Under a chief there is room for at most three charges, not four.');
    const arr = arrangementChoices(chief);
    expect(arr.mode).toBe('choose');
    expect(arr.choices.filter((c) => c.allowed).map((c) => c.value)).toEqual(['two-and-one', 'in-fess']);
    expect(byValue(arr.choices, 'in-pale').reason).toBe('Under a chief, three mullets can only be arranged two and one or in fess.');

    expect(byValue(placementChoices(gulesLion), 'ordinary').reason).toBe('Add an ordinary first — charges can only sit on an ordinary once there is one.');
    expect(arrangementChoices(onBend).mode).toBe('forced');
    expect(arrangementChoices(gulesLion).mode).toBe('single');
  });

  it('lists quadruped postures, blocking the ones a charge is not drawn in', () => {
    const boar = nd({ v: 1, field: plain('or'), charges: { charge: 'boar', count: 1, placement: 'field', tincture: 'sable' } });
    const p = postureChoices(boar);
    expect(p.map((c) => c.value)).toEqual(['rampant', 'passant', 'statant', 'sejant']);
    expect(p.filter((c) => c.allowed).map((c) => c.value)).toEqual(['passant']);
    expect(byValue(p, 'rampant').reason).toBe('The boar is only drawn passant in this builder.');
    const fish = nd({ v: 1, field: plain('azure'), charges: { charge: 'fish', count: 1, placement: 'field', tincture: 'argent' } });
    expect(postureChoices(fish).map((c) => c.value)).toEqual(['naiant', 'haurient']);
    const rose = nd({ v: 1, field: plain('azure'), charges: { charge: 'rose', count: 1, placement: 'field', tincture: 'argent' } });
    expect(postureChoices(rose)).toEqual([]);
  });

  it('every blocked choice carries a reason, every allowed one none (broad sweep)', () => {
    const fields = [plain('gules'), plain('or'), div('per-fess', 'azure', 'or'), div('per-pale', 'azure', 'vert'), div('quarterly', 'argent', 'or')];
    const ords: Array<Ordinary | null> = [null, { type: 'chief', tincture: 'argent' }, { type: 'bend', tincture: 'or' }, { type: 'cross', tincture: 'sable' }, { type: 'bordure', tincture: 'vert' }];
    for (const field of fields) for (const ordinary of ords) for (const count of [1, 3, 5] as Count[]) for (const placement of ['field', 'ordinary'] as Placement[]) {
      const d = nd({ v: 1, field, ordinary, charges: { charge: 'lion', count, placement, tincture: 'or' } });
      const all: Choice<unknown>[] = [
        ...fieldTinctureChoices(d, 0), ...fieldTinctureChoices(d, 1), ...ordinaryTinctureChoices(d), ...chargeTinctureChoices(d),
        ...countChoices(d), ...placementChoices(d), ...arrangementChoices(d).choices, ...postureChoices(d),
      ];
      for (const c of all) {
        if (c.allowed) expect(c.reason).toBeUndefined();
        else expect(c.reason && c.reason.length > 10).toBe(true);
      }
    }
  });

  it('an allowed charge tincture never produces a charge tincture issue', () => {
    for (const field of [div('per-fess', 'azure', 'or'), div('per-bend', 'gules', 'argent'), div('per-saltire', 'vert', 'sable'), div('per-chevron', 'or', 'purpure')]) {
      for (const arrangement of ['two-and-one', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister']) {
        const d = nd({ v: 1, field, charges: { charge: 'mullet', count: 3, placement: 'field', arrangement, tincture: 'or' } });
        for (const c of chargeTinctureChoices(d)) {
          const issues = validate({ ...d, charges: { ...d.charges!, tincture: c.value } }).filter((i) => i.layer === 'charges');
          expect(issues.length === 0).toBe(c.allowed);
        }
      }
    }
  });

  it('suggests a one-click tincture fix after a lower-layer change', () => {
    // Gules field + Or lion, then the field is changed to Or (journey "tincture-violation").
    const broken = nd({ v: 1, field: plain('or'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'or' } });
    expect(validate(broken).map((i) => i.message)).toEqual(['Or lion on Or field: same tincture']);
    const fix = suggestTinctureFix(broken)!;
    expect(fix).toMatchObject({
      layer: 'charges', tincture: 'gules', label: 'Switch the lion to Gules', alternatives: ['gules', 'azure', 'vert', 'sable', 'purpure'],
    });
    expect(validate(fix.design)).toEqual([]);
    expect(suggestTinctureFix(gulesLion)).toBeNull();
  });

  it('fitCharges repairs structure after an ordinary change', () => {
    // Three roses between a chevron, chevron swapped for a cross: between a cross needs four.
    const d = nd({ v: 1, field: plain('vert'), ordinary: { type: 'cross', tincture: 'or' }, charges: { charge: 'rose', count: 3, placement: 'field', tincture: 'argent' } });
    expect(validate(d).map((i) => i.code)).toEqual(['structure']);
    const fixed = fitCharges(d);
    expect(fixed.charges!.count).toBe(4);
    expect(validate(fixed)).toEqual([]);
    // Charges on an ordinary that has been removed fall back to the field.
    const noOrd = fitCharges({ ...nd(V[1].design), ordinary: null });
    expect(noOrd.charges!.placement).toBe('field');
    expect(noOrd.charges!.arrangement).toBe('two-and-one');
  });
});

// ── Geometry / art ──────────────────────────────────────────────────────────

describe('geometry and art', () => {
  it('slot contacts follow the five-point probe', () => {
    expect(chargeSlotContacts(nd(V.find((v) => v.id === 'V7')!.design))).toEqual([['azure', 'vert']]);
    expect(chargeSlotContacts(nd(V.find((v) => v.id === 'V9')!.design))).toEqual([['azure'], ['azure'], ['or']]);
    expect(chargeSlotContacts(nd(V.find((v) => v.id === 'V13')!.design))).toEqual([['sable', 'gules']]);
    expect(chargeSlots(nd(V.find((v) => v.id === 'V12')!.design))).toEqual([{ x: 50, y: 54.14, size: 77.4 }]);
  });

  it('has a path for every charge and allowed posture', () => {
    for (const id of CHARGE_IDS) {
      const meta = CHARGES[id];
      expect(CHARGE_ART[id]).toBeDefined();
      for (const p of meta.postures ?? [null]) expect(chargePath(id, p)).toMatch(/^M/);
    }
    expect(CHARGE_IDS).toHaveLength(28);
    expect(TINCTURES).toHaveLength(8);
    // 40 (charge, posture) paths.
    expect(CHARGE_IDS.reduce((n, id) => n + (CHARGES[id].postures?.length ?? 1), 0)).toBe(40);
  });

  it('draws every path as M/L/Z polygons centred in the box with an ~86-unit long axis', () => {
    for (const id of CHARGE_IDS) {
      for (const [posture, d] of Object.entries(CHARGE_ART[id])) {
        expect(d, `${id} ${posture}`).toMatch(/^(M[\d. -]+L[\d. -]+Z)+$/);
        const n = d!.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
        const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
        const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
        expect(Math.max(w, h), `${id} ${posture} long axis`).toBeGreaterThanOrEqual(84);
        expect(Math.max(w, h), `${id} ${posture} long axis`).toBeLessThanOrEqual(88);
        expect(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - 50), `${id} ${posture} centre x`).toBeLessThan(1);
        expect(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2 - 50), `${id} ${posture} centre y`).toBeLessThan(1);
      }
    }
  });

  it('a design typed as Design round-trips through normalise', () => {
    const d: Design = { v: 1, field: { kind: 'plain', tincture: 'azure' }, ordinary: { type: 'bend', tincture: 'or' } };
    const r = normalise(d);
    expect(r.ok && normalise(r.design).ok).toBe(true);
  });
});

// ── Retired charges ─────────────────────────────────────────────────────────

describe('retired charges', () => {
  for (const id of ['laptop', 'paintbrush']) {
    const design = { v: 1, field: plain('purpure'), charges: { charge: id, count: 1, placement: 'field', tincture: 'argent' } };

    it(`${id} is not a charge: resolve and normalise reject it`, () => {
      expect(isChargeId(id)).toBe(false);
      const r = resolve(design);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.errors).toEqual([expect.objectContaining({ code: 'shape', layer: 'charges' })]);
      expect(normalise(design).ok).toBe(false);
    });

    it(`${id} is not a search filter`, () => {
      expect(filtersToTags(filters({ charge: id })).ok).toBe(false);
    });
  }
});

// ── Posture wording ─────────────────────────────────────────────────────────

describe('charge-specific posture words', () => {
  const hare = { v: 1, field: plain('vert'), charges: { charge: 'hare', count: 1, placement: 'field', tincture: 'or', posture: 'passant' } };

  it('a hare courant is blazoned courant and glossed running', () => {
    expect(postureTerm('hare', 'passant')).toBe('courant');
    expect(postureGloss('hare', 'passant')).toBe('running');
    expect(blazon(nd(hare))).toBe('Vert, a hare courant Or');
    expect(gloss(nd(hare))).toBe('A green shield with a gold hare running.');
  });

  it('other charges fall back to the shared posture words', () => {
    expect(postureTerm('wolf', 'passant')).toBe('passant');
    expect(postureGloss('wolf', 'passant')).toBe('walking');
    expect(postureTerm('stag', 'passant')).toBe('trippant');
    expect(postureGloss('stag', 'passant')).toBe('walking');
    expect(postureGloss('eagle', 'displayed')).toBeNull();
  });

  it('difference text names postures by their blazon term', () => {
    const stag = (posture: string) => nd({ v: 1, field: plain('vert'), charges: { charge: 'stag', count: 1, placement: 'field', tincture: 'or', posture } });
    expect(explainDifferences(stag('statant'), stag('passant')).map((n) => n.text)).toEqual(['posture (statant ↔ trippant)']);
    const hareSejant = nd({ ...hare, charges: { ...hare.charges, posture: 'sejant' } });
    expect(explainDifferences(nd(hare), hareSejant).map((n) => n.text)).toEqual(['posture (courant ↔ sejant)']);
  });
});

describe('gloss wording', () => {
  it('a fish haurient is upright, head up', () => {
    const fish = nd({ v: 1, field: plain('azure'), charges: { charge: 'fish', count: 1, placement: 'field', tincture: 'argent', posture: 'haurient' } });
    expect(gloss(fish)).toBe('A blue shield with a white fish upright, head up.');
  });

  it('charges between an ordinary are placed around it', () => {
    const between = (type: string, ordinaryTincture: string, count: number) => gloss(nd({
      v: 1, field: plain('vert'), ordinary: { type, tincture: ordinaryTincture }, charges: { charge: 'rose', count, placement: 'field', tincture: 'argent' },
    }));
    expect(between('pale', 'or', 2)).toBe('A green shield with a gold vertical band down the middle and a white rose on each side.');
    expect(between('fess', 'or', 2)).toBe('A green shield with a gold horizontal band across the middle and two white roses, one above and one below.');
    expect(between('fess', 'or', 3)).toBe('A green shield with a gold horizontal band across the middle and three white roses, two above and one below.');
    expect(between('cross', 'or', 4)).toBe('A green shield with a gold cross and a white rose in each quarter.');
    expect(between('saltire', 'or', 4)).toBe('A green shield with a gold X-shaped cross and four white roses, one above, one below and one on each side.');
    expect(between('pile', 'or', 2)).toBe('A green shield with a gold downward-pointing wedge from the top and a white rose on each side.');
    // Every "between" slot table has its placement words.
    expect(Object.keys(BETWEEN_GLOSS).sort()).toEqual(Object.keys(BETWEEN_SLOTS).sort());
  });
});
