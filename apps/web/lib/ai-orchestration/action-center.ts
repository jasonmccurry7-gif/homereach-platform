import { createServiceClient } from "@/lib/supabase/service";
import { getDashboardAgentMatrix } from "./dashboard-agents";
import { getSourceFreshnessReport } from "./source-freshness";
import { getUserActionReadiness } from "./user-action-items";

export type UnifiedActionUrgency = "critical" | "high" | "medium" | "low";
export type UnifiedActionStatus = "needs_review" | "blocked" | "ready" | "watch";
export type UnifiedActionDurableState = "open" | "snoozed" | "resolved" | "dismissed" | "archived";
export type UnifiedActionOperation = "resolve" | "snooze" | "dismiss" | "reopen" | "comment";

export interface UnifiedActionItem {
  id: string;
  source: string;
  dashboard: string;
  route: string;
  title: string;
  reason: string;
  recommendedAction: string;
  impact: string;
  urgency: UnifiedActionUrgency;
  status: UnifiedActionStatus;
  owner: "admin" | "sales" | "jason" | "operations";
  requiresHumanApproval: boolean;
  createdAt?: string | null;
  dueAt?: string | null;
  durableId?: string | null;
  durableState?: UnifiedActionDurableState;
  snoozedUntil?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  commentCount?: number;
}

export interface UnifiedActionMutationInput {
  sourceKey: string;
  operation: UnifiedActionOperation;
  actorId?: string | null;
  note?: string | null;
  snoozeHours?: number | null;
}

export interface UnifiedActionCenterSummary {
  total: number;
  critical: number;
  high: number;
  needsReview: number;
  blocked: number;
  humanApprovalRequired: number;
}

export interface UnifiedActionCenter {
  generatedAt: string;
  summary: UnifiedActionCenterSummary;
  items: UnifiedActionItem[];
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
}

