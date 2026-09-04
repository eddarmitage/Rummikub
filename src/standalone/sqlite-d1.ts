import type { DatabaseSync, SQLInputValue } from "node:sqlite";

/**
 * Minimal `D1Database` shim backed by `node:sqlite`, so the standalone Docker harness can run
 * the exact same drizzle-orm/d1 query layer the Cloudflare Worker uses (src/worker/db/queries.ts)
 * against a plain local SQLite file instead of a real D1 binding.
 *
 * Only implements the surface this app's routes actually exercise via drizzle — `prepare`,
 * `.bind()`, `.run()`, `.all()`, `.first()`, `.raw()` (see grep across src/worker: no route or
 * query ever calls `.batch()`, `.withSession()`, or `.dump()`, all D1 replica/session/export
 * features with no local-SQLite equivalent worth faking).
 */
export function createSqliteD1(db: DatabaseSync): D1Database {
  function toD1Response(changes: number | bigint, lastInsertRowid: number | bigint) {
    return {
      success: true as const,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: Number(changes),
        last_row_id: Number(lastInsertRowid),
        changed_db: Number(changes) > 0,
        changes: Number(changes),
      },
    };
  }

  function prepareStatement(sql: string, params: SQLInputValue[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return prepareStatement(sql, values as SQLInputValue[]);
      },
      async first<T>(colName?: string) {
        const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
        if (!row) return null;
        return ((colName ? row[colName] : row) ?? null) as T | null;
      },
      async run<T = Record<string, unknown>>() {
        const { changes, lastInsertRowid } = db.prepare(sql).run(...params);
        return toD1Response(changes, lastInsertRowid) as D1Result<T>;
      },
      async all<T = Record<string, unknown>>() {
        const rows = db.prepare(sql).all(...params) as T[];
        return { ...toD1Response(0, 0), results: rows };
      },
      async raw<T = unknown[]>(options?: { columnNames?: boolean }) {
        const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
        const values = rows.map((row) => Object.values(row)) as T[];
        return (options?.columnNames ? [Object.keys(rows[0] ?? {}), ...values] : values) as never;
      },
    };
  }

  return {
    prepare: (sql: string) => prepareStatement(sql),
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results: D1Result<T>[] = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    withSession() {
      throw new Error("D1 sessions (withSession) aren't supported by the standalone sqlite shim.");
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("dump() isn't supported by the standalone sqlite shim.");
    },
  };
}
