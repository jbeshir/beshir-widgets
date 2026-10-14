// Charge metadata: 28 curated charges, their blazon/gloss names, articles, categories, drawn postures and
// the vocabulary of charge attributes (postures, facings, orientations, forms, modifiers, parts, holds).
// Artwork lives in charge-art.ts.

import { numberWord } from './words';

export const POSTURES = ['rampant', 'passant', 'statant', 'sejant', 'courant', 'salient', 'couchant', 'dormant', 'sejant-erect',
  'statant-erect', 'naiant', 'haurient', 'urinant', 'displayed', 'close', 'rising', 'volant', 'tergiant'] as const;
export type Posture = (typeof POSTURES)[number];

export const FACINGS = ['to-dexter', 'to-sinister', 'affronty', 'guardant', 'regardant', 'guardant-regardant'] as const;
export type Facing = (typeof FACINGS)[number];

export const ORIENTATIONS = ['palewise', 'fesswise', 'bendwise', 'bendwise-sinister', 'inverted', 'reversed'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const CHARGE_FORMS = ['head', 'demi', 'jambe', 'skull'] as const;
export type ChargeForm = (typeof CHARGE_FORMS)[number];

export const MODIFIER_IDS = ['in-splendour', 'couped', 'erased', 'slipped', 'leaved', 'fructed', 'enflamed', 'winged', 'voided', 'of-points'] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

export const PART_IDS = ['armed', 'langued', 'crowned', 'collared', 'attired', 'unguled', 'beaked', 'membered', 'seeded', 'barbed'] as const;
export type PartId = (typeof PART_IDS)[number];

export const HOLD_HOWS = ['maintaining', 'sustaining', 'in-beak', 'in-mouth', 'wearing'] as const;
export type HoldHow = (typeof HOLD_HOWS)[number];

/** Plain-English posture words for the gloss. Displayed is folded into the eagle's gloss name. */
export const POSTURE_GLOSS: Record<Posture, string | null> = {
  rampant: 'rearing up', passant: 'walking', statant: 'standing', sejant: 'sitting', courant: 'running', salient: 'leaping',
  couchant: 'lying down', dormant: 'asleep', 'sejant-erect': 'sitting upright', 'statant-erect': 'standing upright',
  naiant: 'swimming', haurient: 'upright, head up', urinant: 'diving, head down', displayed: null,
  close: 'perched, wings folded', rising: 'taking off', volant: 'flying', tergiant: 'seen from above',
};

export type ChargeCategory = 'beast' | 'monster' | 'bird' | 'plant' | 'geometric' | 'object' | 'modern';

export const CHARGE_CATEGORIES: readonly ChargeCategory[] = ['beast', 'monster', 'bird', 'plant', 'geometric', 'object', 'modern'];

export const CATEGORY_LABEL: Record<ChargeCategory, string> = {
  beast: 'Beasts', monster: 'Monsters', bird: 'Birds', plant: 'Plants',
  geometric: 'Shapes', object: 'Objects', modern: 'Modern',
};

export const CHARGE_IDS = [
  'lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'fish', 'bee',
  'unicorn', 'dragon',
  'eagle', 'owl',
  'rose', 'tree', 'fleur-de-lis',
  'mullet', 'crescent', 'sun', 'heart',
  'key', 'open-book', 'sword', 'crown', 'anchor',
  'musical-note', 'flame', 'gear', 'lightbulb',
] as const;

export type ChargeId = (typeof CHARGE_IDS)[number];

/**
 * SENA A5E2 type classes: a charge of one class is substantially different in type from a charge of any other (a
 * substantial change for the primary group); two charges of one class differ by at most a distinct change of type
 * (A5G4). SENA has no complete table (RULES §C.4 SC-2, §G.1), so this is a curated one: each class says why. Classes
 * marked `guess` are the builder's reading where neither SENA nor a precedent in /workspace/rules names the pair —
 * herald question H2 (REVIEW.md).
 */
export const TYPE_CLASSES = {
  feline: { source: 'A5C3: a lion is not different from any other natural feline; A5E2: "four wolves … does not conflict with … semy of lions"', guess: false },
  canine: { source: 'A5C3: dogs, wolves and foxes are one type; A5E2: wolves and lions are substantially different', guess: false },
  boar: { source: 'A5G4: types distinct in period; no SENA example against the other beasts', guess: true },
  deer: { source: 'A5G4: types distinct in period; no SENA example against the goat or the unicorn', guess: true },
  goat: { source: 'A5G4: types distinct in period; no SENA example against the stag or the unicorn', guess: true },
  hare: { source: 'A5G4: types distinct in period; no SENA example against the other beasts', guess: true },
  unicorn: { source: 'A5E2: "two unicorns and a raven … does not conflict with … three sea-horses" (monsters by type); not against the goat', guess: true },
  dragon: { source: 'App M1e names only the near kin of the dragon (wyvern, sea-dragon: a DC); no SENA example against the four-legged beasts', guess: true },
  fish: { source: 'A5C3/App M1b: most fish are one type; A5E2: clearly unrelated shapes are substantially different', guess: false },
  bee: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  'regular-bird': { source: 'App M1d: eagle and owl are both regular-shaped birds; LoAR 2024-26: "owls and eagles are both regular-shaped birds, there is a single DC" for their type', guess: false },
  rose: { source: 'App M1i: few-petaled flowers in affronty view; precedent: "a substantial difference between a roundel and a rose"', guess: false },
  tree: { source: 'App M1h: trees conflict only with trees (generic vs coniferous a DC)', guess: false },
  'fleur-de-lys': { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  'mullet-or-sun': { source: 'A5G4: "a DC for the change … from a mullet of five points to a sun"; App M1g', guess: false },
  crescent: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  heart: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  key: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  book: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  sword: { source: 'A5C3: swords and daggers of all forms are one type', guess: false },
  crown: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  anchor: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  'musical-note': { source: 'A5G4: a charge not used in period differs in type by a distinct change of shape; substantial by our reading', guess: true },
  flame: { source: 'A5E2: clearly unrelated shapes; whether a flame is near enough to a sun for only a DC is unsettled', guess: true },
  cogwheel: { source: 'A5G4: a charge not used in period differs in type by a distinct change of shape; substantial by our reading', guess: true },
  lightbulb: { source: 'A5G4: a charge not used in period differs in type by a distinct change of shape; substantial by our reading', guess: true },
} as const satisfies Record<string, { source: string; guess: boolean }>;

export type TypeClass = keyof typeof TYPE_CLASSES;

/** Which postures a charge can be compared across when it changes posture (SENA App M3). */
export type PostureClass = 'quadruped' | 'bird' | 'fish' | 'insect';

/** A charge-specific posture word: the blazon term and its plain-English gloss ("trippant", "walking"). */
interface PostureWording { term: string; gloss: string }

interface ChargeMeta {
  id: ChargeId;
  /** Blazon name (singular / plural). */
  name: string;
  plural: string;
  /** Stored, never computed from the first letter ("an open book"). */
  article: 'a' | 'an';
  category: ChargeCategory;
  /** Drawn postures, or null when posture-less. */
  postures: readonly Posture[] | null;
  /** The builder's (and resolve's) choice when none is given. */
  defaultPosture: Posture | null;
  /** The posture SCA practice assumes when none is blazoned (GoT Table 5): it is omitted from the blazon. */
  scaDefaultPosture: Posture | null;
  /** This charge's own words for a posture, overriding the posture id and POSTURE_GLOSS. */
  postureWording: Partial<Record<Posture, PostureWording>>;
  /** 'to-dexter' for posture-bearing charges, else null. */
  defaultFacing: Facing | null;
  /** Drawn modifiers. */
  mods: readonly ModifierId[];
  /** May be 'crossed' (two in saltire). */
  long: boolean;
  postureClass: PostureClass | null;
  /** Charges of different classes are substantially different (SENA A5E2; see TYPE_CLASSES). */
  typeClass: TypeClass;
  /** Gloss names (singular / plural). */
  glossName: string;
  glossPlural: string;
  /** Default orientation, for documentation and the artist. */
  orientation: string;
  /**
   * Optical scale applied to the slot box when drawing, so charges of different ink weight look the
   * same size: slender charges (sword, key) are drawn larger, solid ones (heart, rose) smaller.
   */
  scale: number;
  /** How much fine detail the silhouette has: 0 = bold at a glance, 1 = detailed, 2 = intricate. Costs readability points. */
  detail: 0 | 1 | 2;
}

type Fixed = Pick<ChargeMeta, 'id' | 'name' | 'plural' | 'article' | 'category' | 'typeClass' | 'glossName' | 'glossPlural' | 'orientation' | 'scale' | 'detail'>;
type Variable = Partial<Pick<ChargeMeta, 'postures' | 'defaultPosture' | 'scaDefaultPosture' | 'postureWording' | 'mods' | 'long' | 'postureClass'>>;

function c(fixed: Fixed, v: Variable = {}): ChargeMeta {
  const postures = v.postures ?? null;
  return {
    ...fixed,
    postures,
    defaultPosture: v.defaultPosture ?? null,
    scaDefaultPosture: v.scaDefaultPosture ?? null,
    postureWording: v.postureWording ?? {},
    defaultFacing: postures ? 'to-dexter' : null,
    mods: v.mods ?? [],
    long: v.long ?? false,
    postureClass: v.postureClass ?? null,
  };
}

const quadruped = { postureClass: 'quadruped' } as const;

export const CHARGES: Record<ChargeId, ChargeMeta> = {
  lion: c({ id: 'lion', name: 'lion', plural: 'lions', article: 'a', category: 'beast', typeClass: 'feline', glossName: 'lion', glossPlural: 'lions', orientation: 'faces dexter', scale: 1, detail: 1 },
    { postures: ['rampant', 'passant', 'statant', 'sejant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', ...quadruped }),
  wolf: c({ id: 'wolf', name: 'wolf', plural: 'wolves', article: 'a', category: 'beast', typeClass: 'canine', glossName: 'wolf', glossPlural: 'wolves', orientation: 'faces dexter', scale: 1.05, detail: 1 },
    { postures: ['rampant', 'passant', 'statant'], defaultPosture: 'passant', ...quadruped }),
  boar: c({ id: 'boar', name: 'boar', plural: 'boars', article: 'a', category: 'beast', typeClass: 'boar', glossName: 'boar', glossPlural: 'boars', orientation: 'faces dexter', scale: 1, detail: 1 },
    { postures: ['passant'], defaultPosture: 'passant', ...quadruped }),
  stag: c({ id: 'stag', name: 'stag', plural: 'stags', article: 'a', category: 'beast', typeClass: 'deer', glossName: 'stag', glossPlural: 'stags', orientation: 'faces dexter', scale: 1.05, detail: 1 },
    { postures: ['statant', 'passant'], defaultPosture: 'statant', postureWording: { passant: { term: 'trippant', gloss: 'walking' } }, ...quadruped }),
  goat: c({ id: 'goat', name: 'goat', plural: 'goats', article: 'a', category: 'beast', typeClass: 'goat', glossName: 'goat', glossPlural: 'goats', orientation: 'faces dexter', scale: 1, detail: 1 },
    { postures: ['statant', 'rampant'], defaultPosture: 'statant', ...quadruped }),
  hare: c({ id: 'hare', name: 'hare', plural: 'hares', article: 'a', category: 'beast', typeClass: 'hare', glossName: 'hare', glossPlural: 'hares', orientation: 'faces dexter', scale: 1.05, detail: 1 },
    { postures: ['sejant', 'courant'], defaultPosture: 'sejant', ...quadruped }),
  fish: c({ id: 'fish', name: 'fish', plural: 'fish', article: 'a', category: 'beast', typeClass: 'fish', glossName: 'fish', glossPlural: 'fish', orientation: 'head to dexter (naiant) / head up (haurient)', scale: 1.05, detail: 0 },
    { postures: ['naiant', 'haurient'], defaultPosture: 'naiant', scaDefaultPosture: 'naiant', postureClass: 'fish' }),
  bee: c({ id: 'bee', name: 'bee', plural: 'bees', article: 'a', category: 'beast', typeClass: 'bee', glossName: 'bee', glossPlural: 'bees', orientation: 'head up (tergiant, fixed)', scale: 1.05, detail: 0 },
    { postureClass: 'insect' }),
  unicorn: c({ id: 'unicorn', name: 'unicorn', plural: 'unicorns', article: 'a', category: 'monster', typeClass: 'unicorn', glossName: 'unicorn', glossPlural: 'unicorns', orientation: 'faces dexter', scale: 1, detail: 2 },
    { postures: ['rampant', 'passant', 'sejant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', ...quadruped }),
  dragon: c({ id: 'dragon', name: 'dragon', plural: 'dragons', article: 'a', category: 'monster', typeClass: 'dragon', glossName: 'dragon', glossPlural: 'dragons', orientation: 'faces dexter', scale: 0.9, detail: 2 },
    { postures: ['rampant', 'passant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', postureWording: { rampant: { term: 'segreant', gloss: 'rearing up' } }, ...quadruped }),
  eagle: c({ id: 'eagle', name: 'eagle', plural: 'eagles', article: 'an', category: 'bird', typeClass: 'regular-bird', glossName: 'eagle with spread wings', glossPlural: 'eagles with spread wings', orientation: 'head to dexter', scale: 0.95, detail: 0 },
    { postures: ['displayed'], defaultPosture: 'displayed', scaDefaultPosture: 'displayed', postureClass: 'bird' }),
  owl: c({ id: 'owl', name: 'owl', plural: 'owls', article: 'an', category: 'bird', typeClass: 'regular-bird', glossName: 'owl', glossPlural: 'owls', orientation: 'upright, facing out', scale: 1, detail: 1 },
    { postureClass: 'bird' }),
  rose: c({ id: 'rose', name: 'rose', plural: 'roses', article: 'a', category: 'plant', typeClass: 'rose', glossName: 'rose', glossPlural: 'roses', orientation: 'upright', scale: 0.88, detail: 0 }),
  tree: c({ id: 'tree', name: 'tree', plural: 'trees', article: 'a', category: 'plant', typeClass: 'tree', glossName: 'tree', glossPlural: 'trees', orientation: 'upright', scale: 0.95, detail: 2 }),
  'fleur-de-lis': c({ id: 'fleur-de-lis', name: 'fleur-de-lys', plural: 'fleurs-de-lys', article: 'a', category: 'plant', typeClass: 'fleur-de-lys', glossName: 'lily (fleur-de-lis)', glossPlural: 'lilies (fleurs-de-lis)', orientation: 'upright', scale: 1, detail: 0 }),
  mullet: c({ id: 'mullet', name: 'mullet', plural: 'mullets', article: 'a', category: 'geometric', typeClass: 'mullet-or-sun', glossName: 'five-pointed star', glossPlural: 'five-pointed stars', orientation: 'one point up', scale: 1.05, detail: 0 }),
  crescent: c({ id: 'crescent', name: 'crescent', plural: 'crescents', article: 'a', category: 'geometric', typeClass: 'crescent', glossName: 'crescent moon', glossPlural: 'crescent moons', orientation: 'horns up', scale: 1.05, detail: 0 }),
  sun: c({ id: 'sun', name: 'sun', plural: 'suns', article: 'a', category: 'geometric', typeClass: 'mullet-or-sun', glossName: 'sun', glossPlural: 'suns', orientation: '—', scale: 1, detail: 0 },
    { mods: ['in-splendour'] }),
  heart: c({ id: 'heart', name: 'heart', plural: 'hearts', article: 'a', category: 'geometric', typeClass: 'heart', glossName: 'heart', glossPlural: 'hearts', orientation: 'point down', scale: 0.88, detail: 0 }),
  key: c({ id: 'key', name: 'key', plural: 'keys', article: 'a', category: 'object', typeClass: 'key', glossName: 'key', glossPlural: 'keys', orientation: 'wards up, bow down', scale: 1.15, detail: 1 },
    { long: true }),
  'open-book': c({ id: 'open-book', name: 'open book', plural: 'open books', article: 'an', category: 'object', typeClass: 'book', glossName: 'open book', glossPlural: 'open books', orientation: 'upright', scale: 0.9, detail: 1 }),
  sword: c({ id: 'sword', name: 'sword', plural: 'swords', article: 'a', category: 'object', typeClass: 'sword', glossName: 'sword', glossPlural: 'swords', orientation: 'point up', scale: 1.15, detail: 1 },
    { long: true }),
  crown: c({ id: 'crown', name: 'crown', plural: 'crowns', article: 'a', category: 'object', typeClass: 'crown', glossName: 'crown', glossPlural: 'crowns', orientation: 'upright', scale: 0.95, detail: 0 }),
  anchor: c({ id: 'anchor', name: 'anchor', plural: 'anchors', article: 'an', category: 'object', typeClass: 'anchor', glossName: 'anchor', glossPlural: 'anchors', orientation: 'ring up', scale: 1.15, detail: 0 },
    { long: true }),
  'musical-note': c({ id: 'musical-note', name: 'musical note', plural: 'musical notes', article: 'a', category: 'modern', typeClass: 'musical-note', glossName: 'musical note', glossPlural: 'musical notes', orientation: 'stem up, flag to sinister', scale: 1.15, detail: 1 }),
  flame: c({ id: 'flame', name: 'flame', plural: 'flames', article: 'a', category: 'modern', typeClass: 'flame', glossName: 'flame', glossPlural: 'flames', orientation: 'tongues up', scale: 0.95, detail: 0 }),
  gear: c({ id: 'gear', name: 'cogwheel', plural: 'cogwheels', article: 'a', category: 'modern', typeClass: 'cogwheel', glossName: 'gear', glossPlural: 'gears', orientation: '—', scale: 0.9, detail: 0 }),
  lightbulb: c({ id: 'lightbulb', name: 'lightbulb', plural: 'lightbulbs', article: 'a', category: 'modern', typeClass: 'lightbulb', glossName: 'lightbulb', glossPlural: 'lightbulbs', orientation: 'bulb up', scale: 1.1, detail: 1 }),
};

export function isChargeId(value: unknown): value is ChargeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHARGES, value);
}

export function isChargeCategory(value: unknown): value is ChargeCategory {
  return typeof value === 'string' && (CHARGE_CATEGORIES as readonly string[]).includes(value);
}

const isIn = <T extends string>(list: readonly T[]) => (value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export const isPosture = isIn(POSTURES);
export const isFacing = isIn(FACINGS);
export const isOrientation = isIn(ORIENTATIONS);
export const isChargeForm = isIn(CHARGE_FORMS);
export const isModifierId = isIn(MODIFIER_IDS);
export const isPartId = isIn(PART_IDS);
export const isHoldHow = isIn(HOLD_HOWS);

/** Blazon word for a posture on a given charge ("segreant" for a rampant dragon). */
export function postureTerm(id: ChargeId, p: Posture): string {
  return CHARGES[id].postureWording[p]?.term ?? p;
}

/** Plain-English word for a posture on a given charge; null for displayed. */
export function postureGloss(id: ChargeId, p: Posture): string | null {
  return CHARGES[id].postureWording[p]?.gloss ?? POSTURE_GLOSS[p];
}

/** "a rose" / "three roses": a group of charges in words. */
export function chargePhrase(id: ChargeId, count: number): string {
  const meta = CHARGES[id];
  return count === 1 ? `${meta.article} ${meta.name}` : `${numberWord(count)} ${meta.plural}`;
}

/** Charges in a category, in table order. */
export function chargesInCategory(cat: ChargeCategory): ChargeMeta[] {
  return CHARGE_IDS.map((id) => CHARGES[id]).filter((m) => m.category === cat);
}
