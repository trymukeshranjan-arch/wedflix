import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import {
  collections,
  collectionItems,
  contentItems,
  mediaAssets,
} from "../../db/schema";
import { toContentDto } from "../content/serialize";
import type { Wedding } from "../../lib/context";

// Public-facing wedding fields (branding / hero text).
export function publicWedding(w: Wedding) {
  return {
    id: w.id,
    slug: w.slug,
    coupleNameA: w.coupleNameA,
    coupleNameB: w.coupleNameB,
    tagline: w.tagline,
    weddingDate: w.weddingDate?.toISOString() ?? null,
    theme: w.theme,
    status: w.status,
  };
}

// Build the homepage payload: hero + content rows. The user portal omits
// drafts; the admin portal includes them so everything is editable.
export async function buildHome(
  wedding: Wedding,
  opts: { includeDrafts: boolean },
) {
  const where = opts.includeDrafts
    ? eq(contentItems.weddingId, wedding.id)
    : and(
        eq(contentItems.weddingId, wedding.id),
        eq(contentItems.status, "published"),
      );

  const rows = await db
    .select()
    .from(contentItems)
    .leftJoin(mediaAssets, eq(contentItems.primaryAssetId, mediaAssets.id))
    .where(where);

  const byId = new Map(rows.map((r) => [r.content_items.id, r]));

  let hero = null;
  if (wedding.heroContentId) {
    const r = byId.get(wedding.heroContentId);
    if (r) hero = toContentDto(r.content_items, r.media_assets);
  }

  const cols = await db
    .select()
    .from(collections)
    .where(eq(collections.weddingId, wedding.id))
    .orderBy(asc(collections.position));

  const links = cols.length
    ? await db
        .select()
        .from(collectionItems)
        .where(
          inArray(
            collectionItems.collectionId,
            cols.map((x) => x.id),
          ),
        )
        .orderBy(asc(collectionItems.position))
    : [];

  const rowsOut = cols.map((col) => ({
    id: col.id,
    title: col.title,
    items: links
      .filter((l) => l.collectionId === col.id)
      .map((l) => byId.get(l.contentItemId))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => toContentDto(r.content_items, r.media_assets)),
  }));

  return { wedding: publicWedding(wedding), hero, rows: rowsOut };
}
