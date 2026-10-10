// Public contact details of a registration. Today the one kind is a Discord username; each kind is
// its own nullable key (and its own D1 column), so adding a kind is one more key, one more column
// and one more validator. Contacts are shown only on an entry's own page, never in list or search
// results. The Worker enforces these rules and the SPA uses the same functions for inline errors.

/** Every contact kind, each null when not given. */
export interface Contact {
  discord: string | null;
}

export const NO_CONTACT: Contact = { discord: null };

// Discord's username rules: 2–32 characters of lowercase a–z, 0–9, `_` and `.`, with no two
// periods in a row. Usernames are case-insensitive, so input is lowercased.
const DISCORD_MIN = 2;
export const DISCORD_MAX = 32;
const DISCORD_CHARS = /^[a-z0-9_.]+$/;

type DiscordResult = { ok: true; value: string | null } | { ok: false; message: string };

/** Optional: missing, null or blank → null. Trims, strips one leading `@`, lowercases, then validates. */
export function cleanDiscord(raw: unknown): DiscordResult {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, message: 'The Discord username must be text.' };
  const value = raw.trim().replace(/^@/, '').toLowerCase();
  if (value === '') return { ok: true, value: null };
  if (value.length < DISCORD_MIN || value.length > DISCORD_MAX) {
    return { ok: false, message: `A Discord username is ${DISCORD_MIN}–${DISCORD_MAX} characters long.` };
  }
  if (!DISCORD_CHARS.test(value)) {
    return { ok: false, message: 'A Discord username uses only letters, numbers, underscores and periods.' };
  }
  if (value.includes('..')) return { ok: false, message: "A Discord username can't have two periods in a row." };
  return { ok: true, value };
}

type ContactResult = { ok: true; value: Contact } | { ok: false; field: 'discord'; message: string };

/** A request's `contact`: missing or null → no contact; otherwise an object of per-kind values. */
export function cleanContact(raw: unknown): ContactResult {
  if (raw === undefined || raw === null) return { ok: true, value: NO_CONTACT };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, field: 'discord', message: 'The contact must be an object, e.g. { "discord": "name" }.' };
  }
  const discord = cleanDiscord((raw as Record<string, unknown>).discord);
  if (!discord.ok) return { ok: false, field: 'discord', message: discord.message };
  return { ok: true, value: { discord: discord.value } };
}
