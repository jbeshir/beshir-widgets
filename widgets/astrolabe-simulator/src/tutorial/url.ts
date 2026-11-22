import { LESSONS } from './catalog';
import type { LessonId } from './types';

const FIELDS = ['lesson', 'step', 'lv'] as const;
export const LESSON_ALIASES: Readonly<Record<string, LessonId>> = {
  'front.orientation.v1': 'front.foundations.v1',
  'front.parts.v1': 'front.foundations.v1',
  'front.align-star.v1': 'front.set-sky.v1',
  // The double-horary-quadrant lesson is deferred (SYLLABUS §3.2); old links open the front seasonal-hours lesson.
  'back.unequal-hours.v1': 'front.unequal-hours.v1',
};
/**
 * Old step ids whose meaning survives. A value is a step id in the same
 * lesson, or `lessonId:stepId` when the step now lives in another lesson.
 */
export const STEP_ALIASES: Readonly<Record<string, string>> = {
  'front.set-sky.v1:align-rule': 'set-time',
  'front.set-sky.v1:fixture': 'reverse-problem',
  'front.set-sky.v1:choose-observation': 'reverse-problem',
  'front.set-sky.v1:rotate-sky': 'set-sky',
  'front.set-sky.v1:move-rule': 'set-time',
  'front.set-sky.v1:read-altitude': 'setting-result',
  'front.set-sky.v1:find-date': 'back.sun-place.v1:date-to-longitude',
  'front.set-sky.v1:read-sun-longitude': 'back.sun-place.v1:read-longitude',
  'front.set-sky.v1:find-sun-point': 'back.sun-place.v1:find-sun-point',
  'front.foundations.v1:return-rete': 'your-turn-front',
  'front.foundations.v1:choose-plate': 'front.local-sky.v1:compare-plate',
  'front.foundations.v1:compare-mismatch': 'front.local-sky.v1:compare-plate',
  'front.foundations.v1:restore-plate': 'front.local-sky.v1:restore-plate',
  'front.read-star.v1:find-sirius': 'front.local-sky.v1:read-sirius',
  'front.read-star.v1:read-position': 'front.local-sky.v1:read-sirius',
  'front.read-star.v1:interpret-position': 'front.local-sky.v1:local-sky-result',
};

export interface TutorialLocation {
  lessonId: LessonId | null;
  stepIndex: number;
  unavailable: string;
  needsRepair: boolean;
}
export function parseTutorialSearch(search: string): TutorialLocation {
  const params = new URLSearchParams(search);
  const rawLesson = params.get('lesson');
  if (!rawLesson) return { lessonId: null, stepIndex: 0, unavailable: '', needsRepair: false };
  if (params.get('lv') !== '1') return { lessonId: null, stepIndex: 0, unavailable: 'This lesson link uses an unsupported version.', needsRepair: true };
  const aliasedLesson = (LESSON_ALIASES[rawLesson] ?? rawLesson) as LessonId;
  const rawStep = params.get('step');
  const alias = rawStep ? STEP_ALIASES[`${aliasedLesson}:${rawStep}`] : undefined;
  const [lessonId, aliasedStep] = alias?.includes(':') ? alias.split(':') as [LessonId, string] : [aliasedLesson, alias];
  const lesson = LESSONS.find((item) => item.id === lessonId);
  if (!lesson) return { lessonId: null, stepIndex: 0, unavailable: 'That lesson is unavailable.', needsRepair: true };
  const stepId = aliasedStep ?? rawStep ?? lesson.steps[0].id;
  const stepIndex = lesson.steps.findIndex((item) => item.id === stepId);
  return {
    lessonId, stepIndex: Math.max(0, stepIndex),
    unavailable: stepIndex < 0 ? 'That step is unavailable; the lesson restarted.' : '',
    needsRepair: rawLesson !== lessonId || stepIndex < 0 || (rawStep !== null && stepId !== rawStep),
  };
}
export function composeTutorialSearch(currentSearch: string, lessonId: LessonId | null, stepId?: string): string {
  const params = new URLSearchParams(currentSearch);
  for (const field of FIELDS) params.delete(field);
  if (lessonId) {
    params.set('lesson', lessonId);
    if (stepId) params.set('step', stepId);
    params.set('lv', '1');
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
