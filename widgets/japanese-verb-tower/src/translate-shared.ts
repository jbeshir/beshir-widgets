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
        // Qwen3 soft switch: answer directly, no chain-of-thought.
        '/no_think\n' +
        'You translate a conjugated Japanese verb form into natural, idiomatic English. ' +
        'Each request gives the Japanese form, an ordered list of the grammatical features applied to it, and (when known) the base verb\'s English meaning. ' +
        'Produce the phrase a fluent speaker would actually use: features often combine into an idiom rather than a word-for-word gloss, and some (such as "polite") add no English words at all — do not simply chain the feature glosses. ' +
        'Worked examples (same input format as your task):\n\n' +
        'Base meaning: eat\nFeatures: polite · past\nJapanese form: たべました\n→ ate\n\n' +
        'Base meaning: drink\nFeatures: make/let · be ~ed\nJapanese form: のませられる\n→ be made to drink\n\n' +
        'Base meaning: read\nFeatures: not · become\nJapanese form: よまなくなる\n→ stop reading\n\n' +
        'Base meaning: say\nFeatures: end up/completely · past\nJapanese form: いってしまった\n→ ended up saying\n\n' +
        'Reply with only the resulting English phrase — no quotes, no Japanese, no explanation, no trailing punctuation.',
    },
    {
      role: 'user',
      content: `${base ? `Base meaning: ${base}\n` : ''}Features: ${joined}\nJapanese form: ${form}`,
    },
  ];
}

export function cleanTranslation(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';

  let s = raw.trim();
  if (s.length === 0) return '';

  // Drop any reasoning a model emits despite /no_think: remove complete
  // <think>…</think> blocks, then anything from an unclosed <think> onward.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const thinkAt = s.indexOf('<think>');
  if (thinkAt !== -1) s = s.slice(0, thinkAt);
  s = s.replace(/<\/think>/gi, '').trim();
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
