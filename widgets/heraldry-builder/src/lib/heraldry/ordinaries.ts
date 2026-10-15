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
  point: 'point', fret: 'fret', label: 'label', gyron: 'gyron', mount: 'mount', trimount: 'trimount', bar: 'bar',
  barrulet: 'barrulet', pallet: 'pallet', bendlet: 'bendlet', 'bendlet-sinister': 'bendlet sinister', chevronel: 'chevronel',
  saltorel: 'saltorel', baton: 'baton',
};

/** Stored, never computed from the first letter. */
export const ORDINARY_ARTICLE: Record<OrdinaryType, 'a' | 'an'> = {
  ...(Object.fromEntries(ORDINARY_TYPES.map((t) => [t, 'a'])) as Record<OrdinaryType, 'a' | 'an'>),
  orle: 'an',
};

export const ORDINARY_MODS = ['inverted', 'couped', 'voided', 'throughout', 'enhanced', 'abased'] as const;
export type OrdinaryMod = (typeof ORDINARY_MODS)[number];

export function isOrdinaryType(v: unknown): v is OrdinaryType {
  return typeof v === 'string' && (ORDINARY_TYPES as readonly string[]).includes(v);
}

export function isOrdinaryMod(v: unknown): v is OrdinaryMod {
  return typeof v === 'string' && (ORDINARY_MODS as readonly string[]).includes(v);
}
