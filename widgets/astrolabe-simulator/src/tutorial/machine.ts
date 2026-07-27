import type { LessonId } from './types';

export type Phase = 'catalog' | 'step' | 'checking' | 'interrupted' | 'complete';
export interface TutorialState {
  phase: Phase;
  lessonId: LessonId | null;
  stepIndex: number;
  operationId: number;
  message: string;
}
export type TutorialEvent =
  | { type: 'START'; lessonId: LessonId }
  | { type: 'NEXT'; stepCount: number }
  | { type: 'BACK' } | { type: 'REPLAY' } | { type: 'CHECK'; passed: boolean }
  | { type: 'ANIMATION_DONE'; operationId: number }
  | { type: 'ANIMATION_ABORTED'; operationId: number }
  | { type: 'USER_CHANGE' } | { type: 'FINISH' } | { type: 'EXIT' };

export const initialTutorialState: TutorialState = {
  phase: 'catalog', lessonId: null, stepIndex: 0, operationId: 0, message: '',
};

export function tutorialReducer(state: TutorialState, event: TutorialEvent): TutorialState {
  switch (event.type) {
    case 'START': return { phase: 'step', lessonId: event.lessonId, stepIndex: 0, operationId: state.operationId + 1, message: '' };
    case 'NEXT':
      if (state.phase !== 'step' || state.stepIndex >= event.stepCount - 1) return state;
      return { ...state, stepIndex: state.stepIndex + 1, operationId: state.operationId + 1, message: '' };
    case 'BACK':
      if (state.phase !== 'step' || state.stepIndex === 0) return state;
      return { ...state, stepIndex: state.stepIndex - 1, operationId: state.operationId + 1, message: '' };
    case 'REPLAY':
      return state.phase === 'step' ? { ...state, operationId: state.operationId + 1, message: '' } : state;
    case 'CHECK':
      if (state.phase !== 'step') return state;
      return event.passed ? { ...state, message: 'Checkpoint passed.' } : { ...state, message: 'Not yet. Adjust the named control and check again.' };
    case 'ANIMATION_DONE':
      return state.phase === 'step' && event.operationId === state.operationId ? { ...state, message: 'Demonstration settled at the exact endpoint.' } : state;
    case 'ANIMATION_ABORTED':
      return event.operationId === state.operationId ? { ...state, phase: 'interrupted', message: 'Demonstration interrupted by a simulator change.' } : state;
    case 'USER_CHANGE':
      return state.phase === 'step' ? { ...state, phase: 'interrupted', operationId: state.operationId + 1, message: 'You interrupted the demonstration.' } : state;
    case 'FINISH':
      return state.phase === 'step' ? { ...state, phase: 'complete', message: 'Lesson complete.' } : state;
    case 'EXIT': return { ...initialTutorialState, operationId: state.operationId + 1 };
  }
}
