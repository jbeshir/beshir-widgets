// `GOLDEN_REASON="…" npm run golden:write`: rewrites test/fixtures/slot-golden.json from the layout engine as it is now, printing what
// changed. Run it only for an intended change to where charges are drawn; not part of `npm test`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { approveRewrite, goldenDiff } from './golden';
import { describeSlots, goldenSlots, pinnedSlots } from './slot-golden-cases';

it('writes the slot golden', { timeout: 60_000 }, () => {
  const file = new URL('./fixtures/slot-golden.json', import.meta.url);
  const pinned = pinnedSlots();
  const now = goldenSlots(pinned);
  approveRewrite('slot golden', goldenDiff(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}, now), describeSlots(pinned));
  writeFileSync(file, `${JSON.stringify(now, null, 1)}\n`);
});
