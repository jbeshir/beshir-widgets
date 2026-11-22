import { describe, expect, it } from 'vitest';
import { PLATES } from './data/plates';
import { OBLIQUITY_DEG, horizon, rOfDec } from './geometry';
import { UNEQUAL_HOUR_LABEL_DECLINATION, UNEQUAL_HOUR_LINES, unequalHourCurve, unequalHourLabels, unequalHourPath, unequalHourPoint } from './unequalHours';

const R = 100;

describe('front unequal-hour geometry', () => {
  it('divides every below-horizon diurnal arc into twelve equal angles', () => {
    for (const latitude of PLATES.map((plate) => plate.latitude)) {
      for (const declination of [-OBLIQUITY_DEG, -12, 0, 12, OBLIQUITY_DEG]) {
        const horizonCosine = -Math.tan(latitude * Math.PI / 180) * Math.tan(declination * Math.PI / 180);
        const settingAngle = Math.acos(horizonCosine);
        const belowHorizonArc = 2 * Math.PI - 2 * settingAngle;
        for (const hour of [0, 1, 3, 6, 9, 11, 12]) {
          const point = unequalHourPoint(latitude, hour, declination, R);
          expect(point).not.toBeNull();
          if (!point) continue;
          let angle = Math.atan2(point.x, point.y);
          if (angle < settingAngle - 1e-12) angle += 2 * Math.PI;
          expect(angle).toBeCloseTo(settingAngle + belowHorizonArc * hour / 12, 10);
        }
      }
    }
  });

  it('keeps every rendered point on its declination circle and below the horizon', () => {
    for (const { latitude } of PLATES) {
      const horizonGeometry = horizon(latitude, R);
      for (const hour of UNEQUAL_HOUR_LINES) {
        const curve = unequalHourCurve(latitude, hour, R);
        expect(curve.length).toBeGreaterThan(80);
        for (const point of curve) {
          expect(Math.hypot(point.x, point.y)).toBeCloseTo(point.r, 10);
          if (horizonGeometry.kind === 'circle') {
            expect(Math.hypot(point.x - horizonGeometry.cx, point.y - horizonGeometry.cy))
              .toBeGreaterThanOrEqual(Math.abs(horizonGeometry.r) - 1e-9);
          } else {
            expect(point.y).toBeLessThanOrEqual(1e-9);
          }
        }
      }
    }
  });

  it('places the sixth hour on the lower meridian and mirrors complementary hours', () => {
    for (const latitude of [0, 30.37, 51.5, 60]) {
      for (const declination of [-OBLIQUITY_DEG, 0, OBLIQUITY_DEG]) {
        const sixth = unequalHourPoint(latitude, 6, declination, R);
        expect(sixth?.x).toBeCloseTo(0, 10);
        expect(sixth?.y).toBeCloseTo(-rOfDec(declination, R), 10);
        for (const hour of [1, 2, 3, 4, 5]) {
          const morning = unequalHourPoint(latitude, hour, declination, R);
          const evening = unequalHourPoint(latitude, 12 - hour, declination, R);
          expect(morning?.x).toBeCloseTo(-(evening?.x ?? NaN), 10);
          expect(morning?.y).toBeCloseTo(evening?.y ?? NaN, 10);
        }
      }
    }
  });

  it('uses the pure sampled geometry directly in the SVG path', () => {
    const curve = unequalHourCurve(51.5, 4, R);
    const path = unequalHourPath(51.5, 4, R);
    expect(path.startsWith(`M ${curve[0].x} ${curve[0].y}`)).toBe(true);
    expect(path.endsWith(`L ${curve.at(-1)?.x} ${curve.at(-1)?.y}`)).toBe(true);
    expect((path.match(/[ML]/g) ?? []).length).toBe(curve.length);
  });

  it('omits declinations that never cross the horizon on polar plates', () => {
    expect(unequalHourPoint(80, 6, OBLIQUITY_DEG, R)).toBeNull();
    expect(unequalHourPoint(80, 6, -OBLIQUITY_DEG, R)).toBeNull();
    expect(unequalHourPoint(80, 6, 0, R)).not.toBeNull();
  });
});

describe('front unequal-hour numerals (FG-2b)', () => {
  const R = 340;
  const latitude = 51.5;

  it('labels lines I–XI with Roman numerals', () => {
    expect(unequalHourLabels(latitude, R).map((label) => label.roman)).toEqual(
      ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'],
    );
  });

  it('places each numeral on its own line, near the end closest to the horizon', () => {
    const h = horizon(latitude, R);
    if (h.kind !== 'circle') throw new Error('expected a circular horizon');
    const toHorizon = (p: { x: number; y: number }) => Math.abs(Math.hypot(p.x - h.cx, p.y - h.cy) - Math.abs(h.r));
    for (const label of unequalHourLabels(latitude, R)) {
      const onLine = unequalHourPoint(latitude, label.hour, UNEQUAL_HOUR_LABEL_DECLINATION, R);
      expect(onLine).not.toBeNull();
      expect(label.point.x).toBeCloseTo(onLine!.x, 9);
      expect(label.point.y).toBeCloseTo(onLine!.y, 9);
      const cancerEnd = unequalHourPoint(latitude, label.hour, OBLIQUITY_DEG, R)!;
      const capricornEnd = unequalHourPoint(latitude, label.hour, -OBLIQUITY_DEG, R)!;
      expect(toHorizon(cancerEnd)).toBeLessThan(toHorizon(capricornEnd));
      expect(Math.hypot(label.point.x - cancerEnd.x, label.point.y - cancerEnd.y))
        .toBeLessThan(Math.hypot(label.point.x - capricornEnd.x, label.point.y - capricornEnd.y));
    }
  });

  it('puts VI on the lower meridian', () => {
    const six = unequalHourLabels(latitude, R).find((label) => label.roman === 'VI');
    expect(six?.point.x).toBeCloseTo(0, 9);
    expect(six?.point.y).toBeLessThan(0);
  });
});
