import { API_URL, WEDDING_SLUG } from "./config";

const TOKEN_KEY = "wedflix.token";

// Which wedding (tenant) API calls target. Defaults to the configured
// wedding; the /w/:slug router updates it per the URL.
let currentSlug: string = WEDDING_SLUG;
export function setWeddingSlug(slug: string) {
  if (slug) currentSlug = slug;
}
export function getWeddingSlug(): string {
  return currentSlug;
}

// Which "Who's watching" profile the viewer is currently on. Sent on every
// request as `X-Profile-Id` so the backend can filter per-profile-restricted
// content. Cleared (null) when no profile is selected.
let currentProfileId: string | null = null;
export function setProfileId(id: string | null) {
  currentProfileId = id;
}

// Media URLs returned by the API are root-relative (/api/v1/media/...).
// Resolve them against the API origin so they work both when the frontend
// is same-origin as the API (production) and on a separate dev port.
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");
export function mediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown; // sent as JSON
  formData?: FormData; // sent as multipart
  raw?: BodyInit; // sent as-is (e.g. a Blob chunk for upload)
}

// Single typed entry point for every API call. Always scopes requests to the
// current wedding tenant and attaches the session token when present.
export async function api<T>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Wedding-Slug": currentSlug,
  };
  if (currentProfileId) headers["X-Profile-Id"] = currentProfileId;
  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.raw !== undefined) {
    body = opts.raw;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } })
      .error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? "Something went wrong",
    );
  }
  return (json as { data: T }).data;
}
