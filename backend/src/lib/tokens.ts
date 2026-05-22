import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// A URL-safe random token for invite links.
export function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

// Invite tokens are stored hashed — the raw value is shown to the creator once.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Constant-time HMAC comparison for webhook signature checks.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
