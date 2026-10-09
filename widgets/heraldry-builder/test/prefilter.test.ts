// The too-close pre-filter (candidateKey) must never change a verdict: checkUnique over only the
// entries sharing the candidate key equals checkUnique over the whole registry.
import { describe, it, expect } from 'vitest';
import { candidateKey, checkUnique, signature, type NormDesign, type RegistryEntryLike } from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';

const sameKey = (a: NormDesign, b: NormDesign) => JSON.stringify(candidateKey(a)) === JSON.stringify(candidateKey(b));

function registryFrom(designs: NormDesign[]): RegistryEntryLike[] {
  const bySignature = new Map<string, RegistryEntryLike>();
  for (const design of designs) {
    const sig = signature(design);
    if (!bySignature.has(sig)) bySignature.set(sig, { id: `e${bySignature.size}`, signature: sig, design });
  }
  return [...bySignature.values()];
}

describe('too-close pre-filter', () => {
  const registry = registryFrom(generatedDesigns(1, 80));
  const probes = generatedDesigns(10_000, 600);

  it('gives the same verdict as scanning the whole registry', () => {
    const kinds = new Set<string>();
    for (const probe of probes) {
      const sig = signature(probe);
      const full = checkUnique(probe, sig, registry);
      const candidates = registry.filter((e) => sameKey(probe, e.design));
      expect(checkUnique(probe, sig, candidates)).toEqual(full);
      kinds.add(full.kind);
    }
    // The generator must exercise every verdict, or the comparison proves nothing.
    expect([...kinds].sort()).toEqual(['duplicate', 'ok', 'too-close']);
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

});
