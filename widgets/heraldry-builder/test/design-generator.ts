// Seeded random designs in the new format, for sweeping the model: the same seeds make the same designs.
// Designs are kept when they normalise (supported, structurally legal and obeying the rule of tincture); the
// layout is Table 7's or a random one of the group's candidates. `generatedDesigns` makes the builder's level-0
// space (the tests that rely on its distribution never change); `generatedRichDesigns` shares its internals and
// adds the constructs the builder has gained since: a chief and a bordure beside the band, pictures on the band
// as well as beside it, pictures on the chief and the bordure, pictures in chief, in base or in canton, pictures
// set around the picture, pictures on the picture, a second main picture beside the picture, and a band or sword across everything.

import { CHARGES as CHARGE_META, DIMINUTIVE_COUNTS, DRAWN_LINES, THIN_ORDINARIES, layoutCandidates, layoutKey, lineAllowed, modDrawn, normalise, resolve, type ChargeId, type Design } from '../src/lib/heraldry';

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

/** Mixed into a seed for the picks of the geometry designs (lines on the divisions and stripes of the field). */
const GEOMETRY_SEED = 0x3c6ef372;
const GEOMETRY_DIVISIONS = ['per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-chevron', 'per-saltire', 'quarterly'];
const GEOMETRY_STRIPES = ['barry', 'paly', 'bendy', 'bendy-sinister'];

/**
 * The design for `seed` with a division or stripes of the field drawn with a line the host takes (the builder's lines on the
 * background), a band or a picture on it sometimes; each later phase's constructs go on a new stream below. Null when the pick isn't registrable.
 */
function geometryDesignFor(seed: number): Design | null {
  const next = prng(seed ^ GEOMETRY_SEED);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const lines = DRAWN_LINES;
  const parts = [pick(TINCTURES), pick(TINCTURES)];
  const field = next() < 0.7
    ? (() => {
      const division = pick(GEOMETRY_DIVISIONS);
      const line = pick(lines.filter((l) => lineAllowed({ k: 'division', division: division as never }, l)));
      return { k: 'divided', division, lines: { a: line }, parts };
    })()
    : (() => {
      const variation = pick(GEOMETRY_STRIPES);
      const line = pick(lines.filter((l) => lineAllowed({ k: 'variation', variation: variation as never }, l)));
      return { k: 'variation', variation, pieces: pick([4, 6, 8]), lines: { a: line }, parts };
    })();
  const groups = next() < 0.8 ? [{ item: { k: 'charge', charge: pick(CHARGES) }, paint: pick(TINCTURES), count: 1 + Math.floor(next() * 3) }] : [{ item: { k: 'ordinary', type: pick(ORDINARIES) }, paint: pick(TINCTURES) }];
  const r = resolve({ v: 2, field, groups });
  if (!r.ok) return null;
  const n = normalise(r.design);
  return n.ok ? n.design : null;
}

/** The first `count` designs from `geometryDesignFor`, trying seeds from `seed` upwards. */
export function generatedGeometryDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = geometryDesignFor(s);
    if (d) designs.push(d);
  }
  return designs;
}

/** Mixed into a seed for the picks of the lined ordinaries. */
const LINED_ORDINARY_SEED = 0x6a09e667;
const LINED_ORDINARIES = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'chief', 'bordure', 'pall'];

/**
 * The design for `seed` with a band or shape drawn with a line its host takes, on both edges or (a band with two) on one, sometimes
 * with a picture or a top band beside it. Null when the pick isn't registrable.
 */
function linedOrdinaryDesignFor(seed: number): Design | null {
  const next = prng(seed ^ LINED_ORDINARY_SEED);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const type = pick(LINED_ORDINARIES);
  const line = pick(DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type: type as never, inverted: false }, l)));
  const mode = pick(['a', 'b', 'both'] as const);
  const lines = mode === 'both' ? { a: line, b: line } : mode === 'a' ? { a: line, b: 'plain' } : { a: 'plain', b: line };
  const groups: object[] = [{ item: { k: 'ordinary', type, lines }, paint: pick(TINCTURES) }];
  if (next() < 0.4) groups.push({ item: { k: 'charge', charge: pick(CHARGES) }, paint: pick(TINCTURES), count: 1 + Math.floor(next() * 3), relation: next() < 0.5 ? 'between' : null });
  const r = resolve({ v: 2, field: pick(TINCTURES), groups });
  if (!r.ok) return null;
  const n = normalise(r.design);
  return n.ok ? n.design : null;
}

