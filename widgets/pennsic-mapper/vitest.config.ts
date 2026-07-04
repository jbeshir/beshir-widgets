import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
// Offline Worker/D1 tests run in the workers runtime (workerd) via @cloudflare/vitest-pool-workers,
// against a local Miniflare D1 — no real Cloudflare account or network is involved. The pool options
// are passed to the cloudflareTest() plugin (vitest-pool-workers v0.16+).
export default defineConfig({
  plugins: [
    cloudflareTest({
      singleWorker: true,
      isolatedStorage: false,
      miniflare: {
        compatibilityDate: '2026-06-01',
        d1Databases: ['DB'],
        // CREATE_LIMITER must be declared here so miniflare creates the binding; it reads
        // wrangler.jsonc for most things but ratelimits need an explicit entry in WorkerOptions.
        ratelimits: {
          CREATE_LIMITER: { simple: { limit: 10, period: 60 } },
        },
      },
    }),
  ],
  test: {
    include: ['test/worker.test.ts'],
  },
});
