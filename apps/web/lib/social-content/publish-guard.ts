import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { buildContentHash } from "./hash";

export type SocialPublishAction =
  | "prepare_manual"
  | "schedule_external"
  | "send_external"
  | "mark_published";

export type SocialPublishSource =
  | {
      type: "daily_video_platform_post";
      videoId: string;
      postId: string;
    }
  | {
      type: "ai_output";
      outputId: string;
    }
  | {
      type: "facebook_message";
      messageId: string;
    };

export type SocialPublishDestination = {
  provider: "manual" | "blotato" | "facebook";
  platform?: string;
  channel?: string;
  accountId?: string;
  pageId?: string;
};

export type SocialPublishApproval = {
  source: SocialPublishSource;
  destination: SocialPublishDestination;
  action: SocialPublishAction;
  title: string;
  text: string;
  mediaUrls: string[];
  contentHash: string;
  approvedBy: string | null;
  approvedAt: string | null;
  verificationStatus: "verified" | "not_required";
  metadata: Record<string, unknown>;
};

export class SocialPublishBlockedError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "social_publish_blocked") {
    super(message);
    this.name = "SocialPublishBlockedError";
    this.status = status;
    this.code = code;
  }
}

export async function assertSocialPublishAllowed({
  source,
  destination,
  action,
  actorId,
  text,
  mediaUrls = [],
}: {
  source: SocialPublishSource;
  destination: SocialPublishDestination;
  action: SocialPublishAction;
  actorId?: string | null;
  text?: string;
  mediaUrls?: string[];
}): Promise<SocialPublishApproval> {
  const db = createServiceClient();
  await assertSystemControls(db, { source, destination, action, actorId });

  if (destination.provider !== "manual" && action !== "mark_published") {
    const mode = process.env.SOCIAL_PUBLISHING_MODE?.trim() || "review_only";
    if (mode !== "live") {
      await auditBlocked(source, destination, action, "Social publishing is in review-only mode.", {
        actorId,
        publishingMode: mode,
      });
      throw new SocialPublishBlockedError("Social publishing is in review-only mode.", 409, "review_only_mode");
    }
  }

  if (source.type === "daily_video_platform_post") {
    return assertDailyPlatformPost(db, { source, destination, action, actorId, text, mediaUrls });
  }

  if (source.type === "ai_output") {
    return assertAiOutput(db, { source, destination, action, actorId, text, mediaUrls });
  }

  return assertFacebookMessage(db, { source, destination, action, actorId, text, mediaUrls });
}

async function assertSystemControls(
  db: ReturnType<typeof createServiceClient>,
  {
    source,
    destination,
    action,
    actorId,
  }: {
    source: SocialPublishSource;
    destination: SocialPublishDestination;
    action: SocialPublishAction;
    actorId?: string | null;
  },
) {
  if (action === "prepare_manual" || action === "mark_published") return;

  const { data, error } = await db
    .from("system_controls")
    .select("all_paused,facebook_paused,outreach_test_mode,manual_approval_mode")
    .eq("id", 1)
    .maybeSingle();

  if (error && error.code !== "42P01") {
    await auditBlocked(source, destination, action, "Unable to verify system controls.", {
      actorId,
      error: error.message,
    });
    throw new SocialPublishBlockedError("Unable to verify system controls.", 503, "controls_unavailable");
  }

  const controls = (data ?? {}) as {
    all_paused?: boolean | null;
    facebook_paused?: boolean | null;
    outreach_test_mode?: boolean | null;
  };

  if (controls.all_paused || controls.outreach_test_mode || (destination.provider === "facebook" && controls.facebook_paused)) {
    await auditBlocked(source, destination, action, "Social publishing is paused by system controls.", {
      actorId,
      controls,
    });
    throw new SocialPublishBlockedError("Social publishing is paused by system controls.", 403, "system_paused");
  }
}

