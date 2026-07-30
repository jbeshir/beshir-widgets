import { describe, expect, it } from 'vitest';
import {
  equatorialToHorizontal,
  greenwichSiderealTime,
  localSiderealTime,
  raDegFromHMS,
  solarLongitude,
} from './astro';
import { orientRetePoint, project, projectHorizontal, rOfDec } from './geometry';
import { STARS } from './data/stars';

/**
 * Independent reference observation:
 *   Aldebaran, 2026-01-15T20:00:00Z, 50° N, Greenwich.
 *
 * Catalogue coordinates are SIMBAD ICRS/J2000:
 * https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=aldebaran
 *
 * Reference figures were calculated with Astropy 8.0.1. The horizontal
 * calculation deliberately holds the J2000 catalogue coordinates fixed,
 * matching this educational astrolabe's documented model. It does not use
 * Astropy's epoch-of-date apparent transform (precession/nutation).
 *
 * The spherical conversion follows the USNO equations:
 * https://aa.usno.navy.mil/faq/alt_az
 */
const DATE = new Date('2026-01-15T20:00:00Z');
const LATITUDE = 50;
const LONGITUDE = 0;
const RADIUS = 380;

const SIMBAD = {
  ra: raDegFromHMS(4, 35, 55.23907),
  dec: 16 + 30 / 60 + 33.4885 / 3600,
};

const ASTROPY_FIXED_J2000 = {
  gmst: 55.28158190527991,
  altitude: 54.73050237239123,
  azimuth: 156.84533938865167,
  solarLongitude: 295.6819295200401,
};

describe('externally verified Aldebaran observation', () => {
  it('keeps the rete catalogue consistent with SIMBAD ICRS/J2000', () => {
    const aldebaran = STARS.find((star) => star.name === 'Aldebaran');
    expect(aldebaran).toBeDefined();
    expect(aldebaran!.raDeg).toBeCloseTo(SIMBAD.ra, 3);
    expect(aldebaran!.decDeg).toBeCloseTo(SIMBAD.dec, 3);
  });

  it('matches independent sidereal and solar-longitude figures within model accuracy', () => {
    expect(greenwichSiderealTime(DATE)).toBeCloseTo(ASTROPY_FIXED_J2000.gmst, 3);
    expect(solarLongitude(DATE)).toBeCloseTo(ASTROPY_FIXED_J2000.solarLongitude, 2);
  });

  it('places the star at the independently calculated altitude and azimuth', () => {
    const sidereal = greenwichSiderealTime(DATE) + LONGITUDE;
    const observation = equatorialToHorizontal(SIMBAD.ra, SIMBAD.dec, LATITUDE, sidereal);
    expect(observation.altitude).toBeCloseTo(ASTROPY_FIXED_J2000.altitude, 3);
    expect(observation.azimuth).toBeCloseTo(ASTROPY_FIXED_J2000.azimuth, 3);
  });

  it('puts the declination arm marking and horizontal grid intersection on the same point', () => {
    const sidereal = greenwichSiderealTime(DATE) + LONGITUDE;
    const observation = equatorialToHorizontal(SIMBAD.ra, SIMBAD.dec, LATITUDE, sidereal);
    const ruleRadius = rOfDec(SIMBAD.dec, RADIUS);
    const retePoint = project(observation.hourAngle, SIMBAD.dec, RADIUS);
    const platePoint = projectHorizontal(
      LATITUDE,
      observation.altitude,
      observation.azimuth,
      RADIUS,
    );

    expect(retePoint.r).toBeCloseTo(ruleRadius, 10);
    expect(platePoint.x).toBeCloseTo(retePoint.x, 9);
    expect(platePoint.y).toBeCloseTo(retePoint.y, 9);
  });
});

/**
 * Sirius reference:
 *   SIMBAD ICRS/J2000: 06 45 08.91728, −16 42 58.0171
 *   https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=sirius
 *
 * Astropy 8.0.1 ICRS → AltAz at 2026-07-14T12:00:00Z for
 * 51.5° N, 0.12° W, pressure=0 gives altitude 21.1228204159° and
 * azimuth 190.9588941942° clockwise from north:
 * https://docs.astropy.org/en/stable/coordinates/index.html
 *
 * This astrolabe intentionally holds J2000 catalogue coordinates fixed, so
 * its simpler result differs by about 0.30° in azimuth at this date.
 */
describe('externally verified Sirius lesson observation', () => {
  const date = new Date('2026-07-14T12:00:00Z');
  const latitude = 51.5;
  const longitude = -0.12;
  const sirius = {
    ra: raDegFromHMS(6, 45, 8.91728),
    dec: -(16 + 42 / 60 + 58.0171 / 3600),
  };
  const astropy = { altitude: 21.1228204159, azimuth: 190.9588941942 };

  it('keeps the rete catalogue consistent with SIMBAD', () => {
    const catalogue = STARS.find((star) => star.name === 'Sirius');
    expect(catalogue).toBeDefined();
    expect(catalogue!.raDeg).toBeCloseTo(sirius.ra, 3);
    expect(catalogue!.decDeg).toBeCloseTo(sirius.dec, 3);
  });

  it('agrees with the trusted apparent AltAz calculation within fixed-J2000 model accuracy', () => {
    const sidereal = localSiderealTime(date, longitude);
    const observation = equatorialToHorizontal(sirius.ra, sirius.dec, latitude, sidereal);
    expect(observation.altitude).toBeCloseTo(astropy.altitude, 1);
    expect(Math.abs(observation.azimuth - astropy.azimuth)).toBeLessThan(0.35);
    expect(observation.azimuth).toBeGreaterThan(180);
  });

  it('renders Sirius at the same altitude and azimuth grid intersection', () => {
    const sidereal = localSiderealTime(date, longitude);
    const observation = equatorialToHorizontal(sirius.ra, sirius.dec, latitude, sidereal);
    const renderedStar = orientRetePoint(project(sirius.ra, sirius.dec, RADIUS), sidereal);
    const platePoint = projectHorizontal(latitude, observation.altitude, observation.azimuth, RADIUS);

    expect(renderedStar.x).toBeCloseTo(platePoint.x, 9);
    expect(renderedStar.y).toBeCloseTo(platePoint.y, 9);
  });
});
