// Default runtime config (development). In production the Docker container
// overwrites this file from the API_URL / WEDDING_SLUG environment variables.
window.__WEDFLIX_CONFIG__ = {
  apiUrl: "http://localhost:8787/api/v1",
  weddingSlug: "bismita-debasish",
};
