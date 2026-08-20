import { afterEach, describe, expect, it, vi } from "vitest";
import { apiPost, ApiRequestError } from "../../../src/frontend/lib/api";

describe("apiPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the parsed JSON body on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/games/new", { name: "Venice" })).resolves.toEqual({ ok: true });
  });

  it("throws a real ApiRequestError as-is when the worker returns a clean 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/games/new", { name: "Venice" })).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  // Cloudflare Access intercepts fetch()es to write routes lacking a live session with a
  // redirect to its hosted login (a different origin); the browser can't follow that
  // cross-origin redirect for a fetch(), so it throws a generic network TypeError ("Load
  // failed" in Safari, "Failed to fetch" in Chrome) instead of the route ever returning a
  // real 401. See src/frontend/lib/api.ts.
  it("maps a fetch()-level network failure to an UNAUTHENTICATED ApiRequestError", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/games/new", { name: "Venice" })).rejects.toBeInstanceOf(ApiRequestError);
    await expect(apiPost("/games/new", { name: "Venice" })).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("re-throws a non-network error unchanged", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new RangeError("boom"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiPost("/games/new", { name: "Venice" })).rejects.toBeInstanceOf(RangeError);
  });
});
