import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { memberships, users, weddings } from "../../db/schema";
import { signSession, verifyPassword } from "../../services/auth";
import { requireAuth } from "../../middleware/auth";
import { errors } from "../../lib/errors";
import { ok } from "../../lib/http";
import { readJson } from "../../lib/validate";
import type { AppEnv } from "../../lib/context";

export const authRoutes = new Hono<AppEnv>();

// Admin / studio login with email + password.
authRoutes.post("/login", async (c) => {
  const body = await readJson(
    c,
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  );
  const user = await db.query.users.findFirst({
    where: eq(users.email, body.email.toLowerCase()),
  });
  if (
    !user ||
    !user.passwordHash ||
    !verifyPassword(body.password, user.passwordHash)
  ) {
    throw errors.unauthorized("Incorrect email or password");
  }
  const accessToken = await signSession(user.id);
  return ok(c, {
    accessToken,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// Current user + every wedding they can access ("who's watching").
authRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const rows = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      permissions: memberships.permissions,
      displayName: memberships.displayName,
      weddingId: weddings.id,
      weddingSlug: weddings.slug,
      coupleNameA: weddings.coupleNameA,
      coupleNameB: weddings.coupleNameB,
    })
    .from(memberships)
    .innerJoin(weddings, eq(memberships.weddingId, weddings.id))
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.status, "active"),
      ),
    );

  return ok(c, {
    user: { id: user.id, name: user.name, email: user.email },
    memberships: rows,
  });
});
