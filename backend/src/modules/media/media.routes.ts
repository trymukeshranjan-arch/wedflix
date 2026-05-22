import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { mediaAssets } from "../../db/schema";
import { env } from "../../config/env";
import { errors } from "../../lib/errors";
import { presignGetUrl, isR2Configured } from "../../services/r2";
import type { AppEnv } from "../../lib/context";

export const mediaRoutes = new Hono<AppEnv>();

// Serves an uploaded media asset:
//  - R2-stored  → redirected to a short-lived signed R2 URL, so the browser
//                 streams (with Range/seek) straight from R2
//  - local      → redirected to the static /uploads route
//  - external   → redirected to the stored URL (seeded sample videos)
mediaRoutes.get("/:assetId", async (c) => {
  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, c.req.param("assetId")),
  });
  if (!asset) throw errors.notFound("Media not found");

  if (asset.providerId) {
    if (isR2Configured()) {
      return c.redirect(await presignGetUrl(asset.providerId));
    }
    return c.redirect(`/uploads/${asset.providerId}`);
  }

  // External URL (seeded sample videos / imported content).
  const external = asset.downloadUrl ?? asset.hlsUrl;
  if (external) return c.redirect(external);

  throw errors.notFound("Media is not available");
});
