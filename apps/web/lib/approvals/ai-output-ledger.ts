import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type AiOutputLedgerInput = {
  id: string;
  title: string;
  agentName?: string | null;
  workflow?: string | null;
  outputType?: string | null;
  approvalStatus: string;
  verificationStatus?: string | null;
  winningOutput?: boolean | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  ownerUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AiOutputLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function laneFor(input: AiOutputLedgerInput) {
  const approvalStatus = input.approvalStatus.toLowerCase();
  const verificationStatus = String(input.verificationStatus ?? "pending").toLowerCase();

  if (approvalStatus === "rejected") return "learning";
  if (approvalStatus === "approved" && verificationStatus === "verified") return "learning";
  return "needs_approval";
}

function approvalStateFor(input: AiOutputLedgerInput) {
  const approvalStatus = input.approvalStatus.toLowerCase();
  if (approvalStatus === "approved") return "approved";
  if (approvalStatus === "rejected") return "rejected";
  if (approvalStatus === "revision_needed") return "revision_needed";
  if (approvalStatus === "archived") return "archived";
  if (approvalStatus === "draft") return "draft";
  return "needs_review";
}

function priorityFor(input: AiOutputLedgerInput) {
  const approvalStatus = input.approvalStatus.toLowerCase();
  const verificationStatus = String(input.verificationStatus ?? "pending").toLowerCase();
  if (approvalStatus === "approved" && verificationStatus !== "verified") return "high";
  return "normal";
}

function nextActionFor(input: AiOutputLedgerInput) {
  const approvalStatus = input.approvalStatus.toLowerCase();
  const verificationStatus = String(input.verificationStatus ?? "pending").toLowerCase();

  if (approvalStatus === "approved" && verificationStatus === "verified") {
    return "Mark as a winning pattern only if it should shape future generation.";
  }
  if (approvalStatus === "rejected") {
    return "Revise the artifact or leave it closed. Execution approval still belongs to the owning workflow.";
  }
  return "Approve, reject, or request revision before the artifact is reused.";
}

function detailFor(input: AiOutputLedgerInput) {
  return `${input.workflow ?? "workflow"} - ${input.outputType ?? "draft"}`;
}

function statusFor(input: AiOutputLedgerInput) {
  return `${input.approvalStatus} / ${input.verificationStatus ?? "pending"}`;
}

function buildPayload(input: AiOutputLedgerInput): ApprovalLedgerPayload {
  const metadata = metadataObject(input.metadata);
  const status = statusFor(input);

  return {
    source_key: `ai_outputs:${input.id}:ai_output_review`,
    source_system: "ai_assets",
    source_table: "ai_outputs",
    source_id: input.id,
    source_href: "/admin/ai-assets",
    domain: "ai_assets",
    approval_kind: "ai_output_review",
    title: input.title,
    detail: detailFor(input),
    source_status: status,
    approval_state: approvalStateFor(input),
    lane: laneFor(input),
    priority: priorityFor(input),
    approval_required: input.approvalStatus.toLowerCase() !== "approved" || String(input.verificationStatus ?? "").toLowerCase() !== "verified",
    human_approval_required: true,
    sensitive_action: false,
    requested_by: input.ownerUserId ?? null,
    related_entity_type: "ai_output",
    related_entity_id: input.id,
    next_action: nextActionFor(input),
    guardrail:
      "AI artifact approval does not authorize outbound use, publishing, charging, pricing changes, or campaign changes.",
    compliance_notes: firstString(metadata.approval_requirement, metadata.safetyBoundary),
    action_target: {
      kind: "ai_output",
      id: input.id,
      status,
      isWinning: Boolean(input.winningOutput),
    },
    evidence: {
      workflow: input.workflow ?? null,
      output_type: input.outputType ?? null,
      verification_status: input.verificationStatus ?? null,
      winning_output: Boolean(input.winningOutput),
    },
    metadata: {
      ...metadata,
      source_label: "AI Assets",
      agent_name: input.agentName ?? null,
      synced_from: "ai_output_workflow",
    },
    source_created_at: input.createdAt ?? input.updatedAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function syncAiOutputLedger(
  input: AiOutputLedgerInput,
  options: AiOutputLedgerOptions = {},
) {
  return syncApprovalLedgerPayload(buildPayload(input), {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "ai_output_workflow",
    eventType: options.eventType ?? "ai_output_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      workflow: input.workflow ?? null,
      output_type: input.outputType ?? null,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "ai_output_workflow",
  });
}
