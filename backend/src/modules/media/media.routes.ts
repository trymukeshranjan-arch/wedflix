import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { mediaAssets } from "../../db/schema";
import { env } from "../../config/env";
import { errors } from "../../lib/errors";
import { getObject, isR2Configured } from "../../services/r2";
import type { AppEnv } from "../../lib/context";

export const mediaRoutes = new Hono<AppEnv>();

const PASS_THROUGH = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
];

// Serves an uploaded media asset:
//  - R2-stored  → streamed from R2, forwarding HTTP Range for video seeking
//  - local      → redirected to the static /uploads route
//  - external   → redirected to the stored URL (seeded sample videos)
mediaRoutes.get("/:assetId", async (c) => {
  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, c.req.param("assetId")),
  });
  if (!asset) throw errors.notFound("Media not found");

  if (asset.providerId) {
    if (isR2Configured()) {
      const upstream = await getObject(
        asset.providerId,
        c.req.header("range"),
      );
      if (!upstream.ok && upstream.status !== 206) {
        throw errors.notFound("Media not found");
      }
      const headers = new Headers();
      for (const h of PASS_THROUGH) {
        const v = upstream.headers.get(h);
        if (v) headers.set(h, v);
      }
      headers.set("Cache-Control", "public, max-age=3600");
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }
    return c.redirect(`/uploads/${asset.providerId}`);
  }

  // External URL (seeded sample videos / imported content).
  const external = asset.downloadUrl ?? asset.hlsUrl;
  if (external) return c.redirect(external);

  throw errors.notFound("Media is not available");
});
