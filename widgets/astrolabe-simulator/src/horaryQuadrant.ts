export const HORARY_RADIUS = 385;
export const HORARY_DIVISION_DEGREES = 15;
export const BACK_VIEWBOX_SIZE = 1240;
export const HORARY_LABEL_FONT_SIZE = 44;
export const HORARY_SIDE_FONT_SIZE = 42;
export const HORARY_TITLE_FONT_SIZE = 30;
export const HORARY_FIELD_RADIUS = 403;

export interface EngravingBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HoraryCircle {
  hour: number;
  boundaryAngle: number;
  center: Point;
  radius: number;
  leftBoundary: Point;
  rightBoundary: Point;
  path: string;
}

export interface HoraryLabel {
  hour: number;
  roman: string;
  position: Point;
}

export interface HoraryLayout {
  radius: number;
  semicirclePath: string;
  circles: HoraryCircle[];
  labels: HoraryLabel[];
  title: { text: string; position: Point; fontSize: number };
  sideLabels: Array<{ text: string; period: 'morning' | 'afternoon'; position: Point; fontSize: number }>;
}

export interface HoraryReadOff {
  hour: number;
  morningHour: number;
  boundaryAngle: number;
  transferredRadius: number;
  transferredPoint: Point;
  lowerHour: number;
  upperHour: number;
  fraction: number;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const radians = (degrees: number): number => degrees * Math.PI / 180;
const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

/** SVG-unit font size after the fixed square viewBox is fitted to a CSS width. */
export function engravingCssPixels(fontSize: number, instrumentWidth: number): number {
  if (!(instrumentWidth > 0)) throw new RangeError('Instrument width must be positive');
  return fontSize * instrumentWidth / BACK_VIEWBOX_SIZE;
}

/**
 * Conservative font-independent bounds for short engraved capitals.
 * Schibsted Grotesk is narrower than 0.68 em per Roman/Latin capital.
 */
export function engravingTextBox(text: string, position: Point, fontSize: number): EngravingBox {
  const halfWidth = text.length * fontSize * 0.68 / 2;
  const halfHeight = fontSize / 2;
  return {
    left: position.x - halfWidth,
    right: position.x + halfWidth,
    top: position.y - halfHeight,
    bottom: position.y + halfHeight,
  };
}

export function boxClearance(a: EngravingBox, b: EngravingBox): number {
  const horizontal = Math.max(b.left - a.right, a.left - b.right, 0);
  const vertical = Math.max(b.top - a.bottom, a.top - b.bottom, 0);
  if (horizontal > 0 || vertical > 0) return Math.hypot(horizontal, vertical);
  return -Math.min(a.right - b.left, b.right - a.left, a.bottom - b.top, b.bottom - a.top);
}

/** Point on the upper construction semicircle, measured from its left horizon. */
export function horaryBoundaryPoint(radius: number, angleDegrees: number): Point {
  const angle = radians(angleDegrees);
  return { x: -radius * Math.cos(angle), y: -radius * Math.sin(angle) };
}

const pathNumber = (value: number): string => (
  Math.abs(value) < 1e-12 ? '0' : Number(value.toFixed(10)).toString()
);

/** Exact lower circle branch, split at the pivot so that it cannot be ambiguous. */
function circularArcPath(leftBoundary: Point, pivot: Point, rightBoundary: Point, circleRadius: number): string {
  const r = pathNumber(circleRadius);
  return [
    `M ${pathNumber(leftBoundary.x)} ${pathNumber(leftBoundary.y)}`,
    `A ${r} ${r} 0 0 0 ${pathNumber(pivot.x)} ${pathNumber(pivot.y)}`,
    `A ${r} ${r} 0 0 0 ${pathNumber(rightBoundary.x)} ${pathNumber(rightBoundary.y)}`,
  ].join(' ');
}

/**
 * Traditional upper-half double horary construction. Each curve is an exact
 * circle through the pivot and one mirrored pair of 15° boundary divisions;
 * its center is the perpendicular-bisector intersection on the meridian.
 */
export function createHoraryLayout(radius = HORARY_RADIUS): HoraryLayout {
  if (!(radius > 0)) throw new RangeError('Horary radius must be positive');

  const circles = Array.from({ length: 6 }, (_, index): HoraryCircle => {
    const hour = index + 1;
    const boundaryAngle = hour * HORARY_DIVISION_DEGREES;
    const leftBoundary = horaryBoundaryPoint(radius, boundaryAngle);
    const rightBoundary = { x: -leftBoundary.x, y: leftBoundary.y };
    const centerY = -radius / (2 * Math.sin(radians(boundaryAngle)));
    const circleRadius = Math.abs(centerY);
    const path = circularArcPath(leftBoundary, { x: 0, y: 0 }, rightBoundary, circleRadius);
    return {
      hour,
      boundaryAngle,
      center: { x: 0, y: centerY },
      radius: circleRadius,
      leftBoundary,
      rightBoundary,
      path,
    };
  });

  // The near-rim label ring makes 46-unit type possible without crowding the
  // central title or the equation-of-time loop. Its paint halo separates type
  // from construction strokes, as on a densely engraved physical instrument.
  const labels = Array.from({ length: 12 }, (_, index): HoraryLabel => {
    const hour = index + 1;
    // Wide VIII is inset to preserve its neighbours; VI is lifted slightly
    // to clear the equation-of-time caption. The remaining labels share the
    // same ring, so the complete double-quadrant sequence is still immediate.
    const labelRadius = radius - 35 + (hour === 6 ? 15 : hour === 4 || hour === 8 ? -60 : 0);
    const point = horaryBoundaryPoint(labelRadius, hour * HORARY_DIVISION_DEGREES);
    if (hour === 12) point.y -= 28;
    return { hour, roman: ROMAN[index], position: point };
  });

  return {
    radius,
    semicirclePath: `M ${-radius} 0 A ${radius} ${radius} 0 0 1 ${radius} 0`,
    circles,
    labels,
    title: {
      text: 'HORAE INAEQ.',
      position: { x: 0, y: -58 },
      fontSize: HORARY_TITLE_FONT_SIZE,
    },
    sideLabels: [
      { text: 'A.M.', period: 'morning', position: { x: -250, y: -58 }, fontSize: HORARY_SIDE_FONT_SIZE },
      { text: 'P.M.', period: 'afternoon', position: { x: 250, y: -58 }, fontSize: HORARY_SIDE_FONT_SIZE },
    ],
  };
}

/**
 * Radius at which an altitude ray intersects a constructed hour circle.
 * The returned point uses the right-hand quadrant; its mirror is equivalent.
 */
export function intersectHoraryCircle(circle: HoraryCircle, altitudeDegrees: number): { radius: number; point: Point } | null {
  if (altitudeDegrees < 0 || altitudeDegrees > 90) return null;
  const altitude = radians(altitudeDegrees);
  const distance = -2 * circle.center.y * Math.sin(altitude);
  return {
    radius: distance,
    point: { x: distance * Math.cos(altitude), y: -distance * Math.sin(altitude) },
  };
}

/** Geometric solar-noon altitude used when preparing the traditional scale. */
export function solarNoonAltitude(latitudeDegrees: number, solarDeclinationDegrees: number): number {
  return 90 - Math.abs(latitudeDegrees - solarDeclinationDegrees);
}

/**
 * Pure two-sighting read-off for temporal (unequal) hours.
 *
 * First the noon-altitude ray marks the sixth-hour circle. Keeping that radial
 * distance, the current-altitude ray crosses the family of hour circles. The
 * morning reading is I–VI; the same curves mirror to VI–XII after noon.
 */
export function readTemporalHour(
  noonAltitudeDegrees: number,
  currentAltitudeDegrees: number,
  period: 'morning' | 'afternoon',
  radius = HORARY_RADIUS,
): HoraryReadOff | null {
  if (
    noonAltitudeDegrees <= 0 || noonAltitudeDegrees > 90
    || currentAltitudeDegrees < 0 || currentAltitudeDegrees > noonAltitudeDegrees
  ) return null;

  const noonSine = Math.sin(radians(noonAltitudeDegrees));
  const currentSine = Math.sin(radians(currentAltitudeDegrees));
  const ratio = clamp(currentSine / noonSine, 0, 1);
  const boundaryAngle = Math.asin(ratio) * 180 / Math.PI;
  const morningHour = boundaryAngle / HORARY_DIVISION_DEGREES;
  const hour = period === 'morning' ? morningHour : 12 - morningHour;
  const transferredRadius = radius * noonSine;
  const altitude = radians(currentAltitudeDegrees);
  const lowerHour = Math.floor(hour);
  const upperHour = Math.ceil(hour);

  return {
    hour,
    morningHour,
    boundaryAngle,
    transferredRadius,
    transferredPoint: {
      x: transferredRadius * Math.cos(altitude),
      y: -transferredRadius * Math.sin(altitude),
    },
    lowerHour,
    upperHour,
    fraction: hour - lowerHour,
  };
}
