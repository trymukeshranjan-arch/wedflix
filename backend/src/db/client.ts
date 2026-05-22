import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

// `prepare: false` is required when using the Supabase transaction pooler.
const queryClient = postgres(env.DATABASE_URL, {
  prepare: false,
  max: env.isProd ? 10 : 5,
});

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

// Close the connection pool — used so the test runner can exit cleanly.
export const closeDb = () => queryClient.end();

export type Db = typeof db;
export { schema };
