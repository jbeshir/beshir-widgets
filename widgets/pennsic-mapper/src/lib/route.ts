// Hash-based routing for the capability URLs.
//
// The secret lives in the URL *fragment* so it never reaches the server (or its logs) and page
// routing stays a static SPA. Two shapes:
//   #/m/<id>/<secret>  → edit mode (full editing)
//   #/m/<id>           → read-only view (duplicate-to-edit offered)
//   anything else      → landing (no map)

export type Route =
  | { mode: 'landing' }
  | { mode: 'edit'; id: string; secret: string }
  | { mode: 'readonly'; id: string };

export function parseHash(hash: string): Route {
  // Accept "#/m/..", "#m/..", and a leading "#/" tolerant of an extra slash.
  const raw = hash.replace(/^#/, '').replace(/^\//, '');
  const parts = raw.split('/').filter((p) => p.length > 0);
  if (parts[0] === 'm' && parts[1]) {
    const id = safeDecode(parts[1]);
    if (parts[2]) return { mode: 'edit', id, secret: safeDecode(parts[2]) };
    return { mode: 'readonly', id };
  }
  return { mode: 'landing' };
}

/** decodeURIComponent that never throws — a malformed hash must not blank the SPA on boot. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function editHash(id: string, secret: string): string {
  return `#/m/${encodeURIComponent(id)}/${encodeURIComponent(secret)}`;
}

export function shareHash(id: string): string {
  return `#/m/${encodeURIComponent(id)}`;
}

/** Absolute capability URLs for sharing/bookmarking, built from the current page (sans fragment). */
export function capabilityUrls(id: string, secret: string | null): { edit: string | null; share: string } {
  const base = typeof location !== 'undefined' ? location.origin + location.pathname + location.search : '';
  return {
    edit: secret ? base + editHash(id, secret) : null,
    share: base + shareHash(id),
  };
}
