# WEDFLIX frontend — React + Vite SPA. Deploys as a Cloud Run service.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve stage (nginx) ──────────────────────────────────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Injects the API URL into config.js at container startup (runtime config).
COPY docker-entrypoint.sh /docker-entrypoint.d/40-wedflix-config.sh
RUN chmod +x /docker-entrypoint.d/40-wedflix-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