/** The first `count` designs from `linedOrdinaryDesignFor`, trying seeds from `seed` upwards. */
export function generatedLinedOrdinaryDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = linedOrdinaryDesignFor(s);
    if (d) designs.push(d);
  }
  return designs;
}

/** Mixed into a seed for the picks of the treated ordinaries. */
const TREATED_ORDINARY_SEED = 0x3c6ef373;

/**
 * The design for `seed` with a band or shape upside down, shortened, touching the edges, raised or lowered (as its host takes them), or two
 * to four thin bands (treated or not), with a line sometimes, and sometimes a picture set around it or on it. Null when the pick isn't registrable.
 */
function treatedOrdinaryDesignFor(seed: number): Design | null {
  const next = prng(seed ^ TREATED_ORDINARY_SEED);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const type = pick(['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'pall', ...THIN_ORDINARIES] as const);
  const mods = (['inverted', 'couped', 'throughout', 'enhanced', 'abased'] as const).filter((m) => modDrawn(type, m) && next() < 0.45);
  const thin = THIN_ORDINARIES.includes(type);
  if (mods.length === 0 && !thin) return null;
  const inverted = mods.includes('inverted');
  const line = next() < 0.3 ? pick(DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type, inverted }, l))) : null;
  const groups: object[] = [{ item: { k: 'ordinary', type, mods, ...(line ? { lines: { a: line } } : {}) }, paint: pick(TINCTURES), count: thin ? pick(DIMINUTIVE_COUNTS) : 1 }];
  if (next() < 0.4) groups.push({ item: { k: 'charge', charge: pick(CHARGES) }, paint: pick(TINCTURES), count: 1 + Math.floor(next() * 3), relation: next() < 0.5 ? 'between' : null });
  const r = resolve({ v: 2, field: pick(TINCTURES), groups });
  if (!r.ok) return null;
  const n = normalise(r.design);
  return n.ok ? n.design : null;
}

/** The first `count` designs from `treatedOrdinaryDesignFor`, trying seeds from `seed` upwards. */
export function generatedTreatedOrdinaryDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = treatedOrdinaryDesignFor(s);
    if (d) designs.push(d);
  }
  return designs;
}

/** Mixed into a seed for the picks of the outlined ordinaries. */
const OUTLINED_ORDINARY_SEED = 0x510e527f;

/**
 * The design for `seed` with a central band or shape edged or cotised once to three times (the cotises sometimes with a line of their own, or
 * counterchanged on a divided field), a cross or saltire sometimes hollow, with a line sometimes and sometimes a picture beside it. Null
 * when the pick isn't registrable.
 */
function outlinedOrdinaryDesignFor(seed: number): Design | null {
  const next = prng(seed ^ OUTLINED_ORDINARY_SEED);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const type = pick(['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'pall'] as const);
  const divided = next() < 0.3;
  const field = divided ? { k: 'divided', division: pick(['per-pale', 'per-fess', 'per-bend'] as const), parts: [pick(['or', 'argent']), pick(['azure', 'gules', 'sable', 'vert'])] } : pick(TINCTURES);
  const hollow = (type === 'cross' || type === 'saltire' || type === 'pall') && next() < 0.4;
  const mods = hollow ? ['voided'] : [];
  const line = next() < 0.3 ? pick(DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type, inverted: false }, l))) : null;
  const cotisedLine = next() < 0.25 ? pick(['plain', ...DRAWN_LINES.filter((l) => lineAllowed({ k: 'cotises', type }, l))]) : null;
  const edged = !hollow && next() < 0.4;
  const trim = edged
    ? { fimbriated: pick(TINCTURES) }
    : { cotised: { count: 1 + Math.floor(next() * 3), paint: divided && next() < 0.3 ? 'counterchanged' : pick(TINCTURES), ...(cotisedLine ? { line: cotisedLine } : {}) } };
  const groups: object[] = [{ item: { k: 'ordinary', type, mods, ...trim, ...(line ? { lines: { a: line } } : {}) }, paint: pick(TINCTURES) }];
  if (next() < 0.4) groups.push({ item: { k: 'charge', charge: pick(CHARGES) }, paint: pick(TINCTURES), count: 1 + Math.floor(next() * 3), relation: next() < 0.5 ? 'between' : null });
  const r = resolve({ v: 2, field, groups });
  if (!r.ok) return null;
  const n = normalise(r.design);
  return n.ok ? n.design : null;
}

/** The first `count` designs from `outlinedOrdinaryDesignFor`, trying seeds from `seed` upwards. */
export function generatedOutlinedOrdinaryDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = outlinedOrdinaryDesignFor(s);
    if (d) designs.push(d);
  }
  return designs;
}

