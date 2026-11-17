import { describe, expect, it } from 'vitest';
import { LESSONS } from './catalog';
import { composeTutorialSearch, parseTutorialSearch, STEP_ALIASES } from './url';

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
  it('falls back for unknown steps', () => expect(parseTutorialSearch('?lesson=front.foundations.v1&step=missing&lv=1')).toMatchObject({ lessonId: 'front.foundations.v1', stepIndex: 0, needsRepair: true }));
  it('rejects unsupported versions', () => expect(parseTutorialSearch('?lesson=front.foundations.v1&lv=2').unavailable).toContain('unsupported'));
  it('canonicalizes lesson aliases', () => expect(parseTutorialSearch('?lesson=front.orientation.v1&lv=1')).toMatchObject({ lessonId: 'front.foundations.v1', needsRepair: true }));
  it('opens the retired horary-quadrant lesson as the seasonal-hours lesson', () => {
    expect(parseTutorialSearch('?lesson=back.unequal-hours.v1&lv=1')).toMatchObject({ lessonId: 'front.unequal-hours.v1', stepIndex: 0, needsRepair: true, unavailable: '' });
    expect(parseTutorialSearch('?lesson=back.unequal-hours.v1&step=curve-six&lv=1')).toMatchObject({ lessonId: 'front.unequal-hours.v1', stepIndex: 0, needsRepair: true });
  });
  it('follows a moved step to the lesson that now teaches it', () => {
    const parsed = parseTutorialSearch('?lesson=front.set-sky.v1&step=find-date&lv=1');
    expect(parsed).toMatchObject({ lessonId: 'back.sun-place.v1', needsRepair: true, unavailable: '' });
    expect(LESSONS.find((lesson) => lesson.id === 'back.sun-place.v1')?.steps[parsed.stepIndex].id).toBe('date-to-longitude');
    expect(parseTutorialSearch('?lesson=front.set-sky.v1&step=choose-observation&lv=1')).toMatchObject({ lessonId: 'front.set-sky.v1', stepIndex: 0, needsRepair: true });
  });
  it('needs no repair for a lesson link without a step', () => expect(parseTutorialSearch('?lesson=solar.time-by-sun.v1&lv=1')).toMatchObject({ lessonId: 'solar.time-by-sun.v1', stepIndex: 0, needsRepair: false }));
  it('every step alias points at a real step', () => {
    for (const [from, to] of Object.entries(STEP_ALIASES)) {
      const [lessonId, stepId] = to.includes(':') ? to.split(':') : [from.split(':')[0], to];
      expect(LESSONS.find((lesson) => lesson.id === lessonId)?.steps.some((step) => step.id === stepId), from).toBe(true);
    }
  });
  it('removes only tutorial fields', () => expect(composeTutorialSearch('?lesson=front.parts.v1&step=x&lv=1&host=yes', null)).toBe('?host=yes'));
});
