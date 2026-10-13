// Rule of tincture (SENA A3B). So far only the contrast predicate, which the default arrangements need;
// the ground walker over groups lands with the tincture issues.

import { TINCTURE_CLASS, type Tincture } from '../tinctures';

export type ContrastFailure = 'same' | 'colour-on-colour' | 'metal-on-metal';

/** `contacts` = tinctures the element lies on. Never the same tincture, and at least one opposite class. */
export function contrastFailure(top: Tincture, contacts: readonly Tincture[]): ContrastFailure | null {
  if (contacts.includes(top)) return 'same';
  if (contacts.some((c) => TINCTURE_CLASS[c] !== TINCTURE_CLASS[top])) return null;
  return TINCTURE_CLASS[top] === 'colour' ? 'colour-on-colour' : 'metal-on-metal';
}
