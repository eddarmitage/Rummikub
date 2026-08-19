import { defineConfig } from "drizzle-kit";

// This project's migrations are hand-authored SQL files applied via
// `wrangler d1 migrations apply` (see docs/spec.md's Deployment section and
// scripts/bootstrap.sh) — NOT drizzle-kit's own generate/migrate/push workflow.
// migrations/0001_init.sql is the source of truth that src/worker/db/schema.ts
// is written to match; this config exists only so `drizzle-kit check` / `drizzle-kit
// studio` and editor tooling can introspect the schema. `drizzle-kit generate` is
// intentionally not part of this project's workflow — do not run it against
// `migrations/`, and its default output directory below is never populated.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/worker/db/schema.ts",
  out: "./drizzle",
});
