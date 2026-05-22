import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { env } from "../config/env";
import { putObject, isR2Configured } from "./r2";

export { isR2Configured };

// Save an uploaded media file. Goes to Cloudflare R2 when configured,
// otherwise to the local uploads/ folder (development fallback).
// The returned `key` is the object key, stored on media_assets.providerId.
export async function saveMedia(
  weddingId: string,
  filename: string,
  data: Buffer,
  mimeType: string,
): Promise<{ key: string }> {
  const ext =
    (filename.split(".").pop() ?? "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
  const key = `weddings/${weddingId}/${crypto.randomUUID()}.${ext}`;

  if (isR2Configured()) {
    await putObject(key, data, mimeType);
  } else {
    const fullPath = join(env.UPLOAD_DIR, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }
  return { key };
}
