// Seeded generator of valid designs drawn from small option sets, so that generated pairs often
// share most attributes (duplicates, near misses and clear differences all turn up).
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
const DIVISION_IDS = ['per-pale', 'per-fess', 'per-bend'];
const ORDINARY_IDS = ['fess', 'pale', 'bordure'];
const POSTURES: Record<string, readonly (string | null)[]> = {
  wolf: ['passant', 'statant', 'rampant'],
  mullet: [null],
  rose: [null],
};
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
    ? { charge, count: 1 + Math.floor(next() * 6), placement: 'field', posture: pick(POSTURES[charge]), tincture: t() }
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
