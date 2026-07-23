import { describe, expect, it } from 'vitest';
import {
  almucantar,
  azimuth,
  capricornRadius,
  eclipticCircle,
  eclipticPoint,
  equatorRadius,
  flipY,
  horizon,
  nadir,
  project,
  projectHorizontal,
  rOfDec,
  tropicCancerRadius,
  tropicCapricornRadius,
  zenith,
} from './geometry';

const R = 100;

describe('render coordinate conversion', () => {
  it.each([-120, -1, 0, 1, 120])('negates and round-trips y=%s', (y) => {
    expect(flipY(y)).toBe(-y);
    expect(flipY(flipY(y))).toBe(y);
  });
});

describe('declination circles', () => {
  it('projects the equator at the reference radius and the north pole at zero', () => {
    expect(rOfDec(0, R)).toBeCloseTo(R, 12);
    expect(rOfDec(90, R)).toBeCloseTo(0, 12);
    expect(equatorRadius(R)).toBeCloseTo(R, 12);
  });

  it('shrinks monotonically from southern to northern declinations', () => {
    const radii = [-80, -45, 0, 45, 80].map((dec) => rOfDec(dec, R));
    expect(radii).toEqual([...radii].sort((a, b) => b - a));
  });

  it('scales linearly with the reference radius', () => {
    for (const dec of [-60, -23.44, 0, 23.44, 60]) {
      expect(rOfDec(dec, 2 * R)).toBeCloseTo(2 * rOfDec(dec, R), 12);
    }
  });

  it('matches the canonical tropic ratios and Capricorn alias', () => {
    expect(tropicCancerRadius(1)).toBeCloseTo(0.6566, 3);
    expect(tropicCapricornRadius(1)).toBeCloseTo(1.5232, 3);
    expect(capricornRadius(R)).toBe(tropicCapricornRadius(R));
  });
});

describe('plate altitude geometry', () => {
  it('constructs the 45° horizon from its exact values', () => {
    expect(horizon(45, R)).toEqual({
      kind: 'circle',
      cx: 0,
      cy: expect.closeTo(R, 10),
      r: expect.closeTo(R * Math.SQRT2, 10),
    });
  });

  it('uses a line near the equator and a circle at the cutoff', () => {
    expect(horizon(0, R)).toEqual({ kind: 'line', orientation: 'horizontal', value: 0 });
    expect(horizon(1.49, R).kind).toBe('line');
    expect(horizon(1.5, R).kind).toBe('circle');
    expect(horizon(-1.49, R).kind).toBe('line');
  });

  it('is exactly the zero-altitude almucantar away from the equator', () => {
    for (const latitude of [15, 30, 45, 60]) {
      expect(horizon(latitude, R)).toEqual(almucantar(latitude, 0, R));
    }
  });

  it('collapses the 90° almucantar to the zenith', () => {
    for (const latitude of [15, 30, 45, 60]) {
      const circle = almucantar(latitude, 90, R);
      expect(circle.r).toBeCloseTo(0, 12);
      expect(circle.cx).toBe(0);
      expect(circle.cy).toBeCloseTo(zenith(latitude, R).y, 12);
    }
  });

  it('places zenith and nadir on the polar axis at their declination radii', () => {
    for (const latitude of [15, 30, 45, 60]) {
      expect(zenith(latitude, R)).toEqual({ x: 0, y: rOfDec(latitude, R) });
      expect(nadir(latitude, R).x).toBe(0);
      expect(nadir(latitude, R).y).toBeCloseTo(-rOfDec(-latitude, R), 12);
    }
  });

  it('scales almucantar, zenith and nadir geometry linearly', () => {
    const circle = almucantar(52, 20, R);
    const doubled = almucantar(52, 20, 2 * R);
    expect(doubled).toEqual({
      kind: 'circle',
      cx: 0,
      cy: expect.closeTo(2 * circle.cy, 12),
      r: expect.closeTo(2 * circle.r, 12),
    });
    expect(zenith(52, 2 * R).y).toBeCloseTo(2 * zenith(52, R).y, 12);
    expect(nadir(52, 2 * R).y).toBeCloseTo(2 * nadir(52, R).y, 12);
  });
});

