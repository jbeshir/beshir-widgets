// Ordinaries (bands and shapes the field is charged with) and their modifiers. Pure data — no DOM. Their lines are lines.ts.

export const ORDINARY_TYPES = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'chief', 'bordure', 'pile',
  'base', 'canton', 'quarter', 'orle', 'tressure', 'flaunches', 'gore', 'pall', 'pall-inverted', 'point', 'fret', 'label', 'gyron',
  'mount', 'trimount', 'bar', 'barrulet', 'pallet', 'bendlet', 'bendlet-sinister', 'chevronel', 'saltorel', 'baton', 'point-dexter',
  'point-sinister'] as const;
export type OrdinaryType = (typeof ORDINARY_TYPES)[number];

/** The ordinaries the builder offers in its main grid: the first ten. */
export const BUILDER_ORDINARIES: readonly OrdinaryType[] = ORDINARY_TYPES.slice(0, 10);
/** Ordinaries drawn but reached only behind disclosure (the band step's "More shapes" row, and the corner or edge shapes beside the band). */
export const MORE_ORDINARIES: readonly OrdinaryType[] = [
  'base', 'point', 'canton', 'quarter', 'gyron', 'orle', 'tressure', 'flaunches', 'gore', 'pall', 'label', 'fret', 'mount', 'trimount',
];
/** Ordinaries drawn and reached through a toggle of another's, not a tile of their own: the pall inverted (`TILE_OF`). */
export const TURNED_ORDINARIES: readonly OrdinaryType[] = ['pall-inverted'];
/**
 * Ordinaries drawn and blazoned, so that a design with one shows itself and says why it is refused, but never offered by the builder: the
 * dexter and sinister points, which "were [not] actually used in period armory" (RULES-C §C.3, L21; structure.ts refuses them).
 */
export const REFUSED_ORDINARIES: readonly OrdinaryType[] = ['point-dexter', 'point-sinister'];
/** The ordinary whose tile in the builder's grids picks this one, where it has none of its own: the pall inverted is the pall turned over. */
export const TILE_OF: Partial<Record<OrdinaryType, OrdinaryType>> = { 'pall-inverted': 'pall' };
/** Every ordinary the library draws. */
export const DRAWN_ORDINARIES: readonly OrdinaryType[] = [...BUILDER_ORDINARIES, ...MORE_ORDINARIES, ...TURNED_ORDINARIES, ...REFUSED_ORDINARIES];

/** The ordinaries the builder draws overall (over the primary group): the bands and crosses that cross the middle of the field. */
export const OVERALL_ORDINARIES: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'];

/**
 * Central ordinaries can be the primary group; peripheral ones never can (SENA App I1). The label, mount and trimount ('other') lie
 * along an edge of the field (the label in chief, the mount and trimount issuant from base) and stand as a peripheral does; a design of nothing else has the field as its primary
 * group (SENA A5F). The fret is central here though SENA calls it a charge: alone it is the main picture, and the rules that
 * differ for a charge are written on it by type.
 */
export type OrdinaryKind = 'central' | 'peripheral' | 'other';

export const ORDINARY_KIND: Record<OrdinaryType, OrdinaryKind> = {
  fess: 'central', pale: 'central', bend: 'central', 'bend-sinister': 'central', chevron: 'central', cross: 'central',
  saltire: 'central', pile: 'central', pall: 'central', 'pall-inverted': 'central', bar: 'central', barrulet: 'central',
  pallet: 'central', bendlet: 'central', 'bendlet-sinister': 'central', chevronel: 'central', saltorel: 'central',
  baton: 'central', fret: 'central',
  chief: 'peripheral', bordure: 'peripheral', base: 'peripheral', canton: 'peripheral', quarter: 'peripheral',
  orle: 'peripheral', tressure: 'peripheral', flaunches: 'peripheral', gore: 'peripheral', point: 'peripheral', gyron: 'peripheral',
  'point-dexter': 'peripheral', 'point-sinister': 'peripheral',
  label: 'other', mount: 'other', trimount: 'other',
};

/** Blazon names, lower case. */
export const ORDINARY_NAME: Record<OrdinaryType, string> = {
  fess: 'fess', pale: 'pale', bend: 'bend', 'bend-sinister': 'bend sinister', chevron: 'chevron', cross: 'cross',
  saltire: 'saltire', chief: 'chief', bordure: 'bordure', pile: 'pile', base: 'base', canton: 'canton', quarter: 'quarter',
  orle: 'orle', tressure: 'tressure', flaunches: 'flaunches', gore: 'gore', pall: 'pall', 'pall-inverted': 'pall inverted',
  point: 'point pointed', fret: 'fret', label: 'label', gyron: 'gyron', mount: 'mount', trimount: 'trimount', bar: 'bar',
  barrulet: 'barrulet', pallet: 'pallet', bendlet: 'bendlet', 'bendlet-sinister': 'bendlet sinister', chevronel: 'chevronel',
  saltorel: 'saltorel', baton: 'baton', 'point-dexter': 'point dexter', 'point-sinister': 'point sinister',
};

/** Stored, never computed from the first letter; null for flaunches, always a pair and written without one ("flaunches azure", RULES-C §C.3). */
export const ORDINARY_ARTICLE: Record<OrdinaryType, 'a' | 'an' | null> = {
  ...(Object.fromEntries(ORDINARY_TYPES.map((t) => [t, 'a'])) as Record<OrdinaryType, 'a' | 'an' | null>),
  orle: 'an', flaunches: null,
};

