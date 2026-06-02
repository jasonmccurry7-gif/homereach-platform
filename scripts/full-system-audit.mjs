import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_BASE_URL = "https://www.home-reach.com";
const REQUEST_TIMEOUT_MS = Number(process.env.FULL_SYSTEM_AUDIT_TIMEOUT_MS ?? 30000);
const REPORT_DIR = path.join(rootDir, "ai-workforce", "reports");
const args = new Set(process.argv.slice(2));
const createAgentTasks = args.has("--create-agent-tasks") || process.env.FULL_SYSTEM_AUDIT_CREATE_TASKS === "true";

const publicRoutes = [
  "/",
  "/shared-postcards",
  "/targeted",
  "/political",
  "/political-mail",
  "/local-visibility",
  "/services/ai-website-assistant",
  "/inventory",
  "/inventory-purchasing",
  "/contractos",
  "/market-capture",
  "/privacy",
  "/terms",
];

const protectedRoutes = [
  "/admin",
  "/admin/agents",
  "/admin/ai-assets",
  "/admin/revenue-operations",
  "/admin/daily-outreach",
  "/admin/procurement",
  "/admin/political",
  "/admin/gov-contracts",
  "/admin/group-intelligence",
  "/admin/email-infrastructure",
  "/admin/agent-mini-apps",
  "/dashboard",
  "/dashboard/social-publishing",
  "/dashboard/business-memory",
  "/dashboard/growth-intelligence",
];

const apiGuards = [
  { path: "/api/admin/agent-mini-apps", method: "GET" },
  { path: "/api/admin/agent-integrations", method: "GET" },
  { path: "/api/admin/daily-outreach", method: "GET" },
  { path: "/api/admin/revenue-messaging/threads", method: "GET" },
  { path: "/api/admin/group-intelligence", method: "GET" },
  { path: "/api/admin/growth-intelligence/sync", method: "POST" },
  { path: "/api/admin/business-memory/sync", method: "POST" },
  { path: "/api/admin/ad-tech/sync", method: "POST" },
  { path: "/api/admin/social-content/meta/publish-due", method: "POST" },
  { path: "/api/admin/ai-workforce/actions", method: "POST", body: { action: "create_task" } },
  { path: "/api/admin/ai-assets/actions", method: "POST", body: { action: "create_ai_output" } },
];

