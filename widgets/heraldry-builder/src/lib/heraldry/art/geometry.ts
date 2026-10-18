// Geometry of charge drawings as point rings (`pathRings`): their bounding box, whether they draw cleanly under even-odd, how much one is
// scaled to fit its box turned, and the kit the procedural charges are traced with (circles, arcs and stars as polylines, fitted to the box
// and written as a path).

import { boundedMemo } from '../memo';
import { pathRings, pointInPolygon, type Pt } from '../geometry';

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

/** Points on a circle from angle `a0` to `a1` (radians, clockwise on screen from the +x axis), both ends included. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, segments: number): Pt[] {
  return Array.from({ length: segments + 1 }, (_, i): Pt => {
    const a = a0 + ((a1 - a0) * i) / segments;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** A circle as a ring of `segments` points, starting at the top. */
export const circle = (cx: number, cy: number, r: number, segments = 48): Pt[] => arc(cx, cy, r, -Math.PI / 2, (3 * Math.PI) / 2, segments).slice(0, -1);

/** A star of `n` points, the first at the top: its points at `rOuter` (alternate rays may differ: one radius per ray, in turn), its notches at `rInner`. */
export function star(n: number, rOuter: readonly number[], rInner: number): Pt[] {
  return Array.from({ length: 2 * n }, (_, i): Pt => {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const r = i % 2 === 0 ? rOuter[(i / 2) % rOuter.length] : rInner;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });
}

/** The two points where two circles meet: on the left, then on the right, of the line from the first centre to the second. */
export function circlesMeet([x1, y1]: Pt, r1: number, [x2, y2]: Pt, r2: number): [Pt, Pt] {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  const along = (d * d + r1 * r1 - r2 * r2) / (2 * d), h2 = r1 * r1 - along * along;
  if (h2 < 0) throw new RangeError('The circles do not meet.');
  const h = Math.sqrt(h2), mx = x1 + (dx * along) / d, my = y1 + (dy * along) / d;
  return [[mx + (dy * h) / d, my - (dx * h) / d], [mx - (dy * h) / d, my + (dx * h) / d]];
}

/** The angle of a point seen from a centre, as `arc` takes it. */
export const angleAt = ([cx, cy]: Pt, [x, y]: Pt): number => Math.atan2(y - cy, x - cx);

/** Rings scaled about their middle to a long side of `long` and centred in the 100×100 box. */
export function fitRings(rings: readonly (readonly Pt[])[], long = 86): Pt[][] {
  const box = bboxOf(rings.flat());
  const s = long / Math.max(box.x1 - box.x0, box.y1 - box.y0), mx = (box.x0 + box.x1) / 2, my = (box.y0 + box.y1) / 2;
  return rings.map((ring) => ring.map(([x, y]): Pt => [50 + (x - mx) * s, 50 + (y - my) * s]));
}

const decimal = (v: number) => String(Math.round(v * 10) / 10);

/** Rings as a drawing's path: absolute M/L/Z polygons with one decimal, a point that repeats the one before it (once rounded) dropped. */
export function ringsPath(rings: readonly (readonly Pt[])[]): string {
  return rings.map((ring) => {
    const pts = ring.map(([x, y]) => `${decimal(x)} ${decimal(y)}`).filter((p, i, all) => p !== all[(i + all.length - 1) % all.length]);
    return `M${pts[0]}L${pts.slice(1).join(' ')}Z`;
  }).join('');
}

/** The larger side of the bounding box of points turned `turn` degrees (clockwise) about the middle of the box. */
function longSide(points: readonly Pt[], turn: number): number {
  const a = (turn * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const box = bboxOf(points.map(([x, y]): Pt => [(x - 50) * cos - (y - 50) * sin, (x - 50) * sin + (y - 50) * cos]));
  return Math.max(box.x1 - box.x0, box.y1 - box.y0);
}

const fitMemo = boundedMemo<number>(2000);

/**
 * How much a drawing turned `turn` degrees is scaled so that its bounding box is no longer than upright (PLAN-D §0.3.4): it stays
 * within its slot's square whichever way it is turned. Three decimals; 1 for no turn.
 */
export function turnFit(d: string, turn: number): number {
  if (turn % 360 === 0) return 1;
  return fitMemo(`${turn}|${d}`, () => {
    const points = pathRings(d).flat();
    return Math.min(1, Math.round((1000 * longSide(points, 0)) / longSide(points, turn)) / 1000);
  });
}

/** How far a drawing reaches from the middle of its box: the radius of the smallest disc about (50, 50) that holds it. */
export function reachOf(d: string): number {
  return Math.max(...pathRings(d).flat().map(([x, y]) => Math.hypot(x - 50, y - 50)));
}
