// The overlay pieces drawn with a charge's parts and details (art batch A3; PLAN-D §0.3.5): each one even-odd path of absolute M/L/Z
// polygons in its own 100×100 box, placed at an anchor of the charge's drawing. They are not charges: nothing offers one on its own.

import type { Provenance } from '../types';

export const OVERLAY_PIECES = {
  crown: 'M7 85L7 64 6.8 25.7 6.5 23.6 7.1 21.6 8.5 20 10.4 19.1 12.6 19.1 14.5 20 15.9 21.6 16.5 23.6 16.2 25.7 31 54 45.2 18.3 44.5 15.8 44.9 13.3 46.5 11.3 48.7 10.1 51.3 10.1 53.5 11.3 55.1 13.3 55.5 15.8 54.8 18.2 69 54 83.8 25.7 83.5 23.6 84.1 21.6 85.5 20 87.4 19.1 89.6 19.1 91.5 20 92.9 21.6 93.5 23.6 93.2 25.7 93 64 93 85 80 83.6 65 82.8 50 82.5 35 82.8 20 83.6Z',
  leaf: 'M50 7L50.9 8 52.2 9.4 53.8 11.1 58.6 11.5 57 15 58.6 17.2 63.4 18.2 61.9 22.3 63.5 25.1 68.2 26.5 66.5 31 67.9 34.2 72.5 36 70.3 40.8 71 44 74.4 45.8 71.1 50.6 70.6 53.9 73.1 55.6 69 60 67.8 62.7 69.4 63.8 64.4 67.8 62.6 70 64.2 70.5 59.4 73.8 57.8 75.5 56.2 76.9 54.9 78.1 54 79 54 93 46 93 46 79 45.1 78.1 43.8 76.9 42.2 75.5 40.6 73.8 35.8 70.5 37.4 70 35.6 67.8 30.6 63.8 32.2 62.7 31 60 26.9 55.6 29.4 53.9 28.9 50.6 25.6 45.8 29 44 29.7 40.8 27.5 36 32.1 34.2 33.5 31 31.8 26.5 36.5 25.1 38.1 22.3 36.6 18.2 41.4 17.2 43 15 41.4 11.5 46.2 11.1 47.8 9.4 49.1 8Z',
  slip: 'M59.4 5.9L59.8 9 60.4 13.4 61 18.9 61.4 24.7 61.5 30.5 60.8 36.1 59.7 41.2 58.6 45.6 57.8 49.3 57.5 52.2 57.7 55 58.2 58.1 59 61.3 60 64.7 61 68 62.2 71.2 63.6 74.5 65.1 77.8 67.6 79 50.4 94 49.4 89 48 86 46.2 82.3 44.5 78.1 43 74 41.8 70.2 40.6 66.2 39.6 61.8 38.8 57.1 37.8 57.6 31.1 53.3 24.6 49.3 21.6 43.8 26.1 45.3 33.1 44.3 40.1 41.3 41.2 36.8 42.1 32.9 42.5 29.5 42.5 25.5 42.1 20.7 41.5 15.7 40.9 11.3 40.6 8.1Z',
} as const;

/** Where each piece came from: art batch A3's record of it (as a charge's sidecar row records its `provenance`). */
const A3_PIECE: Provenance = {
  origin: 'original',
  author: 'phase-D art pipeline, A3, claude-opus-5-5 drawer',
  date: '2026-10-18',
  method: 'polygon coordinates placed by hand on a 100×100 grid from a written description; no image traced or copied',
};
export const OVERLAY_PIECE_PROVENANCE: Record<keyof typeof OVERLAY_PIECES, Provenance> = { crown: A3_PIECE, leaf: A3_PIECE, slip: A3_PIECE };
