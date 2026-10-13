// Charge metadata: 28 curated charges, their blazon/gloss names, articles, categories, drawn postures and
// the vocabulary of charge attributes (postures, facings, orientations, forms, modifiers, parts, holds).
// Artwork lives in charge-art.ts.

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
  /** Charges of different classes are substantially different (SENA A5E2). */
  conflictClass: string;
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

type Fixed = Pick<ChargeMeta, 'id' | 'name' | 'plural' | 'article' | 'category' | 'glossName' | 'glossPlural' | 'orientation' | 'scale' | 'detail'>;
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
    conflictClass: v.postureClass === 'quadruped' ? 'beast' : fixed.id === 'eagle' || fixed.id === 'owl' ? 'bird' : fixed.id === 'mullet' || fixed.id === 'sun' ? 'star' : fixed.id,
  };
}

const quadruped = { postureClass: 'quadruped' } as const;

export const CHARGES: Record<ChargeId, ChargeMeta> = {
  lion: c({ id: 'lion', name: 'lion', plural: 'lions', article: 'a', category: 'beast', glossName: 'lion', glossPlural: 'lions', orientation: 'faces dexter', scale: 1, detail: 1 },
    { postures: ['rampant', 'passant', 'statant', 'sejant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', ...quadruped }),
  wolf: c({ id: 'wolf', name: 'wolf', plural: 'wolves', article: 'a', category: 'beast', glossName: 'wolf', glossPlural: 'wolves', orientation: 'faces dexter', scale: 1.05, detail: 1 },
    { postures: ['rampant', 'passant', 'statant'], defaultPosture: 'passant', ...quadruped }),
  boar: c({ id: 'boar', name: 'boar', plural: 'boars', article: 'a', category: 'beast', glossName: 'boar', glossPlural: 'boars', orientation: 'faces dexter', scale: 1, detail: 1 },
    { postures: ['passant'], defaultPosture: 'passant', ...quadruped }),
  stag: c({ id: 'stag', name: 'stag', plural: 'stags', article: 'a', category: 'beast', glossName: 'stag', glossPlural: 'stags', orientation: 'faces dexter', scale: 1.05, detail: 1 },
    { postures: ['statant', 'passant'], defaultPosture: 'statant', postureWording: { passant: { term: 'trippant', gloss: 'walking' } }, ...quadruped }),
  goat: c({ id: 'goat', name: 'goat', plural: 'goats', article: 'a', category: 'beast', glossName: 'goat', glossPlural: 'goats', orientation: 'faces dexter', scale: 1, detail: 1 },
    { postures: ['statant', 'rampant'], defaultPosture: 'statant', ...quadruped }),
  hare: c({ id: 'hare', name: 'hare', plural: 'hares', article: 'a', category: 'beast', glossName: 'hare', glossPlural: 'hares', orientation: 'faces dexter', scale: 1.05, detail: 1 },
    { postures: ['sejant', 'courant'], defaultPosture: 'sejant', ...quadruped }),
  fish: c({ id: 'fish', name: 'fish', plural: 'fish', article: 'a', category: 'beast', glossName: 'fish', glossPlural: 'fish', orientation: 'head to dexter (naiant) / head up (haurient)', scale: 1.05, detail: 0 },
    { postures: ['naiant', 'haurient'], defaultPosture: 'naiant', scaDefaultPosture: 'naiant', postureClass: 'fish' }),
  bee: c({ id: 'bee', name: 'bee', plural: 'bees', article: 'a', category: 'beast', glossName: 'bee', glossPlural: 'bees', orientation: 'head up (tergiant, fixed)', scale: 1.05, detail: 0 },
    { postureClass: 'insect' }),
  unicorn: c({ id: 'unicorn', name: 'unicorn', plural: 'unicorns', article: 'a', category: 'monster', glossName: 'unicorn', glossPlural: 'unicorns', orientation: 'faces dexter', scale: 1, detail: 2 },
    { postures: ['rampant', 'passant', 'sejant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', ...quadruped }),
  dragon: c({ id: 'dragon', name: 'dragon', plural: 'dragons', article: 'a', category: 'monster', glossName: 'dragon', glossPlural: 'dragons', orientation: 'faces dexter', scale: 0.9, detail: 2 },
    { postures: ['rampant', 'passant'], defaultPosture: 'rampant', scaDefaultPosture: 'rampant', postureWording: { rampant: { term: 'segreant', gloss: 'rearing up' } }, ...quadruped }),
  eagle: c({ id: 'eagle', name: 'eagle', plural: 'eagles', article: 'an', category: 'bird', glossName: 'eagle with spread wings', glossPlural: 'eagles with spread wings', orientation: 'head to dexter', scale: 0.95, detail: 0 },
    { postures: ['displayed'], defaultPosture: 'displayed', scaDefaultPosture: 'displayed', postureClass: 'bird' }),
  owl: c({ id: 'owl', name: 'owl', plural: 'owls', article: 'an', category: 'bird', glossName: 'owl', glossPlural: 'owls', orientation: 'upright, facing out', scale: 1, detail: 1 },
    { postureClass: 'bird' }),
  rose: c({ id: 'rose', name: 'rose', plural: 'roses', article: 'a', category: 'plant', glossName: 'rose', glossPlural: 'roses', orientation: 'upright', scale: 0.88, detail: 0 }),
  tree: c({ id: 'tree', name: 'tree', plural: 'trees', article: 'a', category: 'plant', glossName: 'tree', glossPlural: 'trees', orientation: 'upright', scale: 0.95, detail: 2 }),
  'fleur-de-lis': c({ id: 'fleur-de-lis', name: 'fleur-de-lys', plural: 'fleurs-de-lys', article: 'a', category: 'plant', glossName: 'lily (fleur-de-lis)', glossPlural: 'lilies (fleurs-de-lis)', orientation: 'upright', scale: 1, detail: 0 }),
  mullet: c({ id: 'mullet', name: 'mullet', plural: 'mullets', article: 'a', category: 'geometric', glossName: 'five-pointed star', glossPlural: 'five-pointed stars', orientation: 'one point up', scale: 1.05, detail: 0 }),
  crescent: c({ id: 'crescent', name: 'crescent', plural: 'crescents', article: 'a', category: 'geometric', glossName: 'crescent moon', glossPlural: 'crescent moons', orientation: 'horns up', scale: 1.05, detail: 0 }),
  sun: c({ id: 'sun', name: 'sun', plural: 'suns', article: 'a', category: 'geometric', glossName: 'sun', glossPlural: 'suns', orientation: '—', scale: 1, detail: 0 },
    { mods: ['in-splendour'] }),
  heart: c({ id: 'heart', name: 'heart', plural: 'hearts', article: 'a', category: 'geometric', glossName: 'heart', glossPlural: 'hearts', orientation: 'point down', scale: 0.88, detail: 0 }),
  key: c({ id: 'key', name: 'key', plural: 'keys', article: 'a', category: 'object', glossName: 'key', glossPlural: 'keys', orientation: 'wards up, bow down', scale: 1.15, detail: 1 },
    { long: true }),
  'open-book': c({ id: 'open-book', name: 'open book', plural: 'open books', article: 'an', category: 'object', glossName: 'open book', glossPlural: 'open books', orientation: 'upright', scale: 0.9, detail: 1 }),
  sword: c({ id: 'sword', name: 'sword', plural: 'swords', article: 'a', category: 'object', glossName: 'sword', glossPlural: 'swords', orientation: 'point up', scale: 1.15, detail: 1 },
    { long: true }),
  crown: c({ id: 'crown', name: 'crown', plural: 'crowns', article: 'a', category: 'object', glossName: 'crown', glossPlural: 'crowns', orientation: 'upright', scale: 0.95, detail: 0 }),
  anchor: c({ id: 'anchor', name: 'anchor', plural: 'anchors', article: 'an', category: 'object', glossName: 'anchor', glossPlural: 'anchors', orientation: 'ring up', scale: 1.15, detail: 0 },
    { long: true }),
  'musical-note': c({ id: 'musical-note', name: 'musical note', plural: 'musical notes', article: 'a', category: 'modern', glossName: 'musical note', glossPlural: 'musical notes', orientation: 'stem up, flag to sinister', scale: 1.15, detail: 1 }),
  flame: c({ id: 'flame', name: 'flame', plural: 'flames', article: 'a', category: 'modern', glossName: 'flame', glossPlural: 'flames', orientation: 'tongues up', scale: 0.95, detail: 0 }),
  gear: c({ id: 'gear', name: 'cogwheel', plural: 'cogwheels', article: 'a', category: 'modern', glossName: 'gear', glossPlural: 'gears', orientation: '—', scale: 0.9, detail: 0 }),
  lightbulb: c({ id: 'lightbulb', name: 'lightbulb', plural: 'lightbulbs', article: 'a', category: 'modern', glossName: 'lightbulb', glossPlural: 'lightbulbs', orientation: 'bulb up', scale: 1.1, detail: 1 }),
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

/** Charges in a category, in table order. */
export function chargesInCategory(cat: ChargeCategory): ChargeMeta[] {
  return CHARGE_IDS.map((id) => CHARGES[id]).filter((m) => m.category === cat);
}
