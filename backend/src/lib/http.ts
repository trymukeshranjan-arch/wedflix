import type { Context } from "hono";

// All successful responses are wrapped as { data: ... } for a consistent
// client contract.
export const ok = <T>(c: Context, data: T) => c.json({ data });

export const created = <T>(c: Context, data: T) => c.json({ data }, 201);

export const paginated = <T>(
  c: Context,
  items: T[],
  nextCursor: string | null,
) => c.json({ data: items, nextCursor });
