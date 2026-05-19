import { createServiceClient } from "@/lib/supabase/service";
import { getUnifiedActionCenter, type UnifiedActionItem } from "./action-center";

export type AutopilotRiskLevel = "critical" | "high" | "medium" | "low";
export type AutopilotApprovalStatus = "pending" | "approved" | "rejected" | "canceled" | "expired" | "executed";
export type AutopilotDecision = "approve" | "reject" | "comment";

export interface AutopilotApprovalRequest {
  id: string;
  sourceKey: string;
  source: string;
  dashboard: string;
  route: string;
  title: string;
  requestedAction: string;
  expectedImpact: string;
  riskLevel: AutopilotRiskLevel;
  approvalStatus: AutopilotApprovalStatus;
  executionMode: "draft_only" | "human_approval" | "assisted_autopilot" | "full_autopilot";
  executorStatus: "approval_only" | "not_connected" | "ready" | "blocked" | "executed";
  guardrailSummary: string;
  cannotExecuteReason: string;
  requiresHumanApproval: boolean;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  decisionNote?: string | null;
}

export interface AutopilotControlSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  critical: number;
  high: number;
  approvalOnly: number;
}

export interface AutopilotControlCenter {
  generatedAt: string;
  summary: AutopilotControlSummary;
  requests: AutopilotApprovalRequest[];
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
}

function nowIso() {
  return new Date().toISOString();
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function summarize(requests: AutopilotApprovalRequest[]): AutopilotControlSummary {
  return {
    total: requests.length,
    pending: requests.filter((request) => request.approvalStatus === "pending").length,
    approved: requests.filter((request) => request.approvalStatus === "approved").length,
    rejected: requests.filter((request) => request.approvalStatus === "rejected").length,
    critical: requests.filter((request) => request.riskLevel === "critical").length,
    high: requests.filter((request) => request.riskLevel === "high").length,
    approvalOnly: requests.filter((request) => request.executorStatus === "approval_only").length,
  };
}

function riskFromAction(item: UnifiedActionItem): AutopilotRiskLevel {
  if (item.urgency === "critical") return "critical";
  if (item.source === "revenue_message_threads") return "critical";
  if (item.source === "gov_contract_opportunities" || item.source === "gov_contract_bid_rooms") return "high";
  if (item.source === "revenue_message_approval_queue" || item.source === "revenue_ai_suggestions") return "high";
  if (item.source === "revenue_webhook_events") return "high";
  if (item.urgency === "high") return "high";
  if (item.urgency === "low") return "low";
  return "medium";
}

function guardrailForAction(item: UnifiedActionItem) {
  if (item.dashboard.toLowerCase().includes("political") || item.source === "revenue_message_threads") {
    return "Political actions remain human-approved. A reply or approval gate never authorizes autonomous persuasion, proposal, checkout, production, or outreach.";
  }
  if (item.dashboard.toLowerCase().includes("gov")) {
    return "Gov Contracts actions require explicit human approval. No bid submission, pricing, certification claim, subcontractor commitment, or award acceptance is automated.";
  }
  if (item.source === "revenue_message_approval_queue" || item.source === "revenue_ai_suggestions") {
    return "Messaging actions require human review, suppression checks, quiet-hour controls, and provider readiness before any outbound send.";
  }
  if (item.dashboard.toLowerCase().includes("procurement")) {
    return "Procurement actions may recommend savings or smart buys, but no supplier order is placed without owner approval and a connected safe ordering workflow.";
  }
  if (item.dashboard.toLowerCase().includes("sales")) {
    return "Sales actions can approve next-step intent only. Payment links, proposals, and outreach still use existing protected workflows.";
  }
  return "Approval captures operator intent only. Execution stays in the existing dashboard until a safe executor is connected.";
}

function toRequest(row: Record<string, any>): AutopilotApprovalRequest {
  return {
    id: row.id,
    sourceKey: row.source_key,
    source: row.source,
    dashboard: row.dashboard,
    route: row.route,
    title: row.title,
    requestedAction: row.requested_action,
    expectedImpact: row.expected_impact,
    riskLevel: row.risk_level,
    approvalStatus: row.approval_status,
    executionMode: row.execution_mode,
    executorStatus: row.executor_status,
    guardrailSummary: row.guardrail_summary,
    cannotExecuteReason: row.cannot_execute_reason,
    requiresHumanApproval: row.requires_human_approval,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    decisionNote: row.decision_note,
  };
}

export async function getAutopilotControlCenter(limit = 12): Promise<AutopilotControlCenter> {
  const actionCenter = await getUnifiedActionCenter(24);
  const sourceHealth: AutopilotControlCenter["sourceHealth"] = [
    ...actionCenter.sourceHealth,
  ];
  const eligibleActions = actionCenter.items
    .filter((item) => item.requiresHumanApproval)
    .slice(0, 18);

  if (!hasSupabaseEnv()) {
    const generated = eligibleActions.slice(0, limit).map((item) => ({
      id: `generated-${item.id}`,
      sourceKey: item.id,
      source: item.source,
      dashboard: item.dashboard,
      route: item.route,
      title: item.title,
      requestedAction: item.recommendedAction,
      expectedImpact: item.impact,
      riskLevel: riskFromAction(item),
      approvalStatus: "pending" as const,
      executionMode: "human_approval" as const,
      executorStatus: "approval_only" as const,
      guardrailSummary: guardrailForAction(item),
      cannotExecuteReason: "Supabase is not configured, so this request is generated only.",
      requiresHumanApproval: true,
    }));
    sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "unavailable", note: "Supabase env is missing." });
    return { generatedAt: nowIso(), summary: summarize(generated), requests: generated, sourceHealth };
  }

  const supabase = createServiceClient();

  try {
    const rows = eligibleActions.map((item) => ({
      source_key: item.id,
      source: item.source,
      dashboard: item.dashboard,
      route: item.route,
      title: item.title,
      requested_action: item.recommendedAction,
      expected_impact: item.impact,
      risk_level: riskFromAction(item),
      execution_mode: "human_approval",
      executor_status: "approval_only",
      guardrail_summary: guardrailForAction(item),
      cannot_execute_reason:
        "Phase 5 captures human approval only. Execution stays in the existing workflow until a safe executor is connected.",
      requires_human_approval: true,
      last_seen_at: nowIso(),
      source_snapshot: {
        source: item.source,
        dashboard: item.dashboard,
        urgency: item.urgency,
        status: item.status,
        generatedAt: actionCenter.generatedAt,
      },
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ai_autopilot_approval_requests")
        .upsert(rows, { onConflict: "source_key" });
      if (upsertError) throw upsertError;
    }

    const sourceKeys = eligibleActions.map((item) => item.id);
    if (sourceKeys.length === 0) {
      sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "ok" });
      return { generatedAt: nowIso(), summary: summarize([]), requests: [], sourceHealth };
    }

    const { data, error } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("*")
      .in("source_key", sourceKeys)
      .in("approval_status", ["pending", "approved", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "ok" });
    const requests = (data ?? []).map(toRequest);
    return { generatedAt: nowIso(), summary: summarize(requests), requests, sourceHealth };
  } catch (error) {
    sourceHealth.push({
      source: "ai_autopilot_approval_requests",
      status: "unavailable",
      note: error instanceof Error ? error.message : String(error),
    });
    return { generatedAt: nowIso(), summary: summarize([]), requests: [], sourceHealth };
  }
}

