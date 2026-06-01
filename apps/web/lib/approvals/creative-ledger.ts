import "server-only";

import type { CreativeStudioAsset } from "@/lib/creative-studio/types";
import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type CreativeLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function approvalState(asset: CreativeStudioAsset) {
  if (asset.complianceReviewStatus === "blocked") return "blocked";
  if (asset.approvalStatus === "approved") return "approved";
  if (asset.approvalStatus === "rejected") return "rejected";
  if (asset.approvalStatus === "needs_revision") return "revision_needed";
  return "needs_review";
}

function lane(asset: CreativeStudioAsset): ApprovalLedgerPayload["lane"] {
  if (asset.complianceReviewStatus === "blocked") return "blocked";
  if (asset.approvalStatus === "approved" && asset.complianceReviewStatus === "approved") return "learning";
  return "needs_approval";
}

function priority(asset: CreativeStudioAsset): ApprovalLedgerPayload["priority"] {
  if (asset.complianceReviewStatus === "blocked") return "critical";
  if (asset.approvalStatus === "needs_review" || asset.complianceReviewStatus === "needs_review") return "high";
  return "normal";
}

export async function syncCreativeAssetLedger(
  asset: CreativeStudioAsset,
  options: CreativeLedgerOptions = {},
) {
  const metadataTitle =
    typeof asset.metadata.title === "string" && asset.metadata.title.trim()
      ? asset.metadata.title.trim()
      : null;
  const payload: ApprovalLedgerPayload = {
    source_key: `creative_assets:${asset.id}:creative_review`,
    source_system: "creative_studio",
    source_table: "creative_assets",
    source_id: asset.id,
    source_href: "/admin/creative-studio",
    domain: "creative",
    approval_kind: "creative_review",
    title: metadataTitle ?? `${asset.offerKey} ${asset.assetType.replaceAll("_", " ")}`,
    detail: `${asset.platform} - quality ${asset.qualityScore}/10. ${asset.bestUseCase || asset.recommendedImprovement}`,
    source_status: `${asset.approvalStatus} / compliance ${asset.complianceReviewStatus}`,
    approval_state: approvalState(asset),
    lane: lane(asset),
    priority: priority(asset),
    approval_required: asset.approvalStatus !== "approved" || asset.complianceReviewStatus !== "approved",
    human_approval_required: true,
    sensitive_action: true,
    decided_by: asset.approvalStatus === "approved" ? options.actorId ?? null : null,
    decided_at: asset.approvedAt,
    related_entity_type: asset.campaignId
      ? "marketing_campaign"
      : asset.businessId
        ? "business"
        : asset.candidateId
          ? "candidate"
          : null,
    related_entity_id: asset.campaignId ?? asset.businessId ?? asset.candidateId,
    next_action:
      asset.complianceReviewStatus === "blocked"
        ? "Resolve the compliance blocker before this asset is used in campaigns, proposals, posts, or outreach."
        : "Approve, revise, or block the creative asset before it is used in campaigns, proposals, posts, or outreach.",
    guardrail: "Creative review does not publish, send, mark print-ready, or attach the asset to a live campaign.",
    compliance_notes: asset.notes,
    action_target: {
      kind: "link_only",
      id: asset.id,
      status: `${asset.approvalStatus} / ${asset.complianceReviewStatus}`,
    },
    evidence: {
      offer_key: asset.offerKey,
      asset_type: asset.assetType,
      platform: asset.platform,
      provider_key: asset.providerKey,
      provider_status: asset.providerStatus,
      winning_asset: asset.winningAsset,
      saved_to_campaign: asset.savedToCampaign,
      approval_recommendation: asset.approvalRecommendation,
    },
    metadata: {
      ...asset.metadata,
      source_label: "Creative",
      synced_from: "creative_asset_workflow",
    },
    source_created_at: asset.createdAt,
    source_updated_at: asset.updatedAt,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "creative_asset_workflow",
    eventType: options.eventType ?? "creative_asset_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      offer_key: asset.offerKey,
      asset_type: asset.assetType,
      platform: asset.platform,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "creative_asset_workflow",
  });
}
