import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { weddings } from "../db/schema";
import { env } from "../config/env";
import { errors } from "../lib/errors";
import type { AppEnv } from "../lib/context";

// Resolve which wedding (tenant) a request belongs to.
// Priority: explicit X-Wedding-Slug header (local dev / authoring app)
//   → custom domain → subdomain of ROOT_DOMAIN.
export const resolveTenant = createMiddleware<AppEnv>(async (c, next) => {
  const rawHost = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "";
  const host = rawHost.split(":")[0].toLowerCase();
  const explicitSlug = c.req.header("x-wedding-slug");

  let wedding;
  if (explicitSlug) {
    wedding = await db.query.weddings.findFirst({
      where: eq(weddings.slug, explicitSlug.toLowerCase()),
    });
  } else if (host.endsWith(`.${env.ROOT_DOMAIN}`)) {
    const slug = host.slice(0, host.length - env.ROOT_DOMAIN.length - 1);
    wedding = await db.query.weddings.findFirst({
      where: eq(weddings.slug, slug),
    });
  } else if (host) {
    wedding = await db.query.weddings.findFirst({
      where: eq(weddings.customDomain, host),
    });
  }

  if (!wedding || wedding.status === "archived") {
    throw errors.tenantNotFound();
  }

  c.set("wedding", wedding);
  await next();
});
