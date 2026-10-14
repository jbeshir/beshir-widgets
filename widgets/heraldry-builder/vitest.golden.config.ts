import { defineConfig } from 'vitest/config';
// `npm run golden:write` only: regenerates test/fixtures/slot-golden.json (test/slot-golden-write.ts) in plain
// Node. Kept out of vitest.config.ts so `npm test` never rewrites the fixture.
export default defineConfig({
  test: {
    include: ['test/slot-golden-write.ts'],
    environment: 'node',
  },
});
