import { describe, expect, it } from 'vitest';
import { FUTURE_TOPICS, LESSONS, validateCatalog } from './catalog';

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
  it('commits the Sirius textual fixture', () => {
    expect(LESSONS[1].steps.at(-1)?.result).toContain('approximately 24°');
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
});
