import type { Context } from "hono";
import type { z } from "zod";
import { errors } from "./errors";

// Parse + validate a JSON request body. Invalid JSON or a schema mismatch
// surfaces as a 400 instead of leaking a 500.
export async function readJson<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw errors.badRequest("Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw errors.badRequest(
      "Validation failed",
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}

export function readQuery<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw errors.badRequest(
      "Invalid query parameters",
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}
