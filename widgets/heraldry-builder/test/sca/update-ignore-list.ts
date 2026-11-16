// `npm run sca:ignore`: rewrites test/fixtures/sca/ignored.json from the current tooling. It runs
// under vitest (vitest.sca-ignore.config.ts) rather than plain node, because the tooling imports
// src/, whose imports are extensionless TypeScript; it is not part of `npm test`.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { classify, failureLines, listing } from './classify';
import { IGNORED_PATH, buildIgnoreList, serialiseIgnoreList } from './ignore-list';
import { readCurrentArmory } from './oanda';

it('writes the ignore list', () => {
  const entries: { key: string; tags: string[] }[] = [];
  const bugs: string[] = [];
  for (const record of readCurrentArmory()) {
    const c = classify(record);
    if (c.status === 'gap') entries.push({ key: record.key, tags: c.tags });
    if (c.status === 'fails') bugs.push(...failureLines(record, c.failures));
  }
  // A registrable design the widget can't blazon, draw or build is a bug to fix, not a gap to ignore.
  if (bugs.length) throw new Error(listing('Widget failures (fix these; they are never ignored)', bugs));
  writeFileSync(IGNORED_PATH, serialiseIgnoreList(buildIgnoreList(entries)));
}, 120_000);
