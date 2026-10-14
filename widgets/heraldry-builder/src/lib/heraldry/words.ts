// Small wording helpers shared by the messages, labels and hints.

/** The text with its first letter capitalised. */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "a", "a and b", "a, b and c" (or "a, b or c" with the conjunction 'or'). */
export function joinList(words: readonly string[], conjunction: 'and' | 'or'): string {
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} ${conjunction} ${words[words.length - 1]}`;
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(words: readonly string[]): string {
  return joinList(words, 'and');
}

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'] as const;

/** "two" … "twenty". A single item is written with its article, so callers never pass 1 for a count. */
export function numberWord(n: number): string {
  const word = NUMBER_WORDS[n - 1];
  if (word === undefined || !Number.isInteger(n)) throw new RangeError(`No number word for ${n}.`);
  return word;
}
