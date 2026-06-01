import { createServiceClient } from "@/lib/supabase/service";
import {
  syncDailyPlatformPostLedger,
  syncDailyVideoApprovalLedger,
} from "@/lib/approvals/daily-content-ledger";
import { assertSocialPublishAllowed } from "@/lib/social-content/publish-guard";
import { upsertContentAssetFromDailyVideo } from "@/lib/social-content/library";
import { syncDailyPlatformPublicationRecord } from "@/lib/social-content/publication-records";
import { buildDailyContentMarketingIntelligence } from "@/lib/marketing-intelligence/performance";
import type { MarketingContentIntelligence } from "@/lib/marketing-intelligence/types";
import { loadDailyContentGenerationContext } from "./context";
import { buildDailyVideoDrafts, platformList } from "./generator";
import type { HiggsfieldRenderResult } from "./higgsfield";
import type {
  DailyVideoContentRow,
  DailyVideoDraft,
  DailyVideoPlatformPostRow,
  DailyVideoStatus,
} from "./types";

export type DailyContentSummary = {
  contentDate: string;
  videos: DailyVideoContentRow[];
  platformPosts: DailyVideoPlatformPostRow[];
  generatedCount: number;
  approvalCount: number;
  scheduledCount: number;
  publishedCount: number;
  totalViews: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalDms: number;
  totalLeads: number;
  totalConversions: number;
  intelligence: Record<string, MarketingContentIntelligence>;
  readiness: Array<{ label: string; status: "Ready" | "Needs Setup" | "Manual Fallback"; detail: string }>;
};

export async function getDailyContentSummary(contentDate: string): Promise<DailyContentSummary> {
  const supabase = createServiceClient();
  const activePlatforms = activeDailyPlatforms();

  const { data: videos, error: videoError } = await supabase
    .from("daily_video_content")
    .select("*")
    .eq("content_date", contentDate)
    .in("vertical", ["procurement", "targeted_postcard"])
    .order("vertical", { ascending: true });

  if (videoError) {
    throw new Error(videoError.message);
  }

  const ids = (videos ?? []).map((video) => video.id);
  const { data: platformPosts, error: postError } = ids.length
    ? await supabase
        .from("daily_video_platform_posts")
        .select("*")
        .in("video_id", ids)
        .in("platform", activePlatforms)
        .order("platform", { ascending: true })
    : { data: [], error: null };

  if (postError) {
    throw new Error(postError.message);
  }

  const { data: metrics, error: metricsError } = ids.length
    ? await supabase
        .from("daily_video_metrics")
        .select("video_id,views,likes,comments,shares,saves,dms_generated,leads_generated,conversions_generated")
        .in("video_id", ids)
    : { data: [], error: null };

  if (metricsError) {
    throw new Error(metricsError.message);
  }

  const { data: baselineMetrics, error: baselineMetricsError } = await supabase
    .from("daily_video_metrics")
    .select("video_id,views,likes,comments,shares,saves,dms_generated,leads_generated,conversions_generated")
    .gte("metric_date", recentMetricStartDate())
    .order("metric_date", { ascending: false })
    .limit(600);

  if (baselineMetricsError) {
    throw new Error(baselineMetricsError.message);
  }

  const rows = (videos ?? []) as DailyVideoContentRow[];
  const intelligence = buildDailyContentMarketingIntelligence({
    videos: rows,
    currentMetrics: metrics ?? [],
    baselineMetrics: baselineMetrics ?? [],
  });

  return {
    contentDate,
    videos: rows,
    platformPosts: (platformPosts ?? []) as DailyVideoPlatformPostRow[],
    generatedCount: rows.length,
    approvalCount: rows.filter((video) => video.status === "awaiting_approval" || video.approval_status === "pending").length,
    scheduledCount: rows.filter((video) => video.status === "scheduled").length,
    publishedCount: rows.filter((video) => video.status === "published").length,
    totalViews: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.views ?? 0), 0),
    totalComments: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.comments ?? 0), 0),
    totalShares: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.shares ?? 0), 0),
    totalSaves: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.saves ?? 0), 0),
    totalDms: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.dms_generated ?? 0), 0),
    totalLeads: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.leads_generated ?? 0), 0),
    totalConversions: (metrics ?? []).reduce((sum, metric) => sum + Number(metric.conversions_generated ?? 0), 0),
    intelligence,
    readiness: buildPublishingReadiness(),
  };
}

function recentMetricStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 60);
  return date.toISOString().slice(0, 10);
}

type GenerateDailyContentOptions = {
  forceFresh?: boolean;
  variationSeed?: string;
};

export async function generateDailyContent(contentDate: string, options: GenerateDailyContentOptions = {}) {
  const supabase = createServiceClient();
  const generationContext = await loadDailyContentGenerationContext();
  const drafts = buildDailyVideoDrafts(contentDate, generationContext, {
    variationSeed: options.forceFresh ? options.variationSeed ?? new Date().toISOString() : undefined,
  });
  const upserted: DailyVideoContentRow[] = [];

  for (const draft of drafts) {
    const payload = toRowPayload(draft);
    const { data: existingDraft, error: existingDraftError } = await supabase
      .from("daily_video_content")
      .select("*")
      .eq("content_date", draft.contentDate)
      .eq("vertical", draft.vertical)
      .maybeSingle();

    if (existingDraftError) {
      throw new Error(existingDraftError.message);
    }

    if (existingDraft && !options.forceFresh) {
      upserted.push(existingDraft as DailyVideoContentRow);
      continue;
    }

    const upsertPayload = {
      ...payload,
      canva_job: {},
    };
    const { data, error } = await supabase
      .from("daily_video_content")
      .upsert(upsertPayload, { onConflict: "content_date,vertical" })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const video = data as DailyVideoContentRow;
    upserted.push(video);

    const platformRows = platformList().map(({ platform }) => ({
      video_id: video.id,
      platform,
      status: "draft",
      caption: draft.platformPosts[platform],
      hashtags: draft.hashtags,
      thumbnail_concept: draft.thumbnailConcept,
      recommended_posting_time: draft.suggestedPostingTimes[platform],
      checklist: draft.manualPublishChecklist,
    }));

    const { data: syncedPosts, error: postError } = await supabase
      .from("daily_video_platform_posts")
      .upsert(platformRows, { onConflict: "video_id,platform" })
      .select("*");

    if (postError) {
      throw new Error(postError.message);
    }

    await logDailyContentActivity(video.id, "system", "generate_daily_video", "success", `${video.title} generated.`, {
      vertical: video.vertical,
      content_date: contentDate,
      approved_content_intel_count: generationContext.contentIntel.length,
      verified_ai_output_count: generationContext.aiOutputs.length,
      force_fresh: options.forceFresh ?? false,
    });
    const videoLedgerResult = await syncDailyVideoApprovalLedger(video, {
      actorLabel: "daily_content_generator",
      eventType: "daily_video_generated",
    });
    if (!videoLedgerResult.ok) {
      console.warn("[approval-ledger] daily video generate sync skipped:", videoLedgerResult.error);
    }
    for (const syncedPost of (syncedPosts ?? []) as DailyVideoPlatformPostRow[]) {
      const platformLedgerResult = await syncDailyPlatformPostLedger(syncedPost, {
        actorLabel: "daily_content_generator",
        eventType: "daily_platform_post_generated",
      });
      if (!platformLedgerResult.ok) {
        console.warn("[approval-ledger] daily platform post generate sync skipped:", platformLedgerResult.error);
      }
    }
    await upsertContentAssetFromDailyVideo(video, draft);
  }

  return upserted;
}

