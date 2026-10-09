// The seven tinctures (FINDINGS §4.1, §4.8). Exactly two metals and five colours; no furs,
// stains or custom colours. Pure data — no DOM.

export type Colour = 'gules' | 'azure' | 'vert' | 'sable' | 'purpure';
export type Metal = 'or' | 'argent';
export type Tincture = Colour | Metal;
export type TinctureClass = 'colour' | 'metal';

/** Display/picker order: metals first, then colours. */
export const METALS: readonly Metal[] = ['or', 'argent'];
export const COLOURS: readonly Colour[] = ['gules', 'azure', 'vert', 'sable', 'purpure'];
export const TINCTURES: readonly Tincture[] = [...METALS, ...COLOURS];

export const TINCTURE_CLASS: Record<Tincture, TinctureClass> = {
  gules: 'colour', azure: 'colour', vert: 'colour', sable: 'colour', purpure: 'colour',
  or: 'metal', argent: 'metal',
};

/** Short codes used in canonical signatures (§4.6). */
export const TINCTURE_CODE: Record<Tincture, string> = {
  or: 'or', argent: 'ar', azure: 'az', gules: 'gu', vert: 'vt', sable: 'sa', purpure: 'pu',
};

/** Blazon names — every tincture capitalised (§4.4 DECISION). */
export const TINCTURE_NAME: Record<Tincture, string> = {
  or: 'Or', argent: 'Argent', azure: 'Azure', gules: 'Gules', vert: 'Vert', sable: 'Sable', purpure: 'Purpure',
};

/** Plain-English colour words used by the gloss (§4.5). */
export const TINCTURE_GLOSS: Record<Tincture, string> = {
  or: 'gold', argent: 'white', azure: 'blue', gules: 'red', vert: 'green', sable: 'black', purpure: 'purple',
};

/** Fixed render palette, identical in light and dark themes (§4.8). */
export const TINCTURE_FILL: Record<Tincture, string> = {
  or: '#F2C230', argent: '#FFFFFF', azure: '#1F5FBF', gules: '#D0202E', vert: '#1E8B3A', sable: '#141414', purpure: '#7B3F98',
};

/** Outline colour applied to every shape so Argent stays visible on white pages. */
export const OUTLINE_COLOUR = '#222222';

export type Hatching = 'dots' | 'plain' | 'horizontal' | 'vertical' | 'diagonal' | 'diagonal-sinister' | 'cross';

/** Petra Sancta hatching for the accessibility toggle (§4.8). */
export const TINCTURE_HATCHING: Record<Tincture, Hatching> = {
  or: 'dots', argent: 'plain', azure: 'horizontal', gules: 'vertical', vert: 'diagonal', purpure: 'diagonal-sinister', sable: 'cross',
};

export function isTincture(value: unknown): value is Tincture {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TINCTURE_CLASS, value);
}

export function tinctureClass(t: Tincture): TinctureClass {
  return TINCTURE_CLASS[t];
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
