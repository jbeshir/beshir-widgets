// Seeded random designs in the new format, for sweeping the model: the same seeds make the same designs.
// Designs are kept when they normalise (supported, structurally legal and obeying the rule of tincture); the
// layout is Table 7's or a random one of the group's candidates.

import { layoutCandidates, layoutKey, normalise, resolve, type Design } from '../src/lib/heraldry';

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

const TINCTURES = ['or', 'argent', 'azure', 'gules', 'sable', 'vert'];
const DIVISIONS = ['per-pale', 'per-bend', 'per-bend-sinister'];
const ORDINARIES = ['fess', 'bend', 'bend-sinister', 'chief', 'bordure'];
const CHARGES = ['lion', 'wolf', 'mullet', 'rose', 'sword', 'gear'];
const POSTURES: Record<string, readonly string[]> = { lion: ['rampant', 'passant', 'statant'], wolf: ['passant', 'statant', 'rampant'] };

/** The design for `seed`, or null when the random pick isn't a registrable design. */
export function generatedDesign(seed: number): Design | null {
  const next = prng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const t = () => pick(TINCTURES);

  const field = next() < 0.4 ? t() : { k: 'divided', division: pick(DIVISIONS), parts: [t(), t()] };
  const type = next() < 0.5 ? pick(ORDINARIES) : null;
  const id = next() < 0.8 ? pick(CHARGES) : null;
  const groups: object[] = [];
  if (type) groups.push({ item: { k: 'ordinary', type }, paint: t() });
  let onField = false;
  if (id) {
    const posture = POSTURES[id] ? pick(POSTURES[id]) : undefined;
    const onOrdinary = type !== null && type !== 'bordure' && next() < 0.4;
    const charge = { item: { k: 'charge', charge: id, ...(posture ? { posture } : {}) }, paint: t(), count: 1 + Math.floor(next() * 6) };
    if (onOrdinary) groups[0] = { ...groups[0], charged: [charge] };
    else {
      onField = true;
      groups.push(charge);
    }
  }

  const first = resolve({ v: 2, field, groups });
  if (!first.ok) return null;
  let design = first.design;
  if (onField && next() < 0.5) {
    const path = [design.groups.findIndex((g) => g.item.k === 'charge' && g.role !== 'tertiary')];
    const candidates = layoutCandidates(design, path, design.groups[path[0]].count);
    const second = resolve({ v: 2, field, groups: groups.map((g, i) => (i === groups.length - 1 ? { ...g, arrangement: layoutKey(pick(candidates)) } : g)) });
    if (!second.ok) return null;
    design = second.design;
  }
  const n = normalise(design);
  return n.ok ? n.design : null;
}

/** The first `count` designs from `generatedDesign`, trying seeds from `seed` upwards. */
export function generatedDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = generatedDesign(s);
    if (d) designs.push(d);
  }
  return designs;
}
