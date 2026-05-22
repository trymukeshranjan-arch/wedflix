# WEDFLIX — single-image build for Cloud Run.
# Builds the React frontend and bundles it into the Node/Hono backend, which
# serves both the API and the website from one service / one URL.

# ── Stage 1: build the frontend ──────────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build \
 && printf 'window.__WEDFLIX_CONFIG__={apiUrl:"/api/v1",weddingSlug:"bismita-debasish"};' > dist/config.js

# ── Stage 2: backend (also serves the bundled frontend) ──────────────────────
FROM node:22-slim
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
# --include=dev: tsx (the TypeScript runner used by `npm start`) is a devDep.
RUN npm ci --include=dev
COPY backend/ ./
COPY --from=frontend /fe/dist ./web

ENV NODE_ENV=production
ENV WEB_ROOT=./web

# Cloud Run injects PORT (8080 by default); the app reads process.env.PORT.
EXPOSE 8080

CMD ["npm", "start"]
