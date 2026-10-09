import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
// Offline tests run in the workers runtime (workerd) via @cloudflare/vitest-pool-workers, against a
// local Miniflare D1 — no real Cloudflare account or network is involved. The pure heraldry-library
// tests share the same pool. The pool options are passed to the cloudflareTest() plugin
// (vitest-pool-workers v0.16+). The committed migrations are read here and applied to DB by
// test/apply-migrations.ts, so the tests run against exactly the schema production gets.
const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));

export default defineConfig({
  plugins: [
    cloudflareTest({
      singleWorker: true,
      isolatedStorage: false,
      miniflare: {
        compatibilityDate: '2026-06-01',
        // MIGRATION_DB and BASELINE_DB stay empty until test/migrations.test.ts fills them.
        d1Databases: ['DB', 'MIGRATION_DB', 'BASELINE_DB'],
        // No RESEND_API_KEY: sending is skipped unless a test supplies one (and a mocked fetch).
        bindings: {
          MIGRATIONS: migrations,
          EMAIL_HMAC_KEY: 'test-email-hmac-key',
          EMAIL_HMAC_KEY_VERSION: '1',
          MAIL_FROM: 'Heraldry Builder <heraldry@widgets.test>',
        },
        // CREATE_LIMITER must be declared here so miniflare creates the binding; it reads
        // wrangler.jsonc for most things but ratelimits need an explicit entry in WorkerOptions.
        ratelimits: {
          CREATE_LIMITER: { simple: { limit: 10, period: 60 } },
        },
      },
    }),
  ],
  test: {
    include: ['test/*.test.ts'],
    setupFiles: ['test/apply-migrations.ts'],
  },
});