export async function decideAutopilotApproval(input: {
  requestId: string;
  decision: AutopilotDecision;
  actorId?: string | null;
  note?: string | null;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured for autopilot approvals." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, error: "requestId is required." };

  const supabase = createServiceClient();
  const note = input.note?.trim() || null;
  const now = nowIso();

  try {
    const { data: existing, error: existingError } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("id,source_key,approval_status")
      .eq("id", requestId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return { ok: false, error: "Approval request not found." };

    const update: Record<string, any> = { updated_at: now };
    let eventType: "approved" | "rejected" | "commented" = "commented";

    if (input.decision === "approve") {
      update.approval_status = "approved";
      update.approved_at = now;
      update.approved_by = input.actorId ?? null;
      update.rejected_at = null;
      update.rejected_by = null;
      update.decision_note = note;
      eventType = "approved";
    } else if (input.decision === "reject") {
      update.approval_status = "rejected";
      update.rejected_at = now;
      update.rejected_by = input.actorId ?? null;
      update.decision_note = note;
      eventType = "rejected";
    }

    const { error: updateError } = await supabase
      .from("ai_autopilot_approval_requests")
      .update(update)
      .eq("id", requestId);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("ai_autopilot_approval_events").insert({
      request_id: existing.id,
      source_key: existing.source_key,
      event_type: eventType,
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        priorStatus: existing.approval_status,
        decision: input.decision,
        executionEnabled: false,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      requestId,
      decision: input.decision,
      executionEnabled: false,
      message: "Decision recorded. No live execution was triggered.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
