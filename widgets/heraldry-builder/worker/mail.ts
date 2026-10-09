// Sending email: one small function so the provider can be swapped. Today it is Resend's HTTP API
// (https://resend.com/docs/api-reference/emails/send-email), called with fetch.
//
// Without RESEND_API_KEY (local development) nothing is sent: one structured line is logged
// instead, carrying neither the address nor the message body, because the body holds capability
// links. Failures are logged the same way and reported to the caller, never thrown.

import type { MailOutcome } from '../src/lib/heraldry';

export interface MailEnv {
  /** Absent in local development, where sending is skipped. */
  RESEND_API_KEY?: string;
  /** The sender, e.g. "Heraldry Builder <heraldry@widgets.beshir.org>"; its domain must be verified in Resend. */
  MAIL_FROM: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 8000;

export async function sendMail(env: MailEnv, mail: Mail): Promise<MailOutcome> {
  if (!env.RESEND_API_KEY) {
    console.log(JSON.stringify({ event: 'mail_skipped', reason: 'no_api_key', subject: mail.subject }));
    return 'disabled';
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (res.ok) return 'sent';
    console.error(JSON.stringify({ event: 'mail_failed', subject: mail.subject, status: res.status }));
    return 'failed';
  } catch (e) {
    console.error(JSON.stringify({ event: 'mail_failed', subject: mail.subject, errorName: e instanceof Error ? e.name : typeof e }));
    return 'failed';
  }
}
