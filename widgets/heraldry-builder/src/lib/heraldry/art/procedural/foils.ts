// Generated foils (PLAN-D §2.6): n round petals about the middle, the first at the top. The outline is traced as one ring, petal by
// petal, between the points where each petal meets the next (no polygon union); the quatrefoil and cinquefoil are pierced in the
// middle, and the trefoil has a stalk to the base instead, traced as part of the same outline. The seeblatt (D16b), a water-lily leaf, is
// two such round lobes running down to a point (GoT Table 5: point to base), with its stalk rising from the notch between them.

import type { Pt } from '../../geometry';
import type { ArtPaths } from '../types';
import { angleAt, arc, circle, circlesMeet, fitRings, ringsPath } from '../geometry';

const TAU = 2 * Math.PI;
const SEGMENTS = 24;
/** Each petal's radius against the distance between neighbouring petal centres: over half, so neighbours overlap. */
const OVERLAP = 0.575;
const STALK = { top: 8, bottom: 6 };

/** An angle at or after `from` (clockwise, within one turn). */
const after = (from: number, a: number) => from + (((a - from) % TAU) + TAU) % TAU;

function foil(n: number): Pt[][] {
  // petal radius r and centre distance R: r = 2·OVERLAP·R·sin(π/n), and R + r = 43 (the half long side)
  const k = 2 * OVERLAP * Math.sin(Math.PI / n), R = 43 / (1 + k), r = k * R;
  const centres = Array.from({ length: n }, (_, i): Pt => {
    const a = -Math.PI / 2 + (TAU * i) / n;
    return [50 + R * Math.cos(a), 50 + R * Math.sin(a)];
  });
  // where petal i meets petal i + 1, on the outside (left of the way round, clockwise on screen)
  const meets = centres.map((c, i) => circlesMeet(c, r, centres[(i + 1) % n], r)[0]);
  const petal = (i: number, from: Pt, to: Pt) => {
    const a0 = angleAt(centres[i], from);
    return arc(...centres[i], r, a0, after(a0, angleAt(centres[i], to)), SEGMENTS);
  };
  if (n !== 3) return fitRings([centres.flatMap((_, i) => petal(i, meets[(i + n - 1) % n], meets[i])), circle(50, 50, 6)]);
  // the trefoil: the two lower petals (1 and 2) are cut where they meet the stalk's sides, and the stalk runs down between them
  const sideAt = (i: number, x: number): Pt => [x, centres[i][1] + Math.sqrt(r * r - (x - centres[i][0]) ** 2)];
  const right = sideAt(1, 50 + STALK.top / 2), left = sideAt(2, 50 - STALK.top / 2), base = meets[1][1] + 0.9 * r;
  return fitRings([[
    ...petal(0, meets[2], meets[0]), ...petal(1, meets[0], right),
    [50 + STALK.bottom / 2, base], [50 - STALK.bottom / 2, base],
    ...petal(2, left, meets[2]),
  ]]);
}

/** The seeblatt's lobes (radius, and their centres' distance from the middle and height) and its stalk's width. */
const LOBE = { r: 21, dx: 13, y: 36 }, STEM = 6;

function seeblatt(): Pt[][] {
  const point: Pt = [50, 93], right: Pt = [50 + LOBE.dx, LOBE.y], left: Pt = [50 - LOBE.dx, LOBE.y];
  // where the outline leaves each lobe for the point: the tangent from the point, on the outside
  const toPoint = angleAt(right, point) - Math.acos(LOBE.r / Math.hypot(point[0] - right[0], point[1] - right[1]));
  const stem = LOBE.y - Math.sqrt(LOBE.r ** 2 - (LOBE.dx - STEM / 2) ** 2);
  const fromStem = angleAt(right, [50 + STEM / 2, stem]);
  return fitRings([[
    [50 - STEM / 2, 7], [50 + STEM / 2, 7], ...arc(...right, LOBE.r, fromStem, toPoint, SEGMENTS),
    point, ...arc(...left, LOBE.r, Math.PI - toPoint, after(Math.PI - toPoint, Math.PI - fromStem), SEGMENTS),
  ]]);
}

export const PATHS_FOILS = {
  trefoil: { _: ringsPath(foil(3)) },
  quatrefoil: { _: ringsPath(foil(4)) },
  cinquefoil: { _: ringsPath(foil(5)) },
  seeblatt: { _: ringsPath(seeblatt()) },
} satisfies ArtPaths;
