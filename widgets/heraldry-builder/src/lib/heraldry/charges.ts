// Charge metadata (FINDINGS §5.1): 30 curated charges, their blazon/gloss names, articles,
// categories and allowed postures. Artwork lives in charge-art.ts.

export type Posture = 'rampant' | 'passant' | 'statant' | 'sejant' | 'naiant' | 'haurient' | 'displayed';
export const POSTURES: readonly Posture[] = ['rampant', 'passant', 'statant', 'sejant', 'naiant', 'haurient', 'displayed'];

export type PostureGroup = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

/** Posture groups for the "too close" check (§3.2): passant ↔ statant is the only minor pair. */
export const POSTURE_GROUP: Record<Posture, PostureGroup> = {
  rampant: 'G1', passant: 'G2', statant: 'G2', sejant: 'G3', naiant: 'G4', haurient: 'G5', displayed: 'G6',
};

export function postureGroup(p: Posture | null | undefined): PostureGroup | null {
  return p ? POSTURE_GROUP[p] : null;
}

/** Plain-English posture words for the gloss (§4.5). Displayed is folded into the eagle's gloss name. */
export const POSTURE_GLOSS: Record<Posture, string | null> = {
  rampant: 'rearing up', passant: 'walking', statant: 'standing', sejant: 'sitting',
  naiant: 'swimming', haurient: 'leaping upward', displayed: null,
};

export type ChargeCategory = 'beast' | 'monster' | 'bird' | 'plant' | 'geometric' | 'object' | 'modern';

export const CHARGE_CATEGORIES: readonly ChargeCategory[] = ['beast', 'monster', 'bird', 'plant', 'geometric', 'object', 'modern'];

export const CATEGORY_LABEL: Record<ChargeCategory, string> = {
  beast: 'Beasts', monster: 'Monsters', bird: 'Birds', plant: 'Plants',
  geometric: 'Shapes', object: 'Objects', modern: 'Modern',
};

/** Categories whose silhouettes are detailed enough to cost a readability point (§4.8). */
export const ANIMATE_CATEGORIES: readonly ChargeCategory[] = ['beast', 'bird', 'monster'];

export const CHARGE_IDS = [
  'lion', 'wolf', 'boar', 'stag', 'goat', 'hare', 'fish', 'bee',
  'unicorn', 'dragon',
  'eagle', 'owl',
  'rose', 'tree', 'fleur-de-lis',
  'mullet', 'crescent', 'sun', 'heart',
  'key', 'open-book', 'sword', 'crown', 'anchor',
  'laptop', 'musical-note', 'paintbrush', 'flame', 'gear', 'lightbulb',
] as const;

export type ChargeId = (typeof CHARGE_IDS)[number];

export interface ChargeMeta {
  id: ChargeId;
  /** Blazon name (singular / plural). */
  name: string;
  plural: string;
  /** Stored, never computed from the first letter ("an open book"). */
  article: 'a' | 'an';
  category: ChargeCategory;
  /** Allowed postures (first is not necessarily the default), or null when posture-less. */
  postures: readonly Posture[] | null;
  defaultPosture: Posture | null;
  /** Blazon-only display words overriding the posture id (dragon rampant → "segreant"). */
  postureTerms?: Partial<Record<Posture, string>>;
  /** Gloss names (singular / plural). */
  glossName: string;
  glossPlural: string;
  /** Default orientation, for documentation and the artist. */
  orientation: string;
}

function c(
  id: ChargeId, name: string, plural: string, article: 'a' | 'an', category: ChargeCategory,
  postures: readonly Posture[] | null, defaultPosture: Posture | null,
  glossName: string, glossPlural: string, orientation: string,
  postureTerms?: Partial<Record<Posture, string>>,
): ChargeMeta {
  return { id, name, plural, article, category, postures, defaultPosture, glossName, glossPlural, orientation, ...(postureTerms ? { postureTerms } : {}) };
}

