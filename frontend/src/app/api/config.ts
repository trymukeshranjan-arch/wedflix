// Runtime configuration.
// Priority: window.__WEDFLIX_CONFIG__ (injected by config.js — set per
// environment) → Vite build-time env vars → local-dev defaults.
const env =
  ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};

const runtime =
  (window as unknown as {
    __WEDFLIX_CONFIG__?: { apiUrl?: string; weddingSlug?: string };
  }).__WEDFLIX_CONFIG__ ?? {};

export const API_URL: string =
  runtime.apiUrl || env.VITE_API_URL || "http://localhost:8787/api/v1";

// Which wedding (tenant) this deployment targets.
export const WEDDING_SLUG: string =
  runtime.weddingSlug || env.VITE_WEDDING_SLUG || "bismita-debasish";
