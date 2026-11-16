/**
 * What the layout needs to know about the open lesson step: whether a lesson
 * is active (the settings fold away, the instrument and actions stay in view),
 * the parts the step wants framed by Magnify (empty: its highlights), the
 * solution of a your-turn step, and whether the step's highlights have settled (a demonstration is not running).
 */
import { useEffect, useState } from 'preact/hooks';
import type { FrameRef } from './tutorial/parts';
import type { Snapshot } from './tutorial/types';

export interface LessonUi {
  active: boolean;
  stepKey: string;
  /** `LessonStep.frame`; empty when the step has none. */
  frame: readonly FrameRef[];
  hasHighlights: boolean;
  settled: boolean;
  /** Your-turn steps: the state the learner is asked to reach (the tool they turn must stay in view up to there). */
  solution: Partial<Snapshot> | null;
}

export const NO_FRAME: readonly FrameRef[] = [];
const IDLE: LessonUi = { active: false, stepKey: '', frame: NO_FRAME, hasHighlights: false, settled: true, solution: null };
let current = IDLE;
const listeners = new Set<(ui: LessonUi) => void>();

export function setLessonUi(next: LessonUi): void {
  if (Object.keys(next).every((key) => next[key as keyof LessonUi] === current[key as keyof LessonUi])) return;
  current = next;
  for (const listener of listeners) listener(current);
}

export const idleLessonUi = (): LessonUi => IDLE;

export function useLessonUi(): LessonUi {
  const [ui, setUi] = useState(current);
  useEffect(() => {
    listeners.add(setUi);
    setUi(current);
    return () => { listeners.delete(setUi); };
  }, []);
  return ui;
}
