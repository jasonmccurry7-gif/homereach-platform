import type { AppRole } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { seedEvents, seedMiniApps } from "./seed";
import {
  MINI_APP_EVENT_TYPES,
  MINI_APP_PRIORITIES,
  MINI_APP_RISK_LEVELS,
  MINI_APP_STATUSES,
  MINI_APP_TYPES,
  type AgentMiniApp,
  type AgentMiniAppEvent,
  type AgentMiniAppsData,
  type AgentMiniAppsSummary,
  type MiniAppEventType,
  type MiniAppPriority,
  type MiniAppRiskLevel,
  type MiniAppStatus,
  type MiniAppType,
} from "./types";

type GenericRow = Record<string, unknown>;

export const AGENT_MINI_APPS_MIGRATION_HINT =
  "Apply supabase/migrations/20260601021915_agent_mini_apps_layer.sql to persist Agent Mini Apps, audit events, seed mini apps, and execution queue compatibility.";

const FINAL_STATUSES = new Set<MiniAppStatus>(["executed", "rejected", "archived"]);
const REVIEW_STATUSES = new Set<MiniAppStatus>(["generated", "needs_review", "edited"]);

export async function loadAgentMiniAppsData(input: {
  userId: string | null;
  role: AppRole | null;
}): Promise<AgentMiniAppsData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const miniApps = sortMiniApps(filterForRole(seedMiniApps, input));
    return {
      schemaReady: false,
      migrationHint: AGENT_MINI_APPS_MIGRATION_HINT,
      warnings: ["Supabase service credentials are unavailable. Showing seed fallback mini apps only."],
      summary: buildSummary(miniApps, seedEvents),
      miniApps,
      events: seedEvents,
      userRole: input.role,
      userId: input.userId,
    };
  }

  const db = createServiceClient();
  const [appsResult, eventsResult] = await Promise.all([
    safeList(db, "agent_mini_apps", "updated_at"),
    safeList(db, "agent_mini_app_events", "created_at"),
  ]);

  const errors = [appsResult.error, eventsResult.error].filter(Boolean).map((error) => String(error?.message ?? error));
  if (errors.length > 0) {
    const miniApps = sortMiniApps(filterForRole(seedMiniApps, input));
    return {
      schemaReady: false,
      migrationHint: AGENT_MINI_APPS_MIGRATION_HINT,
      warnings: [
        ...errors,
        "Agent Mini Apps fell back to seed data after a live load failure.",
      ],
      summary: buildSummary(miniApps, seedEvents),
      miniApps,
      events: seedEvents,
      userRole: input.role,
      userId: input.userId,
    };
  }

  const miniApps = sortMiniApps(filterForRole((appsResult.data ?? []).map(mapMiniAppRow), input));
  const visibleIds = new Set(miniApps.map((app) => app.id));
  const events = (eventsResult.data ?? [])
    .map(mapEventRow)
    .filter((event) => visibleIds.has(event.miniAppId));

  return {
    schemaReady: true,
    migrationHint: null,
    warnings: [],
    summary: buildSummary(miniApps, events),
    miniApps,
    events,
    userRole: input.role,
    userId: input.userId,
  };
}

export async function loadAgentMiniAppDetail(input: {
  id: string;
  userId: string | null;
  role: AppRole | null;
}): Promise<{ miniApp: AgentMiniApp | null; events: AgentMiniAppEvent[]; warning: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const app = filterForRole(seedMiniApps, input).find((item) => item.id === input.id) ?? null;
    return {
      miniApp: app,
      events: seedEvents.filter((event) => event.miniAppId === input.id),
      warning: "Supabase service credentials are unavailable. Showing seed fallback data only.",
    };
  }

  const db = createServiceClient();
  const { data, error } = await db.from("agent_mini_apps").select("*").eq("id", input.id).single();
  if (error) {
    return { miniApp: null, events: [], warning: error.message };
  }

  const miniApp = mapMiniAppRow(data as GenericRow);
  if (!canViewMiniApp(miniApp, input)) {
    return { miniApp: null, events: [], warning: "Forbidden" };
  }

  const eventsResult = await db
    .from("agent_mini_app_events")
    .select("*")
    .eq("mini_app_id", input.id)
    .order("created_at", { ascending: false });

  return {
    miniApp,
    events: (eventsResult.data ?? []).map(mapEventRow),
    warning: eventsResult.error?.message ?? null,
  };
}

export function buildSummary(miniApps: AgentMiniApp[], events: AgentMiniAppEvent[]): AgentMiniAppsSummary {
  const todayKey = new Date().toISOString().slice(0, 10);
  const needsApproval = miniApps.filter((app) => app.approvalRequired && REVIEW_STATUSES.has(app.status));
  const manualTakeoverIds = new Set(
    events
      .filter((event) => event.eventType === "manual_takeover_requested")
      .map((event) => event.miniAppId),
  );

  return {
    pendingApprovals: needsApproval.length,
    urgentItems: miniApps.filter((app) => app.priority === "urgent" && !FINAL_STATUSES.has(app.status)).length,
    estimatedRevenueAwaitingApproval: sumMoney(needsApproval.map((app) => app.estimatedRevenue)),
    estimatedSavingsAwaitingApproval: sumMoney(needsApproval.map((app) => app.estimatedSavings)),
    overdueTasks: miniApps.filter((app) => Boolean(app.dueAt) && new Date(app.dueAt as string) < new Date() && !FINAL_STATUSES.has(app.status)).length,
    completedToday: miniApps.filter((app) => app.status === "executed" && app.updatedAt.startsWith(todayKey)).length,
    failedTasks: miniApps.filter((app) => app.status === "failed").length,
    manualTakeoverNeeded: miniApps.filter((app) => manualTakeoverIds.has(app.id) || app.status === "failed").length,
  };
}

