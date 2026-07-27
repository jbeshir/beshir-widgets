import { normalizeDeg } from '../astro';
import { circularDistance } from './checkpoints';

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
