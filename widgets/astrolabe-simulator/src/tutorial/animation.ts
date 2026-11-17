import { normalizeDeg } from '../astro';
import type { AstrolabeState } from '../store';
import { circularDistance } from './checkpoints';
import type { Demonstration, RotationField } from './types';

export function shortestDelta(from: number, to: number): number {
  const distance = circularDistance(to, from);
  const clockwise = normalizeDeg(to - from);
  return clockwise <= 180 ? distance : -distance;
}

export interface AnimationScheduler {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}
const browserScheduler: AnimationScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

export function animateAngle(options: {
  from: number; to: number; durationMs: number; reducedMotion: boolean;
  signal: AbortSignal; update(value: number): void; scheduler?: AnimationScheduler;
}): Promise<'completed' | 'aborted'> {
  const scheduler = options.scheduler ?? browserScheduler;
  options.update(normalizeDeg(options.from));
  if (options.signal.aborted) return Promise.resolve('aborted');
  if (options.reducedMotion || options.durationMs <= 0) {
    options.update(normalizeDeg(options.to));
    return Promise.resolve('completed');
  }
  const start = scheduler.now();
  const delta = shortestDelta(options.from, options.to);
  return new Promise((resolve) => {
    let requestId = 0;
    const abort = () => { scheduler.cancel(requestId); resolve('aborted'); };
    options.signal.addEventListener('abort', abort, { once: true });
    const frame = (time: number) => {
      if (options.signal.aborted) return;
      const progress = Math.min(1, Math.max(0, (time - start) / options.durationMs));
      const eased = progress * progress * (3 - 2 * progress);
      options.update(progress === 1 ? normalizeDeg(options.to) : normalizeDeg(options.from + delta * eased));
      if (progress === 1) {
        options.signal.removeEventListener('abort', abort);
        resolve('completed');
      } else requestId = scheduler.request(frame);
    };
    requestId = scheduler.request(frame);
  });
}

/** Waits `durationMs` on the scheduler's clock; aborts with the signal. Reduced motion skips the wait. */
export function pause(options: {
  durationMs: number; reducedMotion: boolean; signal: AbortSignal; scheduler?: AnimationScheduler;
}): Promise<'completed' | 'aborted'> {
  return animateAngle({ ...options, from: 0, to: 0, update: () => undefined });
}

export type DemonstrationPatch = Partial<Pick<AstrolabeState,
  'face' | 'plateSelection' | 'plateLatitude' | RotationField>>;

/**
 * Performs a demonstration through `apply`. `final` is true for the closing
 * patch that holds the step's end state. Every kind is interruptible by
 * `signal`; an aborted run applies nothing further. Reduced motion jumps
 * straight to the end state.
 */
export async function runDemonstration(demo: Demonstration, options: {
  reducedMotion: boolean; signal: AbortSignal; apply(patch: DemonstrationPatch, final: boolean): void;
  /** Plate shown before the step opened; the start of a plate demonstration without `from`. */
  previousPlate: number; scheduler?: AnimationScheduler;
}): Promise<'completed' | 'aborted'> {
  const { reducedMotion, signal, apply, scheduler } = options;
  if (demo.kind === 'face' || demo.kind === 'plate') {
    apply(demo.kind === 'face'
      ? { face: demo.to === 'front' ? 'back' : 'front' }
      : { plateSelection: 'pinned', plateLatitude: demo.from ?? options.previousPlate }, false);
    const outcome = await pause({ durationMs: demo.durationMs, reducedMotion, signal, scheduler });
    if (outcome === 'aborted' || signal.aborted) return 'aborted';
    apply(demo.kind === 'face' ? { face: demo.to } : { plateSelection: 'pinned', plateLatitude: demo.to }, true);
    return 'completed';
  }
  const motions = [demo, ...(demo.companion ? [demo.companion] : [])];
  apply(Object.fromEntries(motions.map((motion) => [motion.field, motion.from])), false);
  const outcomes = await Promise.all(motions.map((motion) => animateAngle({
    from: motion.from, to: motion.to, durationMs: demo.durationMs, reducedMotion, signal, scheduler,
    update: (value) => apply({ [motion.field]: value }, false),
  })));
  if (outcomes.includes('aborted') || signal.aborted) return 'aborted';
  apply(Object.fromEntries(motions.map((motion) => [motion.field, motion.to])), true);
  return 'completed';
}
