import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(
  path.join(rootDir, "apps/web/package.json"),
);
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(
  process.env.SOCIAL_CONTENT_SMOKE_TIMEOUT_MS ?? 30000,
);
const PRODUCT_INTENT = "social-content";
const RELATED_OPPORTUNITY = "social-content-drafting";
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
        message: "Social Content live funnel smoke failed.",
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

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeout),
  );
}

async function fetchWithTimeout(url, init, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError")
      throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    throw new Error(
      `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
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
  const result = await fetchText(`${baseUrl}${pathName}`, {
    redirect: options.redirect ?? "follow",
  });
  const allowed = options.allowedStatuses ?? [200];
  assert(
    allowed.includes(result.res.status),
    `${pathName} returned unexpected status.`,
    { status: result.res.status },
  );
  if (expected) {
    assert(
      result.text.includes(expected),
      `${pathName} did not contain expected copy.`,
      { expected, status: result.res.status },
    );
  }
  return { path: pathName, status: result.res.status };
}

async function runRouteAndGuardChecks(baseUrl) {
  const checks = [];
  checks.push(
    await assertRouteText(
      baseUrl,
      "/services/social-content",
      "Request Social Content",
    ),
  );
  checks.push(
    await assertRouteText(
      baseUrl,
      `/waitlist?product=${PRODUCT_INTENT}`,
      "Request content plan",
    ),
  );

  for (const pathName of ["/admin/content-intel", "/admin/content-review"]) {
    const admin = await fetchText(`${baseUrl}${pathName}`, { redirect: "manual" });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(admin.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: admin.res.status },
    );
    checks.push({ path: pathName, status: admin.res.status });
  }

  const metrics = await fetchJson(`${baseUrl}/api/admin/social-content/metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: "manual" }),
  });
  assert(
    [401, 403].includes(metrics.res.status),
    "Unauthenticated Social Content metrics import did not require admin access.",
    {
      status: metrics.res.status,
      body: metrics.data ?? metrics.text.slice(0, 400),
    },
  );
  checks.push({
    path: "/api/admin/social-content/metrics unauthenticated",
    status: metrics.res.status,
  });

  const sync = await fetchJson(`${baseUrl}/api/admin/social-content/metrics/sync`, {
    method: "POST",
  });
  assert(
    [401, 403].includes(sync.res.status),
    "Unauthenticated Social Content metrics sync did not require admin access.",
    {
      status: sync.res.status,
      body: sync.data ?? sync.text.slice(0, 400),
    },
  );
  checks.push({
    path: "/api/admin/social-content/metrics/sync unauthenticated",
    status: sync.res.status,
  });

  return checks;
}

