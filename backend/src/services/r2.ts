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

// ── Multipart upload ─────────────────────────────────────────────────────────
// Large files are uploaded to R2 in parts. The browser sends each part to the
// API server in a separate request, so no single request approaches Cloud
// Run's 32 MiB cap, and the server never holds the whole file in memory.

// Begin a multipart upload; returns the R2 upload id.
export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const res = await r2.fetch(`${objectUrl(key)}?uploads`, {
    method: "POST",
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
  if (!res.ok) {
    throw new Error(`R2 multipart init failed (${res.status})`);
  }
  const xml = await res.text();
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error("R2 multipart init: missing UploadId");
  return uploadId;
}

// Upload one part; returns its ETag, needed to complete the upload.
export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Uint8Array,
): Promise<string> {
  const url = `${objectUrl(key)}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
  const res = await r2.fetch(url, { method: "PUT", body });
  if (!res.ok) {
    throw new Error(`R2 upload part ${partNumber} failed (${res.status})`);
  }
  const etag = res.headers.get("etag");
  if (!etag) throw new Error(`R2 upload part ${partNumber}: missing ETag`);
  return etag;
}

// Assemble the uploaded parts into the final object.
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  const xml =
    "<CompleteMultipartUpload>" +
    parts
      .map(
        (p) =>
          `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`,
      )
      .join("") +
    "</CompleteMultipartUpload>";
  const res = await r2.fetch(
    `${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`,
    { method: "POST", body: xml },
  );
  const text = await res.text();
  // CompleteMultipartUpload can return 200 with an <Error> body.
  if (!res.ok || text.includes("<Error>")) {
    throw new Error(`R2 multipart complete failed: ${text.slice(0, 200)}`);
  }
}

// Discard an interrupted multipart upload so its parts don't linger in R2.
export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  await r2.fetch(
    `${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`,
    { method: "DELETE" },
  );
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
