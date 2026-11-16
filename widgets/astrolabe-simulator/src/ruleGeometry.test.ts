import { describe, expect, it } from 'vitest';
import { equationOfTime } from './astro';
import { alidadeLineCross, alidadeRotationForLongitude } from './backGeometry';
import {
  EQUATION_PIXELS_PER_MINUTE,
  EQUATION_LABEL_GAP,
  EQUATION_ZERO_RADIUS,
  FRONT_RULE_HIT_WIDTH,
  alidadeMinuteScale,
  fiducialSegments,
  taperedRulePath,
  counterchangedRulePaths,
  equationOfTimeLabelPosition,
  equationOfTimePoint,
  frontRuleHitPath,
} from './ruleGeometry';

describe('shared counterchanged rule geometry', () => {
  it('keeps the inside edge of both horizontal arms on the center line', () => {
    expect(counterchangedRulePaths('horizontal', 100, 8)).toEqual([
      'M -100 0 L 0 0 L 0 8 L -100 8 Z',
      'M 0 -8 L 100 -8 L 100 0 L 0 0 Z',
    ]);
  });

  it('rotates the same construction for the vertical front rule', () => {
    expect(counterchangedRulePaths('vertical', 100, 8)).toEqual([
      'M 0 -100 L 0 0 L -8 0 L -8 -100 Z',
      'M 0 0 L 8 0 L 8 100 L 0 100 Z',
    ]);
  });

  it('provides a continuous rule hit corridor wide enough to own overlaps', () => {
    expect(frontRuleHitPath(107)).toBe('M 0 -107 L 0 107');
    expect(FRONT_RULE_HIT_WIDTH).toBeGreaterThan(14);
  });
});

describe('polar equation-of-time loop', () => {
  it('encodes the correction as distance along the alidade scale', () => {
    for (const iso of ['2026-02-11T12:00:00Z', '2026-07-26T12:00:00Z', '2026-11-03T12:00:00Z']) {
      const date = new Date(iso);
      const point = equationOfTimePoint(date);
      expect((point.radius - EQUATION_ZERO_RADIUS) / EQUATION_PIXELS_PER_MINUTE).toBeCloseTo(equationOfTime(date), 10);
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(point.radius, 10);
    }
  });

  it('lies on the center line when the alidade is aligned to its date', () => {
    for (let month = 0; month < 12; month += 1) {
      const point = equationOfTimePoint(new Date(Date.UTC(2026, month, 15, 12)));
      expect(alidadeLineCross(point, alidadeRotationForLongitude(point.longitude))).toBeCloseTo(0, 9);
    }
  });

  it('anchors the label immediately above the top of the rendered loop', () => {
    const samples = Array.from({ length: 365 }, (_, day) => (
      equationOfTimePoint(new Date(Date.UTC(2026, 0, day + 1, 12)))
    ));
    const top = samples.reduce((highest, point) => point.y < highest.y ? point : highest);
    const label = equationOfTimeLabelPosition(samples);
    expect(label.x).toBe(top.x);
    expect(label.y).toBe(top.y - EQUATION_LABEL_GAP);
    expect(Math.min(...samples.map((point) => Math.hypot(label.x - point.x, label.y - point.y))))
      .toBeLessThanOrEqual(EQUATION_LABEL_GAP);
  });

  it('rejects an empty curve when positioning its label', () => {
    expect(() => equationOfTimeLabelPosition([])).toThrow(RangeError);
  });
});

describe('alidade minute scale (FG-2d)', () => {
  it('ticks every whole minute from −20 to +20 and labels every five', () => {
    const scale = alidadeMinuteScale();
    expect(scale.map((tick) => tick.minutes)).toEqual(Array.from({ length: 41 }, (_, index) => index - 20));
    expect(scale.filter((tick) => tick.labelled).map((tick) => tick.minutes)).toEqual([-20, -15, -10, -5, 0, 5, 10, 15, 20]);
    for (let index = 1; index < scale.length; index += 1) {
      expect(scale[index].radius - scale[index - 1].radius).toBeCloseTo(EQUATION_PIXELS_PER_MINUTE, 10);
    }
  });

  it('carries the 23 October equation-of-time point on the scale', () => {
    const scale = alidadeMinuteScale();
    const point = equationOfTimePoint(new Date('2026-10-23T12:00:00Z'));
    const minutes = equationOfTime(new Date('2026-10-23T12:00:00Z'));
    expect(minutes).toBeGreaterThan(15);
    expect(point.radius).toBeGreaterThan(scale[0].radius);
    expect(point.radius).toBeLessThan(scale[scale.length - 1].radius);
    const nearest = scale.reduce((best, tick) => Math.abs(tick.radius - point.radius) < Math.abs(best.radius - point.radius) ? tick : best);
    expect(nearest.minutes).toBe(Math.round(minutes));
    // The alidade laid over the date's longitude passes through the loop point.
    const rotation = alidadeRotationForLongitude(point.longitude);
    expect(Math.abs(alidadeLineCross(point, rotation))).toBeLessThan(1e-9);
  });
});

