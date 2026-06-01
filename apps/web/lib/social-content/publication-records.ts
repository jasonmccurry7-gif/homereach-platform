import "server-only";

import { syncSocialPublicationRecordLedger } from "@/lib/approvals/daily-content-ledger";
import { createServiceClient } from "@/lib/supabase/service";
import type { DailyVideoContentRow, DailyVideoPlatformPostRow } from "@/lib/daily-content/types";
import type { SocialPublishApproval } from "./publish-guard";

export async function syncDailyPlatformPublicationRecord({
  video,
  post,
  approval,
  status,
  externalUrl,
  externalPostId,
  scheduledAt,
  publishedAt,
}: {
  video: DailyVideoContentRow;
  post: DailyVideoPlatformPostRow;
  approval?: SocialPublishApproval | null;
  status: "manual_publish_ready" | "scheduled" | "published" | "failed" | "draft";
  externalUrl?: string | null;
  externalPostId?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
}) {
  try {
    const db = createServiceClient();
    const { data: asset } = await db
      .from("content_assets")
      .select("id")
      .eq("source_table", "daily_video_content")
      .eq("source_id", video.id)
      .maybeSingle();

    const assetId = (asset as { id?: string } | null)?.id ?? null;
    const { data: version } = assetId
      ? await db
          .from("content_asset_versions")
          .select("id")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const { data: existingRecord, error: lookupError } = await db
      .from("social_publication_records")
      .select("id,approval_status,verification_status,content_hash,media_urls,approved_by,approved_at,created_at,updated_at")
      .eq("platform_post_id", post.id)
      .maybeSingle();

    if (lookupError) {
      if (lookupError.code !== "42P01") console.warn("[social-publication] record lookup skipped:", lookupError.message);
      return;
    }

    const existing = existingRecord as {
      id?: string;
      approval_status?: string | null;
      verification_status?: string | null;
      content_hash?: string | null;
      media_urls?: unknown;
      approved_by?: string | null;
      approved_at?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
    } | null;
    const resolvedApprovalStatus = approval ? "approved" : existing?.approval_status ?? "pending";
    const resolvedVerificationStatus = approval?.verificationStatus ?? existing?.verification_status ?? "pending";
    const resolvedContentHash = approval?.contentHash ?? existing?.content_hash ?? null;
    const resolvedMediaUrls = approval?.mediaUrls ?? existing?.media_urls ?? [];
    const resolvedApprovedBy = approval?.approvedBy ?? existing?.approved_by ?? null;
    const resolvedApprovedAt = approval?.approvedAt ?? existing?.approved_at ?? null;

    if (!existing?.id && !approval) {
      return;
    }

    const payload = {
      asset_id: assetId,
      version_id: (version as { id?: string } | null)?.id ?? null,
      daily_video_id: video.id,
      platform_post_id: post.id,
      provider: "manual",
      platform: post.platform,
      status,
      approval_status: resolvedApprovalStatus,
      verification_status: resolvedVerificationStatus,
      content_hash: resolvedContentHash,
      caption: post.caption,
      media_urls: resolvedMediaUrls,
      external_post_id: externalPostId ?? post.external_post_id ?? null,
      external_url: externalUrl ?? post.external_url ?? null,
      scheduled_at: scheduledAt ?? post.scheduled_at ?? null,
      published_at: publishedAt ?? post.published_at ?? null,
      approved_by: resolvedApprovedBy,
      approved_at: resolvedApprovedAt,
      utm_source: "homereach",
      utm_medium: "social",
      utm_campaign: `daily-content-${video.content_date}`,
      utm_content: post.platform,
      metadata: {
        video_title: video.title,
        vertical: video.vertical,
        primary_cta: video.primary_cta,
      },
    };

    const { data: syncedRecord, error } = existing?.id
      ? await db
          .from("social_publication_records")
          .update(payload)
          .eq("id", existing.id)
          .select("id,platform,status,approval_status,verification_status,external_url,scheduled_at,published_at,approved_by,approved_at,created_at,updated_at")
          .single()
      : await db
          .from("social_publication_records")
          .insert(payload)
          .select("id,platform,status,approval_status,verification_status,external_url,scheduled_at,published_at,approved_by,approved_at,created_at,updated_at")
          .single();

    if (error && error.code !== "42P01") {
      console.warn("[social-publication] record sync skipped:", error.message);
      return;
    }

    if (syncedRecord) {
      const ledgerResult = await syncSocialPublicationRecordLedger({
        id: String(syncedRecord.id),
        platform: String(syncedRecord.platform ?? post.platform),
        status: String(syncedRecord.status ?? status),
        approvalStatus: typeof syncedRecord.approval_status === "string" ? syncedRecord.approval_status : resolvedApprovalStatus,
        verificationStatus:
          typeof syncedRecord.verification_status === "string"
            ? syncedRecord.verification_status
            : resolvedVerificationStatus,
        externalUrl: typeof syncedRecord.external_url === "string" ? syncedRecord.external_url : externalUrl ?? post.external_url ?? null,
        scheduledAt: typeof syncedRecord.scheduled_at === "string" ? syncedRecord.scheduled_at : scheduledAt ?? post.scheduled_at ?? null,
        publishedAt: typeof syncedRecord.published_at === "string" ? syncedRecord.published_at : publishedAt ?? post.published_at ?? null,
        approvedBy: typeof syncedRecord.approved_by === "string" ? syncedRecord.approved_by : resolvedApprovedBy,
        approvedAt: typeof syncedRecord.approved_at === "string" ? syncedRecord.approved_at : resolvedApprovedAt,
        createdAt: typeof syncedRecord.created_at === "string" ? syncedRecord.created_at : existing?.created_at ?? null,
        updatedAt: typeof syncedRecord.updated_at === "string" ? syncedRecord.updated_at : existing?.updated_at ?? null,
      });

      if (!ledgerResult.ok) {
        console.warn("[approval-ledger] social publication record sync skipped:", ledgerResult.error);
      }
    }
  } catch (error) {
    console.warn("[social-publication] record sync skipped:", error instanceof Error ? error.message : String(error));
  }
}
