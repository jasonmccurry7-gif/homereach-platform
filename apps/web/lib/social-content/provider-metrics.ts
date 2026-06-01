import "server-only";

import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { createServiceClient } from "@/lib/supabase/service";

export type ProviderMetricSyncResult = {
  ok: true;
  checked: number;
  imported: number;
  skipped: number;
  records: Array<{
    publicationId: string;
    provider: string;
    platform: string;
    status: "skipped" | "imported";
    reason: string;
  }>;
};

export async function syncSocialProviderMetrics({ limit = 25 }: { limit?: number } = {}): Promise<ProviderMetricSyncResult> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("social_publication_records")
    .select("id,provider,platform,status,external_post_id,external_url,daily_video_id,platform_post_id")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01") {
      return { ok: true, checked: 0, imported: 0, skipped: 0, records: [] };
    }
    throw new Error(error.message);
  }

  const records: ProviderMetricSyncResult["records"] = [];
  for (const row of data ?? []) {
    const provider = String(row.provider ?? "manual");
    const platform = String(row.platform ?? "unknown");
    const publicationId = String(row.id);

    await logPlatformAuditEvent({
      actorType: "cron",
      module: "social_content_metrics",
      actionType: "provider_metric_sync_skipped",
      entityType: "social_publication_record",
      entityId: publicationId,
      sourceTable: "social_publication_records",
      sourceId: publicationId,
      provider,
      channel: platform,
      resultStatus: "skipped",
      approvalState: "not_required",
      severity: "low",
      message: "Provider metric polling scaffold ran; no provider-specific importer is configured for this record yet.",
      metadata: {
        external_post_id: row.external_post_id,
        external_url: row.external_url,
        platform_post_id: row.platform_post_id,
        daily_video_id: row.daily_video_id,
      },
    });

    records.push({
      publicationId,
      provider,
      platform,
      status: "skipped",
      reason: "Provider-specific metric importer is not configured yet.",
    });
  }

  return {
    ok: true,
    checked: records.length,
    imported: records.filter((record) => record.status === "imported").length,
    skipped: records.filter((record) => record.status === "skipped").length,
    records,
  };
}