async function assertDailyPlatformPost(
  db: ReturnType<typeof createServiceClient>,
  {
    source,
    destination,
    action,
    actorId,
    text,
    mediaUrls,
  }: {
    source: Extract<SocialPublishSource, { type: "daily_video_platform_post" }>;
    destination: SocialPublishDestination;
    action: SocialPublishAction;
    actorId?: string | null;
    text?: string;
    mediaUrls: string[];
  },
): Promise<SocialPublishApproval> {
  const { data: video, error: videoError } = await db
    .from("daily_video_content")
    .select("id,title,approval_status,approved_at,approved_by,primary_cta,vertical,status")
    .eq("id", source.videoId)
    .maybeSingle();

  if (videoError) throw new SocialPublishBlockedError(videoError.message, 500, "daily_video_lookup_failed");
  if (!video) throw new SocialPublishBlockedError("Daily video content was not found.", 404, "daily_video_missing");

  const videoRow = video as {
    title: string;
    approval_status: string | null;
    approved_at: string | null;
    approved_by: string | null;
    primary_cta: string | null;
    vertical: string | null;
    status: string | null;
  };

  if (videoRow.approval_status !== "approved" || !videoRow.approved_at) {
    await auditBlocked(source, destination, action, "Daily content requires a persisted approval before publishing.", {
      actorId,
      approvalStatus: videoRow.approval_status,
      approvedAt: videoRow.approved_at,
    });
    throw new SocialPublishBlockedError("Daily content requires a persisted approval before publishing.", 403, "daily_content_not_approved");
  }

  const { data: post, error: postError } = await db
    .from("daily_video_platform_posts")
    .select("id,platform,caption,hashtags,status,external_url,external_post_id")
    .eq("id", source.postId)
    .eq("video_id", source.videoId)
    .maybeSingle();

  if (postError) throw new SocialPublishBlockedError(postError.message, 500, "platform_post_lookup_failed");
  if (!post) throw new SocialPublishBlockedError("Platform post was not found.", 404, "platform_post_missing");

  const postRow = post as {
    platform: string;
    caption: string;
    hashtags: string[] | null;
    status: string | null;
  };
  const resolvedText = text?.trim() || `${postRow.caption}\n\n${(postRow.hashtags ?? []).join(" ")}`.trim();
  const contentHash = buildContentHash([resolvedText, mediaUrls, postRow.platform, videoRow.primary_cta]);

  return {
    source,
    destination,
    action,
    title: videoRow.title,
    text: resolvedText,
    mediaUrls,
    contentHash,
    approvedBy: videoRow.approved_by,
    approvedAt: videoRow.approved_at,
    verificationStatus: "not_required",
    metadata: {
      platform: postRow.platform,
      post_status: postRow.status,
      video_status: videoRow.status,
      vertical: videoRow.vertical,
    },
  };
}

