import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.AD_TECH_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

const requiredTables = [
  "campaign_drafts",
  "campaign_geocodes",
  "campaign_target_validation",
  "campaign_launch_packages",
  "campaign_approvals",
  "campaign_launch_history",
  "campaign_reporting_imports",
  "campaign_attribution",
  "integration_health",
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
        message: "Ad-Tech live smoke failed.",
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

  for (const pathName of ["/dashboard/campaign-launch", "/admin/ad-tech"]) {
    const result = await fetchText(`${baseUrl}${pathName}`, { redirect: "manual" });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(result.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: result.res.status },
    );
    checks.push({ path: pathName, status: result.res.status });
  }

  const launchFeed = await fetchJson(`${baseUrl}/api/ad-tech/launch-packages`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(launchFeed.res.status),
    "Unauthenticated Ad-Tech launch package feed did not require login.",
    { status: launchFeed.res.status, body: launchFeed.data ?? launchFeed.text.slice(0, 400) },
  );
  checks.push({ path: "/api/ad-tech/launch-packages unauthenticated", status: launchFeed.res.status });

  const adminLaunchFeed = await fetchJson(`${baseUrl}/api/ad-tech/launch-packages?scope=admin`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(adminLaunchFeed.res.status),
    "Unauthenticated Ad-Tech admin launch package feed did not require login.",
    { status: adminLaunchFeed.res.status, body: adminLaunchFeed.data ?? adminLaunchFeed.text.slice(0, 400) },
  );
  checks.push({ path: "/api/ad-tech/launch-packages?scope=admin unauthenticated", status: adminLaunchFeed.res.status });

  const sync = await fetchJson(`${baseUrl}/api/admin/ad-tech/sync`, {
    method: "POST",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(sync.res.status),
    "Unauthenticated Ad-Tech sync did not require admin access.",
    { status: sync.res.status, body: sync.data ?? sync.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/ad-tech/sync unauthenticated", status: sync.res.status });

  const reporting = await fetchJson(`${baseUrl}/api/admin/ad-tech/reporting-imports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: "manual" }),
    redirect: "manual",
  });
  assert(
    [401, 403].includes(reporting.res.status),
    "Unauthenticated Ad-Tech reporting import did not require admin access.",
    { status: reporting.res.status, body: reporting.data ?? reporting.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/ad-tech/reporting-imports unauthenticated", status: reporting.res.status });

  const action = await fetchJson(`${baseUrl}/api/ad-tech/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionType: "approve" }),
    redirect: "manual",
  });
  assert(
    [401, 403].includes(action.res.status),
    "Unauthenticated Ad-Tech action did not require login.",
    { status: action.res.status, body: action.data ?? action.text.slice(0, 400) },
  );
  checks.push({ path: "/api/ad-tech/actions unauthenticated", status: action.res.status });

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
    if (error) throw new Error(`${tableName} check failed: ${error.message}`);
    tableCounts[tableName] = count ?? 0;
  }

  const { data: packages, error: packageError } = await withTimeout(
    supabase
      .from("campaign_launch_packages")
      .select("id,package_name,package_status,readiness_score,metadata,updated_at")
      .order("updated_at", { ascending: false })
      .limit(10),
    "Ad-Tech launch package sample",
  );
  if (packageError) {
    throw new Error(`Ad-Tech launch package sample failed: ${packageError.message}`);
  }

  const warnings = [];
  for (const launchPackage of packages ?? []) {
    if (!launchPackage.package_name) warnings.push(`Launch package ${launchPackage.id} is missing a name.`);
    if (launchPackage.metadata?.noAutoLaunch !== true) {
      warnings.push(`Launch package ${launchPackage.id} does not explicitly mark noAutoLaunch.`);
    }
    if (launchPackage.metadata?.noAutoSpend !== true) {
      warnings.push(`Launch package ${launchPackage.id} does not explicitly mark noAutoSpend.`);
    }
  }

  return {
    skipped: false,
    tableCounts,
    launchPackageSampleCount: packages?.length ?? 0,
    warnings,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.AD_TECH_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL,
);

let routeChecks;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  dbChecks = await runDbChecks(env);
} catch (error) {
  fail(error instanceof Error ? error.message : "Ad-Tech smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "ad-tech-integration-layer",
      baseUrl,
      routeChecks,
      dbChecks,
    },
    null,
    2,
  ),
);
