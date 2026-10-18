// Values the sidecar rows share: the natural colourings and the provenance of the hand-drawn art.

import type { ProperPalette, Provenance } from '../types';

/** The natural colourings (GoT Table 4, RULES-B §6.2): the class and the conflict tinctures are the row's "taken from" part. */
export const PROPER = {
  tan: { cls: 'metal', conflict: ['or'], fills: ['#d9a84a'] },
  brown: { cls: 'colour', conflict: ['brown'], fills: ['#7a4a24'] },
  gold: { cls: 'metal', conflict: ['or'], fills: ['#e3b52a'] },
  rose: { cls: 'colour', conflict: ['gules'], fills: ['#c62d35'] },
  foliage: { cls: 'colour', conflict: ['vert'], fills: ['#3f8a44'] },
  pages: { cls: 'metal', conflict: ['argent'], fills: ['#efe6cf'] },
  steel: { cls: 'metal', conflict: ['argent'], fills: ['#cdd3d8'] },
  fire: { cls: 'neutral', conflict: ['gules', 'or'], fills: ['#f2a21b', '#d3302b'] },
} as const satisfies Record<string, ProperPalette>;

/** The 36 charges of phases B and C. */
export const HAND_DRAWN: Provenance = {
  origin: 'original',
  author: 'heraldry-builder phase B/C (hand-drawn)',
  date: '2026-10',
  method: 'polygon coordinates drawn by hand on a 100×100 grid; no image traced',
};

/** The charges of phase D traced by the generators in art/procedural. */
export const GENERATED: Provenance = {
  origin: 'original',
  author: 'heraldry-builder phase D (generated)',
  date: '2026-10',
  method: 'traced by a generator from geometric parameters (art/procedural); no image traced or copied',
};