describe('plate azimuth geometry', () => {
  it.each([-90, 90])('degenerates the %s° meridian to the polar axis', (angle) => {
    expect(azimuth(45, angle, R)).toEqual({
      kind: 'line',
      orientation: 'vertical',
      value: 0,
    });
  });

  it('constructs the prime vertical and mirrors opposite azimuths', () => {
    expect(azimuth(45, 0, R)).toEqual({
      kind: 'circle',
      cx: 0,
      cy: expect.closeTo(-R, 12),
      r: expect.closeTo(R * Math.SQRT2, 12),
    });
    const east = azimuth(40, 30, R);
    const west = azimuth(40, -30, R);
    expect(east.kind).toBe('circle');
    expect(west.kind).toBe('circle');
    if (east.kind === 'circle' && west.kind === 'circle') {
      expect(east.cx).toBeCloseTo(-west.cx, 12);
      expect(east.cy).toBeCloseTo(west.cy, 12);
      expect(east.r).toBeCloseTo(west.r, 12);
    }
  });

  it('scales a vertical circle linearly', () => {
    const a = azimuth(52, 25, R);
    const b = azimuth(52, 25, 2 * R);
    expect(a.kind).toBe('circle');
    expect(b.kind).toBe('circle');
    if (a.kind === 'circle' && b.kind === 'circle') {
      expect(b.cx).toBeCloseTo(2 * a.cx, 12);
      expect(b.cy).toBeCloseTo(2 * a.cy, 12);
      expect(b.r).toBeCloseTo(2 * a.r, 12);
    }
  });
});

describe('horizontal-coordinate projection', () => {
  it('places the zenith independently of azimuth', () => {
    for (const azimuth of [0, 90, 180, 270]) {
      const point = projectHorizontal(45, 90, azimuth, R);
      expect(point.x).toBeCloseTo(zenith(45, R).x, 10);
      expect(point.y).toBeCloseTo(zenith(45, R).y, 10);
    }
  });

  it('places horizon points on the horizon circle', () => {
    const circle = horizon(45, R);
    expect(circle.kind).toBe('circle');
    if (circle.kind === 'circle') {
      for (let azimuth = 0; azimuth < 360; azimuth += 30) {
        const point = projectHorizontal(45, 0, azimuth, R);
        expect(Math.hypot(point.x - circle.cx, point.y - circle.cy)).toBeCloseTo(circle.r, 10);
      }
    }
  });

  it('places points on their altitude and azimuth circles', () => {
    const point = projectHorizontal(52, 30, 120, R);
    const altitude = almucantar(52, 30, R);
    const azimuthCircle = azimuth(52, 90 - 120, R);
    expect(Math.hypot(point.x - altitude.cx, point.y - altitude.cy)).toBeCloseTo(altitude.r, 10);
    expect(azimuthCircle.kind).toBe('circle');
    if (azimuthCircle.kind === 'circle') {
      expect(Math.hypot(point.x - azimuthCircle.cx, point.y - azimuthCircle.cy)).toBeCloseTo(azimuthCircle.r, 10);
    }
  });
});

describe('rete and ecliptic projection', () => {
  it('makes the ecliptic circle tangent to both tropics', () => {
    const circle = eclipticCircle(R);
    expect(circle.cx + circle.r).toBeCloseTo(tropicCancerRadius(R), 10);
    expect(circle.r - circle.cx).toBeCloseTo(tropicCapricornRadius(R), 10);
  });

  it.each([
    [0, 0, R],
    [90, R, 0],
    [180, 0, -R],
    [270, -R, 0],
  ])('projects equatorial angle %s° to (%s, %s)', (angle, x, y) => {
    const point = project(angle, 0, R);
    expect(point.x).toBeCloseTo(x, 10);
    expect(point.y).toBeCloseTo(y, 10);
    expect(point.r).toBeCloseTo(R, 12);
    expect(point.onPlate).toBe(true);
  });

  it('is periodic in angle and flags points south of the plate rim', () => {
    const point = project(27, -10, R);
    const wrapped = project(387, -10, R);
    expect(wrapped.x).toBeCloseTo(point.x, 10);
    expect(wrapped.y).toBeCloseTo(point.y, 10);
    expect(project(0, -23.44, R).onPlate).toBe(true);
    expect(project(0, -23.45, R).onPlate).toBe(false);
  });

  it('places every sampled zodiac longitude on the ecliptic circle', () => {
    const circle = eclipticCircle(R);
    for (let longitude = 0; longitude < 360; longitude += 15) {
      const point = eclipticPoint(longitude, R);
      expect(Math.hypot(point.x - circle.cx, point.y - circle.cy)).toBeCloseTo(circle.r, 10);
    }
  });

  it('reaches the tropics at the solstices and repeats after a revolution', () => {
    expect(eclipticPoint(90, R).r).toBeCloseTo(tropicCancerRadius(R), 10);
    expect(eclipticPoint(270, R).r).toBeCloseTo(tropicCapricornRadius(R), 10);
    const point = eclipticPoint(37, R);
    const wrapped = eclipticPoint(397, R);
    expect(wrapped.x).toBeCloseTo(point.x, 10);
    expect(wrapped.y).toBeCloseTo(point.y, 10);
  });
});
