import { defineConfig } from 'vitest/config';
// `npm run sca:ignore` only: regenerates the SCA ignore list (test/sca/update-ignore-list.ts) in
// plain Node. Kept out of vitest.config.ts so `npm test` never rewrites the fixture.
export default defineConfig({
  test: {
    include: ['test/sca/update-ignore-list.ts'],
    environment: 'node',
  },
});
