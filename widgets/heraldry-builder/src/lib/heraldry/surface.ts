// What a paint is for the rule of tincture and for conflict: its contrast class and the base tinctures it
// shares with other paints (SENA A3B). Contrast, the tincture rule, difference and the render all speak in
// surfaces, so a paint that is not a plain tincture needs a surface here and nowhere else.

import { TINCTURE_CLASS, TINCTURES, type Tincture } from './tinctures';
import { notSupported, type Paint } from './design';

/** A neutral surface (a pattern of both classes) contrasts with metals and colours alike and is never "alike" to a top. */
export type ContrastClass = 'metal' | 'colour' | 'neutral';

/** The tinctures a surface is made of, which another surface may not share (A3B4b). */
export type BaseTincture = Tincture;

export interface Surface { cls: ContrastClass; bases: readonly BaseTincture[] }

const TINCTURE_SURFACES: Record<Tincture, Surface> = Object.fromEntries(
  TINCTURES.map((t) => [t, Object.freeze({ cls: TINCTURE_CLASS[t], bases: Object.freeze([t]) })]),
) as Record<Tincture, Surface>;

/** The surface of a plain tincture; one object per tincture, so surfaces can be counted by identity. */
export const tinctureSurface = (t: Tincture): Surface => TINCTURE_SURFACES[t];

/** The surface of a paint that is one thing everywhere (a divided or counterchanged paint has a surface per place it lies). */
export function surfaceOf(p: Paint): Surface {
  return p.k === 'tincture' ? tinctureSurface(p.t) : notSupported({ category: 'tincture', detail: p.k });
}

/** Whether two surfaces have a base tincture in common. */
export const sharesTincture = (a: Surface, b: Surface): boolean => a.bases.some((t) => b.bases.includes(t));

/** Whether two surfaces look the same to the rule of tincture and to conflict. */
export const sameSurface = (a: Surface, b: Surface): boolean =>
  a.cls === b.cls && a.bases.length === b.bases.length && a.bases.every((t, i) => t === b.bases[i]);
