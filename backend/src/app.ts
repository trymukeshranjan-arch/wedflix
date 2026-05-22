import { readFileSync } from "node:fs";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { AppError } from "./lib/errors";
import { resolveTenant } from "./middleware/tenant";
import { requireAuth, optionalAuth } from "./middleware/auth";
import { requireMembership } from "./middleware/authorize";
import { authRoutes } from "./modules/auth/auth.routes";
import { weddingRoutes } from "./modules/wedding/wedding.routes";
import { contentRoutes } from "./modules/content/content.routes";
import { engagementRoutes } from "./modules/engagement/engagement.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { webhookRoutes } from "./modules/webhooks/webhooks.routes";
import { mediaRoutes } from "./modules/media/media.routes";
import type { AppEnv } from "./lib/context";

export const app = new Hono<AppEnv>();

app.use("*", honoLogger((msg) => logger.info(msg)));
app.use(
  "*",
  cors({
    origin: env.corsOrigins.length ? env.corsOrigins : "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Wedding-Slug"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

app.get("/health", (c) =>
  c.json({ status: "ok", service: "wedflix-api" }),
);

// Serve locally-uploaded media (used until Cloudflare Stream/R2 is configured).
app.use("/uploads/*", serveStatic({ root: "./" }));

const v1 = new Hono<AppEnv>();

// No tenant required.
v1.route("/auth", authRoutes);
v1.route("/webhooks", webhookRoutes);
v1.route("/media", mediaRoutes);

// Tenant middleware, scoped per prefix (registered before the routes).
v1.use("/wedding", resolveTenant, optionalAuth);
v1.use("/wedding/*", resolveTenant, optionalAuth);
v1.use("/content/*", resolveTenant, optionalAuth);
v1.use("/engagement/*", resolveTenant, requireAuth, requireMembership);
v1.use("/admin/*", resolveTenant, requireAuth, requireMembership);

v1.route("/wedding", weddingRoutes);
v1.route("/content", contentRoutes);
v1.route("/engagement", engagementRoutes);
v1.route("/admin", adminRoutes);

app.route("/api/v1", v1);

// Serve the bundled frontend (single-image deploy). When WEB_ROOT is set,
// this server also serves the React SPA — same origin as the API.
let indexHtml = "";
if (env.WEB_ROOT) {
  try {
    indexHtml = readFileSync(`${env.WEB_ROOT}/index.html`, "utf8");
  } catch {
    logger.warn(`WEB_ROOT set but ${env.WEB_ROOT}/index.html is missing`);
  }
  app.use("*", serveStatic({ root: env.WEB_ROOT }));
}

app.notFound((c) => {
  // SPA fallback — non-API routes serve the frontend's index.html so that
  // client-side routes like /admin work on a full page load.
  if (indexHtml && !c.req.path.startsWith("/api")) {
    return c.html(indexHtml);
  }
  return c.json(
    { error: { code: "not_found", message: "Route not found" } },
    404,
  );
});

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as ContentfulStatusCode,
    );
  }
  logger.error({ err }, "unhandled error");
  return c.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    500,
  );
});
