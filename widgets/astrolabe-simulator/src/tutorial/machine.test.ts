import { describe, expect, it } from 'vitest';
import { initialTutorialState, tutorialReducer } from './machine';

describe('pure tutorial machine', () => {
  const started = tutorialReducer(initialTutorialState, { type: 'START', lessonId: 'front.parts.v1' });
  it('starts deterministically', () => expect(started).toMatchObject({ phase: 'step', stepIndex: 0 }));
  it('advances but not beyond the final step', () => {
    const next = tutorialReducer(started, { type: 'NEXT', stepCount: 6 });
    expect(next.stepIndex).toBe(1);
    expect(tutorialReducer({ ...next, stepIndex: 5 }, { type: 'NEXT', stepCount: 6 }).stepIndex).toBe(5);
  });
  it('backs but not before zero', () => {
    expect(tutorialReducer(started, { type: 'BACK' })).toBe(started);
    expect(tutorialReducer({ ...started, stepIndex: 2 }, { type: 'BACK' }).stepIndex).toBe(1);
  });
  it('replay creates a fresh operation', () => expect(tutorialReducer(started, { type: 'REPLAY' }).operationId).toBe(started.operationId + 1));
  it('reports failed and passed checks', () => {
    expect(tutorialReducer(started, { type: 'CHECK', passed: false }).message).toContain('Not yet');
    expect(tutorialReducer(started, { type: 'CHECK', passed: true }).message).toContain('passed');
  });
  it('ignores stale completion', () => expect(tutorialReducer(started, { type: 'ANIMATION_DONE', operationId: 999 })).toBe(started));
  it('accepts current completion', () => expect(tutorialReducer(started, { type: 'ANIMATION_DONE', operationId: started.operationId }).message).toContain('in position'));
  it('interrupts and rejects finish outside a step', () => {
    const interrupted = tutorialReducer(started, { type: 'USER_CHANGE' });
    expect(interrupted.phase).toBe('interrupted');
    expect(tutorialReducer(interrupted, { type: 'FINISH' })).toBe(interrupted);
  });
  it('finishes only through FINISH', () => expect(tutorialReducer(started, { type: 'FINISH' }).phase).toBe('complete'));
  it('exits to catalog', () => expect(tutorialReducer(started, { type: 'EXIT' })).toMatchObject({ phase: 'catalog', lessonId: null }));
});