const tableGroups = [
  {
    key: "core_funnel",
    title: "Core Funnel",
    tables: ["cities", "bundles", "categories", "sales_leads", "leads", "orders", "spot_assignments", "targeted_route_campaigns"],
  },
  {
    key: "ai_workforce",
    title: "AI Workforce / AI Assets",
    tables: [
      "ai_business_context",
      "ai_prompt_sops",
      "ai_data_sources",
      "ai_agent_profiles",
      "ai_prompt_chains",
      "ai_outputs",
      "ai_output_reviews",
      "ai_workforce_tasks",
      "ai_workforce_activity_logs",
      "ai_workforce_memory_items",
    ],
  },
  {
    key: "agent_execution",
    title: "Agent Execution",
    tables: [
      "agent_mini_apps",
      "agent_mini_app_events",
      "agent_execution_queue",
      "agent_execution_attempts",
      "integration_connections",
      "agent_tool_permissions",
      "external_action_intents",
    ],
  },
  {
    key: "outreach_revenue",
    title: "Outreach / Revenue",
    tables: [
      "system_controls",
      "daily_outreach_tasks",
      "daily_outreach_activity",
      "daily_outreach_campaign_controls",
      "revenue_message_events",
      "revenue_message_approval_queue",
      "revenue_pipeline_items",
      "revenue_pipeline_tasks",
      "outreach_suppression_list",
      "outreach_scaling_recommendations",
    ],
  },
  {
    key: "political",
    title: "Political",
    tables: [
      "candidate_intel_profiles",
      "candidate_intel_source_records",
      "political_candidate_agents",
      "political_candidate_research",
      "political_district_intelligence",
      "political_mail_launch_plans",
      "political_mail_launch_phases",
      "political_candidate_creative_concepts",
      "political_plan_approvals",
    ],
  },
  {
    key: "procurement",
    title: "Procurement / Supplyfy",
    tables: [
      "opcopilot_savings_recommendations",
      "opcopilot_delivery_events",
      "opcopilot_invoice_audits",
      "opcopilot_vendor_scorecards",
      "opcopilot_procurement_efficiency_scores",
      "opcopilot_inventory_forecasts",
    ],
  },
  {
    key: "gov_contracts",
    title: "Gov Contracts / SAM.gov",
    tables: [
      "gov_contract_opportunities",
      "gov_contract_sync_runs",
      "gov_contract_bid_rooms",
      "gov_contract_subcontractors",
      "gov_contract_subcontractor_matches",
      "gov_contract_bid_requirements",
      "gov_contract_bid_tasks",
      "gov_contract_submission_packages",
      "gov_contract_audit_logs",
      "gov_contract_agency_profiles",
      "gov_contract_proposal_sections",
    ],
  },
  {
    key: "local_growth",
    title: "Local Growth Products",
    tables: [
      "local_visibility_businesses",
      "local_visibility_scans",
      "local_visibility_reviews",
      "local_visibility_review_requests",
      "local_visibility_recommendations",
      "local_visibility_alerts",
      "ai_web_assistants",
      "ai_web_assistant_knowledge_items",
      "ai_web_assistant_conversations",
      "ai_web_assistant_leads",
      "group_intelligence_sources",
      "group_intelligence_observations",
      "group_response_drafts",
    ],
  },
  {
    key: "content_growth",
    title: "Content / Growth Intelligence",
    tables: [
      "content_assets",
      "content_asset_versions",
      "social_publication_records",
      "social_post_metrics_daily",
      "content_learning_events",
      "social_meta_connections",
      "social_publish_attempts",
      "growth_intelligence_admin_entries",
      "growth_intelligence_sources",
      "growth_intelligence_opportunities",
      "growth_intelligence_reports",
      "campaign_launch_packages",
      "campaign_approvals",
      "integration_health",
    ],
  },
];

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
      value = value.slice(1, -1);
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

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

async function checkRoute(baseUrl, route, mode) {
  const response = await fetchWithTimeout(`${baseUrl}${route}`, { redirect: "manual" });
  const location = response.headers.get("location") ?? null;
  const ok =
    mode === "public"
      ? response.status >= 200 && response.status < 400
      : [302, 303, 307, 308, 401, 403].includes(response.status);

  return {
    route,
    mode,
    status: response.status,
    location,
    result: ok ? "pass" : "fail",
  };
}

async function checkApiGuard(baseUrl, item) {
  const response = await fetchWithTimeout(`${baseUrl}${item.path}`, {
    method: item.method,
    headers: item.body ? { "Content-Type": "application/json" } : undefined,
    body: item.body ? JSON.stringify(item.body) : undefined,
    redirect: "manual",
  });
  const body = await readJson(response);
  const ok = [401, 403].includes(response.status);
  return {
    route: item.path,
    method: item.method,
    status: response.status,
    result: ok ? "pass" : "fail",
    body: ok ? undefined : body,
  };
}