/** The ordinary named as a sentence names one of it: "a canton", "an orle", "flaunches". */
export const ordinaryWithArticle = (type: OrdinaryType): string => [ORDINARY_ARTICLE[type], ORDINARY_NAME[type]].filter(Boolean).join(' ');

/**
 * The counts an ordinary is drawn with beyond one: a tressure double or triple (a single tressure is an orle: RULES-C §C.3, Prec Gwynaeth
 * 04/2004). Any other count of an ordinary is a gap.
 */
export const ORDINARY_COUNTS: Partial<Record<OrdinaryType, readonly number[]>> = { tressure: [2, 3] };
/** How such a count is written before the ordinary's name: "a double tressure". */
export const ORDINARY_COUNT_WORD: Readonly<Record<number, string>> = { 2: 'double', 3: 'triple' };

export const ORDINARY_MODS = ['inverted', 'couped', 'voided', 'throughout', 'enhanced', 'abased', 'sinister'] as const;
export type OrdinaryMod = (typeof ORDINARY_MODS)[number];

/**
 * The ordinaries each treatment is drawn on (RULES-C §D): a chevron, pile or pall upside down (a pall inverted is a type of its own, the
 * pall so treated); a band, chevron, cross or saltire shortened (couped); a chevron or pile reaching the edges (throughout — crosses,
 * saltires and palls are throughout already); a band or chevron raised or lowered; a cross, saltire or pall voided; a canton, quarter or gyron in the sinister chief corner instead of the dexter, a gore issuing from
 * the sinister flank ("a canton sinister", "a gore sinister": RULES-C §C.3, a form of the ordinary, not a place of the field). On any
 * other ordinary a treatment is a gap.
 */
export const MOD_HOSTS: Record<OrdinaryMod, readonly OrdinaryType[]> = {
  inverted: ['chevron', 'pile', 'pall', 'pall-inverted'],
  couped: ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'],
  voided: ['cross', 'saltire', 'pall', 'pall-inverted'],
  throughout: ['chevron', 'pile'],
  enhanced: ['fess', 'bend', 'bend-sinister', 'chevron'],
  abased: ['fess', 'bend', 'bend-sinister', 'chevron'],
  sinister: ['canton', 'quarter', 'gyron', 'gore'],
};

/**
 * The peripheral ordinaries in paint and blazon order: what lies along the base first (the dexter and sinister points with the point
 * pointed, the mount and trimount), then the gyron, the flaunches, the gore, the orle and tressure, the chief, the bordure (painted over the
 * chief, SENA App M1l), the label across them, and last the quarter or canton, which lies over a bordure. Any number of them may stand together.
 */
export const PERIPHERAL_ORDER: readonly OrdinaryType[] = [
  'base', 'mount', 'trimount', 'point', 'point-dexter', 'point-sinister', 'gyron', 'flaunches', 'gore', 'orle', 'tressure', 'chief', 'bordure', 'label',
  'quarter', 'canton',
];

/** How a peripheral ordinary is joined to the element blazoned before it (`PERIPHERAL_JOINER`). */
export type PeripheralJoiner = ', ' | ' and ' | ' within ' | ' between ';

/**
 * How a peripheral ordinary is joined to the element blazoned before it: ", a chief azure", " and a base azure", " within an orle Or",
 * " between flaunches argent". Each new type takes its majority joiner in the O&A ("<joiner> a <type> <tincture>", PLAN-C C8a, C9):
 * base " and " 245 to ", " 222; point pointed ", " 72 to " and " 60; canton " and " 6 to ", " 5; quarter ", " 2 to " and " 1; gyron
 * " and " 1 to none; orle " within " 845 to ", " 202 and " and " 140; double tressure " within " 84 to ", " 22; flaunches " between "
 * 300 to ", " 25; gore " and " 80 to ", " 56; the dexter and sinister points one record each (", " as the point pointed's); label ", " 28 to " and " 16; mount " and " 23 to ", " 17; trimount " and " 17 to ", " 9. The chief
 * (" and " 1,001 to ", " 811) and the bordure (" within " 3,858 to ", " 2,512) keep the comma this builder has always written.
 */
export const PERIPHERAL_JOINER: Record<OrdinaryType, PeripheralJoiner> = {
  ...(Object.fromEntries(ORDINARY_TYPES.map((t) => [t, ', '])) as Record<OrdinaryType, PeripheralJoiner>),
  base: ' and ', gyron: ' and ', canton: ' and ', gore: ' and ', mount: ' and ', trimount: ' and ', orle: ' within ', tressure: ' within ', flaunches: ' between ',
};

/** Whether the treatment is drawn on this ordinary. */
export const modDrawn = (type: OrdinaryType, mod: OrdinaryMod): boolean => MOD_HOSTS[mod].includes(type);

export function isOrdinaryType(v: unknown): v is OrdinaryType {
  return typeof v === 'string' && (ORDINARY_TYPES as readonly string[]).includes(v);
}

export function isOrdinaryMod(v: unknown): v is OrdinaryMod {
  return typeof v === 'string' && (ORDINARY_MODS as readonly string[]).includes(v);
}
