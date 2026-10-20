// The generated triquetra (PLAN-D §2.6): three pointed loops, each traced along two of three circles that pass through each other's
// centres, drawn as a band that runs over and under itself in turn. A strand is broken where it passes under another, so the band is
// three separate pieces, and each piece is traced as its own simple ring: no ring overlaps another.

import type { Pt } from '../../geometry';
import type { ArtPaths } from '../types';
import { angleAt, arc, circlesMeet, fitRings, ringsPath } from '../geometry';

const TAU = 2 * Math.PI;
/** Centres' distance from the middle; the circles' radius makes each pass through the other two centres. */
const D = 23, RADIUS = D * Math.sqrt(3);
/** The band's width, and the gap either side of a strand passing over. */
const BAND = 8, GAP = 2.5;
const STEP = Math.PI / 24;

const mod = (a: number) => ((a % TAU) + TAU) % TAU;
const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** The two points where circles i and j (radius r) meet: the far one (a loop's point) and the near one. */
function meet(c: readonly Pt[], i: number, j: number, r: number): { far: Pt; near: Pt } {
  const [p, q] = circlesMeet(c[i], r, c[j], r);
  return dist(p, [0, 0]) > dist(q, [0, 0]) ? { far: p, near: q } : { far: q, near: p };
}

function triquetra(): Pt[][] {
  // centres to the upper right, below and to the upper left, so the loops point up, to the lower right and to the lower left
  const centres = [60, 180, 300].map((deg): Pt => [D * Math.sin((deg * Math.PI) / 180), -D * Math.cos((deg * Math.PI) / 180)]);
  // strand i runs along circle i from its meeting with circle i - 1 to its meeting with circle i + 1, on the side facing the middle
  const strands = centres.map((c, i) => {
    const from = angleAt(c, meet(centres, i, (i + 2) % 3, RADIUS).far), to = angleAt(c, meet(centres, i, (i + 1) % 3, RADIUS).far);
    const sense = mod(angleAt(c, [0, 0]) - from) < mod(to - from) ? 1 : -1;
    /** How far along the strand an angle on its circle is. */
    const along = (a: number) => mod(sense * (a - from));
    return { c, from, to, sense, along };
  });
  // the crossings in the order the band meets them: strand i crosses strand j at the near meeting of their circles
  const crossings = strands.flatMap((s, i) => [(i + 1) % 3, (i + 2) % 3]
    .map((j) => ({ i, j, at: angleAt(s.c, meet(centres, i, j, RADIUS).near) }))
    .sort((a, b) => s.along(a.at) - s.along(b.at)));
  // over, under, over… : each strand passes over at its first crossing and under at its second
  crossings.forEach((x, n) => {
    const twin = crossings.find((y) => y.i === x.j && y.j === x.i)!;
    if ((crossings.indexOf(twin) % 2 === 0) === (n % 2 === 0)) throw new Error('The triquetra does not run over and under in turn.');
  });
  /** The angle on strand i, moving `sense` (away from the crossing, toward the piece's middle), where the band clears circle j. */
  const cut = (i: number, j: number, at: number, sense: number) => {
    const s = strands[i], clear = BAND / 2 + GAP;
    const clears = (a: number) => [RADIUS - BAND / 2, RADIUS + BAND / 2]
      .every((r) => Math.abs(dist([s.c[0] + r * Math.cos(a), s.c[1] + r * Math.sin(a)], centres[j]) - RADIUS) >= clear);
    let a = at;
    while (!clears(a)) a += sense * 0.002;
    return a;
  };
  const sweep = (c: Pt, r: number, a0: number, a1: number, sense: number) => {
    const span = mod(sense * (a1 - a0));
    return arc(c[0], c[1], r, a0, a0 + sense * span, Math.max(2, Math.ceil(span / STEP)));
  };
  // piece i: strand i from where it comes out from under, round the loop's point, along strand i + 1 to where it goes under
  return strands.map((a, i) => {
    const b = strands[(i + 1) % 3];
    const under = (k: number) => crossings.filter((x) => x.i === k)[1];
    const ua = under(i), ub = under((i + 1) % 3);
    const startA = cut(i, ua.j, ua.at, a.sense), endB = cut((i + 1) % 3, ub.j, ub.at, -b.sense);
    const outer = meet(centres, i, (i + 1) % 3, RADIUS + BAND / 2).far, inner = meet(centres, i, (i + 1) % 3, RADIUS - BAND / 2).far;
    return [
      ...sweep(a.c, RADIUS + BAND / 2, startA, angleAt(a.c, outer), a.sense),
      ...sweep(b.c, RADIUS + BAND / 2, angleAt(b.c, outer), endB, b.sense),
      ...sweep(b.c, RADIUS - BAND / 2, endB, angleAt(b.c, inner), -b.sense),
      ...sweep(a.c, RADIUS - BAND / 2, angleAt(a.c, inner), startA, -a.sense),
    ];
  });
}

export const PATHS_KNOTS = {
  triquetra: { _: ringsPath(fitRings(triquetra())) },
} satisfies ArtPaths;
