import { env } from "../../config/env";
import type { contentItems, mediaAssets } from "../../db/schema";

type ContentRow = typeof contentItems.$inferSelect;
type AssetRow = typeof mediaAssets.$inferSelect;

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// The wire shape consumed by the frontend.
export interface ContentDto {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  // Looping muted preview shown on cards — only exposed for public content.
  preview: string | null;
  duration: string;
  durationSeconds: number | null;
  eventDate: string | null;
  seasonId: string | null;
  episodeNumber: number | null;
  tags: string[];
  visibility: string;
  status: string;
  assetStatus: string | null;
  createdAt: string;
}

export function toContentDto(
  item: ContentRow,
  asset?: AssetRow | null,
): ContentDto {
  const durationSeconds = item.durationSeconds ?? asset?.durationSeconds ?? null;
  const isVideo = asset?.kind === "video";
  // Card previews stream through the backend media route; only exposed for
  // publicly-visible content.
  const preview =
    isVideo && asset && item.visibility === "all"
      ? `${env.PUBLIC_BASE_URL}/api/v1/media/${asset.id}`
      : null;
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    thumbnail: item.thumbnailUrl ?? asset?.thumbnailUrl ?? null,
    preview,
    duration: formatDuration(durationSeconds),
    durationSeconds,
    eventDate: item.eventDate ? item.eventDate.toISOString() : null,
    seasonId: item.seasonId,
    episodeNumber: item.episodeNumber,
    tags: item.tags,
    visibility: item.visibility,
    status: item.status,
    assetStatus: asset?.status ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}
