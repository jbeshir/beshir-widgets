// Plain-words-first labels for the builder, filters and explainer: everyday wording with the heraldic
// term second ("Split down the middle · per pale"). The blazon keeps the heraldic names in
// design.ts; these are display text only. Pure data — no DOM.

import type { Arrangement, Division, OrdinaryType } from './design';
import type { Posture } from './charges';
import type { ChargeTincture } from './tinctures';

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

/** Posture words, plain first: "Standing (statant)". Displayed has no everyday gloss of its own. */
export function postureLabel(term: string, gloss: string | null, posture: Posture): string {
  const plain = gloss ?? (posture === 'displayed' ? 'wings spread' : null);
  return plain ? `${capitalise(plain)} (${term})` : capitalise(term);
}
