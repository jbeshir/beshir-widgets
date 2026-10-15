// Divisions of the field (and of any paint), variations, treatments and the labels of their parts.
// Pure data — no DOM.

export const DIVISIONS = ['per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-saltire', 'per-chevron', 'quarterly',
  'per-chevron-inverted', 'per-pall', 'per-pall-inverted', 'tierced-per-pale', 'tierced-per-fess', 'gyronny'] as const;
export type Division = (typeof DIVISIONS)[number];

/** The divisions the builder draws: the first seven. */
export const DRAWN_DIVISIONS: readonly Division[] = DIVISIONS.slice(0, 7);

export const VARIATIONS = ['barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny', 'checky', 'lozengy', 'fusily', 'pily', 'barry-bendy', 'paly-bendy'] as const;
export type Variation = (typeof VARIATIONS)[number];

/** Blazon words, lower case: chevronny is blazoned "chevronelly", the barry-bendy pair without a hyphen (RULES D11). */
export const VARIATION_NAME: Record<Variation, string> = {
  barry: 'barry', paly: 'paly', bendy: 'bendy', 'bendy-sinister': 'bendy sinister', chevronny: 'chevronelly', checky: 'checky',
  lozengy: 'lozengy', fusily: 'fusily', pily: 'pily', 'barry-bendy': 'barry bendy', 'paly-bendy': 'paly bendy',
};


/** The stripes of a variation are counted: the others are drawn as a grid or in piles of a size of the artist's choosing. */
const COUNTED_VARIATIONS: readonly Variation[] = ['barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny'];


/** The stripe counts the builder offers (an odd count is a set of ordinaries, not a field), and the count a bare "barry" means. */
export const VARIATION_PIECES: readonly number[] = [4, 6, 8];
export const DEFAULT_PIECES = 6;


export const isCountedVariation = (v: Variation): boolean => COUNTED_VARIATIONS.includes(v);


/** The stripe count a variation is drawn with: its own, the default when none is given, and none for a variation that has no count. */
export const variationPieces = (v: Variation, pieces: number | null): number | null => (isCountedVariation(v) ? pieces ?? DEFAULT_PIECES : null);


export const TREATMENTS =['masoned', 'scaly', 'papellony', 'fretty', 'plumetty'] as const;
export type Treatment = (typeof TREATMENTS)[number];

/** Blazon words, lower case. */
export const DIVISION_NAME: Record<Division, string> = {
  'per-pale': 'per pale', 'per-fess': 'per fess', 'per-bend': 'per bend', 'per-bend-sinister': 'per bend sinister',
  'per-saltire': 'per saltire', 'per-chevron': 'per chevron', quarterly: 'quarterly',
  'per-chevron-inverted': 'per chevron inverted', 'per-pall': 'per pall', 'per-pall-inverted': 'per pall inverted',
  'tierced-per-pale': 'tierced per pale', 'tierced-per-fess': 'tierced per fess', gyronny: 'gyronny',
};

/** Labels for the parts of a divided paint, as you look at it. Quarterly and per saltire name their two alternating parts. */
export const DIVISION_PART_LABEL: Record<Division, readonly string[]> = {
  'per-pale': ['Left (dexter)', 'Right (sinister)'],
  'per-fess': ['Top (chief)', 'Bottom (base)'],
  'per-bend': ['Upper right', 'Lower left'],
  'per-bend-sinister': ['Upper left', 'Lower right'],
  'per-saltire': ['Top and bottom', 'Left and right'],
  'per-chevron': ['Above the chevron line', 'Below'],
  quarterly: ['1st and 4th quarters (top-left, bottom-right)', '2nd and 3rd quarters'],
  'per-chevron-inverted': ['Below the chevron line', 'Above'],
  'per-pall': ['Top left', 'Top right', 'Bottom'],
  'per-pall-inverted': ['Bottom left', 'Bottom right', 'Top'],
  'tierced-per-pale': ['Left', 'Middle', 'Right'],
  'tierced-per-fess': ['Top', 'Middle', 'Bottom'],
  gyronny: ['First part', 'Second part'],
};

export function isDivision(v: unknown): v is Division {
  return typeof v === 'string' && (DIVISIONS as readonly string[]).includes(v);
}

export function isVariation(v: unknown): v is Variation {
  return typeof v === 'string' && (VARIATIONS as readonly string[]).includes(v);
}

export function isTreatment(v: unknown): v is Treatment {
  return typeof v === 'string' && (TREATMENTS as readonly string[]).includes(v);
}

/** Paints a divided paint names: per pall and the tierced divisions have three; the alternating ones have two. */
export function partCount(d: Division): 2 | 3 {
  return d === 'per-pall' || d === 'per-pall-inverted' || d === 'tierced-per-pale' || d === 'tierced-per-fess' ? 3 : 2;
}
