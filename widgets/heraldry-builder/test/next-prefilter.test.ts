// The too-close pre-filter (candidateKey) must never change a verdict: checkUnique over only the entries
// sharing the candidate key equals checkUnique over the whole registry — including which entry an ok design
// only passed by two distinct changes. That holds because a change of any part of the key is always a
// substantial change on its own, which is proven here too.
import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, DRAWN_DIVISIONS, DRAWN_ORDINARIES, ORDINARY_KIND, candidateKey, checkUnique, differences, isClear, signature,
  type Design, type RegistryEntryLike, type Verdict,
} from '../src/lib/heraldry/next';
import { generatedDesigns } from './next-design-generator';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';

const sameKey = (a: Design, b: Design) => JSON.stringify(candidateKey(a)) === JSON.stringify(candidateKey(b));

function registryFrom(designs: Design[]): RegistryEntryLike[] {
  const bySignature = new Map<string, RegistryEntryLike>();
  for (const design of designs) {
    const sig = signature(design);
    if (!bySignature.has(sig)) bySignature.set(sig, { id: `e${bySignature.size}`, signature: sig, design });
  }
  return [...bySignature.values()];
}

/** The verdict's kind, telling apart an ok that only passed an entry on two distinct changes. */
const outcome = (v: Verdict) => (v.kind === 'ok' && v.closest ? 'ok-on-two-dcs' : v.kind);

describe('too-close pre-filter', () => {
  const registry = registryFrom(generatedDesigns(1, 120));
  const probes = generatedDesigns(10_000, 1500);

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
    const designs = generatedDesigns(20_000, 400);
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
