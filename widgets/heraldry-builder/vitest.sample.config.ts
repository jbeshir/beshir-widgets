import { defineConfig } from 'vitest/config';
// `npm run sample:write` only: regenerates src/data/sample-registry.json (test/sample-registry-write.ts)
// in plain Node. Kept out of vitest.config.ts so `npm test` never rewrites the sample.
export default defineConfig({
  test: {
    include: ['test/sample-registry-write.ts'],
    environment: 'node',
  },
});
