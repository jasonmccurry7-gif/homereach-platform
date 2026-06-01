import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type FacebookLedgerInput = {
  id: string;
  leadId?: string | null;
  message: string;
  deliveryStatus: string;
  approvalStatus: string;
  source?: string | null;
  proposedAction?: string | null;
  requiresApproval?: boolean | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  sentAt?: string | null;
  errorDetail?: string | null;
  mid?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type FacebookLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function approvalState(input: FacebookLedgerInput) {
  const delivery = input.deliveryStatus.toLowerCase();
  const approval = input.approvalStatus.toLowerCase();
  if (delivery === "failed") return "blocked";
  if (delivery === "sent") return "sent";
  if (approval === "rejected") return "rejected";
  if (approval === "approved") return "approved";
  if (approval === "not_required") return "not_required";
  return "needs_review";
}

function lane(input: FacebookLedgerInput): ApprovalLedgerPayload["lane"] {
  const delivery = input.deliveryStatus.toLowerCase();
  const approval = input.approvalStatus.toLowerCase();
  if (delivery === "failed") return "blocked";
  if (delivery === "sent" || approval === "rejected" || approval === "not_required") return "learning";
  if (approval === "approved") return "ready_to_send";
  return "needs_approval";
}

function title(input: FacebookLedgerInput) {
  const approval = input.approvalStatus.toLowerCase();
  if (approval === "approved") return "Approved Facebook reply";
  if (approval === "rejected") return "Rejected Facebook reply";
  return "Facebook reply needs approval";
}

export async function syncFacebookMessageLedger(
  input: FacebookLedgerInput,
  options: FacebookLedgerOptions = {},
) {
  const statusLabel = `${input.approvalStatus} / ${input.proposedAction ?? input.source ?? "manual review"}`;
  const payload: ApprovalLedgerPayload = {
    source_key: `facebook_messages:${input.id}:facebook_dm`,
    source_system: "facebook",
    source_table: "facebook_messages",
    source_id: input.id,
    source_href: "/admin/facebook",
    domain: "social",
    approval_kind: "facebook_dm",
    title: title(input),
    detail: input.message,
    source_status: statusLabel,
    approval_state: approvalState(input),
    lane: lane(input),
    priority: input.approvalStatus === "approved" || input.approvalStatus === "pending" ? "high" : "normal",
    approval_required: input.approvalStatus !== "not_required" && input.deliveryStatus !== "sent",
    human_approval_required: input.approvalStatus !== "not_required",
    sensitive_action: true,
    decided_by: input.approvedBy ?? options.actorId ?? null,
    decided_at: input.approvedAt ?? input.sentAt ?? null,
    related_entity_type: input.leadId ? "facebook_lead" : null,
    related_entity_id: input.leadId ?? null,
    channel: "facebook_dm",
    provider: "facebook",
    next_action:
      input.deliveryStatus === "failed"
        ? "Review the failed Facebook send, then retry only after the destination issue is clear."
        : input.deliveryStatus === "sent"
          ? "Track reply behavior and next action from the communication ledger."
          : input.approvalStatus === "approved"
            ? "Send only if this specific DM has been human-approved for this lead."
            : "Approve or reject the reply draft before any outbound message.",
    guardrail: "Facebook sends remain one-at-a-time behind approval, reputation, and account controls.",
    compliance_notes: input.errorDetail ?? null,
    action_target: {
      kind: "facebook_draft",
      id: input.id,
      status: statusLabel,
    },
    evidence: {
      source: input.source ?? null,
      proposed_action: input.proposedAction ?? null,
      requires_approval: input.requiresApproval ?? null,
      external_message_id: input.mid ?? null,
      sent_at: input.sentAt ?? null,
    },
    metadata: {
      ...(input.metadata ?? {}),
      source_label: "Facebook Draft",
      synced_from: "facebook_message_workflow",
    },
    source_created_at: input.createdAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "facebook_message_workflow",
    eventType: options.eventType ?? "facebook_message_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      delivery_status: input.deliveryStatus,
      approval_status: input.approvalStatus,
      proposed_action: input.proposedAction ?? null,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "facebook_message_workflow",
  });
}
