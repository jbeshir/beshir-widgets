// The public display name of a registration: plain text, shown to anyone, rendered only as text and
// never linkified. The Worker enforces these rules; the UI uses the same cap for its input and counter.

export const DISPLAY_NAME_MAX = 60;

// Controls (incl. newlines/tabs, which are first turned into spaces), and the bidi embedding /
// override / isolate characters that could make a public name render misleadingly.
const BREAKS = /[\t\n\v\f\r\u0085\u2028\u2029]+/g;
const STRIP = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu;

/** NFC, control and bidi-override characters removed, whitespace runs collapsed, trimmed. */
export function cleanText(s: string): string {
  return s.normalize('NFC').replace(BREAKS, ' ').replace(STRIP, '').replace(/\s{2,}/g, ' ').trim();
}

/** Length in code points, so an emoji or accented name is not over-counted. */
export function textLength(s: string): number {
  return [...s].length;
}

type TextFieldResult = { ok: true; value: string } | { ok: false; message: string };

export function cleanDisplayName(raw: unknown): TextFieldResult {
  if (typeof raw !== 'string') return { ok: false, message: 'A display name is required.' };
  const value = cleanText(raw);
  if (value === '') return { ok: false, message: 'A display name is required.' };
  if (textLength(value) > DISPLAY_NAME_MAX) {
    return { ok: false, message: `The display name must be at most ${DISPLAY_NAME_MAX} characters.` };
  }
  return { ok: true, value };
}
