import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Database Client
//
// Two connections are maintained:
//   - `migrationClient` — single connection for running migrations (no pooling)
//   - `db`             — pooled connection for application queries
//
// In serverless environments (Vercel), use the pooled connection exclusively.
// ─────────────────────────────────────────────────────────────────────────────

function getDatabaseUrl(pooled = false): string {
  const url = pooled
    ? process.env.DATABASE_URL_POOLED
    : process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      pooled
        ? "DATABASE_URL_POOLED is required for application queries"
        : "DATABASE_URL is required for migrations"
    );
  }

  return url;
}

// Migration client — direct connection, single use
export function createMigrationClient() {
  const client = postgres(getDatabaseUrl(false), { max: 1 });
  return drizzle(client, { schema });
}

// Application client — pooled, used for all runtime queries
const queryClient = postgres(getDatabaseUrl(true), {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

// Re-export schema for convenience
export * from "./schema/index.js";
export { schema };