export async function updateDailyVideoStatus({
  videoId,
  action,
  reason,
  scheduledAt,
  actorId,
}: {
  videoId: string;
  action: "approve" | "reject" | "needs_revision" | "schedule" | "mark_published" | "reset";
  reason?: string;
  scheduledAt?: string;
  actorId?: string;
}) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data: existingVideo, error: existingError } = await supabase
    .from("daily_video_content")
    .select("*")
    .eq("id", videoId)
    .single();

  if (existingError) throw new Error(existingError.message);

  const currentVideo = existingVideo as DailyVideoContentRow;
  if (action === "approve" && requiresRenderedVideoBeforeApproval() && !hasPlayableVideoAsset(currentVideo.canva_job)) {
    await logDailyContentActivity(videoId, "admin", action, "blocked", `${currentVideo.title}: rendered video review is required before approval.`, {
      approval_status: currentVideo.approval_status,
      actor_id: actorId,
      provider_required: "higgsfield",
    });
    throw new Error("Render and review the AI b-roll video before approving this draft.");
  }

  if ((action === "schedule" || action === "mark_published") && currentVideo.approval_status !== "approved") {
    await logDailyContentActivity(videoId, "admin", action, "blocked", `${currentVideo.title}: approval is required before ${action.replaceAll("_", " ")}.`, {
      approval_status: currentVideo.approval_status,
      actor_id: actorId,
    });
    throw new Error("Daily content must be approved before it can be scheduled or marked published.");
  }

  if (action === "mark_published") {
    await logDailyContentActivity(videoId, "admin", action, "blocked", `${currentVideo.title}: use per-platform publish records with a public URL or post ID.`, {
      actor_id: actorId,
    });
    throw new Error("Use per-platform publish records with a public URL or post ID before marking content published.");
  }

  const update: Partial<DailyVideoContentRow> & {
    status?: DailyVideoStatus;
    approval_status?: "pending" | "approved" | "rejected" | "needs_revision";
    approved_by?: string;
  } = {};

  if (action === "approve") {
    update.status = "approved";
    update.approval_status = "approved";
    update.approved_at = now;
    if (actorId) update.approved_by = actorId;
  } else if (action === "reject") {
    update.status = "rejected";
    update.approval_status = "rejected";
    update.rejected_reason = reason ?? "Rejected in AI Reel Command Center.";
  } else if (action === "needs_revision") {
    update.status = "needs_revision";
    update.approval_status = "needs_revision";
    update.rejected_reason = reason ?? "Revision requested in AI Reel Command Center.";
  } else if (action === "schedule") {
    update.status = "scheduled";
    update.scheduled_at = scheduledAt ?? now;
  } else {
    update.status = "awaiting_approval";
    update.approval_status = "pending";
    update.rejected_reason = null;
  }

  const { data, error } = await supabase
    .from("daily_video_content")
    .update(update)
    .eq("id", videoId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const video = data as DailyVideoContentRow;
  if (["approve", "schedule"].includes(action)) {
    const { data: syncedPosts, error: postSyncError } = await supabase
      .from("daily_video_platform_posts")
      .update({
        status:
          action === "approve"
            ? "approved"
            : "scheduled",
        scheduled_at: action === "schedule" ? (scheduledAt ?? now) : undefined,
      })
      .eq("video_id", videoId)
      .select("*");

    if (postSyncError) throw new Error(postSyncError.message);

    for (const syncedPost of (syncedPosts ?? []) as DailyVideoPlatformPostRow[]) {
      const platformLedgerResult = await syncDailyPlatformPostLedger(syncedPost, {
        actorId: actorId ?? null,
        actorLabel: "daily_content_admin",
        eventType: action === "approve" ? "daily_platform_post_approved" : "daily_platform_post_scheduled",
      });
      if (!platformLedgerResult.ok) {
        console.warn("[approval-ledger] daily platform post status sync skipped:", platformLedgerResult.error);
      }
    }
  }

  await logDailyContentActivity(videoId, "admin", action, "success", `${video.title}: ${action.replaceAll("_", " ")}.`, {
    reason,
    scheduled_at: scheduledAt,
  });
  const videoLedgerResult = await syncDailyVideoApprovalLedger(video, {
    actorId: actorId ?? null,
    actorLabel: "daily_content_admin",
    eventType: `daily_video_${action}`,
  });
  if (!videoLedgerResult.ok) {
    console.warn("[approval-ledger] daily video status sync skipped:", videoLedgerResult.error);
  }

  return video;
}