export function canViewMiniApp(app: AgentMiniApp, input: { userId: string | null; role: AppRole | null }) {
  if (input.role === "admin") return true;
  if (input.role !== "sales_agent" || !input.userId) return false;
  return app.assignedUserId === input.userId || app.createdBy === input.userId;
}

export function canMutateMiniApp(app: AgentMiniApp, input: { userId: string | null; role: AppRole | null }, action: string) {
  if (input.role === "admin") return true;
  if (input.role !== "sales_agent" || !input.userId) return false;
  const assigned = app.assignedUserId === input.userId || app.createdBy === input.userId;
  return assigned && ["edit_payload", "mark_needs_review", "manual_takeover_requested"].includes(action);
}

export function isFinalStatus(status: MiniAppStatus) {
  return FINAL_STATUSES.has(status);
}

export function sortMiniApps(miniApps: AgentMiniApp[]) {
  const priorityRank: Record<MiniAppPriority, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
  const riskRank: Record<MiniAppRiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return [...miniApps].sort((a, b) => {
    const priorityDelta = priorityRank[b.priority] - priorityRank[a.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const moneyDelta = Math.max(b.estimatedRevenue, b.estimatedSavings) - Math.max(a.estimatedRevenue, a.estimatedSavings);
    if (moneyDelta !== 0) return moneyDelta;

    const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) return dueA - dueB;

    const confidenceDelta = b.confidenceScore - a.confidenceScore;
    if (confidenceDelta !== 0) return confidenceDelta;

    return riskRank[b.riskLevel] - riskRank[a.riskLevel];
  });
}

async function safeList(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  orderColumn: string,
): Promise<{ data: GenericRow[] | null; error: { message: string } | null }> {
  const { data, error } = await db.from(table).select("*").order(orderColumn, { ascending: false }).limit(500);
  return {
    data: (data ?? null) as GenericRow[] | null,
    error: error ? { message: error.message } : null,
  };
}

function filterForRole(miniApps: AgentMiniApp[], input: { userId: string | null; role: AppRole | null }) {
  return miniApps.filter((app) => canViewMiniApp(app, input));
}

export function mapMiniAppRow(row: GenericRow): AgentMiniApp {
  return {
    id: String(row.id),
    tenantId: nullableString(row.tenant_id),
    miniAppType: asMiniAppType(row.mini_app_type),
    title: String(row.title ?? "Untitled mini app"),
    description: String(row.description ?? ""),
    sourceAgent: String(row.source_agent ?? "Orchestrator Agent"),
    relatedModule: String(row.related_module ?? "ai_workforce"),
    relatedBusinessId: nullableString(row.related_business_id),
    relatedContactId: nullableString(row.related_contact_id),
    relatedCampaignId: nullableString(row.related_campaign_id),
    relatedClientId: nullableString(row.related_client_id),
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    confidenceScore: numberValue(row.confidence_score),
    riskLevel: asRisk(row.risk_level),
    approvalRequired: Boolean(row.approval_required ?? true),
    estimatedRevenue: numberValue(row.estimated_revenue),
    estimatedSavings: numberValue(row.estimated_savings),
    estimatedCost: numberValue(row.estimated_cost),
    recommendedAction: String(row.recommended_action ?? ""),
    payloadJson: asRecord(row.payload_json),
    editedPayloadJson: row.edited_payload_json ? asRecord(row.edited_payload_json) : null,
    decision: nullableString(row.decision),
    decisionReason: nullableString(row.decision_reason),
    assignedUserId: nullableString(row.assigned_user_id),
    dueAt: nullableString(row.due_at),
    createdBy: nullableString(row.created_by),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    archivedAt: nullableString(row.archived_at),
  };
}

export function mapEventRow(row: GenericRow): AgentMiniAppEvent {
  return {
    id: String(row.id),
    miniAppId: String(row.mini_app_id ?? ""),
    eventType: asEventType(row.event_type),
    previousStatus: row.previous_status ? asStatus(row.previous_status) : null,
    newStatus: row.new_status ? asStatus(row.new_status) : null,
    actorUserId: nullableString(row.actor_user_id),
    actorType: row.actor_type === "agent" || row.actor_type === "system" ? row.actor_type : "user",
    eventSummary: String(row.event_summary ?? ""),
    eventPayloadJson: asRecord(row.event_payload_json),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function asMiniAppType(value: unknown): MiniAppType {
  const text = String(value ?? "generic_task");
  return MINI_APP_TYPES.includes(text as MiniAppType) ? (text as MiniAppType) : "generic_task";
}

function asStatus(value: unknown): MiniAppStatus {
  const text = String(value ?? "generated");
  return MINI_APP_STATUSES.includes(text as MiniAppStatus) ? (text as MiniAppStatus) : "generated";
}

function asPriority(value: unknown): MiniAppPriority {
  const text = String(value ?? "normal");
  return MINI_APP_PRIORITIES.includes(text as MiniAppPriority) ? (text as MiniAppPriority) : "normal";
}

function asRisk(value: unknown): MiniAppRiskLevel {
  const text = String(value ?? "medium");
  return MINI_APP_RISK_LEVELS.includes(text as MiniAppRiskLevel) ? (text as MiniAppRiskLevel) : "medium";
}

function asEventType(value: unknown): MiniAppEventType {
  const text = String(value ?? "created");
  return MINI_APP_EVENT_TYPES.includes(text as MiniAppEventType) ? (text as MiniAppEventType) : "created";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumMoney(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
