import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
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
  /**
   * Zero Trust team domain, e.g. `https://your-team.cloudflareaccess.com` — used to fetch
   * Access's public keys for verifying the `Cf-Access-Jwt-Assertion` header (see
   * `verifyAccessJwt` below). Set on your own gitignored `wrangler.toml`, never committed —
   * see `wrangler.toml.example` and README "Auth setup".
   */
  ACCESS_TEAM_DOMAIN?: string;
  /**
   * The self-hosted Access Application's "Application Audience (AUD) Tag" (its Overview tab
   * in the Zero Trust dashboard). Checked against the JWT's `aud` claim so a session valid for
   * a *different* Access application in the same team can't be replayed against this one.
   */
  ACCESS_AUD?: string;
}

/** Attached to `c.var.user` by `requireAuth()` for downstream handlers. */
export type AuthVariables = {
  user: User;
};

const DEV_BYPASS_HEADER = "X-Dev-User-Email";
const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

interface Identity {
  email: string;
  name: string | null;
}

// `createRemoteJWKSet` caches the fetched key set internally (and re-fetches on a `kid` it
// hasn't seen), so one instance per team domain can be reused across requests for as long as
// this Worker isolate stays warm — no need to re-fetch Access's public keys on every request.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Verifies the `Cf-Access-Jwt-Assertion` header Cloudflare Access signs onto any request that
 * passed through a *self-hosted* Access Application — which is what this app actually uses
 * (README "Auth setup"), instead of the native "Protect this Worker" toggle. Only that toggle
 * populates the Workers-specific `ctx.access` binding checked below; a self-hosted app never
 * does, no matter how correctly it's configured, so identity has to come from verifying this
 * JWT directly instead. Follows Cloudflare's documented approach for this:
 * https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */
export async function verifyAccessJwt(
  token: string,
  env: Pick<AuthEnv, "ACCESS_TEAM_DOMAIN" | "ACCESS_AUD">,
): Promise<Identity | undefined> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return undefined;

  try {
    const { payload } = await jwtVerify(token, getJwks(env.ACCESS_TEAM_DOMAIN), {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    });
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (!email) return undefined;
    const name = typeof payload.name === "string" ? payload.name : null;
    return { email, name };
  } catch {
    // Expired/malformed/wrong-audience token — treat exactly like "not signed in".
    return undefined;
  }
}

/**
 * Requires an authenticated caller and upserts them into the `users` table, attaching the
 * resulting row to `c.var.user` for downstream handlers.
 *
 * Tries three sources for identity, in order:
 * 1. The `X-Dev-User-Email` bypass — only when `DEV_AUTH_BYPASS_ENABLED` is exactly `"true"`,
 *    a flag never set in `wrangler.toml.example`, so it's falsy in the real deployment
 *    regardless of what a client sends. Local/test-only escape hatch (`.dev.vars` or
 *    per-test env overrides), since there's no live Access session under `wrangler dev`/
 *    Miniflare or `vitest-pool-workers`.
 * 2. `ctx.access.getIdentity()` — populated only by the native "Protect this Worker" Access
 *    toggle. This repo doesn't use that toggle (see README "Auth setup"), so in production
 *    this is normally a no-op, but it's cheap to check first in case that ever changes.
 * 3. Verifying the `Cf-Access-Jwt-Assertion` header via `verifyAccessJwt` — what actually
 *    authenticates real requests, since they go through the self-hosted Access Application
 *    this app is documented to use.
 *
 * v1 scope (docs/spec.md "Auth", issue #5): any Access-allowed user may write to any game
 * — there's no per-game membership check here. That's #12, deferred.
 *
 * This middleware does not decide *who* is allowed to authenticate at all — that's the
 * Access policy itself, attached to the self-hosted Access Application in the Cloudflare
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
      const token = c.req.header(ACCESS_JWT_HEADER);
      if (token) {
        identity = await verifyAccessJwt(token, c.env);
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
