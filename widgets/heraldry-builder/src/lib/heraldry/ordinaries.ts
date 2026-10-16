// Ordinaries (bands and shapes the field is charged with) and their modifiers. Pure data — no DOM. Their lines are lines.ts.

export const ORDINARY_TYPES = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'chief', 'bordure', 'pile',
  'base', 'canton', 'quarter', 'orle', 'tressure', 'flaunches', 'gore', 'pall', 'pall-inverted', 'point', 'fret', 'label', 'gyron',
  'mount', 'trimount', 'bar', 'barrulet', 'pallet', 'bendlet', 'bendlet-sinister', 'chevronel', 'saltorel', 'baton'] as const;
export type OrdinaryType = (typeof ORDINARY_TYPES)[number];

/** The ordinaries the builder offers in its main grid: the first ten. */
export const BUILDER_ORDINARIES: readonly OrdinaryType[] = ORDINARY_TYPES.slice(0, 10);
/** Ordinaries drawn but reached only behind disclosure (none yet). */
export const MORE_ORDINARIES: readonly OrdinaryType[] = [];
/** Every ordinary the library draws. */
export const DRAWN_ORDINARIES: readonly OrdinaryType[] = [...BUILDER_ORDINARIES, ...MORE_ORDINARIES];

/** The ordinaries the builder draws overall (over the primary group): the bands and crosses that cross the middle of the field. */
export const OVERALL_ORDINARIES: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'];

/** Central ordinaries can be the primary group; peripheral ones never can (SENA App I1). */
export type OrdinaryKind = 'central' | 'peripheral' | 'other';

export const ORDINARY_KIND: Record<OrdinaryType, OrdinaryKind> = {
  fess: 'central', pale: 'central', bend: 'central', 'bend-sinister': 'central', chevron: 'central', cross: 'central',
  saltire: 'central', pile: 'central', pall: 'central', 'pall-inverted': 'central', bar: 'central', barrulet: 'central',
  pallet: 'central', bendlet: 'central', 'bendlet-sinister': 'central', chevronel: 'central', saltorel: 'central',
  baton: 'central', fret: 'central',
  chief: 'peripheral', bordure: 'peripheral', base: 'peripheral', canton: 'peripheral', quarter: 'peripheral',
  orle: 'peripheral', tressure: 'peripheral', flaunches: 'peripheral', gore: 'peripheral', point: 'peripheral', gyron: 'peripheral',
  label: 'other', mount: 'other', trimount: 'other',
};

/** Blazon names, lower case. */
export const ORDINARY_NAME: Record<OrdinaryType, string> = {
  fess: 'fess', pale: 'pale', bend: 'bend', 'bend-sinister': 'bend sinister', chevron: 'chevron', cross: 'cross',
  saltire: 'saltire', chief: 'chief', bordure: 'bordure', pile: 'pile', base: 'base', canton: 'canton', quarter: 'quarter',
  orle: 'orle', tressure: 'tressure', flaunches: 'flaunches', gore: 'gore', pall: 'pall', 'pall-inverted': 'pall inverted',
  point: 'point pointed', fret: 'fret', label: 'label', gyron: 'gyron', mount: 'mount', trimount: 'trimount', bar: 'bar',
  barrulet: 'barrulet', pallet: 'pallet', bendlet: 'bendlet', 'bendlet-sinister': 'bendlet sinister', chevronel: 'chevronel',
  saltorel: 'saltorel', baton: 'baton',
};

/** Stored, never computed from the first letter. */
export const ORDINARY_ARTICLE: Record<OrdinaryType, 'a' | 'an'> = {
  ...(Object.fromEntries(ORDINARY_TYPES.map((t) => [t, 'a'])) as Record<OrdinaryType, 'a' | 'an'>),
  orle: 'an',
};

export const ORDINARY_MODS = ['inverted', 'couped', 'voided', 'throughout', 'enhanced', 'abased', 'sinister'] as const;
export type OrdinaryMod = (typeof ORDINARY_MODS)[number];

/**
 * The ordinaries each treatment is drawn on (RULES-C §D): a chevron or pile upside down; a band, chevron, cross or saltire shortened
 * (couped); a chevron or pile reaching the edges (throughout — crosses and saltires are throughout already); a band or chevron raised or
 * lowered; a cross or saltire voided; a canton, quarter or gyron in the sinister chief corner instead of the dexter ("a canton
 * sinister": RULES-C §C.3, a form of the ordinary, not a place of the field). On any other ordinary a treatment is a gap.
 */
export const MOD_HOSTS: Record<OrdinaryMod, readonly OrdinaryType[]> = {
  inverted: ['chevron', 'pile'],
  couped: ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'],
  voided: ['cross', 'saltire'],
  throughout: ['chevron', 'pile'],
  enhanced: ['fess', 'bend', 'bend-sinister', 'chevron'],
  abased: ['fess', 'bend', 'bend-sinister', 'chevron'],
  sinister: ['canton', 'quarter', 'gyron'],
};

/**
 * The peripheral ordinaries in paint and blazon order: what lies along the base first, then the gyron, the chief, the bordure (painted
 * over the chief, SENA App M1l), and last the quarter or canton, which lies over a bordure. Any number of them may stand together.
 */
export const PERIPHERAL_ORDER: readonly OrdinaryType[] = ['base', 'point', 'gyron', 'chief', 'bordure', 'quarter', 'canton'];

/**
 * How a peripheral ordinary is joined to the element blazoned before it: ", a chief azure", " and a base azure". Each new type takes its
 * majority joiner in the O&A ("<joiner> a <type> <tincture>", PLAN-C C8a): base " and " 245 to ", " 222; point pointed ", " 72 to
 * " and " 60; canton " and " 6 to ", " 5; quarter ", " 2 to " and " 1; gyron " and " 1 to none. The chief (" and " 1,001 to ", " 811)
 * and the bordure (" within " 3,858 to ", " 2,512) keep the comma this builder has always written.
 */
export const PERIPHERAL_JOINER: Record<OrdinaryType, ', ' | ' and '> = {
  ...(Object.fromEntries(ORDINARY_TYPES.map((t) => [t, ', '])) as Record<OrdinaryType, ', ' | ' and '>),
  base: ' and ', gyron: ' and ', canton: ' and ',
};

/** Whether the treatment is drawn on this ordinary. */
export const modDrawn = (type: OrdinaryType, mod: OrdinaryMod): boolean => MOD_HOSTS[mod].includes(type);

export function isOrdinaryType(v: unknown): v is OrdinaryType {
  return typeof v === 'string' && (ORDINARY_TYPES as readonly string[]).includes(v);
}

export function isOrdinaryMod(v: unknown): v is OrdinaryMod {
  return typeof v === 'string' && (ORDINARY_MODS as readonly string[]).includes(v);
}
