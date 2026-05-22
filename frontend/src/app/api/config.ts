// Runtime configuration. Override via Vite env vars (VITE_API_URL etc.)
const env = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};

export const API_URL: string =
  env.VITE_API_URL || "http://localhost:8787/api/v1";

// Which wedding (tenant) this build targets. In production this comes from
// the subdomain; locally we send it as a header.
export const WEDDING_SLUG: string =
  env.VITE_WEDDING_SLUG || "bismita-debasish";