async function submitQaIntake(baseUrl) {
  if (skipIntakeWrite) {
    return { skipped: true, reason: "Skipped by --skip-intake-write." };
  }

  const qaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+social-content-${qaId}@home-reach.com`;
  const phone = "+15555550248";
  const payload = {
    name: "HomeReach QA Social Content",
    businessName: `HomeReach QA Social Content ${qaId}`,
    email,
    phone,
    productIntent: PRODUCT_INTENT,
    productContext: {
      website: "https://www.home-reach.com",
      contentPackage: "8 draft posts / month",
      contentGoal: "Stay visible locally",
      contentChannels: "Facebook, Instagram, Google Business Profile",
      contentAudience: "Local homeowners and past customers",
      contentPrimaryOffer: "Spring inspection campaign",
      contentBrandVoice: "Friendly, direct, local",
      contentAssetsStatus: "Logo and photos ready",
      contentApprovalOwner: "Owner",
      contentNotes:
        "QA smoke only. Do not contact. Verify draft-only social content handoff.",
      smsConsent: "false",
      smsConsentSource: "social_content_smoke",
    },
  };

  const intake = await fetchJson(`${baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert(
    intake.res.status === 200 && intake.data?.success === true,
    "Social Content intake did not save.",
    {
      status: intake.res.status,
      body: intake.data ?? intake.text.slice(0, 400),
    },
  );

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
      reason:
        "Supabase env vars unavailable locally; route and API checks still ran.",
    };
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: entry, error: entryError } = await withTimeout(
    supabase
      .from("waitlist_entries")
      .select(
        "id,email,phone,name,business_name,product_intent,product_context,created_at",
      )
      .eq("email", intake.email)
      .eq("product_intent", PRODUCT_INTENT)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "social content waitlist lookup",
  );
  if (entryError)
    throw new Error(
      `social content waitlist lookup failed: ${entryError.message}`,
    );
  assert(entry, "QA Social Content waitlist entry was not found.", {
    email: intake.email,
  });
  assert(
    entry.product_context?.contentPackage === "8 draft posts / month",
    "Content package context was not stored.",
    { productContext: entry.product_context },
  );
  assert(
    entry.product_context?.contentApprovalOwner === "Owner",
    "Content approval owner context was not stored.",
    { productContext: entry.product_context },
  );
  assert(
    entry.product_context?.smsConsent === "false",
    "SMS consent state was not preserved separately from phone.",
    { productContext: entry.product_context },
  );

  const { data: tasks, error: taskError } = await withTimeout(
    supabase
      .from("ai_workforce_tasks")
      .select(
        "id,task_id,status,assigned_agent,approval_required,related_opportunity,input_data,created_at",
      )
      .eq("related_opportunity", RELATED_OPPORTUNITY)
      .order("created_at", { ascending: false })
      .limit(25),
    "social content AI task lookup",
  );
  if (taskError)
    throw new Error(`social content AI task lookup failed: ${taskError.message}`);

  const task = (tasks ?? []).find(
    (row) => row.input_data?.waitlistEntryId === entry.id,
  );
  assert(
    task,
    "Content Strategy Agent task was not created for the intake.",
    {
      waitlistEntryId: entry.id,
      taskCount: tasks?.length ?? 0,
    },
  );
  assert(
    task.assigned_agent === "Content Strategy Agent",
    "Social Content request task was assigned to the wrong agent.",
    { assignedAgent: task.assigned_agent },
  );
  assert(
    task.approval_required === true,
    "Social Content task is missing the required approval gate.",
    { approvalRequired: task.approval_required },
  );
  assert(
    task.input_data?.socialContentIntake?.contentGoal === "Stay visible locally",
    "Social Content task did not retain intake context.",
    { socialContentIntake: task.input_data?.socialContentIntake },
  );

  const archiveNote =
    "QA smoke archived: Social Content live funnel verification. Do not contact.";
  let archived = false;
  if (archiveQaRecord) {
    await withTimeout(
      supabase
        .from("waitlist_entries")
        .update({
          name: `[QA ARCHIVED] ${entry.name ?? "Social Content Smoke"}`,
          business_name: `[QA ARCHIVED] ${entry.business_name ?? intake.businessName}`,
          product_context: {
            ...(entry.product_context ?? {}),
            qaSmokeArchived: true,
            qaSmokeArchivedAt: new Date().toISOString(),
            qaSmokeArchiveNote: archiveNote,
          },
        })
        .eq("id", entry.id),
      "archive social content waitlist QA record",
    );

    await withTimeout(
      supabase
        .from("ai_workforce_tasks")
        .update({
          status: "qa_archived",
          completion_notes: archiveNote,
        })
        .eq("id", task.id),
      "archive social content AI task",
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
  env.SOCIAL_CONTENT_SMOKE_BASE_URL ??
    env.LIVE_FUNNEL_BASE_URL ??
    env.SMOKE_BASE_URL,
);

let routeChecks;
let intake;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  intake = await submitQaIntake(baseUrl);
  dbChecks = await runDbChecks({ env, intake });
} catch (error) {
  fail(error instanceof Error ? error.message : "Social Content smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "social-content-drafting",
      baseUrl,
      routeChecks,
      intake,
      dbChecks,
    },
    null,
    2,
  ),
);
