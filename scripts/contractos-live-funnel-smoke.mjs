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
const Stripe = requireFromWeb("stripe");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.CONTRACTOS_SMOKE_TIMEOUT_MS ?? 30000);
const PRODUCT_INTENT = "contractos-managed-bid-help";
const RELATED_OPPORTUNITY = "contractos";
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");
const skipIntakeWrite = args.has("--skip-intake-write");
const skipCheckout = args.has("--skip-checkout");
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
        message: "ContractOS live funnel smoke failed.",
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
    await assertRouteText(baseUrl, "/contractos", "Open ContractOS"),
  );
  checks.push(
    await assertRouteText(
      baseUrl,
      "/contractos/dashboard",
      "Document review lane",
    ),
  );
  checks.push(
    await assertRouteText(
      baseUrl,
      "/waitlist?product=contractos-readiness-scan",
      "Start readiness scan",
    ),
  );

  for (const pathName of ["/admin/contractos", "/admin/gov-contracts"]) {
    const admin = await fetchText(`${baseUrl}${pathName}`, {
      redirect: "manual",
    });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(admin.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: admin.res.status },
    );
    checks.push({ path: pathName, status: admin.res.status });
  }

  const sync = await fetchJson(`${baseUrl}/api/admin/gov-contracts/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyword: "landscaping", limit: 1 }),
  });
  assert(
    [401, 403].includes(sync.res.status),
    "Unauthenticated ContractOS SAM sync did not require admin or cron access.",
    { status: sync.res.status, body: sync.data ?? sync.text.slice(0, 400) },
  );
  checks.push({
    path: "/api/admin/gov-contracts/sync unauthenticated",
    status: sync.res.status,
  });

  return checks;
}

async function submitQaIntake(baseUrl) {
  if (skipIntakeWrite) {
    return { skipped: true, reason: "Skipped by --skip-intake-write." };
  }

  const qaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+contractos-${qaId}@home-reach.com`;
  const businessName = `HomeReach QA ContractOS ${qaId}`;
  const payload = {
    name: "HomeReach QA ContractOS",
    businessName,
    email,
    phone: "+15555550268",
    productIntent: PRODUCT_INTENT,
    productContext: {
      website: "https://www.home-reach.com",
      contractosRequestType: "Managed bid support",
      contractosIndustry: "Landscaping and facilities support",
      contractosGovStatus: "Registered in SAM.gov",
      contractosOpportunityUrl: "https://sam.gov/opp/qa-contractos-smoke",
      contractosDeadline: "June 30, 2026",
      contractosSupportNeed: "Decide bid/no-bid",
      contractosNotes:
        "QA smoke only. Do not contact. Verify ContractOS approval-gated intake handoff.",
      smsConsent: "false",
      smsConsentSource: "contractos_smoke",
    },
  };

  const intake = await fetchJson(`${baseUrl}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert(
    intake.res.status === 200 && intake.data?.success === true,
    "ContractOS intake did not save.",
    {
      status: intake.res.status,
      body: intake.data ?? intake.text.slice(0, 400),
    },
  );

  return { skipped: false, email, businessName };
}

async function runDocumentAnalyzerCheck(baseUrl) {
  const form = new FormData();
  form.set(
    "text",
    [
      "Solicitation QA-RFQ-2026: The agency seeks landscaping and grounds maintenance services.",
      "Quotes are due June 30, 2026 by email.",
      "Offerors must include SF 1449, technical approach, past performance, pricing sheet, SAM UEI and CAGE confirmation, insurance, and subcontractor disclosures.",
      "This is a firm fixed price request for quotations with a base year and option year.",
    ].join("\n"),
  );

  const result = await fetchJson(`${baseUrl}/api/contractos/documents/analyze`, {
    method: "POST",
    body: form,
  });

  assert(
    result.res.status === 200 && result.data?.ok === true,
    "ContractOS document analyzer failed.",
    {
      status: result.res.status,
      body: result.data ?? result.text.slice(0, 400),
    },
  );
  assert(
    result.data.approvalGate?.includes("Human Review Required"),
    "Document analyzer response is missing the human-review approval gate.",
    { approvalGate: result.data.approvalGate },
  );
  assert(
    ["ai", "deterministic"].includes(result.data.analysis?.analysisMode),
    "Document analyzer did not return a supported analysis mode.",
    { analysis: result.data.analysis },
  );
  assert(
    (result.data.analysis?.requiredDocuments ?? []).length > 0,
    "Document analyzer did not extract required documents.",
    { analysis: result.data.analysis },
  );

  return {
    status: result.res.status,
    analysisMode: result.data.analysis.analysisMode,
    parserStatus: result.data.analysis.parserStatus,
    requiredDocuments: result.data.analysis.requiredDocuments.length,
    warnings: result.data.analysis.warnings,
  };
}

async function runCheckoutCheck(baseUrl, env) {
  if (skipCheckout) {
    return { skipped: true, reason: "Skipped by --skip-checkout." };
  }

  const result = await fetchJson(`${baseUrl}/api/contractos/billing/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      plan: "watchtower",
      email: `qa+contractos-checkout-${Date.now()}@home-reach.com`,
      requestId: crypto.randomUUID(),
    }),
  });

  assert(
    result.res.status === 200 && result.data?.ok === true && result.data?.sessionId,
    "ContractOS checkout session was not created.",
    {
      status: result.res.status,
      body: result.data ?? result.text.slice(0, 400),
    },
  );
  assert(
    String(result.data.url ?? "").startsWith("https://checkout.stripe.com/"),
    "ContractOS checkout did not return a Stripe Checkout URL.",
    { url: result.data.url },
  );

  let expired = null;
  if (env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
    const session = await withTimeout(
      stripe.checkout.sessions.expire(result.data.sessionId),
      "expire ContractOS Checkout Session",
    );
    expired = {
      sessionId: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
    };
  }

  return {
    status: result.res.status,
    sessionId: result.data.sessionId,
    expired,
    warnings: result.data.warnings,
  };
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
    "ContractOS waitlist lookup",
  );
  if (entryError) {
    throw new Error(`ContractOS waitlist lookup failed: ${entryError.message}`);
  }
  assert(entry, "QA ContractOS waitlist entry was not found.", {
    email: intake.email,
  });
  assert(
    entry.product_context?.contractosRequestType === "Managed bid support",
    "ContractOS request type context was not stored.",
    { productContext: entry.product_context },
  );
  assert(
    entry.product_context?.contractosSupportNeed === "Decide bid/no-bid",
    "ContractOS support need context was not stored.",
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
    "ContractOS AI task lookup",
  );
  if (taskError) {
    throw new Error(`ContractOS AI task lookup failed: ${taskError.message}`);
  }

  const task = (tasks ?? []).find(
    (row) => row.input_data?.waitlistEntryId === entry.id,
  );
  assert(task, "SAM.gov Contract Agent task was not created for the intake.", {
    waitlistEntryId: entry.id,
    taskCount: tasks?.length ?? 0,
  });
  assert(
    task.assigned_agent === "SAM.gov Contract Agent",
    "ContractOS request task was assigned to the wrong agent.",
    { assignedAgent: task.assigned_agent },
  );
  assert(
    task.approval_required === true,
    "ContractOS task is missing the required approval gate.",
    { approvalRequired: task.approval_required },
  );
  assert(
    task.input_data?.contractOSIntake?.contractosOpportunityUrl,
    "ContractOS task did not retain intake context.",
    { contractOSIntake: task.input_data?.contractOSIntake },
  );

  const archiveNote =
    "QA smoke archived: ContractOS live funnel verification. Do not contact.";
  let archived = false;
  if (archiveQaRecord) {
    await withTimeout(
      supabase
        .from("waitlist_entries")
        .update({
          name: `[QA ARCHIVED] ${entry.name ?? "ContractOS Smoke"}`,
          business_name: `[QA ARCHIVED] ${entry.business_name ?? intake.businessName}`,
          product_context: {
            ...(entry.product_context ?? {}),
            qaSmokeArchived: true,
            qaSmokeArchivedAt: new Date().toISOString(),
            qaSmokeArchiveNote: archiveNote,
          },
        })
        .eq("id", entry.id),
      "archive ContractOS waitlist QA record",
    );

    await withTimeout(
      supabase
        .from("ai_workforce_tasks")
        .update({
          status: "completed",
          completion_notes: archiveNote,
        })
        .eq("id", task.id),
      "archive ContractOS AI task",
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
  env.CONTRACTOS_SMOKE_BASE_URL ??
    env.LIVE_FUNNEL_BASE_URL ??
    env.SMOKE_BASE_URL,
);

let routeChecks;
let intake;
let dbChecks;
let documentAnalyzer;
let checkout;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  intake = await submitQaIntake(baseUrl);
  dbChecks = await runDbChecks({ env, intake });
  documentAnalyzer = await runDocumentAnalyzerCheck(baseUrl);
  checkout = await runCheckoutCheck(baseUrl, env);
} catch (error) {
  fail(error instanceof Error ? error.message : "ContractOS smoke failed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "contractos",
      baseUrl,
      routeChecks,
      intake,
      dbChecks,
      documentAnalyzer,
      checkout,
    },
    null,
    2,
  ),
);
