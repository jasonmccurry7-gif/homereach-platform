import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type ProcurementSyncOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

type ProcurementSavingsInput = {
  id: string;
  userId: string;
  title: string;
  summary: string;
  category?: string | null;
  projectedMonthlySavingsCents?: number | null;
  projectedAnnualSavingsCents?: number | null;
  difficulty?: string | null;
  operationalImpact?: string | null;
  confidence?: string | null;
  status: string;
  approvalRequired?: boolean | null;
  relatedSupplierId?: string | null;
  relatedInventoryItemId?: string | null;
  recommendationPayload?: Record<string, unknown> | null;
  auditLog?: Array<Record<string, unknown>> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type ProcurementInvoiceAuditInput = {
  id: string;
  userId: string;
  supplierId?: string | null;
  deliveryId?: string | null;
  invoiceReference?: string | null;
  status: string;
  invoiceTotalCents?: number | null;
  expectedTotalCents?: number | null;
  varianceCents?: number | null;
  issueType?: string | null;
  issueSummary: string;
  recommendedAction: string;
  auditLog?: Array<Record<string, unknown>> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type ProcurementActionRequestInput = {
  id: string;
  userId: string;
  actionType: string;
  title: string;
  status: string;
  estimatedSpendCents?: number | null;
  estimatedSavingsCents?: number | null;
  confidence?: string | null;
  riskScore?: number | null;
  approvalRequired?: boolean | null;
  requestPayload?: Record<string, unknown> | null;
  auditLog?: Array<Record<string, unknown>> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isoString(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function approvalStateFromStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("approve")) return "approved";
  if (normalized.includes("resolved")) return "resolved";
  if (normalized.includes("complete")) return "completed";
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("draft")) return "draft";
  return "needs_review";
}

function laneFromStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("blocked")) return "blocked";
  if (
    normalized.includes("approved") ||
    normalized.includes("rejected") ||
    normalized.includes("resolved") ||
    normalized.includes("completed")
  ) {
    return "learning";
  }
  return "needs_approval";
}

function sourceStatusDetail(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" / ");
}

export async function syncProcurementSavingsLedger(
  input: ProcurementSavingsInput,
  options: ProcurementSyncOptions = {},
) {
  const monthly = Number(input.projectedMonthlySavingsCents ?? 0);
  const approvalRequired = input.approvalRequired !== false;
  const payload: ApprovalLedgerPayload = {
    source_key: `opcopilot_savings_recommendations:${input.id}:savings_recommendation`,
    source_system: "operations_copilot",
    source_table: "opcopilot_savings_recommendations",
    source_id: input.id,
    source_href: "/admin/procurement",
    domain: "procurement",
    approval_kind: "savings_recommendation",
    title: input.title,
    detail: input.summary,
    source_status: input.status,
    approval_state: approvalStateFromStatus(input.status),
    lane: laneFromStatus(input.status),
    priority: monthly >= 50000 ? "high" : "normal",
    approval_required: approvalRequired,
    human_approval_required: approvalRequired,
    sensitive_action: approvalRequired,
    requested_by: input.userId,
    related_entity_type: "procurement_savings_recommendation",
    related_entity_id: input.id,
    next_action: "Review the savings basis and owner impact before recommending any vendor, purchasing, or spend action.",
    guardrail: "Procurement review may recommend but never places orders, switches vendors, or commits spend.",
    compliance_notes: firstString(input.difficulty, input.operationalImpact, input.confidence),
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.status,
    },
    evidence: {
      category: input.category ?? null,
      projected_monthly_savings_cents: monthly,
      projected_annual_savings_cents: Number(input.projectedAnnualSavingsCents ?? monthly * 12),
      confidence: input.confidence ?? null,
      related_supplier_id: input.relatedSupplierId ?? null,
      related_inventory_item_id: input.relatedInventoryItemId ?? null,
    },
    metadata: {
      source_label: "Procurement",
      summary: input.summary,
      recommendation_payload: asObject(input.recommendationPayload),
      audit_log: asArray(input.auditLog),
      synced_from: "procurement_savings_workflow",
    },
    source_created_at: isoString(input.createdAt),
    source_updated_at: isoString(input.updatedAt ?? input.createdAt),
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? input.userId,
    actorLabel: options.actorLabel ?? "procurement_savings_workflow",
    eventType: options.eventType ?? "procurement_savings_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      category: input.category ?? null,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "procurement_savings_workflow",
  });
}

