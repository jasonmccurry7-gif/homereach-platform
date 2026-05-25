import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

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
function createApplicationClient() {
  const queryClient = postgres(getDatabaseUrl(true), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(queryClient, { schema });
}

let cachedDb: ReturnType<typeof createApplicationClient> | null = null;

export function getDb() {
  cachedDb ??= createApplicationClient();
  return cachedDb;
}

// Keep the existing `db` import contract while avoiding build-time env reads.
export const db = new Proxy({} as ReturnType<typeof createApplicationClient>, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client as object, prop, client as object);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as ReturnType<typeof createApplicationClient>;

export type DbClient = ReturnType<typeof createApplicationClient>;
export type typeof_db = DbClient;

// Re-export schema for convenience
export * from "./schema/index";
export { schema };
