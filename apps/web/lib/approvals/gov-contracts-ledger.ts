import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type GovContractsSyncOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

type GovContractBidRoomLedgerInput = {
  id: string;
  opportunityId: string;
  opportunityTitle?: string | null;
  agency?: string | null;
  bidStage: string;
  approvalStatus: string;
  submissionReadinessScore?: number | null;
  estimatedValueCents?: number | null;
  finalApprovalBy?: string | null;
  finalApprovalAt?: string | null;
  submittedAt?: string | null;
  awardStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type GovContractSubmissionPackageLedgerInput = {
  id: string;
  bidRoomId: string;
  opportunityId: string;
  opportunityTitle?: string | null;
  agency?: string | null;
  packageName: string;
  status: string;
  approvalStatus: string;
  submissionMethod?: string | null;
  deadlineAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function bidRoomApprovalState(input: GovContractBidRoomLedgerInput) {
  const approval = input.approvalStatus.toLowerCase();
  const award = (input.awardStatus ?? "").toLowerCase();
  if (award === "awarded") return "approved";
  if (approval === "approved") return "approved";
  if (approval === "ready_to_submit") return "ready_to_send";
  return "needs_review";
}

function bidRoomLane(input: GovContractBidRoomLedgerInput): ApprovalLedgerPayload["lane"] {
  const approval = input.approvalStatus.toLowerCase();
  if (approval === "approved") return "learning";
  return "needs_approval";
}

function submissionPackageApprovalState(input: GovContractSubmissionPackageLedgerInput) {
  const status = input.status.toLowerCase();
  const approval = input.approvalStatus.toLowerCase();
  if (status === "submitted") return "submitted";
  if (status === "awarded") return "approved";
  if (approval === "approved") return "approved";
  if (approval === "ready_to_submit") return "ready_to_send";
  return "needs_review";
}

function submissionPackageLane(input: GovContractSubmissionPackageLedgerInput): ApprovalLedgerPayload["lane"] {
  const status = input.status.toLowerCase();
  const approval = input.approvalStatus.toLowerCase();
  if (status === "submitted" || status === "awarded") return "learning";
  if (approval === "ready_to_submit") return "ready_to_send";
  return "needs_approval";
}

export async function syncGovContractBidRoomLedger(
  input: GovContractBidRoomLedgerInput,
  options: GovContractsSyncOptions = {},
) {
  const readinessScore = Number(input.submissionReadinessScore ?? 0);
  const payload: ApprovalLedgerPayload = {
    source_key: `gov_contract_bid_rooms:${input.id}:bid_room_review`,
    source_system: "gov_contracts",
    source_table: "gov_contract_bid_rooms",
    source_id: input.id,
    source_href: input.opportunityId
      ? `/admin/gov-contracts/${encodeURIComponent(input.opportunityId)}/bid-room`
      : "/admin/gov-contracts",
    domain: "gov_contracts",
    approval_kind: "bid_room_review",
    title: `Bid room ${input.bidStage.replaceAll("_", " ")}`,
    detail: `Submission readiness ${readinessScore}%. Opportunity ${input.opportunityId}`,
    source_status: input.approvalStatus,
    approval_state: bidRoomApprovalState(input),
    lane: bidRoomLane(input),
    priority: readinessScore >= 70 ? "high" : "normal",
    approval_required: input.approvalStatus.toLowerCase() !== "approved",
    human_approval_required: true,
    sensitive_action: true,
    decided_by: input.finalApprovalBy ?? null,
    decided_at: input.finalApprovalAt ?? input.submittedAt ?? null,
    related_entity_type: "gov_contract_opportunity",
    related_entity_id: input.opportunityId,
    next_action:
      input.approvalStatus.toLowerCase() === "approved"
        ? "Carry the bid forward only through the approved manual submission workflow."
        : "Review bid/no-bid, pricing, compliance, subcontractor, and evidence status before submission readiness advances.",
    guardrail: "Gov Contracts is the canonical approval owner. ContractOS packaging cannot submit, certify, approve pricing, or commit subcontractors.",
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.approvalStatus,
    },
    evidence: {
      opportunity_id: input.opportunityId,
      opportunity_title: input.opportunityTitle ?? null,
      agency: input.agency ?? null,
      bid_stage: input.bidStage,
      submission_readiness_score: readinessScore,
      estimated_value_cents: input.estimatedValueCents ?? null,
      award_status: input.awardStatus ?? null,
      submitted_at: input.submittedAt ?? null,
    },
    metadata: {
      source_label: "Gov Contracts",
      synced_from: "gov_contract_bid_room_workflow",
    },
    source_created_at: input.createdAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? input.finalApprovalBy ?? null,
    actorLabel: options.actorLabel ?? "gov_contract_bid_room_workflow",
    eventType: options.eventType ?? "gov_contract_bid_room_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      bid_stage: input.bidStage,
      approval_status: input.approvalStatus,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "gov_contract_bid_room_workflow",
  });
}

export async function syncGovContractSubmissionPackageLedger(
  input: GovContractSubmissionPackageLedgerInput,
  options: GovContractsSyncOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `gov_contract_submission_packages:${input.id}:submission_package_review`,
    source_system: "gov_contracts",
    source_table: "gov_contract_submission_packages",
    source_id: input.id,
    source_href: input.opportunityId
      ? `/admin/gov-contracts/${encodeURIComponent(input.opportunityId)}/review-packet`
      : "/admin/gov-contracts",
    domain: "gov_contracts",
    approval_kind: "submission_package_review",
    title: input.packageName,
    detail: `Status ${input.status} for opportunity ${input.opportunityId}`,
    source_status: input.approvalStatus,
    approval_state: submissionPackageApprovalState(input),
    lane: submissionPackageLane(input),
    priority: input.approvalStatus === "ready_to_submit" ? "critical" : "high",
    approval_required: input.approvalStatus.toLowerCase() !== "approved" && input.status.toLowerCase() !== "submitted",
    human_approval_required: true,
    sensitive_action: true,
    decided_by: input.approvedBy ?? input.submittedBy ?? null,
    decided_at: input.approvedAt ?? input.submittedAt ?? null,
    related_entity_type: "gov_contract_bid_room",
    related_entity_id: input.bidRoomId,
    channel: input.submissionMethod ?? null,
    next_action:
      input.status.toLowerCase() === "submitted"
        ? "Track agency response, evaluation, and award evidence manually."
        : "Review the packet, deadline, submission method, pricing, and compliance evidence before recording any external submission.",
    guardrail: "This queue records approval state only. It never submits a bid or binds HomeReach.",
    compliance_notes: input.submissionMethod ?? null,
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.approvalStatus,
    },
    evidence: {
      bid_room_id: input.bidRoomId,
      opportunity_id: input.opportunityId,
      opportunity_title: input.opportunityTitle ?? null,
      agency: input.agency ?? null,
      deadline_at: input.deadlineAt ?? null,
      submission_method: input.submissionMethod ?? null,
      estimated_value_label: null,
    },
    metadata: {
      source_label: "Gov Contracts",
      synced_from: "gov_contract_submission_package_workflow",
    },
    due_at: input.deadlineAt ?? null,
    source_created_at: input.createdAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? input.approvedBy ?? input.submittedBy ?? null,
    actorLabel: options.actorLabel ?? "gov_contract_submission_package_workflow",
    eventType: options.eventType ?? "gov_contract_submission_package_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      status: input.status,
      approval_status: input.approvalStatus,
      deadline_at: input.deadlineAt ?? null,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "gov_contract_submission_package_workflow",
  });
}
