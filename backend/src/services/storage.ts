import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { env } from "../config/env";
import { putObject, isR2Configured } from "./r2";

export { isR2Configured };

// Build the storage object key for an upload. Shared by saveMedia (the local
// multipart path) and the presigned-upload route so both use one scheme.
export function mediaKey(weddingId: string, filename: string): string {
  const ext =
    (filename.split(".").pop() ?? "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
  return `weddings/${weddingId}/${crypto.randomUUID()}.${ext}`;
}

// Save an uploaded media file. Goes to Cloudflare R2 when configured,
// otherwise to the local uploads/ folder (development fallback).
// The returned `key` is the object key, stored on media_assets.providerId.
export async function saveMedia(
  weddingId: string,
  filename: string,
  data: Buffer,
  mimeType: string,
): Promise<{ key: string }> {
  const key = mediaKey(weddingId, filename);

  if (isR2Configured()) {
    await putObject(key, data, mimeType);
  } else {
    const fullPath = join(env.UPLOAD_DIR, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }
  return { key };
}
