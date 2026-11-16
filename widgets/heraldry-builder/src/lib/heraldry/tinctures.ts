// The eight tinctures (three metals and five colours), the furs and what they are made of, and the stains the builder names
// but does not draw. Celestine, a cyan metal, is the one non-standard tincture. Pure data — no DOM.

export type Colour = 'gules' | 'azure' | 'vert' | 'sable' | 'purpure';
export type Metal = 'or' | 'argent' | 'celestine';
export type Tincture = Colour | Metal;
type TinctureClass = 'colour' | 'metal';

/** Display/picker order: metals first, then colours. */
export const METALS: readonly Metal[] = ['or', 'argent', 'celestine'];
export const COLOURS: readonly Colour[] = ['gules', 'azure', 'vert', 'sable', 'purpure'];
export const TINCTURES: readonly Tincture[] = [...METALS, ...COLOURS];

export const TINCTURE_CLASS: Record<Tincture, TinctureClass> = {
  gules: 'colour', azure: 'colour', vert: 'colour', sable: 'colour', purpure: 'colour',
  or: 'metal', argent: 'metal', celestine: 'metal',
};

/** Tinctures outside the traditional seven; they are labelled "non-standard" wherever they are offered. */
export const NON_STANDARD_TINCTURES: ReadonlySet<Tincture> = new Set<Tincture>(['celestine']);

/** Short codes used in canonical signatures. Every code is distinct. */
export const TINCTURE_CODE: Record<Tincture, string> = {
  or: 'or', argent: 'ar', celestine: 'ce', azure: 'az', gules: 'gu', vert: 'vt', sable: 'sa', purpure: 'pu',
};

/** Blazon names — every tincture capitalised. */
export const TINCTURE_NAME: Record<Tincture, string> = {
  or: 'Or', argent: 'Argent', celestine: 'Celestine', azure: 'Azure', gules: 'Gules', vert: 'Vert', sable: 'Sable', purpure: 'Purpure',
};

/** Plain colour words for picker and filter labels. */
export const TINCTURE_WORD: Record<Tincture, string> = {
  or: 'gold', argent: 'white', celestine: 'sky blue', azure: 'blue', gules: 'red', vert: 'green', sable: 'black', purpure: 'purple',
};

/** Colour words used by the gloss: the plain word, naming celestine since it isn't a familiar colour term. */
export const TINCTURE_GLOSS: Record<Tincture, string> = { ...TINCTURE_WORD, celestine: 'sky blue (celestine)' };

/**
 * Fixed render palette, identical in light and dark themes. Celestine is a mid cyan, far
 * lighter than Azure and clearly coloured against Argent (CIEDE2000 34.5 and 28.7).
 */
export const TINCTURE_FILL: Record<Tincture, string> = {
  or: '#F2C230', argent: '#FFFFFF', celestine: '#3CBDE0', azure: '#1F5FBF', gules: '#D0202E', vert: '#1E8B3A', sable: '#141414', purpure: '#7B3F98',
};

/** Outline colour applied to every shape so Argent stays visible on white pages. */
export const OUTLINE_COLOUR = '#222222';

export type Hatching = 'dots' | 'plain' | 'wavy' | 'horizontal' | 'vertical' | 'diagonal' | 'diagonal-sinister' | 'cross';

/**
 * Petra Sancta hatching for the accessibility toggle. The traditional seven keep their
 * classic patterns. Celestine has none in tradition; it is drawn as wavy horizontal lines — level
 * like Azure's lines because it is a blue, waved because it is a different tincture — the only
 * curved pattern, so it can't be read as any straight-line, dotted or plain one.
 */
export const TINCTURE_HATCHING: Record<Tincture, Hatching> = {
  or: 'dots', argent: 'plain', celestine: 'wavy', azure: 'horizontal', gules: 'vertical', vert: 'diagonal', purpure: 'diagonal-sinister', sable: 'cross',
};

export function isTincture(value: unknown): value is Tincture {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TINCTURE_CLASS, value);
}

export function isMetal(t: Tincture): boolean {
  return TINCTURE_CLASS[t] === 'metal';
}

// ── Stains (vocabulary only; the builder does not draw them yet) and furs ───

export const STAINS = ['sanguine', 'murrey', 'tenne'] as const;
export type Stain = (typeof STAINS)[number];

export const FURS = [
  'ermine', 'erminois', 'counter-ermine', 'pean', 'vair', 'counter-vair', 'vair-en-pointe', 'potent', 'counter-potent', 'potent-en-pointe',
] as const;
export type Fur = (typeof FURS)[number];

/** Blazon words, lower case. */
export const STAIN_NAME: Record<Stain, string> = { sanguine: 'sanguine', murrey: 'murrey', tenne: 'tenne' };
export const FUR_NAME: Record<Fur, string> = {
  ermine: 'ermine', erminois: 'erminois', 'counter-ermine': 'counter-ermine', pean: 'pean', vair: 'vair',
  'counter-vair': 'counter-vair', 'vair-en-pointe': 'vair en pointe', potent: 'potent', 'counter-potent': 'counter-potent', 'potent-en-pointe': 'potent en pointe',
};

/**
 * What a fur is made of. Ermine's family is a ground sprinkled with spots (a metal or colour "ermined" with the other
 * kind, SENA App F4); the vair and potent families are two tinctures laid in rows of bells or crutch-heads, set `plain`
 * (each row against the one before), `counter` (like against like) or `en-pointe` (in columns).
 */
export interface FurSpec {
  family: 'ermine' | 'vair' | 'potent';
  layout: 'plain' | 'counter' | 'en-pointe';
  /** The ground (ermine family) or the first tincture (vair and potent) when the fur names no other colours. */
  ground: Tincture;
  /** The spots (ermine family) or the second tincture (vair and potent). */
  spots: Tincture;
}

export const FUR_SPEC: Record<Fur, FurSpec> = {
  ermine: { family: 'ermine', layout: 'plain', ground: 'argent', spots: 'sable' },
  erminois: { family: 'ermine', layout: 'plain', ground: 'or', spots: 'sable' },
  'counter-ermine': { family: 'ermine', layout: 'plain', ground: 'sable', spots: 'argent' },
  pean: { family: 'ermine', layout: 'plain', ground: 'sable', spots: 'or' },
  vair: { family: 'vair', layout: 'plain', ground: 'argent', spots: 'azure' },
  'counter-vair': { family: 'vair', layout: 'counter', ground: 'argent', spots: 'azure' },
  'vair-en-pointe': { family: 'vair', layout: 'en-pointe', ground: 'argent', spots: 'azure' },
  potent: { family: 'potent', layout: 'plain', ground: 'argent', spots: 'azure' },
  'counter-potent': { family: 'potent', layout: 'counter', ground: 'argent', spots: 'azure' },
  'potent-en-pointe': { family: 'potent', layout: 'en-pointe', ground: 'argent', spots: 'azure' },
};

export function isStain(value: unknown): value is Stain {
  return typeof value === 'string' && (STAINS as readonly string[]).includes(value);
}

export function isFur(value: unknown): value is Fur {
  return typeof value === 'string' && (FURS as readonly string[]).includes(value);
}

/** The tincture as written in a blazon: "Or" capitalised, every other tincture lower case. */
export function tinctureWord(t: Tincture): string {
  return t === 'or' ? 'Or' : t;
}
