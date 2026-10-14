// Seeded random designs in the new format, for sweeping the model: the same seeds make the same designs.
// Designs are kept when they normalise (supported, structurally legal and obeying the rule of tincture); the
// layout is Table 7's or a random one of the group's candidates. `generatedDesigns` makes the builder's level-0
// space (the tests that rely on its distribution never change); `generatedRichDesigns` shares its internals and
// adds the constructs the builder has gained since: a chief and a bordure beside the band, pictures on the band
// as well as beside it.

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

/** The design for `seed`, or null when the random pick isn't a registrable design. `rich` adds a chief and a bordure beside the band, and pictures on it. */
function designFor(seed: number, rich: boolean): Design | null {
  const next = prng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const t = () => pick(TINCTURES);

  const field = next() < 0.4 ? t() : { k: 'divided', division: pick(DIVISIONS), parts: [t(), t()] };
  const type = next() < 0.5 ? pick(ORDINARIES) : null;
  const id = next() < 0.8 ? pick(CHARGES) : null;
  const groups: object[] = [];
  if (type) groups.push({ item: { k: 'ordinary', type }, paint: t() });
  let pictureAt = -1;
  if (id) {
    const posture = POSTURES[id] ? pick(POSTURES[id]) : undefined;
    const onOrdinary = type !== null && type !== 'bordure' && next() < 0.4;
    const charge = { item: { k: 'charge', charge: id, ...(posture ? { posture } : {}) }, paint: t(), count: 1 + Math.floor(next() * 6) };
    if (onOrdinary) groups[0] = { ...groups[0], charged: [charge] };
    else {
      pictureAt = groups.length;
      groups.push(charge);
    }
  }
  if (rich) {
    // The pictures on the band, as well as the picture beside it.
    if (type !== null && type !== 'bordure' && pictureAt >= 0 && next() < 0.3) {
      groups[0] = { ...groups[0], charged: [{ item: { k: 'charge', charge: pick(CHARGES.filter((c) => c !== id)) }, paint: t(), count: 1 + Math.floor(next() * 3) }] };
    }
    // A chief and a bordure beside the band (a chief or bordure that is the band itself gives way).
    for (const peripheral of ['chief', 'bordure']) {
      if (type !== peripheral && next() < 0.35) groups.push({ item: { k: 'ordinary', type: peripheral }, paint: t() });
    }
  }

  const first = resolve({ v: 2, field, groups });
  if (!first.ok) return null;
  let design = first.design;
  if (pictureAt >= 0 && next() < 0.5) {
    const path = [design.groups.findIndex((g) => g.item.k === 'charge' && g.role !== 'tertiary')];
    const candidates = layoutCandidates(design, path, design.groups[path[0]].count);
    const second = resolve({ v: 2, field, groups: groups.map((g, i) => (i === pictureAt ? { ...g, arrangement: layoutKey(pick(candidates)) } : g)) });
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

export const generatedDesign = (seed: number): Design | null => designFor(seed, false);

/** The design for `seed` from the builder's whole space so far. */
export const generatedRichDesign = (seed: number): Design | null => designFor(seed, true);

/** The first `count` designs from `generatedRichDesign`, trying seeds from `seed` upwards. */
export function generatedRichDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = generatedRichDesign(s);
    if (d) designs.push(d);
  }
  return designs;
}
