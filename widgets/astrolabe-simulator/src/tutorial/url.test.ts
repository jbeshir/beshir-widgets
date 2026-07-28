import { describe, expect, it } from 'vitest';
import { LESSONS } from './catalog';
import { composeTutorialSearch, parseTutorialSearch } from './url';

describe('tutorial URL composition', () => {
  it.each(LESSONS.flatMap((lesson) => lesson.steps.map((step) => [lesson, step] as const)))(
    'round trips $0.id / $1.id', (lesson, step) => {
      const search = composeTutorialSearch('?embedded=1', lesson.id, step.id);
      expect(parseTutorialSearch(search)).toMatchObject({ lessonId: lesson.id, stepIndex: lesson.steps.indexOf(step) });
      expect(search).toContain('embedded=1');
    },
  );
  it('preserves hashes by not owning them', () => expect(composeTutorialSearch('?x=1', null)).toBe('?x=1'));
  it('fails soft for unknown lessons', () => expect(parseTutorialSearch('?lesson=missing.v1&step=x&lv=1')).toMatchObject({ lessonId: null, needsRepair: true }));
  it('falls back for unknown steps', () => expect(parseTutorialSearch('?lesson=front.parts.v1&step=missing&lv=1')).toMatchObject({ lessonId: 'front.parts.v1', stepIndex: 0, needsRepair: true }));
  it('rejects unsupported versions', () => expect(parseTutorialSearch('?lesson=front.parts.v1&lv=2').unavailable).toContain('unsupported'));
  it('canonicalizes lesson aliases', () => expect(parseTutorialSearch('?lesson=front.orientation.v1&lv=1')).toMatchObject({ lessonId: 'front.parts.v1', needsRepair: true }));
  it('removes only tutorial fields', () => expect(composeTutorialSearch('?lesson=front.parts.v1&step=x&lv=1&host=yes', null)).toBe('?host=yes'));
});
