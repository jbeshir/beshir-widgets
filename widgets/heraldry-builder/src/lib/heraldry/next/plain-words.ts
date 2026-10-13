// Everyday wording paired with the heraldic term, for the builder, filters and explainer. Most labels
// lead with the everyday words ("Split down the middle · per pale"); the field and band tiles show
// the term and keep the words for their tooltip. The blazon keeps the heraldic names in blazon.ts;
// these are display text only. Pure data — no DOM.

import { CHARGES, postureGloss, postureTerm, type ChargeId, type Posture } from './charges';
import { groupAt, hostOf, type Design, type GroupPath } from './design';
import type { Division } from './divisions';
import type { LayoutKey } from './arrangement';
import { ORDINARY_KIND, type OrdinaryType } from './ordinaries';
import type { GroupTincture } from './design';
import { joinAnd, numberWord, capitalise } from '../words';

/** A label in everyday words and the heraldic term for the same thing. */
export interface PlainTerm {
  plain: string;
  term: string;
}

/** "Split down the middle · per pale". */
export function plainFirst({ plain, term }: PlainTerm): string {
  return `${plain} · ${term}`;
}

export const DIVISION_LABEL: Record<Division, PlainTerm> = {
  'per-pale': { plain: 'Split down the middle', term: 'per pale' },
  'per-fess': { plain: 'Split across', term: 'per fess' },
  'per-bend': { plain: 'Split diagonally ↘', term: 'per bend' },
  'per-bend-sinister': { plain: 'Split diagonally ↗', term: 'per bend sinister' },
  'per-saltire': { plain: 'Split in an X', term: 'per saltire' },
  'per-chevron': { plain: 'Split in a peak', term: 'per chevron' },
  quarterly: { plain: 'Four quarters', term: 'quarterly' },
  'per-chevron-inverted': { plain: 'Split in a valley', term: 'per chevron inverted' },
  'per-pall': { plain: 'Split in a Y', term: 'per pall' },
  'per-pall-inverted': { plain: 'Split in an upside-down Y', term: 'per pall inverted' },
  'tierced-per-pale': { plain: 'Three vertical stripes', term: 'tierced per pale' },
  'tierced-per-fess': { plain: 'Three horizontal stripes', term: 'tierced per fess' },
  gyronny: { plain: 'Split into wedges', term: 'gyronny' },
};

export const ORDINARY_LABEL: Record<OrdinaryType, PlainTerm> = {
  fess: { plain: 'Horizontal band', term: 'fess' },
  pale: { plain: 'Vertical band', term: 'pale' },
  bend: { plain: 'Diagonal band ↘', term: 'bend' },
  'bend-sinister': { plain: 'Diagonal band ↗', term: 'bend sinister' },
  chevron: { plain: 'Peaked band', term: 'chevron' },
  cross: { plain: 'Cross', term: 'cross' },
  saltire: { plain: 'X-shaped cross', term: 'saltire' },
  chief: { plain: 'Top bar', term: 'chief' },
  bordure: { plain: 'Border', term: 'bordure' },
  pile: { plain: 'Wedge', term: 'pile' },
  base: { plain: 'Bottom bar', term: 'base' },
  canton: { plain: 'Corner square', term: 'canton' },
  quarter: { plain: 'Corner quarter', term: 'quarter' },
  orle: { plain: 'Inner border', term: 'orle' },
  tressure: { plain: 'Thin inner border', term: 'tressure' },
  flaunches: { plain: 'Side curves', term: 'flaunches' },
  gore: { plain: 'Curved wedge', term: 'gore' },
  pall: { plain: 'Y-shaped band', term: 'pall' },
  'pall-inverted': { plain: 'Upside-down Y band', term: 'pall inverted' },
  point: { plain: 'Pointed base', term: 'point' },
  fret: { plain: 'Woven diamond', term: 'fret' },
  label: { plain: 'Bar with tabs', term: 'label' },
  gyron: { plain: 'Triangle wedge', term: 'gyron' },
  mount: { plain: 'Hill', term: 'mount' },
  trimount: { plain: 'Three hills', term: 'trimount' },
  bar: { plain: 'Narrow horizontal band', term: 'bar' },
  barrulet: { plain: 'Thin horizontal band', term: 'barrulet' },
  pallet: { plain: 'Narrow vertical band', term: 'pallet' },
  bendlet: { plain: 'Narrow diagonal band ↘', term: 'bendlet' },
  'bendlet-sinister': { plain: 'Narrow diagonal band ↗', term: 'bendlet sinister' },
  chevronel: { plain: 'Narrow peaked band', term: 'chevronel' },
  saltorel: { plain: 'Narrow X-shaped cross', term: 'saltorel' },
  baton: { plain: 'Short diagonal bar', term: 'baton' },
};

