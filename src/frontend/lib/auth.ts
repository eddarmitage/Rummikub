import { apiGet, ApiRequestError } from "./api";
import type { AppConfig } from "./types";

export function isUnauthenticatedError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 401;
}

/**
 * Full top-level navigation rather than a fetch() — Cloudflare Access's hosted login is an
 * interactive redirect flow a background request can't complete. Navigating to this
 * Access-protected route lets the browser follow that flow for real; the worker bounces back
 * to `returnTo` once it resolves an identity (see src/worker/routes/auth.ts).
 */
export function signIn(returnTo: string = window.location.pathname + window.location.search): void {
  window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Whether this instance has a real sign-in to offer (`GET /api/config`). False on the standalone
 * no-auth Docker build and under a `wrangler dev` auth bypass, where every request already
 * carries a fixed identity and `signIn()` would redirect straight back to where it started —
 * the frontend uses this to hide the "Sign in" button rather than offer a no-op.
 *
 * Falls back to `true` if the probe fails, so a transient error degrades to the Cloudflare
 * behaviour (offer sign-in) rather than hiding it on a deployment that genuinely needs it.
 */
export async function fetchAuthEnabled(): Promise<boolean> {
  try {
    return (await apiGet<AppConfig>("/config")).authEnabled;
  } catch {
    return true;
  }
}
