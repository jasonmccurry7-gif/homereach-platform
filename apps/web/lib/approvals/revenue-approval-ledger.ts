import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type RevenueApprovalBusinessLine =
  | "targeted_mailing"
  | "inventory_procurement"
  | "political"
  | "unknown"
  | string;

type RevenueApprovalSyncInput = {
  id: string;
  businessLine: RevenueApprovalBusinessLine;
  channel: string;
  status: string;
  title: string;
  messageBody: string | null;
  metadata?: Record<string, unknown> | null;
  threadId?: string | null;
  suggestionId?: string | null;
  requestedBy?: string | null;
  assignedTo?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  dueAt?: string | null;
};

type RevenueApprovalSyncOptions = {
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

function approvalStateForStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("sent")) return "sent";
  if (normalized.includes("scheduled")) return "scheduled";
  if (normalized.includes("submitted")) return "submitted";
  if (normalized.includes("rejected")) return "rejected";
  if (normalized.includes("revision")) return "revision_needed";
  if (normalized.includes("approved")) return "approved";
  if (normalized.includes("draft")) return "draft";
  return "needs_review";
}

function laneForStatus(status: string, channel: string) {
  const normalizedStatus = status.toLowerCase();
  const normalizedChannel = channel.toLowerCase();

  if (normalizedStatus.includes("blocked")) return "blocked";
  if (normalizedStatus.includes("sent") || normalizedStatus.includes("rejected")) return "learning";
  if (
    (normalizedStatus.includes("approved") || normalizedStatus.includes("scheduled")) &&
    normalizedChannel === "email"
  ) {
    return "ready_to_send";
  }
  return "needs_approval";
}

function priorityFor(input: RevenueApprovalSyncInput) {
  const status = input.status.toLowerCase();
  if (input.businessLine === "political") return "high";
  if (status.includes("approved") || status.includes("scheduled")) return "high";
  return "normal";
}

function domainForBusinessLine(value: RevenueApprovalBusinessLine) {
  if (value === "political") return "political";
  if (value === "inventory_procurement") return "procurement";
  return "revenue";
}

function nextActionFor(input: RevenueApprovalSyncInput) {
  const status = input.status.toLowerCase();
  const channel = input.channel.toLowerCase();

  if ((status.includes("approved") || status.includes("scheduled")) && channel === "email") {
    return "Send only if the owner is ready for this one approved email to go out.";
  }
  if (status.includes("rejected")) {
    return "Revise the draft or leave it closed. No outbound action is authorized from a rejected approval.";
  }
  if (status.includes("sent")) {
    return "Capture delivery, reply, and revenue follow-up results in the communication ledger.";
  }
  return "Review the draft and approve or reject before any customer-facing action.";
}

function evidenceFor(input: RevenueApprovalSyncInput) {
  return {
    thread_id: input.threadId ?? null,
    suggestion_id: input.suggestionId ?? null,
  };
}

function actionTargetFor(input: RevenueApprovalSyncInput) {
  return {
    kind: "revenue_approval",
    id: input.id,
    status: input.status,
    channel: input.channel,
    messageBody: input.messageBody,
  };
}

function policyFlagsFor(input: RevenueApprovalSyncInput, metadata: Record<string, unknown>) {
  const flags = new Set<string>();
  if (input.businessLine === "political") flags.add("political_review_required");
  if (metadata.human_approval_required !== false) flags.add("human_approval_required");
  if (metadata.requires_manual_send === true || metadata.manual_send_only === true) {
    flags.add("manual_send_only");
  }
  if (metadata.auto_send_disabled === true) flags.add("auto_send_disabled");
  return Array.from(flags);
}

function buildPayload(input: RevenueApprovalSyncInput): ApprovalLedgerPayload {
  const metadata = metadataObject(input.metadata);
  const approvalState = approvalStateForStatus(input.status);
  const lane = laneForStatus(input.status, input.channel);
  const decidedAt = firstString(
    metadata.human_approved_at,
    metadata.last_reviewed_at,
    metadata.sent_at,
  );
  const decidedBy = firstString(
    metadata.human_approved_by,
    metadata.reviewed_by,
  );

  return {
    source_key: `revenue_message_approval_queue:${input.id}:outbound_message`,
    source_system: "revenue_messaging",
    source_table: "revenue_message_approval_queue",
    source_id: input.id,
    source_href: "/admin/revenue-operations",
    domain: domainForBusinessLine(input.businessLine),
    approval_kind: "outbound_message",
    title: input.title,
    detail: `${input.businessLine || "revenue"} - ${input.channel || "message"}`,
    source_status: input.status,
    approval_state: approvalState,
    lane,
    priority: priorityFor(input),
    approval_required: approvalState !== "sent" && approvalState !== "rejected",
    human_approval_required: metadata.human_approval_required !== false,
    sensitive_action: true,
    requested_by: input.requestedBy ?? null,
    assigned_to: input.assignedTo ?? null,
    decided_by: decidedBy,
    decided_at: decidedAt,
    related_entity_type: input.threadId ? "revenue_message_thread" : null,
    related_entity_id: input.threadId ?? null,
    channel: input.channel,
    provider: firstString(metadata.provider),
    next_action: nextActionFor(input),
    guardrail:
      "Revenue draft approval is separate from sending and never changes pricing, payments, or campaigns.",
    policy_flags: policyFlagsFor(input, metadata),
    compliance_notes: firstString(
      metadata.approval_required_reason,
      metadata.auto_send_release_note,
      metadata.last_send_blocked_reason,
    ),
    action_target: actionTargetFor(input),
    evidence: evidenceFor(input),
    metadata: {
      ...metadata,
      source_label: "Revenue Approval",
      synced_from: "revenue_approval_workflow",
    },
    due_at: input.dueAt ?? null,
    source_created_at: input.createdAt ?? input.updatedAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function syncRevenueApprovalLedger(
  input: RevenueApprovalSyncInput,
  options: RevenueApprovalSyncOptions = {},
) {
  return syncApprovalLedgerPayload(buildPayload(input), {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "revenue_approval_workflow",
    eventType: options.eventType ?? "revenue_approval_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      business_line: input.businessLine,
      channel: input.channel,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "revenue_approval_workflow",
  });
}
