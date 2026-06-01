import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type AdTechSyncOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

type AdTechApprovalInput = {
  id: string;
  marketCaptureCampaignId?: string | null;
  digitalTargetingCampaignId?: string | null;
  launchPackageId?: string | null;
  clientId?: string | null;
  clientEmail?: string | null;
  approvalType: string;
  status: string;
  requestedBy?: string | null;
  approverUserId?: string | null;
  approverEmail?: string | null;
  notes?: string | null;
  revisionNotes?: string | null;
  respondedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AdTechLaunchPackageInput = {
  id: string;
  marketCaptureCampaignId?: string | null;
  digitalTargetingCampaignId?: string | null;
  clientId?: string | null;
  clientEmail?: string | null;
  packageName: string;
  packageStatus: string;
  campaignSummary: string;
  readinessScore?: number | null;
  readyStatus?: string | null;
  missingItems?: string[] | null;
  recommendedNextAction?: string | null;
  clientApprovalStatus?: string | null;
  adminApprovalStatus?: string | null;
  approvedForLaunchBy?: string | null;
  approvedForLaunchAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function approvalStateFromApprovalStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "needs_changes") return "revision_needed";
  if (normalized === "question") return "needs_review";
  return "needs_review";
}

function laneFromApprovalStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved" || normalized === "rejected") return "learning";
  return "needs_approval";
}

function approvalStateFromPackageStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "ready_for_launch") return "approved";
  if (normalized === "launch_completed_manually") return "completed";
  if (normalized.includes("blocked")) return "blocked";
  return "needs_review";
}

function laneFromPackageStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "launch_completed_manually") return "learning";
  if (normalized === "ready_for_launch") return "ready_to_publish";
  if (normalized.includes("blocked")) return "blocked";
  return "needs_approval";
}

export async function syncAdTechApprovalLedger(
  input: AdTechApprovalInput,
  options: AdTechSyncOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `campaign_approvals:${input.id}:ad_tech_campaign_approval`,
    source_system: "ad_tech",
    source_table: "campaign_approvals",
    source_id: input.id,
    source_href: "/admin/ad-tech",
    domain: "ad_tech",
    approval_kind: "ad_tech_campaign_approval",
    title: `${input.approvalType.replaceAll("_", " ")} approval`,
    detail: input.notes ?? "Campaign approval requires explicit human review before launch.",
    source_status: input.status,
    approval_state: approvalStateFromApprovalStatus(input.status),
    lane: laneFromApprovalStatus(input.status),
    priority: input.approvalType === "launch_package" ? "high" : "normal",
    approval_required: true,
    human_approval_required: true,
    sensitive_action: true,
    requested_by: input.clientId ?? null,
    decided_by: input.approverUserId ?? null,
    decided_at: input.respondedAt ?? null,
    related_entity_type: "market_capture_campaign",
    related_entity_id: input.marketCaptureCampaignId ?? input.digitalTargetingCampaignId ?? null,
    next_action:
      input.status === "approved"
        ? "Keep the campaign package moving only through the approved manual launch workflow."
        : "Approve, reject, or request changes before any paid launch action advances.",
    guardrail: "Ad-Tech approvals prepare manual launch readiness only. They never authorize automatic paid spend.",
    compliance_notes: input.revisionNotes ?? null,
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.status,
    },
    evidence: {
      approval_type: input.approvalType,
      market_capture_campaign_id: input.marketCaptureCampaignId ?? null,
      digital_targeting_campaign_id: input.digitalTargetingCampaignId ?? null,
      launch_package_id: input.launchPackageId ?? null,
      approver_email: input.approverEmail ?? null,
    },
    metadata: {
      source_label: "Ad-Tech",
      requested_by: input.requestedBy ?? null,
      client_email: input.clientEmail ?? null,
      metadata: asObject(input.metadata),
      synced_from: "ad_tech_campaign_approval_workflow",
    },
    source_created_at: input.createdAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? input.approverUserId ?? null,
    actorLabel: options.actorLabel ?? "ad_tech_campaign_approval_workflow",
    eventType: options.eventType ?? "ad_tech_campaign_approval_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      approval_type: input.approvalType,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "ad_tech_campaign_approval_workflow",
  });
}

export async function syncAdTechLaunchPackageLedger(
  input: AdTechLaunchPackageInput,
  options: AdTechSyncOptions = {},
) {
  const missingItems = asStringArray(input.missingItems);
  const readinessScore = Number(input.readinessScore ?? 0);
  const payload: ApprovalLedgerPayload = {
    source_key: `campaign_launch_packages:${input.id}:ad_tech_launch_package`,
    source_system: "ad_tech",
    source_table: "campaign_launch_packages",
    source_id: input.id,
    source_href: "/admin/ad-tech",
    domain: "ad_tech",
    approval_kind: "ad_tech_launch_package",
    title: input.packageName,
    detail: input.campaignSummary,
    source_status: `${input.packageStatus} / readiness ${readinessScore}`,
    approval_state: approvalStateFromPackageStatus(input.packageStatus),
    lane: laneFromPackageStatus(input.packageStatus),
    priority: readinessScore >= 100 ? "critical" : readinessScore >= 70 ? "high" : "normal",
    approval_required: input.packageStatus !== "launch_completed_manually",
    human_approval_required: true,
    sensitive_action: true,
    requested_by: input.clientId ?? null,
    decided_at: input.approvedForLaunchAt ?? null,
    related_entity_type: "market_capture_campaign",
    related_entity_id: input.marketCaptureCampaignId ?? input.digitalTargetingCampaignId ?? null,
    next_action:
      input.packageStatus === "ready_for_launch"
        ? "Admin may complete the manual launch step only after owner timing and platform checks are confirmed."
        : input.recommendedNextAction ?? "Clear missing launch items before any paid campaign action.",
    guardrail: "Launch packages record manual launch readiness only. They never trigger automatic paid spend.",
    compliance_notes: `${input.clientApprovalStatus ?? "awaiting_approval"} / ${input.adminApprovalStatus ?? "needs_review"}`,
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.packageStatus,
    },
    evidence: {
      market_capture_campaign_id: input.marketCaptureCampaignId ?? null,
      digital_targeting_campaign_id: input.digitalTargetingCampaignId ?? null,
      readiness_score: readinessScore,
      ready_status: input.readyStatus ?? null,
      missing_items: missingItems,
    },
    metadata: {
      source_label: "Ad-Tech",
      client_email: input.clientEmail ?? null,
      client_approval_status: input.clientApprovalStatus ?? null,
      admin_approval_status: input.adminApprovalStatus ?? null,
      approved_for_launch_by: input.approvedForLaunchBy ?? null,
      metadata: asObject(input.metadata),
      synced_from: "ad_tech_launch_package_workflow",
    },
    source_created_at: input.createdAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "ad_tech_launch_package_workflow",
    eventType: options.eventType ?? "ad_tech_launch_package_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      package_status: input.packageStatus,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "ad_tech_launch_package_workflow",
  });
}
