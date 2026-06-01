import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type PoliticalPlanStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "proposal_ready"
  | "production_ready"
  | "archived";

export type PoliticalPlanLedgerInput = {
  id: string;
  agentId: string;
  candidateId: string;
  campaignId?: string | null;
  status: PoliticalPlanStatus;
  planName: string;
  candidateSummary: string;
  recommendedStrategy: string;
  totalHouseholds: number;
  totalEstimatedCostCents: number;
  confidenceScore: number;
  complianceNotes: string[];
  humanApprovedAt?: string | null;
  humanApprovedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PoliticalLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function approvalState(status: PoliticalPlanStatus): ApprovalLedgerPayload["approval_state"] {
  if (status === "draft") return "draft";
  if (status === "needs_review") return "needs_review";
  if (status === "approved" || status === "proposal_ready") return "approved";
  if (status === "production_ready") return "ready_to_publish";
  return "archived";
}

function lane(status: PoliticalPlanStatus): ApprovalLedgerPayload["lane"] {
  if (status === "production_ready") return "ready_to_publish";
  if (status === "archived") return "learning";
  return "needs_approval";
}

function priority(status: PoliticalPlanStatus): ApprovalLedgerPayload["priority"] {
  if (status === "production_ready") return "critical";
  if (status === "needs_review" || status === "approved" || status === "proposal_ready") return "high";
  return "normal";
}

function nextAction(status: PoliticalPlanStatus) {
  if (status === "production_ready") {
    return "Keep political mail in manual production review only after pricing, disclaimer, route, artwork, and payment checks are confirmed.";
  }
  if (status === "proposal_ready") {
    return "Review the approved political plan before converting it into proposal, creative, or production work.";
  }
  if (status === "approved") {
    return "Generate proposal, creative, or production prep only through the remaining human approval gates.";
  }
  if (status === "archived") {
    return "Keep archived political plans out of proposal, outreach, and production workflows unless intentionally restored.";
  }
  return "Review the political launch plan and approve it before any client-facing proposal, outreach, or production handoff.";
}

export async function syncPoliticalPlanLedger(
  plan: PoliticalPlanLedgerInput,
  options: PoliticalLedgerOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `political_mail_launch_plans:${plan.id}:political_mail_plan`,
    source_system: "political",
    source_table: "political_mail_launch_plans",
    source_id: plan.id,
    source_href: "/admin/political",
    domain: "political",
    approval_kind: "political_mail_plan",
    title: plan.planName,
    detail: `${plan.totalHouseholds.toLocaleString()} households - ${plan.recommendedStrategy || plan.candidateSummary}`,
    source_status: plan.status,
    approval_state: approvalState(plan.status),
    lane: lane(plan.status),
    priority: priority(plan.status),
    approval_required: plan.status !== "archived",
    human_approval_required: plan.status !== "archived",
    sensitive_action: true,
    decided_by: plan.humanApprovedBy ?? null,
    decided_at: plan.humanApprovedAt ?? null,
    related_entity_type: plan.campaignId ? "political_campaign" : "candidate",
    related_entity_id: plan.campaignId ?? plan.candidateId,
    next_action: nextAction(plan.status),
    guardrail:
      "Political plans may use geography, timing, costs, logistics, and campaign-provided facts only. They never authorize direct send, production, or prohibited voter profiling.",
    compliance_notes: plan.complianceNotes.join(" | ") || null,
    action_target: {
      kind: "link_only",
      id: plan.id,
      status: plan.status,
    },
    evidence: {
      agent_id: plan.agentId,
      candidate_id: plan.candidateId,
      campaign_id: plan.campaignId ?? null,
      total_households: plan.totalHouseholds,
      total_estimated_cost_cents: plan.totalEstimatedCostCents,
      confidence_score: plan.confidenceScore,
      human_approved_at: plan.humanApprovedAt ?? null,
    },
    metadata: {
      source_label: "Political",
      candidate_id: plan.candidateId,
      campaign_id: plan.campaignId ?? null,
      synced_from: "political_candidate_launch_plan_workflow",
    },
    source_created_at: plan.createdAt,
    source_updated_at: plan.updatedAt,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "political_candidate_launch_plan_workflow",
    eventType: options.eventType ?? "political_plan_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      candidate_id: plan.candidateId,
      campaign_id: plan.campaignId ?? null,
      status: plan.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "political_candidate_launch_plan_workflow",
  });
}
