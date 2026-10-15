// `GOLDEN_REASON="…" npm run golden:write` (with the slot golden): rewrites test/fixtures/render-golden.json from the renderer as it is
// now, printing what changed. Run it only for an intended change to how shields are drawn; not part of `npm test`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { approveRewrite, goldenDiff } from './golden';
import { describeRender, goldenRenders, goldenShields } from './render-golden-cases';

it('writes the render golden', { timeout: 120_000 }, () => {
  const file = new URL('./fixtures/render-golden.json', import.meta.url);
  const shields = goldenShields();
  const now = goldenRenders(shields);
  approveRewrite('render golden', goldenDiff(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}, now), describeRender(shields));
  writeFileSync(file, `${JSON.stringify(now, null, 1)}\n`);
});
