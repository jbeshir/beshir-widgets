import { describe, expect, it } from 'vitest';
import { equationOfTime } from './astro';
import {
  EQUATION_PIXELS_PER_MINUTE,
  EQUATION_ZERO_RADIUS,
  FRONT_RULE_HIT_WIDTH,
  counterchangedRulePaths,
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
      const alidadeAngle = (180 - point.longitude) * Math.PI / 180;
      const direction = { x: Math.cos(alidadeAngle), y: -Math.sin(alidadeAngle) };
      expect(point.x * direction.y - point.y * direction.x).toBeCloseTo(0, 9);
    }
  });
});
