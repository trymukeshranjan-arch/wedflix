import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import {
  comments,
  contentItems,
  mediaAssets,
  memberships,
  reactions,
  watchProgress,
} from "../../db/schema";
import { errors } from "../../lib/errors";
import { ok, created } from "../../lib/http";
import { readJson } from "../../lib/validate";
import { requirePermission } from "../../middleware/authorize";
import { toContentDto } from "../content/serialize";
import type { AppEnv } from "../../lib/context";

export const engagementRoutes = new Hono<AppEnv>();

async function assertContentInWedding(weddingId: string, id: string) {
  const item = await db.query.contentItems.findFirst({
    where: and(
      eq(contentItems.id, id),
      eq(contentItems.weddingId, weddingId),
    ),
  });
  if (!item) throw errors.notFound("Content not found");
  return item;
}

// Save playback position ("continue watching").
engagementRoutes.put("/content/:id/progress", async (c) => {
  const w = c.get("wedding");
  const membership = c.get("membership");
  const id = c.req.param("id");
  await assertContentInWedding(w.id, id);

  const body = await readJson(
    c,
    z.object({
      positionSeconds: z.number().min(0),
      durationSeconds: z.number().min(0).optional(),
      completed: z.boolean().optional(),
    }),
  );

  const position = Math.round(body.positionSeconds);
  const duration =
    body.durationSeconds != null ? Math.round(body.durationSeconds) : null;
  const completed = body.completed ?? false;

  await db
    .insert(watchProgress)
    .values({
      membershipId: membership.id,
      contentItemId: id,
      positionSeconds: position,
      durationSeconds: duration,
      completed,
    })
    .onConflictDoUpdate({
      target: [watchProgress.membershipId, watchProgress.contentItemId],
      set: {
        positionSeconds: position,
        durationSeconds: duration,
        completed,
        updatedAt: new Date(),
      },
    });

  return ok(c, { saved: true });
});

// Rows in progress, most recent first.
engagementRoutes.get("/continue-watching", async (c) => {
  const membership = c.get("membership");
  const rows = await db
    .select()
    .from(watchProgress)
    .innerJoin(contentItems, eq(watchProgress.contentItemId, contentItems.id))
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(
      and(
        eq(watchProgress.membershipId, membership.id),
        eq(watchProgress.completed, false),
      ),
    )
    .orderBy(desc(watchProgress.updatedAt))
    .limit(20);

  return ok(
    c,
    rows.map((r) => ({
      ...toContentDto(r.content_items, r.media_assets),
      progress: {
        positionSeconds: r.watch_progress.positionSeconds,
        durationSeconds: r.watch_progress.durationSeconds,
      },
    })),
  );
});

// Toggle a like on a content item.
engagementRoutes.post("/content/:id/like", async (c) => {
  const w = c.get("wedding");
  const membership = c.get("membership");
  const id = c.req.param("id");
  await assertContentInWedding(w.id, id);

  const existing = await db.query.reactions.findFirst({
    where: and(
      eq(reactions.membershipId, membership.id),
      eq(reactions.targetType, "content"),
      eq(reactions.targetId, id),
    ),
  });
  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    return ok(c, { liked: false });
  }
  await db.insert(reactions).values({
    membershipId: membership.id,
    targetType: "content",
    targetId: id,
    type: "like",
  });
  return ok(c, { liked: true });
});

// Read comments on a content item.
engagementRoutes.get("/content/:id/comments", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  await assertContentInWedding(w.id, id);

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: memberships.displayName,
      authorRole: memberships.role,
      authorAvatar: memberships.avatarUrl,
    })
    .from(comments)
    .innerJoin(memberships, eq(comments.membershipId, memberships.id))
    .where(eq(comments.contentItemId, id))
    .orderBy(desc(comments.createdAt))
    .limit(100);

  return ok(c, rows);
});

// Post a comment (requires the "comment" permission).
engagementRoutes.post(
  "/content/:id/comments",
  requirePermission("comment"),
  async (c) => {
    const w = c.get("wedding");
    const membership = c.get("membership");
    const id = c.req.param("id");
    await assertContentInWedding(w.id, id);

    const body = await readJson(
      c,
      z.object({ body: z.string().min(1).max(2000) }),
    );
    const [row] = await db
      .insert(comments)
      .values({
        weddingId: w.id,
        membershipId: membership.id,
        contentItemId: id,
        body: body.body,
      })
      .returning();
    return created(c, row);
  },
);
