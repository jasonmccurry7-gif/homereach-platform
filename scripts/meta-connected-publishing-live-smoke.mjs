import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.META_CONNECTED_PUBLISHING_SMOKE_TIMEOUT_MS ?? 30000);
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");

class SmokeFailure extends Error {}

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

async function fetchWithTimeout(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

async function runRouteChecks(baseUrl) {
  const checks = [];
  const dashboard = await fetchWithTimeout(`${baseUrl}/dashboard/social-publishing`, { redirect: "manual" }, "dashboard/social-publishing");
  assert(
    [200, 302, 303, 307, 308, 401, 403].includes(dashboard.status),
    "/dashboard/social-publishing did not gate or load cleanly.",
    { status: dashboard.status },
  );
  checks.push({ path: "/dashboard/social-publishing", status: dashboard.status });

  for (const route of [
    { path: "/api/social-content/meta/connections", method: "GET" },
    { path: "/api/social-content/meta/oauth/start", method: "GET" },
    { path: "/api/social-content/meta/publications", method: "POST", body: {} },
    { path: "/api/social-content/meta/publish", method: "POST", body: {} },
    { path: "/api/admin/social-content/meta/publish-due", method: "POST", body: {} },
  ]) {
    const result = await fetchJson(`${baseUrl}${route.path}`, {
      method: route.method,
      headers: route.method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: route.method === "POST" ? JSON.stringify(route.body) : undefined,
      redirect: "manual",
    });
    assert(
      [401, 403, 503].includes(result.res.status),
      `${route.path} did not require auth/configuration.`,
      { status: result.res.status, body: result.data ?? result.text.slice(0, 300) },
    );
    checks.push({ path: `${route.path} unauthenticated`, status: result.res.status });
  }

  return checks;
}

async function runDbChecks(env) {
  if (skipDbChecks) return { skipped: true, reason: "Skipped by --skip-db-checks." };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { skipped: true, reason: "Supabase env vars unavailable locally; route checks still ran." };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tableChecks = {};
  for (const table of ["social_meta_connections", "social_publish_attempts"]) {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    if (error) throw new Error(`${table} table check failed: ${error.message}`);
    tableChecks[table] = count ?? 0;
  }

  const { error: publicationColumnError } = await supabase
    .from("social_publication_records")
    .select("id,meta_connection_id,publish_mode,publish_after_approval,last_publish_attempt_at,last_publish_error")
    .limit(1);
  if (publicationColumnError) {
    throw new Error(`social_publication_records Meta columns check failed: ${publicationColumnError.message}`);
  }

  return {
    skipped: false,
    tableChecks,
    publicationColumns: "ok",
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(env.META_CONNECTED_PUBLISHING_SMOKE_BASE_URL ?? env.SMOKE_BASE_URL);

try {
  const routeChecks = await runRouteChecks(baseUrl);
  const dbChecks = await runDbChecks(env);
  console.log(
    JSON.stringify(
      {
        ok: true,
        service: "meta-connected-publishing",
        baseUrl,
        routeChecks,
        dbChecks,
        config: {
          connectedPublishingFlag: env.ENABLE_META_CONNECTED_PUBLISHING === "true",
          autoPublishingFlag: env.ENABLE_META_AUTO_PUBLISHING === "true",
          publishingMode: env.SOCIAL_PUBLISHING_MODE ?? "review_only",
          metaAppConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI),
          encryptionConfigured: Boolean(env.META_TOKEN_ENCRYPTION_KEY),
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  fail(error instanceof Error ? error.message : "Meta connected publishing smoke failed.");
}
