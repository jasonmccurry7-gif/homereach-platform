import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const root = process.cwd();
const baseUrl = (process.env.AGENT_MINI_APPS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const allowedPermissionScopes = new Set([
  "read_only",
  "draft_only",
  "prepare_only",
  "send_after_approval",
  "purchase_after_approval",
  "submit_after_approval",
]);
const allowedQueueStatuses = new Set([
  "pending_approval",
  "queued",
  "approved",
  "running",
  "completed",
  "failed",
  "cancelled",
  "manual_takeover_needed",
]);
const approvalExecutionScopes = new Set([
  "send_after_approval",
  "purchase_after_approval",
  "submit_after_approval",
]);

const qaReport = {
  checked_at: new Date().toISOString(),
  base_url: baseUrl,
  checks: [],
  http: {},
  database: {},
};

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

function assertCheck(condition, message) {
  if (!condition) throw new Error(message);
}

function serializeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function runCheck(name, fn) {
  try {
    await fn();
    qaReport.checks.push({ name, status: "pass" });
  } catch (error) {
    qaReport.checks.push({ name, status: "fail", error: serializeError(error) });
    process.exitCode = 1;
  }
}

function assetUrlsFromHtml(html) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)) {
    urls.add(new URL(match[1], baseUrl).toString());
  }
  return [...urls];
}

await runCheck("login page renders and Next assets are reachable", async () => {
  const loginUrl = `${baseUrl}/login?redirect=%2Fadmin%2Fagent-mini-apps`;
  const response = await fetch(loginUrl, { redirect: "manual" });
  qaReport.http.login_status = response.status;
  assertCheck(response.status === 200, `Expected login page 200, received ${response.status}.`);

  const html = await response.text();
  assertCheck(
    /sign in|email|password|HomeReach/i.test(html),
    "Login page did not contain expected auth form content.",
  );

  const assetUrls = assetUrlsFromHtml(html);
  qaReport.http.login_asset_count = assetUrls.length;
  assertCheck(assetUrls.length > 0, "Login page did not reference any Next static assets.");

  const assetResults = [];
  for (const assetUrl of assetUrls) {
    const assetResponse = await fetch(assetUrl, { redirect: "manual" });
    assetResults.push({ url: assetUrl.replace(baseUrl, ""), status: assetResponse.status });
  }
  qaReport.http.login_assets = assetResults;

  const failedAssets = assetResults.filter((asset) => asset.status !== 200);
  assertCheck(
    failedAssets.length === 0,
    `Login page has unreachable Next assets: ${JSON.stringify(failedAssets)}.`,
  );
});

await runCheck("admin page is protected when unauthenticated", async () => {
  const response = await fetch(`${baseUrl}/admin/agent-mini-apps`, {
    redirect: "manual",
  });
  const location = response.headers.get("location") || "";
  qaReport.http.admin_unauth_status = response.status;
  qaReport.http.admin_unauth_location = location;
  assertCheck(
    [302, 303, 307, 308].includes(response.status),
    `Expected unauthenticated admin route redirect, received ${response.status}.`,
  );
  assertCheck(/\/login/i.test(location), `Expected redirect to login, received ${location || "<none>"}.`);
});

