import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import {
  collections,
  collectionItems,
  contentItems,
  invites,
  mediaAssets,
  profiles,
  seasons,
  weddings,
} from "../../db/schema";
import { env } from "../../config/env";
import { errors } from "../../lib/errors";
import { ok, created } from "../../lib/http";
import { readJson } from "../../lib/validate";
import { requirePermission } from "../../middleware/authorize";
import { hashPassword } from "../../services/auth";
import { defaultPermissions } from "../../lib/permissions";
import { hashToken, randomToken } from "../../lib/tokens";
import { saveMedia, mediaKey, isR2Configured } from "../../services/storage";
import {
  createMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from "../../services/r2";
import { toContentDto } from "../content/serialize";
import { buildHome } from "../wedding/home";
import type { AppEnv } from "../../lib/context";

export const adminRoutes = new Hono<AppEnv>();

// Every admin route requires the "manage" permission.
adminRoutes.use("*", requirePermission("manage"));

// Homepage payload INCLUDING drafts — powers the inline-edit admin portal,
// which mirrors the user portal exactly.
adminRoutes.get("/home", async (c) =>
  ok(c, await buildHome(c.get("wedding"), { includeDrafts: true })),
);

// Edit wedding-level fields (couple names, tagline, theme).
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const sizeScale = z.enum(["small", "medium", "large"]);
const themeSchema = z
  .object({
    brandName: z.string().min(1).max(60).optional(),
    primary: z.string().regex(HEX).optional(),
    accent: z.string().regex(HEX).optional(),
    headingFont: z
      .enum([
        "Playfair Display",
        "Cormorant Garamond",
        "Inter",
        "Merriweather",
      ])
      .optional(),
    headingScale: sizeScale.optional(),
    thumbnailSize: sizeScale.optional(),
    heroHeight: sizeScale.optional(),
  })
  .strict();

adminRoutes.patch("/wedding", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(
    c,
    z.object({
      coupleNameA: z.string().min(1).max(120).optional(),
      coupleNameB: z.string().min(1).max(120).optional(),
      tagline: z.string().max(300).optional(),
      // null clears the field; empty string is rejected.
      starring: z.string().min(1).max(300).nullable().optional(),
      theme: themeSchema.optional(),
    }),
  );

  // Merge theme partial with whatever is already stored — never drop fields
  // the client didn't send.
  const nextTheme = body.theme
    ? { ...(w.theme ?? {}), ...body.theme }
    : undefined;

  const { theme: _ignored, ...flatBody } = body;
  const [updated] = await db
    .update(weddings)
    .set({
      ...flatBody,
      ...(nextTheme ? { theme: nextTheme } : {}),
      updatedAt: new Date(),
    })
    .where(eq(weddings.id, w.id))
    .returning();
  return ok(c, {
    id: updated!.id,
    coupleNameA: updated!.coupleNameA,
    coupleNameB: updated!.coupleNameB,
    tagline: updated!.tagline,
    starring: updated!.starring,
    theme: updated!.theme,
  });
});

// ── Media upload ─────────────────────────────────────────────────────────────
// Multipart upload. Stored locally for now; switches to Cloudflare Stream/R2
// once those credentials are configured.
adminRoutes.post("/media/upload", async (c) => {
  const w = c.get("wedding");
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) throw errors.badRequest("No file provided");

  const buf = Buffer.from(await file.arrayBuffer());
  const isVideo = (file.type || "").startsWith("video/");
  const stored = await saveMedia(
    w.id,
    file.name || "upload",
    buf,
    file.type || "application/octet-stream",
  );

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      weddingId: w.id,
      provider: "r2",
      kind: isVideo ? "video" : "image",
      status: "ready",
      providerId: stored.key,
      sizeBytes: buf.length,
    })
    .returning();

  return ok(c, {
    assetId: asset!.id,
    kind: isVideo ? "video" : "image",
    url: `/api/v1/media/${asset!.id}`,
    status: "ready",
  });
});

// ── Multipart upload ─────────────────────────────────────────────────────────
// Large files (videos) are uploaded to R2 in parts. Each part request stays
// well under Cloud Run's 32 MiB request cap, and the server forwards parts to
// R2 without ever buffering the whole file. Falls back to the single-request
// route above when R2 is not configured (local dev).
const KEY_RE = /^weddings\/[^/]+\//;

