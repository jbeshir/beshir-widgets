// Charge vocabulary: the charge ids and categories, the type classes, and the charge attributes (postures, facings, gazes,
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
  'statant-erect', 'naiant', 'haurient', 'urinant', 'displayed', 'close', 'rising', 'volant', 'tergiant', 'erect', 'glissant', 'nowed'] as const;
export type Posture = (typeof POSTURES)[number];

/** Which way a charge's body faces: to dexter (as drawn), to sinister (contourny: the drawing mirrored), or out of the shield. */
export const FACINGS = ['to-dexter', 'to-sinister', 'affronty'] as const;
export type Facing = (typeof FACINGS)[number];

/** Which way a beast's head is turned, whatever its body does: out of the shield, back over its shoulder, or both. */
export const GAZES = ['guardant', 'regardant', 'guardant-regardant'] as const;
export type Gaze = (typeof GAZES)[number];

/**
 * Which way an inanimate charge (or an insect) points, as directions on the shield for art drawn palewise top up (PLAN-D §1.3): fesswise
 * has its top to dexter, bendwise to dexter chief, bendwise sinister to sinister chief, and each reversed or inverted the other way;
 * reversed is the drawing mirrored; to center turns the top of each charge to the middle of its group.
 */
export const ORIENTATIONS = ['palewise', 'fesswise', 'fesswise-reversed', 'bendwise', 'bendwise-inverted', 'bendwise-sinister',
  'bendwise-sinister-inverted', 'inverted', 'reversed', 'to-center'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const CHARGE_FORMS = ['head', 'demi', 'jambe', 'skull'] as const;
export type ChargeForm = (typeof CHARGE_FORMS)[number];

export const MODIFIER_IDS = ['in-splendour', 'couped', 'erased', 'slipped', 'leaved', 'fructed', 'enflamed', 'winged', 'voided', 'of-points', 'fitchy', 'fimbriated', 'pierced'] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

/** How a head is cut off: straight (couped) or torn (erased). A head is one or the other, couped when neither is given (§0.3: heads always state their cut). */
export const CUT_MODIFIERS: readonly ModifierId[] = ['couped', 'erased'];

/** The stars that may be given a number of points (`of-points`), and the number each is drawn with when none is given. */
export const DRAWN_POINTS = { mullet: 5, estoile: 6 } as const satisfies Partial<Record<ChargeId, number>>;

/** How many points a star may be given ("of six points", "of eight rays"): at least 4, at most 12. */
export const STAR_POINTS: readonly number[] = [4, 5, 6, 7, 8, 9, 10, 11, 12];

/** How many points a star is drawn with when none is given ("a mullet": five), or null for a charge that takes no number of points. */
export const drawnPoints = (id: ChargeId): number | null => (id in DRAWN_POINTS ? DRAWN_POINTS[id as keyof typeof DRAWN_POINTS] : null);

export const PART_IDS = ['armed', 'langued', 'crowned', 'collared', 'attired', 'unguled', 'beaked', 'membered', 'seeded', 'barbed'] as const;
export type PartId = (typeof PART_IDS)[number];

export const HOLD_HOWS = ['maintaining', 'sustaining', 'in-beak', 'in-mouth', 'wearing'] as const;
export type HoldHow = (typeof HOLD_HOWS)[number];

/** Plain-English posture words for the gloss. Displayed is folded into the eagle's gloss name. */
export const POSTURE_GLOSS: Record<Posture, string | null> = {
  rampant: 'rearing up', passant: 'walking', statant: 'standing', sejant: 'sitting', courant: 'running', salient: 'leaping',
  couchant: 'lying down', dormant: 'sleeping', 'sejant-erect': 'sitting up', 'statant-erect': 'standing on hind legs',
  naiant: 'swimming', haurient: 'upright, head up', urinant: 'diving, head down', displayed: null,
  close: 'perched, wings folded', rising: 'taking off', volant: 'flying', tergiant: 'seen from above',
  erect: 'upright', glissant: 'gliding', nowed: 'knotted',
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
  'wing',
  'cat', 'bear', 'horse', 'fox', 'squirrel',
  'raven', 'griffin', 'swan', 'phoenix', 'wyvern', 'falcon', 'pegasus', 'seahorse', 'peacock', 'martlet', 'dove', 'sea-lion',
  'arrow', 'hammer', 'harp', 'axe', 'pheon', 'feather', 'needle', 'anvil', 'spear', 'trident',
  'escallop', 'dragonfly', 'thistle', 'dolphin', 'butterfly', 'laurel-wreath', 'oak-leaf', 'acorn', 'serpent', 'frog', 'pomegranate', 'lily', 'garb', 'spider', 'scorpion',
  'tower', 'hand', 'pawprint', 'comet', 'goblet', 'chalice', 'castle', 'bell', 'tankard',
  'hawk', 'rapier', 'dagger', 'coney', 'rabbit', 'vol', 'coronet',
  'escarbuncle', 'seeblatt', 'wheel', 'catherine-wheel',
] as const;

export type ChargeId = (typeof CHARGE_IDS)[number];

/** The charges with no drawings of their own: each is drawn from another charge's (art/procedural/derived.ts; PLAN-D §2.4). */
export const ALIAS_IDS = ['hawk', 'rapier', 'dagger', 'coney', 'rabbit', 'vol', 'coronet'] as const satisfies readonly ChargeId[];
export type AliasId = (typeof ALIAS_IDS)[number];
export const isAliasId = (id: ChargeId): id is AliasId => (ALIAS_IDS as readonly ChargeId[]).includes(id);

/** The pictures the picker offers first, in this order: the original pictures; later pictures are added as they are drawn (PLAN-D §2.4). */
export const POPULAR_CHARGE_IDS: readonly ChargeId[] = [
  'lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'fish', 'bee',
  'unicorn', 'dragon',
  'eagle', 'owl',
  'rose', 'tree', 'fleur-de-lis',
  'mullet', 'crescent', 'sun', 'heart',
  'key', 'open-book', 'sword', 'crown', 'anchor',
  'musical-note', 'flame', 'gear', 'lightbulb',
  'roundel', 'annulet', 'billet', 'lozenge', 'goutte', 'cross-crosslet', 'estoile', 'spark',
  'cat', 'bear', 'horse', 'fox', 'raven', 'griffin', 'swan', 'phoenix', 'arrow', 'escallop', 'dolphin', 'tower',
];

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
  'regular-bird': { source: 'App M1d: every bird is one class, told apart by its shape (regular, swan, poultry: `birdShape`, PLAN-D T6); LoAR 2024-26: "owls and eagles are both regular-shaped birds, there is a single DC" for their type; Teodr\' Viktorov 08/2023: a raven is a falcon', guess: false },
  rose: { source: 'App M1i: few-petaled flowers in affronty view; foils are flowers of as many petals (01/2025 CL); precedent: "a substantial difference between a roundel and a rose"', guess: false },
  tree: { source: 'App M1h: trees conflict only with trees (generic vs coniferous a DC)', guess: false },
  'fleur-de-lys': { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  'mullet-or-sun': { source: 'A5G4: "a DC for the change … from a mullet of five points to a sun"; App M1g (mullets, compass stars, estoiles, suns)', guess: false },
  crescent: { source: 'A5E2: clearly unrelated shapes are substantially different', guess: false },
  heart: { source: 'A5E2: clearly unrelated shapes are substantially different; the seeblatt shares the class with a type token of its own (heart vs seeblatt DC: no SENA example, by the likeness of their outlines; herald question)', guess: false },
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
  wing: { source: 'A5E2: clearly unrelated shapes are substantially different; no SENA example against the feather or the bird', guess: true },
  bear: { source: 'A5G4: types distinct in period; bear vs wolverine no difference (Jurgen der Vielfrass 08/2018)', guess: true },
  horse: { source: 'A5G4: types distinct in period; William Ulfsson 08/2014: wolves\' heads vs horses\' heads "more than a DC"; pegasus is a horse +winged (Vagn Feilan 11/2014)', guess: false },
  griffin: { source: 'A5G4: types distinct in period; A5G7a compares a griffin segreant only with an eagle displayed (postures not comparable); no SENA example against the dragon or the lion', guess: true },
  seahorse: { source: 'A5E2: "two unicorns and a raven … does not conflict with … three sea-horses" (sea-monsters by type); App M3 lists sea-creatures among the tailed bipeds; no SENA example against the horse', guess: true },
  'sea-lion': { source: 'A5G4: types distinct in period; App M3 lists sea-creatures among the tailed bipeds; no SENA example against the lion or the sea-horse', guess: true },
  squirrel: { source: 'A5G4: types distinct in period; no SENA example against the other beasts', guess: true },
  arrow: { source: 'A5E2: clearly unrelated shapes are substantially different; App L2 / A5G7b compare an arrow with a sword only for orientation; arrow vs pheon/spear no SENA example', guess: true },
  axe: { source: 'A5G4: a claymore is distinctly (not substantially) changed from an axe; kept a class of its own (herald question D17)', guess: true },
  hammer: { source: 'A5E2: clearly unrelated shapes are substantially different; hammer vs mallet/Thor\'s hammer no SENA example', guess: true },
  harp: { source: 'A5E2: clearly unrelated shapes are substantially different; GoT Table 5 "Harp": forepillar details artistic; harp vs lyre no SENA example', guess: true },
  pheon: { source: 'A5E2: clearly unrelated shapes are substantially different; GoT Table 5 treats pheon and arrowhead alike for orientation; pheon vs arrow no SENA example', guess: true },
  feather: { source: 'A5E2: clearly unrelated shapes are substantially different; feather vs quill pen no SENA example', guess: true },
  needle: { source: 'A5E2: clearly unrelated shapes are substantially different; needle vs other slender tools (awl, nail) no SENA example', guess: true },
  anvil: { source: 'A5E2: clearly unrelated shapes are substantially different; GoT Table 5: horn direction and number of horns are artistic', guess: true },
  spear: { source: 'A5E2: clearly unrelated shapes are substantially different; spear vs lance/pike/trident no SENA example', guess: true },
  trident: { source: 'A5E2: clearly unrelated shapes are substantially different; trident vs spear/salmon-spear no SENA example', guess: true },
  acorn: { source: 'A5G4: types distinct in period; A5E2: clearly unrelated shapes are substantially different; no SENA example against other fruit or nuts', guess: true },
  garb: { source: 'A5G4: types distinct in period; A5E2: clearly unrelated shapes are substantially different; no SENA example against the other plants', guess: true },
  chaplet: { source: 'App M1k: chaplets and wreaths differ by a DC only as their leaves differ (App M1j); A5E2: clearly unrelated shapes are substantially different', guess: false },
  'trumpet-flower': { source: 'App M1i: "no difference for type between trumpet-shaped flowers in profile (columbines, lilies, tulips, daffodils, etc.)"; an SC between few-petaled flowers affronty, multi-petaled flowers affronty and trumpet-shaped flowers in profile', guess: false },
  leaf: { source: 'App M1j (01/2024 CL): leaves in different categories (leaf-, heart-, maple-, oak-, frond-, fan-shaped) have a DC between them, leaves of one category conflict; A5E2: clearly unrelated shapes are substantially different', guess: false },
  fruit: { source: 'A5G4: types distinct in period; A5E2: clearly unrelated shapes are substantially different; no SENA example against the other round fruit', guess: true },
  thistle: { source: 'App M1i: flowers outside the petal categories are "treated as individual cases, by type"; A5E2: clearly unrelated shapes are substantially different; no SENA example against the rose or the tree', guess: true },
  butterfly: { source: 'A5G4: types distinct in period; A5E5a groups the butterfly with the bee as compact tergiant creatures (no comparable postures); no SENA example against the bee or the dragonfly', guess: true },
  dragonfly: { source: 'A5G4: types distinct in period; A5E5a treats the dragonfly as a long tergiant creature (comparable orientations), unlike the compact bee and butterfly; no SENA example against another insect', guess: true },
  frog: { source: 'A5G4: types distinct in period; App M3 lists frogs among the quadrupeds that can be tergiant (filed under the insect posture class here only as a modelling shortcut, PLAN-D §1.2); frog = toad (GoT Table 5 "Toad: see Frog")', guess: true },
  scorpion: { source: 'A5G4: types distinct in period; GoT Table 5 gives the scorpion its own default (tergiant, head to chief, Valentine l\'Argent 05/2023); no SENA example against another arthropod', guess: true },
  serpent: { source: 'A5G4: types distinct in period; App L1g treats serpent postures case by case; no SENA example against another reptile', guess: true },
  spider: { source: 'A5G4: types distinct in period; GoT Table 5 gives the spider its own default (tergiant, head to chief, Julius Gautieri 03/2023); no SENA example against another arthropod', guess: true },
  shell: { source: 'A5G4: types distinct in period; the escallop has its own GoT Table 5 entry (hinge to chief, 01/2025 CL) and A5G7c compares escallop vs escallop inverted (DC); no SENA example against another shell', guess: true },
  fortification: { source: 'A5G4: types distinct in period; PLAN-D §2.4: tower and castle share this class with a type token each (tower vs castle DC); no SENA example found', guess: true },
  cup: { source: 'A5G4: types distinct in period; PLAN-D §1.6 T5: goblet, chalice and tankard share this class with a type token each (DC); no SENA example found', guess: true },
  bell: { source: 'A5G4: types distinct in period; no SENA example of a church bell against a hawk\'s bell', guess: true },
  hand: { source: 'A5G4: types distinct in period; no SENA example of a hand against a glove or gauntlet', guess: true },
  pawprint: { source: 'A5G4: types distinct in period; no SENA example of a pawprint against another track or foot', guess: true },
  wheel: { source: 'A5G4: types distinct in period; the wheel and the Catherine wheel share this class with a type token each (DC); no SENA example found, nor against the cogwheel', guess: true },
  escarbuncle: { source: 'A5E2: clearly unrelated shapes are substantially different; no SENA example against the mullet, sun or crosses', guess: true },
  'ermine-spot': { source: 'A5E2: clearly unrelated shapes are substantially different; no SENA example against the goutte or the other tails', guess: true },
} as const satisfies Record<string, { source: string; guess: boolean }>;

export type TypeClass = keyof typeof TYPE_CLASSES;

/**
 * Which postures a charge can be compared across when it changes posture (SENA App M3): four-legged beasts and monsters, birds, fish,
 * insects (tergiant), tailed bipeds (sea-creatures, wyverns, cockatrices; App M3) and serpents.
 */
export type PostureClass = 'quadruped' | 'bird' | 'fish' | 'insect' | 'biped' | 'serpent';

const ROWS: Record<ChargeId, ChargeMetaRow> = {
  ...META_BEAST, ...META_MONSTER, ...META_BIRD, ...META_PLANT, ...META_GEOMETRIC, ...META_CROSS, ...META_OBJECT, ...META_MODERN,
};

/** Every charge's metadata (its sidecar row in art/meta), with its id and default facing. */
export const CHARGES = Object.fromEntries(CHARGE_IDS.map((id): [ChargeId, ChargeMeta] =>
  [id, { ...ROWS[id], id, defaultFacing: ROWS[id].faces ? 'to-dexter' : null }])) as Record<ChargeId, ChargeMeta>;

/** The charges another charge may hold (their sidecar's `holdable`, PLAN-D §1.5), in charge order: the Holding select lists them. */
export const HOLDABLE_IDS: readonly ChargeId[] = CHARGE_IDS.filter((id) => CHARGES[id].holdable);

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
export const isGaze = isIn(GAZES);
export const isOrientation = isIn(ORIENTATIONS);
export const isChargeForm = isIn(CHARGE_FORMS);
export const isModifierId = isIn(MODIFIER_IDS);
export const isPartId = isIn(PART_IDS);
export const isHoldHow = isIn(HOLD_HOWS);

/** Blazon word for a posture on a given charge ("segreant" for a rampant dragon). */
export function postureTerm(id: ChargeId, p: Posture): string {
  return CHARGES[id].postureWording[p]?.term ?? p;
}

/** A posture as a blazon writes it on a given charge: its term, a two-word one two words ("sejant erect", "statant erect"). */
export function postureWords(id: ChargeId, p: Posture): string {
  return postureTerm(id, p).replace('-', ' ');
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
