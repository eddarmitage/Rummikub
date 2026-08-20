import type { Context } from "hono";
import type { ZodType } from "zod";

/** Error response shape shared by every route (docs/spec.md, AGENTS.md "Hard constraints"). */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function errorResponse(c: Context, status: 400 | 401 | 404, code: string, message: string) {
  return c.json<ApiErrorBody>({ error: { code, message } }, status);
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parses and validates a JSON request body against `schema`. On failure, returns a
 *  ready-to-return 400 VALIDATION_ERROR response so callers just do
 *  `if (!body.ok) return body.response`. */
export async function parseBody<T>(c: Context, schema: ZodType<T>): Promise<ParsedBody<T>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    json = undefined;
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      response: errorResponse(
        c,
        400,
        "VALIDATION_ERROR",
        result.error.issues[0]?.message ?? "Invalid request body.",
      ),
    };
  }
  return { ok: true, data: result.data };
}
