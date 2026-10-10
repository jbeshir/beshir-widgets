// Everyday wording paired with the heraldic term, for the builder, filters and explainer. Most labels
// lead with the everyday words ("Split down the middle · per pale"); the field and band tiles show
// the term and keep the words for their tooltip. The blazon keeps the heraldic names in design.ts;
// these are display text only. Pure data — no DOM.

import type { Arrangement, Division, OrdinaryType } from './design';
import { CHARGES, type ChargeId, type Posture } from './charges';
import type { ChargeTincture } from './tinctures';
import { capitalise } from './words';

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
};

export const ARRANGEMENT_LABEL: Record<Arrangement, PlainTerm> = {
  single: { plain: 'Single, centred', term: 'single' },
  forced: { plain: 'Set by the band or shape', term: 'placed by the ordinary' },
  'in-pale': { plain: 'Stacked up and down', term: 'in pale' },
  'in-fess': { plain: 'Side by side', term: 'in fess' },
  'in-bend': { plain: 'Along a diagonal ↘', term: 'in bend' },
  'in-bend-sinister': { plain: 'Along a diagonal ↗', term: 'in bend sinister' },
  'two-and-one': { plain: 'Two above, one below', term: 'two and one' },
  'two-and-two': { plain: 'Two above, two below', term: 'two and two' },
  'in-cross': { plain: 'In a plus shape', term: 'in cross' },
  'in-saltire': { plain: 'In an X', term: 'in saltire' },
  'three-two-one': { plain: 'Three, two, one', term: 'three, two and one' },
};

/** Tinctures: the colour people see first, the heraldic name second ("Gold · Or"). */
export const TINCTURE_LABEL: Record<ChargeTincture, PlainTerm> = {
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
export function postureLabel(term: string, gloss: string | null, posture: Posture): string {
  const plain = gloss ?? (posture === 'displayed' ? 'wings spread' : null);
  return plain ? `${capitalise(plain)} (${term})` : capitalise(term);
}
