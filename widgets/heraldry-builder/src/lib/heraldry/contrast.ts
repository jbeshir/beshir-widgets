// The contrast predicate of the rule of tincture (SENA A3B). Apart from tincture-rule.ts so the default
// arrangements, which also need it, don't depend on the module that walks the design.

import { TINCTURE_CLASS, type Tincture } from './tinctures';

export type ContrastFailure = 'same' | 'colour-on-colour' | 'metal-on-metal';

/** `contacts` = tinctures the element lies on. Never the same tincture, and at least one opposite class. */
export function contrastFailure(top: Tincture, contacts: readonly Tincture[]): ContrastFailure | null {
  if (contacts.includes(top)) return 'same';
  if (contacts.some((c) => TINCTURE_CLASS[c] !== TINCTURE_CLASS[top])) return null;
  return TINCTURE_CLASS[top] === 'colour' ? 'colour-on-colour' : 'metal-on-metal';
}
