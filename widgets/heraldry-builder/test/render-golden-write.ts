// `npm run golden:write` (with the slot golden): rewrites test/fixtures/render-golden.json from the renderer as it is
// now. Run it only for an intended change to how shields are drawn; not part of `npm test`.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { goldenRenders } from './render-golden-cases';

it('writes the render golden', { timeout: 120_000 }, () => {
  writeFileSync(new URL('./fixtures/render-golden.json', import.meta.url), `${JSON.stringify(goldenRenders(), null, 1)}\n`);
});
