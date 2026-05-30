import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import {
  contentItems,
  invites,
  mediaAssets,
  memberships,
  memoryFeed,
  profiles,
  seasons,
  users,
} from "../../db/schema";
import { errors } from "../../lib/errors";
import { ok } from "../../lib/http";
import { readJson } from "../../lib/validate";
import { hashToken } from "../../lib/tokens";
import { findMembership } from "../../lib/access";
import { signSession, verifyPassword } from "../../services/auth";
import { toContentDto } from "../content/serialize";
import { buildHome, profileVisibilityFilter, publicWedding } from "./home";
import type { AppEnv, User } from "../../lib/context";

export const weddingRoutes = new Hono<AppEnv>();

// Public wedding info (branding / landing).
weddingRoutes.get("/", (c) => ok(c, publicWedding(c.get("wedding"))));

// Everything the homepage needs in one call: hero + content rows. The
// X-Profile-Id header (set by the WeddingApp after profile pick) scopes
// per-profile-visible items.
weddingRoutes.get("/home", async (c) =>
  ok(
    c,
    await buildHome(c.get("wedding"), {
      includeDrafts: false,
      profileId: c.req.header("x-profile-id") ?? null,
    }),
  ),
);

// "Who's watching" profiles for this wedding. `hasPin` tells the client to
// prompt for a PIN before entering; the hash itself is never sent.
weddingRoutes.get("/profiles", async (c) => {
  const w = c.get("wedding");
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.weddingId, w.id))
    .orderBy(asc(profiles.sortOrder));
  return ok(
    c,
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      hasPin: Boolean(p.pinHash),
    })),
  );
});

// Verify a profile's PIN. Returns { ok: true } on success, 403 otherwise.
// Profiles without a PIN always pass (defensive — the client shouldn't ask).
weddingRoutes.post("/profiles/:id/verify-pin", async (c) => {
  const w = c.get("wedding");
  const id = c.req.param("id");
  const { pin } = await readJson(
    c,
    z.object({ pin: z.string().min(1).max(12) }),
  );
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.id, id), eq(profiles.weddingId, w.id)),
  });
  if (!profile) throw errors.notFound("Profile not found");
  if (!profile.pinHash) return ok(c, { ok: true });
  if (!verifyPassword(pin, profile.pinHash)) {
    throw errors.forbidden("Incorrect PIN");
  }
  return ok(c, { ok: true });
});

// Seasons with their episodes. Episodes are filtered by the current
// viewer's profile via X-Profile-Id, same model as /home.
weddingRoutes.get("/seasons", async (c) => {
  const w = c.get("wedding");
  const profileId = c.req.header("x-profile-id") ?? null;

  const seasonRows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.weddingId, w.id))
    .orderBy(asc(seasons.number));

  const episodes = await db
    .select()
    .from(contentItems)
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(
      and(
        eq(contentItems.weddingId, w.id),
        eq(contentItems.status, "published"),
        profileVisibilityFilter(profileId),
      ),
    )
    .orderBy(asc(contentItems.episodeNumber));

  return ok(
    c,
    seasonRows.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      description: s.description,
      coverUrl: s.coverUrl,
      episodes: episodes
        .filter((e) => e.content_items.seasonId === s.id)
        .map((e) => toContentDto(e.content_items, e.media_assets)),
    })),
  );
});

// Anniversary / "on this day" feed produced by the memory engine.
weddingRoutes.get("/memory", async (c) => {
  const w = c.get("wedding");
  const rows = await db
    .select()
    .from(memoryFeed)
    .leftJoin(contentItems, eq(memoryFeed.contentItemId, contentItems.id))
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(eq(memoryFeed.weddingId, w.id))
    .orderBy(desc(memoryFeed.surfaceDate))
    .limit(30);

  return ok(
    c,
    rows.map((r) => ({
      id: r.memory_feed.id,
      kind: r.memory_feed.kind,
      surfaceDate: r.memory_feed.surfaceDate.toISOString(),
      payload: r.memory_feed.payload,
      content: r.content_items
        ? toContentDto(r.content_items, r.media_assets)
        : null,
    })),
  );
});

// Accept an invite — creates (or reuses) a viewer account + membership and
// returns a session token. Works for anonymous visitors.
weddingRoutes.post("/join", async (c) => {
  const w = c.get("wedding");
  const body = await readJson(
    c,
    z.object({
      token: z.string().min(8),
      name: z.string().min(1).max(80).optional(),
    }),
  );

  const invite = await db.query.invites.findFirst({
    where: and(
      eq(invites.weddingId, w.id),
      eq(invites.tokenHash, hashToken(body.token)),
    ),
  });
  if (!invite) throw errors.notFound("Invite not found");
  if (invite.expiresAt.getTime() < Date.now()) {
    throw errors.forbidden("This invite has expired");
  }
  if (invite.usedCount >= invite.maxUses) {
    throw errors.forbidden("This invite has already been used");
  }

  // Use the logged-in user, or create a lightweight viewer account.
  let user: User | undefined = c.get("user");
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({ name: body.name ?? "Guest" })
      .returning();
    user = inserted[0];
  }
  if (!user) throw errors.badRequest("Could not create an account");

  let membership = await findMembership(w.id, user.id);
  if (!membership) {
    const inserted = await db
      .insert(memberships)
      .values({
        weddingId: w.id,
        userId: user.id,
        role: invite.role,
        permissions: invite.permissions,
        displayName: body.name ?? user.name,
        invitedBy: invite.createdBy,
        status: "active",
      })
      .returning();
    membership = inserted[0];
    await db
      .update(invites)
      .set({ usedCount: invite.usedCount + 1 })
      .where(eq(invites.id, invite.id));
  }
  if (!membership) throw errors.badRequest("Could not create membership");

  const accessToken = await signSession(user.id);
  return ok(c, {
    accessToken,
    membershipId: membership.id,
    role: membership.role,
    permissions: membership.permissions,
  });
});
