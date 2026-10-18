// Generated shapes (PLAN-D §2.6): the lozenge's kin (mascle, rustre, fusil), the delf and the triangle, and the ermine spot drawn
// afresh as polygons (the fur's ERMINE_SPOT is a relative path with curves, so it is not reused).

import type { Pt } from '../../geometry';
import type { ArtPaths } from '../types';
import { circle, fitRings, ringsPath } from '../geometry';

/** A lozenge `w` wide and `h` tall about the middle of the box, from its top point clockwise. */
const lozenge = (w: number, h: number): Pt[] => [[50, 50 - h / 2], [50 + w / 2, 50], [50, 50 + h / 2], [50 - w / 2, 50]];

/** Equilateral, point up, side 86, centred. */
const triangle = (): Pt[] => {
  const h = (86 * Math.sqrt(3)) / 2;
  return [[50, 50 - h / 2], [93, 50 + h / 2], [7, 50 + h / 2]];
};

/** In the units of the fur's spot (6.4 wide, the tail's root at 0,0): the tail, root to point, down its right side then up its left. */
const TAIL_SIDE: readonly Pt[] = [[1.1, 0.7], [1.9, 1.7], [2.3, 3], [2.2, 4.6], [1.7, 6.4], [1.1, 8.2]];
const ermineSpot = (): Pt[][] => fitRings([
  [[0, 0], ...TAIL_SIDE, [0, 10], ...TAIL_SIDE.map(([x, y]): Pt => [-x, y]).reverse()],
  ...([[-2.4, -1.8], [0, -2.8], [2.4, -1.8]] as const).map(([x, y]) => circle(x, y, 0.8, 12)),
]);

export const PATHS_SHAPES = {
  mascle: { _: ringsPath([lozenge(56, 86), lozenge(56 * 0.55, 86 * 0.55)]) },
  rustre: { _: ringsPath([lozenge(56, 86), circle(50, 50, 0.22 * 56, 32)]) },
  fusil: { _: ringsPath([lozenge(40, 86)]) },
  // 82 square, the least long side the house style allows: a square of 86 outweighs every other shape
  delf: { _: ringsPath([[[9, 9], [91, 9], [91, 91], [9, 91]]]) },
  triangle: { _: ringsPath([triangle()]) },
  'ermine-spot': { _: ringsPath(ermineSpot()) },
} satisfies ArtPaths;
