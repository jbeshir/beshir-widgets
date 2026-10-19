// Charge artwork: which drawing a charge is drawn with, and where it carries charges on it. The art itself is in the
// sidecar: path strings in art/paths, one per (charge, drawing) in viewBox 0 0 100 100, keyed by posture id or '_' for
// posture-less charges, and the per-drawing metadata in art/meta. Rendered with fill = tincture, fill-rule evenodd (holes
// for the gear hub, rose centre, key bow, book gutter…) plus an outline sized by Shield.tsx.
//
// The artwork is original work drawn for this widget and is licensed with the repository. No
// third-party heraldic art was traced or copied. Each silhouette is centred with its long axis
// ~86 units; animals face dexter (the viewer's left); objects point up.

import { CHARGES, DRAWN_POINTS, type ChargeId, type ModifierId } from './charges';
import type { Charge, Modifier } from './design';
import { pathFor } from './art/paths/index';
import { FITCHY_CROSSES } from './art/procedural/crosses';
import { derivedPath } from './art/procedural/derived';
import { PIERCED_MULLETS, POINTED_STARS } from './art/procedural/stars';
import type { ArtBox, ArtKey } from './art/types';

/**
 * Art for a charge with a modifier drawn: the sun in splendour is the sun with a face (two eyes and a
 * mouth) cut out of its disc. The face is original work, like the rest. A cross fitchy is generated with its foot sharpened; the
 * mullets and estoiles of other numbers of points and the pierced mullets are generated too (`reshapedStar`).
 */
export const MODIFIER_ART: Partial<Record<ChargeId, Partial<Record<ModifierId, string>>>> = {
  sun: {
    'in-splendour': pathFor('sun', '_')!
      + 'M38.3 44L39.4 41.9 41.5 40.8 43.6 41.9 44.7 44 43.6 46.1 41.5 47.2 39.4 46.1Z'
      + 'M55.3 44L56.4 41.9 58.5 40.8 60.6 41.9 61.7 44 60.6 46.1 58.5 47.2 56.4 46.1Z'
      + 'M38 54L41 58.5 45 61.5 50 63 55 61.5 59 58.5 62 54 58 56 54.5 58.2 50 59.2 45.5 58.2 42 56Z',
  },
  ...Object.fromEntries(Object.entries(FITCHY_CROSSES).map(([id, d]) => [id, { fitchy: d }])),
};

/** Shown only if a charge somehow has no art (never for the shipped table): a plain roundel. */
const FALLBACK = pathFor('roundel', '_')!;

/** What picks a charge's drawing: the charge, its form and its posture (a head or a demi charge has none of its own), and its modifiers. */
type DrawnCharge = Pick<Charge, 'charge' | 'form' | 'posture' | 'mods'>;

/**
 * The key of a charge's drawing: a head's or a demi charge's (whatever the posture), else the posture's own, else its default posture's,
 * else the posture-less one.
 */
export function artKeyOf({ charge, form, posture }: Pick<Charge, 'charge' | 'form' | 'posture'>): ArtKey {
  if (form === 'head' || form === 'demi') return form;
  const { drawings, defaultPosture } = CHARGES[charge];
  return (posture && drawings[posture] ? posture : null) ?? (defaultPosture && drawings[defaultPosture] ? defaultPosture : null) ?? '_';
}

/** The generated art of a star its modifiers reshape: a mullet of other than five points or pierced, an estoile of other than six rays. */
function reshapedStar(id: ChargeId, mods: readonly Modifier[]): string | undefined {
  const points = mods.find((m) => m.id === 'of-points')?.count ?? null;
  const pierced = mods.some((m) => m.id === 'pierced');
  if (id === 'mullet' && (points !== null || pierced)) return (pierced ? PIERCED_MULLETS : POINTED_STARS.mullet)[points ?? DRAWN_POINTS.mullet];
  if (id === 'estoile' && points !== null) return POINTED_STARS.estoile[points];
  return undefined;
}

/** The drawing of a head (erased, its neck torn: derived) or a demi charge (cut from its rampant drawing unless it has one of its own). */
function formPath(c: DrawnCharge): string | undefined {
  if (c.form === 'head' && c.mods.some((m) => m.id === 'erased')) return derivedPath(c.charge, 'erased-head');
  return c.form === 'demi' ? pathFor(c.charge, 'demi') ?? derivedPath(c.charge, 'demi') : undefined;
}

/** Path for a charge in its form and posture with its modifiers; falls back to the default posture, then '_'. */
export function chargePath(c: DrawnCharge): string {
  const variant = formPath(c) ?? reshapedStar(c.charge, c.mods) ?? c.mods.map((m) => MODIFIER_ART[c.charge]?.[m.id]).find((d) => d !== undefined);
  return variant ?? pathFor(c.charge, artKeyOf(c)) ?? FALLBACK;
}

/** The rectangle of a charge's drawing that carries the charges on it, or null for a charge that carries none (a derived drawing has none). */
export function chargeOnBox(c: Pick<Charge, 'charge' | 'form' | 'posture'>): ArtBox | null {
  return CHARGES[c.charge].drawings[artKeyOf(c)]?.onBox ?? null;
}
