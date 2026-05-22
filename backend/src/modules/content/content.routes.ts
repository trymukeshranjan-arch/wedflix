import { Hono } from "hono";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/client";
import {
  contentItems,
  contentPeople,
  mediaAssets,
  people,
} from "../../db/schema";
import { env } from "../../config/env";
import { errors } from "../../lib/errors";
import { ok } from "../../lib/http";
import { canView, findMembership } from "../../lib/access";
import { toContentDto } from "./serialize";
import type { AppEnv } from "../../lib/context";

export const contentRoutes = new Hono<AppEnv>();

// Load one content item + its primary asset, scoped to the tenant.
async function loadItem(weddingId: string, id: string) {
  const rows = await db
    .select()
    .from(contentItems)
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(
      and(eq(contentItems.id, id), eq(contentItems.weddingId, weddingId)),
    )
    .limit(1);
  return rows[0];
}

// Search across titles / subtitles.
contentRoutes.get("/search", async (c) => {
  const w = c.get("wedding");
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return ok(c, []);

  const pattern = `%${q}%`;
  const rows = await db
    .select()
    .from(contentItems)
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(
      and(
        eq(contentItems.weddingId, w.id),
        eq(contentItems.status, "published"),
        or(
          ilike(contentItems.title, pattern),
          ilike(contentItems.subtitle, pattern),
        ),
      ),
    );

  const membership = await findMembership(w.id, c.get("user")?.id);
  const visible = rows.filter((r) =>
    canView(r.content_items.visibility, membership),
  );
  return ok(c, visible.map((r) => toContentDto(r.content_items, r.media_assets)));
});

// Content detail — metadata + people tagged.
contentRoutes.get("/:id", async (c) => {
  const w = c.get("wedding");
  const row = await loadItem(w.id, c.req.param("id"));
  if (!row) throw errors.notFound("Content not found");

  const membership = await findMembership(w.id, c.get("user")?.id);
  if (!canView(row.content_items.visibility, membership)) {
    throw errors.forbidden();
  }

  const tagged = await db
    .select({
      id: people.id,
      name: people.name,
      relation: people.relation,
      avatarUrl: people.avatarUrl,
    })
    .from(contentPeople)
    .innerJoin(people, eq(contentPeople.personId, people.id))
    .where(eq(contentPeople.contentItemId, row.content_items.id));

  return ok(c, {
    ...toContentDto(row.content_items, row.media_assets),
    people: tagged,
  });
});

// Mint a short-lived signed playback URL.
contentRoutes.get("/:id/playback", async (c) => {
  const w = c.get("wedding");
  const row = await loadItem(w.id, c.req.param("id"));
  if (!row) throw errors.notFound("Content not found");

  const item = row.content_items;
  const asset = row.media_assets;
  const membership = await findMembership(w.id, c.get("user")?.id);

  if (!canView(item.visibility, membership)) throw errors.forbidden();
  if (item.visibility !== "all") {
    if (!membership) throw errors.unauthorized();
    if (!membership.permissions.includes("view")) {
      throw errors.forbidden('Missing "view" permission');
    }
  }
  if (w.accessExpiresAt && w.accessExpiresAt.getTime() < Date.now()) {
    throw errors.vaultExpired();
  }
  if (!asset || asset.status !== "ready") {
    throw errors.badRequest("This video is still processing");
  }
  // Playback streams through the backend media route (R2-backed).
  return ok(c, {
    src: `/api/v1/media/${asset.id}`,
    kind: "mp4",
    expiresIn: null,
  });
});

// Signed URL for downloading the original file (download permission only).
contentRoutes.get("/:id/download", async (c) => {
  const w = c.get("wedding");
  const row = await loadItem(w.id, c.req.param("id"));
  if (!row) throw errors.notFound("Content not found");

  const asset = row.media_assets;
  const membership = await findMembership(w.id, c.get("user")?.id);
  if (!membership) throw errors.unauthorized();
  if (!membership.permissions.includes("download")) {
    throw errors.forbidden('Missing "download" permission');
  }
  if (!asset || asset.status !== "ready") {
    throw errors.badRequest("Original is not available yet");
  }

  return ok(c, {
    downloadUrl: `/api/v1/media/${asset.id}`,
    expiresIn: null,
  });
});
