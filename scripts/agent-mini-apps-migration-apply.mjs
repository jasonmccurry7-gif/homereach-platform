import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const root = process.cwd();
const migrationFile = "20260601021915_agent_mini_apps_layer.sql";
const migrationVersion = "20260601021915";
const migrationName = "agent_mini_apps_layer";
const migrationPath = path.join(root, "supabase", "migrations", migrationFile);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function connectionUrl() {
  const rootEnv = parseEnvFile(path.join(root, ".env"));
  const webEnv = parseEnvFile(path.join(root, "apps", "web", ".env.local"));
  return (
    process.env.AGENT_MINI_APPS_DB_URL ||
    process.env.DATABASE_URL ||
    webEnv.DATABASE_URL ||
    rootEnv.DATABASE_URL ||
    null
  );
}

const url = connectionUrl();
if (!url) {
  console.error("No DATABASE_URL found. Set AGENT_MINI_APPS_DB_URL or DATABASE_URL.");
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, "utf8");
const db = postgres(url, {
  max: 1,
  prepare: false,
  idle_timeout: 2,
  connect_timeout: 10,
  ssl: "require",
});

try {
  const existing = await db`
    select version
    from supabase_migrations.schema_migrations
    where version = ${migrationVersion}
    limit 1
  `;
  if (existing.length > 0) {
    console.log(`Migration ${migrationVersion}_${migrationName} is already recorded. No changes applied.`);
    process.exit(0);
  }

  await db.unsafe("begin");
  await db.unsafe("set local lock_timeout = '5s'");
  await db.unsafe("set local statement_timeout = '120s'");
  await db.unsafe(migrationSql);
  await db`
    insert into supabase_migrations.schema_migrations (
      version,
      statements,
      name,
      created_by,
      idempotency_key
    )
    values (
      ${migrationVersion},
      ${[migrationSql]},
      ${migrationName},
      ${"codex"},
      ${`${migrationVersion}_${migrationName}`}
    )
  `;
  await db.unsafe("commit");
  console.log(`Migration ${migrationVersion}_${migrationName} applied and recorded.`);
} catch (error) {
  try {
    await db.unsafe("rollback");
  } catch {
    // Ignore rollback failures after connection-level errors.
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 2 });
}