async function getHealth(baseUrl, env) {
  const headers = {};
  if (env.CRON_SECRET) headers["x-cron-secret"] = env.CRON_SECRET;
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/health`, { headers });
  const body = await readJson(response);
  return {
    status: response.status,
    result: response.status === 200 ? "pass" : "fail",
    body,
  };
}

async function getDailyOutreachPreview(baseUrl, env) {
  if (!env.CRON_SECRET) return { skipped: true, reason: "CRON_SECRET unavailable." };
  const response = await fetchWithTimeout(`${baseUrl}/api/admin/daily-outreach/send-due?dryRun=1&limit=10`, {
    headers: { "x-cron-secret": env.CRON_SECRET },
  });
  const body = await readJson(response);
  return {
    status: response.status,
    result: response.status === 200 && body?.ok !== false ? "pass" : "fail",
    body,
  };
}

function createSupabase(env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function countTable(supabase, table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, status: "error", error: error.message };
  return { table, status: "ok", count: count ?? 0 };
}

async function queryRows(supabase, table, select, limit = 10) {
  const { data, error } = await supabase.from(table).select(select).limit(limit);
  if (error) return { table, status: "error", error: error.message, rows: [] };
  return { table, status: "ok", rows: data ?? [] };
}

async function getDatabaseSnapshot(env) {
  const supabase = createSupabase(env);
  if (!supabase) return { skipped: true, reason: "Supabase service env unavailable." };

  const groups = {};
  for (const group of tableGroups) {
    const checks = [];
    for (const table of group.tables) {
      checks.push(await countTable(supabase, table));
    }
    groups[group.key] = {
      title: group.title,
      tables: checks,
      missing: checks.filter((check) => check.status === "error"),
      empty: checks.filter((check) => check.status === "ok" && check.count === 0).map((check) => check.table),
      populated: checks.filter((check) => check.status === "ok" && check.count > 0).map((check) => ({
        table: check.table,
        count: check.count,
      })),
    };
  }

  const [
    systemControls,
    approvalQueue,
    dailyOutreach,
    executionQueue,
    aiTasks,
    govSync,
    metaConnections,
  ] = await Promise.all([
    queryRows(supabase, "system_controls", "*", 1),
    queryRows(supabase, "revenue_message_approval_queue", "id,status,business_line,channel,created_at", 25),
    queryRows(supabase, "daily_outreach_tasks", "id,outreach_date,send_status,approval_status,campaign_type,sender_key,created_at", 25),
    queryRows(supabase, "agent_execution_queue", "id,task_id,permission_scope,status,human_approval_required,approved_by,approved_at,created_at", 25),
    queryRows(supabase, "ai_workforce_tasks", "id,task_id,status,assigned_agent,approval_required,created_at", 25),
    queryRows(supabase, "gov_contract_sync_runs", "id,source_system,status,synced_count,failed_count,created_at", 10),
    queryRows(supabase, "social_meta_connections", "id,provider,status,created_at,updated_at", 10),
  ]);

  return {
    skipped: false,
    groups,
    samples: {
      systemControls,
      approvalQueue,
      dailyOutreach,
      executionQueue,
      aiTasks,
      govSync,
      metaConnections,
    },
  };
}

function summarizeFindings(report) {
  const findings = [];
  const publicFailures = report.routes.public.filter((item) => item.result !== "pass");
  const protectedFailures = report.routes.protected.filter((item) => item.result !== "pass");
  const apiFailures = report.routes.apiGuards.filter((item) => item.result !== "pass");

  if (report.health?.body?.status) {
    const status = report.health.body.status;
    findings.push({
      severity: status === "RED" ? "critical" : status === "YELLOW" ? "medium" : "info",
      area: "runtime_health",
      message: `Runtime health is ${status}.`,
      detail: report.health.body.summary ?? null,
    });
  }

  if (publicFailures.length > 0) {
    findings.push({
      severity: "high",
      area: "public_routes",
      message: `${publicFailures.length} public route checks failed.`,
      detail: publicFailures,
    });
  }

  if (protectedFailures.length > 0 || apiFailures.length > 0) {
    findings.push({
      severity: "critical",
      area: "auth_guards",
      message: `${protectedFailures.length + apiFailures.length} protected route/API guard checks failed.`,
      detail: { protectedFailures, apiFailures },
    });
  }

  const healthWarnings = report.health?.body?.checks?.filter((check) => check.status === "warn") ?? [];
  for (const warning of healthWarnings) {
    findings.push({
      severity: "medium",
      area: "integration_readiness",
      message: warning.message,
      detail: warning.name,
    });
  }

  const dbGroups = report.database?.groups ?? {};
  for (const [key, group] of Object.entries(dbGroups)) {
    if (group.missing?.length) {
      findings.push({
        severity: "critical",
        area: key,
        message: `${group.title} has missing or unreadable tables.`,
        detail: group.missing,
      });
    }
    if (group.empty?.length) {
      findings.push({
        severity: "low",
        area: key,
        message: `${group.title} is structurally ready but has empty data tables.`,
        detail: group.empty,
      });
    }
  }

  const controls = report.database?.samples?.systemControls?.rows?.[0] ?? null;
  if (controls) {
    if (controls.all_paused) {
      findings.push({
        severity: "high",
        area: "system_controls",
        message: "Global pause is enabled.",
        detail: "Automation and outbound actions are intentionally blocked.",
      });
    }
    if (controls.manual_approval_mode !== false) {
      findings.push({
        severity: "info",
        area: "system_controls",
        message: "Manual approval mode is enabled.",
        detail: "This is safe for current rollout and should remain on until live outbound has enough evidence.",
      });
    }
    if (controls.twilio_a2p_approved === false) {
      findings.push({
        severity: "medium",
        area: "sms",
        message: "Twilio A2P is not marked approved in system controls.",
        detail: "Keep SMS prospecting/live sending disabled until Twilio approval is complete.",
      });
    }
  }

  const dailyPreview = report.dailyOutreachPreview?.body;
  if (dailyPreview?.approvalMismatches > 0) {
    findings.push({
      severity: "medium",
      area: "daily_outreach",
      message: `${dailyPreview.approvalMismatches} daily outreach approval mismatch(es) found in preview.`,
      detail: "Mismatched rows are blocked from send; reconcile approval queue state before live send.",
    });
  }

  return findings;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# HomeReach Full System Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base URL: ${report.baseUrl}`);
  lines.push(`Overall result: ${report.overall}`);
  lines.push("");
  lines.push("## Runtime Health");
  lines.push(`- Status: ${report.health?.body?.status ?? report.health?.status ?? "unknown"}`);
  if (report.health?.body?.summary) {
    lines.push(`- Checks: ${report.health.body.summary.passed}/${report.health.body.summary.total} passed, ${report.health.body.summary.failed} failed, ${report.health.body.summary.warned} warned`);
  }
  lines.push("");
  lines.push("## Route Guards");
  lines.push(`- Public routes checked: ${report.routes.public.length}`);
  lines.push(`- Protected routes checked: ${report.routes.protected.length}`);
  lines.push(`- API guard checks: ${report.routes.apiGuards.length}`);
  lines.push(`- Failures: ${[
    ...report.routes.public,
    ...report.routes.protected,
    ...report.routes.apiGuards,
  ].filter((route) => route.result !== "pass").length}`);
  lines.push("");
  lines.push("## Database Snapshot");
  if (report.database?.skipped) {
    lines.push(`- Skipped: ${report.database.reason}`);
  } else {
    for (const group of Object.values(report.database.groups)) {
      const total = group.tables.length;
      const missing = group.missing.length;
      const empty = group.empty.length;
      const populated = group.populated.length;
      lines.push(`- ${group.title}: ${populated}/${total} populated, ${empty} empty, ${missing} missing/error`);
    }
  }
  lines.push("");
  lines.push("## Daily Outreach Dry Run");
  if (report.dailyOutreachPreview?.skipped) {
    lines.push(`- Skipped: ${report.dailyOutreachPreview.reason}`);
  } else {
    const body = report.dailyOutreachPreview?.body ?? {};
    lines.push(`- Mode: ${body.mode ?? "unknown"}`);
    lines.push(`- Queued for review: ${body.queuedForReview ?? 0}`);
    lines.push(`- Approved for send: ${body.approvedForSend ?? 0}`);
    lines.push(`- Approval mismatches: ${body.approvalMismatches ?? 0}`);
    lines.push(`- Failed to queue: ${body.failedToQueue ?? 0}`);
  }
  lines.push("");
  lines.push("## Findings");
  if (report.findings.length === 0) {
    lines.push("- No audit findings.");
  } else {
    for (const finding of report.findings) {
      lines.push(`- [${finding.severity}] ${finding.area}: ${finding.message}`);
    }
  }
  lines.push("");
  lines.push("## Required Human Actions");
  for (const item of report.humanActions) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function humanActionsFrom(report) {
  const actions = [];
  const healthWarnings = report.health?.body?.checks?.filter((check) => check.status === "warn") ?? [];
  for (const warning of healthWarnings) {
    actions.push(warning.message);
  }
  const controls = report.database?.samples?.systemControls?.rows?.[0] ?? null;
  if (controls?.twilio_a2p_approved === false) {
    actions.push("Finish Twilio A2P approval, then update system_controls.twilio_a2p_approved when approved.");
  }
  if (report.dailyOutreachPreview?.body?.approvalMismatches > 0) {
    actions.push("Review Daily Outreach approval mismatches before enabling any live send run.");
  }
  if (report.database?.groups?.business_memory?.empty?.length) {
    actions.push("Onboard at least one real business/customer memory profile so Business Memory can start producing recommendations.");
  }
  if (report.database?.groups?.growth_intelligence?.empty?.length) {
    actions.push("Add or ingest first Growth Intelligence source/opportunity so the Learning/Growth agents have live inputs.");
  }
  return [...new Set(actions)];
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function agentForFinding(finding) {
  const map = {
    runtime_health: "QA / System Health Agent",
    integration_readiness: "Operations Monitoring Agent",
    agent_execution: "QA / System Health Agent",
    outreach_revenue: "Follow-Up Agent",
    political: "Political Campaign Agent",
    procurement: "Procurement / Supplyfy Agent",
    gov_contracts: "SAM.gov Contract Agent",
    local_growth: "Local SEO Authority Agent",
    content_growth: "Content Strategy Agent",
    system_controls: "Orchestrator Agent",
    sms: "Outreach Agent",
    daily_outreach: "Follow-Up Agent",
  };
  return map[finding.area] ?? "Orchestrator Agent";
}

function priorityForFinding(finding) {
  if (finding.severity === "critical") return "critical";
  if (finding.severity === "high") return "high";
  if (finding.severity === "medium") return "high";
  return "medium";
}

function expectedOutputForFinding(finding) {
  if (finding.area === "integration_readiness") {
    return "Confirm missing integration credential path, list exact env vars needed, verify dashboard fallback state, and keep connected publishing/manual mode approval-gated until credentials are present.";
  }
  if (finding.area === "procurement") {
    return "Create a review-ready Supplyfy ingestion/onboarding plan that populates savings recommendations, vendor scorecards, invoice audits, and inventory forecasts without placing orders.";
  }
  if (finding.area === "gov_contracts") {
    return "Create a review-ready Gov Contracts activation plan that ingests opportunities, keeps bid submissions manual, and identifies home-services opportunity focus areas.";
  }
  if (finding.area === "local_growth") {
    return "Create a review-ready onboarding and ingestion plan for Local Visibility, AI Web Assistant, and Group Intelligence data without auto-posting or sending messages.";
  }
  if (finding.area === "content_growth") {
    return "Create a review-ready content and growth intelligence activation plan that starts learning from approved assets and keeps publication human-approved.";
  }
  if (finding.area === "sms") {
    return "Track Twilio A2P approval state, keep live SMS prospecting disabled until approved, and prepare a safe post-approval verification checklist.";
  }
  return "Create a review-ready remediation or activation plan with dependencies, approval gate, and next safe action.";
}

async function deployReviewReadyAgentTasks(report, env) {
  const supabase = createSupabase(env);
  if (!supabase) return { skipped: true, reason: "Supabase service env unavailable." };

  const created = [];
  const skipped = [];
  const runKey = report.generatedAt.slice(0, 10).replace(/-/g, "");
  const deployableFindings = report.findings.filter((finding) =>
    ["critical", "high", "medium", "low"].includes(finding.severity),
  );

  for (const finding of deployableFindings) {
    const taskId = `AUDIT-${runKey}-${slug(finding.area)}-${slug(finding.message)}`;
    const { data: existing, error: existingError } = await supabase
      .from("ai_workforce_tasks")
      .select("id,task_id,status")
      .eq("task_id", taskId)
      .maybeSingle();

    if (existingError) {
      skipped.push({ taskId, reason: existingError.message });
      continue;
    }

    if (existing) {
      skipped.push({ taskId, reason: `already_exists:${existing.status}` });
      continue;
    }

    const insertPayload = {
      task_id: taskId,
      workflow_name: "Full System Audit Remediation",
      requestor: "HomeReach System Audit Agent",
      assigned_agent: agentForFinding(finding),
      priority: priorityForFinding(finding),
      status: "assigned",
      input_path: "ai-workforce/reports",
      input_data: {
        audit_report: report.reports ?? null,
        finding,
        approval_gate: "Human approval required before outbound, publishing, bidding, pricing, payment, procurement, or political action.",
      },
      expected_output: expectedOutputForFinding(finding),
      dependencies: [
        "AGENTS.md approval rules",
        "AI Assets business context",
        "Human approval gate",
        "Existing dashboards and ledgers",
      ],
      approval_required: true,
      related_opportunity: finding.area,
      completion_notes: "Created by full-system audit runner. This task is internal and review-ready only.",
    };

    const { data: inserted, error: insertError } = await supabase
      .from("ai_workforce_tasks")
      .insert(insertPayload)
      .select("id,task_id,assigned_agent,status")
      .single();

    if (insertError || !inserted) {
      skipped.push({ taskId, reason: insertError?.message ?? "insert_failed" });
      continue;
    }

    await supabase.from("ai_workforce_activity_logs").insert({
      task_id: inserted.id,
      task_public_id: inserted.task_id,
      agent_name: "Orchestrator Agent",
      event_type: "audit_task_created",
      status: "assigned",
      summary: `Assigned ${inserted.assigned_agent} from full-system audit finding: ${finding.message}`,
      details: {
        finding,
        human_approval_required: true,
        no_external_action_taken: true,
      },
      approval_status: "needs_review",
    });

    created.push(inserted);
  }

  return { skipped: false, created, skippedExistingOrFailed: skipped };
}

const env = loadEnv();
const baseUrl = normalizeBaseUrl(env.FULL_SYSTEM_AUDIT_BASE_URL ?? env.SMOKE_BASE_URL ?? env.LIVE_FUNNEL_BASE_URL);

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routes: {
    public: [],
    protected: [],
    apiGuards: [],
  },
  health: null,
  dailyOutreachPreview: null,
  database: null,
  findings: [],
  humanActions: [],
  overall: "UNKNOWN",
};

