// Seeds the demo wedding "Bismita ∞ Debasish" — mirrors the hardcoded
// content in the frontend prototype so the API is demoable end-to-end.
//   Run with:  npm run db:seed
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "./client";
import {
  studios,
  weddings,
  seasons,
  mediaAssets,
  contentItems,
  collections,
  collectionItems,
  users,
  memberships,
  profiles,
} from "./schema";
import { hashPassword } from "../services/auth";

const ADMIN_EMAIL = "admin@wedflix.test";
const ADMIN_PASSWORD = "admin123";

const WEDDING_SLUG = "bismita-debasish";

// Public sample videos — replaced by Cloudflare Stream uploads in production.
const V = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
];

const thumb = (id: string, w = 800, h = 450) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

const dur = (s: string): number => {
  const p = s.split(":").map(Number);
  return p.length === 3
    ? p[0] * 3600 + p[1] * 60 + p[2]
    : p[0] * 60 + p[1];
};

interface SeedItem {
  title: string;
  subtitle: string;
  photo: string;
  duration: string;
  video: string;
}

const ROWS: {
  title: string;
  type: "episode" | "film" | "moment";
  items: SeedItem[];
}[] = [
  {
    title: "The Celebration Series",
    type: "episode",
    items: [
      { title: "Mehendi Night", subtitle: "A Night of Colors", photo: "1630526720753-aa4e71acf67d", duration: "1:24:00", video: V[0] },
      { title: "Haldi Ceremony", subtitle: "Golden Memories", photo: "1665960213508-48f07086d49c", duration: "48:00", video: V[1] },
      { title: "Sangeet Night", subtitle: "Dance of Love", photo: "1583939411023-14783179e581", duration: "2:01:00", video: V[2] },
      { title: "Wedding Day", subtitle: "Forever Begins", photo: "1727430256509-0f897d6f4765", duration: "3:45:00", video: V[3] },
      { title: "Reception", subtitle: "Celebration of Love", photo: "1714972383570-44ddc9738355", duration: "2:30:00", video: V[4] },
    ],
  },
  {
    title: "Our Films",
    type: "film",
    items: [
      { title: "Pre Wedding Film", subtitle: "Before Forever", photo: "1481653125770-b78c206c59d4", duration: "12:00", video: V[5] },
      { title: "Wedding Teaser", subtitle: "Love Story", photo: "1648154164366-d067faecdc51", duration: "3:00", video: V[6] },
      { title: "Highlights Film", subtitle: "Best Moments", photo: "1633104502699-b2ecf0fee294", duration: "25:00", video: V[7] },
      { title: "Full Wedding Film", subtitle: "Complete Journey", photo: "1610173826608-bd1f53a52db1", duration: "1:45:00", video: V[0] },
      { title: "Proposal Film", subtitle: "The Beginning", photo: "1640953148126-1962ec17a92b", duration: "8:00", video: V[1] },
    ],
  },
  {
    title: "Little Moments",
    type: "moment",
    items: [
      { title: "Bride Entry", subtitle: "Pure Magic", photo: "1733759414886-6b3a5423ceb3", duration: "5:00", video: V[2] },
      { title: "First Look", subtitle: "Emotional Moment", photo: "1587271339318-2e78fdf79586", duration: "4:00", video: V[3] },
      { title: "Sacred Vows", subtitle: "Promise Forever", photo: "1774020039310-e5f1986f09b0", duration: "18:00", video: V[4] },
      { title: "Dance Floor", subtitle: "Celebration", photo: "1482575832494-771f74bf6857", duration: "45:00", video: V[5] },
      { title: "Family Joy", subtitle: "Love & Laughter", photo: "1595667087426-0c5ef79a3148", duration: "30:00", video: V[6] },
    ],
  },
  {
    title: "Emotional Scenes",
    type: "moment",
    items: [
      { title: "Vidaai", subtitle: "Farewell", photo: "1764380749932-57ad1cb79a07", duration: "15:00", video: V[7] },
      { title: "Father's Blessing", subtitle: "Pure Love", photo: "1774020040280-23c73c24ffbc", duration: "6:00", video: V[0] },
      { title: "Mother's Joy", subtitle: "Tears of Happiness", photo: "1774020040126-83543f6de513", duration: "4:00", video: V[1] },
      { title: "Couple Moments", subtitle: "Pure Connection", photo: "1774020040056-feb5f9358cfb", duration: "20:00", video: V[2] },
      { title: "Sacred Pheras", subtitle: "Sacred Union", photo: "1774020039310-e5f1986f09b0", duration: "35:00", video: V[3] },
    ],
  },
];

