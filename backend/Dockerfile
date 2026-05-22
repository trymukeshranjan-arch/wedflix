# WEDFLIX backend — Hono API. Deploys as a Cloud Run service.
FROM node:22-slim

WORKDIR /app

# Install dependencies. --include=dev because tsx (the TypeScript runner
# used by `npm start`) is a devDependency.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

ENV NODE_ENV=production

# Cloud Run injects PORT (8080 by default); the app reads process.env.PORT.
EXPOSE 8080

CMD ["npm", "start"]
