// `npm run sca:ignore`: rewrites test/fixtures/sca/ignored.json from the current tooling. It runs
// under vitest (vitest.sca-ignore.config.ts) rather than plain node, because the tooling imports
// src/, whose imports are extensionless TypeScript; it is not part of `npm test`.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { classify, failureLines, listing } from './classify';
import { IGNORED_PATH, buildIgnoreList, serialiseIgnoreList } from './ignore-list';
import { readCurrentArmory } from './oanda';

// The authoritative full sweep: classify() without sampling options runs every check on every record (`npm test` samples; sample.ts).
// Its time grows with the passing records (each replays the builder), hence the long timeout: measured 214 s per run at 9,945 passing records
// (D15) and 225–230 s at 10,125 (D16a), so 600 s leaves room for the records still to come.
it('writes the ignore list', () => {
  const entries: { key: string; tags: string[] }[] = [];
  const bugs: string[] = [];
  for (const record of readCurrentArmory()) {
    const c = classify(record);
    switch (c.status) {
      case 'passes': break;
      case 'gap': entries.push({ key: record.key, tags: c.tags }); break;
      case 'fails': bugs.push(...failureLines(record, c.failures)); break;
      case 'gap-unchecked': throw new Error(`${record.key}: the full sweep skipped the gap tagger`);
      default: throw new Error(c.status satisfies never);
    }
  }
  // A registrable design the widget can't blazon, draw or build is a bug to fix, not a gap to ignore.
  if (bugs.length) throw new Error(listing('Widget failures (fix these; they are never ignored)', bugs));
  writeFileSync(IGNORED_PATH, serialiseIgnoreList(buildIgnoreList(entries)));
}, 600_000);
