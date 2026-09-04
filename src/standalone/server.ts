/**
 * Standalone, no-auth HTTP harness for self-hosting outside Cloudflare (issue #46) — runs the
 * exact same Hono app and routes the Worker serves (src/worker/index.ts), just fronted by plain
 * Node instead of workerd, with D1 backed by a local SQLite file (src/standalone/sqlite-d1.ts)
 * instead of a real D1 binding.
 *
 * There's no Cloudflare Access here to establish identity, so every request is stamped with a
 * single fixed local user via requireAuth()'s existing `X-Dev-User-Email` dev-bypass header
 * (src/worker/middleware/auth.ts) — this harness is meant for one trusted household/group
 * running their own instance, not a multi-tenant deployment.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import workerApp from "../worker/index";
import { runMigrations } from "./migrate";
import { createSqliteD1 } from "./sqlite-d1";

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");
const CLIENT_DIR = join(process.cwd(), "dist", "client");
const LOCAL_USER_EMAIL = "local@localhost";
const DEV_BYPASS_HEADER = "X-Dev-User-Email";

mkdirSync(DATA_DIR, { recursive: true });
const sqlite = new DatabaseSync(join(DATA_DIR, "rummikub.sqlite"));
runMigrations(sqlite, join(process.cwd(), "migrations"));

const env = {
  DB: createSqliteD1(sqlite),
  // Never called by any route — assets are served by the static middleware below, not app
  // code (the real deployment relies on wrangler's `run_worker_first` to route only /api/*
  // to the Worker and let the platform serve everything else from the ASSETS binding). This
  // stub only exists to satisfy Env's shape.
  ASSETS: {} as unknown as Fetcher,
  DEV_AUTH_BYPASS_ENABLED: "true",
};

// Plain Node has no Workers ExecutionContext (@hono/node-server's `c.executionCtx` getter
// throws if accessed) — a no-op stub is enough since nothing here needs to outlive the
// response, and requireAuth()'s `ctx.access` check just sees `.access` as undefined and falls
// through to the dev-bypass identity already set below.
const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

const app = new Hono();

app.use("/api/*", async (c) => {
  const headers = new Headers(c.req.raw.headers);
  headers.set(DEV_BYPASS_HEADER, LOCAL_USER_EMAIL);
  const request = new Request(c.req.raw, {
    headers,
    ...(c.req.raw.body ? { duplex: "half" as const } : {}),
  });
  return workerApp.fetch(request, env, executionCtx);
});

app.use("*", serveStatic({ root: CLIENT_DIR }));
app.get("*", serveStatic({ path: join(CLIENT_DIR, "index.html") }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Rummikub scores (standalone, no-auth) listening on http://localhost:${info.port}`);
});
