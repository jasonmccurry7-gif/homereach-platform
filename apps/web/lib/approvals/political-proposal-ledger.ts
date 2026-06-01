import "server-only";

import type { ProposalRow, ProposalStatus } from "@/lib/political/proposals";
import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type PoliticalProposalLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function approvalState(status: ProposalStatus): ApprovalLedgerPayload["approval_state"] {
  if (status === "draft") return "draft";
  if (status === "approved") return "approved";
  if (status === "declined") return "rejected";
  if (status === "expired") return "blocked";
  return "needs_review";
}

function lane(status: ProposalStatus): ApprovalLedgerPayload["lane"] {
  if (status === "approved" || status === "declined" || status === "expired") return "learning";
  return "needs_approval";
}

function priority(status: ProposalStatus): ApprovalLedgerPayload["priority"] {
  if (status === "viewed" || status === "expired") return "high";
  return "normal";
}

function nextAction(status: ProposalStatus) {
  if (status === "approved") {
    return "Move forward only through the approved contract, checkout, and production workflows.";
  }
  if (status === "declined") {
    return "Keep the declined proposal closed unless sales intentionally reworks and resends it.";
  }
  if (status === "expired") {
    return "Refresh the proposal before any new customer-facing approval or payment path is offered.";
  }
  if (status === "viewed") {
    return "Follow up on the viewed proposal without changing pricing, terms, or production assumptions outside review.";
  }
  return "Wait for the campaign to review the proposal before contract, payment, or production steps advance.";
}

export async function syncPoliticalProposalLedger(
  proposal: ProposalRow,
  options: PoliticalProposalLedgerOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `political_proposals:${proposal.id}:political_proposal`,
    source_system: "political",
    source_table: "political_proposals",
    source_id: proposal.id,
    source_href: "/admin/political",
    domain: "political",
    approval_kind: "political_proposal",
    title: `Political proposal ${proposal.id.slice(0, 8)}`,
    detail: `${proposal.households.toLocaleString()} households / ${proposal.drops} drops / ${proposal.totalPieces.toLocaleString()} pieces / ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(proposal.totalInvestmentCents / 100)}`,
    source_status: proposal.status,
    approval_state: approvalState(proposal.status),
    lane: lane(proposal.status),
    priority: priority(proposal.status),
    approval_required: proposal.status === "sent" || proposal.status === "viewed",
    human_approval_required: proposal.status === "sent" || proposal.status === "viewed",
    sensitive_action: true,
    decided_at: proposal.approvedAt ?? proposal.declinedAt ?? null,
    related_entity_type: "political_campaign",
    related_entity_id: proposal.campaignId,
    due_at: proposal.expiresAt,
    next_action: nextAction(proposal.status),
    guardrail:
      "Political proposal approval does not authorize production, pricing changes, payment capture outside approved checkout, or prohibited voter targeting.",
    action_target: {
      kind: "link_only",
      id: proposal.id,
      status: proposal.status,
    },
    evidence: {
      campaign_id: proposal.campaignId,
      candidate_id: proposal.candidateId,
      households: proposal.households,
      drops: proposal.drops,
      total_pieces: proposal.totalPieces,
      total_investment_cents: proposal.totalInvestmentCents,
      internal_margin_cents: proposal.internalMarginCents,
      delivery_window_text: proposal.deliveryWindowText,
      approved_at: proposal.approvedAt,
      declined_at: proposal.declinedAt,
      viewed_at: proposal.viewedAt,
    },
    metadata: {
      source_label: "Political",
      public_token_present: Boolean(proposal.publicToken),
      synced_from: "political_proposal_workflow",
    },
    source_created_at: proposal.createdAt,
    source_updated_at: proposal.updatedAt,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "political_proposal_workflow",
    eventType: options.eventType ?? "political_proposal_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      campaign_id: proposal.campaignId,
      candidate_id: proposal.candidateId,
      status: proposal.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "political_proposal_workflow",
  });
}
