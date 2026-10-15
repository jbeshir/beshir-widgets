// The layout engine places every level-0 group exactly where it did when the fixture was written.
import { expect, it } from 'vitest';
import golden from './fixtures/slot-golden.json';
import { goldenDiff, goldenReport, sameAsGolden } from './golden';
import { describeSlots, goldenSlots, pinnedSlots } from './slot-golden-cases';

it('draws every context, count, layout and shape where the golden says', { timeout: 60_000 }, () => {
  const pinned = pinnedSlots();
  const diff = goldenDiff(golden, goldenSlots(pinned));
  expect(sameAsGolden(diff), goldenReport(diff, describeSlots(pinned))).toBe(true);
});
