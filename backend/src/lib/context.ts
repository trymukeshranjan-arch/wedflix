import type { weddings, users, memberships } from "../db/schema";

export type Wedding = typeof weddings.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;

// Hono context variables. Each is populated by a middleware; routes that
// read a variable must be mounted behind the middleware that sets it.
export type AppEnv = {
  Variables: {
    wedding: Wedding; // set by resolveTenant
    user: User; // set by requireAuth (always) / optionalAuth (if logged in)
    membership: Membership; // set by requireMembership
  };
};