const URGENCY_WEIGHT: Record<UnifiedActionUrgency, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function nowIso() {
  return new Date().toISOString();
}

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function summarize(items: UnifiedActionItem[]): UnifiedActionCenterSummary {
  return {
    total: items.length,
    critical: items.filter((item) => item.urgency === "critical").length,
    high: items.filter((item) => item.urgency === "high").length,
    needsReview: items.filter((item) => item.status === "needs_review").length,
    blocked: items.filter((item) => item.status === "blocked").length,
    humanApprovalRequired: items.filter((item) => item.requiresHumanApproval).length,
  };
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function operationToEventType(operation: UnifiedActionOperation) {
  if (operation === "resolve") return "resolved";
  if (operation === "snooze") return "snoozed";
  if (operation === "dismiss") return "dismissed";
  if (operation === "reopen") return "reopened";
  return "commented";
}

export async function getUnifiedActionCenter(limit = 24): Promise<UnifiedActionCenter> {
  const sourceHealth: UnifiedActionCenter["sourceHealth"] = [];
  const items: UnifiedActionItem[] = [];

  const dashboardAgents = getDashboardAgentMatrix();
  for (const agent of dashboardAgents) {
    if (agent.status === "ready") continue;

    const missing = agent.missingRequiredEnv.slice(0, 2).join(", ");
    const blocker = agent.manualBlockers?.[0] ?? (missing ? `Missing required env: ${missing}` : "Optional setup is incomplete.");

    items.push({
      id: `agent-readiness-${agent.id}`,
      source: "dashboard_agent_matrix",
      dashboard: agent.dashboard,
      route: "/admin/agents",
      title: `${agent.name} is ${agent.status === "blocked" ? "blocked" : "partially ready"}`,
      reason: blocker,
      recommendedAction: agent.nextActions[0] ?? agent.phaseNext,
      impact: "Improves safe autonomy readiness for this dashboard.",
      urgency: agent.status === "blocked" ? "high" : "medium",
      status: agent.status === "blocked" ? "blocked" : "watch",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: nowIso(),
    });
  }

  const userActionReadiness = getUserActionReadiness();
  for (const action of userActionReadiness.items.slice(0, 12)) {
    items.push({
      id: `user-action-${action.id}`,
      source: "user_action_required",
      dashboard: action.relatedSystem ?? "HomeReach Setup",
      route: action.relatedRoute ?? "/admin/agents",
      title: action.title,
      reason: action.detail,
      recommendedAction: action.nextStep,
      impact: action.blocksGoLive
        ? "Required before go-live."
        : action.blocksAutonomy
          ? "Required before expanding safe autonomy."
          : "Improves production readiness.",
      urgency: action.priority,
      status: action.blocksGoLive ? "blocked" : "needs_review",
      owner: action.owner === "jason" ? "jason" : "admin",
      requiresHumanApproval: true,
      createdAt: userActionReadiness.generatedAt,
    });
  }

  if (!hasSupabaseEnv()) {
    sourceHealth.push({
      source: "supabase",
      status: "unavailable",
      note: "Supabase env is missing, so only environment/action-readiness items were generated.",
    });
    const sorted = sortActions(items).slice(0, limit);
    return { generatedAt: nowIso(), summary: summarize(sorted), items: sorted, sourceHealth };
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
    approvalQueue,
    politicalReplies,
    aiSuggestions,
    govDue,
    govApprovals,
    failedWebhooks,
    hotSalesLeads,
    procurementSequence,
    learningInsights,
    learningEnhancements,
    learningAutomations,
    promotedLearningActions,
  ] = await Promise.all([
    readSource("revenue_message_approval_queue", async () => {
      const { data, error } = await supabase
        .from("revenue_message_approval_queue")
        .select("id,business_line,channel,status,title,created_at,due_at")
        .in("status", ["draft", "needs_review", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("revenue_message_threads", async () => {
      const { data, error } = await supabase
        .from("revenue_message_threads")
        .select("id,business_line,display_name,organization_name,status,latest_direction,latest_message_body,latest_message_at,unread_count")
        .eq("business_line", "political")
        .or("latest_direction.eq.inbound,unread_count.gt.0,status.eq.needs_review,status.eq.waiting_on_homereach")
        .order("latest_message_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("revenue_ai_suggestions", async () => {
      const { data, error } = await supabase
        .from("revenue_ai_suggestions")
        .select("id,business_line,suggestion_type,status,recommended_action,confidence,created_at")
        .in("status", ["draft", "needs_review"])
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("gov_contract_opportunities", async () => {
      const { data, error } = await supabase
        .from("gov_contract_opportunities")
        .select("id,title,agency,response_deadline,fit_status,fit_score,pipeline_status")
        .lte("response_deadline", inDays(7))
        .not("pipeline_status", "in", "(submitted,awarded,lost,no_bid,archived)")
        .order("response_deadline", { ascending: true })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("gov_contract_bid_rooms", async () => {
      const { data, error } = await supabase
        .from("gov_contract_bid_rooms")
        .select("id,opportunity_id,go_no_go_status,approval_status,submission_readiness_score,updated_at")
        .in("approval_status", ["pending", "needs_changes"])
        .order("updated_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("revenue_webhook_events", async () => {
      const { data, error } = await supabase
        .from("revenue_webhook_events")
        .select("id,provider,event_type,processing_status,created_at")
        .eq("processing_status", "failed")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("sales_leads", async () => {
      const { data, error } = await supabase
        .from("sales_leads")
        .select("id,business_name,city,category,status,last_reply_at,score")
        .in("status", ["replied", "interested", "payment_sent"])
        .order("last_reply_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("auto_sequences", async () => {
      const { data, error } = await supabase
        .from("auto_sequences")
        .select("id,name,status,business_line,updated_at")
        .eq("business_line", "inventory_procurement")
        .limit(2);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ci_insights", async () => {
      const { data, error } = await supabase
        .from("ci_insights")
        .select("id,category,theme,insight_text,rationale,apex_score,status,created_at")
        .eq("status", "pending")
        .gte("apex_score", 16)
        .order("apex_score", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ci_enhancements", async () => {
      const { data, error } = await supabase
        .from("ci_enhancements")
        .select("id,category,title,description,kind,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ci_automations", async () => {
      const { data, error } = await supabase
        .from("ci_automations")
        .select("id,category,title,trigger_desc,action_desc,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("learning_engine_promotions", async () => {
      const { data, error } = await supabase
        .from("unified_action_items")
        .select("source_key,source,dashboard,route,title,reason,recommended_action,impact,urgency,status,owner,requires_human_approval,source_created_at,due_at,state,snoozed_until,resolved_at,resolution_note,metadata,created_at")
        .eq("source", "learning_engine_promotion")
        .in("state", ["open", "snoozed"])
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
  ]);

  for (const row of approvalQueue) {
    items.push({
      id: `message-approval-${row.id}`,
      source: "revenue_message_approval_queue",
      dashboard: "Outreach Messaging",
      route: "/admin/inbox",
      title: row.title ?? `Review ${row.business_line} message`,
      reason: `${row.business_line ?? "Unknown"} ${row.channel ?? "message"} is queued for ${row.status}.`,
      recommendedAction: "Review, edit, approve, reject, or schedule the message.",
      impact: "Keeps outreach moving while preserving human approval.",
      urgency: row.due_at && new Date(row.due_at).getTime() < Date.now() + 24 * 60 * 60 * 1000 ? "high" : "medium",
      status: "needs_review",
      owner: row.business_line === "political" ? "jason" : "sales",
      requiresHumanApproval: true,
      createdAt: row.created_at,
      dueAt: row.due_at,
    });
  }

  for (const row of politicalReplies) {
    const name = row.organization_name || row.display_name || "Political contact";
    items.push({
      id: `political-reply-${row.id}`,
      source: "revenue_message_threads",
      dashboard: "Political Outreach",
      route: "/admin/inbox",
      title: `${name} needs human follow-up`,
      reason: row.latest_direction === "inbound" ? "Political lead replied. Automation should pause for human handoff." : "Political thread is waiting on HomeReach.",
      recommendedAction: "Open the conversation, review the prior message, and reply manually or approve an AI draft.",
      impact: "Protects political compliance while keeping warm campaign opportunities from going stale.",
      urgency: "critical",
      status: "needs_review",
      owner: "jason",
      requiresHumanApproval: true,
      createdAt: row.latest_message_at,
    });
  }

  for (const row of aiSuggestions) {
    items.push({
      id: `ai-suggestion-${row.id}`,
      source: "revenue_ai_suggestions",
      dashboard: "AI Draft Review",
      route: "/admin/inbox",
      title: `Review AI ${row.suggestion_type ?? "suggestion"} draft`,
      reason: row.recommended_action ?? `${row.business_line} AI draft is waiting for review.`,
      recommendedAction: "Approve, edit, or reject the AI suggestion before anything is sent.",
      impact: "Moves AI from draft to controlled execution.",
      urgency: row.business_line === "political" ? "high" : "medium",
      status: "needs_review",
      owner: row.business_line === "political" ? "jason" : "admin",
      requiresHumanApproval: true,
      createdAt: row.created_at,
    });
  }

  for (const row of govDue) {
    const due = row.response_deadline ? new Date(row.response_deadline).getTime() : 0;
    const hours = due ? Math.round((due - Date.now()) / 3_600_000) : null;
    items.push({
      id: `gov-deadline-${row.id}`,
      source: "gov_contract_opportunities",
      dashboard: "Gov Contracts",
      route: `/admin/gov-contracts/${row.id}`,
      title: `Gov contract deadline: ${row.title ?? "Opportunity"}`,
      reason: `${row.agency ?? "Agency"} response deadline is ${hours !== null ? `${hours} hours away` : "within 7 days"}. Fit score ${row.fit_score ?? 0}.`,
      recommendedAction: row.fit_status === "strong_fit" ? "Open Bid Room and make a go/no-go decision." : "Review opportunity and mark pursue or no-bid.",
      impact: "Prevents missed government contract deadlines.",
      urgency: hours !== null && hours <= 48 ? "critical" : row.fit_status === "strong_fit" ? "high" : "medium",
      status: "ready",
      owner: "operations",
      requiresHumanApproval: true,
      dueAt: row.response_deadline,
    });
  }

  for (const row of govApprovals) {
    items.push({
      id: `gov-approval-${row.id}`,
      source: "gov_contract_bid_rooms",
      dashboard: "Gov Contracts",
      route: `/admin/gov-contracts/${row.opportunity_id}/bid-room`,
      title: "Bid Room approval needs review",
      reason: `Approval status is ${row.approval_status}; submission readiness is ${row.submission_readiness_score ?? 0}%.`,
      recommendedAction: "Review go/no-go, pricing, documents, and approval gate before any bid activity.",
      impact: "Keeps government contract workflow moving without autonomous commitments.",
      urgency: "high",
      status: "needs_review",
      owner: "operations",
      requiresHumanApproval: true,
      createdAt: row.updated_at,
    });
  }

  for (const row of failedWebhooks) {
    items.push({
      id: `failed-webhook-${row.id}`,
      source: "revenue_webhook_events",
      dashboard: "Messaging / Webhooks",
      route: "/admin/inbox",
      title: `${row.provider ?? "Provider"} webhook failed`,
      reason: `${row.event_type ?? "Webhook"} failed processing.`,
      recommendedAction: "Inspect webhook payload and retry or mark resolved.",
      impact: "Protects messaging, reply detection, and automation integrity.",
      urgency: "high",
      status: "blocked",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: row.created_at,
    });
  }

  for (const row of hotSalesLeads) {
    items.push({
      id: `sales-hot-${row.id}`,
      source: "sales_leads",
      dashboard: "Sales",
      route: `/agent/leads/${row.id}`,
      title: `${row.business_name ?? "Sales lead"} is ready for follow-up`,
      reason: `Lead status is ${row.status}; score ${row.score ?? 0}.`,
      recommendedAction: row.status === "payment_sent" ? "Follow up on payment link." : "Call or reply while the lead is warm.",
      impact: "Highest direct revenue impact item in the queue.",
      urgency: row.status === "payment_sent" ? "critical" : "high",
      status: "ready",
      owner: "sales",
      requiresHumanApproval: true,
      createdAt: row.last_reply_at,
    });
  }

  if (procurementSequence.length === 0) {
    items.push({
      id: "procurement-sequence-missing",
      source: "auto_sequences",
      dashboard: "Inventory / Procurement",
      route: "/admin/inbox",
      title: "Procurement email sequence is not visible",
      reason: "No inventory_procurement automation sequence was found.",
      recommendedAction: "Confirm migration 095 is applied and the sequence is active before relying on procurement email automation.",
      impact: "Protects the procurement growth path from silent non-delivery.",
      urgency: "medium",
      status: "blocked",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: nowIso(),
    });
  } else {
    for (const row of procurementSequence.filter((sequence) => sequence.status !== "active")) {
      items.push({
        id: `procurement-sequence-${row.id}`,
        source: "auto_sequences",
        dashboard: "Inventory / Procurement",
        route: "/admin/inbox",
        title: "Procurement email sequence is not active",
        reason: `${row.name ?? "Procurement sequence"} status is ${row.status}.`,
        recommendedAction: "Review sequence settings before sending procurement outreach.",
        impact: "Restores the inventory/procurement email path.",
        urgency: "medium",
        status: "blocked",
        owner: "admin",
        requiresHumanApproval: true,
        createdAt: row.updated_at,
      });
    }
  }

  for (const row of learningInsights) {
    const category = row.category ?? "general";
    const theme = row.theme ? ` / ${row.theme}` : "";
    items.push({
      id: `learning-insight-${row.id}`,
      source: "ci_insights",
      dashboard: "Learning Engine",
      route: "/admin/content-intel",
      title: `Review high-score Learning Engine insight: ${category}${theme}`,
      reason: `APEX ${row.apex_score ?? 0}. ${String(row.insight_text ?? "").slice(0, 180)}`,
      recommendedAction: "Review the insight, approve or reject it, and only then convert it into an internal implementation task.",
      impact: "Turns research into a supervised improvement candidate without changing production automatically.",
      urgency: Number(row.apex_score ?? 0) >= 18 ? "medium" : "low",
      status: "needs_review",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: row.created_at,
    });
  }

  for (const row of learningEnhancements) {
    const isStrategic = row.kind === "strategic";
    items.push({
      id: `learning-enhancement-${row.id}`,
      source: "ci_enhancements",
      dashboard: "Learning Engine",
      route: "/admin/content-intel",
      title: `Evaluate Learning Engine enhancement: ${row.title ?? "Untitled enhancement"}`,
      reason: `${row.category ?? "general"} ${row.kind ?? "enhancement"} idea: ${String(row.description ?? "").slice(0, 180)}`,
      recommendedAction: "Review the enhancement and create an internal implementation task only if it fits the current roadmap.",
      impact: isStrategic
        ? "May improve the AI Workforce OS roadmap after human review."
        : "Creates a safe, additive improvement candidate for the existing ecosystem.",
      urgency: isStrategic ? "medium" : "low",
      status: "needs_review",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: row.created_at,
    });
  }

  for (const row of learningAutomations) {
    items.push({
      id: `learning-automation-${row.id}`,
      source: "ci_automations",
      dashboard: "Learning Engine",
      route: "/admin/content-intel",
      title: `Review automation idea: ${row.title ?? "Untitled automation"}`,
      reason: `Trigger: ${String(row.trigger_desc ?? "").slice(0, 100)}. Action: ${String(row.action_desc ?? "").slice(0, 120)}`,
      recommendedAction: "Validate the automation, confirm safeguards, and create a human-owned implementation task if appropriate.",
      impact: "Improves operational leverage only after approval, testing, and safe rollout.",
      urgency: "low",
      status: "needs_review",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: row.created_at,
    });
  }

  for (const row of promotedLearningActions) {
    items.push({
      id: row.source_key,
      source: row.source,
      dashboard: row.dashboard,
      route: row.route,
      title: row.title,
      reason: row.reason,
      recommendedAction: row.recommended_action,
      impact: row.impact,
      urgency: row.urgency,
      status: row.status,
      owner: row.owner,
      requiresHumanApproval: row.requires_human_approval,
      createdAt: row.source_created_at ?? row.created_at,
      dueAt: row.due_at,
      durableState: row.state,
      snoozedUntil: row.snoozed_until,
      resolvedAt: row.resolved_at,
      resolutionNote: row.resolution_note,
    });
  }

  const sourceFreshness = await readSource("ai_source_freshness", getSourceFreshnessReport, null);
  for (const item of sourceFreshness?.items ?? []) {
    if (!["stale", "missing", "unavailable"].includes(item.status)) continue;

    items.push({
      id: `source-freshness-${item.key}`,
      source: "ai_source_freshness",
      dashboard: "AI Workforce OS",
      route: "/admin/agents",
      title: `${item.label} source is ${item.status}`,
      reason: item.summary,
      recommendedAction: item.nextStep,
      impact: "Keeps AI recommendations grounded in fresh source data before autonomy expands.",
      urgency: item.status === "missing" ? "medium" : "high",
      status: item.status === "unavailable" ? "blocked" : "needs_review",
      owner: "admin",
      requiresHumanApproval: true,
      createdAt: item.lastSeenAt ?? nowIso(),
    });
  }

  const durableItems = await applyDurableActionState(supabase, items, sourceHealth);
  const sorted = sortActions(durableItems).slice(0, limit);
  return { generatedAt: nowIso(), summary: summarize(sorted), items: sorted, sourceHealth };
}

export async function updateUnifiedActionItem(input: UnifiedActionMutationInput) {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      error: "Supabase is not configured for durable action updates.",
    };
  }

  const sourceKey = input.sourceKey?.trim();
  if (!sourceKey) {
    return { ok: false, error: "sourceKey is required." };
  }

  const supabase = createServiceClient();
  const now = nowIso();

  try {
    const { data: existing, error: existingError } = await supabase
      .from("unified_action_items")
      .select("id,source_key,state")
      .eq("source_key", sourceKey)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return {
        ok: false,
        error: "This action has not been generated into the durable queue yet. Refresh the Action Center and try again.",
      };
    }

    const note = input.note?.trim() || null;
    const update: Record<string, any> = { updated_at: now };

    if (input.operation === "resolve") {
      update.state = "resolved";
      update.resolved_at = now;
      update.resolved_by = input.actorId ?? null;
      update.resolution_note = note;
      update.snoozed_until = null;
    } else if (input.operation === "snooze") {
      const requestedSnoozeHours = Number(input.snoozeHours ?? 24);
      const snoozeHours = Number.isFinite(requestedSnoozeHours)
        ? Math.min(Math.max(requestedSnoozeHours, 1), 24 * 30)
        : 24;
      update.state = "snoozed";
      update.snoozed_until = new Date(Date.now() + snoozeHours * 60 * 60 * 1000).toISOString();
    } else if (input.operation === "dismiss") {
      update.state = "dismissed";
      update.resolved_at = now;
      update.resolved_by = input.actorId ?? null;
      update.resolution_note = note;
      update.snoozed_until = null;
    } else if (input.operation === "reopen") {
      update.state = "open";
      update.snoozed_until = null;
      update.resolved_at = null;
      update.resolved_by = null;
      update.resolution_note = null;
    }

    const { error: updateError } = await supabase
      .from("unified_action_items")
      .update(update)
      .eq("source_key", sourceKey);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("unified_action_events").insert({
      action_item_id: existing.id,
      source_key: sourceKey,
      event_type: operationToEventType(input.operation),
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        priorState: existing.state,
        snoozeHours: input.operation === "snooze" ? input.snoozeHours ?? 24 : null,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      sourceKey,
      operation: input.operation,
      state: update.state ?? existing.state,
      snoozedUntil: update.snoozed_until ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sortActions(items: UnifiedActionItem[]) {
  return [...items].sort((a, b) => {
    const urgencyDelta = URGENCY_WEIGHT[b.urgency] - URGENCY_WEIGHT[a.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bCreated - aCreated;
  });
}

async function applyDurableActionState(
  supabase: ReturnType<typeof createServiceClient>,
  items: UnifiedActionItem[],
  sourceHealth: UnifiedActionCenter["sourceHealth"]
) {
  if (items.length === 0) return items;

  try {
    const rows = items.map((item) => ({
      source_key: item.id,
      source: item.source,
      dashboard: item.dashboard,
      route: item.route,
      title: item.title,
      reason: item.reason,
      recommended_action: item.recommendedAction,
      impact: item.impact,
      urgency: item.urgency,
      status: item.status,
      owner: item.owner,
      requires_human_approval: item.requiresHumanApproval,
      source_created_at: item.createdAt ?? null,
      due_at: item.dueAt ?? null,
      last_seen_at: nowIso(),
      source_snapshot: {
        generatedId: item.id,
        generatedAt: nowIso(),
      },
    }));

    const { error: upsertError } = await supabase
      .from("unified_action_items")
      .upsert(rows, { onConflict: "source_key" });

    if (upsertError) throw upsertError;

    const sourceKeys = items.map((item) => item.id);
    const { data: durableRows, error: readError } = await supabase
      .from("unified_action_items")
      .select("id,source_key,state,snoozed_until,resolved_at,resolution_note")
      .in("source_key", sourceKeys);

    if (readError) throw readError;

    const { data: commentRows } = await supabase
      .from("unified_action_events")
      .select("source_key")
      .in("source_key", sourceKeys)
      .eq("event_type", "commented");

    const commentCounts = new Map<string, number>();
    for (const row of commentRows ?? []) {
      if (!row.source_key) continue;
      commentCounts.set(row.source_key, (commentCounts.get(row.source_key) ?? 0) + 1);
    }

    const durableBySource = new Map((durableRows ?? []).map((row) => [row.source_key, row]));
    const now = Date.now();

    sourceHealth.push({ source: "unified_action_items", status: "ok" });

    return items
      .map((item) => {
        const durable = durableBySource.get(item.id);
        if (!durable) return item;

        return {
          ...item,
          durableId: durable.id,
          durableState: durable.state,
          snoozedUntil: durable.snoozed_until,
          resolvedAt: durable.resolved_at,
          resolutionNote: durable.resolution_note,
          commentCount: commentCounts.get(item.id) ?? 0,
        };
      })
      .filter((item) => {
        if (item.durableState === "resolved" || item.durableState === "dismissed" || item.durableState === "archived") {
          return false;
        }
        if (item.durableState === "snoozed" && item.snoozedUntil) {
          return new Date(item.snoozedUntil).getTime() <= now;
        }
        return true;
      });
  } catch (error) {
    sourceHealth.push({
      source: "unified_action_items",
      status: "unavailable",
      note: error instanceof Error ? error.message : String(error),
    });
    return items;
  }
}
