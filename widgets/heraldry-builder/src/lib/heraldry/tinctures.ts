// The eight tinctures: three metals and five colours; no furs, stains or custom colours.
// Celestine, a cyan metal, is the one non-standard tincture. Pure data — no DOM.

import { joinList } from './words';
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

/** "Or and Argent" / "Gules, Azure, Vert, Sable or Purpure". */
export function listTinctureNames(ts: readonly Tincture[], conj: 'and' | 'or' = 'and'): string {
  return joinList(ts.map((t) => TINCTURE_NAME[t]), conj);
}

// ── Charge tinctures ────────────────────────────────────────────────────────

/**
 * What a charge group can be tinctured: one of the tinctures, or counterchanged — on a divided
 * field, each charge (or each part of a charge that crosses a partition line) takes the field's
 * other tincture, so it always shows the opposite of what it lies on.
 */
export type ChargeTincture = Tincture | 'counterchanged';
export const CHARGE_TINCTURES: readonly ChargeTincture[] = [...TINCTURES, 'counterchanged'];

export function isChargeTincture(value: unknown): value is ChargeTincture {
  return value === 'counterchanged' || isTincture(value);
}

/** Blazon words: the tincture names, and "counterchanged" (a term, not a tincture, so lower case). */
export const CHARGE_TINCTURE_NAME: Record<ChargeTincture, string> = { ...TINCTURE_NAME, counterchanged: 'counterchanged' };

/** Signature codes; `cc` is distinct from every tincture code. */
export const CHARGE_TINCTURE_CODE: Record<ChargeTincture, string> = { ...TINCTURE_CODE, counterchanged: 'cc' };

// ── Stains and furs (vocabulary only; the builder doesn't draw them yet) ───

export const STAINS = ['sanguine', 'murrey', 'tenne'] as const;
export type Stain = (typeof STAINS)[number];

export const FURS = ['ermine', 'erminois', 'counter-ermine', 'pean', 'vair', 'counter-vair', 'vair-en-point', 'potent', 'counter-potent'] as const;
export type Fur = (typeof FURS)[number];

/** Blazon words, lower case. */
export const STAIN_NAME: Record<Stain, string> = { sanguine: 'sanguine', murrey: 'murrey', tenne: 'tenne' };
export const FUR_NAME: Record<Fur, string> = {
  ermine: 'ermine', erminois: 'erminois', 'counter-ermine': 'counter-ermine', pean: 'pean', vair: 'vair',
  'counter-vair': 'counter-vair', 'vair-en-point': 'vair en point', potent: 'potent', 'counter-potent': 'counter-potent',
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
