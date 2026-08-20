import type { MiddlewareHandler } from "hono";
import { createDb, getOrCreateUserByEmail } from "../db/queries";
import type { User } from "../db/schema";

/**
 * Bindings this middleware needs from the Worker's Env. The real app Env (wired up in #4)
 * is a superset of this and satisfies it structurally — no need to import the generated
 * `Env` from worker-configuration.d.ts here.
 */
export interface AuthEnv {
  DB: D1Database;
  /**
   * Local/test-only escape hatch. Never set in the real deployed `wrangler.toml` — only
   * via a gitignored `.dev.vars` file for `wrangler dev`, or per-test env overrides for
   * `vitest-pool-workers` (#9). When this is exactly the string `"true"`, `requireAuth()`
   * accepts an `X-Dev-User-Email` header as the caller's identity instead of requiring a
   * live Cloudflare Access session. See README "Auth setup".
   */
  DEV_AUTH_BYPASS_ENABLED?: string;
}

/** Attached to `c.var.user` by `requireAuth()` for downstream handlers. */
export type AuthVariables = {
  user: User;
};

const DEV_BYPASS_HEADER = "X-Dev-User-Email";

interface Identity {
  email: string;
  name: string | null;
}

/**
 * Requires an authenticated caller and upserts them into the `users` table, attaching the
 * resulting row to `c.var.user` for downstream handlers.
 *
 * In production, Cloudflare Access enforces authentication at the edge before this
 * Worker's code runs (native Workers integration — see docs/spec.md "Auth"), so
 * `ctx.access.getIdentity()` should resolve for any request that reached an
 * Access-protected route. `ctx.access` itself is `undefined` for requests that never went
 * through Access — which is always true under `wrangler dev`/Miniflare and
 * `vitest-pool-workers`, since there's no live Access session to enforce locally. The
 * `X-Dev-User-Email` bypass below only activates when `DEV_AUTH_BYPASS_ENABLED` is exactly
 * `"true"` — a flag never set in `wrangler.toml.example`, so it's falsy in the real
 * deployment regardless of what a client sends.
 *
 * v1 scope (docs/spec.md "Auth", issue #5): any Access-allowed user may write to any game
 * — there's no per-game membership check here. That's #12, deferred.
 *
 * This middleware does not decide *who* is allowed to authenticate at all — that's the
 * Access policy itself, configured directly against the deployed Worker in the Cloudflare
 * dashboard (see README "Auth setup"). It only reads the resulting identity and maps it
 * onto this app's own `users` table.
 */
export function requireAuth<
  E extends { Bindings: AuthEnv; Variables: AuthVariables },
>(): MiddlewareHandler<E> {
  return async (c, next) => {
    let identity: Identity | undefined;

    if (c.env.DEV_AUTH_BYPASS_ENABLED === "true") {
      const devEmail = c.req.header(DEV_BYPASS_HEADER);
      if (devEmail) {
        identity = { email: devEmail, name: null };
      }
    }

    if (!identity) {
      // Hono's own `ExecutionContext` type (what `c.executionCtx` is typed as) doesn't
      // declare `access` — that's the Cloudflare-runtime-specific ambient `ExecutionContext`
      // shipped by @cloudflare/workers-types. At runtime under both `wrangler dev` and the
      // real deployment, `c.executionCtx` *is* that Cloudflare object, so this cast is safe;
      // see plan Decision D6 for why a small cast is the intended fix here.
      const access = (c.executionCtx as unknown as globalThis.ExecutionContext).access;
      if (access) {
        const accessIdentity = await access.getIdentity();
        if (accessIdentity?.email) {
          identity = { email: accessIdentity.email, name: accessIdentity.name ?? null };
        }
      }
    }

    if (!identity) {
      return c.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, 401);
    }

    const db = createDb(c.env.DB);
    const user = await getOrCreateUserByEmail(db, { email: identity.email, name: identity.name });
    c.set("user", user);

    await next();
  };
}
