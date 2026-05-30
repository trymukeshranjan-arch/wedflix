import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import {
  contentType,
  contentVisibility,
  contentStatus,
  mediaProvider,
  mediaKind,
  mediaStatus,
  collectionKind,
} from "./enums";
import { weddings } from "./identity";

// Seasons — "Season 1: The Wedding", "Season 2: First Anniversary", etc.
export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("seasons_wedding_idx").on(t.weddingId)],
);

// The actual uploaded file. Lives in Cloudflare Stream (video) or R2 (image).
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    provider: mediaProvider("provider").notNull(),
    kind: mediaKind("kind").notNull(),
    status: mediaStatus("status").notNull().default("uploading"),
    providerId: text("provider_id"), // Stream uid / R2 object key
    playbackId: text("playback_id"), // Stream playback id
    hlsUrl: text("hls_url"),
    downloadUrl: text("download_url"),
    thumbnailUrl: text("thumbnail_url"),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("media_assets_wedding_idx").on(t.weddingId),
    index("media_assets_provider_idx").on(t.provider, t.providerId),
  ],
);

// A logical, playable/viewable entry — what shows up in a content row.
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => seasons.id, {
      onDelete: "set null",
    }),
    type: contentType("type").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    episodeNumber: integer("episode_number"),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    primaryAssetId: uuid("primary_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    visibility: contentVisibility("visibility").notNull().default("all"),
    // New per-profile visibility: empty array = everyone, populated = only
    // listed profiles see this item. Filtered server-side via X-Profile-Id.
    visibleProfileIds: uuid("visible_profile_ids")
      .array()
      .notNull()
      .default([]),
    status: contentStatus("status").notNull().default("draft"),
    tags: text("tags").array().notNull().default([]),
    viewCount: integer("view_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("content_items_wedding_idx").on(t.weddingId),
    index("content_items_season_idx").on(t.seasonId),
    index("content_items_type_idx").on(t.weddingId, t.type),
  ],
);

// A curated homepage row ("The Celebration Series", "Our Films", ...).
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: collectionKind("kind").notNull().default("manual"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("collections_wedding_idx").on(t.weddingId)],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("collection_items_unique").on(
      t.collectionId,
      t.contentItemId,
    ),
  ],
);

// People who can be tagged in content ("people tagged" panel).
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relation: text("relation"),
    avatarUrl: text("avatar_url"),
  },
  (t) => [index("people_wedding_idx").on(t.weddingId)],
);

export const contentPeople = pgTable(
  "content_people",
  {
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contentItemId, t.personId] })],
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("albums_wedding_idx").on(t.weddingId)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    caption: text("caption"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("photos_album_idx").on(t.albumId)],
);
