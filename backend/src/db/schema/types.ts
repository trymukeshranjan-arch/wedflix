// Shared domain types embedded in JSONB columns.

export type Permission = "view" | "download" | "upload" | "comment" | "manage";

export const ALL_PERMISSIONS: Permission[] = [
  "view",
  "download",
  "upload",
  "comment",
  "manage",
];

export interface StudioBranding {
  logoUrl?: string;
  primaryColor?: string;
  poweredBy?: boolean;
}

export interface WeddingTheme {
  primary?: string; // Netflix red by default
  accent?: string; // soft gold
  headingFont?: string;
  introVideoAssetId?: string;
}
