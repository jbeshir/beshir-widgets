// Generated foils (PLAN-D §2.6): n round petals about the middle, the first at the top. The outline is traced as one ring, petal by
// petal, between the points where each petal meets the next (no polygon union); the quatrefoil and cinquefoil are pierced in the
// middle, and the trefoil has a stalk to the base instead, traced as part of the same outline. The seeblatt (D16b), a water-lily leaf, is
// two such round lobes whose flanks bow in to a long point (GoT Table 5: point to base), a V-notch cut into each flank and its stalk
// rising from the notch between the lobes: drawn so it is not read as a heart.

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

/** The seeblatt's two lobes (radius, their centres' distance from the middle, height), its stalk (width, top), its point, and the V-notch cut into each flank. */
const LOBE = { r: 20, dx: 14, y: 38 }, STEM = { w: 8, top: 3 }, POINT: Pt = [50, 97], NOTCH = { at: 0.4, half: 0.08, depth: 7 };

/** The flank from where it leaves the right lobe to the point: a curve bowed in, so the leaf narrows to a long point, as a heart does not. */
function flank(from: Pt): Pt[] {
  const bow: Pt = [68, 74];
  const at = (t: number): Pt => [(1 - t) ** 2 * from[0] + 2 * t * (1 - t) * bow[0] + t * t * POINT[0], (1 - t) ** 2 * from[1] + 2 * t * (1 - t) * bow[1] + t * t * POINT[1]];
  const notch = (): Pt => {
    // the notch's deepest point, `depth` in from the curve, square to the line across its mouth
    const [a, b] = [at(NOTCH.at - NOTCH.half), at(NOTCH.at + NOTCH.half)], [dx, dy] = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(dx, dy);
    const m = at(NOTCH.at);
    return [m[0] - (dy / n) * NOTCH.depth, m[1] + (dx / n) * NOTCH.depth];
  };
  const ts = [0.1, 0.2, 0.3, NOTCH.at - NOTCH.half, -1, NOTCH.at + NOTCH.half, 0.65, 0.8, 0.9];
  return ts.map((t) => (t < 0 ? notch() : at(t)));
}

function seeblatt(): Pt[][] {
  const right: Pt = [50 + LOBE.dx, LOBE.y];
  // the stalk meets the lobe where the lobe crosses the stalk's side; the lobe runs clockwise round its top and out to its widest point
  const stemFoot = LOBE.y - Math.sqrt(LOBE.r ** 2 - (LOBE.dx - STEM.w / 2) ** 2);
  const a0 = angleAt(right, [50 + STEM.w / 2, stemFoot]), a1 = Math.PI / 5;
  const lobe = arc(...right, LOBE.r, a0, after(a0, a1), SEGMENTS);
  const half = [[50 + STEM.w / 2, STEM.top] as Pt, ...lobe, ...flank(lobe[lobe.length - 1])];
  return fitRings([[...half, POINT, ...half.map(([x, y]): Pt => [100 - x, y]).reverse()]]);
}

export const PATHS_FOILS = {
  trefoil: { _: ringsPath(foil(3)) },
  quatrefoil: { _: ringsPath(foil(4)) },
  cinquefoil: { _: ringsPath(foil(5)) },
  seeblatt: { _: ringsPath(seeblatt()) },
} satisfies ArtPaths;
