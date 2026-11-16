// The seed and the hash behind the seeded, rotating samples of the long sweeps in `npm test` (test/sca/sample.ts for the SCA
// armorial test; test/geometry-fit.test.ts). Free of Node imports so the SPA's tsconfig can compile it.

const env = (): Record<string, string | undefined> => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/** The rotation key: SCA_SAMPLE_SEED, else the UTC date, so a run on another day samples other items. */
export const sampleSeed = (): string => env().SCA_SAMPLE_SEED || new Date().toISOString().slice(0, 10);
/** SCA_FULL=1: run every sweep in full, sampled or not (what `npm run sca:ignore` always does for the SCA records). */
export const fullSweep = (): boolean => env().SCA_FULL === '1';

/** FNV-1a, uniform enough to split by: a number in [0, 1). */
export function unit(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h / 2 ** 32;
}

/** Whether a seeded rotating sample of the given rate includes `item` (any stable text) this run; always true in a full sweep. */
export const rotatesIn = (item: string, rate: number, seed = sampleSeed()): boolean => fullSweep() || unit(`${seed}|${item}`) < rate;
