import type { WeddingTheme } from "../lib/theme";

export interface ContentItem {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  preview: string | null;
  duration: string;
  durationSeconds: number | null;
  eventDate: string | null;
  seasonId: string | null;
  episodeNumber: number | null;
  tags: string[];
  visibility: string;
  // Profile IDs allowed to see this item. Empty = visible to everyone.
  visibleProfileIds: string[];
  status: string;
  assetStatus: string | null;
  createdAt: string;
}

export interface WeddingInfo {
  id: string;
  slug: string;
  coupleNameA: string;
  coupleNameB: string;
  tagline: string | null;
  starring: string | null;
  weddingDate: string | null;
  theme: WeddingTheme;
  status: string;
}

export interface ContentRowData {
  id: string;
  title: string;
  items: ContentItem[];
}

export interface HomeData {
  wedding: WeddingInfo;
  hero: ContentItem | null;
  rows: ContentRowData[];
}

export interface SeasonData {
  id: string;
  number: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  episodes: ContentItem[];
}

export interface PlaybackData {
  src: string;
  kind: "hls" | "mp4";
  expiresIn: number | null;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
}
