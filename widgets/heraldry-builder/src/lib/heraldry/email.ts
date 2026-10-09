// The owner's email address: required at registration and for "Lost your link?". It is never stored
// or shown: the Worker keeps only an HMAC of the normalised address and uses the plaintext just to
// send mail in the same request. Normalising is deliberately simple — trim and lowercase the whole
// address — and provider-specific rewrites (dots, +tags) are not applied, so the user must type the
// address the same way when recovering (case and surrounding spaces don't matter).

/** The longest address SMTP can deliver to. */
export const EMAIL_MAX = 254;

// One @, a local part with no spaces or controls, and a dotted domain whose labels are non-empty.
const EMAIL_PATTERN = /^[^\s@\p{Cc}]{1,64}@[^\s@.\p{Cc}]+(?:\.[^\s@.\p{Cc}]+)+$/u;

export type EmailResult = { ok: true; value: string } | { ok: false; message: string };

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function cleanEmail(raw: unknown): EmailResult {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, message: 'An email address is required.' };
  const value = normaliseEmail(raw);
  if (value.length > EMAIL_MAX) return { ok: false, message: `An email address is at most ${EMAIL_MAX} characters.` };
  if (!EMAIL_PATTERN.test(value)) return { ok: false, message: 'Enter an email address like name@example.com.' };
  return { ok: true, value };
}

/** What happened to an email the Worker tried to send; `disabled` means sending isn't configured. */
export type MailOutcome = 'sent' | 'failed' | 'disabled';
