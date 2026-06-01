import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.AI_WORKFORCE_ASSETS_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

const requiredTables = [
  "ai_business_context",
  "ai_prompt_sops",
  "ai_data_sources",
  "ai_agent_profiles",
  "ai_prompt_chains",
  "ai_prompt_chain_steps",
  "ai_outputs",
  "ai_verification_checks",
  "ai_output_reviews",
  "ai_workforce_tasks",
  "ai_workforce_activity_logs",
];

class SmokeFailure extends Error {}

function redactSecret(value) {
  return String(value).replace(/(sk|pk)_(live|test)_[^\s'",)]+/g, "$1_$2_***");
}

function safeError(error) {
  return {
    name: error?.name ?? "Error",
    type: error?.type ?? null,
    code: error?.code ?? null,
    statusCode: error?.statusCode ?? null,
    message: redactSecret(error?.message ?? "Unknown error"),
  };
}

process.on("uncaughtException", (error) => {
  if (error instanceof SmokeFailure) {
    process.exitCode = 1;
    return;
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        message: "AI Workforce / AI Assets live smoke failed.",
        error: safeError(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    env[key] = value;
  }

  return env;
}

function loadEnv() {
  return {
    ...parseEnvFile(path.join(rootDir, ".env")),
    ...parseEnvFile(path.join(rootDir, ".env.local")),
    ...parseEnvFile(path.join(rootDir, "apps/web/.env.local")),
    ...process.env,
  };
}

function normalizeBaseUrl(value) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  throw new SmokeFailure(message);
}

function assert(condition, message, details = {}) {
  if (!condition) fail(message, details);
}

async function withTimeout(promise, label, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function fetchWithTimeout(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, init) {
  const res = await fetchWithTimeout(url, init, `Fetch ${url}`);
  const text = await res.text();
  return { res, text };
}

async function fetchJson(url, init) {
  const res = await fetchWithTimeout(url, init, `Fetch ${url}`);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, text, data };
}

async function runRouteAndGuardChecks(baseUrl) {
  const checks = [];

  for (const pathName of ["/admin/agents", "/admin/ai-assets"]) {
    const result = await fetchText(`${baseUrl}${pathName}`, { redirect: "manual" });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(result.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: result.res.status },
    );
    checks.push({ path: pathName, status: result.res.status });
  }

  const workforceAction = await fetchJson(`${baseUrl}/api/admin/ai-workforce/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create_task" }),
    redirect: "manual",
  });
  assert(
    [401, 403].includes(workforceAction.res.status),
    "Unauthenticated AI Workforce action did not require admin access.",
    { status: workforceAction.res.status, body: workforceAction.data ?? workforceAction.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/ai-workforce/actions unauthenticated", status: workforceAction.res.status });

  const assetsAction = await fetchJson(`${baseUrl}/api/admin/ai-assets/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create_ai_output" }),
    redirect: "manual",
  });
  assert(
    [401, 403].includes(assetsAction.res.status),
    "Unauthenticated AI Assets action did not require admin access.",
    { status: assetsAction.res.status, body: assetsAction.data ?? assetsAction.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/ai-assets/actions unauthenticated", status: assetsAction.res.status });

  return checks;
}

async function runDbChecks(env) {
  if (skipDbChecks) {
    return { skipped: true, reason: "Skipped by --skip-db-checks." };
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      skipped: true,
      reason: "Supabase env vars unavailable locally; route and API guard checks still ran.",
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tableCounts = {};
  for (const tableName of requiredTables) {
    const { error: existenceError } = await withTimeout(
      supabase.from(tableName).select("id").limit(1),
      `${tableName} existence check`,
    );
    if (existenceError) throw new Error(`${tableName} existence check failed: ${existenceError.message}`);

    const { count, error } = await withTimeout(
      supabase.from(tableName).select("*", { count: "exact", head: true }),
      `${tableName} table count`,
    );
    if (error) throw new Error(`${tableName} count failed: ${error.message}`);
    tableCounts[tableName] = count ?? 0;
  }

  const { data: outputs, error: outputsError } = await withTimeout(
    supabase
      .from("ai_outputs")
      .select("id,title,data_sources,approval_status,verification_status,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    "AI output sample",
  );
  if (outputsError) throw new Error(`AI output sample failed: ${outputsError.message}`);

  const { data: tasks, error: tasksError } = await withTimeout(
    supabase
      .from("ai_workforce_tasks")
      .select("id,task_id,workflow_name,assigned_agent,status,approval_required,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    "AI Workforce task sample",
  );
  if (tasksError) throw new Error(`AI Workforce task sample failed: ${tasksError.message}`);

  const warnings = [];
  for (const output of outputs ?? []) {
    if (!output.title) warnings.push(`AI output ${output.id} is missing a title.`);
    if (!Array.isArray(output.data_sources) || output.data_sources.length === 0) {
      warnings.push(`AI output ${output.id} has no data_sources.`);
    }
    if (!output.approval_status) warnings.push(`AI output ${output.id} has no approval status.`);
  }
  for (const task of tasks ?? []) {
    if (!task.task_id) warnings.push(`AI Workforce task ${task.id} is missing task_id.`);
    if (!task.assigned_agent) warnings.push(`AI Workforce task ${task.id} is missing assigned_agent.`);
  }

  return {
    skipped: false,
    tableCounts,
    outputSampleCount: outputs?.length ?? 0,
    taskSampleCount: tasks?.length ?? 0,
    warnings,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.AI_WORKFORCE_ASSETS_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL,
);

let routeChecks;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  dbChecks = await runDbChecks(env);
} catch (error) {
  fail(error instanceof Error ? error.message : "AI Workforce / AI Assets smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "ai-workforce-ai-assets",
      baseUrl,
      routeChecks,
      dbChecks,
    },
    null,
    2,
  ),
);
