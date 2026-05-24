import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { mediaAssets } from "../../db/schema";
import { env } from "../../config/env";
import { errors } from "../../lib/errors";
import { getObject, isR2Configured } from "../../services/r2";
import type { AppEnv } from "../../lib/context";

export const mediaRoutes = new Hono<AppEnv>();

// Headers we forward from R2's response so the browser's <video> element
// has everything it needs to seek and report progress.
const PASS_THROUGH = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

// Serves an uploaded media asset:
//  - R2-stored  → R2 bytes are proxied through this route, with Range/seek
//                 pass-through. We can't 302-redirect to a presigned R2 URL
//                 because Chrome HEAD-probes a cross-origin <video src> and
//                 R2 returns 503 on HEAD via presigned URLs, which stalls
//                 the video. Proxying keeps the URL same-origin so no HEAD
//                 probe fires.
//  - local      → redirected to the static /uploads route
//  - external   → redirected to the stored URL (seeded sample videos)
mediaRoutes.get("/:assetId", async (c) => {
  const asset = await db.query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, c.req.param("assetId")),
  });
  if (!asset) throw errors.notFound("Media not found");

  if (asset.providerId) {
    if (isR2Configured()) {
      // Cap any single response at 8 MiB so we never try to stream a
      // multi-GB file through Cloud Run in one go — Cloud Run errors on
      // very large responses. The browser fetches the rest via subsequent
      // Range requests, which is the normal pattern for <video>.
      const MAX_CHUNK = 8 * 1024 * 1024;
      const rawRange = c.req.header("range") ?? "";
      const m = rawRange.match(/^bytes=(\d+)-(\d*)$/);
      const start = m ? parseInt(m[1]!, 10) : 0;
      const requestedEnd = m && m[2] ? parseInt(m[2], 10) : Infinity;
      const cappedEnd = Math.min(
        requestedEnd,
        start + MAX_CHUNK - 1,
      );
      // Always send a bounded Range upstream — even if the client didn't
      // send one — so R2 streams only the slice we want.
      const upstreamRange = `bytes=${start}-${cappedEnd}`;
      const upstream = await getObject(asset.providerId, upstreamRange);
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
