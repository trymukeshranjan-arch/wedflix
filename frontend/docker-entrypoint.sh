#!/bin/sh
# Writes runtime config (API URL) into config.js before nginx starts, so the
# same image works in any environment by just changing env vars.
set -e
API_URL="${API_URL:-http://localhost:8787/api/v1}"
WEDDING_SLUG="${WEDDING_SLUG:-bismita-debasish}"
cat > /usr/share/nginx/html/config.js <<EOF
window.__WEDFLIX_CONFIG__ = { apiUrl: "${API_URL}", weddingSlug: "${WEDDING_SLUG}" };
EOF
