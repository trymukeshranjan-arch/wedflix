import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  studioRole,
  membershipRole,
  membershipStatus,
  weddingStatus,
  vaultPlan,
} from "./enums";
import type { Permission, StudioBranding, WeddingTheme } from "./types";

// A person — an admin (with a password) or an invited viewer (without one).
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone"),
    email: text("email"),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    // Set for admin/studio accounts that log in with email + password.
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_phone_idx").on(t.phone),
    uniqueIndex("users_email_idx").on(t.email),
  ],
);

// A photography studio / production house — the B2B customer (white-label).
// Direct couples live under a single platform-owned "house" studio.
export const studios = pgTable(
  "studios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    branding: jsonb("branding").$type<StudioBranding>().notNull().default({}),
    plan: text("plan").notNull().default("standard"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("studios_slug_idx").on(t.slug)],
);

export const studioMembers = pgTable(
  "studio_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: studioRole("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("studio_members_unique").on(t.studioId, t.userId)],
);

// A wedding = one tenant. Resolved from a subdomain or a custom domain.
export const weddings = pgTable(
  "weddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studios.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    customDomain: text("custom_domain"),
    coupleNameA: text("couple_name_a").notNull(),
    coupleNameB: text("couple_name_b").notNull(),
    tagline: text("tagline"),
    weddingDate: timestamp("wedding_date", { withTimezone: true }),
    // Points at a content_items row. No DB-level FK to avoid a circular
    // table dependency — enforced in the application layer.
    heroContentId: uuid("hero_content_id"),
    theme: jsonb("theme").$type<WeddingTheme>().notNull().default({}),
    status: weddingStatus("status").notNull().default("draft"),
    vaultPlan: vaultPlan("vault_plan").notNull().default("ten_year"),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("weddings_slug_idx").on(t.slug),
    uniqueIndex("weddings_custom_domain_idx").on(t.customDomain),
    index("weddings_studio_idx").on(t.studioId),
  ],
);

// User ↔ wedding link. This row IS the "profile" (Bride/Groom/Family/Friend).
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    permissions: jsonb("permissions")
      .$type<Permission[]>()
      .notNull()
      .default([]),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    status: membershipStatus("status").notNull().default("active"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_unique").on(t.weddingId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

// Invite link — invitee verifies via OTP, then a membership is created.
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id")
      .notNull()
      .references(() => weddings.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    role: membershipRole("role").notNull(),
    permissions: jsonb("permissions")
      .$type<Permission[]>()
      .notNull()
      .default([]),
    email: text("email"),
    phone: text("phone"),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invites_token_idx").on(t.tokenHash),
    index("invites_wedding_idx").on(t.weddingId),
  ],
);
