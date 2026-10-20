// The generated crosses (PLAN-D §2.6): one generator for the cross family. Every cross is ONE outline traced arm by arm round the
// whole cross — the decorated ends (bars, lobes, petals, horns) are part of each arm's outline, never shapes laid over it — and the
// Celtic cross's ring is traced as arcs between the arms, the four spaces inside it its only holes. Arms are 18 wide; the long side 86.

import type { Pt } from '../../geometry';
import type { ChargeId } from '../../charges';
import type { ArtPaths } from '../types';
import { angleAt, arc, circlesMeet, fitRings, ringsPath } from '../geometry';

/** How each arm ends: `tau` has no top arm, `crosslet` a bar across each arm short of its end (as the hand-drawn cross crosslet). */
export type CrossArm = 'plain' | 'formy' | 'flory' | 'patonce' | 'moline' | 'bottony' | 'potent' | 'maltese' | 'tau' | 'crosslet';

/** A cross: its arms' ends, a long foot (Latin), a ring about the crossing (Celtic), the foot sharpened to a point (fitchy). */
export interface CrossSpec { arm: CrossArm; latin: boolean; ring: boolean; fitchy: boolean }

/** Half the arm's width. */
const HALF = 9;
/** Where the narrow middle of the splayed arms (formy, Maltese, patonce) meets the next arm. */
const PINCH = 6;
const TAU = 2 * Math.PI;
const mod = (a: number) => ((a % TAU) + TAU) % TAU;

/** An arc of a lobe from one point on it to another, the way round that passes furthest from the crossing. */
function lobe(c: Pt, r: number, from: Pt, to: Pt): Pt[] {
  const a0 = angleAt(c, from), span = mod(angleAt(c, to) - a0);
  const mid = (sense: number, s: number) => Math.hypot(c[0] + r * Math.cos(a0 + sense * s / 2), c[1] + r * Math.sin(a0 + sense * s / 2));
  const [sense, s] = mid(1, span) >= mid(-1, TAU - span) ? [1, span] : [-1, TAU - span];
  return arc(c[0], c[1], r, a0, a0 + sense * s, Math.max(4, Math.ceil(s / (Math.PI / 12))));
}

/** A bottony end: three round lobes, the arm's side running into the side lobes. */
function bottony(L: number): Pt[] {
  const r = 7.5, centre: Pt = [L - r, 0], side: Pt = [L - 16.5, -9.5];
  const join: Pt = [side[0] - Math.sqrt(r * r - (HALF - 9.5) ** 2), -HALF];
  const [p, q] = circlesMeet(side, r, centre, r);
  const meet = Math.hypot(...p) > Math.hypot(...q) ? p : q;
  return [[HALF, -HALF], ...lobe(side, r, join, meet), ...lobe(centre, r, meet, [L, 0])];
}

/**
 * One side of an arm of length L, as [along the arm, across it], from where it leaves the next arm out to the end on its axis (or to
 * its last corner); the other side is its mirror image.
 */
function armSide(arm: CrossArm, L: number): Pt[] {
  switch (arm) {
    case 'plain': case 'tau': return [[HALF, -HALF], [L, -HALF]];
    case 'crosslet': return [[HALF, -HALF], [L - 19, -HALF], [L - 19, -17], [L - 9, -17], [L - 9, -HALF], [L, -HALF]];
    case 'potent': return [[HALF, -HALF], [L - 10, -HALF], [L - 10, -19], [L, -19]];
    case 'formy': return [[PINCH, -PINCH], [0.45 * L, -8.5], [0.7 * L, -12], [0.88 * L, -16.5], [L, -21]];
    case 'maltese': return [[PINCH, -PINCH], [L, -20], [L - 13, 0]];
    // two outer points curling outward, the middle one standing well past them
    case 'patonce': return [[PINCH, -PINCH], [0.5 * L, -9], [L - 18, -12], [L - 17, -19], [L - 11, -26], [L - 8, -19], [L - 11, -12], [L - 6, -7], [L, 0]];
    case 'flory': return [[HALF, -HALF], [L - 17, -HALF], [L - 14, -15], [L - 15, -21], [L - 10, -20], [L - 6, -14], [L - 9, -7], [L - 4, -5], [L, 0]];
    // a horn curling outward and back towards the crossing, a deep notch between it and its mirror image
    case 'moline': return [[HALF, -HALF], [L - 16, -HALF], [L - 11, -12], [L - 9, -15], [L - 11, -17.5], [L - 14, -19], [L - 17, -21], [L - 15, -25], [L - 10, -27], [L - 4, -25], [L, -20], [L + 1, -13], [L, -6], [L, -3], [L - 12, 0]];
    case 'bottony': return bottony(L);
    default: return arm satisfies never;
  }
}

/** The arm's two sides: out along one, back along the other. */
const both = (side: readonly Pt[]): Pt[] => [...side, ...side.map(([a, c]): Pt => [a, -c]).reverse()];

