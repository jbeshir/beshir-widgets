// The example designs: every one is a design the builder accepts, follows the rule of tincture, reads
// at a glance and can be registered alongside the others. "Surprise me" repeats for a given seed.
import { describe, it, expect } from 'vitest';
import { isClear, differences, normalise, readability, signature, walkGroups } from '../src/lib/heraldry';
import { assess } from '../src/lib/builder';
import { EXAMPLE_DESIGNS, surpriseDesign } from '../src/lib/presets';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('example designs', () => {
  it('offers six to eight with distinct ids and captions', () => {
    expect(EXAMPLE_DESIGNS.length).toBeGreaterThanOrEqual(6);
    expect(EXAMPLE_DESIGNS.length).toBeLessThanOrEqual(8);
    expect(new Set(EXAMPLE_DESIGNS.map((p) => p.id)).size).toBe(EXAMPLE_DESIGNS.length);
    expect(new Set(EXAMPLE_DESIGNS.map((p) => p.caption)).size).toBe(EXAMPLE_DESIGNS.length);
  });

  it.each(EXAMPLE_DESIGNS.map((p) => [p.id, p] as const))('%s resolves, follows the rules and is easy to spot', (_id, p) => {
    const n = normalise(p.design);
    expect(n.ok).toBe(true);
    expect(n.ok && n.design).toEqual(p.design);
    expect(assess(p.design).status).toBe('valid');
    expect(readability(p.design).band).toBe('bold');
  });

  it('are pairwise distinct under the uniqueness rules', () => {
    for (const [i, a] of EXAMPLE_DESIGNS.entries()) {
      for (const b of EXAMPLE_DESIGNS.slice(i + 1)) {
        expect(isClear(differences(a.design, b.design)), `${a.id} vs ${b.id}`).toBe(true);
        expect(signature(a.design)).not.toBe(signature(b.design));
      }
    }
  });

  it('vary in shape, include a celestine and a counterchanged design', () => {
    expect(new Set(EXAMPLE_DESIGNS.map((p) => p.shape)).size).toBeGreaterThanOrEqual(3);
    expect(EXAMPLE_DESIGNS.some((p) => JSON.stringify(p.design).includes('"celestine"'))).toBe(true);
    expect(EXAMPLE_DESIGNS.some((p) => walkGroups(p.design).some(({ group }) => group.paint.k === 'counterchanged'))).toBe(true);
  });
});

describe('surprise me', () => {
  it('gives the same design for the same random sequence', () => {
    expect(surpriseDesign(seeded(7))).toEqual(surpriseDesign(seeded(7)));
  });

  it('always gives a valid, easy-to-spot design', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const { design } = surpriseDesign(seeded(seed));
      expect(assess(design).status).toBe('valid');
      expect(readability(design).band).toBe('bold');
      seen.add(signature(design));
    }
    expect(seen.size).toBeGreaterThan(20);
  });
});
