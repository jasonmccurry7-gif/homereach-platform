import { loadAiAssetsCommandCenter } from "@/lib/ai-assets/repository";
import type { AiAgentProfile } from "@/lib/ai-assets/types";
import { createServiceClient } from "@/lib/supabase/service";
import { seedWorkforceLogs, seedWorkforceTasks } from "./seed";
import type {
  AiWorkforceCommandCenterData,
  LegacyAgentDailyStat,
  LegacyAgentRegistry,
  LegacyAgentRunLog,
  WorkforceActivityLog,
  WorkforceSummary,
  WorkforceTask,
  WorkforceTaskPriority,
  WorkforceTaskStatus,
} from "./types";

type GenericRow = Record<string, unknown>;

const MIGRATION_HINT =
  "Apply supabase/migrations/20260522035231_ai_workforce_operating_system.sql to persist AI workforce tasks and activity logs.";

const CORE_AGENT_MISSIONS: Record<string, string> = {
  "Orchestrator Agent": "Coordinates AI work, dependencies, approvals, logging, verification, and final reports.",
  "Prospecting Agent": "Finds and prioritizes local business, campaign, procurement, and GovCon opportunities for human-reviewed outreach.",
  "Research Agent": "Researches businesses, markets, competitors, candidates, campaigns, public context, SAM.gov opportunities, and geography.",
  "Outreach Agent": "Creates email, SMS, Facebook DM, and Facebook group post drafts without sending.",
  "Follow-Up Agent": "Monitors stale opportunities, drafts safe follow-ups, and recommends cadence without sending messages.",
  "Content Strategy Agent": "Builds messaging plans, content calendars, follow-up sequences, offer positioning, and campaign strategy.",
  "Creative Copy Agent": "Writes website copy, email, SMS, DMs, postcard copy, proposals, landing pages, and ad copy.",
  "Creative/Reels Agent": "Prepares short-form creative briefs, reels concepts, captions, and production handoffs without publishing.",
  "Data / Revenue Agent": "Analyzes leads, quotes, payments, conversion rates, savings, campaign performance, margins, and revenue opportunities.",
  "Daily Action Plan Agent": "Turns current priorities into a simple owner action list with draft outputs, follow-ups, and revenue estimates.",
  "Political Campaign Agent": "Creates neutral political mail plans, geography strategies, postcard concepts, proposals, and timelines.",
  "Procurement Agent": "Analyzes supplier spend, reorder needs, pricing differences, savings opportunities, and procurement recommendations.",
  "Procurement/Supplyfy Agent": "Builds Supplyfy savings reviews, reorder recommendations, supplier comparison notes, and approval-cart handoffs.",
  "SAM.gov Contract Agent": "Reviews opportunities, fit, requirements, subcontractor needs, bid/no-bid summaries, and proposal packages.",
  "Design Brief Agent": "Creates design briefs for postcards, dashboards, websites, Canva/Figma handoffs, and campaign visuals.",
  "QA / System Health Agent": "Tests routes, buttons, forms, payments, intake, mobile responsiveness, auth, automations, and error states.",
  "Revenue Integrity Agent": "Finds stuck leads, unpaid quotes, failed intake, inactive campaigns, payment issues, and abandoned opportunities.",
  "Technical SEO Agent": "Audits crawlability, indexability, metadata, schema, performance, internal links, and route-level SEO risks for HomeReach-owned pages.",
  "Local SEO Authority Agent": "Builds legitimate HomeReach local authority plans without doorway pages, fake proximity claims, fake reviews, or local spam.",
  "Content / Topic Cluster Agent": "Plans useful HomeReach topic clusters, pillar pages, supporting articles, internal links, and refresh opportunities.",
  "Conversion SEO Agent": "Improves organic landing pages by aligning search intent, proof, CTA clarity, mobile readability, and revenue paths.",
  "SEO QA Agent": "Reviews SEO audits, briefs, metadata, local copy, and page recommendations before implementation or publication.",
};

