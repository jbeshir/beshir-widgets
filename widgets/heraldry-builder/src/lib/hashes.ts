// The URL fragments of the widget's capability links, shared by the SPA's router and the Worker's
// emails. Secrets and tokens live in the fragment so they never reach a server or its logs.
//   #/a/<id>/<secret>   → owner view (edit or withdraw)
//   #/a/<id>            → public entry view
//   #/recover           → "Lost your link?" request form
//   #/recover/<token>   → redeem an emailed recovery token

export function ownerHash(id: string, secret: string): string {
  return `#/a/${encodeURIComponent(id)}/${encodeURIComponent(secret)}`;
}

export function entryHash(id: string): string {
  return `#/a/${encodeURIComponent(id)}`;
}

export const RECOVER_HASH = '#/recover';

export function recoverTokenHash(token: string): string {
  return `${RECOVER_HASH}/${encodeURIComponent(token)}`;
}
