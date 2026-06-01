import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.COST_SAVINGS_REVIEW_SMOKE_TIMEOUT_MS ?? 30000);
const PRODUCT_INTENT = "procurement-savings-review";
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");
const skipIntakeWrite = args.has("--skip-intake-write");
const archiveQaRecord = !args.has("--keep-qa-record");

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
        message: "Cost Savings Review live funnel smoke failed.",
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
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function fetchWithTimeout(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms.`);
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

async function assertRouteText(baseUrl, pathName, expected, options = {}) {
  const result = await fetchText(`${baseUrl}${pathName}`, { redirect: options.redirect ?? "follow" });
  const allowed = options.allowedStatuses ?? [200];
  assert(allowed.includes(result.res.status), `${pathName} returned unexpected status.`, {
    status: result.res.status,
  });
  if (expected) {
    assert(result.text.includes(expected), `${pathName} did not contain expected copy.`, {
      expected,
      status: result.res.status,
    });
  }
  return { path: pathName, status: result.res.status };
}

async function runRouteAndGuardChecks(baseUrl) {
  const checks = [];
  checks.push(await assertRouteText(baseUrl, "/inventory-purchasing", "Request My Savings Review"));
  checks.push(await assertRouteText(baseUrl, `/waitlist?product=${PRODUCT_INTENT}`, "Request my free review"));

  const admin = await fetchText(`${baseUrl}/admin/cost-control`, { redirect: "manual" });
  assert([200, 302, 303, 307, 308, 401, 403].includes(admin.res.status), "/admin/cost-control did not gate or load cleanly.", {
    status: admin.res.status,
  });
  checks.push({ path: "/admin/cost-control", status: admin.res.status });

  const client = await fetchText(`${baseUrl}/dashboard/cost-control`, { redirect: "manual" });
  assert([200, 302, 303, 307, 308, 401, 403].includes(client.res.status), "/dashboard/cost-control did not gate or load cleanly.", {
    status: client.res.status,
  });
  checks.push({ path: "/dashboard/cost-control", status: client.res.status });

  const sync = await fetchJson(`${baseUrl}/api/admin/cost-control/sync`, { method: "POST" });
  assert([401, 403].includes(sync.res.status), "Unauthenticated Cost Control sync did not require admin access.", {
    status: sync.res.status,
    body: sync.data ?? sync.text.slice(0, 400),
  });
  checks.push({ path: "/api/admin/cost-control/sync unauthenticated", status: sync.res.status });

  const action = await fetchJson(`${baseUrl}/api/cost-control/opportunities/00000000-0000-0000-0000-000000000000`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionType: "review" }),
  });
  assert(action.res.status === 401, "Unauthenticated Cost Control opportunity action did not require login.", {
    status: action.res.status,
    body: action.data ?? action.text.slice(0, 400),
  });
  checks.push({ path: "/api/cost-control/opportunities/[id] unauthenticated", status: action.res.status });

  return checks;
}

async function submitQaIntake(baseUrl) {
  if (skipIntakeWrite) {
    return { skipped: true, reason: "Skipped by --skip-intake-write." };
  }

  const qaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+cost-savings-${qaId}@home-reach.com`;
  const phone = "+15555550199";
  const payload = {
    name: "HomeReach QA Cost Review",
    businessName: `HomeReach QA Cost Savings ${qaId}`,
    email,
    phone,
    productIntent: PRODUCT_INTENT,
    productContext: {
      businessType: "Restaurant / QSR",
      monthlySupplySpend: "$10,000 - $25,000",
      biggestProcurementPain: "Compare supplier prices",
      primarySuppliers: "QA supplier only - do not contact",
      smsConsent: "false",
      smsConsentSource: "cost_savings_review_smoke",
    },
  };

  const intake = await fetchJson(`${baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert(intake.res.status === 200 && intake.data?.success === true, "Procurement savings review intake did not save.", {
    status: intake.res.status,
    body: intake.data ?? intake.text.slice(0, 400),
  });

  return { skipped: false, email, phone, businessName: payload.businessName };
}

async function runDbChecks({ env, intake }) {
  if (skipDbChecks) {
    return { skipped: true, reason: "Skipped by --skip-db-checks." };
  }

  if (intake?.skipped) {
    return { skipped: true, reason: "No intake write was created." };
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      skipped: true,
      reason: "Supabase env vars unavailable locally; route and API checks still ran.",
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: entry, error: entryError } = await withTimeout(
    supabase
      .from("waitlist_entries")
      .select("id,email,phone,name,business_name,product_intent,product_context,created_at")
      .eq("email", intake.email)
      .eq("product_intent", PRODUCT_INTENT)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "procurement review waitlist lookup",
  );
  if (entryError) throw new Error(`procurement review waitlist lookup failed: ${entryError.message}`);
  assert(entry, "QA procurement review waitlist entry was not found.", { email: intake.email });
  assert(entry.phone === intake.phone, "Phone was not stored when SMS consent was false.", {
    expectedPhone: intake.phone,
    storedPhone: entry.phone,
  });
  assert(entry.product_context?.businessType === "Restaurant / QSR", "Procurement business type context was not stored.", {
    productContext: entry.product_context,
  });
  assert(entry.product_context?.smsConsent === "false", "SMS consent state was not preserved separately from phone.", {
    productContext: entry.product_context,
  });

  const { data: tasks, error: taskError } = await withTimeout(
    supabase
      .from("ai_workforce_tasks")
      .select("id,task_id,status,assigned_agent,approval_required,related_opportunity,input_data,created_at")
      .eq("related_opportunity", PRODUCT_INTENT)
      .order("created_at", { ascending: false })
      .limit(25),
    "procurement review AI task lookup",
  );
  if (taskError) throw new Error(`procurement review AI task lookup failed: ${taskError.message}`);

  const task = (tasks ?? []).find((row) => row.input_data?.waitlistEntryId === entry.id);
  assert(task, "Procurement Agent task was not created for the intake.", {
    waitlistEntryId: entry.id,
    taskCount: tasks?.length ?? 0,
  });
  assert(task.assigned_agent === "Procurement Agent", "Procurement review task was assigned to the wrong agent.", {
    assignedAgent: task.assigned_agent,
  });
  assert(task.approval_required === true, "Procurement review task is missing the required approval gate.", {
    approvalRequired: task.approval_required,
  });
  assert(task.input_data?.contact?.phone === intake.phone, "Procurement review task did not retain contact phone.", {
    contact: task.input_data?.contact,
  });

  const archiveNote = "QA smoke archived: Cost Savings Review live funnel verification. Do not contact.";
  let archived = false;
  if (archiveQaRecord) {
    await withTimeout(
      supabase
        .from("waitlist_entries")
        .update({
          name: `[QA ARCHIVED] ${entry.name ?? "Cost Savings Review Smoke"}`,
          business_name: `[QA ARCHIVED] ${entry.business_name ?? intake.businessName}`,
          product_context: {
            ...(entry.product_context ?? {}),
            qaSmokeArchived: true,
            qaSmokeArchivedAt: new Date().toISOString(),
            qaSmokeArchiveNote: archiveNote,
          },
        })
        .eq("id", entry.id),
      "archive procurement review waitlist QA record",
    );

    await withTimeout(
      supabase
        .from("ai_workforce_tasks")
        .update({
          status: "qa_archived",
          completion_notes: archiveNote,
        })
        .eq("id", task.id),
      "archive procurement review AI task",
    );
    archived = true;
  }

  return {
    skipped: false,
    waitlistEntryId: entry.id,
    aiTaskId: task.id,
    taskPublicId: task.task_id,
    archived,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.COST_SAVINGS_REVIEW_SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL ?? env.SMOKE_BASE_URL,
);

let routeChecks;
let intake;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  intake = await submitQaIntake(baseUrl);
  dbChecks = await runDbChecks({ env, intake });
} catch (error) {
  fail(error instanceof Error ? error.message : "Cost Savings Review smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "cost-savings-review",
      baseUrl,
      routeChecks,
      intake,
      dbChecks,
    },
    null,
    2,
  ),
);
