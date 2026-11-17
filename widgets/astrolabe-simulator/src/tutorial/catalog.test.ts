import { describe, expect, it } from 'vitest';
import { equationOfTime, normalizeDeg } from '../astro';
import { eclipticPoint, orientRetePoint, project } from '../geometry';
import { alidadeLineCross, backLongitudePoint } from '../backGeometry';
import { equationOfTimePoint, EQUATION_PIXELS_PER_MINUTE, EQUATION_ZERO_RADIUS } from '../ruleGeometry';
import { calendarDayTicks } from '../calendarScale';
import { shadowSquareIntersection } from '../shadowSquare';
import { unequalHourPoint } from '../unequalHours';
import {
  APRIL, CLOCK_TIME, FOUNDATIONS, LESSONS, LOCAL_SKY, OCTOBER, SEASONAL_HOURS, SET_SKY, SHADOW, SOLAR_EVENTS,
  STAR_PATH, SUN_PLACE, TIME_BY_STAR, TIME_BY_SUN, WATCH, clock, limbTime, positionAt, ruleOver, validateCatalog,
} from './catalog';
import type { Lesson } from './types';

const lesson = (id: string): Lesson => {
  const found = LESSONS.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};
const stepOf = (lessonId: string, stepId: string) => {
  const found = lesson(lessonId).steps.find((item) => item.id === stepId);
  if (!found) throw new Error(`missing ${lessonId}/${stepId}`);
  return found;
};
/** Loose comparison with the syllabus figures (SYLLABUS §2): the model computes, the syllabus records. */
const about = (value: number, expected: number, tolerance = 0.05) => expect(Math.abs(value - expected)).toBeLessThanOrEqual(tolerance);
const minutesOf = (hours: number) => hours * 60;

describe('course structure', () => {
  it('has the twelve lessons of the syllabus in course order', () => {
    expect(LESSONS.map((item) => item.id)).toEqual([
      'front.foundations.v1', 'back.measure-altitude.v1', 'front.local-sky.v1', 'front.read-star.v1',
      'back.sun-place.v1', 'solar.time-by-sun.v1', 'solar.events.v1', 'night.time-by-star.v1',
      'back.equation-time.v1', 'front.unequal-hours.v1', 'front.set-sky.v1', 'back.shadow-square.v1',
    ]);
    expect(LESSONS.map((item) => item.steps.length)).toEqual([12, 6, 8, 8, 9, 11, 8, 9, 10, 8, 9, 9]);
    expect(JSON.stringify(LESSONS)).not.toMatch(/planned lesson|coming later|future operations|prepared/i);
  });
  it('passes typed runtime validation', () => expect(validateCatalog()).toEqual([]));
  it('opens each lesson on a dated London snapshot without the calculated Sun', () => {
    for (const item of LESSONS) {
      for (const step of item.steps) {
        expect([APRIL, OCTOBER], `${item.id}/${step.id}`).toContain(step.snapshot.epochIso);
        expect(step.snapshot.location).toMatchObject({ label: 'London', lat: 51.5, lng: -0.12 });
        expect(step.snapshot.visibility.artificialAssists).toBe(false);
      }
    }
  });
  it('introduces both faces in the first lesson without claiming a sky setting', () => {
    const foundations = LESSONS[0];
    expect(foundations.title).not.toMatch(/front$/i);
    expect(foundations.steps[0].result).toMatch(/no date or time has been set/i);
    expect(foundations.steps.some((step) => step.snapshot.face === 'back')).toBe(true);
    expect(stepOf('front.foundations.v1', 'move-alidade').demonstration).toMatchObject({ field: 'alidadeRotation', to: 90 });
    expect(foundations.steps.at(-1)?.result).not.toMatch(/noon|July/i);
  });
  it('swaps to Rome’s plate and back to London’s in the local-sky lesson', () => {
    expect(stepOf('front.local-sky.v1', 'compare-plate').snapshot.plateLatitude).toBe(51.5);
    expect(stepOf('front.local-sky.v1', 'compare-plate').demonstration).toEqual({ kind: 'plate', from: 51.5, to: 40.93, durationMs: 700 });
    expect(stepOf('front.local-sky.v1', 'restore-plate').snapshot.plateLatitude).toBe(40.93);
    expect(stepOf('front.local-sky.v1', 'restore-plate').solution?.plateLatitude).toBe(51.5);
  });
  it('moves the rete and rule together only where the Sun must stay under the rule', () => {
    const companions = LESSONS.flatMap((item) => item.steps.map((step) => ({ item, step })))
      .filter(({ step }) => step.demonstration && 'companion' in step.demonstration && step.demonstration.companion)
      .map(({ item, step }) => `${item.id}/${step.id}`);
    expect(companions).toEqual(['solar.events.v1/find-sunrise', 'front.unequal-hours.v1/end-of-hour-three']);
  });
  it('keeps measured heights as given data set on the red scale', () => {
    expect(stepOf('back.measure-altitude.v1', 'physical-sighting').body).toMatch(/never look at it/i);
    expect(stepOf('back.measure-altitude.v1', 'set-alidade').check).toEqual({ kind: 'alidadeAltitude', value: 30, tolerance: 1 });
    expect(stepOf('back.measure-altitude.v1', 'second-altitude').check).toEqual({ kind: 'alidadeAltitude', value: 20, tolerance: 1 });
  });
});

