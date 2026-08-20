import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests: run against the real workerd runtime + a real (local,
// in-memory) D1 instance via @cloudflare/vitest-pool-workers — no mocking the
// database (AGENTS.md "Testing conventions"). Migrations are read here in
// Node, then applied inside the worker by tests/integration/apply-migrations.ts
// (workerd can't read the filesystem directly).
export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, "migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      name: "integration",
      include: ["tests/integration/**/*.test.ts"],
      setupFiles: ["./tests/integration/apply-migrations.ts"],
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.test.toml" },
        miniflare: {
          // Test-only binding carrying the parsed migrations into the worker,
          // so the setup file can apply them via `applyD1Migrations()`.
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  };
});
