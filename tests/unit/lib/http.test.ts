import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorResponse, parseBody, type ApiErrorBody } from "../../../src/worker/lib/http";

describe("errorResponse", () => {
  it("returns the standard { error: { code, message } } shape with the given status", async () => {
    const app = new Hono();
    app.get("/", (c) => errorResponse(c, 404, "GAME_NOT_FOUND", "That game doesn't exist."));

    const res = await app.request("/");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "GAME_NOT_FOUND", message: "That game doesn't exist." },
    });
  });
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string().trim().min(1) });

  function buildApp() {
    const app = new Hono();
    app.post("/", async (c) => {
      const body = await parseBody(c, schema);
      if (!body.ok) return body.response;
      return c.json({ ok: true, data: body.data });
    });
    return app;
  }

  it("returns the parsed data for a valid body", async () => {
    const res = await buildApp().request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Alice" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { name: "Alice" } });
  });

  it("returns a 400 VALIDATION_ERROR response for a schema-invalid body", async () => {
    const res = await buildApp().request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a 400 VALIDATION_ERROR response for unparsable JSON", async () => {
    const res = await buildApp().request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as ApiErrorBody;
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a 400 VALIDATION_ERROR response for a missing body", async () => {
    const res = await buildApp().request("/", { method: "POST" });

    expect(res.status).toBe(400);
  });
});