export async function updateDailyPlatformPostStatus({
  videoId,
  postId,
  action,
  scheduledAt,
  externalUrl,
  externalPostId,
  actorId,
}: {
  videoId: string;
  postId: string;
  action: "manual_publish_ready" | "schedule" | "mark_published" | "fail" | "reset";
  scheduledAt?: string;
  externalUrl?: string;
  externalPostId?: string;
  actorId?: string;
}) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: videoData, error: videoError } = await supabase
    .from("daily_video_content")
    .select("*")
    .eq("id", videoId)
    .single();

  if (videoError) throw new Error(videoError.message);

  const video = videoData as DailyVideoContentRow;

  const { data: postData, error: postError } = await supabase
    .from("daily_video_platform_posts")
    .select("*")
    .eq("id", postId)
    .eq("video_id", videoId)
    .single();

  if (postError) throw new Error(postError.message);

  const post = postData as DailyVideoPlatformPostRow;
  const requiresApproval = action === "manual_publish_ready" || action === "schedule" || action === "mark_published";
  const approval = requiresApproval
    ? await assertSocialPublishAllowed({
        source: { type: "daily_video_platform_post", videoId, postId },
        destination: { provider: "manual", platform: post.platform },
        action: action === "manual_publish_ready" ? "prepare_manual" : action === "schedule" ? "prepare_manual" : "mark_published",
        actorId,
      })
    : null;
  const url = normalizeExternalUrl(externalUrl);
  const cleanPostId = externalPostId?.trim() || null;
  if (action === "mark_published" && !url && !cleanPostId) {
    await logDailyContentActivity(videoId, "admin", "platform_mark_published", "blocked", `${platformLabel(post.platform)} needs a public URL or post ID before publish confirmation.`, {
      post_id: postId,
      actor_id: actorId,
    });
    throw new Error("Add the platform URL or external post ID before marking this post published.");
  }

  const update: Partial<DailyVideoPlatformPostRow> = {};
  if (action === "manual_publish_ready") {
    update.status = "manual_publish_ready";
  } else if (action === "schedule") {
    update.status = "scheduled";
    update.scheduled_at = scheduledAt ?? now;
  } else if (action === "mark_published") {
    update.status = "published";
    update.published_at = now;
    update.external_url = url;
    update.external_post_id = cleanPostId;
  } else if (action === "fail") {
    update.status = "failed";
  } else {
    update.status = video.approval_status === "approved" ? "approved" : "draft";
    update.scheduled_at = null;
    update.published_at = null;
    update.external_url = null;
    update.external_post_id = null;
  }

  const { data: updatedPostData, error: updateError } = await supabase
    .from("daily_video_platform_posts")
    .update(update)
    .eq("id", postId)
    .eq("video_id", videoId)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message);

  const updatedPost = updatedPostData as DailyVideoPlatformPostRow;
  const postLedgerResult = await syncDailyPlatformPostLedger(updatedPost, {
    actorId: actorId ?? null,
    actorLabel: "daily_content_admin",
    eventType: `daily_platform_post_${action}`,
  });
  if (!postLedgerResult.ok) {
    console.warn("[approval-ledger] daily platform post action sync skipped:", postLedgerResult.error);
  }
  const rolledUpVideo = await rollupDailyVideoPlatformStatus(videoId);
  const publicationStatus =
    updatedPost.status === "manual_publish_ready" ||
    updatedPost.status === "scheduled" ||
    updatedPost.status === "published" ||
    updatedPost.status === "failed"
      ? updatedPost.status
      : "draft";
  await syncDailyPlatformPublicationRecord({
    video: rolledUpVideo ?? video,
    post: updatedPost,
    approval,
    status: publicationStatus,
    externalUrl: url,
    externalPostId: cleanPostId,
    scheduledAt: updatedPost.scheduled_at,
    publishedAt: updatedPost.published_at,
  });
  if (rolledUpVideo) {
    const videoLedgerResult = await syncDailyVideoApprovalLedger(rolledUpVideo, {
      actorId: actorId ?? null,
      actorLabel: "daily_content_admin",
      eventType: "daily_video_platform_rollup",
    });
    if (!videoLedgerResult.ok) {
      console.warn("[approval-ledger] daily video rollup sync skipped:", videoLedgerResult.error);
    }
  }
  await logDailyContentActivity(videoId, "admin", `platform_${action}`, "success", `${platformLabel(post.platform)}: ${action.replaceAll("_", " ")}.`, {
    post_id: postId,
    platform: post.platform,
    scheduled_at: scheduledAt,
    external_url: url,
    external_post_id: cleanPostId,
    actor_id: actorId,
  });

  return updatedPost;
}

