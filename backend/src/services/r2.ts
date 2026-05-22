import { AwsClient } from "aws4fetch";
import { env } from "../config/env";

// Cloudflare R2 is S3-compatible — we sign requests with SigV4.
const r2 = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

// True once R2 credentials are configured.
export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
  );
}

function objectUrl(key: string): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
}

// Upload bytes to R2 under the given key.
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await r2.fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed (${res.status})`);
  }
}

// Fetch an object from R2, forwarding an optional HTTP Range header so the
// backend media route can stream video with seek support.
export async function getObject(
  key: string,
  range?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (range) headers["Range"] = range;
  return r2.fetch(objectUrl(key), { method: "GET", headers });
}