/** Layouts with a fixed label, by layout key; rows are worded from their numbers (`layoutLabel`). */
export const LAYOUT_LABEL: Record<string, PlainTerm> = {
  single: { plain: 'Single, centred', term: 'single' },
  host: { plain: 'Set by the band or shape', term: 'placed by the ordinary' },
  'in-pale': { plain: 'Stacked up and down', term: 'in pale' },
  'in-fess': { plain: 'Side by side', term: 'in fess' },
  'in-bend': { plain: 'Along a diagonal ↘', term: 'in bend' },
  'in-bend-sinister': { plain: 'Along a diagonal ↗', term: 'in bend sinister' },
  'in-cross': { plain: 'In a plus shape', term: 'in cross' },
  'in-saltire': { plain: 'In an X', term: 'in saltire' },
  'in-orle': { plain: 'Around the edge', term: 'in orle' },
  'in-annulo': { plain: 'In a ring', term: 'in annulo' },
  crossed: { plain: 'Crossed like an X', term: 'in saltire' },
  'in-chief': { plain: 'Along the top', term: 'in chief' },
  'in-base': { plain: 'Along the bottom', term: 'in base' },
};

const ROW_LABEL: Record<string, PlainTerm> = {
  '2-1': { plain: 'Two above, one below', term: 'two and one' },
  '2-2': { plain: 'Two above, two below', term: 'two and two' },
  '3-2-1': { plain: 'Three, two, one', term: 'three, two and one' },
};

/** The label of a layout key. Rows without a label of their own read "Rows of 2, 2 and 1 · two, two and one". */
export function layoutLabel(key: LayoutKey): PlainTerm {
  const fixed = LAYOUT_LABEL[key];
  if (fixed) return fixed;
  const rows = /^rows-(\d+(?:-\d+)*)$/.exec(key)?.[1];
  if (!rows) throw new RangeError(`No label for the layout "${key}".`);
  const counts = rows.split('-').map(Number);
  return ROW_LABEL[rows] ?? { plain: `Rows of ${joinAnd(counts.map(String))}`, term: joinAnd(counts.map(numberWord)) };
}

/** Tinctures: the colour people see first, the heraldic name second ("Gold · Or"). */
export const TINCTURE_LABEL: Record<GroupTincture, PlainTerm> = {
  or: { plain: 'Gold', term: 'Or' },
  argent: { plain: 'White', term: 'Argent' },
  celestine: { plain: 'Sky blue', term: 'Celestine' },
  azure: { plain: 'Blue', term: 'Azure' },
  gules: { plain: 'Red', term: 'Gules' },
  vert: { plain: 'Green', term: 'Vert' },
  sable: { plain: 'Black', term: 'Sable' },
  purpure: { plain: 'Purple', term: 'Purpure' },
  counterchanged: { plain: 'Swapped colours', term: 'counterchanged' },
};

/** Charges whose heraldic name isn't an everyday word; the rest are already plain ("lion", "key"). */
const CHARGE_PLAIN: Readonly<Partial<Record<ChargeId, { one: string; many: string }>>> = {
  mullet: { one: 'star', many: 'stars' },
  crescent: { one: 'moon', many: 'moons' },
  'fleur-de-lis': { one: 'lily', many: 'lilies' },
};

/** A charge for a picker or filter: "Star · mullet", or just "Lion" where the name is plain already. */
export function chargeLabel(id: ChargeId): string {
  const plain = CHARGE_PLAIN[id];
  return plain ? plainFirst({ plain: capitalise(plain.one), term: CHARGES[id].name }) : capitalise(CHARGES[id].name);
}

/** A charge in a sentence, plain word first: "a lion", "three stars (mullets)". */
export function chargeWords(id: ChargeId, count: number): string {
  const meta = CHARGES[id];
  const plain = CHARGE_PLAIN[id];
  const heraldic = count === 1 ? meta.name : meta.plural;
  return plain ? `${count === 1 ? plain.one : plain.many} (${heraldic})` : heraldic;
}

/** An ordinary in a sentence, plain first: "horizontal band (fess)", "cross". */
export function ordinaryWords(type: OrdinaryType): string {
  const { plain, term } = ORDINARY_LABEL[type];
  const lower = plain.toLowerCase();
  return lower === term ? term : `${lower} (${term})`;
}

/** Posture words, plain first: "Standing (statant)". Displayed has no everyday gloss of its own. */
export function postureLabel(id: ChargeId, posture: Posture): string {
  const term = postureTerm(id, posture);
  const plain = postureGloss(id, posture) ?? (posture === 'displayed' ? 'wings spread' : null);
  return plain ? `${capitalise(plain)} (${term})` : capitalise(term);
}

/**
 * What the builder calls a group: "Band or shape", "Picture", "Pictures on the band", "Top bar", "Border", or
 * "Pictures on the top bar" for what sits on one.
 */
export function groupLabel(d: Design, path: GroupPath): string {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (group.item.k === 'ordinary') {
    if (group.item.type === 'chief') return ORDINARY_LABEL.chief.plain;
    return group.item.type === 'bordure' ? ORDINARY_LABEL.bordure.plain : ORDINARY_KIND[group.item.type] === 'central' ? 'Band or shape' : capitalise(ORDINARY_LABEL[group.item.type].plain.toLowerCase());
  }
  if (host?.item.k === 'ordinary') {
    const onto = host.item.type === 'chief' || host.item.type === 'bordure' ? ORDINARY_LABEL[host.item.type].plain.toLowerCase() : 'band';
    return `Pictures on the ${onto}`;
  }
  return 'Picture';
}
