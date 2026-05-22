import { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { weddings, memberships } from "../../db/schema";
import { errors } from "../../lib/errors";
import { ok, created } from "../../lib/http";
import { readJson } from "../../lib/validate";
import type { AppEnv } from "../../lib/context";

export const studioRoutes = new Hono<AppEnv>();

// The studio the logged-in admin belongs to (via a wedding membership that
// carries the "manage" permission).
async function getStudioId(userId: string): Promise<string> {
  const rows = await db
    .select({
      studioId: weddings.studioId,
      permissions: memberships.permissions,
    })
    .from(memberships)
    .innerJoin(weddings, eq(memberships.weddingId, weddings.id))
    .where(eq(memberships.userId, userId));
  const admin = rows.find((r) => r.permissions.includes("manage"));
  if (!admin) throw errors.forbidden("You are not a studio admin");
  return admin.studioId;
}

// List every wedding under the admin's studio.
studioRoutes.get("/weddings", async (c) => {
  const user = c.get("user");
  const studioId = await getStudioId(user.id);
  const rows = await db
    .select()
    .from(weddings)
    .where(eq(weddings.studioId, studioId))
    .orderBy(desc(weddings.createdAt));
  return ok(
    c,
    rows.map((w) => ({
      id: w.id,
      slug: w.slug,
      coupleNameA: w.coupleNameA,
      coupleNameB: w.coupleNameB,
      tagline: w.tagline,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
  );
});

// Create a new wedding under the admin's studio.
studioRoutes.post("/weddings", async (c) => {
  const user = c.get("user");
  const studioId = await getStudioId(user.id);
  const body = await readJson(
    c,
    z.object({
      coupleNameA: z.string().min(1).max(120),
      coupleNameB: z.string().min(1).max(120),
      slug: z
        .string()
        .min(2)
        .max(80)
        .regex(
          /^[a-z0-9-]+$/,
          "Use lowercase letters, numbers and hyphens only",
        ),
      tagline: z.string().max(300).optional(),
    }),
  );

  const existing = await db.query.weddings.findFirst({
    where: eq(weddings.slug, body.slug),
  });
  if (existing) throw errors.conflict("That URL slug is already taken");

  const [wedding] = await db
    .insert(weddings)
    .values({
      studioId,
      slug: body.slug,
      coupleNameA: body.coupleNameA,
      coupleNameB: body.coupleNameB,
      tagline: body.tagline,
      status: "live",
    })
    .returning();

  // The creator becomes a managing member of the new wedding.
  await db.insert(memberships).values({
    weddingId: wedding!.id,
    userId: user.id,
    role: "studio",
    permissions: ["view", "download", "upload", "comment", "manage"],
    displayName: "Admin",
    status: "active",
  });

  return created(c, {
    id: wedding!.id,
    slug: wedding!.slug,
    coupleNameA: wedding!.coupleNameA,
    coupleNameB: wedding!.coupleNameB,
  });
});