export async function syncProcurementInvoiceAuditLedger(
  input: ProcurementInvoiceAuditInput,
  options: ProcurementSyncOptions = {},
) {
  const variance = Number(input.varianceCents ?? 0);
  const payload: ApprovalLedgerPayload = {
    source_key: `opcopilot_invoice_audits:${input.id}:invoice_audit`,
    source_system: "operations_copilot",
    source_table: "opcopilot_invoice_audits",
    source_id: input.id,
    source_href: "/admin/procurement",
    domain: "procurement",
    approval_kind: "invoice_audit",
    title: input.issueSummary,
    detail: input.recommendedAction,
    source_status: input.status,
    approval_state: approvalStateFromStatus(input.status),
    lane: laneFromStatus(input.status),
    priority: Math.abs(variance) >= 25000 ? "high" : "normal",
    approval_required: true,
    human_approval_required: true,
    sensitive_action: true,
    requested_by: input.userId,
    related_entity_type: "procurement_invoice_audit",
    related_entity_id: input.id,
    next_action: "Confirm invoice details and owner approval before requesting vendor changes, credits, or purchasing action.",
    guardrail: "Invoice review does not dispute charges, approve credits, or change supplier behavior automatically.",
    compliance_notes: input.issueType ?? null,
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.status,
    },
    evidence: {
      invoice_reference: input.invoiceReference ?? null,
      invoice_total_cents: Number(input.invoiceTotalCents ?? 0),
      expected_total_cents: Number(input.expectedTotalCents ?? 0),
      variance_cents: variance,
      supplier_id: input.supplierId ?? null,
      delivery_id: input.deliveryId ?? null,
    },
    metadata: {
      source_label: "Procurement",
      issue_type: input.issueType ?? null,
      audit_log: asArray(input.auditLog),
      synced_from: "procurement_invoice_audit_workflow",
    },
    source_created_at: isoString(input.createdAt),
    source_updated_at: isoString(input.updatedAt ?? input.createdAt),
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? input.userId,
    actorLabel: options.actorLabel ?? "procurement_invoice_audit_workflow",
    eventType: options.eventType ?? "procurement_invoice_audit_synced",
    eventNotes: options.eventNotes,
    eventMetadata: options.eventMetadata,
    syncSource: "procurement_invoice_audit_workflow",
  });
}

export async function syncProcurementActionRequestLedger(
  input: ProcurementActionRequestInput,
  options: ProcurementSyncOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `opcopilot_action_requests:${input.id}:procurement_action_request`,
    source_system: "operations_copilot",
    source_table: "opcopilot_action_requests",
    source_id: input.id,
    source_href: "/admin/procurement",
    domain: "procurement",
    approval_kind: "procurement_action_request",
    title: input.title,
    detail: sourceStatusDetail([
      input.actionType,
      input.confidence ? `confidence ${input.confidence}` : null,
      typeof input.riskScore === "number" ? `risk ${input.riskScore}` : null,
    ]),
    source_status: input.status,
    approval_state: approvalStateFromStatus(input.status),
    lane: laneFromStatus(input.status),
    priority: Number(input.estimatedSpendCents ?? 0) >= 100000 || Number(input.riskScore ?? 0) >= 75 ? "high" : "normal",
    approval_required: input.approvalRequired !== false,
    human_approval_required: input.approvalRequired !== false,
    sensitive_action: true,
    requested_by: input.userId,
    related_entity_type: "procurement_action_request",
    related_entity_id: input.id,
    next_action: input.status === "approved"
      ? "Carry the owner-approved procurement action forward through the manual workflow."
      : "Approve or reject the action request before any spend-sensitive action advances.",
    guardrail: "Procurement action requests may recommend owner actions but do not place orders or commit spend.",
    compliance_notes: firstString(input.confidence, typeof input.riskScore === "number" ? `risk ${input.riskScore}` : null),
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.status,
    },
    evidence: {
      action_type: input.actionType,
      estimated_spend_cents: Number(input.estimatedSpendCents ?? 0),
      estimated_savings_cents: Number(input.estimatedSavingsCents ?? 0),
      risk_score: Number(input.riskScore ?? 0),
    },
    metadata: {
      source_label: "Procurement",
      request_payload: asObject(input.requestPayload),
      audit_log: asArray(input.auditLog),
      synced_from: "procurement_action_request_workflow",
    },
    source_created_at: isoString(input.createdAt),
    source_updated_at: isoString(input.updatedAt ?? input.createdAt),
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? input.userId,
    actorLabel: options.actorLabel ?? "procurement_action_request_workflow",
    eventType: options.eventType ?? "procurement_action_request_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      action_type: input.actionType,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "procurement_action_request_workflow",
  });
}
