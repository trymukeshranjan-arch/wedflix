import type { Permission } from "../db/schema";

// Default permission set granted to each role on invite. Individual
// memberships can be overridden later via the admin API.
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  bride: ["view", "download", "upload", "comment", "manage"],
  groom: ["view", "download", "upload", "comment", "manage"],
  studio: ["view", "download", "upload", "comment", "manage"],
  parent: ["view", "download", "comment"],
  family: ["view", "download", "comment"],
  friend: ["view", "comment"],
};

export function defaultPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? ["view"];
}
