// What a paint is for the rule of tincture and for conflict: its contrast class and the base tinctures it
// shares with other paints (SENA A3B). Contrast, the tincture rule, difference and the render all speak in
// surfaces, so a paint that is not a plain tincture needs a surface here and nowhere else.

import { FUR_SPEC, TINCTURE_CLASS, TINCTURES, type Tincture } from './tinctures';
import { asParty, fieldParts, notSupported, type Design, type Paint } from './design';
import { furColours } from './fur';

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

const FUR_SURFACES = new Map<string, Surface>();

/**
 * The surface of a fur (RB §1.1): ermine's family is the class of its ground and shares ground and spots; vair and potent
 * are neutral (as many of one class as the other) and share both tinctures, whichever way round. Like a tincture's, one
 * object per surface, so surfaces can be counted by identity.
 */
function furSurface(p: Extract<Paint, { k: 'fur' }>): Surface {
  const [a, b] = furColours(p);
  const ermine = FUR_SPEC[p.fur].family === 'ermine';
  const key = `${ermine ? 'e' : 'n'}${a}${b}`;
  let surface = FUR_SURFACES.get(key);
  if (!surface) {
    surface = Object.freeze(ermine ? { cls: TINCTURE_CLASS[a], bases: Object.freeze([a, b]) } : { cls: 'neutral' as const, bases: Object.freeze(TINCTURES.filter((t) => t === a || t === b)) });
    FUR_SURFACES.set(key, surface);
  }
  return surface;
}

/**
 * The surface of a paint that is one thing everywhere (a counterchanged paint has a surface per place it lies). A party of two
 * tinctures takes the class of its parts when they agree and is neutral when a metal meets a colour (A3B1, CC-10), and
 * shares both of its tinctures.
 */
export function surfaceOf(p: Paint): Surface {
  if (p.k === 'tincture') return tinctureSurface(p.t);
  if (p.k === 'fur') return furSurface(p);
  const party = asParty(p);
  if (!party) return notSupported({ category: 'tincture', detail: p.k });
  const [a, b] = [tinctureSurface(party.parts[0].t), tinctureSurface(party.parts[1].t)];
  return { cls: a.cls === b.cls ? a.cls : 'neutral', bases: [...a.bases, ...b.bases] };
}

/** Whether two surfaces have a base tincture in common. */
export const sharesTincture = (a: Surface, b: Surface): boolean => a.bases.some((t) => b.bases.includes(t));

/** Whether two surfaces look the same to the rule of tincture and to conflict. */
export const sameSurface = (a: Surface, b: Surface): boolean =>
  a.cls === b.cls && a.bases.length === b.bases.length && a.bases.every((t, i) => t === b.bases[i]);

/** The surface of each part of the field, in part order (the whole field's when it is not divided). */
export const fieldSurfaces = (d: Design): Surface[] => fieldParts(d).map(surfaceOf);
