// Charge artwork: which drawing a charge is drawn with, and where it carries charges on it. The art itself is in the
// sidecar: path strings in art/paths, one per (charge, drawing) in viewBox 0 0 100 100, keyed by posture id or '_' for
// posture-less charges, and the per-drawing metadata in art/meta. Rendered with fill = tincture, fill-rule evenodd (holes
// for the gear hub, rose centre, key bow, book gutter…) plus an outline sized by Shield.tsx.
//
// The artwork is original work drawn for this widget and is licensed with the repository. No
// third-party heraldic art was traced or copied. Each silhouette is centred with its long axis
// ~86 units; animals face dexter (the viewer's left); objects point up.

import { CHARGES, type ChargeId, type ModifierId, type Posture } from './charges';
import type { Modifier } from './design';
import { pathFor } from './art/paths/index';
import { FITCHY_CROSSES } from './art/procedural/crosses';
import type { ArtBox, ArtKey } from './art/types';

/**
 * Art for a charge with a modifier drawn: the sun in splendour is the sun with a face (two eyes and a
 * mouth) cut out of its disc. The face is original work, like the rest. A cross fitchy is generated with its foot sharpened.
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

/** The key of the drawing a charge has in a posture: the posture's own, else its default posture's, else the posture-less one. */
export function artKeyOf(id: ChargeId, posture: Posture | null): ArtKey {
  const { drawings, defaultPosture } = CHARGES[id];
  return (posture && drawings[posture] ? posture : null) ?? (defaultPosture && drawings[defaultPosture] ? defaultPosture : null) ?? '_';
}

/** Path for a charge in a posture with its modifiers; falls back to the default posture, then '_'. */
export function chargePath(id: ChargeId, posture: Posture | null, mods: readonly Modifier[]): string {
  const variant = mods.map((m) => MODIFIER_ART[id]?.[m.id]).find((d) => d !== undefined);
  return variant ?? pathFor(id, artKeyOf(id, posture)) ?? FALLBACK;
}

/** The rectangle of a charge's drawing that carries the charges on it, or null for a charge that carries none. */
export function chargeOnBox(id: ChargeId, posture: Posture | null): ArtBox | null {
  return CHARGES[id].drawings[artKeyOf(id, posture)]?.onBox ?? null;
}
