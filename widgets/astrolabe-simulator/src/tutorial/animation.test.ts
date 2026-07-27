import { describe, expect, it } from 'vitest';
import { animateAngle, shortestDelta, type AnimationScheduler } from './animation';

describe('deterministic angle animation', () => {
  it.each([
    [350, 10, 20], [10, 350, -20], [0, 180, 180], [180, 0, 180], [45, 46, 1],
  ])('uses shortest path %s to %s', (from, to, delta) => expect(shortestDelta(from, to)).toBe(delta));
  it('has reduced-motion endpoint equivalence', async () => {
    const values: number[] = [];
    const result = await animateAngle({ from: 350, to: 10, durationMs: 500, reducedMotion: true, signal: new AbortController().signal, update: (v) => values.push(v) });
    expect(result).toBe('completed');
    expect(values).toEqual([350, 10]);
  });
  it('honors an already aborted signal', async () => {
    const controller = new AbortController(); controller.abort();
    const values: number[] = [];
    expect(await animateAngle({ from: 1, to: 2, durationMs: 1, reducedMotion: false, signal: controller.signal, update: (v) => values.push(v) })).toBe('aborted');
    expect(values).toEqual([1]);
  });
  it('uses exact start, midpoint and endpoint', async () => {
    const callbacks: ((time: number) => void)[] = [];
    const scheduler: AnimationScheduler = { now: () => 0, request: (cb) => (callbacks.push(cb), callbacks.length), cancel: () => undefined };
    const values: number[] = [];
    const promise = animateAngle({ from: 350, to: 10, durationMs: 100, reducedMotion: false, signal: new AbortController().signal, scheduler, update: (v) => values.push(v) });
    callbacks.shift()!(50); callbacks.shift()!(100);
    expect(await promise).toBe('completed');
    expect(values).toEqual([350, 0, 10]);
  });
});
