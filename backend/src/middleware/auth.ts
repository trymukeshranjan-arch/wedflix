import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { verifySession } from "../services/auth";
import { errors } from "../lib/errors";
import type { AppEnv } from "../lib/context";

function bearer(header: string | undefined): string | null {
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

// Reject anonymous requests.
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearer(c.req.header("authorization"));
  if (!token) throw errors.unauthorized();
  const userId = await verifySession(token);
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) throw errors.unauthorized("Account not found");
  c.set("user", user);
  await next();
});

// Attach the user when a valid token is present, but allow anonymous
// access (public wedding pages with visibility="all" content).
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearer(c.req.header("authorization"));
  if (token) {
    try {
      const userId = await verifySession(token);
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (user) c.set("user", user);
    } catch {
      // Invalid token → treat as anonymous.
    }
  }
  await next();
});
