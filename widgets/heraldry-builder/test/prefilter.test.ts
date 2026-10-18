// The too-close pre-filter (candidateKey) must never change a verdict: checkUnique over only the entries
// whose key may conflict with the candidate's equals checkUnique over the whole registry — including which entry an ok design
// only passed by two distinct changes. That holds because a change of any part of the key is always a
// substantial change on its own, which is proven here too. A fieldless badge has no partition, which matches every partition.
import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, BUILDER_DIVISIONS, BUILDER_ORDINARIES, ORDINARY_KIND, candidateKey, checkUnique, differences, isClear, keysMayConflict, primaryGroups, signature,
  type Design, type RegistryEntryLike, type Verdict,
} from '../src/lib/heraldry';
import { generatedChargeAttributeDesigns, generatedDesigns } from './design-generator';
import { rotatesIn, sampleSeed } from './rotation';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const sameKey = (a: Design, b: Design) => keysMayConflict(candidateKey(a), candidateKey(b));

function registryFrom(designs: Design[]): RegistryEntryLike[] {
  const bySignature = new Map<string, RegistryEntryLike>();
  for (const design of designs) {
    const sig = signature(design);
    if (!bySignature.has(sig)) bySignature.set(sig, { id: `e${bySignature.size}`, signature: sig, design });
  }
  return [...bySignature.values()];
}

/** The same groups without a field (the generator builds arms; badges are built directly, bypassing normalise). */
const asBadge = (d: Design): Design => ({ v: 2, kind: 'badge', field: null, groups: d.groups });

/** Arms followed by the badges of every `step`th arms design that has a primary group. */
const withBadges = (designs: Design[], step: number): Design[] => [
  ...designs,
  ...designs.filter((d, i) => i % step === 0 && primaryGroups(d).length > 0).map(asBadge),
];

/** The verdict's kind, telling apart an ok that only passed an entry on two distinct changes. */
const outcome = (v: Verdict) => (v.kind === 'ok' && v.closest ? 'ok-on-two-dcs' : v.kind);

