import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * Applies `migrations/*.sql` to `db` in filename order, tracked in a local bookkeeping table so
 * restarting the container doesn't try to re-run (and fail on) already-applied migrations.
 * Mirrors what `wrangler d1 migrations apply` does for the real D1-backed deployment, just
 * without needing wrangler/D1 present at all.
 */
export function runMigrations(db: DatabaseSync, migrationsDir: string): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _standalone_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    (db.prepare("SELECT name FROM _standalone_migrations").all() as { name: string }[]).map((row) => row.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    db.prepare("INSERT INTO _standalone_migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
  }
}
