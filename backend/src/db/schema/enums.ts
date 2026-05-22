import { pgEnum } from "drizzle-orm/pg-core";

export const studioRole = pgEnum("studio_role", ["owner", "editor"]);

export const membershipRole = pgEnum("membership_role", [
  "bride",
  "groom",
  "parent",
  "family",
  "friend",
  "studio",
]);

export const membershipStatus = pgEnum("membership_status", [
  "pending",
  "active",
  "revoked",
]);

export const weddingStatus = pgEnum("wedding_status", [
  "draft",
  "live",
  "archived",
]);

export const vaultPlan = pgEnum("vault_plan", [
  "ten_year",
  "twenty_year",
  "lifetime",
]);

export const contentType = pgEnum("content_type", [
  "film",
  "episode",
  "teaser",
  "reel",
  "moment",
  "drone",
  "photo_album",
]);

export const contentVisibility = pgEnum("content_visibility", [
  "all", // anyone with the wedding link
  "family", // logged-in members only
  "couple", // bride/groom/studio only
]);

export const contentStatus = pgEnum("content_status", ["draft", "published"]);

export const mediaProvider = pgEnum("media_provider", ["stream", "r2"]);

export const mediaKind = pgEnum("media_kind", ["video", "image"]);

export const mediaStatus = pgEnum("media_status", [
  "uploading",
  "processing",
  "ready",
  "error",
]);

export const collectionKind = pgEnum("collection_kind", ["manual", "auto"]);

export const reactionTarget = pgEnum("reaction_target", ["content", "photo"]);

export const reactionType = pgEnum("reaction_type", ["like", "love"]);

export const memoryKind = pgEnum("memory_kind", [
  "on_this_day",
  "recap",
  "ai_reel",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "expired",
  "cancelled",
]);

export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);
