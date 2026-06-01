import "server-only";

import type {
  DailyVideoContentRow,
  DailyVideoPlatformPostRow,
} from "@/lib/daily-content/types";
import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type DailyContentSyncOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

type SocialPublicationRecordLedgerInput = {
  id: string;
  platform: string;
  status: string;
  approvalStatus?: string | null;
  verificationStatus?: string | null;
  externalUrl?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function withSpaces(value: string) {
  return value.replaceAll("_", " ");
}

function dailyVideoApprovalState(video: DailyVideoContentRow) {
  if (video.status === "published") return "published";
  if (video.status === "scheduled") return "scheduled";
  if (video.approval_status === "approved") return "approved";
  if (video.approval_status === "rejected") return "rejected";
  if (video.approval_status === "needs_revision") return "revision_needed";
  return "needs_review";
}

function dailyVideoLane(video: DailyVideoContentRow): ApprovalLedgerPayload["lane"] {
  if (video.status === "published") return "learning";
  return "needs_approval";
}

function dailyPlatformPostApprovalState(post: DailyVideoPlatformPostRow) {
  if (post.status === "published") return "published";
  if (post.status === "scheduled") return "scheduled";
  if (post.status === "manual_publish_ready") return "approved";
  if (post.status === "failed") return "blocked";
  if (post.status === "approved") return "approved";
  return "needs_review";
}

function dailyPlatformPostLane(post: DailyVideoPlatformPostRow): ApprovalLedgerPayload["lane"] {
  if (post.status === "published") return "learning";
  if (post.status === "failed") return "blocked";
  if (post.status === "manual_publish_ready") return "ready_to_publish";
  return "needs_approval";
}

function dailyPlatformPostPriority(post: DailyVideoPlatformPostRow): ApprovalLedgerPayload["priority"] {
  if (post.status === "failed") return "critical";
  if (post.status === "manual_publish_ready") return "high";
  return "normal";
}

function publicationRecordApprovalState(input: SocialPublicationRecordLedgerInput) {
  const status = input.status.toLowerCase();
  if (status === "published") return "published";
  if (status === "failed" || status === "blocked") return "blocked";
  if (status === "scheduled") return "scheduled";
  if ((input.approvalStatus ?? "").toLowerCase() === "approved") return "approved";
  return "needs_review";
}

function publicationRecordLane(input: SocialPublicationRecordLedgerInput): ApprovalLedgerPayload["lane"] {
  const status = input.status.toLowerCase();
  if (status === "published") return "learning";
  if (status === "failed" || status === "blocked") return "blocked";
  if (status === "manual_publish_ready" || status === "scheduled") return "ready_to_publish";
  return "needs_approval";
}

function publicationRecordPriority(input: SocialPublicationRecordLedgerInput): ApprovalLedgerPayload["priority"] {
  const status = input.status.toLowerCase();
  if (status === "failed" || status === "blocked") return "critical";
  if (status === "manual_publish_ready" || status === "scheduled") return "high";
  return "normal";
}

export async function syncDailyVideoApprovalLedger(
  video: DailyVideoContentRow,
  options: DailyContentSyncOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `daily_video_content:${video.id}:content_approval`,
    source_system: "daily_content",
    source_table: "daily_video_content",
    source_id: video.id,
    source_href: "/admin/daily-content",
    domain: "daily_content",
    approval_kind: "content_approval",
    title: video.title,
    detail: `${video.vertical} - ${video.video_hook ?? ""}`,
    source_status: video.status,
    approval_state: dailyVideoApprovalState(video),
    lane: dailyVideoLane(video),
    priority: video.status === "needs_revision" ? "high" : "normal",
    approval_required: video.status !== "published",
    human_approval_required: true,
    sensitive_action: true,
    decided_by: video.approval_status === "approved" ? options.actorId ?? null : null,
    decided_at: video.approved_at,
    related_entity_type: "daily_content_batch",
    related_entity_id: video.content_date,
    next_action:
      video.status === "needs_revision"
        ? "Review revision notes and approve only after the draft is production-ready."
        : video.status === "published"
          ? "Use the published result as evidence only after URLs and downstream metrics are captured."
          : "Approve or request revision before any platform packet is prepared.",
    guardrail: "Approval updates the content record only. It does not publish or schedule externally.",
    compliance_notes: video.rejected_reason,
    action_target: {
      kind: "daily_video",
      id: video.id,
      status: video.status,
    },
    evidence: {
      content_date: video.content_date,
      vertical: video.vertical,
      primary_cta: video.primary_cta,
      scheduled_at: video.scheduled_at,
      published_at: video.published_at,
    },
    metadata: {
      source_label: "Daily Content",
      source_context: video.source_context,
      synced_from: "daily_content_workflow",
    },
    due_at: video.scheduled_at,
    source_created_at: video.created_at,
    source_updated_at: video.updated_at,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "daily_content_workflow",
    eventType: options.eventType ?? "daily_video_content_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      vertical: video.vertical,
      status: video.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "daily_content_workflow",
  });
}

