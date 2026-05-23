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

// Per-wedding visual customisation. Every field is optional; the frontend
// falls back to platform defaults (Netflix-red primary, Playfair Display,
// etc.) when a field is absent.
export type HeadingFont =
  | "Playfair Display"
  | "Cormorant Garamond"
  | "Inter"
  | "Merriweather";
export type SizeScale = "small" | "medium" | "large";

export interface WeddingTheme {
  // Branding name shown in the nav header and footer (replaces "WEDFLIX").
  brandName?: string;
  // CSS-variable colour overrides. Stored as hex strings, e.g. "#E50914".
  primary?: string;
  accent?: string;
  // Font family used for couple names / row titles.
  headingFont?: HeadingFont;
  // Drives a CSS scale variable for heading sizes.
  headingScale?: SizeScale;
  // Drives the min-width of cards in content rows.
  thumbnailSize?: SizeScale;
  // Hero section height: short / medium / tall.
  heroHeight?: SizeScale;
  // Reserved for future use — short intro reel that plays before the hero.
  introVideoAssetId?: string;
}
