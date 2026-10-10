// The too-close pre-filter (candidateKey) must never change a verdict: checkUnique over only the
// entries sharing the candidate key equals checkUnique over the whole registry — including which
// entry an ok design only passed by adding up half differences. That holds because a change of any
// part of the key is always a full point on its own, which is proven here too.
import { describe, it, expect } from 'vitest';
import {
  CHARGE_IDS, CHARGES, DIVISIONS, ORDINARY_TYPES, areDistinct, candidateKey, checkUnique, differences, signature,
  type MinorReason, type NormDesign, type RegistryEntryLike, type Verdict,
} from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';
import { nd as design } from './helpers';

const sameKey = (a: NormDesign, b: NormDesign) => JSON.stringify(candidateKey(a)) === JSON.stringify(candidateKey(b));

function registryFrom(designs: NormDesign[]): RegistryEntryLike[] {
  const bySignature = new Map<string, RegistryEntryLike>();
  for (const design of designs) {
    const sig = signature(design);
    if (!bySignature.has(sig)) bySignature.set(sig, { id: `e${bySignature.size}`, signature: sig, design });
  }
  return [...bySignature.values()];
}

/** The verdict's kind, telling apart an ok that only passed an entry on half differences. */
const outcome = (v: Verdict) => (v.kind === 'ok' && v.closest ? 'ok-on-halves' : v.kind);

function reasonsOf(v: Verdict): MinorReason[] {
  const ds = v.kind === 'too-close' ? v.differences : v.kind === 'ok' && v.closest ? v.closest.differences : [];
  return ds.flatMap((d) => (d.weight === 'minor' ? [d.reason] : []));
}

describe('too-close pre-filter', () => {
  const registry = registryFrom(generatedDesigns(1, 120));
  const probes = generatedDesigns(10_000, 1500);

  it('gives the same verdict as scanning the whole registry', () => {
    const outcomes = new Set<string>();
    const reasons = new Set<MinorReason>();
    for (const probe of probes) {
      const sig = signature(probe);
      const full = checkUnique(probe, sig, registry);
      const candidates = registry.filter((e) => sameKey(probe, e.design));
      expect(checkUnique(probe, sig, candidates)).toEqual(full);
      outcomes.add(outcome(full));
      for (const r of reasonsOf(full)) reasons.add(r);
    }
    // The generator must exercise every verdict and every kind of half difference, or the
    // comparison proves nothing.
    expect([...outcomes].sort()).toEqual(['duplicate', 'ok', 'ok-on-halves', 'too-close']);
    expect([...reasons].sort()).toEqual(
      ['many-charges', 'mirrored', 'pattern-with-count', 'similar-charges', 'similar-postures', 'swapped-tinctures'],
    );
  });

  it('gives the same verdict when an entry is edited (itself excluded)', () => {
    for (const edited of registry) {
      for (const probe of probes.slice(0, 100)) {
        const sig = signature(probe);
        const full = checkUnique(probe, sig, registry, edited.id);
        const candidates = registry.filter((e) => sameKey(probe, e.design));
        expect(checkUnique(probe, sig, candidates, edited.id)).toEqual(full);
      }
    }
  });

  it('keys only on changes that are a full point on their own (generated pairs)', () => {
    const designs = generatedDesigns(20_000, 400);
    let keyed = 0;
    for (const a of designs) for (const b of designs) {
      if (sameKey(a, b)) continue;
      keyed++;
      expect(areDistinct(a, b), `${signature(a)} vs ${signature(b)}`).toBe(true);
      expect(differences(a, b).some((d) => d.weight === 'clear')).toBe(true);
    }
    expect(keyed).toBeGreaterThan(10_000);
  });

  it('keys only on changes that are a full point on their own (every division, ordinary and charge)', () => {
    const field = (division: string | null) => (division ? { kind: 'divided', division, tinctures: ['or', 'azure'] } : { kind: 'plain', tincture: 'azure' });
    const fields = [null, ...DIVISIONS].map((d) => design({ v: 1, field: field(d), ordinary: { type: 'pale', tincture: 'gules' } }));
    const ordinaries = [null, ...ORDINARY_TYPES].map((type) => design({ v: 1, field: field(null), ordinary: type && { type, tincture: 'or' } }));
    const charges = [null, ...CHARGE_IDS.flatMap((id) => (CHARGES[id].postures ?? [null]).map((posture) => [id, posture] as const))]
      .map((c) => design({ v: 1, field: field(null), charges: c && { charge: c[0], count: 1, placement: 'field', posture: c[1], tincture: 'or' } }));
    for (const set of [fields, ordinaries, charges]) {
      for (const a of set) for (const b of set) {
        if (sameKey(a, b)) continue;
        expect(differences(a, b).filter((d) => d.weight === 'clear').length, `${signature(a)} vs ${signature(b)}`).toBeGreaterThan(0);
      }
    }
  });
});
