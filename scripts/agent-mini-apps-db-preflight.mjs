import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const root = process.cwd();
const sqlPath = path.join(root, "scripts", "agent-mini-apps-db-preflight.sql");

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

const sqlText = fs.readFileSync(sqlPath, "utf8");
const db = postgres(url, {
  max: 1,
  prepare: false,
  idle_timeout: 2,
  connect_timeout: 10,
  ssl: "require",
});

try {
  const rows = await db.unsafe(sqlText);
  const rawReport = rows[0]?.preflight_report;
  const report = typeof rawReport === "string" ? JSON.parse(rawReport) : rawReport;

  const relations = Array.isArray(report?.relations) ? report.relations : [];
  const hasRelation = (name) => relations.some((relation) => relation.relation_name === name && relation.exists);

  if (hasRelation("agent_mini_apps")) {
    const [counts] = await db`
      select
        (select count(*)::int from public.agent_mini_apps) as mini_apps,
        (select count(*)::int from public.agent_mini_app_events) as mini_app_events,
        (select count(*)::int from public.agent_browser_session_registry) as browser_session_registry,
        (select count(*)::int from public.agent_execution_queue) as execution_queue,
        (select count(*)::int from public.integration_connections) as integration_connections,
        (select count(*)::int from public.agent_tool_permissions) as agent_tool_permissions,
        (select count(*)::int from public.external_action_intents) as external_action_intents,
        (select count(*)::int from public.agent_execution_attempts) as agent_execution_attempts
    `;
    report.exact_counts = counts;
  }

  report.ready =
    (report.missing_relations?.length ?? 0) === 0 &&
    (report.missing_columns?.length ?? 0) === 0 &&
    report.rls?.agent_mini_apps === true &&
    report.rls?.agent_mini_app_events === true &&
    report.rls?.integration_connections === true &&
    report.rls?.agent_tool_permissions === true &&
    report.rls?.external_action_intents === true &&
    report.rls?.agent_execution_attempts === true &&
    report.immutable_event_trigger_enabled === true &&
    report.browser_session_registry_security_invoker === true &&
    (report.secret_like_registry_columns?.length ?? 0) === 0 &&
    (report.secret_like_connector_columns?.length ?? 0) === 0;

  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.end({ timeout: 2 });
}
