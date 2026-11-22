import { equationOfTime, solarLongitude } from './astro';
import { backLongitudePoint } from './backGeometry';

export const EQUATION_ZERO_RADIUS = 215;
export const EQUATION_PIXELS_PER_MINUTE = 6;
export const EQUATION_LABEL_GAP = 14;
export const FRONT_RULE_HIT_WIDTH = 28;

/** Continuous centerline used by the front rule's semantic pointer hit area. */
export function frontRuleHitPath(extent: number): string {
  return `M 0 ${-extent} L 0 ${extent}`;
}

export function counterchangedRulePaths(
  orientation: 'horizontal' | 'vertical',
  extent: number,
  width: number,
): [string, string] {
  if (orientation === 'horizontal') {
    return [
      `M ${-extent} 0 L 0 0 L 0 ${width} L ${-extent} ${width} Z`,
      `M 0 ${-width} L ${extent} ${-width} L ${extent} 0 L 0 0 Z`,
    ];
  }
  return [
    `M 0 ${-extent} L 0 0 L ${-width} 0 L ${-width} ${-extent} Z`,
    `M 0 0 L ${width} 0 L ${width} ${extent} L 0 ${extent} Z`,
  ];
}

export function equationOfTimePoint(date: Date): { x: number; y: number; radius: number; longitude: number } {
  const longitude = solarLongitude(date);
  const radius = EQUATION_ZERO_RADIUS + equationOfTime(date) * EQUATION_PIXELS_PER_MINUTE;
  const point = backLongitudePoint(radius, longitude);
  return {
    x: point.x,
    y: point.y,
    radius,
    longitude,
  };
}

/** Place the caption immediately above the loop instead of at a fixed radius. */
export function equationOfTimeLabelPosition(
  samples: readonly { x: number; y: number }[],
): { x: number; y: number } {
  if (samples.length === 0) throw new RangeError('Equation-of-time samples must not be empty');
  const top = samples.reduce((highest, point) => point.y < highest.y ? point : highest);
  return { x: top.x, y: top.y - EQUATION_LABEL_GAP };
}

export const ALIDADE_MINUTE_RANGE = 20;
export const ALIDADE_MINUTE_LABEL_STEP = 5;

export interface AlidadeMinuteTick {
  minutes: number;
  /** Distance from the pivot along the alidade's reading edge. */
  radius: number;
  labelled: boolean;
}

/**
 * Minute scale on the alidade arm (FG-2d): every whole minute from −20 to
 * +20, labelled every five, at the same radius encoding as the EoT loop.
 */
export function alidadeMinuteScale(): AlidadeMinuteTick[] {
  return Array.from({ length: ALIDADE_MINUTE_RANGE * 2 + 1 }, (_, index) => {
    const minutes = index - ALIDADE_MINUTE_RANGE;
    return {
      minutes,
      radius: EQUATION_ZERO_RADIUS + minutes * EQUATION_PIXELS_PER_MINUTE,
      labelled: minutes % ALIDADE_MINUTE_LABEL_STEP === 0,
    };
  });
}

export interface RuleTaper {
  /** Radius of the round boss around the pivot. */
  hub: number;
  /** Arm width at the pivot. */
  root: number;
  /** Arm width where the final point begins. */
  shoulder: number;
  /** Distance from the pivot to the shoulder. */
  shoulderAt: number;
}

function windPositive(points: readonly [number, number][]): [number, number][] {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [ax, ay] = points[index];
    const [bx, by] = points[(index + 1) % points.length];
    area += ax * by - bx * ay;
  }
  return area >= 0 ? [...points] : [...points].reverse();
}

/**
 * Solid counterchanged rule/alidade outline (fill-rule nonzero), read the way
 * real instruments are: each arm's body lies wholly to one side of the line
 * through the centre, on opposite sides for the two arms, and tapers from
 * the boss to a point that ends exactly on that line. The straight side of
 * each arm is its fiducial edge, so the reading line is the metal's own edge
 * and whatever lies beside it on the open side stays uncovered.
 *
 * Each arm is an open subpath whose implicit closing segment is the fiducial
 * edge: the fill is that of the closed polygon, but a stroke (step highlight,
 * keyboard focus) outlines only the body sides and never spills over the
 * edge onto the open side.
 *
 * `inset` sets the two points that lie on the edge (pivot end and tip) that
 * far into the body; the back edge (root and shoulder) is unchanged. The
 * screen-space bevel copies use it, so they never protrude past the fiducial
 * edge, while their offset still shows on the back edge facing the light.
 */
export function taperedRulePath(orientation: 'horizontal' | 'vertical', extent: number, taper: RuleTaper, inset = 0): string {
  const { hub, root, shoulder, shoulderAt } = taper;
  // Vertical layout: arm A along +y on the +x side; arm B mirrored through the pivot.
  const armA: [number, number][] = [[inset, 0], [root, 0], [shoulder, shoulderAt], [inset, extent]];
  const armB = armA.map(([x, y]) => [-x, -y] as [number, number]);
  const place = ([x, y]: [number, number]): [number, number] => orientation === 'vertical' ? [x, y] : [y, -x];
  // The first and last points are the pivot end and the tip, so the implicit closing segment is the edge.
  const openArm = (arm: [number, number][]) => windPositive(arm.map(place))
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const boss = `M${hub} 0 A${hub} ${hub} 0 1 1 ${-hub} 0 A${hub} ${hub} 0 1 1 ${hub} 0 Z`;
  return `${openArm(armA)} ${openArm(armB)} ${boss}`;
}

export interface FiducialSegment {
  /** Ink-line endpoints, inset by `halfWidth` so the line's outer side is exactly the edge. */
  x1: number; y1: number; x2: number; y2: number;
  /** Which way the arm's body lies from the edge: 'pos' = +x (vertical) or −y (horizontal). */
  side: 'pos' | 'neg';
}

/** The two arms' fiducial ink lines (pivot to tip), each drawn on its own arm's metal. */
export function fiducialSegments(orientation: 'horizontal' | 'vertical', extent: number, halfWidth: number): [FiducialSegment, FiducialSegment] {
  const arm = (sign: 1 | -1): FiducialSegment => {
    const side = sign > 0 ? 'pos' : 'neg';
    // Vertical: arm A runs along +y with its body at +x; arm B along −y with its body at −x.
    if (orientation === 'vertical') return { x1: sign * halfWidth, y1: 0, x2: sign * halfWidth, y2: sign * extent, side };
    // Horizontal ([x, y] -> [y, −x]): arm A runs along +x with its body at −y.
    return { x1: 0, y1: -sign * halfWidth, x2: sign * extent, y2: -sign * halfWidth, side };
  };
  return [arm(1), arm(-1)];
}
