// The seeded, rotating sample of the expensive per-record SCA checks that `npm test` runs.
//
// builderPath (replaying the builder's clicks, ~40 ms a design on average, from under 1 ms to over half a second) is most of the
// armorial test's cost, and the render check grows with every phase as more records pass. So `npm test` draws and replays a
// bounded sample of the passing designs; the cheap checks (match, assess, blazon) run on every record. The sample is
//   - a fixed stratum: a design is always drawn and replayed when it has a feature (an ordinary, charge, division, line,
//     treatment, tincture, layout…: a token of its signature) that no design asked about before it has — so every feature the
//     widget draws is drawn and replayed at least once, on every run. The armorial test asks shortest blazon first, so this is
//     the simplest design with each feature, the cheapest to replay (in record order the stratum took 2.5 times as long). A
//     charge is a feature only if it is one of the 36 of `STRATUM_CHARGE_IDS` (test/rotation.ts): a charge drawn since is
//     replayed by the rotating stratum, so the fixed one does not grow with the art; and
//   - a rotating stratum: ~DESIGN_SAMPLE designs picked by a hash of (seed, design), the seed being the UTC date (or
//     SCA_SAMPLE_SEED), so different runs check different designs and every design is checked within a few runs.
// The same rotation thins the gap tagger's re-run on the ignored records (the ratchet's "still has the gap it is filed under"),
// with the first record of each gap category always checked.
//
// `npm run sca:ignore` (test/sca/update-ignore-list.ts) never samples: it is the authoritative full sweep over every record, and the
// final gate runs it. SCA_FULL=1 makes `npm test` run the full sweep too.

import { CHARGE_IDS, canonicalJson, signature, type Design } from '../../src/lib/heraldry';
import { STRATUM_CHARGE_IDS, fullSweep, sampleSeed, unit } from '../rotation';
import type { ArmoryRecord } from './oanda';

/** About this many designs are drawn and replayed through the builder by the rotating stratum, however many records pass. */
export const DESIGN_SAMPLE = 20;
/** One in this many ignored records has the gap tagger re-run by the rotating stratum. */
export const TAGGER_RATE = 72;

/** The charges outside the fixed stratum's: not features (their designs are replayed by the rotating stratum). */
const LATER_CHARGES: ReadonlySet<string> = new Set(CHARGE_IDS.filter((id) => !STRATUM_CHARGE_IDS.includes(id)));

/**
 * The features of a design: the tokens of its signature (ordinaries `o.fess`, charges `c.lion`, lines, mods, divisions, layouts, tinctures)
 * but a later charge. A modifier's number is a token of its own (`+of-points*6` is `of-points` and `6`), so a star of every number of
 * points is one feature.
 */
const features = (d: Design): string[] => signature(d).split(/[|:(),{}/+~.>*]/).filter((f) => f !== '' && !LATER_CHARGES.has(f));

export interface Sampler {
  /** Whether to draw this design and replay the builder for it; the answer is fixed for a design on first ask. */
  drawAndBuild(design: Design): boolean;
  /** Whether to re-run the gap tagger for this ignored record; the first record seen of each category is always yes. */
  tagger(record: ArmoryRecord, category: string): boolean;
  /** Counts for the report. */
  stats(): { seed: string; designs: number; fixed: number; rotating: number };
}

/** `designs` is the number of distinct passing designs expected, to scale the rotating stratum (a guess is fine). */
export function createSampler(seed: string, designs: number, full = false): Sampler {
  const rate = Math.min(1, DESIGN_SAMPLE / Math.max(1, designs));
  const decided = new Map<string, boolean>();
  const seen = new Set<string>();
  const categories = new Set<string>();
  let fixed = 0, rotating = 0;
  return {
    drawAndBuild(design) {
      const key = canonicalJson(design);
      let yes = decided.get(key);
      if (yes === undefined) {
        const fresh = features(design).filter((f) => !seen.has(f));
        fresh.forEach((f) => seen.add(f));
        const rotates = unit(`${seed}|${key}`) < rate;
        yes = full || fresh.length > 0 || rotates;
        if (fresh.length > 0) fixed++; else if (rotates) rotating++;
        decided.set(key, yes);
      }
      return yes;
    },
    tagger(record, category) {
      if (full || !categories.has(category)) { categories.add(category); return true; }
      return unit(`${seed}|${record.key}`) * TAGGER_RATE < 1;
    },
    stats: () => ({ seed, designs: decided.size, fixed, rotating }),
  };
}

export { fullSweep, sampleSeed } from '../rotation';
