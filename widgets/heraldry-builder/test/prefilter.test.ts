// The too-close pre-filter (candidateKey) must never change a verdict: checkUnique over only the entries
// whose key may conflict with the candidate's equals checkUnique over the whole registry — including which entry an ok design
// only passed by two distinct changes. That holds because a change of any part of the key is always a
// substantial change on its own, which is proven here too. A fieldless badge has no partition, which matches every partition.
import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, DRAWN_DIVISIONS, DRAWN_ORDINARIES, ORDINARY_KIND, candidateKey, checkUnique, differences, isClear, keysMayConflict, primaryGroups, signature,
  type Design, type RegistryEntryLike, type Verdict,
} from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';
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

  it('gives the same verdict when an entry is edited (itself excluded)', () => {
    for (const edited of registry) {
      for (const probe of probes.slice(0, 100)) {
        const sig = signature(probe);
        const full = checkUnique(probe, sig, registry, edited.id);
        const candidates = registry.filter((e) => sameKey(probe, e.design));
        expect(checkUnique(probe, sig, candidates, edited.id)).toEqual(full);
      }
    }
  }, 30_000);

  it('keys only on changes that are substantial on their own (generated pairs)', () => {
    const designs = withBadges(generatedDesigns(20_000, 400), 4);
    let keyed = 0;
    for (const a of designs) for (const b of designs) {
      if (sameKey(a, b)) continue;
      keyed++;
      expect(differences(a, b).some((d) => d.kind === 'sc'), `${signature(a)} vs ${signature(b)}`).toBe(true);
    }
    expect(keyed).toBeGreaterThan(10_000);
  }, 30_000);

  it('keys only on changes that are substantial on their own (every division, ordinary and charge)', () => {
    const field = (division: string | null) => (division ? div(division, 'or', 'azure') : 'azure');
    const fields = [null, ...DRAWN_DIVISIONS].map((d) => nd(arms(field(d), group(ordinary('pale'), 'gules'))));
    const ordinaries = [null, ...DRAWN_ORDINARIES.filter((t) => ORDINARY_KIND[t] === 'central')]
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
