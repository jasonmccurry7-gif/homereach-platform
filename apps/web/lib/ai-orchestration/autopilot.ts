import { createServiceClient } from "@/lib/supabase/service";
import { getUnifiedActionCenter, type UnifiedActionItem } from "./action-center";

export type AutopilotRiskLevel = "critical" | "high" | "medium" | "low";
export type AutopilotApprovalStatus = "pending" | "approved" | "rejected" | "canceled" | "expired" | "executed";
export type AutopilotDecision = "approve" | "reject" | "comment";
export type AutopilotExecutorStatus =
  | "approval_only"
  | "not_connected"
  | "ready"
  | "blocked"
  | "executed"
  | "handoff_ready"
  | "handoff_queued";

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
  executorStatus: AutopilotExecutorStatus;
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

function canQueueSafeInternalHandoff(row: {
  risk_level: AutopilotRiskLevel;
  source: string;
  dashboard: string;
}) {
  if (row.risk_level === "critical" || row.risk_level === "high") return false;

  const dashboard = row.dashboard.toLowerCase();
  if (dashboard.includes("political") || dashboard.includes("gov")) return false;

  const blockedSources = new Set([
    "revenue_message_threads",
    "revenue_message_approval_queue",
    "revenue_ai_suggestions",
  ]);
  return !blockedSources.has(row.source);
}

function safeHandoffBlockedReason(row: {
  risk_level: AutopilotRiskLevel;
  source: string;
  dashboard: string;
}) {
  if (row.risk_level === "critical" || row.risk_level === "high") {
    return "High-risk gates require a workflow-specific executor, rollback plan, and second approval before any handoff can be queued.";
  }
  const dashboard = row.dashboard.toLowerCase();
  if (dashboard.includes("political")) {
    return "Political workflows remain manual after approval. The agent may draft support, but it cannot queue political outreach execution.";
  }
  if (dashboard.includes("gov")) {
    return "Gov Contracts workflows remain manual after approval. No bid, pricing, certification, or subcontractor action can be queued here.";
  }
  if (row.source === "revenue_message_threads" || row.source === "revenue_message_approval_queue" || row.source === "revenue_ai_suggestions") {
    return "Messaging workflows require provider, suppression, quiet-hour, and template checks before any execution handoff.";
  }
  return "Ready for a safe internal handoff. This creates an admin work record only and does not touch external systems.";
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
      guardrail_summary: guardrailForAction(item),
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
      .select("id,source_key,approval_status,risk_level,source,dashboard")
      .eq("id", requestId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return { ok: false, error: "Approval request not found." };

    const update: Record<string, any> = { updated_at: now };
    let eventType: "approved" | "rejected" | "commented" = "commented";

    if (input.decision === "approve") {
      const canQueueHandoff = canQueueSafeInternalHandoff(existing);
      update.approval_status = "approved";
      update.approved_at = now;
      update.approved_by = input.actorId ?? null;
      update.rejected_at = null;
      update.rejected_by = null;
      update.decision_note = note;
      update.executor_status = canQueueHandoff ? "handoff_ready" : "approval_only";
      update.cannot_execute_reason = safeHandoffBlockedReason(existing);
      eventType = "approved";
    } else if (input.decision === "reject") {
      update.approval_status = "rejected";
      update.rejected_at = now;
      update.rejected_by = input.actorId ?? null;
      update.decision_note = note;
      update.executor_status = "blocked";
      update.cannot_execute_reason = "Rejected by a human reviewer. Reopen or re-approve before any handoff.";
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
      executorStatus: update.executor_status ?? null,
      cannotExecuteReason: update.cannot_execute_reason ?? null,
      message: "Decision recorded. No live execution was triggered.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function queueAutopilotInternalHandoff(input: {
  requestId: string;
  actorId?: string | null;
  note?: string | null;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured for autopilot handoffs." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, error: "requestId is required." };

  const supabase = createServiceClient();
  const note = input.note?.trim() || null;
  const now = nowIso();

  try {
    const { data: request, error: requestError } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("id,source_key,source,dashboard,route,title,requested_action,expected_impact,risk_level,approval_status,executor_status,guardrail_summary,cannot_execute_reason,source_snapshot")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) return { ok: false, error: "Approval request not found." };
    if (request.approval_status !== "approved") {
      return { ok: false, error: "Only approved gates can be queued for internal handoff." };
    }

    if (!canQueueSafeInternalHandoff(request)) {
      const blockedReason = safeHandoffBlockedReason(request);
      await supabase
        .from("ai_autopilot_approval_requests")
        .update({
          updated_at: now,
          executor_status: "blocked",
          cannot_execute_reason: blockedReason,
        })
        .eq("id", requestId);

      await supabase.from("ai_autopilot_approval_events").insert({
        request_id: request.id,
        source_key: request.source_key,
        event_type: "execution_blocked",
        actor_id: input.actorId ?? null,
        note,
        metadata: {
          reason: blockedReason,
          executionEnabled: false,
        },
      });

      return { ok: false, error: blockedReason };
    }

    const payload = {
      source: request.source,
      dashboard: request.dashboard,
      route: request.route,
      title: request.title,
      requestedAction: request.requested_action,
      expectedImpact: request.expected_impact,
      note,
      sourceSnapshot: request.source_snapshot ?? {},
    };

    const { data: run, error: runError } = await supabase
      .from("ai_autopilot_execution_runs")
      .insert({
        request_id: request.id,
        source_key: request.source_key,
        queued_by: input.actorId ?? null,
        execution_type: "internal_handoff",
        execution_status: "queued",
        executor_key: "safe_internal_handoff_v1",
        action_summary: request.requested_action,
        guardrail_summary:
          "Internal handoff only. No external provider, customer-facing action, payment, procurement order, bid submission, or political outreach was executed.",
        preview_payload: payload,
        metadata: {
          approvalStatus: request.approval_status,
          priorExecutorStatus: request.executor_status,
          queuedFrom: "admin_autopilot_panel",
        },
      })
      .select("id,execution_status")
      .single();

    if (runError) {
      if (runError.code === "23505") {
        return { ok: false, error: "This gate already has an open internal handoff queued." };
      }
      throw runError;
    }

    const { error: updateError } = await supabase
      .from("ai_autopilot_approval_requests")
      .update({
        updated_at: now,
        executor_status: "handoff_queued",
        executor_key: "safe_internal_handoff_v1",
        cannot_execute_reason:
          "Safe internal handoff queued. A human still completes any external workflow from the source dashboard.",
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("ai_autopilot_approval_events").insert({
      request_id: request.id,
      source_key: request.source_key,
      event_type: "execution_queued",
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        executionRunId: run.id,
        executionStatus: run.execution_status,
        executionEnabled: false,
        externalWorkflowTouched: false,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      requestId,
      executionRunId: run.id,
      executorStatus: "handoff_queued" as const,
      executionStatus: run.execution_status,
      executionEnabled: false,
      message: "Safe internal handoff queued. No external workflow was executed.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