export async function seedDatabase() {
  // Idempotent — wipe and recreate the demo wedding (cascades to content).
  await db.delete(weddings).where(eq(weddings.slug, WEDDING_SLUG));

  const [studio] = await db
    .insert(studios)
    .values({ name: "WEDFLIX House", slug: "wedflix-house" })
    .onConflictDoUpdate({
      target: studios.slug,
      set: { name: "WEDFLIX House" },
    })
    .returning();

  const [wedding] = await db
    .insert(weddings)
    .values({
      studioId: studio!.id,
      slug: WEDDING_SLUG,
      coupleNameA: "Bismita",
      coupleNameB: "Debasish",
      tagline: "A Cinematic Wedding Journey · 2024",
      weddingDate: new Date("2024-12-08"),
      theme: {
        primary: "#E50914",
        accent: "#C9A24B",
        headingFont: "Playfair Display",
      },
      status: "live",
      vaultPlan: "lifetime",
    })
    .returning();
  const wId = wedding!.id;

  // Admin account — logs into the admin portal with email + password.
  const [admin] = await db
    .insert(users)
    .values({
      name: "WEDFLIX Admin",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_PASSWORD),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash: hashPassword(ADMIN_PASSWORD), name: "WEDFLIX Admin" },
    })
    .returning();
  await db.insert(memberships).values({
    weddingId: wId,
    userId: admin!.id,
    role: "studio",
    permissions: ["view", "download", "upload", "comment", "manage"],
    displayName: "Admin",
    status: "active",
  });

  // "Who's watching" profiles for the demo wedding.
  await db.insert(profiles).values([
    { weddingId: wId, name: "Bismita", sortOrder: 0 },
    { weddingId: wId, name: "Debasish", sortOrder: 1 },
    { weddingId: wId, name: "Family", sortOrder: 2 },
    { weddingId: wId, name: "Friends", sortOrder: 3 },
  ]);

  const [season] = await db
    .insert(seasons)
    .values({
      weddingId: wId,
      number: 1,
      title: "Season 1 — The Wedding",
      description: "Every ceremony, every ritual, every tear of joy.",
    })
    .returning();

  async function createContent(opts: {
    type: "episode" | "film" | "moment";
    title: string;
    subtitle: string;
    thumbnail: string;
    video: string;
    durationSeconds: number;
    seasonId?: string;
    episodeNumber?: number;
    tags?: string[];
  }): Promise<string> {
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        weddingId: wId,
        provider: "r2",
        kind: "video",
        status: "ready",
        // External sample video — the media route redirects to this URL.
        downloadUrl: opts.video,
        hlsUrl: opts.video,
        durationSeconds: opts.durationSeconds,
        thumbnailUrl: opts.thumbnail,
      })
      .returning();

    const [item] = await db
      .insert(contentItems)
      .values({
        weddingId: wId,
        seasonId: opts.seasonId,
        type: opts.type,
        title: opts.title,
        subtitle: opts.subtitle,
        thumbnailUrl: opts.thumbnail,
        durationSeconds: opts.durationSeconds,
        primaryAssetId: asset!.id,
        episodeNumber: opts.episodeNumber,
        visibility: "all",
        status: "published",
        publishedAt: new Date(),
        tags: opts.tags ?? [],
      })
      .returning();
    return item!.id;
  }

  const heroId = await createContent({
    type: "film",
    title: "BISMITA ∞ DEBASISH",
    subtitle: "A Cinematic Wedding Journey · 2024",
    thumbnail: thumb("1519741497674-611481863552", 1920, 1080),
    video: V[0],
    durationSeconds: dur("3:45:00"),
    tags: ["Wedding", "Love Story", "Family", "Cinematic", "Emotional"],
  });
  await db
    .update(weddings)
    .set({ heroContentId: heroId })
    .where(eq(weddings.id, wId));

  let collectionPos = 0;
  let total = 1;
  for (const row of ROWS) {
    const [collection] = await db
      .insert(collections)
      .values({
        weddingId: wId,
        title: row.title,
        kind: "manual",
        position: collectionPos++,
      })
      .returning();

    let episodeNumber = 1;
    let itemPos = 0;
    for (const it of row.items) {
      const contentId = await createContent({
        type: row.type,
        title: it.title,
        subtitle: it.subtitle,
        thumbnail: thumb(it.photo),
        video: it.video,
        durationSeconds: dur(it.duration),
        seasonId: row.type === "episode" ? season!.id : undefined,
        episodeNumber: row.type === "episode" ? episodeNumber++ : undefined,
      });
      await db.insert(collectionItems).values({
        collectionId: collection!.id,
        contentItemId: contentId,
        position: itemPos++,
      });
      total++;
    }
  }

  console.log(
    `✅ Seeded wedding "${WEDDING_SLUG}" — ${total} content items across ${ROWS.length} rows.`,
  );
  console.log(
    `   Admin login →  email: ${ADMIN_EMAIL}   password: ${ADMIN_PASSWORD}`,
  );
}

// Run as a CLI when invoked directly (npm run db:seed).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
