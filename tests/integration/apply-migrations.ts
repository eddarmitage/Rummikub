import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Setup files run inside the worker, outside per-test storage isolation, and
// may run more than once — applyD1Migrations() only applies migrations that
// haven't already been applied, so this is safe to call here. TEST_MIGRATIONS
// is a test-only binding set in vitest.integration.config.ts (workerd can't
// read migrations/ off disk itself, so they're read in Node and passed in).
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(env.DB, TEST_MIGRATIONS);
