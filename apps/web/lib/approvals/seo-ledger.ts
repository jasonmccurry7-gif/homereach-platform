import "server-only";

import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type SeoPageStatus = "draft" | "review" | "approved" | "published" | "archived";

export type SeoPageLedgerInput = {
  id: string;
  slug: string;
  pageType: string;
  status: SeoPageStatus;
  titleTag?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SeoLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function approvalState(status: SeoPageStatus): ApprovalLedgerPayload["approval_state"] {
  if (status === "draft") return "draft";
  if (status === "approved") return "approved";
  if (status === "published") return "published";
  if (status === "archived") return "archived";
  return "needs_review";
}

function lane(status: SeoPageStatus): ApprovalLedgerPayload["lane"] {
  if (status === "approved") return "ready_to_publish";
  if (status === "published" || status === "archived") return "learning";
  return "needs_approval";
}

function priority(status: SeoPageStatus): ApprovalLedgerPayload["priority"] {
  if (status === "approved" || status === "review") return "high";
  return "normal";
}

function nextAction(status: SeoPageStatus) {
  if (status === "approved") {
    return "Publish only after the approved SEO page passes the final quality, inventory, cap, and rate-limit checks.";
  }
  if (status === "published") {
    return "Monitor the live SEO page and keep public claims, CTA integrity, and inventory alignment current.";
  }
  if (status === "archived") {
    return "Keep the archived SEO page out of active promotion unless it is intentionally restored through review.";
  }
  if (status === "review") {
    return "Review the edited SEO page and approve it before any publish action.";
  }
  return "Draft and review the SEO page before it can be approved or published.";
}

export async function syncSeoPageLedger(
  page: SeoPageLedgerInput,
  options: SeoLedgerOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `seo_pages:${page.id}:seo_page_review`,
    source_system: "seo_engine",
    source_table: "seo_pages",
    source_id: page.id,
    source_href: "/admin/seo-engine",
    domain: "seo",
    approval_kind: "seo_page_review",
    title: page.h1?.trim() || page.titleTag?.trim() || `SEO page /${page.slug}`,
    detail: `${page.pageType.replaceAll("_", " ")} page at /${page.slug}${page.metaDescription ? ` - ${page.metaDescription}` : ""}`,
    source_status: page.status,
    approval_state: approvalState(page.status),
    lane: lane(page.status),
    priority: priority(page.status),
    approval_required: page.status !== "published" && page.status !== "archived",
    human_approval_required: page.status !== "published" && page.status !== "archived",
    sensitive_action: true,
    decided_by: page.status === "approved" ? page.approvedBy ?? options.actorId ?? null : null,
    decided_at:
      page.status === "published"
        ? page.publishedAt ?? null
        : page.status === "approved"
          ? page.approvedAt ?? null
          : null,
    related_entity_type: page.categoryId ? "city_category_page" : "city_page",
    related_entity_id: page.categoryId ?? page.cityId ?? null,
    next_action: nextAction(page.status),
    guardrail:
      "SEO review never publishes automatically, changes redirects, or bypasses human approval for public-facing claims.",
    compliance_notes: page.approvalNotes ?? null,
    action_target: {
      kind: "link_only",
      id: page.id,
      status: page.status,
    },
    evidence: {
      slug: page.slug,
      page_type: page.pageType,
      title_tag: page.titleTag ?? null,
      meta_description: page.metaDescription ?? null,
      h1: page.h1 ?? null,
      city_id: page.cityId ?? null,
      category_id: page.categoryId ?? null,
      approved_at: page.approvedAt ?? null,
      published_at: page.publishedAt ?? null,
    },
    metadata: {
      source_label: "SEO",
      synced_from: "seo_page_workflow",
    },
    source_created_at: page.createdAt ?? null,
    source_updated_at: page.updatedAt ?? page.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "seo_page_workflow",
    eventType: options.eventType ?? "seo_page_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      slug: page.slug,
      page_type: page.pageType,
      status: page.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "seo_page_workflow",
  });
}