export async function loadAiWorkforceCommandCenter(): Promise<AiWorkforceCommandCenterData> {
  const assets = await loadAiAssetsCommandCenter();
  const agentProfiles = ensureCoreAgentProfiles(assets.agentProfiles);
  const auditSummary = [
    "AGENTS.md did not exist before this build and is now the source of truth for workforce behavior.",
    "Existing /admin/agents is reused as the AI Workforce Command Center route instead of adding a duplicate dashboard.",
    "Existing AI Assets tables are reused for business context, SOPs, data sources, agent profiles, prompt chains, outputs, verification, and reviews.",
    "Existing agent_registry, agent_daily_stats, and agent_run_log remain the execution telemetry layer.",
    "New ai_workforce_tasks and ai_workforce_activity_logs provide the missing task manifest and activity ledger.",
    "Mini-app style approval workflows can be represented as ai_workforce_tasks plus ai_outputs before introducing a separate execution runtime.",
  ];
  const reusedSystems = [
    "/admin/agents route and AdminNav item",
    "/admin/ai-assets and ai_* asset tables",
    "Supabase app_metadata role guards and service-role server pattern",
    "agent_registry, agent_daily_stats, agent_run_log",
    "ai_outputs and ai_output_reviews approval system",
    "Daily outreach, revenue operations, procurement, political, route-density, and Gov Contracts modules as task-specific mini-app destinations",
    "Political, procurement, SAM.gov, revenue, outreach, and QA modules as workflow-specific context",
  ];
  const doNotTouch = [
    "Stripe checkout and webhook flows",
    "Supabase auth and role-gated admin layout",
    "Existing intake, postcard, targeted, political, procurement, SAM.gov, and revenue messaging flows",
    "Existing AI Assets records and approval history",
  ];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const tasks = seedWorkforceTasks;
    const logs = seedWorkforceLogs;
    return {
      schemaReady: false,
      migrationHint: MIGRATION_HINT,
      warnings: [
        "Supabase URL or service role key is unavailable.",
        "AI Workforce is showing seed fallback tasks and logs and should not be treated as the live operational ledger.",
      ],
      auditSummary,
      reusedSystems,
      doNotTouch,
      summary: buildSummary(agentProfiles, tasks, assets.outputs, logs, [], []),
      agents: agentProfiles,
      tasks,
      outputs: assets.outputs,
      logs,
      promptChains: assets.promptChains,
      promptSops: assets.promptSops,
      dataSources: assets.dataSources,
      verificationChecks: assets.verificationChecks,
      legacyAgents: [],
      legacyStats: [],
      legacyRunLogs: [],
    };
  }

  const db = createServiceClient();
  const [
    tasksResult,
    logsResult,
    registryResult,
    statsResult,
    runLogsResult,
  ] = await Promise.all([
    safeList(db, "ai_workforce_tasks", "updated_at"),
    safeList(db, "ai_workforce_activity_logs", "created_at"),
    safeList(db, "agent_registry", "layer", true),
    safeList(db, "agent_daily_stats", "stat_date"),
    safeList(db, "agent_run_log", "run_at"),
  ]);

  const errors = [tasksResult, logsResult]
    .flatMap((result) => (result.error ? [result.error.message] : []))
    .filter(Boolean);

  const tasks = errors.length ? seedWorkforceTasks : (tasksResult.data ?? []).map(mapTask);
  const logs = errors.length ? seedWorkforceLogs : (logsResult.data ?? []).map(mapLog);
  const legacyAgents = (registryResult.data ?? []).map(mapLegacyAgent);
  const legacyStats = (statsResult.data ?? []).map(mapLegacyStat);
  const legacyRunLogs = (runLogsResult.data ?? []).map(mapLegacyRunLog);

  return {
    schemaReady: errors.length === 0,
    migrationHint: errors.length ? MIGRATION_HINT : null,
    warnings: Array.from(
      new Set([
        ...assets.warnings,
        ...errors,
        ...(errors.length > 0
          ? [
              "AI Workforce fell back to seed task or activity data after a live load failure. Do not treat this page as the persisted task ledger until the warnings are resolved.",
            ]
          : []),
      ]),
    ),
    auditSummary,
    reusedSystems,
    doNotTouch,
    summary: buildSummary(agentProfiles, tasks, assets.outputs, logs, legacyAgents, legacyRunLogs),
    agents: agentProfiles,
    tasks,
    outputs: assets.outputs,
    logs,
    promptChains: assets.promptChains,
    promptSops: assets.promptSops,
    dataSources: assets.dataSources,
    verificationChecks: assets.verificationChecks,
    legacyAgents,
    legacyStats,
    legacyRunLogs,
  };
}

