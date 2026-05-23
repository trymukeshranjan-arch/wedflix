import { useEffect, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { api, ApiError } from "../api/client";
import type { WeddingInfo } from "../api/types";
import {
  DEFAULT_THEME,
  applyTheme,
  resolveTheme,
  type HeadingFont,
  type SizeScale,
  type WeddingTheme,
} from "../lib/theme";

const HEADING_FONTS: HeadingFont[] = [
  "Playfair Display",
  "Cormorant Garamond",
  "Inter",
  "Merriweather",
];
const SIZE_OPTIONS: { value: SizeScale; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

// Per-wedding visual customisation. Edits preview live on the admin portal
// as the user changes fields, and revert if they Cancel without saving.
export function ThemeModal({
  wedding,
  onClose,
  onSaved,
}: {
  wedding: WeddingInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Start from a fully-resolved theme so every control has a concrete value.
  const initial = resolveTheme(wedding.theme);
  const originalTheme = wedding.theme;

  const [brandName, setBrandName] = useState(initial.brandName);
  const [primary, setPrimary] = useState(initial.primary);
  const [accent, setAccent] = useState(initial.accent);
  const [headingFont, setHeadingFont] = useState<HeadingFont>(
    initial.headingFont,
  );
  const [headingScale, setHeadingScale] = useState<SizeScale>(
    initial.headingScale,
  );
  const [thumbnailSize, setThumbnailSize] = useState<SizeScale>(
    initial.thumbnailSize,
  );
  const [heroHeight, setHeroHeight] = useState<SizeScale>(initial.heroHeight);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview on the admin portal as the user tweaks values.
  useEffect(() => {
    applyTheme({
      brandName,
      primary,
      accent,
      headingFont,
      headingScale,
      thumbnailSize,
      heroHeight,
    });
  }, [
    brandName,
    primary,
    accent,
    headingFont,
    headingScale,
    thumbnailSize,
    heroHeight,
  ]);

  // Revert the live preview if the user closes without saving.
  const handleClose = () => {
    applyTheme(originalTheme);
    onClose();
  };

  const resetToDefaults = () => {
    setBrandName(DEFAULT_THEME.brandName);
    setPrimary(DEFAULT_THEME.primary);
    setAccent(DEFAULT_THEME.accent);
    setHeadingFont(DEFAULT_THEME.headingFont);
    setHeadingScale(DEFAULT_THEME.headingScale);
    setThumbnailSize(DEFAULT_THEME.thumbnailSize);
    setHeroHeight(DEFAULT_THEME.heroHeight);
  };

  const save = async () => {
    setSubmitting(true);
    setError(null);
    const theme: WeddingTheme = {
      brandName: brandName.trim() || undefined,
      primary,
      accent,
      headingFont,
      headingScale,
      thumbnailSize,
      heroHeight,
    };
    try {
      await api("/admin/wedding", {
        method: "PATCH",
        body: { theme },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save theme");
    } finally {
      setSubmitting(false);
    }
  };

  const label = "text-xs text-muted-foreground uppercase tracking-wider";
  const field =
    "mt-1 w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors text-sm";

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Theme &amp; branding</h3>
            <p className="text-xs text-muted-foreground">
              Changes preview live; click Save to apply.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={label}>Brand name</label>
            <input
              className={field}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="WEDFLIX"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground/70 mt-1">
              Shown in the nav and footer. Defaults to “WEDFLIX”.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Primary color</label>
              <ColorInput value={primary} onChange={setPrimary} />
            </div>
            <div>
              <label className={label}>Accent color</label>
              <ColorInput value={accent} onChange={setAccent} />
            </div>
          </div>

          <div>
            <label className={label}>Heading font</label>
            <select
              className={field}
              value={headingFont}
              onChange={(e) => setHeadingFont(e.target.value as HeadingFont)}
            >
              {HEADING_FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>
                  {f}
                </option>
              ))}
            </select>
            <p
              className="text-base mt-2"
              style={{ fontFamily: `'${headingFont}', serif` }}
            >
              Preview — {wedding.coupleNameA} &amp; {wedding.coupleNameB}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SizePicker
              label="Text size"
              value={headingScale}
              onChange={setHeadingScale}
            />
            <SizePicker
              label="Thumbnail size"
              value={thumbnailSize}
              onChange={setThumbnailSize}
            />
            <SizePicker
              label="Hero height"
              value={heroHeight}
              onChange={setHeroHeight}
            />
          </div>

          {error && (
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded px-5 py-2 transition-all disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Combined swatch + hex input. Keeping the two synced makes the field
// usable both for casual tweaks and exact brand-colour matches.
function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="mt-1 flex items-center gap-2">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-10 h-10 rounded cursor-pointer bg-transparent border border-border"
        aria-label="Color picker"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors text-sm font-mono"
        placeholder="#000000"
        maxLength={7}
      />
    </div>
  );
}

function SizePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SizeScale;
  onChange: (v: SizeScale) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-1 flex rounded border border-border overflow-hidden">
        {SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-xs py-2 transition-colors ${
              value === opt.value
                ? "bg-accent text-accent-foreground font-semibold"
                : "bg-background hover:bg-foreground/5 text-muted-foreground"
            }`}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
