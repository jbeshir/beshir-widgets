// The eight tinctures: three metals and five colours; no furs, stains or custom colours.
// Celestine, a cyan metal, is the one non-standard tincture. Pure data — no DOM.

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

/**
 * Tinctures outside the traditional seven carry a note saying why they exist; they are labelled
 * "non-standard" wherever they are offered. null = a traditional tincture.
 */
export const NON_STANDARD_NOTE: Record<Tincture, string | null> = {
  or: null, argent: null, azure: null, gules: null, vert: null, sable: null, purpure: null,
  celestine: 'Celestine — cyan treated as a metal — is the one new tincture proposed for modern heraldry, named after its single historical example.',
};

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

export function isNonStandard(t: Tincture): boolean {
  return NON_STANDARD_NOTE[t] !== null;
}

export function isMetal(t: Tincture): boolean {
  return TINCTURE_CLASS[t] === 'metal';
}

/** "Or and Argent" / "Gules, Azure, Vert, Sable or Purpure". */
export function listTinctureNames(ts: readonly Tincture[], conj: 'and' | 'or' = 'and'): string {
  const names = ts.map((t) => TINCTURE_NAME[t]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${conj} ${names[names.length - 1]}`;
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
