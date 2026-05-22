import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { reactionTarget, reactionType } from "./enums";
import { weddings, memberships } from "./identity";
import { contentItems } from "./content";

// "Continue watching" — one row per (member, content).
export const watchProgress = pgTable(
  "watch_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("watch_progress_unique").on(
      t.membershipId,
      t.contentItemId,
    ),
  ],
);

// Likes / loves on a content item or a photo.
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    targetType: reactionTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    type: reactionType("type").notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("reactions_unique").on(
      t.membershipId,
      t.targetType,
      t.targetId,
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comments_content_idx").on(t.contentItemId)],
);

// Raw playback analytics — feeds watch-time / engagement metrics.
export const viewEvents = pgTable(
  "view_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    contentItemId: uuid("content_item_id").references(
      () => contentItems.id,
      { onDelete: "set null" },
    ),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    device: text("device"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("view_events_wedding_idx").on(t.weddingId, t.createdAt)],
);
