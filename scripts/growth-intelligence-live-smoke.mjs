import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.GROWTH_INTELLIGENCE_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

const requiredTables = [
  "growth_intelligence_admin_entries",
  "growth_intelligence_sources",
  "growth_intelligence_opportunities",
  "growth_intelligence_scores",
  "growth_intelligence_reports",
  "growth_intelligence_client_matches",
  "growth_intelligence_actions",
  "growth_intelligence_drafts",
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
        message: "Growth Intelligence live smoke failed.",
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

  for (const pathName of ["/dashboard/growth-intelligence", "/admin/growth-intelligence"]) {
    const result = await fetchText(`${baseUrl}${pathName}`, { redirect: "manual" });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(result.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: result.res.status },
    );
    checks.push({ path: pathName, status: result.res.status });
  }

  const feed = await fetchJson(`${baseUrl}/api/growth-intelligence/opportunities`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(feed.res.status),
    "Unauthenticated Growth Intelligence opportunity feed did not require login.",
    { status: feed.res.status, body: feed.data ?? feed.text.slice(0, 400) },
  );
  checks.push({ path: "/api/growth-intelligence/opportunities unauthenticated", status: feed.res.status });

  const adminFeed = await fetchJson(`${baseUrl}/api/growth-intelligence/opportunities?scope=admin`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(adminFeed.res.status),
    "Unauthenticated Growth Intelligence admin opportunity feed did not require login.",
    { status: adminFeed.res.status, body: adminFeed.data ?? adminFeed.text.slice(0, 400) },
  );
  checks.push({
    path: "/api/growth-intelligence/opportunities?scope=admin unauthenticated",
    status: adminFeed.res.status,
  });

  const sync = await fetchJson(`${baseUrl}/api/admin/growth-intelligence/sync`, {
    method: "POST",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(sync.res.status),
    "Unauthenticated Growth Intelligence sync did not require admin access.",
    { status: sync.res.status, body: sync.data ?? sync.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/growth-intelligence/sync unauthenticated", status: sync.res.status });

  const adminEntry = await fetchJson(`${baseUrl}/api/admin/growth-intelligence/admin-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke Test" }),
    redirect: "manual",
  });
  assert(
    [401, 403].includes(adminEntry.res.status),
    "Unauthenticated admin intelligence entry creation did not require admin access.",
    { status: adminEntry.res.status, body: adminEntry.data ?? adminEntry.text.slice(0, 400) },
  );
  checks.push({
    path: "/api/admin/growth-intelligence/admin-entries unauthenticated",
    status: adminEntry.res.status,
  });

  const action = await fetchJson(
    `${baseUrl}/api/growth-intelligence/opportunities/00000000-0000-0000-0000-000000000000`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "review" }),
      redirect: "manual",
    },
  );
  assert(
    [401, 403].includes(action.res.status),
    "Unauthenticated Growth Intelligence opportunity action did not require login.",
    { status: action.res.status, body: action.data ?? action.text.slice(0, 400) },
  );
  checks.push({ path: "/api/growth-intelligence/opportunities/[id] unauthenticated", status: action.res.status });

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

  const { data: opportunities, error: opportunitiesError } = await withTimeout(
    supabase
      .from("growth_intelligence_opportunities")
      .select("id,title,status,priority_score,growth_score,metadata,updated_at")
      .order("updated_at", { ascending: false })
      .limit(10),
    "Growth Intelligence opportunity sample",
  );
  if (opportunitiesError) {
    throw new Error(`Growth Intelligence opportunity sample failed: ${opportunitiesError.message}`);
  }

  const warnings = [];
  for (const opportunity of opportunities ?? []) {
    if (!opportunity.title) warnings.push(`Opportunity ${opportunity.id} is missing a title.`);
    if (opportunity.metadata?.noExternalScraping !== true) {
      warnings.push(`Opportunity ${opportunity.id} does not explicitly mark noExternalScraping.`);
    }
    if (opportunity.metadata?.humanApprovalRequired !== true) {
      warnings.push(`Opportunity ${opportunity.id} does not explicitly mark humanApprovalRequired.`);
    }
  }

  return {
    skipped: false,
    tableCounts,
    opportunitySampleCount: opportunities?.length ?? 0,
    warnings,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.GROWTH_INTELLIGENCE_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL,
);

let routeChecks;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  dbChecks = await runDbChecks(env);
} catch (error) {
  fail(error instanceof Error ? error.message : "Growth Intelligence smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "growth-intelligence",
      baseUrl,
      routeChecks,
      dbChecks,
    },
    null,
    2,
  ),
);
