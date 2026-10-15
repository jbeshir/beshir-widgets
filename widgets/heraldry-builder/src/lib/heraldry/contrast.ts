// The contrast predicate of the rule of tincture (SENA A3B). Apart from tincture-rule.ts so the default
// arrangements, which also need it, don't depend on the module that walks the design.

import { isTincture, type Tincture } from './tinctures';
import { sharesTincture, tinctureSurface, type Surface } from './surface';

export type ContrastFailure = 'same' | 'colour-on-colour' | 'metal-on-metal';

/** How much of an element's ground one surface covers (shares of a ground add up to 1). */
export interface GroundShare { surface: Surface; share: number }

/** What an element lies on: the surfaces under it with their shares, in the field's part order. */
export type Ground = readonly GroundShare[];

/**
 * Where a top may share a tincture with its ground (SENA A3B4b): never, or when exactly one of the two is multiply divided and the top is an
 * ordinary or a simple geometric shape drawn so that both stay identifiable ("Pily gules and argent, a bordure per fess argent and gules";
 * "Vair, a chief argent"; "Checky Or and vert, a lozenge vert").
 */
export type SharedTinctureException = 'none' | 'shape-on-multiply-divided';


/**
 * The share of a ground that must be of one class (colour or metal) for the ground to count as that class;
 * below it on both sides the ground is neutral and contrasts with both (SENA A3B1: "over half colour … treated
 * as colours"; LoARs judge each charge by the section it lies "predominantly" on). Two thirds rather than a bare
 * majority leaves room for the drawing: a charge set on a line is never drawn exactly half and half.
 * Herald question H1 (REVIEW.md): majority, two thirds or the centre point.
 */
export const GROUND_CLASS_SHARE = 2 / 3;

/** The tinctures a ground touches at all. */
export const groundTinctures = (ground: Ground): Tincture[] => ground.flatMap((g) => g.surface.bases.filter(isTincture));

/**
 * Why `top` fails on `ground`, or null when it contrasts. Where a neutral surface is on either side (or the two are of one class),
 * it may never touch a tincture of its own (SENA A3B4b; GoT "Neutral Tincture"); and it fails when its own class covers
 * GROUND_CLASS_SHARE of the ground or more (A3B1, A3B4a). A metal and a colour contrast whatever they are made of: sable spots
 * on ermine don't make a sable charge on it "the same tincture" (RULES A.10 goodContrast; the College registers "Sable, a lion
 * ermine" and "Counter-ermine, a bend ermine"). A neutral top has no class to be alike in, and neutral parts of a ground count
 * toward neither class: "two neutral tinctures may have good contrast with each other, but identifiability must be maintained"
 * (A3B2), and the College registers them so ("Bendy sinister argent and sable, a flame proper", "(Fieldless) On a flame proper a
 * fleur-de-lys per pale argent and azure"); only the shared tincture is judged. With the exception the shared tincture is allowed,
 * and the classes alone decide.
 */
export function groundFailure(top: Surface, ground: Ground, exception: SharedTinctureException = 'none'): ContrastFailure | null {
  const sameKind = (g: Surface) => top.cls === g.cls || top.cls === 'neutral' || g.cls === 'neutral';
  if (exception === 'none' && ground.some((g) => sameKind(g.surface) && sharesTincture(top, g.surface))) return 'same';
  if (top.cls === 'neutral') return null;
  const alike = ground.reduce((sum, g) => sum + (g.surface.cls === top.cls ? g.share : 0), 0);
  if (alike < GROUND_CLASS_SHARE - 1e-9) return null;
  return top.cls === 'colour' ? 'colour-on-colour' : 'metal-on-metal';
}

/** `groundFailure` for a plain tincture on a ground shared evenly by `contacts`: one plain tincture, or the halves of a two-part field. */
export function contrastFailure(top: Tincture, contacts: readonly Tincture[]): ContrastFailure | null {
  return groundFailure(tinctureSurface(top), contacts.map((t) => ({ surface: tinctureSurface(t), share: 1 / contacts.length })));
}
