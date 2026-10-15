// Furs as paints: what colours a fur is made of and its one canonical spelling. "Argent ermined gules" and
// "vairy Or and gules" are a fur plus two colours; a fur whose colours are its own ("ermine" is argent with sable
// spots) carries none, so equal furs have equal JSON.

import { FURS, FUR_NAME, FUR_SPEC, TINCTURES, TINCTURE_GLOSS, tinctureWord, type Fur, type Tincture } from './tinctures';
import type { Paint } from './design';

export type FurPaint = Extract<Paint, { k: 'fur' }>;

type ColourPair = readonly [Tincture, Tincture];

/** The ground and spots (ermine family) or the two tinctures (vair and potent) a fur paint is drawn in. */
export function furColours(p: FurPaint): ColourPair {
  const spec = FUR_SPEC[p.fur];
  return p.colours ?? [spec.ground, spec.spots];
}

const tinctureRank = (t: Tincture): number => TINCTURES.indexOf(t);

/** Potent's two tinctures are one set either way round ("potenty argent and azure" is "potenty azure and argent", Prec #FUR). */
const inRankOrder = ([a, b]: ColourPair): [Tincture, Tincture] => (tinctureRank(a) <= tinctureRank(b) ? [a, b] : [b, a]);

/** The named ermine-family fur with exactly this ground and these spots, if there is one. */
const namedErmine = ([ground, spots]: ColourPair): Fur | undefined =>
  FURS.find((f) => FUR_SPEC[f].family === 'ermine' && FUR_SPEC[f].ground === ground && FUR_SPEC[f].spots === spots);

/**
 * The fur paint in its one spelling: an ermine-family fur with colours is the named fur they spell, or "ermine" with
 * those colours; a vair or potent fur whose colours are the usual argent and azure carries none, and potent's are in a
 * fixed order.
 */
export function canonicalFur(p: FurPaint): FurPaint {
  const spec = FUR_SPEC[p.fur];
  if (spec.family === 'ermine') {
    if (!p.colours) return { k: 'fur', fur: p.fur, colours: null };
    const named = namedErmine(p.colours);
    return { k: 'fur', fur: named ?? 'ermine', colours: named ? null : [p.colours[0], p.colours[1]] };
  }
  if (!p.colours) return { k: 'fur', fur: p.fur, colours: null };
  const [a, b] = spec.family === 'potent' ? inRankOrder(p.colours) : p.colours;
  return { k: 'fur', fur: p.fur, colours: a === spec.ground && b === spec.spots ? null : [a, b] };
}

/** A fur as a blazon words it: "ermine", "vair en pointe", "argent ermined gules", "vairy Or and gules", "potenty argent and sable". */
export function furName(p: FurPaint): string {
  if (!p.colours) return FUR_NAME[p.fur];
  const [a, b] = p.colours.map(tinctureWord);
  const { family } = FUR_SPEC[p.fur];
  return family === 'ermine' ? `${a} ermined ${b}` : `${family === 'vair' ? 'vairy' : 'potenty'} ${a} and ${b}`;
}

/** A fur in plain words, its look in brackets: "ermine (white with black spots)", "vair (rows of white and blue bells)". */
export function furGloss(p: FurPaint): string {
  const [a, b] = furColours(p).map((t) => TINCTURE_GLOSS[t]);
  const { family } = FUR_SPEC[p.fur];
  const look = family === 'ermine' ? `${a} with ${b} spots` : family === 'vair' ? `rows of ${a} and ${b} bells` : `${a} and ${b} crutch-heads fitted together`;
  return `${furName(p)} (${look})`;
}

/** What a fur picker offers: each named fur, and for each family the same fur in colours of the picker's own choosing. */
export type FurKind = Fur | 'ermined' | 'vairy' | 'potenty';

export const FUR_KINDS: readonly FurKind[] = [...FURS, 'ermined', 'vairy', 'potenty'];

/** The picker kind of a fur paint: its own name, or (when it names colours) the family's own-colours kind. */
export function furKindOf(p: FurPaint): FurKind {
  if (!p.colours) return p.fur;
  const { family } = FUR_SPEC[p.fur];
  return family === 'ermine' ? 'ermined' : family === 'vair' ? 'vairy' : 'potenty';
}

/** Whether a fur can be drawn in colours of its own: the ermine family and plain vair and potent (counter- and en pointe furs keep theirs). */
export const takesColours = (fur: Fur): boolean => FUR_SPEC[fur].layout === 'plain';