describe('worked values come from the instrument model (SYLLABUS §0–2)', () => {
  it('places the Sun on the two course dates', () => {
    about(SUN_PLACE.april.longitude, 30.425, 0.005);
    about(SUN_PLACE.october.longitude, 210.090, 0.005);
    about(SUN_PLACE.april.raDeg, 28.317, 0.005);
    about(SUN_PLACE.april.decDeg, 11.622, 0.005);
    about(SUN_PLACE.october.raDeg, 207.997, 0.005);
    about(SUN_PLACE.october.decDeg, -11.504, 0.005);
    about(SUN_PLACE.april.equationMinutes, 0.99, 0.01);
    about(SUN_PLACE.october.equationMinutes, 15.78, 0.01);
  });
  it('puts the calendar ticks under the alidade at the Sun’s longitude', () => {
    const tick = (month: number, day: number) => calendarDayTicks().find((item) => item.month === month && item.dayOfMonth === day);
    for (const [place, month, day] of [[SUN_PLACE.april, 3, 20], [SUN_PLACE.october, 9, 23]] as const) {
      const date = tick(month, day);
      expect(date?.longitude).toBeCloseTo(place.longitude, 10);
      expect(alidadeLineCross(backLongitudePoint(456, place.longitude), place.alidade)).toBeCloseTo(0, 10);
    }
  });
  it('finds the Sun points on the rete under the rule', () => {
    for (const place of [SUN_PLACE.april, SUN_PLACE.october]) {
      const point = orientRetePoint(eclipticPoint(place.longitude, 380), 0);
      const rule = place.rule * Math.PI / 180;
      expect(point.x * Math.cos(rule) + point.y * Math.sin(rule)).toBeCloseTo(0, 8);
    }
    about(SUN_PLACE.april.rule, 28.3, 0.05);
    about(SUN_PLACE.october.rule, 208.0, 0.05);
  });
  it('follows Sirius, Regulus, Arcturus and Capella as Lessons 1, 3 and 4 say', () => {
    about(FOUNDATIONS.riseRete, 33.47, 0.01);
    about(FOUNDATIONS.riseAzimuth, 117.52, 0.01);
    about(FOUNDATIONS.riseRule, 67.82, 0.01);
    about(FOUNDATIONS.culminationAltitude, 21.78, 0.01);
    about(LOCAL_SKY.regulus.altitude, 33.17, 0.01);
    about(LOCAL_SKY.regulus.azimuth, 115.07, 0.01);
    about(LOCAL_SKY.siriusOnRome.altitude, 32.35, 0.01);
    about(STAR_PATH.rise.azimuth, 58.14, 0.01);
    about(STAR_PATH.culmination.altitude, 57.68, 0.01);
    about(STAR_PATH.set.azimuth, 301.86, 0.01);
    about(STAR_PATH.capella.altitude, 7.50, 0.01);
    about(STAR_PATH.vegaLowest, 0.28, 0.01);
    expect(STAR_PATH.rise.altitude).toBeCloseTo(0, 8);
    expect(STAR_PATH.set.altitude).toBeCloseTo(0, 8);
    expect(positionAt({ raDeg: 213.915, decDeg: 19.182 }, STAR_PATH.start).altitude).toBeLessThan(0);
  });
  it('tells the time from the Sun’s height: 08:17 and 14:21', () => {
    const { april, october } = TIME_BY_SUN;
    expect(clock(april.time)).toBe('08:17');
    expect(clock(october.time)).toBe('14:21');
    about(april.rete, 332.47); about(april.rule, 55.84); about(april.azimuth, 110.62);
    about(october.rete, 243.26); about(october.rule, 324.74); about(october.azimuth, 217.01);
    about(positionAt(SUN_PLACE.april, april.rete).altitude, 30, 1e-9);
    about(positionAt(SUN_PLACE.october, october.rete).altitude, 20, 1e-9);
    about(TIME_BY_SUN.minutesPerDegreeAt30, 6.87, 0.01);
    about(TIME_BY_SUN.altitudeAt11, 48.30, 0.01);
    about(TIME_BY_SUN.noonAltitude, 50.12, 0.01);
  });
  it('reads the time at the Sun’s end of the rule: the rule end and the Sun point coincide', () => {
    const { april } = TIME_BY_SUN;
    const sun = orientRetePoint(project(SUN_PLACE.april.raDeg, SUN_PLACE.april.decDeg, 1), april.rete);
    const rule = april.rule * Math.PI / 180;
    // The rule's Sun end is along +y rotated by the rule angle.
    expect(Math.atan2(sun.x, sun.y)).toBeCloseTo(Math.atan2(-Math.sin(rule), Math.cos(rule)), 8);
    expect(limbTime(0)).toBeCloseTo(12, 10);
    expect(ruleOver(SUN_PLACE.april, SUN_PLACE.april.raDeg)).toBeCloseTo(0, 8);
  });
  it('finds sunrise, noon and sunset on both dates', () => {
    const { april, october } = SOLAR_EVENTS;
    expect([clock(april.sunrise.time), clock(april.noon.time), clock(april.sunset.time)]).toEqual(['05:00', '12:00', '19:00']);
    expect([clock(october.sunrise.time), clock(october.noon.time), clock(october.sunset.time)]).toEqual(['06:59', '12:00', '17:01']);
    about(april.sunrise.azimuth, 71.12, 0.01); about(april.sunset.azimuth, 288.88, 0.01); about(april.noon.altitude, 50.12, 0.01);
    about(october.sunrise.azimuth, 108.69, 0.01); about(october.sunset.azimuth, 251.32, 0.01); about(october.noon.altitude, 27.00, 0.01);
    about(minutesOf(april.dayHours), 14 * 60, 0.5);
    about(minutesOf(october.dayHours), 10 * 60 + 1.4, 0.5);
    for (const event of [april.sunrise, april.sunset, october.sunrise, october.sunset]) expect(event.altitude).toBeCloseTo(0, 8);
  });
  it('tells the time from a star: 21:06 and 20:26', () => {
    expect(clock(TIME_BY_STAR.april.time)).toBe('21:06');
    expect(clock(TIME_BY_STAR.october.time)).toBe('20:26');
    about(TIME_BY_STAR.april.azimuth, 111.46, 0.01);
    about(TIME_BY_STAR.october.azimuth, 273.85, 0.01);
    about(TIME_BY_STAR.april.sunAltitude, -16.58, 0.01);
    about(TIME_BY_STAR.october.sunAltitude, -31.32, 0.01);
  });
  it('converts sundial time to the watch: 09:16 and 15:06 BST, 15:16 in Bristol', () => {
    expect([clock(CLOCK_TIME.april.mean), clock(CLOCK_TIME.april.zone), clock(CLOCK_TIME.april.summer)]).toEqual(['08:16', '08:16', '09:16']);
    expect([clock(CLOCK_TIME.october.mean), clock(CLOCK_TIME.october.zone), clock(CLOCK_TIME.october.summer)]).toEqual(['14:05', '14:06', '15:06']);
    expect(clock(CLOCK_TIME.bristol.summer)).toBe('15:16');
    about(CLOCK_TIME.april.longitudeMinutes, 0.48, 1e-9);
    about(CLOCK_TIME.bristol.longitudeMinutes, 10.4, 1e-9);
  });
  it('works the watch conversion in whole minutes, so each sum shown gives the answer shown', () => {
    const chain = (w: typeof WATCH.april) => [clock(w.apparent), w.equation, clock(w.mean), w.longitudeWhole, clock(w.zone), clock(w.summer)];
    expect(chain(WATCH.april)).toEqual(['08:17', 1, '08:16', 0, '08:16', '09:16']);
    expect(chain(WATCH.october)).toEqual(['14:21', 16, '14:05', 0, '14:05', '15:05']);
    expect(chain(WATCH.bristol)).toEqual(['14:21', 16, '14:05', 10, '14:15', '15:15']);
    // Within a minute of the unrounded chain.
    for (const [shown, exact] of [[WATCH.april, CLOCK_TIME.april], [WATCH.october, CLOCK_TIME.october], [WATCH.bristol, CLOCK_TIME.bristol]] as const) {
      expect(Math.abs(minutesOf(shown.summer - exact.summer))).toBeLessThan(1);
    }
    const copy = (stepId: string) => { const step = stepOf('back.equation-time.v1', stepId); return step.body + ' ' + step.result; };
    expect(copy('apply-corrections')).toMatch(/08:17 − 1 min = 08:16 local mean time.*still 08:16 GMT.*09:16 BST/);
    expect(copy('second-apply')).toMatch(/14:21 − 16 min = 14:05;.*14:05 GMT; \+ 1 h = 15:05 BST/);
    expect(copy('longitude-drill')).toMatch(/2\.6 × 4 = 10\.4 min, about 10 min\. So 14:05 local mean time \+ 10 min = 14:15 GMT, which is 15:15 BST/);
    about(WATCH.julyEquation, -6.57, 0.01);
    expect(WATCH.table.map((row) => Math.round(row.minutes))).toEqual([-9, -14, -10, -0, 4, -0, -6, -5, 5, 14, 15, 5]);
  });
  it('works the tower heights from the readings as shown', () => {
    expect(stepOf('back.shadow-square.v1', 'calculate-recta').result).toContain('12 × 12 ÷ 6.9 ≈ 20.9 m');
    expect(stepOf('back.shadow-square.v1', 'read-versa').result).toContain('36 × 6.9 ÷ 12 = 20.7 m');
    expect(stepOf('back.shadow-square.v1', 'account-eye-level').result).toMatch(/on average 20\.8 m\. With 1\.6 m eye height the tower is about 22\.4 m tall/);
  });
  it('sets a 35° Sun between the 30° and 40° circles (Lesson 6)', () => {
    about(positionAt(SUN_PLACE.april, TIME_BY_SUN.between.rete).altitude, 35, 1e-9);
    expect(clock(TIME_BY_SUN.between.time)).toBe('08:52');
    expect(TIME_BY_SUN.between.side).toBe('east');
  });
  it('reads the equation of time where the loop crosses the minute arm laid over the date', () => {
    for (const [iso, values] of [[APRIL, CLOCK_TIME.april], [OCTOBER, CLOCK_TIME.october]] as const) {
      const point = equationOfTimePoint(new Date(iso));
      const direction = values.alidade * Math.PI / 180;
      expect(alidadeLineCross(point, values.alidade)).toBeCloseTo(0, 0);
      expect(point.x * Math.cos(direction) - point.y * Math.sin(direction)).toBeGreaterThan(0);
      expect((point.radius - EQUATION_ZERO_RADIUS) / EQUATION_PIXELS_PER_MINUTE).toBeCloseTo(equationOfTime(new Date(iso)), 6);
    }
    about(normalizeDeg(CLOCK_TIME.october.alidade - CLOCK_TIME.april.alidade), 180.3, 0.05);
  });
  it('ends seasonal hours on the engraved lines: 08:30 and 14:30', () => {
    const { april, october } = SEASONAL_HOURS;
    expect(clock(april.time)).toBe('08:30');
    expect(clock(october.time)).toBe('14:30');
    expect(clock(SEASONAL_HOURS.octoberThird)).toBe('09:30');
    about(april.hourMinutes, 70, 0.05); about(october.hourMinutes, 50.1, 0.05);
    about(april.nadirAltitude, -31.93, 0.01); about(april.nadirAzimuth, 293.72, 0.01);
    about(october.nadirAltitude, -19.11, 0.01); about(october.nadirAzimuth, 39.24, 0.01);
    for (const hour of [april, october]) {
      const onLine = unequalHourPoint(51.5, hour.hour, hour.nadir.decDeg, 1);
      const nadir = project(normalizeDeg(hour.rete - hour.nadir.raDeg), hour.nadir.decDeg, 1);
      expect(onLine?.x).toBeCloseTo(nadir.x, 9);
      expect(onLine?.y).toBeCloseTo(nadir.y, 9);
    }
  });
  it('sets the sky for a clock time in whole minutes, as Lesson 9 works: 20:16 and 21:01', () => {
    expect(clock(SET_SKY.october.apparent)).toBe('20:16');
    expect(clock(SET_SKY.april.apparent)).toBe('21:01');
    about(minutesOf(SET_SKY.october.apparent), 20 * 60 + 16, 1e-9);
    about(minutesOf(SET_SKY.april.apparent), 21 * 60 + 1, 1e-9);
    about(SET_SKY.october.rule, 236, 0.01); about(SET_SKY.october.rete, 332.0, 0.01);
    about(SET_SKY.april.rule, 224.75, 0.01); about(SET_SKY.april.rete, 163.57, 0.01);
    about(SET_SKY.october.vega.altitude, 51.6, 0.05); about(SET_SKY.october.vega.azimuth, 271.9, 0.05);
    about(SET_SKY.april.arcturus.altitude, 39.2, 0.05); about(SET_SKY.april.arcturus.azimuth, 110.2, 0.05);
    for (const sky of [SET_SKY.october, SET_SKY.april]) {
      const sun = sky === SET_SKY.october ? SUN_PLACE.october : SUN_PLACE.april;
      expect(ruleOver(sun, sky.rete)).toBeCloseTo(sky.rule, 8);
      expect(limbTime(sky.rule)).toBeCloseTo(sky.apparent, 8);
    }
  });
  it('measures the same tower from two distances with the shadow square', () => {
    expect(SHADOW.corner.edge).toBe('bottom');
    expect(SHADOW.corner.reading).toBeCloseTo(12, 9);
    expect(SHADOW.steep.edge).toBe('bottom');
    expect(['left', 'right']).toContain(SHADOW.low.edge);
    about(SHADOW.steep.reading, 6.93, 0.005);
    about(SHADOW.low.reading, 6.93, 0.005);
    about(SHADOW.steep.height, 20.78, 0.01);
    about(SHADOW.low.height, 20.78, 0.01);
    expect(shadowSquareIntersection(180 - 60)?.edge).toBe('bottom');
  });
});
