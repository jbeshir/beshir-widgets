import { LESSONS } from './catalog';
import type { LessonId } from './types';

const FIELDS = ['lesson', 'step', 'lv'] as const;
export const LESSON_ALIASES: Readonly<Record<string, LessonId>> = {
  'front.orientation.v1': 'front.foundations.v1',
  'front.parts.v1': 'front.foundations.v1',
  'front.align-star.v1': 'front.set-sky.v1',
};
export const STEP_ALIASES: Readonly<Record<string, string>> = {
  'front.set-sky.v1:align-rule': 'set-time',
  'front.set-sky.v1:fixture': 'choose-observation',
  'front.set-sky.v1:rotate-sky': 'set-sky',
  'front.set-sky.v1:move-rule': 'set-time',
  'front.set-sky.v1:read-altitude': 'setting-result',
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
  const lessonId = (LESSON_ALIASES[rawLesson] ?? rawLesson) as LessonId;
  const lesson = LESSONS.find((item) => item.id === lessonId);
  if (!lesson) return { lessonId: null, stepIndex: 0, unavailable: 'That lesson is unavailable.', needsRepair: true };
  const rawStep = params.get('step') ?? lesson.steps[0].id;
  const stepId = STEP_ALIASES[`${lessonId}:${rawStep}`] ?? rawStep;
  const stepIndex = lesson.steps.findIndex((item) => item.id === stepId);
  return {
    lessonId, stepIndex: Math.max(0, stepIndex),
    unavailable: stepIndex < 0 ? 'That step is unavailable; the lesson restarted.' : '',
    needsRepair: rawLesson !== lessonId || stepIndex < 0 || stepId !== rawStep,
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
