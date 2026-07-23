export const SHADOW_SQUARE = {
  halfWidth: 228,
  top: 72,
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
  if (bottomX >= left && bottomX <= right) {
    return { x: bottomX, y: bottom, edge: 'bottom' };
  }

  const x = bottomX < left ? left : right;
  const y = -x * tangent;
  if (y < top || y > bottom) return null;
  return { x, y, edge: x === left ? 'left' : 'right' };
}