export const CHARGES: Record<ChargeId, ChargeMeta> = {
  lion: c('lion', 'lion', 'lions', 'a', 'beast', ['rampant', 'passant', 'statant', 'sejant'], 'rampant', 'lion', 'lions', 'faces dexter'),
  wolf: c('wolf', 'wolf', 'wolves', 'a', 'beast', ['rampant', 'passant', 'statant'], 'passant', 'wolf', 'wolves', 'faces dexter'),
  boar: c('boar', 'boar', 'boars', 'a', 'beast', ['passant'], 'passant', 'boar', 'boars', 'faces dexter'),
  stag: c('stag', 'stag', 'stags', 'a', 'beast', ['statant', 'passant'], 'statant', 'stag', 'stags', 'faces dexter', { passant: 'trippant' }),
  goat: c('goat', 'goat', 'goats', 'a', 'beast', ['statant', 'rampant'], 'statant', 'goat', 'goats', 'faces dexter'),
  hare: c('hare', 'hare', 'hares', 'a', 'beast', ['sejant', 'passant'], 'sejant', 'hare', 'hares', 'faces dexter', { passant: 'courant' }),
  fish: c('fish', 'fish', 'fish', 'a', 'beast', ['naiant', 'haurient'], 'naiant', 'fish', 'fish', 'head to dexter (naiant) / head up (haurient)'),
  bee: c('bee', 'bee', 'bees', 'a', 'beast', null, null, 'bee', 'bees', 'head up (tergiant, fixed)'),
  unicorn: c('unicorn', 'unicorn', 'unicorns', 'a', 'monster', ['rampant', 'passant', 'sejant'], 'rampant', 'unicorn', 'unicorns', 'faces dexter'),
  dragon: c('dragon', 'dragon', 'dragons', 'a', 'monster', ['rampant', 'passant'], 'rampant', 'dragon', 'dragons', 'faces dexter', { rampant: 'segreant' }),
  eagle: c('eagle', 'eagle', 'eagles', 'an', 'bird', ['displayed'], 'displayed', 'eagle with spread wings', 'eagles with spread wings', 'head to dexter'),
  owl: c('owl', 'owl', 'owls', 'an', 'bird', null, null, 'owl', 'owls', 'upright, facing out'),
  rose: c('rose', 'rose', 'roses', 'a', 'plant', null, null, 'rose', 'roses', 'upright'),
  tree: c('tree', 'tree', 'trees', 'a', 'plant', null, null, 'tree', 'trees', 'upright'),
  'fleur-de-lis': c('fleur-de-lis', 'fleur-de-lis', 'fleurs-de-lis', 'a', 'plant', null, null, 'lily (fleur-de-lis)', 'lilies (fleurs-de-lis)', 'upright'),
  mullet: c('mullet', 'mullet', 'mullets', 'a', 'geometric', null, null, 'five-pointed star', 'five-pointed stars', 'one point up'),
  crescent: c('crescent', 'crescent', 'crescents', 'a', 'geometric', null, null, 'crescent moon', 'crescent moons', 'horns up'),
  sun: c('sun', 'sun', 'suns', 'a', 'geometric', null, null, 'sun', 'suns', '—'),
  heart: c('heart', 'heart', 'hearts', 'a', 'geometric', null, null, 'heart', 'hearts', 'point down'),
  key: c('key', 'key', 'keys', 'a', 'object', null, null, 'key', 'keys', 'wards up, bow down'),
  'open-book': c('open-book', 'open book', 'open books', 'an', 'object', null, null, 'open book', 'open books', 'upright'),
  sword: c('sword', 'sword', 'swords', 'a', 'object', null, null, 'sword', 'swords', 'point up'),
  crown: c('crown', 'crown', 'crowns', 'a', 'object', null, null, 'crown', 'crowns', 'upright'),
  anchor: c('anchor', 'anchor', 'anchors', 'an', 'object', null, null, 'anchor', 'anchors', 'ring up'),
  laptop: c('laptop', 'laptop', 'laptops', 'a', 'modern', null, null, 'laptop', 'laptops', 'screen up, open, seen from front'),
  'musical-note': c('musical-note', 'musical note', 'musical notes', 'a', 'modern', null, null, 'musical note', 'musical notes', 'stem up, flag to sinister'),
  paintbrush: c('paintbrush', 'paintbrush', 'paintbrushes', 'a', 'modern', null, null, 'paintbrush', 'paintbrushes', 'bristles up'),
  flame: c('flame', 'flame', 'flames', 'a', 'modern', null, null, 'flame', 'flames', 'tongues up'),
  gear: c('gear', 'gear', 'gears', 'a', 'modern', null, null, 'gear', 'gears', '—'),
  lightbulb: c('lightbulb', 'lightbulb', 'lightbulbs', 'a', 'modern', null, null, 'lightbulb', 'lightbulbs', 'bulb up'),
};

export function isChargeId(value: unknown): value is ChargeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHARGES, value);
}

export function isPosture(value: unknown): value is Posture {
  return typeof value === 'string' && (POSTURES as readonly string[]).includes(value);
}

export function isAnimate(id: ChargeId): boolean {
  return ANIMATE_CATEGORIES.includes(CHARGES[id].category);
}

/** Blazon word for a posture on a given charge ("segreant" for a rampant dragon). */
export function postureTerm(id: ChargeId, p: Posture): string {
  return CHARGES[id].postureTerms?.[p] ?? p;
}

/** Charges in a category, in table order. */
export function chargesInCategory(cat: ChargeCategory): ChargeMeta[] {
  return CHARGE_IDS.map((id) => CHARGES[id]).filter((m) => m.category === cat);
}
