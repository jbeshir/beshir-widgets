// Generated stars (PLAN-D §2.6): the compass star, a mullet of eight points whose four cardinal points are longer; mullets of 4 to 12
// points, plain or pierced with a round hole; estoiles of 4 to 12 wavy rays.

import { STAR_POINTS } from '../../charges';
import type { ArtPaths } from '../types';
import type { Pt } from '../../geometry';
import { circle, fitRings, ringsPath, star } from '../geometry';

export const PATHS_STARS = {
  'compass-star': { _: ringsPath([star(8, [43, 26], 9)]) },
} satisfies ArtPaths;

const byPoints = (draw: (n: number) => Pt[][]): Readonly<Record<number, string>> =>
  Object.fromEntries(STAR_POINTS.map((n) => [n, ringsPath(fitRings(draw(n)))]));

/** A mullet of `n` points: its notches nearer the middle the fewer points it has; pierced, a round hole of radius 7 in its middle. */
function mullet(n: number, pierced: boolean): Pt[][] {
  const inner = 43 * (n <= 6 ? 0.38 : n <= 8 ? 0.42 : 0.5);
  return [star(n, [43], inner), ...(pierced ? [circle(50, 50, 7, 32)] : [])];
}

/**
 * An estoile of `n` rays, traced as one ring after the drawn estoile of six: each ray runs out from the corners of a hub it shares with its
 * neighbours, 13 wide at its foot (so the hub grows with the rays), its middle a zig-zag of 5 points 2.6 either side of its axis, narrowing
 * to a point at 43.
 */
function estoile(n: number): Pt[][] {
  const half = Math.PI / n, base = 6.5, hub = base / Math.sin(half), foot = hub * Math.cos(half), steps = 4;
  const u = (i: number) => foot + ((43 - foot) * i) / steps;
  const wave = (i: number) => (i === 0 ? 0 : i % 2 === 1 ? 2.6 : -2.6);
  const width = (i: number) => base * (1 - i / steps);
  const ring = Array.from({ length: n }, (_, k): Pt[] => {
    const a = -Math.PI / 2 + 2 * half * k, cos = Math.cos(a), sin = Math.sin(a);
    const at = (along: number, across: number): Pt => [50 + along * cos - across * sin, 50 + along * sin + across * cos];
    const inner = Array.from({ length: steps }, (_, i) => i);
    return [...inner.map((i) => at(u(i), wave(i) - width(i))), at(43, 0), ...inner.slice(1).reverse().map((i) => at(u(i), wave(i) + width(i)))];
  });
  return [ring.flat()];
}

/** Mullets and estoiles by their number of points; the drawn mullet of five and estoile of six are hand art (art/paths/core.ts). */
export const POINTED_STARS = { mullet: byPoints((n) => mullet(n, false)), estoile: byPoints(estoile) } as const;

/** Pierced mullets by their number of points. */
export const PIERCED_MULLETS = byPoints((n) => mullet(n, true));
