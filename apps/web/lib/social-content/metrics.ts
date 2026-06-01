import "server-only";

import { evaluateImportedMetricSignal } from "@/lib/marketing-intelligence/performance";
import { createServiceClient } from "@/lib/supabase/service";

export type SocialMetricsInput = {
  publicationId?: string;
  videoId?: string;
  platformPostId?: string;
  platform: string;
  metricDate?: string;
  views?: number;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  watchTimeSeconds?: number;
  averageWatchTimeSeconds?: number;
  retentionRate?: number;
  completionRate?: number;
  clicks?: number;
  dmsGenerated?: number;
  leadsGenerated?: number;
  conversionsGenerated?: number;
  estimatedRevenue?: number;
  externalUrl?: string;
  externalPostId?: string;
  rawMetrics?: Record<string, unknown>;
};

export async function upsertSocialContentMetrics(input: SocialMetricsInput) {
  const db = createServiceClient();
  const metricDate = input.metricDate ?? new Date().toISOString().slice(0, 10);
  let publicationId = input.publicationId ?? null;
  let videoId = input.videoId ?? null;

  if (input.platformPostId) {
    const { data: post } = await db
      .from("daily_video_platform_posts")
      .select("video_id")
      .eq("id", input.platformPostId)
      .maybeSingle();
    videoId = videoId ?? ((post as { video_id?: string } | null)?.video_id ?? null);

    await db
      .from("daily_video_platform_posts")
      .update({
        external_url: normalizeExternalUrl(input.externalUrl) ?? undefined,
        external_post_id: input.externalPostId?.trim() || undefined,
      })
      .eq("id", input.platformPostId);

    const { data: publication } = await db
      .from("social_publication_records")
      .select("id")
      .eq("platform_post_id", input.platformPostId)
      .maybeSingle();
    publicationId = publicationId ?? ((publication as { id?: string } | null)?.id ?? null);
  }

  const dailyMetrics = {
    video_id: videoId,
    platform: input.platform,
    metric_date: metricDate,
    views: numberValue(input.views),
    likes: numberValue(input.likes),
    comments: numberValue(input.comments),
    shares: numberValue(input.shares),
    saves: numberValue(input.saves),
    watch_time_seconds: numberValue(input.watchTimeSeconds),
    dms_generated: numberValue(input.dmsGenerated),
    leads_generated: numberValue(input.leadsGenerated),
    conversions_generated: numberValue(input.conversionsGenerated),
    raw_metrics: input.rawMetrics ?? {},
  };

  if (videoId) {
    await db
      .from("daily_video_metrics")
      .upsert(dailyMetrics, { onConflict: "video_id,platform,metric_date" });
  }

  if (publicationId) {
    const performanceSignal = evaluateImportedMetricSignal({
      views: input.views,
      reach: input.reach,
      impressions: input.impressions,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      saves: input.saves,
      clicks: input.clicks,
      dms_generated: input.dmsGenerated,
      leads_generated: input.leadsGenerated,
      conversions_generated: input.conversionsGenerated,
      estimated_revenue: input.estimatedRevenue,
    });
    const socialMetrics = {
      publication_id: publicationId,
      metric_date: metricDate,
      views: numberValue(input.views),
      reach: numberValue(input.reach),
      impressions: numberValue(input.impressions),
      likes: numberValue(input.likes),
      comments: numberValue(input.comments),
      shares: numberValue(input.shares),
      saves: numberValue(input.saves),
      watch_time_seconds: numberValue(input.watchTimeSeconds),
      average_watch_time_seconds: input.averageWatchTimeSeconds ?? null,
      retention_rate: input.retentionRate ?? null,
      completion_rate: input.completionRate ?? null,
      clicks: numberValue(input.clicks),
      dms_generated: numberValue(input.dmsGenerated),
      leads_generated: numberValue(input.leadsGenerated),
      conversions_generated: numberValue(input.conversionsGenerated),
      estimated_revenue: input.estimatedRevenue ?? null,
      raw_metrics: input.rawMetrics ?? {},
    };

    await db
      .from("social_post_metrics_daily")
      .upsert(socialMetrics, { onConflict: "publication_id,metric_date" });

    await db.from("content_learning_events").insert({
      publication_id: publicationId,
      daily_video_id: videoId,
      event_type: "metric_import",
      signal: performanceSignal.signal,
      platform: input.platform,
      score: performanceSignal.score,
      source_table: "social_post_metrics_daily",
      metadata: {
        metric_date: metricDate,
        ...performanceSignal.metadata,
        raw_metrics: input.rawMetrics ?? {},
      },
    });
  }

  return { ok: true, publicationId, videoId, metricDate };
}

function numberValue(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
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
