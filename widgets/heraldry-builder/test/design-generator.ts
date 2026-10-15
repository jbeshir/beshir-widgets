// Seeded random designs in the new format, for sweeping the model: the same seeds make the same designs.
// Designs are kept when they normalise (supported, structurally legal and obeying the rule of tincture); the
// layout is Table 7's or a random one of the group's candidates. `generatedDesigns` makes the builder's level-0
// space (the tests that rely on its distribution never change); `generatedRichDesigns` shares its internals and
// adds the constructs the builder has gained since: a chief and a bordure beside the band, pictures on the band
// as well as beside it, pictures on the chief and the bordure, pictures in chief, in base or in canton, pictures
// set around the picture, pictures on the picture, a second main picture beside the picture, and a band or sword across everything.

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

/** Mixed into a seed for the picks of the pictures set around the picture. */
const AROUND_SEED = 0x5bd1e995;
/** Mixed into a seed for the picks of the pictures on the picture. */
const ON_PICTURE_SEED = 0x2c1b3c6d;
/** Mixed into a seed for the picks of the second main picture. */
const CO_PRIMARY_SEED = 0x1b873593;
/** Mixed into a seed for the picks of what lies overall. */
const OVERALL_SEED = 0x7f4a7c15;
const OVERALL_ORDINARIES = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'];
/** The layouts the pictures on the picture take, by count (Table 7 states them all). */
const ON_PICTURE_LAYOUTS: Record<number, readonly string[]> = { 1: ['single'], 2: ['in-fess', 'in-pale'], 3: ['rows-2-1', 'rows-1-2', 'in-fess', 'in-pale'], 4: ['rows-2-2', 'in-cross'] };

/** The design for `seed`, or null when the random pick isn't a registrable design. `rich` adds a chief and a bordure beside the band, and pictures on them. */
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
    // A chief and a bordure beside the band (a chief or bordure that is the band itself gives way), some with pictures on them.
    for (const peripheral of ['chief', 'bordure']) {
      if (type === peripheral || next() >= 0.35) continue;
      const carried = next() < 0.35 ? [{ item: { k: 'charge', charge: pick(CHARGES.filter((c) => c !== 'sword')) }, paint: t(), count: 1 + Math.floor(next() * (peripheral === 'chief' ? 4 : 8)) }] : [];
      groups.push({ item: { k: 'ordinary', type: peripheral }, paint: t(), charged: carried });
    }
    // Pictures in chief, in base or in canton beside a central band or the picture (never beside pictures set around the band).
    const central = type !== null && type !== 'chief' && type !== 'bordure';
    const positioned = (central ? pictureAt < 0 : pictureAt >= 0) && next() < 0.35;
    if (positioned) {
      const position = pick(['chief', 'base', 'canton']);
      const count = position === 'canton' ? 1 : 1 + Math.floor(next() * 3);
      groups.push({ item: { k: 'charge', charge: pick(CHARGES.filter((c) => c !== id && c !== 'sword')) }, paint: t(), count, position });
    }
    // Pictures around the picture on the background (one or two of them), with no band. Drawn from a stream of their own, so
    // the designs before them keep their seeds' picks.
    const around = prng(seed ^ AROUND_SEED);
    let surrounded = false;
    if (!central && !positioned && pictureAt >= 0 && around() < 0.35) {
      const among = <T>(xs: readonly T[]): T => xs[Math.floor(around() * xs.length)];
      groups[pictureAt] = { ...groups[pictureAt], count: among([1, 1, 2]) };
      groups.push({ item: { k: 'charge', charge: among(CHARGES.filter((c) => c !== id)) }, paint: among(TINCTURES), count: among([2, 3, 3, 4, 6, 8]), relation: 'between' });
      surrounded = true;
    }
    // A second main picture beside the picture, three charges between them at most, from a stream of its own as well.
    const second = prng(seed ^ CO_PRIMARY_SEED);
    let together = false;
    if (!central && !surrounded && pictureAt >= 0 && second() < 0.3) {
      const among = <T>(xs: readonly T[]): T => xs[Math.floor(second() * xs.length)];
      const count = among([1, 1, 2]);
      groups[pictureAt] = { ...groups[pictureAt], count: 3 - count > 1 ? among([1, 2]) : 1 };
      groups.push({ item: { k: 'charge', charge: among(CHARGES.filter((c) => c !== id)) }, paint: among(TINCTURES), count: Math.min(count, 3 - (groups[pictureAt] as { count: number }).count) });
      together = true;
    }
    // Pictures on the picture (one to four on each of one to three), from a stream of their own as well.
    const upon = prng(seed ^ ON_PICTURE_SEED);
    if (!central && !surrounded && !together && pictureAt >= 0 && upon() < 0.7) {
      const among = <T>(xs: readonly T[]): T => xs[Math.floor(upon() * xs.length)];
      const count = among([1, 1, 2, 3, 4]);
      groups[pictureAt] = { ...groups[pictureAt], count: among([1, 1, 2, 3]) };
      groups[pictureAt] = { ...groups[pictureAt], charged: [{ item: { k: 'charge', charge: among(CHARGES.filter((c) => c !== id && c !== 'sword')) }, paint: among(TINCTURES), count, arrangement: among(ON_PICTURE_LAYOUTS[count]) }] };
    }
  }

  /** The design of these groups with a random layout for the picture, if it is a registrable one. */
  const finish = (all: readonly object[]): Design | null => {
    const first = resolve({ v: 2, field, groups: all });
    if (!first.ok) return null;
    let design = first.design;
    if (pictureAt >= 0 && next() < 0.5) {
      const path = [design.groups.findIndex((g) => g.item.k === 'charge' && g.role !== 'tertiary')];
      const candidates = layoutCandidates(design, path, design.groups[path[0]].count);
      const second = resolve({ v: 2, field, groups: all.map((g, i) => (i === pictureAt ? { ...g, arrangement: layoutKey(pick(candidates)) } : g)) });
      if (!second.ok) return null;
      design = second.design;
    }
    const n = normalise(design);
    return n.ok ? n.design : null;
  };
  const plain = finish(groups);
  // A band or sword lying across the middle of a design with a main band or picture, from a stream of its own; the design without it stands where it doesn't work.
  if (rich) {
    const over = prng(seed ^ OVERALL_SEED);
    const central = type !== null && type !== 'chief' && type !== 'bordure';
    // The picture is the main group unless a central band is; a chief or bordure alone, with the picture on it, has none.
    if ((central || pictureAt >= 0) && over() < 0.3) {
      const among = <T>(xs: readonly T[]): T => xs[Math.floor(over() * xs.length)];
      const paint = among(TINCTURES);
      const charge = central ? among(CHARGES.filter((c) => c !== id)) : id !== 'sword' && over() < 0.3 ? 'sword' : null;
      const lying = charge === null
        ? { item: { k: 'ordinary', type: among(OVERALL_ORDINARIES) }, paint, role: 'overall' }
        : { item: { k: 'charge', charge }, paint, role: 'overall', ...(charge === 'sword' && over() < 0.5 ? { count: 2, arrangement: 'crossed' } : {}) };
      const crossed = finish([...groups, lying]);
      if (crossed) return crossed;
    }
  }
  return plain;
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