adminRoutes.post("/media/multipart/init", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(
    c,
    z.object({
      filename: z.string().min(1).max(300),
      contentType: z.string().max(150).optional(),
      sizeBytes: z.number().int().min(0).optional(),
    }),
  );

  if (!isR2Configured()) return ok(c, { direct: false });

  const contentType = body.contentType || "application/octet-stream";
  const isVideo = contentType.startsWith("video/");
  const key = mediaKey(w.id, body.filename);
  const uploadId = await createMultipartUpload(key, contentType);

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      weddingId: w.id,
      provider: "r2",
      kind: isVideo ? "video" : "image",
      status: "ready",
      providerId: key,
      sizeBytes: body.sizeBytes ?? 0,
    })
    .returning();

  return ok(c, {
    direct: true,
    assetId: asset!.id,
    url: `/api/v1/media/${asset!.id}`,
    key,
    uploadId,
  });
});

// Forward one uploaded part to R2. The raw chunk is the request body.
adminRoutes.put("/media/multipart/part", async (c) => {
  const w = c.get("wedding");
  const key = c.req.query("key") ?? "";
  const uploadId = c.req.query("uploadId") ?? "";
  const partNumber = Number(c.req.query("partNumber"));
  if (
    !key.startsWith(`weddings/${w.id}/`) ||
    !uploadId ||
    !Number.isInteger(partNumber) ||
    partNumber < 1
  ) {
    throw errors.badRequest("Invalid upload part request");
  }
  const buf = new Uint8Array(await c.req.arrayBuffer());
  if (buf.length === 0) throw errors.badRequest("Empty part");
  const etag = await uploadPart(key, uploadId, partNumber, buf);
  return ok(c, { partNumber, etag });
});

adminRoutes.post("/media/multipart/complete", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(
    c,
    z.object({
      key: z.string().regex(KEY_RE),
      uploadId: z.string().min(1),
      parts: z
        .array(
          z.object({
            partNumber: z.number().int().min(1),
            etag: z.string().min(1),
          }),
        )
        .min(1),
    }),
  );
  if (!body.key.startsWith(`weddings/${w.id}/`)) {
    throw errors.badRequest("Invalid upload");
  }
  await completeMultipartUpload(body.key, body.uploadId, body.parts);
  return ok(c, { completed: true });
});

adminRoutes.post("/media/multipart/abort", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(
    c,
    z.object({ key: z.string().min(1), uploadId: z.string().min(1) }),
  );
  if (body.key.startsWith(`weddings/${w.id}/`)) {
    await abortMultipartUpload(body.key, body.uploadId);
  }
  return ok(c, { aborted: true });
});

// ── Content ──────────────────────────────────────────────────────────────────
const contentColumns = z.object({
  type: z.enum([
    "film",
    "episode",
    "teaser",
    "reel",
    "moment",
    "drone",
    "photo_album",
  ]),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  // Nullable so admins can unassign a content item from its season.
  seasonId: z.string().uuid().nullable().optional(),
  primaryAssetId: z.string().uuid().optional(),
  episodeNumber: z.number().int().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().optional(),
  visibility: z.enum(["all", "family", "couple"]).optional(),
  // Empty array = visible to everyone; populated = restricted to these
  // profile IDs only (filtered server-side via X-Profile-Id header).
  visibleProfileIds: z.array(z.string().uuid()).optional(),
  status: z.enum(["draft", "published"]).optional(),
  tags: z.array(z.string()).optional(),
  eventDate: z.coerce.date().optional(),
});

const contentCreateSchema = contentColumns.extend({
  // Find-or-create a homepage row and drop this item into it.
  collectionTitle: z.string().min(1).max(120).optional(),
  setAsHero: z.boolean().optional(),
});

// List all content for the wedding (including drafts).
adminRoutes.get("/content", async (c) => {
  const w = c.get("wedding");
  const rows = await db
    .select()
    .from(contentItems)
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(eq(contentItems.weddingId, w.id))
    .orderBy(desc(contentItems.createdAt));
  return ok(c, rows.map((r) => toContentDto(r.content_items, r.media_assets)));
});

// Serialise a content row together with its primary asset.
async function dtoWithAsset(item: typeof contentItems.$inferSelect) {
  const asset = item.primaryAssetId
    ? await db.query.mediaAssets.findFirst({
        where: eq(mediaAssets.id, item.primaryAssetId),
      })
    : null;
  return toContentDto(item, asset);
}

