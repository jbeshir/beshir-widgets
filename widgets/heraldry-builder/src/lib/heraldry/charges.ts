// Charge metadata (FINDINGS §5.1): 28 curated charges, their blazon/gloss names, articles,
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
  naiant: 'swimming', haurient: 'upright, head up', displayed: null,
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
  'musical-note', 'flame', 'gear', 'lightbulb',
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
  /** This charge's own words for a posture, overriding the posture id and POSTURE_GLOSS. */
  postureWording: Partial<Record<Posture, PostureWording>>;
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
}

/** A charge-specific posture word: the blazon term and its plain-English gloss ("courant", "running"). */
export interface PostureWording { term: string; gloss: string }

function c(
  id: ChargeId, name: string, plural: string, article: 'a' | 'an', category: ChargeCategory,
  postures: readonly Posture[] | null, defaultPosture: Posture | null,
  glossName: string, glossPlural: string, orientation: string, scale: number,
  postureWording: Partial<Record<Posture, PostureWording>> = {},
): ChargeMeta {
  return { id, name, plural, article, category, postures, defaultPosture, glossName, glossPlural, orientation, scale, postureWording };
}

export const CHARGES: Record<ChargeId, ChargeMeta> = {
  lion: c('lion', 'lion', 'lions', 'a', 'beast', ['rampant', 'passant', 'statant', 'sejant'], 'rampant', 'lion', 'lions', 'faces dexter', 1),
  wolf: c('wolf', 'wolf', 'wolves', 'a', 'beast', ['rampant', 'passant', 'statant'], 'passant', 'wolf', 'wolves', 'faces dexter', 1.05),
  boar: c('boar', 'boar', 'boars', 'a', 'beast', ['passant'], 'passant', 'boar', 'boars', 'faces dexter', 1),
  stag: c('stag', 'stag', 'stags', 'a', 'beast', ['statant', 'passant'], 'statant', 'stag', 'stags', 'faces dexter', 1.05, { passant: { term: 'trippant', gloss: 'walking' } }),
  goat: c('goat', 'goat', 'goats', 'a', 'beast', ['statant', 'rampant'], 'statant', 'goat', 'goats', 'faces dexter', 1),
  hare: c('hare', 'hare', 'hares', 'a', 'beast', ['sejant', 'passant'], 'sejant', 'hare', 'hares', 'faces dexter', 1.05, { passant: { term: 'courant', gloss: 'running' } }),
  fish: c('fish', 'fish', 'fish', 'a', 'beast', ['naiant', 'haurient'], 'naiant', 'fish', 'fish', 'head to dexter (naiant) / head up (haurient)', 1.05),
  bee: c('bee', 'bee', 'bees', 'a', 'beast', null, null, 'bee', 'bees', 'head up (tergiant, fixed)', 1.05),
  unicorn: c('unicorn', 'unicorn', 'unicorns', 'a', 'monster', ['rampant', 'passant', 'sejant'], 'rampant', 'unicorn', 'unicorns', 'faces dexter', 1),
  dragon: c('dragon', 'dragon', 'dragons', 'a', 'monster', ['rampant', 'passant'], 'rampant', 'dragon', 'dragons', 'faces dexter', 0.9, { rampant: { term: 'segreant', gloss: 'rearing up' } }),
  eagle: c('eagle', 'eagle', 'eagles', 'an', 'bird', ['displayed'], 'displayed', 'eagle with spread wings', 'eagles with spread wings', 'head to dexter', 0.95),
  owl: c('owl', 'owl', 'owls', 'an', 'bird', null, null, 'owl', 'owls', 'upright, facing out', 1),
  rose: c('rose', 'rose', 'roses', 'a', 'plant', null, null, 'rose', 'roses', 'upright', 0.88),
  tree: c('tree', 'tree', 'trees', 'a', 'plant', null, null, 'tree', 'trees', 'upright', 0.95),
  'fleur-de-lis': c('fleur-de-lis', 'fleur-de-lis', 'fleurs-de-lis', 'a', 'plant', null, null, 'lily (fleur-de-lis)', 'lilies (fleurs-de-lis)', 'upright', 1),
  mullet: c('mullet', 'mullet', 'mullets', 'a', 'geometric', null, null, 'five-pointed star', 'five-pointed stars', 'one point up', 1.05),
  crescent: c('crescent', 'crescent', 'crescents', 'a', 'geometric', null, null, 'crescent moon', 'crescent moons', 'horns up', 1.05),
  sun: c('sun', 'sun', 'suns', 'a', 'geometric', null, null, 'sun', 'suns', '—', 1),
  heart: c('heart', 'heart', 'hearts', 'a', 'geometric', null, null, 'heart', 'hearts', 'point down', 0.88),
  key: c('key', 'key', 'keys', 'a', 'object', null, null, 'key', 'keys', 'wards up, bow down', 1.15),
  'open-book': c('open-book', 'open book', 'open books', 'an', 'object', null, null, 'open book', 'open books', 'upright', 0.9),
  sword: c('sword', 'sword', 'swords', 'a', 'object', null, null, 'sword', 'swords', 'point up', 1.15),
  crown: c('crown', 'crown', 'crowns', 'a', 'object', null, null, 'crown', 'crowns', 'upright', 0.95),
  anchor: c('anchor', 'anchor', 'anchors', 'an', 'object', null, null, 'anchor', 'anchors', 'ring up', 1.15),
  'musical-note': c('musical-note', 'musical note', 'musical notes', 'a', 'modern', null, null, 'musical note', 'musical notes', 'stem up, flag to sinister', 1.15),
  flame: c('flame', 'flame', 'flames', 'a', 'modern', null, null, 'flame', 'flames', 'tongues up', 0.95),
  gear: c('gear', 'gear', 'gears', 'a', 'modern', null, null, 'gear', 'gears', '—', 0.9),
  lightbulb: c('lightbulb', 'lightbulb', 'lightbulbs', 'a', 'modern', null, null, 'lightbulb', 'lightbulbs', 'bulb up', 1.1),
};

