import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "../middleware/auth";

export const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/auth/login — not a write route itself, but gated behind Access the same way (see
// README "Auth setup": the Access policy attachment is a manual, dashboard-owned step, out of
// this repo's control). The frontend never fetch()s this — it does a full top-level navigation
// here so the browser can follow Cloudflare Access's real hosted-login redirect, then bounces
// back to `returnTo` once `requireAuth()` sees a resolved identity. See src/frontend/lib/auth.ts.
auth.get("/login", requireAuth(), (c) => {
  const returnTo = c.req.query("returnTo") || "/";
  // Only ever redirect back into this same app — never follow an absolute/external returnTo.
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return c.redirect(safeReturnTo);
});