function ensureCoreAgentProfiles(agentProfiles: AiAgentProfile[]): AiAgentProfile[] {
  const existingNames = new Set(agentProfiles.map((agent) => agent.agentName));
  const additions = Object.entries(CORE_AGENT_MISSIONS)
    .filter(([agentName]) => !existingNames.has(agentName))
    .map(([agentName, mission]) => ({
      id: `virtual-${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      agentName,
      mission,
      allowedActions: ["draft", "summarize", "recommend", "analyze", "prepare approval-gated outputs"],
      disallowedActions: ["send outreach", "publish public content", "change pricing", "charge customers", "submit bids"],
      requiredDataSources: ["AGENTS.md", "AI Assets Business Context", "Prompt SOP Repository", "Data Sources"],
      requiredPromptSops: ["Workflow-specific SOPs and approval checklists"],
      approvalRules: "Human approval required before public, political, legal, financial, customer-facing, or outbound use.",
      complianceRules: "Follow AGENTS.md, AI Assets verification rules, political targeting restrictions, and HomeReach brand rules.",
      escalationRules: "Escalate missing data, blocked dependencies, compliance uncertainty, or high-risk output to the owner.",
      outputFormat: "Summary, full output, sources used, verification checklist, approval status, next action.",
      toneRules: "Simple, premium, human, specific, operational, and approval-aware.",
      successMetrics: ["approved outputs", "blocked risks surfaced", "revenue opportunities advanced", "QA issues closed"],
      status: "active" as const,
      lastReviewedAt: null,
      notes: "Virtual AGENTS.md profile shown when AI Assets has not persisted this agent yet.",
      updatedAt: new Date().toISOString(),
    }));

  return [...agentProfiles, ...additions].sort((a, b) => a.agentName.localeCompare(b.agentName));
}

async function safeList(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  orderColumn: string,
  ascending = false,
): Promise<{ data: GenericRow[] | null; error: { message: string } | null }> {
  const { data, error } = await db.from(table).select("*").order(orderColumn, { ascending }).limit(250);
  return {
    data: (data ?? null) as GenericRow[] | null,
    error: error ? { message: error.message } : null,
  };
}

function buildSummary(
  agents: { status: string; agentName: string }[],
  tasks: WorkforceTask[],
  outputs: { approvalStatus: string; outputType: string; workflow: string | null; agentName: string | null }[],
  logs: WorkforceActivityLog[],
  legacyAgents: LegacyAgentRegistry[],
  legacyRunLogs: LegacyAgentRunLog[],
): WorkforceSummary {
  const today = new Date().toISOString().slice(0, 10);
  const activeAgents = Math.max(agents.filter((agent) => agent.status === "active").length, legacyAgents.filter((agent) => agent.isActive).length);
  const awaitingApproval = tasks.filter((task) => task.status === "awaiting_approval").length + outputs.filter((output) => output.approvalStatus === "needs_review").length;
  return {
    activeAgents,
    tasksInProgress: tasks.filter((task) => task.status === "in_progress" || task.status === "assigned").length,
    completedToday: tasks.filter((task) => task.status === "completed" && task.updatedAt.startsWith(today)).length + logs.filter((log) => log.status === "completed" && log.createdAt.startsWith(today)).length,
    awaitingApproval,
    outreachDraftsReady: outputs.filter((output) => /outreach|email|sms|dm/i.test(`${output.workflow ?? ""} ${output.outputType}`)).length,
    politicalPlansReady: outputs.filter((output) => /political/i.test(`${output.workflow ?? ""} ${output.agentName ?? ""}`)).length + tasks.filter((task) => task.workflowName === "Political Campaign Chain").length,
    procurementAnalysesReady: outputs.filter((output) => /procurement|supplyfy|inventory/i.test(`${output.workflow ?? ""} ${output.agentName ?? ""}`)).length + tasks.filter((task) => /Procurement|Supplyfy/i.test(task.workflowName)).length,
    samReviewsReady: outputs.filter((output) => /sam|government/i.test(`${output.workflow ?? ""} ${output.agentName ?? ""}`)).length + tasks.filter((task) => task.workflowName === "SAM.gov Chain").length,
    qaIssues: tasks.filter((task) => task.assignedAgent.includes("QA") && ["blocked", "failed", "needs_revision"].includes(task.status)).length,
    revenueOpportunities: tasks.filter((task) => /revenue|shared|targeted|procurement|sam/i.test(task.workflowName)).length,
    systemHealthAlerts: legacyRunLogs.filter((log) => ["failed", "partial"].includes(log.status)).length + tasks.filter((task) => ["blocked", "failed"].includes(task.status)).length,
  };
}

function mapTask(row: GenericRow): WorkforceTask {
  return {
    id: String(row.id),
    taskId: String(row.task_id ?? ""),
    workflowName: String(row.workflow_name ?? ""),
    requestor: String(row.requestor ?? "HomeReach Admin"),
    assignedAgent: String(row.assigned_agent ?? "Orchestrator Agent"),
    priority: asPriority(row.priority),
    status: asTaskStatus(row.status),
    inputPath: nullableString(row.input_path),
    inputData: asRecord(row.input_data),
    expectedOutput: String(row.expected_output ?? ""),
    dependencies: asStringArray(row.dependencies),
    dueDate: nullableString(row.due_date),
    approvalRequired: Boolean(row.approval_required ?? true),
    completionNotes: nullableString(row.completion_notes),
    errorNotes: nullableString(row.error_notes),
    relatedCampaign: nullableString(row.related_campaign),
    relatedClient: nullableString(row.related_client),
    relatedOpportunity: nullableString(row.related_opportunity),
    outputId: nullableString(row.output_id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapLog(row: GenericRow): WorkforceActivityLog {
  const approvalStatus = String(row.approval_status ?? "not_required");
  return {
    id: String(row.id),
    taskId: nullableString(row.task_id),
    taskPublicId: nullableString(row.task_public_id),
    agentName: nullableString(row.agent_name),
    eventType: String(row.event_type ?? "activity"),
    status: String(row.status ?? "logged"),
    summary: String(row.summary ?? ""),
    details: asRecord(row.details),
    approvalStatus: approvalStatus === "needs_review" || approvalStatus === "approved" || approvalStatus === "rejected" || approvalStatus === "needs_revision" ? approvalStatus : "not_required",
    relatedOutputId: nullableString(row.related_output_id),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapLegacyAgent(row: GenericRow): LegacyAgentRegistry {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    role: nullableString(row.role),
    layer: nullableString(row.layer),
    isActive: Boolean(row.is_active),
    description: nullableString(row.description),
  };
}

function mapLegacyStat(row: GenericRow): LegacyAgentDailyStat {
  return {
    id: String(row.id),
    agentId: String(row.agent_id ?? ""),
    actionsCompleted: Number(row.actions_completed ?? 0),
    messagesSent: Number(row.messages_sent ?? 0),
    errors: Number(row.errors ?? 0),
    completionPct: Number(row.completion_pct ?? 0),
    statDate: String(row.stat_date ?? ""),
  };
}

function mapLegacyRunLog(row: GenericRow): LegacyAgentRunLog {
  return {
    id: String(row.id),
    agentId: nullableString(row.agent_id),
    agentName: nullableString(row.agent_name),
    status: String(row.status ?? "unknown"),
    actionsTaken: Number(row.actions_taken ?? 0),
    messagesSent: Number(row.messages_sent ?? 0),
    errorMessage: nullableString(row.error_message),
    runAt: String(row.run_at ?? new Date().toISOString()),
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asPriority(value: unknown): WorkforceTaskPriority {
  return value === "low" || value === "high" || value === "critical" ? value : "medium";
}

function asTaskStatus(value: unknown): WorkforceTaskStatus {
  const status = String(value ?? "new");
  if (
    status === "assigned" ||
    status === "in_progress" ||
    status === "blocked" ||
    status === "awaiting_approval" ||
    status === "approved" ||
    status === "rejected" ||
    status === "needs_revision" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "new";
}
