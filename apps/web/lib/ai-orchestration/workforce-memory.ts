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
        .select("id,task_key,agent_id,dashboard,title,recommended_action,route,priority,status,requires_human_approval,due_at,updated_at")
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

  const tasks: WorkforceTaskQueueItem[] = taskRows.map((row) => ({
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
  }));

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
    "Keep task execution separate from the queue until executor-specific approvals are connected.",
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