/** A fitchy foot: the arm narrows to a point over its last 16. */
const foot = (start: number, L: number): Pt[] => both([[start, -start], [L - 16, -HALF], [L, 0]]);

/** Each arm's [along, across] seen from the crossing, turned to the shield: the top arm, then clockwise. */
const TURNS: readonly ((p: Pt) => Pt)[] = [([a, c]) => [c, -a], ([a, c]) => [a, c], ([a, c]) => [-c, a], ([a, c]) => [-a, -c]];

/** The lengths of the top arm, the side arms and the foot, from the crossing. */
function lengths({ arm, latin, ring, fitchy }: CrossSpec): readonly [number, number, number] {
  if (ring) return [32, 32, 54];
  if (latin) return [28, 28, 58];
  if (arm === 'tau') return [HALF, 35, 77];
  // the wide-spread ends of the moline and patonce would meet their neighbours' on the shorter arms of a fitchy cross
  if (fitchy) return arm === 'moline' || arm === 'patonce' ? [43, 43, 50] : [38, 38, 48];
  return [43, 43, 43];
}

/** The Celtic cross: plain arms through a ring; the outline runs out along each arm and round the ring's outside to the next. */
function ringed(spec: CrossSpec): Pt[][] {
  const [top, side, footLength] = lengths(spec);
  const outer = 25, inner = 18;
  const leave = (r: number) => Math.sqrt(r * r - HALF * HALF);
  const arms = [top, side, footLength, side].map((L, k) => {
    const ends = k === 2 && spec.fitchy ? foot(HALF, L).slice(1, -1) : [[L, -HALF], [L, HALF]] as Pt[];
    return [[leave(outer), -HALF] as Pt, ...ends, [leave(outer), HALF] as Pt].map(TURNS[k]);
  });
  const outline = arms.flatMap((points, k) => {
    const from = points[points.length - 1], to = arms[(k + 1) % 4][0], a0 = angleAt([0, 0], from);
    return [...points, ...arc(0, 0, outer, a0, a0 + mod(angleAt([0, 0], to) - a0), 6).slice(1, -1)];
  });
  const holes = TURNS.map((turn, k) => {
    const next = TURNS[(k + 1) % 4], from = next([leave(inner), -HALF]), to = turn([leave(inner), HALF]), a0 = angleAt([0, 0], from);
    return [turn([HALF, HALF]), ...arc(0, 0, inner, a0, a0 - mod(a0 - angleAt([0, 0], to)), 6)];
  });
  return [outline, ...holes];
}

export function crossRings(spec: CrossSpec): Pt[][] {
  if (spec.ring) return ringed(spec);
  const [top, side, footLength] = lengths(spec);
  const ends = [top, side, footLength, side].map((L, k): Pt[] => {
    if (k === 0 && spec.arm === 'tau') return [[HALF, -HALF], [HALF, HALF]];
    if (k === 2 && spec.fitchy) return foot(armSide(spec.arm, L)[0][0], L);
    return both(armSide(spec.arm, L));
  });
  return [ends.flatMap((points, k) => points.map(TURNS[k]))];
}

export const crossPath = (spec: CrossSpec): string => ringsPath(fitRings(crossRings(spec)));

const plain = (arm: CrossArm): CrossSpec => ({ arm, latin: false, ring: false, fitchy: false });

/** The generated crosses (the cross crosslet keeps its hand-drawn path). */
export const CROSS_SPECS = {
  'cross-couped': plain('plain'),
  'cross-latin': { ...plain('plain'), latin: true },
  'cross-formy': plain('formy'),
  'cross-bottony': plain('bottony'),
  'cross-moline': plain('moline'),
  'cross-flory': plain('flory'),
  'cross-patonce': plain('patonce'),
  'cross-potent': plain('potent'),
  'cross-maltese': plain('maltese'),
  'cross-celtic': { ...plain('plain'), latin: true, ring: true },
  'cross-tau': plain('tau'),
} as const satisfies Partial<Record<ChargeId, CrossSpec>>;

type GeneratedCross = keyof typeof CROSS_SPECS;

export const PATHS_CROSSES = Object.fromEntries(Object.entries(CROSS_SPECS).map(([id, spec]) => [id, { _: crossPath(spec) }])) as
  Record<GeneratedCross, { _: string }> satisfies ArtPaths;

/** The crosses that may be fitchy, each drawn so: all but the Maltese cross, whose notched arms have no foot to sharpen. */
export const FITCHY_CROSSES: Partial<Record<ChargeId, string>> = Object.fromEntries(
  [...Object.entries(CROSS_SPECS), ['cross-crosslet', plain('crosslet')] as const]
    .filter(([id]) => id !== 'cross-maltese')
    .map(([id, spec]) => [id, crossPath({ ...spec, fitchy: true })]),
);
