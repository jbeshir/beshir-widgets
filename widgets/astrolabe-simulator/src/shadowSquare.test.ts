import { describe, expect, it } from 'vitest';
import { SHADOW_SQUARE, shadowSquareIntersection, shadowSquareLayout } from './shadowSquare';

describe('shadow-square construction', () => {
  it('fits every corner inside the back-face field', () => {
    const layout = shadowSquareLayout();
    for (const x of [layout.left, layout.right]) {
      for (const y of [layout.top, layout.bottom]) {
        expect(Math.hypot(x, y)).toBeLessThan(403);
      }
    }
  });

  it('constructs two adjacent 12-by-12 squares with uniform divisions', () => {
    const layout = shadowSquareLayout();
    expect(layout.step).toBe(19);
    expect(layout.verticals).toHaveLength(25);
    expect(layout.horizontals).toHaveLength(13);
    expect(layout.verticals[0]).toBe(layout.left);
    expect(layout.verticals[12]).toBe(0);
    expect(layout.verticals[24]).toBe(layout.right);
    expect(layout.horizontals[0]).toBe(layout.top);
    expect(layout.horizontals[12]).toBe(layout.bottom);
    expect(layout.right - layout.left).toBe(SHADOW_SQUARE.size * 2);
    expect(layout.bottom - layout.top).toBe(SHADOW_SQUARE.size);
  });
});

describe('alidade intersections with the shadow square', () => {
  it.each([
    [30, -228, 228 * Math.tan(Math.PI / 6), 'left'],
    [45, -228, 228, 'bottom'],
    [60, -228 / Math.sqrt(3), 228, 'bottom'],
    [90, 0, 228, 'bottom'],
    [120, 228 / Math.sqrt(3), 228, 'bottom'],
    [135, 228, 228, 'bottom'],
    [150, 228, 228 * Math.tan(Math.PI / 6), 'right'],
  ] as const)('places a %s° sightline at (%s, %s) on the %s edge', (angle, x, y, edge) => {
    const intersection = shadowSquareIntersection(angle);
    expect(intersection).not.toBeNull();
    expect(intersection?.x).toBeCloseTo(x, 10);
    expect(intersection?.y).toBeCloseTo(y, 10);
    expect(intersection?.edge).toBe(edge);
  });

  it('returns no reading when the sightline passes below the square', () => {
    expect(shadowSquareIntersection(0)).toBeNull();
    expect(shadowSquareIntersection(180)).toBeNull();
  });

  it('places the 45° sightline exactly through the lower-left corner', () => {
    const layout = shadowSquareLayout();
    expect(shadowSquareIntersection(45)).toEqual({
      x: layout.left,
      y: layout.bottom,
      edge: 'bottom',
    });
  });

  it('mirrors readings across the vertical axis', () => {
    for (const angle of [20, 30, 45, 60, 75]) {
      const left = shadowSquareIntersection(angle);
      const right = shadowSquareIntersection(180 - angle);
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(left?.x).toBeCloseTo(-(right?.x ?? 0), 10);
      expect(left?.y).toBeCloseTo(right?.y ?? 0, 10);
    }
  });

  it('lands on expected bottom-grid locations for constructed sighting angles', () => {
    const layout = shadowSquareLayout();
    for (const division of [-12, -6, 0, 6, 12]) {
      const expectedX = division * layout.step;
      const angle = Math.atan2(layout.bottom, -expectedX) * 180 / Math.PI;
      const intersection = shadowSquareIntersection(angle);
      expect(intersection?.x).toBeCloseTo(expectedX, 10);
      expect(intersection?.y).toBeCloseTo(layout.bottom, 10);
    }
  });

  it('keeps every returned point collinear with the rendered alidade', () => {
    for (let angle = 18; angle <= 162; angle += 3) {
      const intersection = shadowSquareIntersection(angle);
      if (!intersection) continue;
      expect(intersection.y).toBeCloseTo(-intersection.x * Math.tan(angle * Math.PI / 180), 9);
    }
  });
});