for (const route of publicRoutes) report.routes.public.push(await checkRoute(baseUrl, route, "public"));
for (const route of protectedRoutes) report.routes.protected.push(await checkRoute(baseUrl, route, "protected"));
for (const item of apiGuards) report.routes.apiGuards.push(await checkApiGuard(baseUrl, item));

report.health = await getHealth(baseUrl, env);
report.dailyOutreachPreview = await getDailyOutreachPreview(baseUrl, env);
report.database = await getDatabaseSnapshot(env);
report.findings = summarizeFindings(report);
report.humanActions = humanActionsFrom(report);

const critical = report.findings.filter((finding) => finding.severity === "critical");
const high = report.findings.filter((finding) => finding.severity === "high");
report.overall = critical.length > 0 ? "RED" : high.length > 0 ? "YELLOW" : report.health?.body?.status ?? "GREEN";
report.agentTaskDeployment = createAgentTasks ? await deployReviewReadyAgentTasks(report, env) : { skipped: true, reason: "Run with --create-agent-tasks to create review-ready AI Workforce tasks." };

fs.mkdirSync(REPORT_DIR, { recursive: true });
const stamp = nowStamp();
const jsonPath = path.join(REPORT_DIR, `full-system-audit-${stamp}.json`);
const markdownPath = path.join(REPORT_DIR, `full-system-audit-${stamp}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(report));

console.log(
  JSON.stringify(
    {
      ok: true,
      overall: report.overall,
      baseUrl,
      findings: report.findings.length,
      critical: critical.length,
      high: high.length,
      humanActions: report.humanActions,
      reports: {
        json: jsonPath,
        markdown: markdownPath,
      },
      agentTaskDeployment: report.agentTaskDeployment,
    },
    null,
    2,
  ),
);
