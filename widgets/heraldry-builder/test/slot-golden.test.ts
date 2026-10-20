// The layout engine places every level-0 group exactly where it did when the fixture was written: the combinations `npm test` works
// out this run (`inSlotSample`, seeded rotation; SCA_FULL=1 for all), each compared only with its own golden entry.
import { expect, it } from 'vitest';
import golden from './fixtures/slot-golden.json';
import { goldenDiff, goldenReport, sameAsGolden, sampledGolden } from './golden';
import { sampleSeed } from './rotation';
import { describeSlots, goldenSlots, inSlotSample, pinnedSlots } from './slot-golden-cases';

it('draws every context, count, layout and shape where the golden says', { timeout: 60_000 }, () => {
  const pinned = pinnedSlots(inSlotSample);
  const diff = goldenDiff(sampledGolden(golden, inSlotSample), goldenSlots(pinned));
  expect(sameAsGolden(diff), `sample seed ${sampleSeed()}\n${goldenReport(diff, describeSlots(pinned))}`).toBe(true);
});
