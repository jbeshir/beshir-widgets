// Seeded generator of valid designs drawn from small option sets, so that generated pairs often
// share most attributes (duplicates, near misses and clear differences all turn up). The sets include
// look-alike charges (lion, wolf, goat; rose, gear), mirror images (per bend / per bend sinister, bend
// / bend sinister, in bend / in bend sinister) and the four-or-more counts and patterns, so every kind
// of half difference is exercised.
import { normalise, type NormDesign } from '../src/lib/heraldry';

/** mulberry32: a small deterministic PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TINCTURE_IDS = ['or', 'argent', 'azure', 'gules', 'sable', 'vert'];
const DIVISION_IDS = ['per-pale', 'per-bend', 'per-bend-sinister'];
const ORDINARY_IDS = ['fess', 'bend', 'bend-sinister', 'bordure'];
const POSTURES: Record<string, readonly (string | null)[]> = {
  lion: ['rampant', 'passant', 'statant'],
  wolf: ['passant', 'statant', 'rampant'],
  goat: ['statant', 'rampant'],
  mullet: [null],
  rose: [null],
  gear: [null],
};
// null = the count's default arrangement; an arrangement the count can't take makes the design invalid.
const ARRANGEMENT_IDS = [null, null, 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire'];
const CHARGE_IDS = Object.keys(POSTURES);

/** The normalised valid design for `seed`, or null when the random pick breaks a rule. */
export function generatedDesign(seed: number): NormDesign | null {
  const next = prng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const t = () => pick(TINCTURE_IDS);

  const field = next() < 0.4
    ? { kind: 'plain', tincture: t() }
    : { kind: 'divided', division: pick(DIVISION_IDS), tinctures: [t(), t()] };
  const ordinary = next() < 0.5 ? { type: pick(ORDINARY_IDS), tincture: t() } : null;
  const charge = next() < 0.8 ? pick(CHARGE_IDS) : null;
  const charges = charge
    ? { charge, count: 1 + Math.floor(next() * 6), placement: 'field', arrangement: pick(ARRANGEMENT_IDS), posture: pick(POSTURES[charge]), tincture: t() }
    : null;

  const n = normalise({ v: 1, field, ordinary, charges });
  return n.ok ? n.design : null;
}

/** The first `count` valid generated designs starting from `seed`. */
export function generatedDesigns(seed: number, count: number): NormDesign[] {
  const designs: NormDesign[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = generatedDesign(s);
    if (d) designs.push(d);
  }
  return designs;
}
