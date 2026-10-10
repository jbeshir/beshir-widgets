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
