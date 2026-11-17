import { describe, expect, it } from 'vitest';
import { besideRadial, numeralHalfExtents, sideOfRadial, tangentAt } from './labelPlacement';

describe('numerals beside their tick', () => {
  it('points the clockwise tangent the way a clock hand turns (screen, y down)', () => {
    expect(tangentAt({ x: 0, y: -10 }, 'cw')).toEqual({ x: 1, y: 0 });
    expect(tangentAt({ x: 10, y: 0 }, 'cw').y).toBeCloseTo(1, 12);
    expect(tangentAt({ x: 0, y: -10 }, 'ccw')).toEqual({ x: -1, y: -0 });
  });

  it('keeps the whole text box on the chosen side of the radial line, clear by the gap', () => {
    for (let angle = 0; angle < 360; angle += 7.5) {
      const radians = angle * Math.PI / 180;
      const p = { x: 565 * Math.cos(radians), y: 565 * Math.sin(radians) };
      for (const side of ['cw', 'ccw'] as const) {
        const { halfWidth, halfHeight } = numeralHalfExtents('350', 17);
        const c = besideRadial(p, side, halfWidth, halfHeight, 3);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: c.x + sx * halfWidth, y: c.y + sy * halfHeight }));
        for (const corner of corners) expect(sideOfRadial(p, corner, side)).toBeGreaterThanOrEqual(3 - 1e-9);
      }
    }
  });
});
