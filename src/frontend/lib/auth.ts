import { ApiRequestError } from "./api";

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