async function assertAiOutput(
  db: ReturnType<typeof createServiceClient>,
  {
    source,
    destination,
    action,
    actorId,
    text,
    mediaUrls,
  }: {
    source: Extract<SocialPublishSource, { type: "ai_output" }>;
    destination: SocialPublishDestination;
    action: SocialPublishAction;
    actorId?: string | null;
    text?: string;
    mediaUrls: string[];
  },
): Promise<SocialPublishApproval> {
  const { data: output, error } = await db
    .from("ai_outputs")
    .select("id,title,content,approval_status,verification_status")
    .eq("id", source.outputId)
    .maybeSingle();

  if (error) throw new SocialPublishBlockedError(error.message, 500, "ai_output_lookup_failed");
  if (!output) throw new SocialPublishBlockedError("AI output was not found.", 404, "ai_output_missing");

  const row = output as {
    title: string;
    content: string;
    approval_status: string | null;
    verification_status: string | null;
  };
  if (row.approval_status !== "approved" || row.verification_status !== "verified") {
    await auditBlocked(source, destination, action, "AI output must be approved and verified before social publishing.", {
      actorId,
      approvalStatus: row.approval_status,
      verificationStatus: row.verification_status,
    });
    throw new SocialPublishBlockedError("AI output must be approved and verified before social publishing.", 403, "ai_output_not_approved");
  }

  const { data: review } = await db
    .from("ai_output_reviews")
    .select("reviewer_user_id,created_at")
    .eq("output_id", source.outputId)
    .eq("review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const resolvedText = text?.trim() || row.content;
  return {
    source,
    destination,
    action,
    title: row.title,
    text: resolvedText,
    mediaUrls,
    contentHash: buildContentHash([resolvedText, mediaUrls, destination]),
    approvedBy: (review as { reviewer_user_id?: string | null } | null)?.reviewer_user_id ?? null,
    approvedAt: (review as { created_at?: string | null } | null)?.created_at ?? null,
    verificationStatus: "verified",
    metadata: { output_id: source.outputId },
  };
}

async function assertFacebookMessage(
  db: ReturnType<typeof createServiceClient>,
  {
    source,
    destination,
    action,
    actorId,
    text,
    mediaUrls,
  }: {
    source: Extract<SocialPublishSource, { type: "facebook_message" }>;
    destination: SocialPublishDestination;
    action: SocialPublishAction;
    actorId?: string | null;
    text?: string;
    mediaUrls: string[];
  },
): Promise<SocialPublishApproval> {
  const { data: message, error } = await db
    .from("facebook_messages")
    .select("id,message,approval_status,approved_at,sent_by_user_id,delivery_status,lead_id")
    .eq("id", source.messageId)
    .maybeSingle();

  if (error) throw new SocialPublishBlockedError(error.message, 500, "facebook_message_lookup_failed");
  if (!message) throw new SocialPublishBlockedError("Facebook message draft was not found.", 404, "facebook_message_missing");

  const row = message as {
    message: string;
    approval_status: string | null;
    approved_at: string | null;
    sent_by_user_id: string | null;
    delivery_status: string | null;
    lead_id: string | null;
  };

  if (row.approval_status !== "approved" || !row.approved_at) {
    await auditBlocked(source, destination, action, "Facebook draft requires persisted approval before sending.", {
      actorId,
      approvalStatus: row.approval_status,
      approvedAt: row.approved_at,
    });
    throw new SocialPublishBlockedError("Facebook draft requires persisted approval before sending.", 403, "facebook_message_not_approved");
  }

  const resolvedText = text?.trim() || row.message;
  return {
    source,
    destination,
    action,
    title: "Facebook message",
    text: resolvedText,
    mediaUrls,
    contentHash: buildContentHash([resolvedText, mediaUrls, "facebook", row.lead_id]),
    approvedBy: row.sent_by_user_id,
    approvedAt: row.approved_at,
    verificationStatus: "not_required",
    metadata: {
      lead_id: row.lead_id,
      delivery_status: row.delivery_status,
    },
  };
}

async function auditBlocked(
  source: SocialPublishSource,
  destination: SocialPublishDestination,
  action: SocialPublishAction,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await logPlatformAuditEvent({
    actorType: "system",
    module: "social_publishing",
    actionType: `${destination.provider}_${action}_blocked`,
    entityType: source.type,
    entityId: source.type === "daily_video_platform_post" ? source.postId : source.type === "ai_output" ? source.outputId : source.messageId,
    sourceTable:
      source.type === "daily_video_platform_post"
        ? "daily_video_platform_posts"
        : source.type === "ai_output"
          ? "ai_outputs"
          : "facebook_messages",
    sourceId: source.type === "daily_video_platform_post" ? source.postId : source.type === "ai_output" ? source.outputId : source.messageId,
    channel: destination.channel ?? destination.platform ?? null,
    provider: destination.provider,
    resultStatus: "blocked",
    approvalState: "needs_review",
    severity: "high",
    message,
    metadata,
  });
}
