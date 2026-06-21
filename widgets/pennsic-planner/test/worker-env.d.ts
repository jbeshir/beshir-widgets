// Types for the Worker test environment. The `cloudflare:test` module's types ship with
// @cloudflare/vitest-pool-workers under its /types entry, where the test `env` is typed as
// Cloudflare.Env. We augment that namespace with the bindings the tests use, and declare the `?raw`
// import vite uses to load schema.sql as a string inside the worker runtime.
/// <reference types="@cloudflare/vitest-pool-workers/types" />
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CREATE_LIMITER: RateLimit;
  }
}
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