describe('solid tapered rule outline', () => {
  it('ends both arms exactly on the fiducial centre line, on opposite sides', () => {
    const taper = { hub: 30, root: 34, shoulder: 20, shoulderAt: 500 };
    const vertical = taperedRulePath('vertical', 594, taper);
    expect(vertical).toContain('0 594');
    expect(vertical).toContain('0 -594');
    expect(vertical).toContain('34 0');
    expect(vertical).toContain('-34 0');
    const horizontal = taperedRulePath('horizontal', 600, taper);
    // Right arm above the line (negative y), left arm below, like counterchangedRulePaths.
    expect(horizontal).toContain('600 0');
    expect(horizontal).toContain('-600 0');
    expect(horizontal).toContain('0 -34');
    expect(horizontal).toContain('0 34');
  });
});

describe('fiducial edge', () => {
  const taper = { hub: 30, root: 34, shoulder: 20, shoulderAt: 500 };
  it('leaves each arm open along its edge, so a stroke never spills onto the open side', () => {
    const subpaths = taperedRulePath('vertical', 594, taper).split(/(?=M)/).map((part) => part.trim());
    // Two arms (open: no Z) and the closed boss.
    expect(subpaths).toHaveLength(3);
    for (const arm of subpaths.slice(0, 2)) {
      expect(arm).not.toContain('Z');
      const points = arm.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
      const first = points.slice(0, 2);
      const last = points.slice(-2);
      // The implicit closing segment joins the pivot and the tip, both on the line x = 0.
      expect(Math.abs(first[0])).toBe(0);
      expect(Math.abs(last[0])).toBe(0);
      expect(Math.abs(first[1] - last[1])).toBe(594);
    }
    expect(subpaths[2]).toMatch(/Z$/);
  });
  it('insets the bevel outline only along the edge: the back edge is the metal outline itself', () => {
    const inset = taperedRulePath('vertical', 594, taper, 3);
    expect(inset).toContain('3 594');
    expect(inset).toContain('-3 -594');
    const arms = (d: string) => d.split(/(?=M)/).slice(0, 2).map((arm) => arm.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number));
    const metal = arms(taperedRulePath('vertical', 594, taper));
    const bevel = arms(inset);
    for (const [index, arm] of bevel.entries()) {
      const outline = metal[index];
      // Same vertex count; the root and shoulder (the back edge) are unchanged, so no bevel copy sticks out behind the arm.
      expect(arm).toHaveLength(outline.length);
      const sameBack = arm.filter((value, k) => value === outline[k]).length;
      expect(sameBack).toBe(outline.length - 2);
      // Every bevel vertex lies within the arm: |x| between the edge and the metal's own width at that height.
      for (let k = 0; k < arm.length; k += 2) {
        const x = arm[k];
        expect(Math.abs(x)).toBeLessThanOrEqual(Math.max(...outline.filter((_, j) => j % 2 === 0).map(Math.abs)));
      }
    }
  });
  it('sets each ink line on its own arm, with its outer side on the edge', () => {
    const [a, b] = fiducialSegments('vertical', 594, 0.7);
    expect([a.x1, a.x2, a.y2]).toEqual([0.7, 0.7, 594]);
    expect([b.x1, b.x2, b.y2]).toEqual([-0.7, -0.7, -594]);
    const [h, k] = fiducialSegments('horizontal', 600, 0.7);
    // Arm along +x has its body above the line (negative y), like the outline.
    expect([h.y1, h.x2]).toEqual([-0.7, 600]);
    expect([k.y1, k.x2]).toEqual([0.7, -600]);
  });
});
