import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`🎬 WEDFLIX API listening on http://localhost:${info.port}`);
});
