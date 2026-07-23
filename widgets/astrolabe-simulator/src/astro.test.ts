import { describe, expect, it } from 'vitest';
import { equationOfTime, solarLongitude } from './astro';

/**
 * Regression fixture sources:
 * - USNO: the Equation of Time is apparent solar time minus mean solar time
 *   https://aa.usno.navy.mil/faq/eqtime
 * - Astronomie-Québec astrolabe booklet, pp. 21-22: the table lists -6m30s
 *   on July 26 and instructs subtracting EoT from AST to obtain MST
 *   https://astronomie.quebec/astrolabe_booklet.pdf
 */
describe('solar longitude and equation of time sign', () => {
  it('stays near 120 degrees while the conventional EoT is negative around late July 2026', () => {
    const date = new Date('2026-07-23T00:00:00Z');

    expect(solarLongitude(date)).toBeCloseTo(120, 0);
    expect(equationOfTime(date)).toBeCloseTo(-6.4, 1);
  });
});

describe('equation of time', () => {
  it.each([
    ['2026-02-11T12:00:00Z', -14.2],
    ['2026-05-14T12:00:00Z', 3.7],
    ['2026-07-26T12:00:00Z', -6.6],
    ['2026-11-03T12:00:00Z', 16.4],
  ])('matches the expected seasonal value on %s', (iso, minutes) => {
    expect(equationOfTime(new Date(iso))).toBeCloseTo(minutes, 0);
  });

  it('stays within the physical annual range', () => {
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day, 12));
      expect(equationOfTime(date)).toBeGreaterThan(-17);
      expect(equationOfTime(date)).toBeLessThan(17);
    }
  });
});
