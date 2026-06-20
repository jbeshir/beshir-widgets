export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildTranslateMessages(
  base: string,
  features: string[],
  form: string,
): ChatMessage[] {
  const joined = features.join(' · ');
  return [
    {
      role: 'system',
      content:
        'You translate a conjugated Japanese verb form into natural, idiomatic English. ' +
        'You are given the Japanese form, plus the base verb\'s English meaning and its ordered grammatical features as hints. ' +
        'Render the meaning of the whole form the way a fluent speaker would phrase it, treating grammatical constructions as idioms ' +
        '(e.g. 〜てはいけない → "must not ~", 〜なければならない → "have to ~", 〜てしまう → "end up ~ing"). ' +
        'Reply with only the resulting English phrase — no quotes, no Japanese, no explanation, no trailing punctuation.',
    },
    {
      role: 'user',
      content: `Base meaning: ${base}\nFeatures: ${joined}\nJapanese form: ${form}`,
    },
  ];
}

export function cleanTranslation(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';

  let s = raw.trim();
  if (s.length === 0) return '';

  s = s.split(/\r?\n/)[0].trim();
  if (s.length === 0) return '';

  // Strip one surrounding matched quote pair
  const quotePairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
  ];
  for (const [open, close] of quotePairs) {
    if (s.startsWith(open) && s.endsWith(close) && s.length > open.length + close.length - 1) {
      s = s.slice(open.length, s.length - close.length);
      break;
    }
  }

  // Strip single trailing period
  if (s.endsWith('.') || s.endsWith('。')) {
    s = s.slice(0, -1);
  }

  // Collapse internal whitespace runs
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
