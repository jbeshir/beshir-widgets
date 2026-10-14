// The contrast predicate of the rule of tincture (SENA A3B). Apart from tincture-rule.ts so the default
// arrangements, which also need it, don't depend on the module that walks the design.

import { TINCTURE_CLASS, type Tincture } from './tinctures';

export type ContrastFailure = 'same' | 'colour-on-colour' | 'metal-on-metal';

/** How much of an element's ground one tincture covers (shares of a ground add up to 1). */
export interface GroundShare { t: Tincture; share: number }

/** What an element lies on: the tinctures under it with their shares, in the field's part order. */
export type Ground = readonly GroundShare[];

/**
 * The share of a ground that must be of one class (colour or metal) for the ground to count as that class;
 * below it on both sides the ground is neutral and contrasts with both (SENA A3B1: "over half colour … treated
 * as colours"; LoARs judge each charge by the section it lies "predominantly" on). Two thirds rather than a bare
 * majority leaves room for the drawing: a charge set on a line is never drawn exactly half and half.
 * Herald question H1 (REVIEW.md): majority, two thirds or the centre point.
 */
export const GROUND_CLASS_SHARE = 2 / 3;

/** The tinctures a ground touches at all. */
export const groundTinctures = (ground: Ground): Tincture[] => ground.map((g) => g.t);

/**
 * Why `top` fails on `ground`, or null when it contrasts. It may never touch its own tincture (SENA A3B4b), and fails
 * when its own class covers GROUND_CLASS_SHARE of the ground or more (A3B1, A3B4a).
 */
export function groundFailure(top: Tincture, ground: Ground): ContrastFailure | null {
  if (ground.some((g) => g.t === top)) return 'same';
  const alike = ground.reduce((sum, g) => sum + (TINCTURE_CLASS[g.t] === TINCTURE_CLASS[top] ? g.share : 0), 0);
  if (alike < GROUND_CLASS_SHARE - 1e-9) return null;
  return TINCTURE_CLASS[top] === 'colour' ? 'colour-on-colour' : 'metal-on-metal';
}

/** `groundFailure` on a ground shared evenly by `contacts`: one plain tincture, or the halves of a two-part field. */
export function contrastFailure(top: Tincture, contacts: readonly Tincture[]): ContrastFailure | null {
  return groundFailure(top, contacts.map((t) => ({ t, share: 1 / contacts.length })));
}
