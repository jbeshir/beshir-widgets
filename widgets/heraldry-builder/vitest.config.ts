import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { LAZY_ART_ALIAS } from './vite.config';
// Four projects, so each kind of test runs in the cheapest runtime that is faithful to it:
//  - workers: the two files that use the D1 binding (test/worker.test.ts, test/migrations.test.ts) run in the workers
//    runtime (workerd) via @cloudflare/vitest-pool-workers, against a local Miniflare D1 — no real Cloudflare account or
//    network is involved. They share one worker (singleWorker) and apply the committed migrations (read here, applied by
//    test/apply-migrations.ts) so they run against exactly the schema production gets. The pool options are passed to the
//    cloudflareTest() plugin (vitest-pool-workers v0.16+).
//  - library: every other test/*.test.ts (the pure heraldry library, store seam, export) needs no Cloudflare global, so it
//    runs in plain Node with the default pool: files in parallel across forks. Files in a fork share module state (isolate:
//    false), so the geometry and layout caches and the imports are paid once per fork, not once per file; the tests hold no
//    state between files (each builds its own designs). The long sweeps (the goldens, geometry-fit's art and other shapes,
//    lines, builder replays, prefilter pairs) check a seeded, rotating sample of their cases on each run (test/rotation.ts),
//    so their time stays flat as art and attributes grow; SCA_FULL=1 runs them in full, `npm run golden:write` writes every key.
//  - sca: the SCA armorial test reads the 21 MB Latin-1 O&A dump from disk, so it runs in plain Node as its own project.
//    It runs the cheap per-record checks on every record and the expensive ones (render and builder replay, gap tagger on ignored
//    records) on a seeded, rotating sample (test/sca/sample.ts), so its time stays flat as records start passing. `npm run
//    sca:ignore` (vitest.sca-ignore.config.ts) is the authoritative full sweep; the final gate runs it. SCA_FULL=1 makes
//    this project do the full sweep too.
//  - lazy-art: test/lazy/*.test.ts read the charge art as the browser build does (vite.config.ts's alias: art/paths/lazy.ts, which loads
//    it a category at a time), each file in a module state of its own (isolated), so the art they load is never seen by another file.
const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
const SCA_TEST = 'test/sca-armorial.test.ts';
const WORKER_TESTS = ['test/worker.test.ts', 'test/migrations.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
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
          name: 'workers',
          include: WORKER_TESTS,
          setupFiles: ['test/apply-migrations.ts'],
        },
      },
      {
        test: {
          name: 'library',
          include: ['test/*.test.ts'],
          exclude: [...WORKER_TESTS, SCA_TEST],
          environment: 'node',
          isolate: false,
        },
      },
      {
        resolve: { alias: [LAZY_ART_ALIAS] },
        test: {
          name: 'lazy-art',
          include: ['test/lazy/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'sca',
          include: [SCA_TEST],
          environment: 'node',
        },
      },
    ],
  },
});
