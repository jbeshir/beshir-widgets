// Runs before every test file: brings the local D1 up to the latest committed migration.
import { applyD1Migrations, env } from 'cloudflare:test';

await applyD1Migrations(env.DB, env.MIGRATIONS);