describe('too-close pre-filter', () => {
  const registry = registryFrom(withBadges(generatedDesigns(1, 120), 3));
  const probes = withBadges(generatedDesigns(10_000, 1500), 5);

  it('gives the same verdict as scanning the whole registry', () => {
    const outcomes = new Set<string>();
    for (const probe of probes) {
      const sig = signature(probe);
      const full = checkUnique(probe, sig, registry);
      const candidates = registry.filter((e) => sameKey(probe, e.design));
      expect(checkUnique(probe, sig, candidates)).toEqual(full);
      outcomes.add(outcome(full));
    }
    // The generator must exercise every verdict, or the comparison proves nothing.
    expect([...outcomes].sort()).toEqual(['duplicate', 'ok', 'ok-on-two-dcs', 'too-close']);
  }, 30_000);

  it('returns every entry that is not clear of the probe', () => {
    for (const probe of probes.slice(0, 300)) {
      const keyed = new Set(registry.filter((e) => sameKey(probe, e.design)).map((e) => e.id));
      for (const e of registry) {
        if (!isClear(differences(probe, e.design))) expect(keyed.has(e.id), `${signature(probe)} vs ${signature(e.design)}`).toBe(true);
      }
    }
  }, 30_000);

  // Seeded sampling: each probe edits a rotating twelfth of the entries (`rotatesIn`), so each entry is edited against about 8 probes.
  it('gives the same verdict when an entry is edited (itself excluded)', () => {
    for (const [ri, edited] of registry.entries()) {
      for (const probe of probes.slice(0, 100).filter((_, pi) => rotatesIn(`edited|${ri}|${pi}`, 1 / 12))) {
        const sig = signature(probe);
        const full = checkUnique(probe, sig, registry, edited.id);
        const candidates = registry.filter((e) => sameKey(probe, e.design));
        expect(checkUnique(probe, sig, candidates, edited.id)).toEqual(full);
      }
    }
  }, 30_000);

  // Seeded sampling: a rotating twelfth of the pairs of charge attribute designs (facings and pairs), each way round.
  it('keys only on changes that are substantial on their own (charge attribute designs: facings and pairs)', () => {
    const designs = generatedChargeAttributeDesigns(30_000, 60);
    let compared = 0;
    for (const [i, a] of designs.entries()) for (const [j, b] of designs.entries()) {
      if (!rotatesIn(`attribute|${i}|${j}`, 1 / 12)) continue;
      compared++;
      if (!sameKey(a, b)) expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
    expect(compared, `sample seed ${sampleSeed()}`).toBeGreaterThan(150);
  });

  // Seeded sampling: a rotating third of the pairs (`rotatesIn`).
  it('keys only on changes that are substantial on their own (generated pairs)', () => {
    const designs = withBadges(generatedDesigns(20_000, 400), 4);
    let keyed = 0;
    for (const [i, a] of designs.entries()) for (const [j, b] of designs.entries()) {
      if (!rotatesIn(`pair|${i}|${j}`, 1 / 3) || sameKey(a, b)) continue;
      keyed++;
      expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
    expect(keyed, `sample seed ${sampleSeed()}`).toBeGreaterThan(5_000);
  }, 30_000);

  it('keys only on changes that are substantial on their own (every division, ordinary and charge)', () => {
    const field = (division: string | null) => (division ? div(division, 'or', 'azure') : 'azure');
    const fields = [null, ...BUILDER_DIVISIONS].map((d) => nd(arms(field(d), group(ordinary('pale'), 'gules'))));
    const ordinaries = [null, ...BUILDER_ORDINARIES.filter((t) => ORDINARY_KIND[t] === 'central')]
      .map((type) => nd(arms(field(null), ...(type ? [group(ordinary(type), 'or')] : [group(ordinary('chief'), 'or')]))));
    const charges = [null, ...CHARGE_IDS.flatMap((id) => (CHARGES[id].postures ?? [null]).map((posture) => [id, posture] as const))]
      .map((c) => nd(arms(field(null), ...(c ? [group(charge(c[0], c[1] ? { posture: c[1] } : {}), 'or')] : [group(ordinary('chief'), 'or')]))));
    for (const set of [fields, ordinaries, charges]) {
      for (const a of set) for (const b of set) {
        if (sameKey(a, b)) continue;
        expect(differences(a, b).filter((d) => d.kind === 'sc').length, `${signature(a)} vs ${signature(b)}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('too-close pre-filter with two main pictures', () => {
  // Two groups of charges are one primary group: they may share a type with any entry that has a primary.
  const lion = (extra: object = {}) => group(charge('lion'), 'or', extra);
  const designs = [
    nd(arms('azure', lion(), group(charge('rose'), 'argent'))),
    nd(arms('azure', lion({ count: 2 }), group(charge('rose'), 'argent'))),
    nd(arms('azure', group(charge('wolf'), 'or'), group(charge('mullet'), 'argent'))),
    nd(arms('azure', lion())),
    nd(arms('azure', group(charge('rose'), 'or', { count: 2 }))),
    nd(arms('azure', group(charge('mullet'), 'or', { count: 3 }))),
    nd(arms('azure', group(ordinary('bend'), 'or'))),
    nd(arms('azure', group(ordinary('chief'), 'or'))),
    nd(arms(div('per-pale', 'or', 'azure'), lion(), group(charge('rose'), 'argent'))),
    nd(arms(div('per-pale', 'or', 'azure'), lion())),
  ];

  it('keys a pair of pictures by any primary, and finds every entry that is not clear of it', () => {
    expect(candidateKey(designs[0]).primary).toBe('*');
    for (const a of designs) for (const b of designs) {
      if (!isClear(differences(a, b))) expect(keysMayConflict(candidateKey(a), candidateKey(b)), `${signature(a)} vs ${signature(b)}`).toBe(true);
      expect(keysMayConflict(candidateKey(a), candidateKey(b))).toBe(keysMayConflict(candidateKey(b), candidateKey(a)));
    }
  });

  it('gives the same verdict as scanning the whole registry', () => {
    const registry = registryFrom(designs);
    for (const probe of designs) {
      const sig = signature(probe);
      const candidates = registry.filter((e) => sameKey(probe, e.design));
      expect(checkUnique(probe, sig, candidates)).toEqual(checkUnique(probe, sig, registry));
    }
  });
});

describe('too-close pre-filter with a semy', () => {
  // A semy field with nothing in the middle is the primary group, so it keys like its charge; with a picture it is a secondary group and the picture keys.
  const semy = (id: string, ground = 'azure', ink = 'or') => ({ k: 'semy', ground, charge: { charge: id }, ink });
  const designs = [
    nd(arms(semy('mullet'))),
    nd(arms(semy('rose'))),
    nd(arms(semy('fleur-de-lis'), group(ordinary('chief'), 'argent'))),
    nd(arms(semy('mullet', 'vert', 'argent'))),
    nd(arms('azure', group(charge('mullet'), 'or', { count: 3 }))),
    nd(arms('azure', group(charge('rose'), 'or'))),
    nd(arms(semy('mullet'), group(charge('lion'), 'argent'))),
    nd(arms(semy('rose'), group(charge('lion'), 'argent'))),
    nd(arms('azure', group(charge('lion'), 'argent'))),
    nd(arms(div('per-pale', 'azure', 'vert'), group(ordinary('fess'), 'or'))),
    nd(arms({ k: 'divided', division: 'per-pale', parts: ['azure', semy('rose', 'argent', 'sable')] })),
    nd(arms('vert', group(charge('lion'), 'or'), group(ordinary('bordure'), semy('roundel', 'argent', 'sable')))),
  ];

  it('keys a semy field by its charge, as the primary group it is', () => {
    expect(candidateKey(designs[0])).toEqual(candidateKey(designs[4]));
    expect(candidateKey(designs[0]).primary).not.toBe(candidateKey(designs[1]).primary);
    expect(candidateKey(designs[6])).toEqual(candidateKey(designs[8]));
  });

  it('finds every entry that is not clear of the probe', () => {
    for (const a of designs) for (const b of designs) {
      if (!isClear(differences(a, b))) expect(keysMayConflict(candidateKey(a), candidateKey(b)), `${signature(a)} vs ${signature(b)}`).toBe(true);
      expect(keysMayConflict(candidateKey(a), candidateKey(b))).toBe(keysMayConflict(candidateKey(b), candidateKey(a)));
    }
  });

  it('keys only on changes that are substantial on their own', () => {
    for (const a of designs) for (const b of designs) {
      if (!sameKey(a, b)) expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });

  it('gives the same verdict as scanning the whole registry', () => {
    const registry = registryFrom(designs);
    for (const probe of designs) {
      const sig = signature(probe);
      const candidates = registry.filter((e) => sameKey(probe, e.design));
      expect(checkUnique(probe, sig, candidates)).toEqual(checkUnique(probe, sig, registry));
    }
  });
});

describe('too-close pre-filter with treated ordinaries', () => {
  // A chevron inverted keys apart from the chevron (A5E5c); every other treatment keys as its ordinary.
  const band = (type: string, mods: string[] = [], extra: object = {}) => group(ordinary(type, { mods, ...extra }), 'or');
  const between = group(charge('roundel'), 'argent', { count: 3 });
  const designs = [
    nd(arms('azure', band('chevron'))), nd(arms('azure', band('chevron', ['inverted']))), nd(arms('azure', band('chevron', ['inverted', 'couped']))),
    nd(arms('azure', band('chevron', ['couped']))), nd(arms('azure', band('chevron', ['enhanced']))), nd(arms('azure', band('chevron', ['throughout']))),
    nd(arms('azure', band('chevron'), between)), nd(arms('azure', band('chevron', ['inverted']), between)), nd(arms('azure', band('chevron', ['inverted'], { lines: { a: 'wavy' } }), between)),
    nd(arms('azure', band('pile'))), nd(arms('azure', band('pile', ['inverted']))), nd(arms('azure', band('cross'))), nd(arms('azure', band('cross', ['couped']))),
    nd(arms('azure', band('saltire', ['couped']))), nd(arms('azure', band('fess', ['abased']))), nd(arms('gules', band('chevron', ['inverted']))),
  ];

  it('finds every entry that is not clear of the probe', () => {
    for (const a of designs) for (const b of designs) {
      if (!isClear(differences(a, b))) expect(keysMayConflict(candidateKey(a), candidateKey(b)), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });

  it('keys only on changes that are substantial on their own', () => {
    expect(sameKey(designs[0], designs[1])).toBe(false);
    for (const a of designs) for (const b of designs) {
      if (!sameKey(a, b)) expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });
});

describe('too-close pre-filter with diminutives', () => {
  // Bars are the fess's type; three or more identical diminutives are also the variation (A5C1), so they key to every partition and
  // primary (ANY_PRIMARY): "three bars ↔ barry", "three bendlets ↔ bendy" compare, though their partitions and primaries differ.
  const dims = (type: string, count: number, extra: object = {}) => group(ordinary(type, extra), 'or', { count });
  const stripes = (variation: string, lines = 'plain') => ({ k: 'variation', variation, lines: { a: lines, b: lines }, parts: ['azure', 'or'] });
  const between = group(charge('roundel'), 'argent', { count: 2 });
  const designs = [
    nd(arms('azure', dims('bar', 3))), nd(arms(stripes('barry'))), nd(arms(stripes('barry', 'wavy'))), nd(arms('azure', dims('bar', 3, { lines: { a: 'wavy' } }))),
    nd(arms('azure', dims('bendlet', 3))), nd(arms(stripes('bendy'))), nd(arms('azure', dims('bendlet', 2))), nd(arms('azure', group(ordinary('bend'), 'or'))),
    nd(arms('azure', dims('bar', 2))), nd(arms('azure', group(ordinary('fess'), 'or'))), nd(arms('azure', dims('chevronel', 3))), nd(arms(stripes('chevronny'))),
    nd(arms('azure', dims('chevronel', 2, { mods: ['inverted'] }))), nd(arms('azure', dims('pallet', 4))), nd(arms(stripes('paly'))), nd(arms('azure', dims('bar', 2), between)),
    nd(arms('azure', dims('baton', 1))), nd(arms('azure', group(ordinary('bend-sinister', { mods: ['couped'] }), 'or'))), nd(arms('azure', group(charge('lion'), 'or'))),
  ];

  it('finds every entry that is not clear of the probe ("three bars ↔ barry", "three bendlets ↔ bendy")', () => {
    expect(differences(designs[0], designs[1])).toEqual([]);
    expect(differences(designs[4], designs[5])).toEqual([]);
    for (const a of designs) for (const b of designs) {
      if (!isClear(differences(a, b))) expect(keysMayConflict(candidateKey(a), candidateKey(b)), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });

  it('keys only on changes that are substantial on their own', () => {
    for (const a of designs) for (const b of designs) {
      if (!sameKey(a, b)) expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });

  it('gives the same verdict as scanning the whole registry', () => {
    const registry = registryFrom(designs);
    for (const probe of designs) {
      const sig = signature(probe);
      const candidates = registry.filter((e) => keysMayConflict(candidateKey(probe), candidateKey(e.design)));
      expect(outcome(checkUnique(probe, sig, candidates)), sig).toBe(outcome(checkUnique(probe, sig, registry)));
    }
  });
});

describe('too-close pre-filter with the divisions behind "More divisions"', () => {
  // Per chevron throughout is per chevron (A5F1), and a bare one is also a pile inverted throughout (RULES-C §E.1): it keys to every partition and primary,
  // and a bare pile inverted throughout to every partition. Gyronny keeps its own partition whatever its count or line.
  const lion = group(charge('lion'), 'or');
  const pile = group(ordinary('pile', { mods: ['inverted', 'throughout'] }), 'gules');
  const designs = [
    nd(arms(div('per-chevron', 'argent', 'gules'))), nd(arms(div('per-chevron-throughout', 'argent', 'gules'))), nd(arms(div('per-chevron-throughout', 'argent', 'gules'), lion)),
    nd(arms(div('per-chevron', 'argent', 'gules'), lion)), nd(arms(div('per-chevron-inverted', 'argent', 'gules'))), nd(arms(div('per-chevron-inverted', 'argent', 'gules'), lion)),
    nd(arms('argent', pile)), nd(arms('argent', pile, lion)), nd(arms('argent', group(ordinary('pile', { mods: ['inverted'] }), 'gules'))), nd(arms('argent', group(ordinary('chevron'), 'gules'))),
    nd(arms({ ...div('gyronny', 'argent', 'gules'), pieces: 6 }, lion)), nd(arms({ ...div('gyronny', 'argent', 'gules'), pieces: 12 }, lion)),
    nd(arms({ ...div('gyronny', 'argent', 'gules'), lines: { a: 'arrondi' } }, lion)), nd(arms({ ...div('gyronny', 'argent', 'gules'), lines: { a: 'wavy' } }, lion)),
    nd(arms(div('per-saltire', 'argent', 'gules'), lion)), nd(arms('gules', lion)),
  ];

  it('finds every entry that is not clear of the probe', () => {
    expect(differences(designs[1], designs[6])).toEqual([]);
    for (const a of designs) for (const b of designs) {
      if (!isClear(differences(a, b))) expect(keysMayConflict(candidateKey(a), candidateKey(b)), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });

  it('keys only on changes that are substantial on their own', () => {
    for (const a of designs) for (const b of designs) {
      if (!sameKey(a, b)) expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
  });

  it('gives the same verdict as scanning the whole registry', () => {
    const registry = registryFrom(designs);
    for (const probe of designs) {
      const sig = signature(probe);
      const candidates = registry.filter((e) => keysMayConflict(candidateKey(probe), candidateKey(e.design)));
      expect(outcome(checkUnique(probe, sig, candidates)), sig).toBe(outcome(checkUnique(probe, sig, registry)));
    }
  });
});

describe('too-close pre-filter with fieldless badges', () => {
  const lion = (extra: object = {}) => group(charge('lion'), 'or', extra);
  const fielded = [
    nd(arms('azure', lion())),
    nd(arms(div('per-pale', 'or', 'azure'), lion())),
    nd(arms('azure', group(charge('rose'), 'or'))),
    nd(arms('azure', group(ordinary('bend'), 'or'))),
  ];
  const badges = fielded.slice(0, 3).map(asBadge);
  const designs = [...fielded, ...badges];

  it('keys a badge by no partition, which may conflict with every partition', () => {
    expect(candidateKey(badges[0])).toEqual({ partition: null, primary: candidateKey(fielded[0]).primary });
    expect(sameKey(badges[0], fielded[0])).toBe(true);
    expect(sameKey(badges[0], fielded[1])).toBe(true);
    expect(sameKey(badges[1], fielded[0])).toBe(true);
    expect(sameKey(badges[0], badges[2])).toBe(false);
    expect(sameKey(badges[0], fielded[3])).toBe(false);
  });

  it('finds every entry that is not clear of the probe, and gives the same verdict as scanning the registry', () => {
    const registry = registryFrom(designs);
    for (const a of designs) {
      for (const b of designs) {
        if (!isClear(differences(a, b))) expect(sameKey(a, b), `${signature(a)} vs ${signature(b)}`).toBe(true);
        expect(sameKey(a, b)).toBe(sameKey(b, a));
      }
      const candidates = registry.filter((e) => sameKey(a, e.design));
      expect(checkUnique(a, signature(a), candidates)).toEqual(checkUnique(a, signature(a), registry));
    }
  });
});

describe('too-close pre-filter with a plain cross couped and an annulet', () => {
  // A plain cross couped, equal-armed or Latin, keys as the ordinary cross couped (App M1f family 1); an annulet as a roundel (one class, a DC apart).
  const couped = nd(arms('azure', group(charge('cross-couped'), 'or')));
  const latin = nd(arms('azure', group(charge('cross-latin'), 'or')));
  const ordinaryCouped = nd(arms('azure', group(ordinary('cross', { mods: ['couped'] }), 'or')));
  const throughout = nd(arms('azure', group(ordinary('cross'), 'or')));
  const annulet = nd(arms('azure', group(charge('annulet'), 'or')));
  const roundel = nd(arms('azure', group(charge('roundel'), 'or')));
  const designs = [couped, latin, ordinaryCouped, throughout, annulet, roundel];

  it('keys the charge as the ordinary, and the annulet as the roundel', () => {
    expect(candidateKey(couped)).toEqual(candidateKey(ordinaryCouped));
    expect(candidateKey(latin)).toEqual(candidateKey(ordinaryCouped));
    expect(candidateKey(latin)).toEqual(candidateKey(throughout));
    expect(candidateKey(annulet)).toEqual(candidateKey(roundel));
  });

  it('finds every entry that is not clear of the probe, and keys only on substantial changes', () => {
    for (const a of designs) for (const b of designs) {
      if (!isClear(differences(a, b))) expect(sameKey(a, b), `${signature(a)} vs ${signature(b)}`).toBe(true);
      if (!sameKey(a, b)) expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
    const registry = registryFrom(designs);
    for (const probe of designs) {
      const candidates = registry.filter((e) => sameKey(probe, e.design));
      expect(checkUnique(probe, signature(probe), candidates)).toEqual(checkUnique(probe, signature(probe), registry));
    }
    const others = registry.filter((e) => e.signature !== signature(annulet) && sameKey(annulet, e.design));
    expect(checkUnique(annulet, signature(annulet), others).kind).toBe('too-close');
  });
});
