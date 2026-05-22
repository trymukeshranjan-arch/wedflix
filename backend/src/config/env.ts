import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGINS: z.string().default(""),
  ROOT_DOMAIN: z.string().default("wedflix.com"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Secret used to sign session JWTs. Generate with: openssl rand -hex 32
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),

  // Absolute or relative path where locally-uploaded media is stored
  // (used until Cloudflare Stream/R2 credentials are configured).
  UPLOAD_DIR: z.string().default("uploads"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:8787"),

  CF_ACCOUNT_ID: z.string().default(""),
  CF_STREAM_API_TOKEN: z.string().default(""),
  CF_STREAM_CUSTOMER_SUBDOMAIN: z.string().default(""),
  CF_STREAM_WEBHOOK_SECRET: z.string().default(""),

  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default("wedflix-media"),
  R2_PUBLIC_BASE_URL: z.string().default(""),

  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(7200),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // logger imports env, so use console here to avoid a circular import.
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
