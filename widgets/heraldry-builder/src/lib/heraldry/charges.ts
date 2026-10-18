// Charge vocabulary: the charge ids and categories, the type classes, and the charge attributes (postures, facings,
// orientations, forms, modifiers, parts, holds). Each charge's metadata is its sidecar row in art/meta; its art is in art/paths.

import type { ChargeMeta, ChargeMetaRow } from './art/types';
import { META_BEAST } from './art/meta/beast';
import { META_BIRD } from './art/meta/bird';
import { META_CROSS } from './art/meta/cross';
import { META_GEOMETRIC } from './art/meta/geometric';
import { META_MODERN } from './art/meta/modern';
import { META_MONSTER } from './art/meta/monster';
import { META_OBJECT } from './art/meta/object';
import { META_PLANT } from './art/meta/plant';
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

export const MODIFIER_IDS = ['in-splendour', 'couped', 'erased', 'slipped', 'leaved', 'fructed', 'enflamed', 'winged', 'voided', 'of-points', 'fitchy'] as const;
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

export type ChargeCategory = 'beast' | 'monster' | 'bird' | 'plant' | 'geometric' | 'cross' | 'object' | 'modern';

export const CHARGE_CATEGORIES: readonly ChargeCategory[] = ['beast', 'monster', 'bird', 'plant', 'geometric', 'cross', 'object', 'modern'];

export const CATEGORY_LABEL: Record<ChargeCategory, string> = {
  beast: 'Beasts', monster: 'Monsters', bird: 'Birds', plant: 'Plants',
  geometric: 'Shapes', cross: 'Crosses', object: 'Objects', modern: 'Modern',
};

export const CHARGE_IDS = [
  'lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'fish', 'bee',
  'unicorn', 'dragon',
  'eagle', 'owl',
  'rose', 'tree', 'fleur-de-lis',
  'mullet', 'crescent', 'sun', 'heart',
  'key', 'open-book', 'sword', 'crown', 'anchor',
  'musical-note', 'flame', 'gear', 'lightbulb',
  'roundel', 'annulet', 'billet', 'lozenge', 'goutte', 'cross-crosslet', 'estoile', 'spark',
  'compass-star', 'mascle', 'rustre', 'fusil', 'delf', 'triangle', 'triquetra', 'trefoil', 'quatrefoil', 'cinquefoil', 'ermine-spot',
  'cross-couped', 'cross-latin', 'cross-formy', 'cross-bottony', 'cross-moline', 'cross-flory', 'cross-patonce', 'cross-potent',
  'cross-maltese', 'cross-celtic', 'cross-tau',
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
  rose: { source: 'App M1i: few-petaled flowers in affronty view; foils are flowers of as many petals (01/2025 CL); precedent: "a substantial difference between a roundel and a rose"', guess: false },
  tree: { source: 'App M1h: trees conflict only with trees (generic vs coniferous a DC)', guess: false },
  'fleur-de-lys': { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  'mullet-or-sun': { source: 'A5G4: "a DC for the change … from a mullet of five points to a sun"; App M1g (mullets, compass stars, estoiles, suns)', guess: false },
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
  roundel: { source: 'A3E2: the roundel and goutte families are one type each; precedent: "a substantial difference between a roundel and a rose"; an annulet is a DC from a roundel (Halawa bint Tariq 05/2023; herald question D20)', guess: true },
  billet: { source: 'A5E2: clearly unrelated shapes are substantially different; billet, delf and triangle a DC apart (Violeta de Valencia 03/2021)', guess: true },
  lozenge: { source: 'A5E2: clearly unrelated shapes are substantially different; lozenge, mascle, rustre and fusil a DC apart (Alicia le Wilfulle 05/2021)', guess: true },
  goutte: { source: 'A3E2: the roundel and goutte families are one type each', guess: true },
  'cross-couped': { source: 'App M1f family 1: a plain cross couped, equal-armed or Latin, is one type with the ordinary cross couped (herald questions D12, D22)', guess: false },
  'cross-crosslet': { source: 'App M1f family 3: the cross crosslet and the cross bottony, a DC apart (herald question D13)', guess: false },
  'cross-flory': { source: 'App M1f family 2: the cross flory and the cross patonce, a DC apart (Guillaume of the Shadowlands 10/2015)', guess: false },
  'cross-moline': { source: 'App M1f family 4', guess: false },
  'cross-formy': { source: 'App M1f family 5; substantially different from the Maltese cross (Gilbert des Moulins 12/2023)', guess: false },
  'cross-potent': { source: 'App M1f family 7', guess: false },
  'cross-tau': { source: 'App M1f family 8', guess: false },
  'cross-maltese': { source: 'App M1f family 13; substantially different from the cross formy (Gilbert des Moulins 12/2023)', guess: false },
  'cross-celtic': { source: 'Not among the families of App M1f; at least a DC from the crosses bottony, formy and couped, read here as a type of its own (herald question D14)', guess: true },
  spark: { source: 'A5E2: clearly unrelated shapes are substantially different; the spark is the charge of estencely', guess: true },
  triquetra: { source: 'A5E2: clearly unrelated shapes are substantially different; no SENA example against the other knots', guess: true },
  'ermine-spot': { source: 'A5E2: clearly unrelated shapes are substantially different; no SENA example against the goutte or the other tails', guess: true },
} as const satisfies Record<string, { source: string; guess: boolean }>;

export type TypeClass = keyof typeof TYPE_CLASSES;

/** Which postures a charge can be compared across when it changes posture (SENA App M3). */
export type PostureClass = 'quadruped' | 'bird' | 'fish' | 'insect';

const ROWS: Record<ChargeId, ChargeMetaRow> = {
  ...META_BEAST, ...META_MONSTER, ...META_BIRD, ...META_PLANT, ...META_GEOMETRIC, ...META_CROSS, ...META_OBJECT, ...META_MODERN,
};

/** Every charge's metadata (its sidecar row in art/meta), with its id and default facing. */
export const CHARGES = Object.fromEntries(CHARGE_IDS.map((id): [ChargeId, ChargeMeta] =>
  [id, { ...ROWS[id], id, defaultFacing: ROWS[id].faces ? 'to-dexter' : null }])) as Record<ChargeId, ChargeMeta>;

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
