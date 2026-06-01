import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.BUSINESS_MEMORY_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

const requiredTables = [
  "business_memory_profiles",
  "business_memory_geographies",
  "business_memory_campaigns",
  "business_memory_campaign_results",
  "business_memory_opportunities",
  "business_memory_offers",
  "business_memory_suppliers",
  "business_memory_savings",
  "business_memory_reputation",
  "business_memory_growth",
  "business_memory_ai_coo",
  "business_memory_timeline",
  "business_memory_insights",
  "business_memory_scores",
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
        message: "Business Memory live smoke failed.",
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

  for (const pathName of ["/dashboard/business-memory", "/admin/business-memory"]) {
    const result = await fetchText(`${baseUrl}${pathName}`, { redirect: "manual" });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(result.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: result.res.status },
    );
    checks.push({ path: pathName, status: result.res.status });
  }

  const profile = await fetchJson(`${baseUrl}/api/business-memory/profile`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(profile.res.status),
    "Unauthenticated Business Memory profile API did not require login.",
    { status: profile.res.status, body: profile.data ?? profile.text.slice(0, 400) },
  );
  checks.push({ path: "/api/business-memory/profile unauthenticated", status: profile.res.status });

  const adminProfile = await fetchJson(`${baseUrl}/api/business-memory/profile?scope=admin`, {
    method: "GET",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(adminProfile.res.status),
    "Unauthenticated Business Memory admin profile API did not require login.",
    { status: adminProfile.res.status, body: adminProfile.data ?? adminProfile.text.slice(0, 400) },
  );
  checks.push({
    path: "/api/business-memory/profile?scope=admin unauthenticated",
    status: adminProfile.res.status,
  });

  const clientSync = await fetchJson(`${baseUrl}/api/business-memory/sync`, {
    method: "POST",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(clientSync.res.status),
    "Unauthenticated Business Memory client sync did not require login.",
    { status: clientSync.res.status, body: clientSync.data ?? clientSync.text.slice(0, 400) },
  );
  checks.push({ path: "/api/business-memory/sync unauthenticated", status: clientSync.res.status });

  const adminSync = await fetchJson(`${baseUrl}/api/admin/business-memory/sync`, {
    method: "POST",
    redirect: "manual",
  });
  assert(
    [401, 403].includes(adminSync.res.status),
    "Unauthenticated Business Memory admin sync did not require admin access.",
    { status: adminSync.res.status, body: adminSync.data ?? adminSync.text.slice(0, 400) },
  );
  checks.push({ path: "/api/admin/business-memory/sync unauthenticated", status: adminSync.res.status });

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

  const { data: profiles, error: profileError } = await withTimeout(
    supabase
      .from("business_memory_profiles")
      .select("id,business_name,client_id,client_email,updated_at,metadata")
      .order("updated_at", { ascending: false })
      .limit(10),
    "Business Memory profile sample",
  );
  if (profileError) throw new Error(`Business Memory profile sample failed: ${profileError.message}`);

  const warnings = [];
  for (const profile of profiles ?? []) {
    if (!profile.business_name) warnings.push(`Profile ${profile.id} is missing a business name.`);
    if (!profile.client_id && !profile.client_email) {
      warnings.push(`Profile ${profile.id} is not linked to a client id or email.`);
    }
  }

  return {
    skipped: false,
    tableCounts,
    profileSampleCount: profiles?.length ?? 0,
    warnings,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.BUSINESS_MEMORY_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL,
);

let routeChecks;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  dbChecks = await runDbChecks(env);
} catch (error) {
  fail(error instanceof Error ? error.message : "Business Memory smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "business-memory",
      baseUrl,
      routeChecks,
      dbChecks,
    },
    null,
    2,
  ),
);
