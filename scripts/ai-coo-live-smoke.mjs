import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.AI_COO_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

const requiredTables = [
  "opportunity_categories",
  "ai_coo_recommendations",
  "ai_coo_actions",
  "ai_coo_drafts",
  "client_success_scores",
  "recommendation_history",
];

const requiredCategories = [
  "revenue",
  "cost_savings",
  "reputation",
  "growth",
  "risk",
  "renewal",
  "upsell",
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
        message: "AI COO live smoke failed.",
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

  for (const pathName of ["/dashboard", "/admin/ai-coo-queue"]) {
    const result = await fetchText(`${baseUrl}${pathName}`, { redirect: "manual" });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(result.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: result.res.status },
    );
    checks.push({ path: pathName, status: result.res.status });
  }

  const feed = await fetchJson(`${baseUrl}/api/ai-coo/recommendations`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(feed.res.status),
    "Unauthenticated AI COO recommendations feed did not require login.",
    { status: feed.res.status, body: feed.data ?? feed.text.slice(0, 400) },
  );
  checks.push({ path: "/api/ai-coo/recommendations unauthenticated", status: feed.res.status });

  const adminFeed = await fetchJson(`${baseUrl}/api/ai-coo/recommendations?scope=admin`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(adminFeed.res.status),
    "Unauthenticated AI COO admin recommendations feed did not require login.",
    { status: adminFeed.res.status, body: adminFeed.data ?? adminFeed.text.slice(0, 400) },
  );
  checks.push({
    path: "/api/ai-coo/recommendations?scope=admin unauthenticated",
    status: adminFeed.res.status,
  });

  const generate = await fetchJson(`${baseUrl}/api/admin/ai-coo/generate`, {
    method: "POST",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(generate.res.status),
    "Unauthenticated AI COO generation did not require admin access.",
    { status: generate.res.status, body: generate.data ?? generate.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/ai-coo/generate unauthenticated", status: generate.res.status });

  const action = await fetchJson(
    `${baseUrl}/api/ai-coo/recommendations/00000000-0000-0000-0000-000000000000`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "review" }),
      redirect: "manual",
    },
  );
  assert(
    [401, 403].includes(action.res.status),
    "Unauthenticated AI COO action did not require login.",
    { status: action.res.status, body: action.data ?? action.text.slice(0, 400) },
  );
  checks.push({ path: "/api/ai-coo/recommendations/[id] unauthenticated", status: action.res.status });

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
    const { count, error } = await withTimeout(
      supabase.from(tableName).select("*", { count: "exact", head: true }),
      `${tableName} table count`,
    );
    if (error) throw new Error(`${tableName} check failed: ${error.message}`);
    tableCounts[tableName] = count ?? 0;
  }

  const { data: categories, error: categoryError } = await withTimeout(
    supabase.from("opportunity_categories").select("category").in("category", requiredCategories),
    "AI COO category lookup",
  );
  if (categoryError) throw new Error(`AI COO category lookup failed: ${categoryError.message}`);

  const foundCategories = new Set((categories ?? []).map((row) => row.category));
  const missingCategories = requiredCategories.filter((category) => !foundCategories.has(category));
  assert(missingCategories.length === 0, "AI COO opportunity categories are missing.", {
    missingCategories,
  });

  const { data: recommendations, error: recommendationsError } = await withTimeout(
    supabase
      .from("ai_coo_recommendations")
      .select("id,status,priority_score,confidence_score,action_labels,metadata,updated_at")
      .order("updated_at", { ascending: false })
      .limit(10),
    "AI COO recommendation sample",
  );
  if (recommendationsError) {
    throw new Error(`AI COO recommendation sample failed: ${recommendationsError.message}`);
  }

  const warnings = [];
  for (const row of recommendations ?? []) {
    if (!Array.isArray(row.action_labels) || row.action_labels.length === 0) {
      warnings.push(`Recommendation ${row.id} has no action labels.`);
    }
    if (row.metadata?.noAutonomousAction !== true) {
      warnings.push(`Recommendation ${row.id} is missing noAutonomousAction metadata.`);
    }
    if (row.metadata?.approvalRequiredBeforeExecution !== true) {
      warnings.push(`Recommendation ${row.id} is missing approvalRequiredBeforeExecution metadata.`);
    }
  }

  return {
    skipped: false,
    tableCounts,
    requiredCategories,
    recommendationSampleCount: recommendations?.length ?? 0,
    warnings,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(env.AI_COO_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL);

let routeChecks;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  dbChecks = await runDbChecks(env);
} catch (error) {
  fail(error instanceof Error ? error.message : "AI COO smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "ai-coo",
      baseUrl,
      routeChecks,
      dbChecks,
    },
    null,
    2,
  ),
);
