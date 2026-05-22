import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { memberships } from "../db/schema";
import type { Membership } from "./context";

// Look up an active membership for a user in a wedding (undefined if none).
export async function findMembership(
  weddingId: string,
  userId: string | undefined,
): Promise<Membership | undefined> {
  if (!userId) return undefined;
  return db.query.memberships.findFirst({
    where: and(
      eq(memberships.weddingId, weddingId),
      eq(memberships.userId, userId),
      eq(memberships.status, "active"),
    ),
  });
}

// Can this caller view content with the given visibility?
//   all    → anyone with the link
//   family → any active member
//   couple → bride / groom / studio only
export function canView(
  visibility: string,
  membership: Membership | undefined,
): boolean {
  if (visibility === "all") return true;
  if (!membership) return false;
  if (visibility === "family") return true;
  if (visibility === "couple") {
    return ["bride", "groom", "studio"].includes(membership.role);
  }
  return false;
}
