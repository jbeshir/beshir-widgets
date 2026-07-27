import { describe, expect, it } from 'vitest';
import { project } from '../geometry';
import { FUTURE_TOPICS, LESSONS, SIRIUS_FIXTURE, validateCatalog } from './catalog';

describe('tutorial catalog', () => {
  it('has exactly the three enabled permanent IDs', () => {
    expect(LESSONS.map((lesson) => lesson.id)).toEqual([
      'front.parts.v1', 'front.align-star.v1', 'back.unequal-hours.v1',
    ]);
  });
  it('has the required step depths', () => expect(LESSONS.map((lesson) => lesson.steps.length)).toEqual([6, 8, 9]));
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
    const rete = SIRIUS_FIXTURE.reteRotation * Math.PI / 180;
    const transformed = {
      x: star.x * Math.cos(rete) - star.y * Math.sin(rete),
      y: star.x * Math.sin(rete) + star.y * Math.cos(rete),
    };
    const rule = SIRIUS_FIXTURE.ruleRotation * Math.PI / 180;
    expect(transformed.x * Math.cos(rule) + transformed.y * Math.sin(rule)).toBeCloseTo(0, 8);
    expect(SIRIUS_FIXTURE.altitude).toBeCloseTo(21.1142782184, 8);
    expect(LESSONS[1].steps.at(-1)?.result).toContain('approximately 21°');
  });
  it('commits the unequal-hour fixture and approximation', () => {
    const copy = LESSONS[2].steps.map((step) => `${step.body} ${step.result}`).join(' ');
    expect(copy).toContain('70°');
    expect(copy).toContain('27.5°');
    expect(copy).toMatch(/approximate/i);
    expect(copy).toContain('hour X');
  });
  it('categorizes all future work and names prerequisites', () => {
    expect(new Set(FUTURE_TOPICS.map((topic) => topic.category))).toEqual(new Set([
      'Setup and construction', 'Front astronomy', 'Back calculations', 'Assessment and tools',
    ]));
    for (const topic of FUTURE_TOPICS) expect(topic.prerequisite).toMatch(/^Needs /);
  });
  it('gives every enabled lesson a real scripted instrument demonstration', () => {
    for (const lesson of LESSONS) {
      expect(lesson.steps.some((item) => item.demonstration)).toBe(true);
    }
  });
});