export function isChargeId(value: unknown): value is ChargeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHARGES, value);
}

export function isChargeCategory(value: unknown): value is ChargeCategory {
  return typeof value === 'string' && (CHARGE_CATEGORIES as readonly string[]).includes(value);
}

export function isPosture(value: unknown): value is Posture {
  return typeof value === 'string' && (POSTURES as readonly string[]).includes(value);
}

export function isAnimate(id: ChargeId): boolean {
  return ANIMATE_CATEGORIES.includes(CHARGES[id].category);
}

/** Blazon word for a posture on a given charge ("segreant" for a rampant dragon). */
export function postureTerm(id: ChargeId, p: Posture): string {
  return CHARGES[id].postureWording[p]?.term ?? p;
}

/** Plain-English word for a posture on a given charge ("running" for a hare courant); null for displayed. */
export function postureGloss(id: ChargeId, p: Posture): string | null {
  return CHARGES[id].postureWording[p]?.gloss ?? POSTURE_GLOSS[p];
}

/** Charges in a category, in table order. */
export function chargesInCategory(cat: ChargeCategory): ChargeMeta[] {
  return CHARGE_IDS.map((id) => CHARGES[id]).filter((m) => m.category === cat);
}

/**
 * Charges whose shapes look alike at nametag size (a shield about 32 px tall): there the horn, mane
 * and tail that tell a lion from a wolf, unicorn or goat are under a pixel, and a rose, a gear and a
 * sun are all a round boss with a ring of points. Changing a charge for another in the same group is
 * only half a difference. A charge belongs to at most one group, so "looks the same" stays
 * transitive and a charge's group can be stored and indexed.
 */
export type SimilarityGroup = 'quadruped' | 'round';

export const SIMILARITY_GROUP: Partial<Record<ChargeId, SimilarityGroup>> = {
  lion: 'quadruped', wolf: 'quadruped', unicorn: 'quadruped', goat: 'quadruped',
  rose: 'round', gear: 'round', sun: 'round',
};

/** The charge's similarity group, or the charge itself when it looks like no other. */
export function chargeGroup(id: ChargeId): SimilarityGroup | ChargeId {
  return SIMILARITY_GROUP[id] ?? id;
}

/** The charges of a similarity group, in table order. */
export function chargesInGroup(group: SimilarityGroup): ChargeId[] {
  return CHARGE_IDS.filter((id) => SIMILARITY_GROUP[id] === group);
}
