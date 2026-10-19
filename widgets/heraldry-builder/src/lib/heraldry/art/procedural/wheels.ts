// Generated spoked charges (PLAN-D §2.6, D16b): the wheel, a rim on eight spokes about a hub; the Catherine wheel, a smaller wheel with a
// curved hook on the rim between each pair of spokes; the escarbuncle, eight staves from a pierced boss, each ending in a knob. Each outline
// is traced as one ring (rim, hooks, staves and knobs as parts of it), and the spaces between the spokes are its only holes.

import type { Pt } from '../../geometry';
import type { ArtPaths } from '../types';
import { arc, circle, fitRings, ringsPath } from '../geometry';

const TAU = 2 * Math.PI;
const SPOKES = 8;

/** The angle of the `k`th spoke, the first straight up, clockwise on screen. */
const spokeAt = (k: number) => -Math.PI / 2 + (TAU * k) / SPOKES;

/** How far round a circle of radius `r` a spoke's side `half` from its axis meets it, from the axis. */
const side = (half: number, r: number) => Math.asin(half / r);

/** The holes between the spokes: each from the hub along one spoke's side to the rim, back along the rim, and down the next spoke's side. */
function spokeHoles(hub: number, rim: number, half: number): Pt[][] {
  return Array.from({ length: SPOKES }, (_, k) => {
    const a = spokeAt(k), b = spokeAt(k + 1);
    return [...arc(50, 50, hub, a + side(half, hub), b - side(half, hub), 3), ...arc(50, 50, rim, b - side(half, rim), a + side(half, rim), 10)];
  });
}

/** A hook on the rim from angle `a`: out to its point along a convex edge, swept clockwise, and back along a concave one (radius, angle after `a`). */
const HOOK: ReadonlyArray<readonly [number, number]> = [[34, 0], [38, 0.07], [41.5, 0.16], [43, 0.3], [40.5, 0.24], [37, 0.22], [34, 0.23]];

function catherineWheel(): Pt[][] {
  const outline = Array.from({ length: SPOKES }, (_, k): Pt[] => {
    const a = spokeAt(k) + Math.PI / SPOKES - 0.15;
    const hook = HOOK.map(([r, da]): Pt => [50 + r * Math.cos(a + da), 50 + r * Math.sin(a + da)]);
    return [...hook, ...arc(50, 50, 34, a + 0.23, a + TAU / SPOKES, 6).slice(1, -1)];
  }).flat();
  return fitRings([outline, ...spokeHoles(9, 27, 2.3)]);
}

/** Each staff of the escarbuncle `half` wide either side of its axis, its knob `knob` across at `reach` out, from a boss `boss` across. */
function escarbuncle(): Pt[][] {
  const half = 2.8, boss = 12, knob = 6.5, reach = 36.5;
  const outline = Array.from({ length: SPOKES }, (_, k): Pt[] => {
    const a = spokeAt(k), turn = Math.PI - side(half, knob);
    const [kx, ky] = [50 + reach * Math.cos(a), 50 + reach * Math.sin(a)];
    return [...arc(kx, ky, knob, a - turn, a + turn, 12), ...arc(50, 50, boss, a + side(half, boss), spokeAt(k + 1) - side(half, boss), 3)];
  }).flat();
  return fitRings([outline, circle(50, 50, 5, 24)]);
}

export const PATHS_WHEELS = {
  wheel: { _: ringsPath(fitRings([circle(50, 50, 43), ...spokeHoles(10, 35, 2.5)])) },
  'catherine-wheel': { _: ringsPath(catherineWheel()) },
  escarbuncle: { _: ringsPath(escarbuncle()) },
} satisfies ArtPaths;
