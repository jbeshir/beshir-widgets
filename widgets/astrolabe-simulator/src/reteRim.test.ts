import { describe, expect, it } from 'vitest';
import { reteRimPath, reteRimPoints } from './reteRim';

describe('rete outer rim', () => {
  it('stays very close to the accurate reference circle', () => {
    const radius = 500;
    const radii = reteRimPoints(radius).map((point) => Math.hypot(point.x, point.y));
    expect(Math.min(...radii)).toBeGreaterThan(radius - 2.3);
    expect(Math.max(...radii)).toBeLessThan(radius + 2.3);
  });

  it('is asymmetric enough to reveal rotation', () => {
    const points = reteRimPoints(500);
    const radii = points.map((point) => Math.hypot(point.x, point.y));
    expect(new Set(radii.map((radius) => radius.toFixed(3))).size).toBeGreaterThan(100);
    expect(Math.abs(radii[0] - radii[90])).toBeGreaterThan(0.1);
  });

  it('emits a closed SVG path', () => {
    const path = reteRimPath(500, 36);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith(' Z')).toBe(true);
    expect(path.match(/ L /g)).toHaveLength(35);
  });
});