await runCheck("admin API rejects unauthenticated requests", async () => {
  const response = await fetch(`${baseUrl}/api/admin/agent-mini-apps`, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  qaReport.http.api_unauth_status = response.status;
  assertCheck(
    [401, 403].includes(response.status),
    `Expected unauthenticated API request to return 401/403, received ${response.status}.`,
  );

  const integrationsResponse = await fetch(`${baseUrl}/api/admin/agent-integrations`, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  qaReport.http.integrations_api_unauth_status = integrationsResponse.status;
  assertCheck(
    [401, 403].includes(integrationsResponse.status),
    `Expected unauthenticated Agent Integrations API request to return 401/403, received ${integrationsResponse.status}.`,
  );
});

await runCheck("database schema, RLS, immutable audit log, and registry safety are ready", async () => {
  const url = connectionUrl();
  assertCheck(Boolean(url), "No DATABASE_URL found. Set AGENT_MINI_APPS_DB_URL or DATABASE_URL.");
  qaReport.database.host = new URL(url).hostname;

  const sqlPath = path.join(root, "scripts", "agent-mini-apps-db-preflight.sql");
  const db = postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 2,
    connect_timeout: 20,
    ssl: "require",
  });

  try {
    const rows = await db.unsafe(fs.readFileSync(sqlPath, "utf8"));
    const rawPreflight = rows[0]?.preflight_report;
    const preflight = typeof rawPreflight === "string" ? JSON.parse(rawPreflight) : rawPreflight;
    const relations = Array.isArray(preflight?.relations) ? preflight.relations : [];
    const hasRelation = (name) =>
      relations.some((relation) => relation.relation_name === name && relation.exists);

    const [counts] = hasRelation("agent_mini_apps")
      ? await db`
          select
            (select count(*)::int from public.agent_mini_apps) as mini_apps,
            (select count(*)::int from public.agent_mini_app_events) as mini_app_events,
            (select count(*)::int from public.agent_browser_session_registry) as browser_systems,
            (select count(*)::int from public.agent_execution_queue) as execution_queue,
            (select count(*)::int from public.integration_connections) as integration_connections,
            (select count(*)::int from public.agent_tool_permissions) as agent_tool_permissions,
            (select count(*)::int from public.external_action_intents) as external_action_intents,
            (select count(*)::int from public.agent_execution_attempts) as agent_execution_attempts
        `
      : [{
          mini_apps: 0,
          mini_app_events: 0,
          browser_systems: 0,
          execution_queue: 0,
          integration_connections: 0,
          agent_tool_permissions: 0,
          external_action_intents: 0,
          agent_execution_attempts: 0,
        }];

    const ready =
      (preflight.missing_relations?.length ?? 0) === 0 &&
      (preflight.missing_columns?.length ?? 0) === 0 &&
      preflight.rls?.agent_mini_apps === true &&
      preflight.rls?.agent_mini_app_events === true &&
      preflight.rls?.integration_connections === true &&
      preflight.rls?.agent_tool_permissions === true &&
      preflight.rls?.external_action_intents === true &&
      preflight.rls?.agent_execution_attempts === true &&
      preflight.immutable_event_trigger_enabled === true &&
      preflight.browser_session_registry_security_invoker === true &&
      (preflight.secret_like_registry_columns?.length ?? 0) === 0 &&
      (preflight.secret_like_connector_columns?.length ?? 0) === 0;

    qaReport.database.preflight_ready = ready;
    qaReport.database.counts = counts;
    assertCheck(ready, "Agent Mini Apps database preflight is not ready.");
    assertCheck(counts.mini_apps >= 7, `Expected at least 7 demo mini apps, found ${counts.mini_apps}.`);
    assertCheck(
      counts.mini_app_events >= counts.mini_apps,
      `Expected audit events to cover mini apps, found ${counts.mini_app_events} events for ${counts.mini_apps} mini apps.`,
    );
    assertCheck(
      counts.browser_systems >= 12,
      `Expected at least 12 browser registry rows, found ${counts.browser_systems}.`,
    );
    assertCheck(
      counts.integration_connections >= 10,
      `Expected at least 10 integration connection registry rows, found ${counts.integration_connections}.`,
    );
    assertCheck(
      counts.agent_tool_permissions >= 7,
      `Expected at least 7 agent tool permission rows, found ${counts.agent_tool_permissions}.`,
    );
  } finally {
    await db.end({ timeout: 2 });
  }
});

await runCheck("execution queue rows preserve human approval and safe permission boundaries", async () => {
  const url = connectionUrl();
  assertCheck(Boolean(url), "No DATABASE_URL found. Set AGENT_MINI_APPS_DB_URL or DATABASE_URL.");

  const db = postgres(url, {
    max: 1,
    prepare: false,
    idle_timeout: 2,
    connect_timeout: 20,
    ssl: "require",
  });

  try {
    const queueRows = await db`
      select
        id::text,
        task_id,
        mini_app_id::text,
        task_type,
        target_system,
        permission_scope,
        status,
        human_approval_required,
        approved_by::text,
        approved_at,
        created_at
      from public.agent_execution_queue
      order by created_at desc
      limit 100
    `;

    const unsafeRows = queueRows.filter((row) => {
      if (!allowedPermissionScopes.has(row.permission_scope)) return true;
      if (!allowedQueueStatuses.has(row.status)) return true;
      if (row.human_approval_required !== true) return true;
      if (
        approvalExecutionScopes.has(row.permission_scope) &&
        ["approved", "running", "completed"].includes(row.status) &&
        (!row.approved_by || !row.approved_at)
      ) {
        return true;
      }
      return false;
    });

    qaReport.database.execution_queue_checked = queueRows.length;
    qaReport.database.execution_queue_unsafe = unsafeRows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      task_type: row.task_type,
      permission_scope: row.permission_scope,
      status: row.status,
      human_approval_required: row.human_approval_required,
    }));

    assertCheck(
      unsafeRows.length === 0,
      `Found unsafe execution queue rows: ${JSON.stringify(qaReport.database.execution_queue_unsafe)}.`,
    );

    const [coverage] = await db`
      select
        (
          select count(*)::int
          from public.agent_execution_queue queue
          where not exists (
            select 1
            from public.agent_mini_app_events event
            where event.mini_app_id::text = queue.mini_app_id::text
              and event.event_type = 'sent_to_execution_queue'
          )
        ) as queue_event_gaps,
        (
          select count(*)::int
          from public.agent_mini_apps app
          where app.status in ('approved', 'scheduled', 'executed', 'rejected', 'archived', 'failed', 'sent_to_execution_queue')
            and not exists (
              select 1
              from public.agent_mini_app_events event
              where event.mini_app_id = app.id
                and event.event_type in ('approved', 'scheduled', 'executed', 'rejected', 'archived', 'failed', 'sent_to_execution_queue')
            )
        ) as status_event_gaps
    `;

    qaReport.database.audit_coverage = coverage;
    assertCheck(
      coverage.queue_event_gaps === 0,
      `Expected queued execution tasks to have sent_to_execution_queue events; found ${coverage.queue_event_gaps} gaps.`,
    );
    assertCheck(
      coverage.status_event_gaps === 0,
      `Expected decision statuses to have matching audit events; found ${coverage.status_event_gaps} gaps.`,
    );
  } finally {
    await db.end({ timeout: 2 });
  }
});

console.log(JSON.stringify(qaReport, null, 2));

if (process.exitCode) {
  process.exit(process.exitCode);
}