async function upsertCollection(
  weddingId: string,
  title: string,
): Promise<string> {
  const existing = await db.query.collections.findFirst({
    where: and(
      eq(collections.weddingId, weddingId),
      eq(collections.title, title),
    ),
  });
  if (existing) return existing.id;
  const position = await db.$count(
    collections,
    eq(collections.weddingId, weddingId),
  );
  const [row] = await db
    .insert(collections)
    .values({ weddingId, title, kind: "manual", position })
    .returning();
  return row!.id;
}

// Create a content item (and optionally place it in a homepage row).
adminRoutes.post("/content", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(c, contentCreateSchema);
  const status = body.status ?? "published";

  const [item] = await db
    .insert(contentItems)
    .values({
      weddingId: w.id,
      type: body.type,
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      seasonId: body.seasonId,
      primaryAssetId: body.primaryAssetId,
      episodeNumber: body.episodeNumber,
      durationSeconds: body.durationSeconds,
      thumbnailUrl: body.thumbnailUrl,
      visibility: body.visibility ?? "all",
      visibleProfileIds: body.visibleProfileIds ?? [],
      status,
      tags: body.tags ?? [],
      eventDate: body.eventDate,
      publishedAt: status === "published" ? new Date() : null,
    })
    .returning();

  if (body.collectionTitle) {
    const collectionId = await upsertCollection(w.id, body.collectionTitle);
    const position = await db.$count(
      collectionItems,
      eq(collectionItems.collectionId, collectionId),
    );
    await db.insert(collectionItems).values({
      collectionId,
      contentItemId: item!.id,
      position,
    });
  }
  if (body.setAsHero) {
    await db
      .update(weddings)
      .set({ heroContentId: item!.id })
      .where(eq(weddings.id, w.id));
  }

  return created(c, await dtoWithAsset(item!));
});

// Update a content item — fields, the row it belongs to, and hero status.
adminRoutes.patch("/content/:id", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const body = await readJson(c, contentCreateSchema.partial());
  const { collectionTitle, setAsHero, ...cols } = body;

  const [item] = await db
    .update(contentItems)
    .set({ ...cols, updatedAt: new Date() })
    .where(and(eq(contentItems.id, id), eq(contentItems.weddingId, w.id)))
    .returning();
  if (!item) throw errors.notFound("Content not found");

  // Move the item to a different homepage row — only when it actually
  // changed, so a plain edit never reorders the row.
  if (collectionTitle) {
    const collectionId = await upsertCollection(w.id, collectionTitle);
    const already = await db.query.collectionItems.findFirst({
      where: and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.contentItemId, id),
      ),
    });
    if (!already) {
      await db
        .delete(collectionItems)
        .where(eq(collectionItems.contentItemId, id));
      const position = await db.$count(
        collectionItems,
        eq(collectionItems.collectionId, collectionId),
      );
      await db
        .insert(collectionItems)
        .values({ collectionId, contentItemId: id, position });
    }
  }
  if (setAsHero) {
    await db
      .update(weddings)
      .set({ heroContentId: id })
      .where(eq(weddings.id, w.id));
  }
  return ok(c, await dtoWithAsset(item));
});

// Delete a content item.
adminRoutes.delete("/content/:id", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const deleted = await db
    .delete(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.weddingId, w.id)))
    .returning({ id: contentItems.id });
  if (!deleted.length) throw errors.notFound("Content not found");
  return ok(c, { deleted: true });
});

// ── Seasons ──────────────────────────────────────────────────────────────────
adminRoutes.get("/seasons", async (c) => {
  const w = c.get("wedding");
  const rows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.weddingId, w.id))
    .orderBy(asc(seasons.number));
  return ok(c, rows);
});

adminRoutes.post("/seasons", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(
    c,
    z.object({
      number: z.number().int().min(1),
      title: z.string().min(1).max(120),
      description: z.string().max(2000).optional(),
    }),
  );
  const [row] = await db
    .insert(seasons)
    .values({ weddingId: w.id, ...body })
    .returning();
  return created(c, row);
});

adminRoutes.patch("/seasons/:id", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const body = await readJson(
    c,
    z
      .object({
        number: z.number().int().min(1),
        title: z.string().min(1).max(120),
        description: z.string().max(2000).nullable(),
      })
      .partial(),
  );
  const [row] = await db
    .update(seasons)
    .set(body)
    .where(and(eq(seasons.id, id), eq(seasons.weddingId, w.id)))
    .returning();
  if (!row) throw errors.notFound("Season not found");
  return ok(c, row);
});

