import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { memberships } from "../db/schema";
import type { Permission } from "../db/schema";
import { errors } from "../lib/errors";
import type { AppEnv } from "../lib/context";

// Load the caller's membership in the resolved wedding.
// Must run after resolveTenant + requireAuth.
export const requireMembership = createMiddleware<AppEnv>(async (c, next) => {
  const wedding = c.get("wedding");
  const user = c.get("user");

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.weddingId, wedding.id),
      eq(memberships.userId, user.id),
    ),
  });

  if (!membership || membership.status !== "active") {
    throw errors.forbidden("You are not a member of this wedding");
  }

  c.set("membership", membership);
  await next();
});

// Guard a route behind a specific permission. Runs after requireMembership.
export function requirePermission(permission: Permission) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const membership = c.get("membership");
    if (!membership.permissions.includes(permission)) {
      throw errors.forbidden(`Missing "${permission}" permission`);
    }
    await next();
  });
}

// Reject if the wedding vault has lapsed (10/20-year or lifetime access).
export const requireActiveVault = createMiddleware<AppEnv>(
  async (c, next) => {
    const wedding = c.get("wedding");
    if (
      wedding.accessExpiresAt &&
      wedding.accessExpiresAt.getTime() < Date.now()
    ) {
      throw errors.vaultExpired();
    }
    await next();
  },
);
