import { createServiceClient } from "@/lib/supabase/service";
import { getDashboardAgentMatrix } from "./dashboard-agents";

export type UnifiedActionUrgency = "critical" | "high" | "medium" | "low";
export type UnifiedActionStatus = "needs_review" | "blocked" | "ready" | "watch";

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

  const sorted = sortActions(items).slice(0, limit);
  return { generatedAt: nowIso(), summary: summarize(sorted), items: sorted, sourceHealth };
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
