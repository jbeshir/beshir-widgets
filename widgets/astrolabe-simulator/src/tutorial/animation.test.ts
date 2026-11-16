import { describe, expect, it } from 'vitest';
import { animateAngle, runDemonstration, shortestDelta, type AnimationScheduler, type DemonstrationPatch } from './animation';

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

  describe('runDemonstration', () => {
    const manual = () => {
      const callbacks: ((time: number) => void)[] = [];
      const scheduler: AnimationScheduler = { now: () => 0, request: (cb) => (callbacks.push(cb), callbacks.length), cancel: () => undefined };
      return { callbacks, scheduler };
    };
    it('performs a face flip: start on the other face, then the end face', async () => {
      const { callbacks, scheduler } = manual();
      const log: [DemonstrationPatch, boolean][] = [];
      const promise = runDemonstration({ kind: 'face', to: 'back', durationMs: 100 }, {
        reducedMotion: false, signal: new AbortController().signal, previousPlate: 51.5, scheduler,
        apply: (patch, final) => log.push([patch, final]),
      });
      expect(log).toEqual([[{ face: 'front' }, false]]);
      callbacks.shift()!(100);
      expect(await promise).toBe('completed');
      expect(log.at(-1)).toEqual([{ face: 'back' }, true]);
    });
    it('performs a plate swap from the previous plate, or from an explicit plate', async () => {
      const { callbacks, scheduler } = manual();
      const log: [DemonstrationPatch, boolean][] = [];
      const promise = runDemonstration({ kind: 'plate', to: 40.93, durationMs: 50 }, {
        reducedMotion: false, signal: new AbortController().signal, previousPlate: 51.5, scheduler,
        apply: (patch, final) => log.push([patch, final]),
      });
      callbacks.shift()!(50);
      await promise;
      expect(log).toEqual([
        [{ plateSelection: 'pinned', plateLatitude: 51.5 }, false],
        [{ plateSelection: 'pinned', plateLatitude: 40.93 }, true],
      ]);
      const explicit: DemonstrationPatch[] = [];
      await runDemonstration({ kind: 'plate', from: 30, to: 40, durationMs: 0 }, {
        reducedMotion: true, signal: new AbortController().signal, previousPlate: 51.5, apply: (patch) => explicit.push(patch),
      });
      expect(explicit[0]).toEqual({ plateSelection: 'pinned', plateLatitude: 30 });
    });
    it.each([
      ['face', { kind: 'face', to: 'back', durationMs: 100 } as const],
      ['plate', { kind: 'plate', to: 40, durationMs: 100 } as const],
    ])('is interrupted by an abort without applying the end state (%s)', async (_name, demo) => {
      const controller = new AbortController();
      const { callbacks, scheduler } = manual();
      const log: boolean[] = [];
      const promise = runDemonstration(demo, {
        reducedMotion: false, signal: controller.signal, previousPlate: 51.5, scheduler, apply: (_patch, final) => log.push(final),
      });
      controller.abort();
      callbacks.shift()?.(100);
      expect(await promise).toBe('aborted');
      expect(log).toEqual([false]);
    });
    it('jumps to the end under reduced motion and keeps angle demonstrations working', async () => {
      const log: [DemonstrationPatch, boolean][] = [];
      const outcome = await runDemonstration({ field: 'reteRotation', from: 10, to: 20, durationMs: 500, companion: { field: 'ruleRotation', from: 1, to: 2 } }, {
        reducedMotion: true, signal: new AbortController().signal, previousPlate: 51.5, apply: (patch, final) => log.push([patch, final]),
      });
      expect(outcome).toBe('completed');
      expect(log.at(-1)).toEqual([{ reteRotation: 20, ruleRotation: 2 }, true]);
      expect(log[0]).toEqual([{ reteRotation: 10, ruleRotation: 1 }, false]);
    });
  });
});
