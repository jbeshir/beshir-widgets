// Geometry of charge drawings as point rings (`pathRings`): their bounding box and whether they draw cleanly under even-odd.

import { pointInPolygon, type Pt } from '../geometry';

export interface Bbox { x0: number; y0: number; x1: number; y1: number }

export function bboxOf(points: readonly Pt[]): Bbox {
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** How many other rings hold each ring: 0 for an outline, 1 for a hole in it, 2 for an island in the hole. */
export function ringDepths(rings: readonly (readonly Pt[])[]): number[] {
  return rings.map(([[x, y]], i) => rings.filter((other, j) => j !== i && pointInPolygon(x, y, other)).length);
}

/** Why a drawing does not draw as its rings say under even-odd: a ring crossing itself or another, or an island in a hole. */
export type RingProblem =
  | { k: 'self-intersection'; ring: number }
  | { k: 'crossing'; rings: readonly [number, number] }
  | { k: 'island'; ring: number };

const turn = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

/** Whether two edges cross, or lie along one another for some length; meeting at a point is allowed. */
function edgesMeet([p, q]: readonly [Pt, Pt], [r, s]: readonly [Pt, Pt]): boolean {
  const a = turn(p, q, r), b = turn(p, q, s), c = turn(r, s, p), d = turn(r, s, q);
  if (a * b < 0 && c * d < 0) return true;
  if (a !== 0 || b !== 0) return false;
  // collinear: overlapping projections on the longer axis of p→q
  const axis = Math.abs(q[0] - p[0]) >= Math.abs(q[1] - p[1]) ? 0 : 1;
  const lo = Math.max(Math.min(p[axis], q[axis]), Math.min(r[axis], s[axis]));
  const hi = Math.min(Math.max(p[axis], q[axis]), Math.max(r[axis], s[axis]));
  return hi - lo > 1e-9;
}

const edgesOf = (ring: readonly Pt[]) => ring.map((p, i): readonly [Pt, Pt] => [p, ring[(i + 1) % ring.length]]);

export function ringProblems(rings: readonly (readonly Pt[])[]): RingProblem[] {
  const edges = rings.map(edgesOf);
  const problems: RingProblem[] = [];
  edges.forEach((e, ring) => {
    const crosses = e.some((a, i) => e.some((b, j) => j > i + 1 && !(i === 0 && j === e.length - 1) && edgesMeet(a, b)));
    if (crosses) problems.push({ k: 'self-intersection', ring });
  });
  for (let a = 0; a < rings.length; a++) {
    for (let b = a + 1; b < rings.length; b++) {
      if (edges[a].some((e) => edges[b].some((f) => edgesMeet(e, f)))) problems.push({ k: 'crossing', rings: [a, b] });
    }
  }
  ringDepths(rings).forEach((depth, ring) => depth > 1 && problems.push({ k: 'island', ring }));
  return problems;
}
