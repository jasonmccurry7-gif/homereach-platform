import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const POSTGRES_CANDIDATES = [
  "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/cjs/src/index.js",
  "../node_modules/postgres/cjs/src/index.js",
  "../packages/db/node_modules/postgres/cjs/src/index.js",
];

const EXPECTED_COLUMNS = [
  "planner_intent",
  "strategy_snapshot",
  "selected_scenario_snapshot",
  "scenario_comparison_snapshot",
  "route_coverage_snapshot",
  "selected_route_ids",
  "proposal_generated_at",
  "proposal_id",
];

function loadPostgres() {
  for (const candidate of POSTGRES_CANDIDATES) {
    const path = new URL(candidate, import.meta.url);
    if (fs.existsSync(path)) {
      return require(fileURLToPath(path));
    }
  }

  return require("postgres");
}

function loadEnv(file, override = false) {
  if (!fs.existsSync(file)) return;

  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function projectRefFromUrl(parsed) {
  if (parsed.username.startsWith("postgres.")) {
    return parsed.username.slice("postgres.".length);
  }

  const supabaseMatch = parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/);
  return supabaseMatch?.[1] ?? null;
}

function migrationSql() {
  return fs.readFileSync(
    "supabase/migrations/078_political_outreach_planning_snapshots.sql",
    "utf8",
  );
}

async function main() {
  loadEnv(".env");
  loadEnv("apps/web/.env.local", true);

  const shouldApply = process.argv.includes("--apply");
  const confirmed = process.argv.includes("--yes");
  if (shouldApply && !confirmed) {
    throw new Error("Refusing to apply migration without --yes.");
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const parsed = new URL(databaseUrl);
  const postgres = loadPostgres();
  const sql = postgres(databaseUrl, {
    connect_timeout: 10,
    max: 1,
    ssl: "require",
  });

  try {
    const identity = await sql`
      select current_database() as database_name,
             current_user as user_name,
             inet_server_addr()::text as server_addr,
             version() as version
    `;
    const tables = await sql`
      select to_regclass('public.political_outreach_leads')::text as outreach_leads,
             to_regclass('public.political_proposals')::text as proposals
    `;
    const columns = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'political_outreach_leads'
        and column_name = any(${EXPECTED_COLUMNS})
      order by column_name
    `;

    const present = columns.map((row) => row.column_name);
    const missing = EXPECTED_COLUMNS.filter((column) => !present.includes(column));
    const summary = {
      host: parsed.host,
      projectRef: projectRefFromUrl(parsed),
      database: identity[0].database_name,
      user: identity[0].user_name,
      serverAddressPresent: Boolean(identity[0].server_addr),
      postgresVersion: String(identity[0].version).split(" on ")[0],
      tables: tables[0],
      migration078ColumnsPresent: present,
      migration078ColumnsMissing: missing,
      appliedMigration078: false,
    };

    if (shouldApply && missing.length > 0) {
      await sql.begin(async (tx) => {
        await tx.unsafe(migrationSql());
      });
      summary.appliedMigration078 = true;

      const after = await sql`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'political_outreach_leads'
          and column_name = any(${EXPECTED_COLUMNS})
        order by column_name
      `;
      const afterPresent = after.map((row) => row.column_name);
      summary.migration078ColumnsPresent = afterPresent;
      summary.migration078ColumnsMissing = EXPECTED_COLUMNS.filter(
        (column) => !afterPresent.includes(column),
      );
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
