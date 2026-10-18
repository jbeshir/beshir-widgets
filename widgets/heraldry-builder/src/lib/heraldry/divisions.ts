// Divisions of the field (and of any paint), variations, treatments and the labels of their parts.
// Pure data — no DOM.

export const DIVISIONS = ['per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-saltire', 'per-chevron', 'quarterly',
  'per-chevron-inverted', 'per-pall', 'per-pall-inverted', 'tierced-per-pale', 'tierced-per-fess', 'gyronny', 'per-chevron-throughout'] as const;
export type Division = (typeof DIVISIONS)[number];

/** The divisions the builder offers on the field: the first seven. */
export const BUILDER_DIVISIONS: readonly Division[] = DIVISIONS.slice(0, 7);
/** Divisions drawn but reached only behind disclosure ("More divisions and edges…"). */
export const MORE_DIVISIONS: readonly Division[] = ['per-chevron-inverted', 'per-chevron-throughout', 'gyronny', 'per-pall', 'per-pall-inverted', 'tierced-per-pale', 'tierced-per-fess'];
/** Every division the library draws. */
export const DRAWN_DIVISIONS: readonly Division[] = [...BUILDER_DIVISIONS, ...MORE_DIVISIONS];

export const VARIATIONS = ['barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny', 'checky', 'lozengy', 'fusily', 'pily', 'barry-bendy', 'paly-bendy'] as const;
export type Variation = (typeof VARIATIONS)[number];

/** Blazon words, lower case: chevronny is blazoned "chevronelly", the barry-bendy pair without a hyphen (RULES D11). */
export const VARIATION_NAME: Record<Variation, string> = {
  barry: 'barry', paly: 'paly', bendy: 'bendy', 'bendy-sinister': 'bendy sinister', chevronny: 'chevronelly', checky: 'checky',
  lozengy: 'lozengy', fusily: 'fusily', pily: 'pily', 'barry-bendy': 'barry bendy', 'paly-bendy': 'paly bendy',
};

/** Every spelling of a variation the SCA writes (lower case, hyphenated where it is one word), each to the variation: the ids, and the College's other spellings. */
export const VARIATION_SPELLINGS: Readonly<Record<string, Variation>> = {
  ...Object.fromEntries(VARIATIONS.map((v) => [v, v])),
  chevronelly: 'chevronny', chequy: 'checky', fusilly: 'fusily',
};

/** The stripes of a variation are counted: the others are drawn as a grid or in piles of a size of the artist's choosing. */
const COUNTED_VARIATIONS: readonly Variation[] = ['barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny'];

/** The counted variations whose stripes may be drawn with a line (chevronny's corners take none). */
export const LINED_VARIATIONS: readonly Variation[] = COUNTED_VARIATIONS.filter((v) => v !== 'chevronny');

/** The stripe counts the builder offers (an odd count is a set of ordinaries, not a field), and the count a bare "barry" means. */
export const VARIATION_PIECES: readonly number[] = [4, 6, 8];
export const DEFAULT_PIECES = 6;

/** The gyronny piece counts the builder offers, and the count a bare "gyronny" means (blazoned only when it is another). */
export const GYRONNY_PIECES: readonly number[] = [6, 8, 12];
export const DEFAULT_GYRONNY_PIECES = 8;

/** The piece count a division is drawn with: a gyronny's own (the default when none is given), and none for any other division. */
export const divisionPieces = (d: Division, pieces: number | null): number | null => (d === 'gyronny' ? pieces ?? DEFAULT_GYRONNY_PIECES : null);

export const isCountedVariation = (v: Variation): boolean => COUNTED_VARIATIONS.includes(v);

/** The stripe count a variation is drawn with: its own, the default when none is given, and none for a variation that has no count. */
export const variationPieces = (v: Variation, pieces: number | null): number | null => (isCountedVariation(v) ? pieces ?? DEFAULT_PIECES : null);

export const TREATMENTS = ['masoned', 'scaly', 'papellony', 'fretty', 'plumetty'] as const;
export type Treatment = (typeof TREATMENTS)[number];

/** The treatments the builder draws: a brick wall and two kinds of voided scales (RULES §3.2). Fretty is a charge and plumetty a fur-like pattern; both stay gapped. */
export const DRAWN_TREATMENTS = ['masoned', 'scaly', 'papellony'] as const satisfies readonly Treatment[];
export type DrawnTreatment = (typeof DRAWN_TREATMENTS)[number];
export const isDrawnTreatment = (t: Treatment): t is DrawnTreatment => (DRAWN_TREATMENTS as readonly Treatment[]).includes(t);

/** Blazon words, lower case: the tierced divisions are blazoned "tierced in pale" and "tierced in fess" (RULES-C §G.2). */
export const DIVISION_NAME: Record<Division, string> = {
  'per-pale': 'per pale', 'per-fess': 'per fess', 'per-bend': 'per bend', 'per-bend-sinister': 'per bend sinister',
  'per-saltire': 'per saltire', 'per-chevron': 'per chevron', quarterly: 'quarterly',
  'per-chevron-inverted': 'per chevron inverted', 'per-pall': 'per pall', 'per-pall-inverted': 'per pall inverted',
  'tierced-per-pale': 'tierced in pale', 'tierced-per-fess': 'tierced in fess', gyronny: 'gyronny',
  'per-chevron-throughout': 'per chevron throughout',
};

/** Labels for the parts of a divided paint, as you look at it, in blazon order. Quarterly and per saltire name their two alternating parts. */
export const DIVISION_PART_LABEL: Record<Division, readonly string[]> = {
  'per-pale': ['Left (dexter)', 'Right (sinister)'],
  'per-fess': ['Top (chief)', 'Bottom (base)'],
  'per-bend': ['Upper right', 'Lower left'],
  'per-bend-sinister': ['Upper left', 'Lower right'],
  'per-saltire': ['Top and bottom', 'Left and right'],
  'per-chevron': ['Above the chevron line', 'Below'],
  quarterly: ['1st and 4th quarters (top-left, bottom-right)', '2nd and 3rd quarters'],
  'per-chevron-inverted': ['Above the inverted chevron line', 'Below'],
  'per-pall': ['Top', 'Left (dexter)', 'Right (sinister)'],
  'per-pall-inverted': ['Left (dexter)', 'Right (sinister)', 'Bottom'],
  'tierced-per-pale': ['Left', 'Middle', 'Right'],
  'tierced-per-fess': ['Top', 'Middle', 'Bottom'],
  gyronny: ['First part (the gyron above the middle line, on the left)', 'Second part'],
  'per-chevron-throughout': ['Above the chevron line', 'Below (the point reaches the top)'],
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

/** The parts of a division that lie against each other across a line, as pairs of part indices: every pair of per pall's three, a tierced field's middle with each outer part. */
export function adjacentParts(d: Division): ReadonlyArray<readonly [number, number]> {
  if (partCount(d) === 2) return [[0, 1]];
  return d === 'tierced-per-pale' || d === 'tierced-per-fess' ? [[0, 1], [1, 2]] : [[0, 1], [0, 2], [1, 2]];
}
