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
  process.env.AI_WEBSITE_ASSISTANT_SMOKE_TIMEOUT_MS ?? 30000,
);
const RELATED_OPPORTUNITY = "ai-website-assistant";
const args = new Set(process.argv.slice(2));
const skipDbChecks = args.has("--skip-db-checks");
const skipDemoWrite = args.has("--skip-demo-write");
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
        message: "AI Website Assistant live funnel smoke failed.",
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
      "/services/ai-website-assistant",
      "Get a Free AI Assistant Demo",
    ),
  );
  checks.push(
    await assertRouteText(
      baseUrl,
      "/api/ai-web-assistant/widget.js",
      "AI Assistant demo pending activation",
    ),
  );

  for (const pathName of ["/admin/ai-web-assistant", "/ai-assistant"]) {
    const result = await fetchText(`${baseUrl}${pathName}`, {
      redirect: "manual",
    });
    assert(
      [200, 302, 303, 307, 308, 401, 403].includes(result.res.status),
      `${pathName} did not gate or load cleanly.`,
      { status: result.res.status },
    );
    checks.push({ path: pathName, status: result.res.status });
  }

  return checks;
}

async function submitQaDemo(baseUrl) {
  if (skipDemoWrite) {
    return { skipped: true, reason: "Skipped by --skip-demo-write." };
  }

  const qaId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa+ai-web-assistant-${qaId}@home-reach.com`;
  const businessName = `HomeReach QA AI Assistant ${qaId}`;
  const payload = {
    businessName,
    contactName: "HomeReach QA Assistant",
    email,
    websiteUrl: "https://www.home-reach.com",
    phone: "+15555550258",
    category: "Roofing",
    serviceAreas: "Columbus, OH, Franklin County",
    mainServices: "Roof repair, storm damage inspections, gutter repair",
    hours: "Mon-Fri 8-5",
    bookingPreference: "Request callback",
    contactPreference:
      "Email owner for normal leads and call for urgent leaks",
    preferredPlan: "Starter Assistant",
    consent: true,
  };

  const demo = await fetchJson(`${baseUrl}/api/ai-web-assistant/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert(
    demo.res.status === 200 && demo.data?.ok === true,
    "AI Website Assistant demo did not generate.",
    {
      status: demo.res.status,
      body: demo.data ?? demo.text.slice(0, 400),
    },
  );
  assert(
    Boolean(demo.data?.profile?.embedCode && demo.data?.profile?.embedKey),
    "Demo response did not include an embed preview.",
    { body: demo.data },
  );
  assert(
    Array.isArray(demo.data?.profile?.setupChecklist) &&
      demo.data.profile.setupChecklist.length > 0,
    "Demo response did not include a setup checklist.",
    { body: demo.data },
  );
  assert(demo.data.persisted === true, "Demo request was not persisted.", {
    body: demo.data,
  });
  assert(
    !demo.data.aiWorkforceTaskWarning,
    "AI Workforce task warning returned from demo route.",
    { warning: demo.data.aiWorkforceTaskWarning },
  );
  assert(
    demo.data.aiWorkforceTask?.assignedAgent === "Orchestrator Agent",
    "Demo route did not return the expected AI Workforce handoff.",
    { aiWorkforceTask: demo.data.aiWorkforceTask },
  );

  return {
    skipped: false,
    email,
    businessName,
    embedKey: demo.data.profile.embedKey,
    taskPublicId: demo.data.aiWorkforceTask.taskId,
  };
}

