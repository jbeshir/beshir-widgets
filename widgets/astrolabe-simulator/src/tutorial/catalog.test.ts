import { describe, expect, it } from 'vitest';
import { eclipticPoint, orientRetePoint, project } from '../geometry';
import { alidadeLineCross, backLongitudePoint } from '../backGeometry';
import { FUTURE_TOPICS, LESSONS, SIRIUS_FIXTURE, SIRIUS_PATH_FIXTURE, SUN_FIXTURE, validateCatalog } from './catalog';

describe('tutorial catalog', () => {
  it('has exactly the four enabled permanent IDs', () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual([
      'front.foundations.v1', 'front.set-sky.v1', 'front.read-star.v1', 'back.unequal-hours.v1',
    ]);
  });
  it('keeps each foundational lesson substantial', () => {
    expect(LESSONS.slice(0, 3).map((lesson) => lesson.steps.length)).toEqual([9, 7, 8]);
    for (const lesson of LESSONS.slice(0, 3)) expect(lesson.steps.some((step) => step.check)).toBe(true);
  });
  it('demonstrates latitude mismatch and returns to the exact plate', () => {
    const foundations = LESSONS[0];
    expect(foundations.steps.find((step) => step.id === 'choose-plate')?.snapshot.plateLatitude).toBe(51.5);
    expect(foundations.steps.find((step) => step.id === 'compare-mismatch')?.snapshot.plateLatitude).toBe(50);
    expect(foundations.steps.find((step) => step.id === 'compare-mismatch')?.target).toBe('setup.plate-mismatch');
    expect(foundations.steps.find((step) => step.id === 'restore-plate')?.snapshot.plateLatitude).toBe(51.5);
  });
  it('passes typed runtime validation', () => expect(validateCatalog()).toEqual([]));
  it.each(LESSONS)('$id has canonical results on every step', (lesson) => {
    for (const step of lesson.steps) {
      expect(step.snapshot.epochIso).toBe('2026-07-14T12:00:00.000Z');
      expect(step.result.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(step.snapshot.plateLatitude)).toBe(true);
    }
  });
  it('derives a Sirius fixture whose rule, rete, and altitude agree', () => {
    const star = project(SIRIUS_FIXTURE.star.raDeg, SIRIUS_FIXTURE.star.decDeg, 380);
    const transformed = orientRetePoint(star, SIRIUS_FIXTURE.reteRotation);
    const rule = SIRIUS_FIXTURE.ruleRotation * Math.PI / 180;
    expect(transformed.x * Math.cos(rule) + transformed.y * Math.sin(rule)).toBeCloseTo(0, 8);
    expect(SIRIUS_FIXTURE.altitude).toBeCloseTo(21.1142782184, 8);
    expect(LESSONS[2].steps.find((step) => step.id === 'read-position')?.result)
      .toContain(`approximately ${SIRIUS_FIXTURE.altitude.toFixed(1)}°`);
  });
  it('sets the sky by aligning the dated Sun point with the time rule', () => {
    const sun = eclipticPoint(SUN_FIXTURE.eclipticLongitude, 380);
    const transformed = orientRetePoint(sun, SUN_FIXTURE.reteRotation);
    const rule = SUN_FIXTURE.ruleRotation * Math.PI / 180;
    expect(transformed.x * Math.cos(rule) + transformed.y * Math.sin(rule)).toBeCloseTo(0, 8);
    const lessonCopy = LESSONS[1].steps.map((item) => `${item.title} ${item.body}`).join(' ');
    expect(lessonCopy).not.toMatch(/prepared/i);
    expect(lessonCopy).not.toMatch(/Sun marker|Sirius pointer|pointer shows/i);
    expect(lessonCopy).toMatch(/calendar.+ecliptic longitude.+rule.+rotate the rete/is);
    expect(lessonCopy).toMatch(/inner edge.+across the zodiac-sign band.+outer side/is);
    expect(LESSONS[1].steps.every((step) => !step.snapshot.visibility.artificialAssists)).toBe(true);
  });
  it('does not use the confusing prepared terminology anywhere in the curriculum', () => {
    expect(JSON.stringify({ lessons: LESSONS, future: FUTURE_TOPICS })).not.toMatch(/prepared/i);
  });
  it('follows Sirius from the eastern horizon through culmination to the western horizon', () => {
    expect(SIRIUS_PATH_FIXTURE.rising.altitude).toBeCloseTo(0, 8);
    expect(SIRIUS_PATH_FIXTURE.setting.altitude).toBeCloseTo(0, 8);
    expect(SIRIUS_PATH_FIXTURE.rising.azimuth).toBeLessThan(180);
    expect(SIRIUS_PATH_FIXTURE.setting.azimuth).toBeGreaterThan(180);
    expect(SIRIUS_PATH_FIXTURE.culmination.azimuth).toBeCloseTo(180, 8);
    expect(SIRIUS_PATH_FIXTURE.culmination.altitude).toBeGreaterThan(SIRIUS_FIXTURE.altitude);
  });
  it.each(Object.entries(SIRIUS_PATH_FIXTURE))('keeps the July 14 longitude under the rule at %s', (_name, event) => {
    const sun = eclipticPoint(SUN_FIXTURE.eclipticLongitude, 380);
    const transformed = orientRetePoint(sun, event.reteRotation);
    const rule = event.ruleRotation * Math.PI / 180;
    expect(transformed.x * Math.cos(rule) + transformed.y * Math.sin(rule)).toBeCloseTo(0, 8);
  });
  it('aligns the lesson alidade with the dated back-scale radial', () => {
    const datePoint = backLongitudePoint(456, SUN_FIXTURE.eclipticLongitude);
    const longitudePoint = backLongitudePoint(590, SUN_FIXTURE.eclipticLongitude);
    expect(alidadeLineCross(datePoint, SUN_FIXTURE.alidadeRotation)).toBeCloseTo(0, 10);
    expect(alidadeLineCross(longitudePoint, SUN_FIXTURE.alidadeRotation)).toBeCloseTo(0, 10);
    const findDate = LESSONS[1].steps.find((step) => step.id === 'find-date');
    expect(findDate?.snapshot.alidadeRotation).toBe(SUN_FIXTURE.alidadeRotation);
    expect(findDate?.check).toMatchObject({
      kind: 'angleNear',
      field: 'alidadeRotation',
      value: SUN_FIXTURE.alidadeRotation,
    });
  });
  it('commits the unequal-hour fixture and approximation', () => {
    const copy = LESSONS[3].steps.map((step) => `${step.body} ${step.result}`).join(' ');
    expect(copy).toContain('70°');
    expect(copy).toContain('27.5°');
    expect(copy).toMatch(/approximate/i);
    expect(copy).toContain('hour X');
  });
  it('categorizes all future work and names prerequisites', () => {
    expect(new Set(FUTURE_TOPICS.map((topic) => topic.category))).toEqual(new Set([
      'Solar operations', 'Back operations',
    ]));
    expect(FUTURE_TOPICS.map((topic) => topic.title)).toEqual([
      'Determine sunrise, noon, and sunset',
      'Read unequal hours on the front',
      'Measure altitude with the alidade',
      'Use the equation-of-time loop',
      'Measure height with the shadow square',
    ]);
    for (const topic of FUTURE_TOPICS) expect(topic.prerequisite).toMatch(/^Planned[: ]/);
  });
  it('gives every enabled lesson a real scripted instrument demonstration', () => {
    for (const lesson of LESSONS) {
      expect(lesson.steps.some((item) => item.demonstration)).toBe(true);
    }
  });
  it('requires a checkpoint after every demonstrated manipulation', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps.filter((item) => item.demonstration)) {
        expect(step.check, `${lesson.id}/${step.id}`).toBeDefined();
        expect(step.check?.kind).toBe('angleNear');
        if (step.demonstration && step.check?.kind === 'angleNear') {
          expect(step.check.field).toBe(step.demonstration.field);
          expect(step.check.value).toBe(step.demonstration.to);
        }
      }
    }
  });
});