/** Mixed into a seed for the picks of the corner and edge shapes. */
const PERIPHERAL_SEED = 0x9b05688c;
const CORNER_AND_EDGE = ['base', 'point', 'canton', 'quarter', 'gyron', 'orle', 'tressure', 'flaunches', 'gore', 'label', 'mount', 'trimount'] as const;

/**
 * The design for `seed` with one to three corner or edge shapes (a base, point pointed, canton, quarter, gyron, orle, double or triple
 * tressure, flaunches, gore, label, mount or trimount, sometimes in the sinister corner or on the sinister side, or with a line), alone or beside a band or a picture, sometimes with a chief or a bordure too. Null when the pick isn't registrable.
 */
function peripheralDesignFor(seed: number): Design | null {
  const next = prng(seed ^ PERIPHERAL_SEED);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const groups: object[] = [];
  const main = next();
  if (main < 0.35) groups.push({ item: { k: 'ordinary', type: pick(['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'pall', 'fret']) }, paint: pick(TINCTURES) });
  else if (main < 0.8) groups.push({ item: { k: 'charge', charge: pick(CHARGES) }, paint: pick(TINCTURES), count: 1 + Math.floor(next() * 3) });
  const shapes = new Set<(typeof CORNER_AND_EDGE)[number]>();
  for (let n = 1 + Math.floor(next() * next() * 3); shapes.size < n;) {
    const type = pick(CORNER_AND_EDGE);
    // an orle and a tressure lie in one place: one of them at most
    if (!((type === 'orle' && shapes.has('tressure')) || (type === 'tressure' && shapes.has('orle')))) shapes.add(type);
  }
  for (const type of shapes) {
    const mods = modDrawn(type, 'sinister') && next() < 0.3 ? ['sinister'] : [];
    const line = type !== 'point' && !['label', 'mount', 'trimount'].includes(type) && next() < 0.25 ? pick(DRAWN_LINES.filter((l) => lineAllowed({ k: 'ordinary', type, inverted: false }, l))) : null;
    groups.push({ item: { k: 'ordinary', type, mods, ...(line ? { lines: { a: line } } : {}) }, ...(type === 'tressure' ? { count: 2 + Math.floor(next() * 2) } : {}), paint: pick(TINCTURES) });
  }
  if (next() < 0.25) groups.push({ item: { k: 'ordinary', type: pick(['chief', 'bordure']) }, paint: pick(TINCTURES) });
  const r = resolve({ v: 2, field: pick(TINCTURES), groups });
  if (!r.ok) return null;
  const n = normalise(r.design);
  return n.ok ? n.design : null;
}

/** The first `count` designs from `peripheralDesignFor`, trying seeds from `seed` upwards. */
export function generatedPeripheralDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = peripheralDesignFor(s);
    if (d) designs.push(d);
  }
  return designs;
}

/** Mixed into a seed for the picks of the charge attribute designs. */
const ATTRIBUTE_SEED = 0x85ebca6b;
/** The charges the attribute designs use: beasts, a bird and a fish that face (and turn), and two charges that don't. */
const ATTRIBUTE_CHARGES = ['lion', 'wolf', 'eagle', 'fish', 'rose', 'mullet'];
const FACING_CHARGES = ['lion', 'wolf', 'eagle', 'fish'];
/** Charges that turn (§1.3): long, with a top, radial and an insect. */
const TURNING_CHARGES: readonly ChargeId[] = ['sword', 'key', 'crescent', 'billet', 'mullet', 'bee'];

/** The beasts the attribute designs draw as a head or a demi charge (§1.4 M1, M2), with the forms each is drawn in. */
const FORM_CHARGES: Partial<Record<ChargeId, readonly ('head' | 'demi')[]>> = { lion: ['head', 'demi'], wolf: ['head', 'demi'], eagle: ['demi'] };

/** The charges SENA A3C lets be voided or fimbriated (§1.4 M10). */
const OUTLINED_CHARGES: readonly ChargeId[] = ['mullet', 'roundel', 'lozenge', 'delf', 'billet', 'triangle'];

/**
 * The design for `seed` with a charge group whose charges carry the phase-D attributes (PLAN-D §0.3.9): about one design in three faces
 * to sinister (contourny) or is a pair (combattant, respectant or addorsed) on the field or around a pale; the rest are a charge group as
 * drawn, sometimes with a pale or a fess, and about a third of those are a charge that turns, set one of the ways it may be (§1.3). Of the
 * rest alone on the field, about two in five carry a modifier (§1.4): a mullet or estoile of 4 to 12 points (a mullet sometimes pierced),
 * or a simple geometric charge voided or fimbriated. About three in ten of the lions, wolves and eagles neither turned nor modified are a
 * head (half of them erased) or a demi charge. About three in ten of the whole beasts, eagles and fish neither turned nor modified are in
 * a posture they are drawn in (§1.2), half of those with the head turned where that posture is drawn so (the lion guardant or regardant,
 * §1.1 F4). Each later attribute step adds its picks after these. Null when the pick isn't registrable.
 */
function attributeDesignFor(seed: number): Design | null {
  const next = prng(seed ^ ATTRIBUTE_SEED);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const field = next() < 0.6 ? pick(TINCTURES) : { k: 'divided', division: pick(['per-pale', 'per-bend']), parts: [pick(TINCTURES), pick(TINCTURES)] };
  const attribute = next();
  const id = attribute < 0.33 ? pick(FACING_CHARGES) : pick(ATTRIBUTE_CHARGES);
  const band = next() < 0.3 ? pick(['pale', 'fess']) : null;
  const pair = attribute >= 0.15 && attribute < 0.33;
  const charge = { k: 'charge', charge: id, ...(attribute < 0.15 ? { facing: 'to-sinister' } : {}) };
  const group = {
    item: charge, paint: next() < 0.15 && typeof field === 'object' ? 'counterchanged' : pick(TINCTURES),
    count: pair ? 2 : 1 + Math.floor(next() * 3),
    ...(pair ? { arrangement: { k: 'pair', pair: pick(['combattant', 'respectant', 'addorsed']) } } : {}),
    ...(band ? { relation: 'between' } : {}),
  };
  const turning = attribute >= 0.33 && next() < 0.35 ? pick(TURNING_CHARGES) : null;
  const turned = turning ? { ...group, item: { k: 'charge', charge: turning, orientation: pick(CHARGE_META[turning].orient.allowed.filter((o) => o !== 'to-center' || group.count > 1)) } } : group;
  const modifier = !turning && !band && attribute >= 0.33 && next() < 0.4 ? next() : null;
  const modified = modifier === null ? turned : { ...turned, item: modifiedCharge(modifier, next, pick) };
  const forms = turning || modifier !== null ? undefined : FORM_CHARGES[id as ChargeId];
  const form = forms && next() < 0.3 ? pick(forms) : null;
  const formed = form === null ? modified : { ...modified, item: { ...charge, form, ...(form === 'head' && next() < 0.5 ? { mods: ['erased'] } : {}) } };
  const postures = form === null && !turning && modifier === null ? CHARGE_META[id as ChargeId].postures : null;
  const posture = postures && next() < 0.3 ? pick(postures) : null;
  const gazes = posture === null ? [] : (['guardant', 'regardant'] as const).filter((g) => CHARGE_META[id as ChargeId].drawings[`${posture}~${g}`]);
  const gaze = gazes.length > 0 && next() < 0.5 ? pick(gazes) : null;
  const posed = posture === null ? formed : { ...formed, item: { ...formed.item, posture, ...(gaze ? { gaze } : {}) } };
  const groups = band ? [{ item: { k: 'ordinary', type: band }, paint: pick(TINCTURES) }, posed] : [posed];
  const r = resolve({ v: 2, field, groups });
  if (!r.ok) return null;
  const n = normalise(r.design);
  return n.ok ? n.design : null;
}

/** A charge with a modifier picked by `roll`: a star of some points (a mullet sometimes pierced), a pierced mullet, a charge voided or fimbriated. */
function modifiedCharge(roll: number, next: () => number, pick: <T>(xs: readonly T[]) => T): object {
  if (roll < 0.4) {
    const id = pick(['mullet', 'estoile'] as const);
    return { k: 'charge', charge: id, mods: [{ id: 'of-points', count: 4 + Math.floor(next() * 9) }, ...(id === 'mullet' && next() < 0.3 ? ['pierced'] : [])] };
  }
  if (roll < 0.5) return { k: 'charge', charge: 'mullet', mods: ['pierced'] };
  return { k: 'charge', charge: pick(OUTLINED_CHARGES), mods: [roll < 0.75 ? 'voided' : { id: 'fimbriated', paint: pick(TINCTURES) }] };
}

/** The first `count` designs from `attributeDesignFor`, trying seeds from `seed` upwards. */
export function generatedChargeAttributeDesigns(seed: number, count: number): Design[] {
  const designs: Design[] = [];
  for (let s = seed; designs.length < count; s++) {
    const d = attributeDesignFor(s);
    if (d) designs.push(d);
  }
  return designs;
}