async function runDbChecks({ env, demo }) {
  if (skipDbChecks) {
    return { skipped: true, reason: "Skipped by --skip-db-checks." };
  }

  if (demo?.skipped) {
    return { skipped: true, reason: "No demo write was created." };
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

  const { data: assistant, error: assistantError } = await withTimeout(
    supabase
      .from("ai_web_assistants")
      .select(
        "id,business_name,embed_key,status,widget_enabled,metadata,settings,created_at",
      )
      .eq("business_name", demo.businessName)
      .eq("source", "public_ai_web_assistant_demo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "AI Website Assistant setup lookup",
  );
  if (assistantError) {
    throw new Error(
      `AI Website Assistant setup lookup failed: ${assistantError.message}`,
    );
  }
  assert(assistant, "QA AI Website Assistant setup record was not found.", {
    businessName: demo.businessName,
  });
  assert(
    assistant.status === "demo_requested",
    "Assistant record did not stay in approval-gated demo status.",
    { status: assistant.status },
  );
  assert(
    assistant.widget_enabled === false,
    "Assistant widget was enabled during demo smoke.",
    { widgetEnabled: assistant.widget_enabled },
  );
  assert(
    assistant.embed_key === demo.embedKey &&
      String(assistant.embed_key).startsWith("demo_"),
    "Assistant embed key was not stored as a demo key.",
    { storedEmbedKey: assistant.embed_key, responseEmbedKey: demo.embedKey },
  );
  assert(
    assistant.metadata?.email === demo.email &&
      assistant.metadata?.humanApprovalRequired === true,
    "Assistant metadata is missing contact or approval guardrails.",
    { metadata: assistant.metadata },
  );

  const { data: knowledgeItems, error: knowledgeError } = await withTimeout(
    supabase
      .from("ai_web_assistant_knowledge_items")
      .select("id,item_type,approval_status")
      .eq("ai_web_assistant_id", assistant.id)
      .limit(50),
    "AI Website Assistant knowledge item lookup",
  );
  if (knowledgeError) {
    throw new Error(
      `AI Website Assistant knowledge lookup failed: ${knowledgeError.message}`,
    );
  }
  assert(
    (knowledgeItems ?? []).length >= 5,
    "Assistant knowledge and guardrail records were not created.",
    { count: knowledgeItems?.length ?? 0 },
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
    "AI Website Assistant AI Workforce task lookup",
  );
  if (taskError) {
    throw new Error(
      `AI Website Assistant AI Workforce lookup failed: ${taskError.message}`,
    );
  }

  const task = (tasks ?? []).find(
    (row) => row.input_data?.assistantId === assistant.id,
  );
  assert(task, "AI Workforce setup task was not created for the demo.", {
    assistantId: assistant.id,
    taskCount: tasks?.length ?? 0,
  });
  assert(
    task.assigned_agent === "Orchestrator Agent",
    "AI Website Assistant task was assigned to the wrong agent.",
    { assignedAgent: task.assigned_agent },
  );
  assert(
    task.approval_required === true,
    "AI Website Assistant task is missing the required approval gate.",
    { approvalRequired: task.approval_required },
  );
  assert(
    task.input_data?.source === "public_ai_web_assistant_demo" &&
      task.input_data?.contact?.email === demo.email,
    "AI Website Assistant task did not retain demo context.",
    { inputData: task.input_data },
  );

  const { data: activityLog, error: activityError } = await withTimeout(
    supabase
      .from("ai_workforce_activity_logs")
      .select("id,task_id,task_public_id,agent_name,event_type,approval_status")
      .eq("task_id", task.id)
      .eq("event_type", "ai_web_assistant_demo_received")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "AI Website Assistant AI Workforce activity lookup",
  );
  if (activityError) {
    throw new Error(
      `AI Website Assistant activity lookup failed: ${activityError.message}`,
    );
  }
  assert(activityLog, "AI Workforce activity log was not created.", {
    taskId: task.id,
  });
  assert(
    activityLog.approval_status === "needs_review",
    "AI Workforce activity log did not keep approval review status.",
    { approvalStatus: activityLog.approval_status },
  );

  const archiveNote =
    "QA smoke archived: AI Website Assistant live funnel verification. Do not contact.";
  let archived = false;
  if (archiveQaRecord) {
    await withTimeout(
      supabase
        .from("ai_web_assistants")
        .update({
          status: "archived",
          business_name: `[QA ARCHIVED] ${assistant.business_name}`,
          metadata: {
            ...(assistant.metadata ?? {}),
            qaSmokeArchived: true,
            qaSmokeArchivedAt: new Date().toISOString(),
            qaSmokeArchiveNote: archiveNote,
          },
        })
        .eq("id", assistant.id),
      "archive AI Website Assistant QA record",
    );

    await withTimeout(
      supabase
        .from("ai_workforce_tasks")
        .update({
          status: "completed",
          completion_notes: archiveNote,
        })
        .eq("id", task.id),
      "archive AI Website Assistant AI task",
    );
    archived = true;
  }

  return {
    skipped: false,
    assistantId: assistant.id,
    aiTaskId: task.id,
    taskPublicId: task.task_id,
    activityLogId: activityLog.id,
    archived,
  };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(
  env.AI_WEBSITE_ASSISTANT_SMOKE_BASE_URL ??
    env.LIVE_FUNNEL_BASE_URL ??
    env.SMOKE_BASE_URL,
);

let routeChecks;
let demo;
let dbChecks;
try {
  routeChecks = await runRouteAndGuardChecks(baseUrl);
  demo = await submitQaDemo(baseUrl);
  dbChecks = await runDbChecks({ env, demo });
} catch (error) {
  fail(
    error instanceof Error
      ? error.message
      : "AI Website Assistant smoke failed.",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      service: "ai-website-assistant",
      baseUrl,
      routeChecks,
      demo,
      dbChecks,
    },
    null,
    2,
  ),
);
