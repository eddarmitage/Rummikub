/** Mirrors the worker's shared error shape (docs/spec.md, AGENTS.md "Hard constraints"). */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    const error = (json as { error?: { code: string; message: string } } | undefined)?.error;
    throw new ApiRequestError(res.status, error?.code ?? "UNKNOWN_ERROR", error?.message ?? "Something went wrong.");
  }

  return json as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

/**
 * Write routes are Cloudflare Access-protected (README "Auth setup"). Without a live Access
 * session, Access intercepts the request itself — before it ever reaches this Worker — and
 * responds with a redirect to its hosted login, a different origin. A `fetch()` (unlike the
 * top-level navigation `signIn()` uses) can't follow that cross-origin redirect, so it
 * rejects with a generic network `TypeError` ("Load failed" in Safari, "Failed to fetch" in
 * Chrome) instead of the clean 401 JSON callers expect. Re-surface that as the same
 * UNAUTHENTICATED shape a real 401 would produce, so `isUnauthenticatedError()` → `signIn()`
 * still kicks in instead of the caller showing that raw browser error text.
 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  try {
    return await request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new ApiRequestError(401, "UNAUTHENTICATED", "Sign in required.");
    }
    throw err;
  }
}
