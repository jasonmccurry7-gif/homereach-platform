import { createServiceClient } from "@/lib/supabase/service";

export type WorkforceMemoryStatus = "active" | "superseded" | "resolved" | "archived";
export type WorkforceQueueStatus =
  | "queued"
  | "needs_approval"
  | "approved"
  | "in_progress"
  | "blocked"
  | "done"
  | "rejected"
  | "archived";
export type WorkforceIngestionStatus =
  | "queued"
  | "approved"
  | "ingesting"
  | "needs_review"
  | "blocked"
  | "completed"
  | "rejected"
  | "archived";

export interface WorkforceMemoryItem {
  id: string;
  memoryKey: string;
  dashboard: string;
  memoryType: string;
  title: string;
  summary: string;
  source: string;
  route?: string | null;
  confidence: number;
  impactLevel: "critical" | "high" | "medium" | "low";
  status: WorkforceMemoryStatus;
  updatedAt: string;
}

export interface WorkforceEventLogItem {
  id: string;
  eventType: string;
  dashboard: string;
  agentId?: string | null;
  actorType: "admin" | "agent" | "system" | "cron" | "webhook";
  title: string;
  summary: string;
  route?: string | null;
  severity: "info" | "success" | "warning" | "critical";
  source: string;
  occurredAt: string;
}

export interface WorkforceTaskQueueItem {
  id: string;
  taskKey: string;
  agentId: string;
  dashboard: string;
  title: string;
  recommendedAction: string;
  route?: string | null;
  priority: "critical" | "high" | "medium" | "low";
  status: WorkforceQueueStatus;
  requiresHumanApproval: boolean;
  dueAt?: string | null;
  updatedAt: string;
  approvalRequestId?: string | null;
  approvalStatus?: string | null;
  executorStatus?: string | null;
  executionRunId?: string | null;
  executionStatus?: string | null;
  internalTaskId?: string | null;
  lastExecutionPlan?: WorkforceTaskExecutionPlan["plan"] | null;
  lastExecutionPlanAt?: string | null;
  lastDryRunPreview?: WorkforceTaskDryRunPreview["preview"] | null;
  lastDryRunPreviewAt?: string | null;
}

export interface WorkforceIngestionQueueItem {
  id: string;
  sourceKey: string;
  sourceType: string;
  title: string;
  dashboard: string;
  priority: "critical" | "high" | "medium" | "low";
  status: WorkforceIngestionStatus;
  reviewRequired: boolean;
  assignedAgentId?: string | null;
  nextStep: string;
  updatedAt: string;
}

export interface WorkforceFoundationState {
  generatedAt: string;
  databaseReady: boolean;
  summary: {
    entities: number;
    activeMemory: number;
    criticalMemory: number;
    events24h: number;
    openTasks: number;
    blockedTasks: number;
    ingestionQueued: number;
    ingestionNeedsReview: number;
  };
  memoryItems: WorkforceMemoryItem[];
  recentEvents: WorkforceEventLogItem[];
  tasks: WorkforceTaskQueueItem[];
  ingestionQueue: WorkforceIngestionQueueItem[];
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
  safeNextSteps: string[];
}

