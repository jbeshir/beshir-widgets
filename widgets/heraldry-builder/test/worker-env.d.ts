// Augments the ambient Cloudflare.Env used by @cloudflare/vitest-pool-workers with this widget's
// bindings, and declares the `?raw` imports used by the tests (schema seeding, fixture byte checks).
// The reference below pulls in the `cloudflare:test` module types (env, runInDurableObject, etc.).
/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CREATE_LIMITER: RateLimit;
  }
}

declare module '*.sql?raw' {
  const contents: string;
  export default contents;
}

declare module '*.json?raw' {
  const contents: string;
  export default contents;
}
