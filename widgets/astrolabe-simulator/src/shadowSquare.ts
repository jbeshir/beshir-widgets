export const SHADOW_SQUARE = {
  halfWidth: 228,
  top: 0,
  size: 228,
  divisions: 12,
} as const;

export interface ShadowSquareLayout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  step: number;
  verticals: number[];
  horizontals: number[];
}

export interface ShadowSquareIntersection {
  x: number;
  y: number;
  edge: 'left' | 'right' | 'bottom';
}

export function shadowSquareLayout(): ShadowSquareLayout {
  const { halfWidth, top, size, divisions } = SHADOW_SQUARE;
  const step = size / divisions;
  return {
    left: -halfWidth,
    right: halfWidth,
    top,
    bottom: top + size,
    step,
    verticals: Array.from({ length: divisions * 2 + 1 }, (_, index) => -halfWidth + index * step),
    horizontals: Array.from({ length: divisions + 1 }, (_, index) => top + index * step),
  };
}

/**
 * Intersect the bidirectional alidade sightline with the shadow square's
 * graduated outer edge. The component rotates its horizontal rule by
 * `-angle`, so the lower ray obeys x/y = -cot(angle).
 */
export function shadowSquareIntersection(alidadeAngleDeg: number): ShadowSquareIntersection | null {
  const { left, right, top, bottom } = shadowSquareLayout();
  const angle = ((alidadeAngleDeg % 180) + 180) % 180;
  const tangent = Math.tan(angle * Math.PI / 180);
  if (Math.abs(tangent) < 1e-12) return null;

  const bottomX = -bottom / tangent;
  const epsilon = 1e-9;
  if (bottomX >= left - epsilon && bottomX <= right + epsilon) {
    return { x: Math.max(left, Math.min(right, bottomX)), y: bottom, edge: 'bottom' };
  }

  const x = bottomX < left ? left : right;
  const y = -x * tangent;
  if (y < top || y > bottom) return null;
  return { x, y, edge: x === left ? 'left' : 'right' };
}

export interface ShadowSquareNumber {
  edge: 'left' | 'right' | 'bottom';
  /** Reading in twelfths: distance from the top (versa) or from the centre line (recta). */
  value: number;
  x: number;
  y: number;
}

export const SHADOW_SQUARE_NUMBER_STEP = 2;

/**
 * Engraved numbers on both halves (FG-2c): umbra versa down the left and
 * right sides, umbra recta outward from the centre along both halves of
 * the bottom, so either end of the alidade can be read.
 */
export function shadowSquareNumbers(): ShadowSquareNumber[] {
  const { left, right, top, bottom, step } = shadowSquareLayout();
  const values = Array.from(
    { length: SHADOW_SQUARE.divisions / SHADOW_SQUARE_NUMBER_STEP },
    (_, index) => (index + 1) * SHADOW_SQUARE_NUMBER_STEP,
  );
  return [
    ...values.map((value) => ({ edge: 'left' as const, value, x: left, y: top + value * step })),
    ...values.map((value) => ({ edge: 'right' as const, value, x: right, y: top + value * step })),
    ...values.map((value) => ({ edge: 'bottom' as const, value, x: -value * step, y: bottom })),
    ...values.map((value) => ({ edge: 'bottom' as const, value, x: value * step, y: bottom })),
  ];
}

/** Reading in twelfths at an intersection, matching `shadowSquareNumbers`. */
export function shadowSquareReading(intersection: ShadowSquareIntersection): number {
  const { top, step } = shadowSquareLayout();
  return intersection.edge === 'bottom' ? Math.abs(intersection.x) / step : (intersection.y - top) / step;
}