export interface RecordWorkforceEventInput {
  eventKey?: string;
  eventType: WorkforceEventLogItem["eventType"];
  agentId?: string | null;
  dashboard: string;
  actorType?: WorkforceEventLogItem["actorType"];
  actorId?: string | null;
  title: string;
  summary: string;
  route?: string | null;
  severity?: WorkforceEventLogItem["severity"];
  source: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpsertWorkforceMemoryInput {
  memoryKey: string;
  agentId?: string | null;
  dashboard: string;
  memoryType: string;
  title: string;
  summary: string;
  source: string;
  sourceId?: string | null;
  route?: string | null;
  confidence?: number;
  impactLevel?: WorkforceMemoryItem["impactLevel"];
  status?: WorkforceMemoryStatus;
  metadata?: Record<string, unknown>;
}

export interface EnqueueWorkforceTaskInput {
  taskKey: string;
  agentId: string;
  dashboard: string;
  title: string;
  description: string;
  recommendedAction: string;
  route?: string | null;
  priority?: WorkforceTaskQueueItem["priority"];
  status?: WorkforceQueueStatus;
  requiresHumanApproval?: boolean;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnqueueWorkforceIngestionInput {
  sourceKey: string;
  sourceType: string;
  sourceUrl?: string | null;
  title: string;
  dashboard?: string;
  priority?: WorkforceIngestionQueueItem["priority"];
  status?: WorkforceIngestionStatus;
  reviewRequired?: boolean;
  assignedAgentId?: string | null;
  nextStep?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkforceTaskStatusInput {
  taskId?: string;
  taskKey?: string;
  status: WorkforceQueueStatus;
  actorId?: string | null;
  resultSummary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkforceIngestionStatusInput {
  ingestionId?: string;
  sourceKey?: string;
  status: WorkforceIngestionStatus;
  actorId?: string | null;
  nextStep?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PlanWorkforceTaskInput {
  taskId?: string;
  taskKey?: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkforceTaskExecutionPlan {
  taskId: string;
  taskKey: string;
  agentId: string;
  dashboard: string;
  title: string;
  route?: string | null;
  status: WorkforceQueueStatus;
  requiresHumanApproval: boolean;
  plan: {
    mode: "plan_only";
    externalWorkflowTouched: false;
    recommendedSteps: string[];
    humanApprovalGates: string[];
    prohibitedActions: string[];
    safeHandoff: string;
  };
}

export interface SendWorkforceTaskToApprovalInput {
  taskId?: string;
  taskKey?: string;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkforceTaskApprovalHandoff {
  taskId: string;
  taskKey: string;
  approvalRequestId: string;
  approvalStatus: string;
  executorStatus: string;
  externalWorkflowTouched: false;
  message: string;
}

export interface DryRunWorkforceTaskInput {
  taskId?: string;
  taskKey?: string;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WorkforceTaskDryRunPreview {
  taskId: string;
  taskKey: string;
  approvalRequestId: string;
  approvalStatus: string;
  executorStatus: string;
  externalWorkflowTouched: false;
  preview: {
    mode: "dry_run";
    externalWorkflowTouched: false;
    wouldDo: string[];
    wouldNotDo: string[];
    requiredBeforeExecution: string[];
    rollbackNote: string;
    nextHumanAction: string;
  };
  message: string;
}

function nowIso() {
  return new Date().toISOString();
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asMetadata(value?: Record<string, unknown>) {
  return value ?? {};
}

function mergeMetadata(value: unknown, extra?: Record<string, unknown>) {
  return {
    ...((value && typeof value === "object" && !Array.isArray(value)) ? value as Record<string, unknown> : {}),
    ...(extra ?? {}),
  };
}

function eventTypeForQueueStatus(status: WorkforceQueueStatus | WorkforceIngestionStatus): RecordWorkforceEventInput["eventType"] {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "blocked") return "blocked";
  if (status === "done" || status === "completed" || status === "archived") return "resolved";
  return "queued";
}

function splitTaskText(value: unknown) {
  return String(value ?? "")
    .split(/\n+|;|\.\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function planForDashboard(dashboard: string) {
  const normalized = dashboard.toLowerCase();

  if (normalized.includes("political")) {
    return {
      recommendedSteps: [
        "Review the campaign, candidate, geography, and compliance context before drafting recommendations.",
        "Prepare strategy, route, creative, or outreach notes for human review only.",
        "Confirm any political messaging stays draft-only or approval-only before release.",
        "Record the final human decision back into AI Workforce memory.",
      ],
      humanApprovalGates: [
        "Political outreach approval",
        "Creative or message approval",
        "Budget or payment approval",
        "Launch approval",
      ],
    };
  }

  if (normalized.includes("procurement") || normalized.includes("inventory")) {
    return {
      recommendedSteps: [
        "Review the business profile, item, vendor, savings, and delivery context.",
        "Prepare a smart-buy, vendor-risk, or savings recommendation with transparent math.",
        "Keep live ordering disabled unless owner approval and supplier integration are confirmed.",
        "Record the owner/admin decision back into AI Workforce memory.",
      ],
      humanApprovalGates: [
        "Owner purchase approval",
        "Supplier commitment approval",
        "Pricing or savings claim review",
        "Payment approval",
      ],
    };
  }

  if (normalized.includes("gov") || normalized.includes("contract") || normalized.includes("sam")) {
    return {
      recommendedSteps: [
        "Review the opportunity, deadline, agency, NAICS/PSC, and fit context.",
        "Prepare a go/no-go, subcontractor, or compliance recommendation for review.",
        "Keep bid submission, certifications, pricing, and subcontractor commitments human-controlled.",
        "Record the final pursuit decision back into AI Workforce memory.",
      ],
      humanApprovalGates: [
        "Go/no-go approval",
        "Pricing approval",
        "Certification/legal review",
        "Final submission approval",
      ],
    };
  }

  if (normalized.includes("learning") || normalized.includes("content")) {
    return {
      recommendedSteps: [
        "Review the source, transcript, webpage, RSS item, or research note before ingestion.",
        "Extract ideas into reviewable recommendations, not production changes.",
        "Send accepted ideas to backlog or implementation planning after human review.",
        "Record feedback and duplicate/conflict findings back into AI Workforce memory.",
      ],
      humanApprovalGates: [
        "Source approval",
        "Recommendation approval",
        "Implementation approval",
        "Publishing approval",
      ],
    };
  }

  if (normalized.includes("outreach") || normalized.includes("sales") || normalized.includes("revenue")) {
    return {
      recommendedSteps: [
        "Review the lead, customer, campaign, consent, and suppression context.",
        "Prepare a draft follow-up, next-best-action, or pipeline recommendation.",
        "Keep outbound sending approval-gated unless the business line is explicitly cleared.",
        "Record the sales/admin decision back into AI Workforce memory.",
      ],
      humanApprovalGates: [
        "Outbound message approval",
        "Pricing approval",
        "Payment link approval",
        "Automation mode approval",
      ],
    };
  }

  return {
    recommendedSteps: [
      "Review the source workflow and the most recent related memory/events.",
      "Prepare a short recommendation, risk note, and next action for human review.",
      "Keep execution paused until an admin approves the specific action.",
      "Record the human outcome back into AI Workforce memory.",
    ],
    humanApprovalGates: [
      "Admin review",
      "External action approval",
      "Customer-impact approval",
      "Completion confirmation",
    ],
  };
}

function parseExecutionPlan(metadata: unknown): {
  lastExecutionPlan: WorkforceTaskQueueItem["lastExecutionPlan"];
  lastExecutionPlanAt: string | null;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { lastExecutionPlan: null, lastExecutionPlanAt: null };
  }

  const record = metadata as Record<string, unknown>;
  const plan = record.lastExecutionPlan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return { lastExecutionPlan: null, lastExecutionPlanAt: null };
  }

  const planRecord = plan as Record<string, unknown>;
  const recommendedSteps = Array.isArray(planRecord.recommendedSteps)
    ? planRecord.recommendedSteps.map(String).filter(Boolean).slice(0, 7)
    : [];
  const humanApprovalGates = Array.isArray(planRecord.humanApprovalGates)
    ? planRecord.humanApprovalGates.map(String).filter(Boolean).slice(0, 6)
    : [];
  const prohibitedActions = Array.isArray(planRecord.prohibitedActions)
    ? planRecord.prohibitedActions.map(String).filter(Boolean).slice(0, 6)
    : [];

  if (recommendedSteps.length === 0 && humanApprovalGates.length === 0) {
    return { lastExecutionPlan: null, lastExecutionPlanAt: null };
  }

  return {
    lastExecutionPlan: {
      mode: "plan_only",
      externalWorkflowTouched: false,
      recommendedSteps,
      humanApprovalGates,
      prohibitedActions,
      safeHandoff: String(planRecord.safeHandoff ?? "Admin review is required before any external execution."),
    },
    lastExecutionPlanAt: typeof record.lastExecutionPlanAt === "string" ? record.lastExecutionPlanAt : null,
  };
}

function parseDryRunPreview(metadata: unknown): {
  lastDryRunPreview: WorkforceTaskQueueItem["lastDryRunPreview"];
  lastDryRunPreviewAt: string | null;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { lastDryRunPreview: null, lastDryRunPreviewAt: null };
  }

  const record = metadata as Record<string, unknown>;
  const preview = record.lastDryRunPreview;
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
    return { lastDryRunPreview: null, lastDryRunPreviewAt: null };
  }

  const previewRecord = preview as Record<string, unknown>;
  const wouldDo = Array.isArray(previewRecord.wouldDo)
    ? previewRecord.wouldDo.map(String).filter(Boolean).slice(0, 8)
    : [];
  const wouldNotDo = Array.isArray(previewRecord.wouldNotDo)
    ? previewRecord.wouldNotDo.map(String).filter(Boolean).slice(0, 8)
    : [];
  const requiredBeforeExecution = Array.isArray(previewRecord.requiredBeforeExecution)
    ? previewRecord.requiredBeforeExecution.map(String).filter(Boolean).slice(0, 8)
    : [];

  if (wouldDo.length === 0 && wouldNotDo.length === 0 && requiredBeforeExecution.length === 0) {
    return { lastDryRunPreview: null, lastDryRunPreviewAt: null };
  }

  return {
    lastDryRunPreview: {
      mode: "dry_run",
      externalWorkflowTouched: false,
      wouldDo,
      wouldNotDo,
      requiredBeforeExecution,
      rollbackNote: String(previewRecord.rollbackNote ?? "No external workflow was touched."),
      nextHumanAction: String(previewRecord.nextHumanAction ?? "Review approval state before any handoff."),
    },
    lastDryRunPreviewAt: typeof record.lastDryRunPreviewAt === "string" ? record.lastDryRunPreviewAt : null,
  };
}

function dryRunForApproval(input: {
  taskTitle: string;
  requestedAction: string;
  dashboard: string;
  approvalStatus: string;
  executorStatus: string;
  guardrailSummary?: string | null;
  cannotExecuteReason?: string | null;
  plan?: WorkforceTaskExecutionPlan["plan"] | null;
}): WorkforceTaskDryRunPreview["preview"] {
  const normalizedDashboard = input.dashboard.toLowerCase();
  const wouldDo = [
    `Read approval request status: ${input.approvalStatus}.`,
    `Read executor status: ${input.executorStatus}.`,
    `Use approved plan context for: ${input.taskTitle}.`,
    `Prepare an internal-only handoff summary for: ${input.requestedAction}.`,
  ];

  if (input.approvalStatus === "approved") {
    wouldDo.push("Eligible next step after separate admin action: queue a safe internal handoff record.");
    if (["handoff_queued", "task_ready", "task_created"].includes(input.executorStatus)) {
      wouldDo.push("Existing safe handoff state would be respected before creating any duplicate internal task.");
    }
  } else {
    wouldDo.push("Stop before handoff because the approval request is not approved.");
  }

  const wouldNotDo = [
    "Would not send SMS, email, DMs, or political outreach.",
    "Would not publish pages, posts, ads, creative, or campaign content.",
    "Would not place supplier orders, submit government bids, approve pricing, or make certification claims.",
    "Would not create checkout/payment links, change Stripe records, or launch campaigns.",
  ];

  const requiredBeforeExecution = [
    "Human approval request must be approved.",
    "Executor status must be safe for internal handoff.",
    "Existing source workflow must remain the system of record.",
    "Admin must explicitly queue handoff or create an internal task from the approval panel.",
  ];

  if (normalizedDashboard.includes("political")) {
    requiredBeforeExecution.push("Political outreach, creative, proposal, and launch actions require separate campaign/legal approval.");
  }
  if (normalizedDashboard.includes("gov") || normalizedDashboard.includes("contract")) {
    requiredBeforeExecution.push("Bid, pricing, certification, subcontractor, and submission actions require explicit human approval.");
  }
  if (normalizedDashboard.includes("procurement") || normalizedDashboard.includes("inventory")) {
    requiredBeforeExecution.push("Purchase/order actions require owner approval and a connected safe supplier workflow.");
  }

  const planGates = input.plan?.humanApprovalGates?.slice(0, 3) ?? [];
  for (const gate of planGates) {
    requiredBeforeExecution.push(`Plan gate: ${gate}`);
  }

  return {
    mode: "dry_run",
    externalWorkflowTouched: false,
    wouldDo: wouldDo.slice(0, 8),
    wouldNotDo,
    requiredBeforeExecution: requiredBeforeExecution.slice(0, 8),
    rollbackNote: "No external workflow is touched by this dry run. Removing the preview only clears internal metadata and audit context.",
    nextHumanAction: input.approvalStatus === "approved"
      ? "Review the approval panel and decide whether to queue a safe internal handoff."
      : "Review and approve or reject the pending approval request before any handoff is possible.",
  };
}

async function readCount(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  apply?: (query: any) => any,
) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getAiWorkforceFoundationState(limit = 12): Promise<WorkforceFoundationState> {
  const sourceHealth: WorkforceFoundationState["sourceHealth"] = [];

  if (!hasSupabaseEnv()) {
    return {
      generatedAt: nowIso(),
      databaseReady: false,
      summary: {
        entities: 0,
        activeMemory: 0,
        criticalMemory: 0,
        events24h: 0,
        openTasks: 0,
        blockedTasks: 0,
        ingestionQueued: 0,
        ingestionNeedsReview: 0,
      },
      memoryItems: [],
      recentEvents: [],
      tasks: [],
      ingestionQueue: [],
      sourceHealth: [{
        source: "supabase",
        status: "unavailable",
        note: "Supabase env is missing, so Phase 2 persistent memory cannot be loaded.",
      }],
      safeNextSteps: ["Configure Supabase env and apply migration 103 before enabling persistent AI Workforce memory."],
    };
  }

  const supabase = createServiceClient();

  async function readSource<T>(source: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const result = await fn();
      sourceHealth.push({ source, status: "ok" });
      return result;
    } catch (error) {
      sourceHealth.push({ source, status: "unavailable", note: error instanceof Error ? error.message : String(error) });
      return fallback;
    }
  }

  const [
    entityCount,
    activeMemoryCount,
    criticalMemoryCount,
    events24hCount,
    openTaskCount,
    blockedTaskCount,
    ingestionQueuedCount,
    ingestionNeedsReviewCount,
    memoryRows,
    eventRows,
    taskRows,
    ingestionRows,
  ] = await Promise.all([
    readSource("ai_workforce_entities_count", () => readCount(supabase, "ai_workforce_entities"), 0),
    readSource("ai_workforce_memory_active_count", () => readCount(
      supabase,
      "ai_workforce_memory_items",
      (query) => query.eq("status", "active"),
    ), 0),
    readSource("ai_workforce_memory_critical_count", () => readCount(
      supabase,
      "ai_workforce_memory_items",
      (query) => query.eq("status", "active").eq("impact_level", "critical"),
    ), 0),
    readSource("ai_workforce_event_log_24h_count", () => readCount(
      supabase,
      "ai_workforce_event_log",
      (query) => query.gte("occurred_at", sinceHours(24)),
    ), 0),
    readSource("ai_workforce_task_queue_open_count", () => readCount(
      supabase,
      "ai_workforce_task_queue",
      (query) => query.in("status", ["queued", "needs_approval", "approved", "in_progress", "blocked"]),
    ), 0),
    readSource("ai_workforce_task_queue_blocked_count", () => readCount(
      supabase,
      "ai_workforce_task_queue",
      (query) => query.eq("status", "blocked"),
    ), 0),
    readSource("ai_workforce_ingestion_queue_queued_count", () => readCount(
      supabase,
      "ai_workforce_ingestion_queue",
      (query) => query.in("status", ["queued", "approved", "ingesting", "needs_review", "blocked"]),
    ), 0),
    readSource("ai_workforce_ingestion_queue_review_count", () => readCount(
      supabase,
      "ai_workforce_ingestion_queue",
      (query) => query.eq("status", "needs_review"),
    ), 0),
    readSource("ai_workforce_memory_items", async () => {
      const { data, error } = await supabase
        .from("ai_workforce_memory_items")
        .select("id,memory_key,dashboard,memory_type,title,summary,source,route,confidence,impact_level,status,updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource("ai_workforce_event_log", async () => {
      const { data, error } = await supabase
        .from("ai_workforce_event_log")
        .select("id,event_type,dashboard,agent_id,actor_type,title,summary,route,severity,source,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource("ai_workforce_task_queue", async () => {
      const { data, error } = await supabase
        .from("ai_workforce_task_queue")
        .select("id,task_key,agent_id,dashboard,title,recommended_action,route,priority,status,requires_human_approval,due_at,updated_at,approval_request_id,metadata")
        .in("status", ["queued", "needs_approval", "approved", "in_progress", "blocked"])
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource("ai_workforce_ingestion_queue", async () => {
      const { data, error } = await supabase
        .from("ai_workforce_ingestion_queue")
        .select("id,source_key,source_type,title,dashboard,priority,status,review_required,assigned_agent_id,next_step,updated_at")
        .in("status", ["queued", "approved", "ingesting", "needs_review", "blocked"])
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
  ]);

  const approvalIds = Array.from(
    new Set(
      taskRows
        .map((row) => row.approval_request_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  let approvalById = new Map<string, Record<string, any>>();
  let executionRunByRequestId = new Map<string, Record<string, any>>();

  if (approvalIds.length > 0) {
    const approvalRows = await readSource("ai_workforce_task_approval_requests", async () => {
      const { data, error } = await supabase
        .from("ai_autopilot_approval_requests")
        .select("id,approval_status,executor_status")
        .in("id", approvalIds);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>);
    approvalById = new Map(approvalRows.map((row) => [String(row.id), row]));

    const executionRows = await readSource("ai_workforce_task_execution_runs", async () => {
      const { data, error } = await supabase
        .from("ai_autopilot_execution_runs")
        .select("id,request_id,execution_status,internal_task_id,created_at")
        .in("request_id", approvalIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>);
    executionRunByRequestId = new Map();
    for (const row of executionRows) {
      const requestId = String(row.request_id);
      if (!executionRunByRequestId.has(requestId)) {
        executionRunByRequestId.set(requestId, row);
      }
    }
  }

  const memoryItems: WorkforceMemoryItem[] = memoryRows.map((row) => ({
    id: String(row.id),
    memoryKey: String(row.memory_key),
    dashboard: String(row.dashboard),
    memoryType: String(row.memory_type),
    title: String(row.title),
    summary: String(row.summary),
    source: String(row.source),
    route: row.route ?? null,
    confidence: toNumber(row.confidence, 0.75),
    impactLevel: row.impact_level ?? "medium",
    status: row.status ?? "active",
    updatedAt: row.updated_at,
  }));

  const recentEvents: WorkforceEventLogItem[] = eventRows.map((row) => ({
    id: String(row.id),
    eventType: String(row.event_type),
    dashboard: String(row.dashboard),
    agentId: row.agent_id ?? null,
    actorType: row.actor_type ?? "system",
    title: String(row.title),
    summary: String(row.summary),
    route: row.route ?? null,
    severity: row.severity ?? "info",
    source: String(row.source),
    occurredAt: row.occurred_at,
  }));

  const tasks: WorkforceTaskQueueItem[] = taskRows.map((row) => {
    const plan = parseExecutionPlan(row.metadata);
    const dryRun = parseDryRunPreview(row.metadata);
    const approvalRequestId = row.approval_request_id ?? null;
    const approval = approvalRequestId ? approvalById.get(String(approvalRequestId)) : null;
    const executionRun = approvalRequestId ? executionRunByRequestId.get(String(approvalRequestId)) : null;
    return {
      id: String(row.id),
      taskKey: String(row.task_key),
      agentId: String(row.agent_id),
      dashboard: String(row.dashboard),
      title: String(row.title),
      recommendedAction: String(row.recommended_action),
      route: row.route ?? null,
      priority: row.priority ?? "medium",
      status: row.status ?? "queued",
      requiresHumanApproval: Boolean(row.requires_human_approval),
      dueAt: row.due_at ?? null,
      updatedAt: row.updated_at,
      approvalRequestId,
      approvalStatus: approval?.approval_status ?? null,
      executorStatus: approval?.executor_status ?? null,
      executionRunId: executionRun?.id ?? null,
      executionStatus: executionRun?.execution_status ?? null,
      internalTaskId: executionRun?.internal_task_id ?? null,
      lastExecutionPlan: plan.lastExecutionPlan,
      lastExecutionPlanAt: plan.lastExecutionPlanAt,
      lastDryRunPreview: dryRun.lastDryRunPreview,
      lastDryRunPreviewAt: dryRun.lastDryRunPreviewAt,
    };
  });

  const ingestionQueue: WorkforceIngestionQueueItem[] = ingestionRows.map((row) => ({
    id: String(row.id),
    sourceKey: String(row.source_key),
    sourceType: String(row.source_type),
    title: String(row.title),
    dashboard: String(row.dashboard),
    priority: row.priority ?? "medium",
    status: row.status ?? "queued",
    reviewRequired: Boolean(row.review_required),
    assignedAgentId: row.assigned_agent_id ?? null,
    nextStep: String(row.next_step),
    updatedAt: row.updated_at,
  }));

  const databaseReady = sourceHealth.every((source) => source.status === "ok");
  const safeNextSteps = [
    databaseReady
      ? "Start writing approved AI observations into memory through service-role only workflows."
      : "Apply migration 103 before relying on persistent AI Workforce memory.",
    "Use Plan Only before execution so admins can review steps, gates, and prohibited actions.",
    "Send reviewed plans into the existing approval queue before creating any internal follow-up task.",
    "Use Dry Run Preview to inspect what would happen after approval before queuing a safe internal handoff.",
    "Queue Safe Handoff only after approval; it creates an internal handoff record and still does not touch external workflows.",
    "Use ingestion queue statuses for review and approval before any source analysis becomes autonomous.",
  ];

  return {
    generatedAt: nowIso(),
    databaseReady,
    summary: {
      entities: entityCount,
      activeMemory: activeMemoryCount,
      criticalMemory: criticalMemoryCount,
      events24h: events24hCount,
      openTasks: openTaskCount,
      blockedTasks: blockedTaskCount,
      ingestionQueued: ingestionQueuedCount,
      ingestionNeedsReview: ingestionNeedsReviewCount,
    },
    memoryItems,
    recentEvents,
    tasks,
    ingestionQueue,
    sourceHealth,
    safeNextSteps,
  };
}

export async function recordAiWorkforceEvent(input: RecordWorkforceEventInput) {
  const supabase = createServiceClient();
  const payload = {
    event_key: input.eventKey ?? null,
    event_type: input.eventType,
    agent_id: input.agentId ?? null,
    dashboard: input.dashboard,
    actor_type: input.actorType ?? "system",
    actor_id: input.actorId ?? null,
    title: input.title,
    summary: input.summary,
    route: input.route ?? null,
    severity: input.severity ?? "info",
    source: input.source,
    source_id: input.sourceId ?? null,
    metadata: asMetadata(input.metadata),
  };

  const { data, error } = input.eventKey
    ? await supabase
      .from("ai_workforce_event_log")
      .upsert(payload, { onConflict: "event_key" })
      .select("id")
      .single()
    : await supabase
      .from("ai_workforce_event_log")
      .insert(payload)
      .select("id")
      .single();

  if (error) throw error;
  return data;
}

export async function upsertAiWorkforceMemoryItem(input: UpsertWorkforceMemoryInput) {
  const supabase = createServiceClient();
  const payload = {
    memory_key: input.memoryKey,
    agent_id: input.agentId ?? null,
    dashboard: input.dashboard,
    memory_type: input.memoryType,
    title: input.title,
    summary: input.summary,
    source: input.source,
    source_id: input.sourceId ?? null,
    route: input.route ?? null,
    confidence: input.confidence ?? 0.75,
    impact_level: input.impactLevel ?? "medium",
    status: input.status ?? "active",
    last_seen_at: nowIso(),
    metadata: asMetadata(input.metadata),
  };

  const { data, error } = await supabase
    .from("ai_workforce_memory_items")
    .upsert(payload, { onConflict: "memory_key" })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function enqueueAiWorkforceTask(input: EnqueueWorkforceTaskInput) {
  const supabase = createServiceClient();
  const payload = {
    task_key: input.taskKey,
    agent_id: input.agentId,
    dashboard: input.dashboard,
    title: input.title,
    description: input.description,
    recommended_action: input.recommendedAction,
    route: input.route ?? null,
    priority: input.priority ?? "medium",
    status: input.status ?? "queued",
    requires_human_approval: input.requiresHumanApproval ?? true,
    due_at: input.dueAt ?? null,
    metadata: asMetadata(input.metadata),
  };

  const { data, error } = await supabase
    .from("ai_workforce_task_queue")
    .upsert(payload, { onConflict: "task_key" })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function enqueueAiWorkforceIngestionSource(input: EnqueueWorkforceIngestionInput) {
  const supabase = createServiceClient();
  const payload = {
    source_key: input.sourceKey,
    source_type: input.sourceType,
    source_url: input.sourceUrl ?? null,
    title: input.title,
    dashboard: input.dashboard ?? "Learning Engine",
    priority: input.priority ?? "medium",
    status: input.status ?? "queued",
    review_required: input.reviewRequired ?? true,
    assigned_agent_id: input.assignedAgentId ?? null,
    next_step: input.nextStep ?? "Review source and approve ingestion before analysis.",
    metadata: asMetadata(input.metadata),
  };

  const { data, error } = await supabase
    .from("ai_workforce_ingestion_queue")
    .upsert(payload, { onConflict: "source_key" })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function updateAiWorkforceTaskStatus(input: UpdateWorkforceTaskStatusInput) {
  if (!input.taskId && !input.taskKey) {
    throw new Error("taskId or taskKey is required.");
  }

  const supabase = createServiceClient();
  const now = nowIso();
  const update: Record<string, unknown> = {
    updated_at: now,
    status: input.status,
  };

  if (input.resultSummary !== undefined) update.result_summary = input.resultSummary;
  if (input.status === "done") {
    update.completed_at = now;
    update.completed_by = input.actorId ?? null;
  } else {
    update.completed_at = null;
    update.completed_by = null;
  }

  let query = supabase
    .from("ai_workforce_task_queue")
    .update(update)
    .select("id,task_key,agent_id,dashboard,title,route,status")
    .limit(1);

  query = input.taskId ? query.eq("id", input.taskId) : query.eq("task_key", input.taskKey);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("AI Workforce task was not found.");

  await recordAiWorkforceEvent({
    eventType: eventTypeForQueueStatus(input.status),
    agentId: data.agent_id ?? null,
    dashboard: data.dashboard,
    actorType: "admin",
    actorId: input.actorId ?? null,
    title: `Task ${input.status}: ${data.title}`,
    summary: input.resultSummary ?? `AI Workforce task marked ${input.status}.`,
    route: data.route ?? "/admin/agents",
    severity: input.status === "blocked" || input.status === "rejected" ? "warning" : "info",
    source: "ai_workforce_task_queue",
    sourceId: data.id,
    metadata: {
      taskKey: data.task_key,
      status: input.status,
      externalWorkflowTouched: false,
      ...(input.metadata ?? {}),
    },
  });

  return data;
}

export async function updateAiWorkforceIngestionStatus(input: UpdateWorkforceIngestionStatusInput) {
  if (!input.ingestionId && !input.sourceKey) {
    throw new Error("ingestionId or sourceKey is required.");
  }

  const supabase = createServiceClient();
  const now = nowIso();
  const update: Record<string, unknown> = {
    updated_at: now,
    status: input.status,
  };

  if (input.nextStep !== undefined) update.next_step = input.nextStep;
  if (input.lastError !== undefined) update.last_error = input.lastError;
  if (input.status === "completed") update.processed_at = now;

  let query = supabase
    .from("ai_workforce_ingestion_queue")
    .update(update)
    .select("id,source_key,source_type,title,dashboard,status,assigned_agent_id,next_step")
    .limit(1);

  query = input.ingestionId ? query.eq("id", input.ingestionId) : query.eq("source_key", input.sourceKey);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("AI Workforce ingestion source was not found.");

  await recordAiWorkforceEvent({
    eventType: eventTypeForQueueStatus(input.status),
    agentId: data.assigned_agent_id ?? null,
    dashboard: data.dashboard,
    actorType: "admin",
    actorId: input.actorId ?? null,
    title: `Ingestion ${input.status}: ${data.title}`,
    summary: input.nextStep ?? `AI Workforce ingestion source marked ${input.status}.`,
    route: "/admin/agents",
    severity: input.status === "blocked" || input.status === "rejected" ? "warning" : "info",
    source: "ai_workforce_ingestion_queue",
    sourceId: data.id,
    metadata: {
      sourceKey: data.source_key,
      sourceType: data.source_type,
      status: input.status,
      externalWorkflowTouched: false,
      ...(input.metadata ?? {}),
    },
  });

  return data;
}

export async function planAiWorkforceTaskExecution(input: PlanWorkforceTaskInput): Promise<WorkforceTaskExecutionPlan> {
  if (!input.taskId && !input.taskKey) {
    throw new Error("taskId or taskKey is required.");
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("ai_workforce_task_queue")
    .select("id,task_key,agent_id,dashboard,title,description,recommended_action,route,priority,status,requires_human_approval,metadata")
    .limit(1);

  query = input.taskId ? query.eq("id", input.taskId) : query.eq("task_key", input.taskKey);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("AI Workforce task was not found.");

  const taskStatus = (data.status ?? "queued") as WorkforceQueueStatus;
  if (["done", "rejected", "archived"].includes(taskStatus)) {
    throw new Error("Completed, rejected, or archived tasks cannot be planned.");
  }

  const dashboardPlan = planForDashboard(String(data.dashboard));
  const taskHints = [
    ...splitTaskText(data.description),
    ...splitTaskText(data.recommended_action),
  ].slice(0, 4);

  const recommendedSteps = [
    ...taskHints.map((hint) => `Task context: ${hint}`),
    ...dashboardPlan.recommendedSteps,
  ].slice(0, 7);

  const plan: WorkforceTaskExecutionPlan = {
    taskId: String(data.id),
    taskKey: String(data.task_key),
    agentId: String(data.agent_id),
    dashboard: String(data.dashboard),
    title: String(data.title),
    route: data.route ?? "/admin/agents",
    status: taskStatus,
    requiresHumanApproval: Boolean(data.requires_human_approval),
    plan: {
      mode: "plan_only",
      externalWorkflowTouched: false,
      recommendedSteps,
      humanApprovalGates: dashboardPlan.humanApprovalGates,
      prohibitedActions: [
        "Do not send SMS, email, DM, or political outreach from this planning step.",
        "Do not publish pages, posts, creative, or campaign content from this planning step.",
        "Do not place orders, approve purchases, submit bids, or change Stripe/payment records.",
        "Do not bypass human approval, permissions, suppression rules, quiet hours, or compliance gates.",
      ],
      safeHandoff: "Admin reviews this plan, edits or approves the task separately, then records the human outcome.",
    },
  };

  const now = nowIso();

  const { error: updateError } = await supabase
    .from("ai_workforce_task_queue")
    .update({
      updated_at: now,
      metadata: mergeMetadata(data.metadata, {
        lastExecutionPlan: plan.plan,
        lastExecutionPlanAt: now,
        lastExecutionPlanBy: input.actorId ?? null,
        externalWorkflowTouched: false,
        ...(input.metadata ?? {}),
      }),
    })
    .eq("id", data.id);
  if (updateError) throw updateError;

  await upsertAiWorkforceMemoryItem({
    memoryKey: `execution-plan:${data.task_key}`,
    agentId: data.agent_id ?? null,
    dashboard: String(data.dashboard),
    memoryType: "playbook",
    title: `Plan only: ${data.title}`,
    summary: `Execution plan prepared for human review. ${plan.plan.safeHandoff}`,
    source: "ai_workforce_task_queue",
    sourceId: String(data.id),
    route: data.route ?? "/admin/agents",
    confidence: 0.86,
    impactLevel: (data.priority ?? "medium") as WorkforceMemoryItem["impactLevel"],
    metadata: {
      taskKey: data.task_key,
      plan: plan.plan,
      externalWorkflowTouched: false,
    },
  });

  await recordAiWorkforceEvent({
    eventType: "recommended",
    agentId: data.agent_id ?? null,
    dashboard: String(data.dashboard),
    actorType: "admin",
    actorId: input.actorId ?? null,
    title: `Plan only prepared: ${data.title}`,
    summary: "A supervised execution plan was generated for review. No external workflow was executed.",
    route: data.route ?? "/admin/agents",
    severity: "info",
    source: "ai_workforce_task_queue",
    sourceId: String(data.id),
    metadata: {
      taskKey: data.task_key,
      planMode: "plan_only",
      externalWorkflowTouched: false,
      ...(input.metadata ?? {}),
    },
  });

  return plan;
}

export async function sendAiWorkforceTaskToApproval(input: SendWorkforceTaskToApprovalInput): Promise<WorkforceTaskApprovalHandoff> {
  if (!input.taskId && !input.taskKey) {
    throw new Error("taskId or taskKey is required.");
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("ai_workforce_task_queue")
    .select("id,task_key,agent_id,dashboard,title,description,recommended_action,route,priority,status,requires_human_approval,approval_request_id,metadata")
    .limit(1);

  query = input.taskId ? query.eq("id", input.taskId) : query.eq("task_key", input.taskKey);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("AI Workforce task was not found.");

  const taskStatus = (data.status ?? "queued") as WorkforceQueueStatus;
  if (["done", "rejected", "archived"].includes(taskStatus)) {
    throw new Error("Completed, rejected, or archived tasks cannot be sent to approval.");
  }

  let parsedPlan = parseExecutionPlan(data.metadata);
  if (!parsedPlan.lastExecutionPlan) {
    const generated = await planAiWorkforceTaskExecution({
      taskId: String(data.id),
      actorId: input.actorId ?? null,
      metadata: {
        generatedForApprovalHandoff: true,
        ...(input.metadata ?? {}),
      },
    });
    parsedPlan = {
      lastExecutionPlan: generated.plan,
      lastExecutionPlanAt: nowIso(),
    };
  }

  const plan = parsedPlan.lastExecutionPlan;
  if (!plan) throw new Error("Plan generation failed.");

  const now = nowIso();
  const sourceKey = `ai-workforce-task:${data.task_key}`;
  const riskLevel = (data.priority ?? "medium") as WorkforceMemoryItem["impactLevel"];
  const guardrailSummary = [
    "Human approval required before any next step.",
    ...plan.humanApprovalGates.slice(0, 3).map((gate) => `Gate: ${gate}`),
  ].join(" ");
  const cannotExecuteReason =
    "AI Workforce handoff creates an approval request only. It does not send outreach, publish content, place orders, submit bids, launch campaigns, or change payments.";
  const sourceSnapshot = {
    taskId: data.id,
    taskKey: data.task_key,
    agentId: data.agent_id,
    dashboard: data.dashboard,
    route: data.route ?? "/admin/agents",
    priority: data.priority ?? "medium",
    priorStatus: data.status,
    plan,
    note: input.note ?? null,
    externalWorkflowTouched: false,
  };

  const { data: existingRequest, error: existingError } = await supabase
    .from("ai_autopilot_approval_requests")
    .select("id,approval_status,executor_status,metadata")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (existingError) throw existingError;

  let approvalRequest: { id: string; approval_status: string; executor_status: string };
  if (existingRequest) {
    const { data: updatedRequest, error: updateRequestError } = await supabase
      .from("ai_autopilot_approval_requests")
      .update({
        updated_at: now,
        last_seen_at: now,
        source: "ai_workforce_task_queue",
        dashboard: String(data.dashboard),
        route: data.route ?? "/admin/agents",
        title: `Approve AI Workforce plan: ${data.title}`.slice(0, 240),
        requested_action: data.recommended_action,
        expected_impact: "Moves a reviewed AI Workforce plan into human approval before any internal task or external workflow can proceed.",
        risk_level: riskLevel,
        execution_mode: "human_approval",
        executor_status: existingRequest.executor_status ?? "approval_only",
        guardrail_summary: guardrailSummary,
        cannot_execute_reason: cannotExecuteReason,
        requires_human_approval: true,
        source_snapshot: sourceSnapshot,
        metadata: mergeMetadata(existingRequest.metadata, {
          sourceTaskId: data.id,
          taskKey: data.task_key,
          plan,
          resentToApprovalAt: now,
          externalWorkflowTouched: false,
          ...(input.metadata ?? {}),
        }),
      })
      .eq("id", existingRequest.id)
      .select("id,approval_status,executor_status")
      .single();
    if (updateRequestError) throw updateRequestError;
    approvalRequest = updatedRequest;
  } else {
    const { data: insertedRequest, error: insertRequestError } = await supabase
      .from("ai_autopilot_approval_requests")
      .insert({
        source_key: sourceKey,
        source: "ai_workforce_task_queue",
        dashboard: String(data.dashboard),
        route: data.route ?? "/admin/agents",
        title: `Approve AI Workforce plan: ${data.title}`.slice(0, 240),
        requested_action: data.recommended_action,
        expected_impact: "Moves a reviewed AI Workforce plan into human approval before any internal task or external workflow can proceed.",
        risk_level: riskLevel,
        approval_status: "pending",
        execution_mode: "human_approval",
        executor_status: "approval_only",
        guardrail_summary: guardrailSummary,
        cannot_execute_reason: cannotExecuteReason,
        requires_human_approval: true,
        source_snapshot: sourceSnapshot,
        metadata: {
          sourceTaskId: data.id,
          taskKey: data.task_key,
          plan,
          externalWorkflowTouched: false,
          ...(input.metadata ?? {}),
        },
      })
      .select("id,approval_status,executor_status")
      .single();
    if (insertRequestError) throw insertRequestError;
    approvalRequest = insertedRequest;
  }

  const { error: eventError } = await supabase
    .from("ai_autopilot_approval_events")
    .insert({
      request_id: approvalRequest.id,
      source_key: sourceKey,
      event_type: existingRequest ? "observed" : "created",
      actor_id: input.actorId ?? null,
      note: input.note ?? "AI Workforce task sent to approval queue. No external workflow was executed.",
      metadata: {
        sourceTaskId: data.id,
        taskKey: data.task_key,
        approvalStatus: approvalRequest.approval_status,
        executorStatus: approvalRequest.executor_status,
        externalWorkflowTouched: false,
      },
    });
  if (eventError) throw eventError;

  const { error: taskUpdateError } = await supabase
    .from("ai_workforce_task_queue")
    .update({
      updated_at: now,
      status: "needs_approval",
      approval_request_id: approvalRequest.id,
      metadata: mergeMetadata(data.metadata, {
        lastExecutionPlan: plan,
        lastExecutionPlanAt: parsedPlan.lastExecutionPlanAt ?? now,
        approvalRequestId: approvalRequest.id,
        approvalRequestStatus: approvalRequest.approval_status,
        sentToApprovalAt: now,
        sentToApprovalBy: input.actorId ?? null,
        externalWorkflowTouched: false,
        ...(input.metadata ?? {}),
      }),
    })
    .eq("id", data.id);
  if (taskUpdateError) throw taskUpdateError;

  await upsertAiWorkforceMemoryItem({
    memoryKey: `approval-handoff:${data.task_key}`,
    agentId: data.agent_id ?? null,
    dashboard: String(data.dashboard),
    memoryType: "decision",
    title: `Approval handoff: ${data.title}`,
    summary: "Task plan was sent to the existing human approval queue. No external workflow was executed.",
    source: "ai_autopilot_approval_requests",
    sourceId: approvalRequest.id,
    route: data.route ?? "/admin/agents",
    confidence: 0.9,
    impactLevel: riskLevel,
    metadata: {
      taskKey: data.task_key,
      approvalRequestId: approvalRequest.id,
      approvalStatus: approvalRequest.approval_status,
      executorStatus: approvalRequest.executor_status,
      externalWorkflowTouched: false,
    },
  });

  await recordAiWorkforceEvent({
    eventType: "queued",
    agentId: data.agent_id ?? null,
    dashboard: String(data.dashboard),
    actorType: "admin",
    actorId: input.actorId ?? null,
    title: `Approval queued: ${data.title}`,
    summary: "AI Workforce task plan sent to the existing human approval queue. No external workflow was executed.",
    route: data.route ?? "/admin/agents",
    severity: riskLevel === "critical" ? "warning" : "info",
    source: "ai_workforce_task_queue",
    sourceId: String(data.id),
    metadata: {
      taskKey: data.task_key,
      approvalRequestId: approvalRequest.id,
      approvalStatus: approvalRequest.approval_status,
      executorStatus: approvalRequest.executor_status,
      externalWorkflowTouched: false,
      ...(input.metadata ?? {}),
    },
  });

  return {
    taskId: String(data.id),
    taskKey: String(data.task_key),
    approvalRequestId: approvalRequest.id,
    approvalStatus: approvalRequest.approval_status,
    executorStatus: approvalRequest.executor_status,
    externalWorkflowTouched: false,
    message: "Task sent to human approval queue. No external workflow was executed.",
  };
}

export async function dryRunAiWorkforceTaskExecution(input: DryRunWorkforceTaskInput): Promise<WorkforceTaskDryRunPreview> {
  if (!input.taskId && !input.taskKey) {
    throw new Error("taskId or taskKey is required.");
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("ai_workforce_task_queue")
    .select("id,task_key,agent_id,dashboard,title,description,recommended_action,route,priority,status,requires_human_approval,approval_request_id,metadata")
    .limit(1);

  query = input.taskId ? query.eq("id", input.taskId) : query.eq("task_key", input.taskKey);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("AI Workforce task was not found.");

  const taskStatus = (data.status ?? "queued") as WorkforceQueueStatus;
  if (["done", "rejected", "archived"].includes(taskStatus)) {
    throw new Error("Completed, rejected, or archived tasks cannot be dry-run previewed.");
  }
  if (!data.approval_request_id) {
    throw new Error("Send this planned task to the approval queue before running an execution preview.");
  }

  const { data: approval, error: approvalError } = await supabase
    .from("ai_autopilot_approval_requests")
    .select("id,source_key,source,dashboard,route,title,requested_action,expected_impact,risk_level,approval_status,executor_status,guardrail_summary,cannot_execute_reason,source_snapshot")
    .eq("id", data.approval_request_id)
    .maybeSingle();

  if (approvalError) throw approvalError;
  if (!approval) throw new Error("Linked approval request was not found.");

  let parsedPlan = parseExecutionPlan(data.metadata);
  if (!parsedPlan.lastExecutionPlan) {
    const generated = await planAiWorkforceTaskExecution({
      taskId: String(data.id),
      actorId: input.actorId ?? null,
      metadata: {
        generatedForDryRun: true,
        ...(input.metadata ?? {}),
      },
    });
    parsedPlan = {
      lastExecutionPlan: generated.plan,
      lastExecutionPlanAt: nowIso(),
    };
  }

  const now = nowIso();
  const preview = dryRunForApproval({
    taskTitle: String(data.title),
    requestedAction: String(approval.requested_action ?? data.recommended_action),
    dashboard: String(approval.dashboard ?? data.dashboard),
    approvalStatus: String(approval.approval_status ?? "pending"),
    executorStatus: String(approval.executor_status ?? "approval_only"),
    guardrailSummary: approval.guardrail_summary ?? null,
    cannotExecuteReason: approval.cannot_execute_reason ?? null,
    plan: parsedPlan.lastExecutionPlan,
  });

  const { error: taskUpdateError } = await supabase
    .from("ai_workforce_task_queue")
    .update({
      updated_at: now,
      metadata: mergeMetadata(data.metadata, {
        lastExecutionPlan: parsedPlan.lastExecutionPlan,
        lastExecutionPlanAt: parsedPlan.lastExecutionPlanAt ?? now,
        lastDryRunPreview: preview,
        lastDryRunPreviewAt: now,
        lastDryRunPreviewBy: input.actorId ?? null,
        approvalRequestId: approval.id,
        approvalRequestStatus: approval.approval_status,
        executorStatus: approval.executor_status,
        externalWorkflowTouched: false,
        ...(input.metadata ?? {}),
      }),
    })
    .eq("id", data.id);
  if (taskUpdateError) throw taskUpdateError;

  const { error: approvalEventError } = await supabase
    .from("ai_autopilot_approval_events")
    .insert({
      request_id: approval.id,
      source_key: approval.source_key,
      event_type: "observed",
      actor_id: input.actorId ?? null,
      note: input.note ?? "Dry-run execution preview generated. No external workflow was executed.",
      metadata: {
        sourceTaskId: data.id,
        taskKey: data.task_key,
        approvalStatus: approval.approval_status,
        executorStatus: approval.executor_status,
        preview,
        executionEnabled: false,
        externalWorkflowTouched: false,
      },
    });
  if (approvalEventError) throw approvalEventError;

  await upsertAiWorkforceMemoryItem({
    memoryKey: `dry-run-preview:${data.task_key}`,
    agentId: data.agent_id ?? null,
    dashboard: String(data.dashboard),
    memoryType: "qa_note",
    title: `Dry run preview: ${data.title}`,
    summary: `${preview.nextHumanAction} No external workflow was executed.`,
    source: "ai_workforce_task_queue",
    sourceId: String(data.id),
    route: data.route ?? "/admin/agents",
    confidence: 0.9,
    impactLevel: (data.priority ?? "medium") as WorkforceMemoryItem["impactLevel"],
    metadata: {
      taskKey: data.task_key,
      approvalRequestId: approval.id,
      approvalStatus: approval.approval_status,
      executorStatus: approval.executor_status,
      preview,
      externalWorkflowTouched: false,
    },
  });

  await recordAiWorkforceEvent({
    eventType: "observed",
    agentId: data.agent_id ?? null,
    dashboard: String(data.dashboard),
    actorType: "admin",
    actorId: input.actorId ?? null,
    title: `Dry run preview: ${data.title}`,
    summary: "AI Workforce dry-run executor preview generated. No external workflow was executed.",
    route: data.route ?? "/admin/agents",
    severity: "info",
    source: "ai_workforce_task_queue",
    sourceId: String(data.id),
    metadata: {
      taskKey: data.task_key,
      approvalRequestId: approval.id,
      approvalStatus: approval.approval_status,
      executorStatus: approval.executor_status,
      externalWorkflowTouched: false,
      ...(input.metadata ?? {}),
    },
  });

  return {
    taskId: String(data.id),
    taskKey: String(data.task_key),
    approvalRequestId: approval.id,
    approvalStatus: String(approval.approval_status ?? "pending"),
    executorStatus: String(approval.executor_status ?? "approval_only"),
    externalWorkflowTouched: false,
    preview,
    message: "Dry-run preview generated. No external workflow was executed.",
  };
}
