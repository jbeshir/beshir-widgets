// The matcher's paint reader, shared by the field and by groups: the paint at a position in the tokens of a
// normalised blazon, as the loose input `resolve` reads (a tincture word, a fur, a treatment, 'counterchanged' or 'proper', or a division of those).

import { CHARGES, CHARGE_IDS, DIVISION_NAME, DRAWN_DIVISIONS, DRAWN_TREATMENTS, FURS, FUR_NAME, TINCTURES, VARIATIONS, VARIATION_NAME, type Division, type Fur, type Tincture, type Treatment, type Variation } from '../../src/lib/heraldry';

export const DIVISION_WORDS = new Map<string, Division>(DRAWN_DIVISIONS.map((d) => [DIVISION_NAME[d], d]));

const DIVISION_PHRASES = [...DIVISION_WORDS.keys()].map((w) => w.split(' ')).sort((a, b) => b.length - a.length);

/** The named furs as the words that spell them ("vair en pointe"), the longest first. */
const FUR_PHRASES = FURS.map((fur) => ({ words: FUR_NAME[fur].split(' '), fur })).sort((a, b) => b.words.length - a.words.length);

/** The fur of a family that names its colours: "vairy Or and gules", "potenty argent and sable". */
const COLOURED_FURS: Record<string, Fur> = { vairy: 'vair', potenty: 'potent' };

/** The variations as the words that spell them ("bendy sinister", "barry bendy"), the longest first. */
const VARIATION_PHRASES = VARIATIONS.map((variation) => ({ words: VARIATION_NAME[variation].split(' '), variation })).sort((a, b) => b.words.length - a.words.length);

/** The charges as the words of their plural ("crosses crosslet"), the longest first: what a semy is "semy of". */
const STREWN_PHRASES = CHARGE_IDS.map((id) => ({ words: CHARGES[id].plural.split(' '), id })).sort((a, b) => b.words.length - a.words.length);

const isTreatment = (w: string | undefined): w is Treatment => (DRAWN_TREATMENTS as readonly (string | undefined)[]).includes(w);

const COUNT_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

const isTincture = (w: string | undefined): w is Tincture => (TINCTURES as readonly string[]).includes(w!);

export interface PaintRead { paint: unknown; end: number }

/** One paint that is one thing: a tincture, "argent ermined gules", "argent masoned sable", "azure semy of mullets Or", a named fur, "vairy Or and gules". */
function readOne(tokens: readonly string[], i: number): PaintRead | null {
  const word = tokens[i];
  if (isTincture(word)) {
    if (tokens[i + 1] === 'semy' && tokens[i + 2] === 'of') {
      const noun = STREWN_PHRASES.find((p) => p.words.every((w, j) => tokens[i + 3 + j] === w));
      const ink = noun && tokens[i + 3 + noun.words.length];
      if (noun && isTincture(ink)) return { paint: { k: 'semy', ground: word, charge: { charge: noun.id }, ink }, end: i + 4 + noun.words.length };
    }
    const spots = tokens[i + 2];
    if (isTreatment(tokens[i + 1]) && isTincture(spots)) return { paint: { k: 'treated', treatment: tokens[i + 1], ground: word, ink: spots }, end: i + 3 };
    return tokens[i + 1] === 'ermined' && isTincture(spots)
      ? { paint: { k: 'fur', fur: 'ermine', colours: [word, spots] }, end: i + 3 }
      : { paint: word, end: i + 1 };
  }
  const [a, and, b] = [tokens[i + 1], tokens[i + 2], tokens[i + 3]];
  if (word in COLOURED_FURS && isTincture(a) && and === 'and' && isTincture(b)) {
    return { paint: { k: 'fur', fur: COLOURED_FURS[word], colours: [a, b] }, end: i + 4 };
  }
  const named = FUR_PHRASES.find((p) => p.words.every((w, j) => tokens[i + j] === w));
  return named ? { paint: { k: 'fur', fur: named.fur, colours: null }, end: i + named.words.length } : null;
}

/** A variation of the field, "barry of eight argent and azure", "checky Or and sable": the stripe count is the word after "of", when there is one. */
function readVariation(tokens: readonly string[], i: number): PaintRead | null {
  const named = VARIATION_PHRASES.find((p) => p.words.every((w, j) => tokens[i + j] === w));
  if (!named) return null;
  let at = i + named.words.length;
  let pieces: number | null = null;
  if (tokens[at] === 'of' && tokens[at + 1] in COUNT_WORDS) {
    pieces = COUNT_WORDS[tokens[at + 1]];
    at += 2;
  }
  const [a, and, b] = [tokens[at], tokens[at + 1], tokens[at + 2]];
  return isTincture(a) && and === 'and' && isTincture(b)
    ? { paint: { k: 'variation', variation: named.variation satisfies Variation, pieces, parts: [a, b] }, end: at + 3 }
    : null;
}

/** "all semy of roses gules" after a division's two tinctures: both parts strewn alike, or (counterchanged) each with the other's tincture. */
function readAllSemy(tokens: readonly string[], i: number, a: string, b: string): { parts: unknown[]; end: number } | null {
  if (tokens[i] !== 'all' || tokens[i + 1] !== 'semy' || tokens[i + 2] !== 'of') return null;
  const noun = STREWN_PHRASES.find((p) => p.words.every((w, j) => tokens[i + 3 + j] === w));
  const ink = noun && tokens[i + 3 + noun.words.length];
  if (!noun || !(isTincture(ink) || ink === 'counterchanged')) return null;
  const semy = (ground: string, strewn: string) => ({ k: 'semy', ground, charge: { charge: noun.id }, ink: strewn });
  return { parts: ink === 'counterchanged' ? [semy(a, b), semy(b, a)] : [semy(a, ink), semy(b, ink)], end: i + 4 + noun.words.length };
}

/**
 * The paint starting at `tokens[i]` and the index after it, or null when there is none: a tincture or fur, a division "per pale argent
 * and gules" (of the field, or of a band or picture), a variation "barry argent and azure", or for a group 'counterchanged'.
 */
export function readPaint(tokens: readonly string[], i: number, where: 'field' | 'group'): PaintRead | null {
  if (where === 'group' && (tokens[i] === 'counterchanged' || tokens[i] === 'proper')) return { paint: tokens[i], end: i + 1 };
  const one = readOne(tokens, i);
  if (one) return one;
  const varied = readVariation(tokens, i);
  if (varied) return varied;
  const phrase = DIVISION_PHRASES.find((p) => p.every((w, j) => tokens[i + j] === w));
  if (!phrase) return null;
  const first = readOne(tokens, i + phrase.length);
  if (!first || tokens[first.end] !== 'and') return null;
  const second = readOne(tokens, first.end + 1);
  if (!second) return null;
  const all = typeof first.paint === 'string' && typeof second.paint === 'string' ? readAllSemy(tokens, second.end, first.paint, second.paint) : null;
  if (all) return { paint: { k: 'divided', division: DIVISION_WORDS.get(phrase.join(' ')), parts: all.parts }, end: all.end };
  return { paint: { k: 'divided', division: DIVISION_WORDS.get(phrase.join(' ')), parts: [first.paint, second.paint] }, end: second.end };
}