export async function syncDailyPlatformPostLedger(
  post: DailyVideoPlatformPostRow,
  options: DailyContentSyncOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `daily_video_platform_posts:${post.id}:manual_publish_packet`,
    source_system: "daily_content",
    source_table: "daily_video_platform_posts",
    source_id: post.id,
    source_href: "/admin/daily-content",
    domain: "social",
    approval_kind: "manual_publish_packet",
    title: `${withSpaces(post.platform)} post`,
    detail: `Recommended time: ${post.recommended_posting_time ?? "not set"}`,
    source_status: post.status,
    approval_state: dailyPlatformPostApprovalState(post),
    lane: dailyPlatformPostLane(post),
    priority: dailyPlatformPostPriority(post),
    approval_required: post.status !== "published",
    human_approval_required: true,
    sensitive_action: true,
    due_at: post.scheduled_at ?? post.recommended_posting_time ?? null,
    related_entity_type: "daily_video_content",
    related_entity_id: post.video_id,
    next_action:
      post.status === "failed"
        ? "Open the platform post, review failure details, and reset only after the destination issue is clear."
        : post.status === "manual_publish_ready"
          ? "Use the manual packet to post from the approved platform workflow."
          : post.status === "published"
            ? "Capture proof URLs and performance after the manual publish step is complete."
            : "Prepare the manual publish packet after the parent content is approved.",
    guardrail: "Platform actions still require approved source content and destination-specific checks.",
    action_target: {
      kind: "platform_post",
      id: post.id,
      videoId: post.video_id,
      status: post.status,
    },
    evidence: {
      platform: post.platform,
      scheduled_at: post.scheduled_at,
      published_at: post.published_at,
      external_url: post.external_url,
      external_post_id: post.external_post_id,
    },
    metadata: {
      source_label: "Platform Post",
      caption_present: Boolean(post.caption),
      synced_from: "daily_platform_post_workflow",
    },
    source_created_at: post.created_at ?? null,
    source_updated_at: post.updated_at ?? post.created_at ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "daily_platform_post_workflow",
    eventType: options.eventType ?? "daily_platform_post_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      platform: post.platform,
      status: post.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "daily_platform_post_workflow",
  });
}

export async function syncSocialPublicationRecordLedger(
  input: SocialPublicationRecordLedgerInput,
  options: DailyContentSyncOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `social_publication_records:${input.id}:publication_record`,
    source_system: "social_content",
    source_table: "social_publication_records",
    source_id: input.id,
    source_href: "/admin/daily-content",
    domain: "social",
    approval_kind: "publication_record",
    title: `${withSpaces(input.platform)} publication`,
    detail: input.externalUrl ?? "No public URL captured yet",
    source_status: input.status,
    approval_state: publicationRecordApprovalState(input),
    lane: publicationRecordLane(input),
    priority: publicationRecordPriority(input),
    approval_required: input.status !== "published",
    human_approval_required: true,
    sensitive_action: true,
    decided_by: input.approvedBy ?? null,
    decided_at: input.approvedAt ?? null,
    channel: input.platform,
    next_action:
      input.status === "failed" || input.status === "blocked"
        ? "Resolve the destination, approval, or account issue before another publish attempt."
        : input.status === "published"
          ? "Capture proof, external URL, and metrics after the manual publish step is complete."
          : "Capture proof, external URL, and metrics after the manual publish step is complete.",
    guardrail: "Publication records are operational evidence; they do not bypass human approval.",
    compliance_notes: input.verificationStatus ?? null,
    action_target: {
      kind: "link_only",
      id: input.id,
      status: input.status,
    },
    evidence: {
      approval_status: input.approvalStatus ?? null,
      verification_status: input.verificationStatus ?? null,
      scheduled_at: input.scheduledAt ?? null,
      published_at: input.publishedAt ?? null,
      external_url: input.externalUrl ?? null,
    },
    metadata: {
      source_label: "Publication",
      synced_from: "social_publication_record_workflow",
    },
    due_at: input.scheduledAt ?? null,
    source_created_at: input.createdAt ?? null,
    source_updated_at: input.updatedAt ?? input.createdAt ?? null,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "social_publication_record_workflow",
    eventType: options.eventType ?? "social_publication_record_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      platform: input.platform,
      status: input.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "social_publication_record_workflow",
  });
}
