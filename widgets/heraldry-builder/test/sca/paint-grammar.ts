// The matcher's paint reader, shared by the field and by groups: the paint at a position in the tokens of a
// normalised blazon, as the loose input `resolve` reads (a tincture word, 'counterchanged', or a division of tinctures).

import { DIVISION_NAME, DRAWN_DIVISIONS, TINCTURES, type Division, type Tincture } from '../../src/lib/heraldry';

export const DIVISION_WORDS = new Map<string, Division>(DRAWN_DIVISIONS.map((d) => [DIVISION_NAME[d], d]));

const DIVISION_PHRASES = [...DIVISION_WORDS.keys()].map((w) => w.split(' ')).sort((a, b) => b.length - a.length);

const isTincture = (w: string | undefined): w is Tincture => (TINCTURES as readonly string[]).includes(w!);

export interface PaintRead { paint: unknown; end: number }

/**
 * The paint starting at `tokens[i]` and the index after it, or null when there is none. A group takes a tincture or
 * 'counterchanged'; the field a tincture or a division "per pale argent and gules".
 */
export function readPaint(tokens: readonly string[], i: number, where: 'field' | 'group'): PaintRead | null {
  const word = tokens[i];
  if (isTincture(word)) return { paint: word, end: i + 1 };
  if (where === 'group') return word === 'counterchanged' ? { paint: word, end: i + 1 } : null;
  const phrase = DIVISION_PHRASES.find((p) => p.every((w, j) => tokens[i + j] === w));
  if (!phrase) return null;
  const at = i + phrase.length;
  const [a, and, b] = [tokens[at], tokens[at + 1], tokens[at + 2]];
  if (!isTincture(a) || and !== 'and' || !isTincture(b)) return null;
  return { paint: { k: 'divided', division: DIVISION_WORDS.get(phrase.join(' ')), parts: [a, b] }, end: at + 3 };
}