export async function saveCanvaJobResult(videoId: string, canvaJob: Record<string, unknown>) {
  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("daily_video_content")
    .select("canva_job")
    .eq("id", videoId)
    .single();

  if (existingError) throw new Error(existingError.message);

  const currentJob = asRecord(existing?.canva_job);
  const nextJob = {
    ...currentJob,
    canva: canvaJob,
    canva_updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("daily_video_content")
    .update({ canva_job: nextJob })
    .eq("id", videoId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await logDailyContentActivity(videoId, "system", "canva_job_prepared", "success", "Canva job plan prepared.", canvaJob);
  return data as DailyVideoContentRow;
}

export async function saveHiggsfieldRenderResult(videoId: string, result: HiggsfieldRenderResult) {
  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("daily_video_content")
    .select("canva_job")
    .eq("id", videoId)
    .single();

  if (existingError) throw new Error(existingError.message);

  const currentJob = asRecord(existing?.canva_job);
  const history = Array.isArray(currentJob.higgsfield_history) ? currentJob.higgsfield_history : [];
  const nextJob = {
    ...currentJob,
    higgsfield: result,
    higgsfield_history: [
      ...history.slice(-9),
      {
        requestId: result.requestId,
        providerJobId: result.providerJobId,
        providerStatus: result.providerStatus,
        fileUrl: result.fileUrl,
        ok: result.ok,
        dryRun: result.dryRun,
        completedAt: result.completedAt,
        error: result.error ?? null,
      },
    ],
  };

  const { data, error } = await supabase
    .from("daily_video_content")
    .update({ canva_job: nextJob })
    .eq("id", videoId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await logDailyContentActivity(
    videoId,
    "system",
    result.ok ? "higgsfield_video_rendered" : result.dryRun ? "higgsfield_render_dry_run" : "higgsfield_render_failed",
    result.ok || result.dryRun ? "success" : "failed",
    result.ok
      ? "Higgsfield video render completed and is ready for review."
      : result.dryRun
        ? "Higgsfield render prompt prepared in dry-run mode."
        : "Higgsfield video render failed.",
    {
      provider: result.provider,
      request_id: result.requestId,
      provider_job_id: result.providerJobId,
      provider_status: result.providerStatus,
      file_url_present: Boolean(result.fileUrl),
      error: result.error ?? null,
    },
  );
  return data as DailyVideoContentRow;
}

async function rollupDailyVideoPlatformStatus(videoId: string) {
  const supabase = createServiceClient();
  const { data: posts, error } = await supabase
    .from("daily_video_platform_posts")
    .select("status")
    .eq("video_id", videoId)
    .in("platform", activeDailyPlatforms());

  if (error || !posts?.length) return;

  const statuses = posts.map((post) => String(post.status));
  if (statuses.every((status) => status === "published")) {
    const { data } = await supabase
      .from("daily_video_content")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", videoId)
      .eq("approval_status", "approved")
      .select("*")
      .maybeSingle();
    return (data as DailyVideoContentRow | null) ?? null;
  }

  if (statuses.some((status) => status === "scheduled")) {
    const { data } = await supabase
      .from("daily_video_content")
      .update({ status: "scheduled" })
      .eq("id", videoId)
      .eq("approval_status", "approved")
      .select("*")
      .maybeSingle();
    return (data as DailyVideoContentRow | null) ?? null;
  }

  return null;
}

function normalizeExternalUrl(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function requiresRenderedVideoBeforeApproval() {
  return process.env.DAILY_CONTENT_REQUIRE_RENDERED_VIDEO_APPROVAL !== "false";
}

function hasPlayableVideoAsset(value: unknown) {
  return collectUrls(value).some((url) => /\.(mp4|mov|webm)(\?|#|$)/i.test(url) || /video|render|download|export/i.test(url));
}

function collectUrls(value: unknown): string[] {
  const urls = new Set<string>();
  function walk(input: unknown) {
    if (!input) return;
    if (typeof input === "string") {
      const matches = input.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
      matches.forEach((url) => urls.add(url.replace(/[),.;]+$/, "")));
      return;
    }
    if (Array.isArray(input)) {
      input.forEach(walk);
      return;
    }
    if (typeof input === "object") {
      Object.values(input as Record<string, unknown>).forEach(walk);
    }
  }
  walk(value);
  return [...urls];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function platformLabel(platform: DailyVideoPlatformPostRow["platform"]) {
  return platform.replaceAll("_", " ");
}

function activeDailyPlatforms() {
  return platformList().map(({ platform }) => platform);
}

async function logDailyContentActivity(
  videoId: string | null,
  actorType: "system" | "admin" | "ai_agent",
  actionType: string,
  resultStatus: "success" | "failed" | "blocked" | "skipped",
  message: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = createServiceClient();
  await supabase.from("daily_video_activity_log").insert({
    video_id: videoId,
    actor_type: actorType,
    action_type: actionType,
    result_status: resultStatus,
    message,
    metadata,
  });
}

function toRowPayload(draft: DailyVideoDraft) {
  return {
    content_date: draft.contentDate,
    vertical: draft.vertical,
    title: draft.title,
    angle: draft.angle,
    video_hook: draft.videoHook,
    full_script: draft.fullScript,
    voiceover_script: draft.voiceoverScript,
    primary_cta: draft.primaryCta,
    emotional_tone: draft.emotionalTone,
    status: "awaiting_approval",
    approval_status: "pending",
    storyboard: draft.storyboard,
    canva_prompt: draft.canvaPrompt,
    canva_fields: draft.canvaFields,
    captions: draft.captions,
    alternate_hooks: draft.alternateHooks,
    dashboard_screenshots: draft.dashboardScreenshots,
    thumbnail_concept: draft.thumbnailConcept,
    platform_posts: draft.platformPosts,
    hashtags: draft.hashtags,
    suggested_music_vibe: draft.suggestedMusicVibe,
    ai_image_prompts: draft.aiImagePrompts,
    motion_graphics: draft.motionGraphics,
    camera_movements: draft.cameraMovements,
    transition_instructions: draft.transitionInstructions,
    emotional_guidance: draft.emotionalGuidance,
    suggested_posting_times: draft.suggestedPostingTimes,
    engagement_strategy: draft.engagementStrategy,
    logo_outro_spec: draft.logoOutroSpec,
    manual_publish_checklist: draft.manualPublishChecklist,
    optimization_notes: draft.optimizationNotes,
    source_context: draft.sourceContext,
  };
}

function buildPublishingReadiness(): DailyContentSummary["readiness"] {
  return [
    {
      label: "Daily generation",
      status: "Ready",
      detail: "Cron can create exactly two approval-gated reels per day: one Supplyfy savings reel and one HomeReach targeted-mail reel.",
    },
    {
      label: "Human approval",
      status: "Ready",
      detail: "Every draft remains approval-gated before publishing.",
    },
    {
      label: "AI b-roll rendering",
      status: "Ready",
      detail: "Rendered MP4 review is required before approval. Live rendering uses the server-side provider CLI session and keeps credentials out of the browser.",
    },
    {
      label: "Social publishing",
      status: "Manual Fallback",
      detail: "Captions, hashtags, checklist, and publishing proof are prepared. Posts still require human approval and manual platform action.",
    },
  ];
}
