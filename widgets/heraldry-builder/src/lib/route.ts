// Hash-based routing for the capability URLs (lib/hashes.ts), plus the `?registry=` selector.
//
// The edit secret and recovery tokens live in the URL *fragment* so they never reach the server (or
// its logs) and page routing stays a static SPA. Shapes:
//   #/a/<id>/<secret>  → owner view (edit name/contact, withdraw)
//   #/a/<id>           → public entry view
//   #/recover          → "Lost your link?" request form
//   #/recover/<token>  → redeem an emailed recovery token
//   #/print/<id>       → printable nametag sheet of that entry
//   #/print            → Your arms tab (a sheet needs an entry)
//   anything else      → builder
// The registry is chosen with a query parameter (`?registry=<id>`); absent → the default registry.

import { entryHash, ownerHash } from './hashes';

export { RECOVER_HASH, entryHash, ownerHash, printHash } from './hashes';

export type Route =
  | { mode: 'builder' }
  | { mode: 'entry'; id: string }
  | { mode: 'owner'; id: string; secret: string }
  | { mode: 'recover' }
  | { mode: 'redeem'; token: string }
  | { mode: 'print'; id: string }
  | { mode: 'yours' };

export function parseHash(hash: string): Route {
  // Accept "#/a/..", "#a/..", and a leading "#/" tolerant of an extra slash.
  const raw = hash.replace(/^#/, '').replace(/^\//, '');
  const parts = raw.split('/').filter((p) => p.length > 0);
  if (parts[0] === 'a' && parts[1]) {
    const id = safeDecode(parts[1]);
    if (parts[2]) return { mode: 'owner', id, secret: safeDecode(parts[2]) };
    return { mode: 'entry', id };
  }
  if (parts[0] === 'recover') {
    return parts[1] ? { mode: 'redeem', token: safeDecode(parts[1]) } : { mode: 'recover' };
  }
  if (parts[0] === 'print') return parts[1] ? { mode: 'print', id: safeDecode(parts[1]) } : { mode: 'yours' };
  return { mode: 'builder' };
}

/** decodeURIComponent that never throws — a malformed hash must not blank the SPA on boot. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The current page without its fragment: the base of the absolute capability URLs. */
function pageBase(): string {
  return typeof location !== 'undefined' ? location.origin + location.pathname + location.search : '';
}

/** Absolute public link to an entry, for sharing. */
export function shareUrl(id: string): string {
  return pageBase() + entryHash(id);
}

/** Absolute private link that edits or withdraws an entry. */
export function editUrl(id: string, secret: string): string {
  return pageBase() + ownerHash(id, secret);
}

const REGISTRY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The `?registry=` selector from a query string; '' when absent or malformed (→ default). */
export function registryParam(search: string = typeof location !== 'undefined' ? location.search : ''): string {
  try {
    const v = new URLSearchParams(search).get('registry');
    return v && REGISTRY_ID.test(v) ? v : '';
  } catch {
    return '';
  }
}
