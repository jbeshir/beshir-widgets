// `npm run golden:write`: rewrites test/fixtures/slot-golden.json from the layout engine as it is now. Run it only
// for an intended change to where charges are drawn; not part of `npm test`.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { goldenSlots } from './slot-golden-cases';

it('writes the slot golden', { timeout: 60_000 }, () => {
  writeFileSync(new URL('./fixtures/slot-golden.json', import.meta.url), `${JSON.stringify(goldenSlots(), null, 1)}\n`);
});