// Deleting a season just removes the grouping — the season FK on
// content_items is ON DELETE SET NULL, so episodes return to the regular
// home rows. Caller should confirm with the user first.
adminRoutes.delete("/seasons/:id", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const deleted = await db
    .delete(seasons)
    .where(and(eq(seasons.id, id), eq(seasons.weddingId, w.id)))
    .returning({ id: seasons.id });
  if (!deleted.length) throw errors.notFound("Season not found");
  return ok(c, { deleted: true });
});

// ── Collections (homepage rows) ──────────────────────────────────────────────
adminRoutes.get("/collections", async (c) => {
  const w = c.get("wedding");
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.weddingId, w.id))
    .orderBy(asc(collections.position));
  return ok(c, rows);
});

// ── Profiles ("Who's watching") ──────────────────────────────────────────────
// `pin` is a 4-digit numeric code; null clears the lock. It's hashed before
// storage and never sent back to any client.
const profileSchema = z.object({
  name: z.string().min(1).max(80),
  avatarUrl: z.string().optional(),
  sortOrder: z.number().int().optional(),
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be 4 digits")
    .nullable()
    .optional(),
});

// Strip the hash; expose only whether a lock is set.
function profileDto(p: typeof profiles.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    sortOrder: p.sortOrder,
    hasPin: Boolean(p.pinHash),
  };
}

adminRoutes.get("/profiles", async (c) => {
  const w = c.get("wedding");
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.weddingId, w.id))
    .orderBy(asc(profiles.sortOrder));
  return ok(c, rows.map(profileDto));
});

adminRoutes.post("/profiles", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(c, profileSchema);
  const [row] = await db
    .insert(profiles)
    .values({
      weddingId: w.id,
      name: body.name,
      avatarUrl: body.avatarUrl,
      sortOrder: body.sortOrder ?? 0,
      pinHash: body.pin ? hashPassword(body.pin) : null,
    })
    .returning();
  return created(c, profileDto(row!));
});

adminRoutes.patch("/profiles/:id", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const { pin, ...rest } = await readJson(c, profileSchema.partial());
  // pin === undefined → leave the lock untouched.
  // pin === null      → remove the lock.
  // pin === "1234"    → set/replace the lock.
  const pinUpdate =
    pin === undefined ? {} : { pinHash: pin ? hashPassword(pin) : null };
  const [row] = await db
    .update(profiles)
    .set({ ...rest, ...pinUpdate })
    .where(and(eq(profiles.id, id), eq(profiles.weddingId, w.id)))
    .returning();
  if (!row) throw errors.notFound("Profile not found");
  return ok(c, profileDto(row));
});

adminRoutes.delete("/profiles/:id", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const deleted = await db
    .delete(profiles)
    .where(and(eq(profiles.id, id), eq(profiles.weddingId, w.id)))
    .returning({ id: profiles.id });
  if (!deleted.length) throw errors.notFound("Profile not found");
  return ok(c, { deleted: true });
});

// ── Invites ──────────────────────────────────────────────────────────────────
adminRoutes.post("/invites", async (c) => {
  const w = c.get("wedding");
  const user = c.get("user");
  const body = await readJson(
    c,
    z.object({
      role: z.enum(["bride", "groom", "parent", "family", "friend"]),
      email: z.string().email().optional(),
      phone: z.string().min(6).optional(),
      maxUses: z.number().int().min(1).max(500).optional(),
      expiresInDays: z.number().int().min(1).max(365).optional(),
    }),
  );

  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + (body.expiresInDays ?? 30) * 86_400_000,
  );
  const [invite] = await db
    .insert(invites)
    .values({
      weddingId: w.id,
      tokenHash: hashToken(token),
      role: body.role,
      permissions: defaultPermissions(body.role),
      email: body.email,
      phone: body.phone,
      maxUses: body.maxUses ?? 1,
      expiresAt,
      createdBy: user.id,
    })
    .returning();

  return created(c, {
    inviteId: invite!.id,
    inviteUrl: `${env.PUBLIC_BASE_URL}/join?token=${token}`,
    token,
    expiresAt: expiresAt.toISOString(),
  });
});
