import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env";
import { errors } from "../lib/errors";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const SESSION_TTL = "30d";

// ── Password hashing (scrypt — no external dependency) ───────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

// ── Session JWTs ─────────────────────────────────────────────────────────────

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ type: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret);
}

// Verify a session token and return the user id it belongs to.
export async function verifySession(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) throw new Error("missing subject");
    return payload.sub;
  } catch {
    throw errors.unauthorized("Invalid or expired session");
  }
}
