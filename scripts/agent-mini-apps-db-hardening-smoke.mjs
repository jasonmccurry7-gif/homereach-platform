import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const root = process.cwd();

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

const db = postgres(url, {
  max: 1,
  prepare: false,
  idle_timeout: 2,
  connect_timeout: 20,
  ssl: "require",
});

try {
  const [counts] = await db`
    select
      (select count(*)::int from public.agent_mini_apps) as mini_apps,
      (select count(*)::int from public.agent_mini_app_events) as events,
      (select count(*)::int from public.agent_browser_session_registry) as browser_systems
  `;
  assert.equal(counts.mini_apps, 7, "Expected 7 seed mini apps.");
  assert.equal(counts.events, 7, "Expected 7 seed audit events.");
  assert.equal(counts.browser_systems, 12, "Expected 12 browser system registry rows.");

  const [miniApp] = await db`
    select id, source_agent
    from public.agent_mini_apps
    order by created_at
    limit 1
  `;
  assert.ok(miniApp?.id, "Expected a seed mini app id.");

  let defaultScope;
  try {
    await db.unsafe("begin");
    const inserted = await db`
      insert into public.agent_execution_queue (
        task_id,
        mini_app_id,
        source_agent,
        task_type,
        target_system,
        target_url
      )
      values (
        'SMOKE-AGENT-MINI-APPS-ROLLBACK',
        ${miniApp.id},
        ${miniApp.source_agent},
        'smoke_test',
        'HomeReach Admin',
        '/admin/agent-mini-apps'
      )
      returning permission_scope, status, human_approval_required
    `;
    defaultScope = inserted[0];
  } finally {
    await db.unsafe("rollback");
  }
  assert.equal(defaultScope.permission_scope, "read_only");
  assert.equal(defaultScope.status, "pending_approval");
  assert.equal(defaultScope.human_approval_required, true);

  const [event] = await db`
    select id
    from public.agent_mini_app_events
    order by created_at
    limit 1
  `;
  assert.ok(event?.id, "Expected a seed audit event id.");

  let immutableBlocked = false;
  try {
    await db.begin(async (tx) => {
      await tx`
        update public.agent_mini_app_events
        set event_summary = 'should not persist'
        where id = ${event.id}
      `;
    });
  } catch (error) {
    immutableBlocked = String(error instanceof Error ? error.message : error).includes("immutable");
  }
  assert.equal(immutableBlocked, true, "Expected immutable audit event update to be blocked.");

  console.log("Agent Mini Apps DB hardening smoke passed.");
} finally {
  await db.end({ timeout: 2 });
}
