// Per-wedding visual customisation. The backend stores these on
// weddings.theme; both portals call applyTheme() on mount so the existing
// Tailwind classes (bg-primary, text-accent, …) pick up the right values.

export type HeadingFont =
  | "Playfair Display"
  | "Cormorant Garamond"
  | "Inter"
  | "Merriweather";
export type SizeScale = "small" | "medium" | "large";

export interface WeddingTheme {
  brandName?: string;
  primary?: string;
  accent?: string;
  headingFont?: HeadingFont;
  headingScale?: SizeScale;
  thumbnailSize?: SizeScale;
  heroHeight?: SizeScale;
}

// Stock defaults — kept here so unset fields always have something sensible.
export const DEFAULT_THEME = {
  brandName: "WEDFLIX",
  primary: "#E50914",
  accent: "#D4AF37",
  headingFont: "Playfair Display" as HeadingFont,
  headingScale: "medium" as SizeScale,
  thumbnailSize: "medium" as SizeScale,
  heroHeight: "large" as SizeScale,
} as const;

const HEADING_SCALE: Record<SizeScale, string> = {
  small: "0.85",
  medium: "1",
  large: "1.15",
};
const HERO_HEIGHT: Record<SizeScale, string> = {
  small: "70vh",
  medium: "85vh",
  large: "100vh",
};
const CARD_WIDTH: Record<SizeScale, [string, string]> = {
  small: ["200px", "220px"],
  medium: ["260px", "290px"],
  large: ["340px", "380px"],
};

// Resolve a theme partial against the platform defaults — every field
// returned here is a concrete value, so callers never deal with undefined.
export function resolveTheme(theme: WeddingTheme | undefined | null) {
  return {
    brandName: theme?.brandName?.trim() || DEFAULT_THEME.brandName,
    primary: theme?.primary || DEFAULT_THEME.primary,
    accent: theme?.accent || DEFAULT_THEME.accent,
    headingFont: theme?.headingFont ?? DEFAULT_THEME.headingFont,
    headingScale: theme?.headingScale ?? DEFAULT_THEME.headingScale,
    thumbnailSize: theme?.thumbnailSize ?? DEFAULT_THEME.thumbnailSize,
    heroHeight: theme?.heroHeight ?? DEFAULT_THEME.heroHeight,
  };
}

// Inject CSS variables on :root. Components use these via bg-primary,
// text-accent, var(--font-heading), etc.
export function applyTheme(theme: WeddingTheme | undefined | null): void {
  const t = resolveTheme(theme);
  const root = document.documentElement;
  root.style.setProperty("--primary", t.primary);
  root.style.setProperty("--ring", t.primary);
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--font-heading", `'${t.headingFont}', serif`);
  root.style.setProperty("--heading-scale", HEADING_SCALE[t.headingScale]);
  root.style.setProperty("--hero-h", HERO_HEIGHT[t.heroHeight]);
  const [w, wSm] = CARD_WIDTH[t.thumbnailSize];
  root.style.setProperty("--card-min-w", w);
  root.style.setProperty("--card-min-w-sm", wSm);
}
