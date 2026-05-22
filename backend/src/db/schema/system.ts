import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { memoryKind, subscriptionStatus, jobStatus, vaultPlan } from "./enums";
import { weddings, memberships } from "./identity";
import { contentItems, mediaAssets } from "./content";

// Anniversary / "on this day" cards surfaced by the memory engine cron.
export const memoryFeed = pgTable(
  "memory_feed",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id").references(
      () => contentItems.id,
      { onDelete: "cascade" },
    ),
    kind: memoryKind("kind").notNull(),
    surfaceDate: timestamp("surface_date", { withTimezone: true }).notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("memory_feed_wedding_idx").on(t.weddingId, t.surfaceDate)],
);

// Background job ledger — transcoding callbacks, recap/AI reel generation.
export const jobsLog = pgTable("jobs_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").references(() => weddings.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  status: jobStatus("status").notNull().default("queued"),
  outputAssetId: uuid("output_asset_id").references(() => mediaAssets.id, {
    onDelete: "set null",
  }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Wedding vault package — what the couple/studio paid for.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    plan: vaultPlan("plan").notNull(),
    amount: integer("amount").notNull().default(0), // smallest currency unit
    currency: text("currency").notNull().default("INR"),
    providerRef: text("provider_ref"), // Razorpay payment/order id
    status: subscriptionStatus("status").notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("subscriptions_wedding_idx").on(t.weddingId)],
);

// Append-only audit trail for sensitive actions (uploads, deletes, access).
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").references(() => weddings.id, {
    onDelete: "cascade",
  }),
  actorMembershipId: uuid("actor_membership_id").references(
    () => memberships.id,
    { onDelete: "set null" },
  ),
  action: text("action").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
