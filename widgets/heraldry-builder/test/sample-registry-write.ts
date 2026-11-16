// `npm run sample:write`: rewrites src/data/sample-registry.json from its own entries (see
// test/sample-registry.ts), so designs, signatures and blazons follow the library. Runs under vitest
// (vitest.sample.config.ts) because src/ imports are extensionless TypeScript; not part of `npm test`.
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { renderSampleRegistry, type SampleFile } from './sample-registry';

const PATH = new URL('../src/data/sample-registry.json', import.meta.url);

it('writes the sample registry', () => {
  writeFileSync(PATH, renderSampleRegistry(JSON.parse(readFileSync(PATH, 'utf8')) as SampleFile));
});
