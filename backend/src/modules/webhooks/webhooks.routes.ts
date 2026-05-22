import { Hono } from "hono";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { mediaAssets } from "../../db/schema";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { safeEqual } from "../../lib/tokens";

export const webhookRoutes = new Hono();

// Cloudflare signs webhooks as "time=<unix>,sig1=<hmac-sha256-hex>",
// where the signed payload is `${time}.${rawBody}`.
function verifySignature(header: string | undefined, rawBody: string): boolean {
  if (!env.CF_STREAM_WEBHOOK_SECRET) {
    logger.warn(
      "CF_STREAM_WEBHOOK_SECRET unset — accepting webhook without verification",
    );
    return true;
  }
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k ?? "", v ?? ""];
    }),
  );
  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;
  const expected = createHmac("sha256", env.CF_STREAM_WEBHOOK_SECRET)
    .update(`${time}.${rawBody}`)
    .digest("hex");
  return safeEqual(sig, expected);
}

interface StreamWebhook {
  uid?: string;
  readyToStream?: boolean;
  status?: { state?: string };
  duration?: number;
  thumbnail?: string;
  input?: { width?: number; height?: number };
}

// Cloudflare Stream calls this when a video finishes (or fails) encoding.
webhookRoutes.post("/cloudflare-stream", async (c) => {
  const rawBody = await c.req.text();
  if (!verifySignature(c.req.header("webhook-signature"), rawBody)) {
    return c.json({ error: "invalid signature" }, 401);
  }

  const payload = JSON.parse(rawBody) as StreamWebhook;
  if (!payload.uid) return c.json({ received: true });

  const state = payload.status?.state;
  const status =
    state === "ready" || payload.readyToStream
      ? "ready"
      : state === "error"
        ? "error"
        : "processing";

  await db
    .update(mediaAssets)
    .set({
      status,
      playbackId: payload.uid,
      durationSeconds: payload.duration
        ? Math.round(payload.duration)
        : undefined,
      thumbnailUrl: payload.thumbnail,
      width: payload.input?.width,
      height: payload.input?.height,
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.providerId, payload.uid));

  logger.info({ uid: payload.uid, status }, "stream webhook processed");
  return c.json({ received: true });
});
