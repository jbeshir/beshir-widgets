// What a paint is for the rule of tincture and for conflict: its contrast class and the base tinctures it
// shares with other paints (SENA A3B). Contrast, the tincture rule, difference and the render all speak in
// surfaces, so a paint that is not a plain tincture needs a surface here and nowhere else.

import { FUR_SPEC, TINCTURE_CLASS, TINCTURES, type Tincture } from './tinctures';
import { asParty, asSemy, asTreated, asVariation, fieldParts, notSupported, type Design, type Item, type Paint } from './design';
import { CHARGES } from './charges';
import { furColours } from './fur';
import type { Treatment } from './divisions';

/** A neutral surface (a pattern of both classes) contrasts with metals and colours alike and is never "alike" to a top. */
export type ContrastClass = 'metal' | 'colour' | 'neutral';

/** The tinctures a surface is made of, which another surface may not share (A3B4b). Brown is a tincture in its own right, found only in proper (A3B1). */
export type BaseTincture = Tincture | 'brown';

/** `variant` tells apart surfaces that share a class and bases but are not alike: a treatment is a different tincture from the one it lies on (A5F2: "Argent masoned gules" is not "Argent"). */
export interface Surface { cls: ContrastClass; bases: readonly BaseTincture[]; variant: string | null }

const TINCTURE_SURFACES: Record<Tincture, Surface> = Object.fromEntries(
  TINCTURES.map((t) => [t, Object.freeze({ cls: TINCTURE_CLASS[t], bases: Object.freeze([t]), variant: null })]),
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
  // Vair and potent share both tinctures whichever way round, so their key is the tinctures in palette order.
  const key = ermine ? `e${a}${b}` : `n${TINCTURES.filter((t) => t === a || t === b).join('')}`;
  let surface = FUR_SURFACES.get(key);
  if (!surface) {
    surface = Object.freeze(ermine
      ? { cls: TINCTURE_CLASS[a], bases: Object.freeze([a, b]), variant: null }
      : { cls: 'neutral' as const, bases: Object.freeze(TINCTURES.filter((t) => t === a || t === b)), variant: null });
    FUR_SURFACES.set(key, surface);
  }
  return surface;
}

const TREATED_SURFACES = new Map<string, Surface>();

/**
 * The surface of a treated tincture: the class and the tincture it lies on (GoT "Field Treatment": the treatment is part of the
 * tincture), told apart from it by its variant. The ink does not count, nor does the difference between scaly and papellony
 * (A5F2: "Argent masoned gules conflicts with Argent masoned sable", "Argent papellony gules conflicts with Argent scaly sable").
 */
function treatedSurface(treatment: Treatment, ground: Tincture): Surface {
  const variant = treatment === 'papellony' ? 'scaly' : treatment;
  const key = `${variant}/${ground}`;
  let surface = TREATED_SURFACES.get(key);
  if (!surface) {
    surface = Object.freeze({ ...tinctureSurface(ground), variant });
    TREATED_SURFACES.set(key, surface);
  }
  return surface;
}

const PROPER_SURFACES = new Map<string, Surface>();

/** The surface of a charge in its natural colours: the class and conflict tinctures its palette names (A3B1, Table 4); one object per charge. */
function properSurface(item: Item): Surface {
  const palette = item.k === 'charge' ? CHARGES[item.charge].proper : null;
  if (item.k !== 'charge' || !palette) return notSupported({ category: 'proper', detail: item.k === 'charge' ? item.charge : item.type });
  let surface = PROPER_SURFACES.get(item.charge);
  if (!surface) {
    surface = Object.freeze({ cls: palette.cls, bases: Object.freeze([...palette.conflict]), variant: null });
    PROPER_SURFACES.set(item.charge, surface);
  }
  return surface;
}

/**
 * The surface of a paint that is one thing everywhere (a counterchanged paint has a surface per place it lies); `item` is what
 * the paint colours, which a proper paint needs. A party of two tinctures, or a variation of two (judged as a whole, A3B1), takes
 * the class of its parts when they agree and is neutral when a metal meets a colour (CC-10), and shares both of its tinctures.
 */
export function surfaceOf(p: Paint, item: Item | null): Surface {
  if (p.k === 'tincture') return tinctureSurface(p.t);
  if (p.k === 'fur') return furSurface(p);
  if (p.k === 'proper') return item ? properSurface(item) : notSupported({ category: 'proper', detail: 'field' });
  const treated = asTreated(p);
  if (treated) return treatedSurface(treated.treatment, treated.ground.t);
  // The strewn charges are a group of their own (strewn.ts): what lies on a semy lies on its ground.
  const semy = asSemy(p);
  if (semy) return tinctureSurface(semy.ground.t);
  const two = asParty(p) ?? asVariation(p);
  if (!two) return notSupported({ category: 'tincture', detail: p.k });
  return twoTinctures(two.parts[0].t, two.parts[1].t);
}

const PAIR_SURFACES = new Map<string, Surface>();

/** The surface of a paint of two tinctures (a party, a variation): their class when they agree, neutral when a metal meets a colour, sharing both. One object per pair, so surfaces can be counted by identity. */
function twoTinctures(a: Tincture, b: Tincture): Surface {
  const key = `${a}${b}`;
  let surface = PAIR_SURFACES.get(key);
  if (!surface) {
    const [sa, sb] = [tinctureSurface(a), tinctureSurface(b)];
    surface = Object.freeze({ cls: sa.cls === sb.cls ? sa.cls : 'neutral' as const, bases: Object.freeze([...sa.bases, ...sb.bases]), variant: null });
    PAIR_SURFACES.set(key, surface);
  }
  return surface;
}

/** Whether two surfaces have a base tincture in common. */
export const sharesTincture = (a: Surface, b: Surface): boolean => a.bases.some((t) => b.bases.includes(t));

/** Whether two surfaces look the same to the rule of tincture and to conflict. */
export const sameSurface = (a: Surface, b: Surface): boolean =>
  a.cls === b.cls && a.variant === b.variant && a.bases.length === b.bases.length && a.bases.every((t, i) => t === b.bases[i]);

/** The surface of each part of the field, in part order (the whole field's when it is not divided). */
export const fieldSurfaces = (d: Design): Surface[] => fieldParts(d).map((p) => surfaceOf(p, null));
