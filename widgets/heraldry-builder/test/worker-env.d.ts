// Augments the ambient Cloudflare.Env used by @cloudflare/vitest-pool-workers with this widget's
// bindings, and declares the `?raw` imports used by the tests (schema seeding, fixture byte checks).
// The reference below pulls in the `cloudflare:test` module types (env, runInDurableObject, etc.).
/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    CREATE_LIMITER: RateLimit;
    EMAIL_HMAC_KEY: string;
    EMAIL_HMAC_KEY_VERSION: string;
    MAIL_FROM: string;
    RESEND_API_KEY?: string;
    MIGRATION_DB: D1Database;
    BASELINE_DB: D1Database;
    MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

declare module '*.sql?raw' {
  const contents: string;
  export default contents;
}

declare module '*.md?raw' {
  const contents: string;
  export default contents;
}

declare module '*.json?raw' {
  const contents: string;
  export default contents;
}
