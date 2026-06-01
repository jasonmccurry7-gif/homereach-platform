import "server-only";

import { syncSocialPublicationRecordLedger } from "@/lib/approvals/daily-content-ledger";
import { createServiceClient } from "@/lib/supabase/service";
import {
  assertSocialPublishAllowed,
  SocialPublishBlockedError,
  type SocialPublishSource,
} from "@/lib/social-content/publish-guard";
import { boolEnv } from "./config";
import {
  MetaGraphApiError,
  publishMetaFacebookPagePost,
  publishMetaInstagramImagePost,
} from "./client";
import { getMetaConnectionForPublishing, recordMetaConnectionError } from "./repository";

type SocialPublicationRow = {
  id: string;
  ai_output_id: string | null;
  daily_video_id: string | null;
  platform_post_id: string | null;
  meta_connection_id: string | null;
  provider: string;
  platform: string;
  page_id: string | null;
  account_id: string | null;
  status: string;
  approval_status: string | null;
  verification_status: string | null;
  caption: string | null;
  media_urls: string[] | null;
  scheduled_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function scheduleMetaPublicationFromAiOutput({
  outputId,
  connectionId,
  platform,
  caption,
  mediaUrls = [],
  scheduledAt,
  actorId,
}: {
  outputId: string;
  connectionId: string;
  platform: string;
  caption?: string | null;
  mediaUrls?: string[];
  scheduledAt?: string | null;
  actorId?: string | null;
}) {
  assertMetaPublishFeatureReady();
  const connection = await getMetaConnectionForPublishing(connectionId);
  const normalizedPlatform = normalizePlatform(platform);
  const destination = {
    provider: "facebook" as const,
    platform: normalizedPlatform,
    pageId: connection.pageId ?? undefined,
    accountId:
      normalizedPlatform === "instagram"
        ? connection.instagramBusinessAccountId ?? undefined
        : connection.pageId ?? undefined,
  };
  const approval = await assertSocialPublishAllowed({
    source: { type: "ai_output", outputId },
    destination,
    action: "schedule_external",
    actorId,
    text: caption ?? undefined,
    mediaUrls,
  });
  const db = createServiceClient();
  const status = scheduledAt ? "scheduled" : "manual_publish_ready";
  const now = new Date().toISOString();

  const payload = {
    ai_output_id: outputId,
    provider: "meta",
    platform: normalizedPlatform,
    account_id: destination.accountId ?? null,
    page_id: connection.pageId,
    meta_connection_id: connection.id,
    status,
    approval_status: "approved",
    verification_status: approval.verificationStatus,
    content_hash: approval.contentHash,
    caption: approval.text,
    media_urls: approval.mediaUrls,
    scheduled_at: scheduledAt ?? null,
    approved_by: approval.approvedBy,
    approved_at: approval.approvedAt,
    utm_source: "homereach",
    utm_medium: "social",
    utm_campaign: "managed-social-content",
    utm_content: normalizedPlatform,
    publish_mode: "meta_auto",
    publish_after_approval: true,
    raw_provider_payload: {
      source: { type: "ai_output", outputId },
      destination,
      action: "schedule_external",
    },
    metadata: {
      ...(approval.metadata ?? {}),
      connection_id: connection.id,
      page_name: connection.pageName,
      instagram_username: connection.instagramUsername,
      created_by: actorId ?? null,
    },
    updated_at: now,
  };

  const { data, error } = await db
    .from("social_publication_records")
    .insert(payload)
    .select(
      "id,platform,status,approval_status,verification_status,external_url,scheduled_at,published_at,approved_by,approved_at,created_at,updated_at",
    )
    .single();
  if (error) throw new Error(error.message);

  await db.from("social_publish_attempts").insert({
    publication_id: data.id,
    connection_id: connection.id,
    provider: "meta",
    platform: normalizedPlatform,
    action: "schedule",
    status: "queued",
    attempted_by: actorId ?? null,
    request_payload: {
      scheduled_at: scheduledAt ?? null,
      platform: normalizedPlatform,
      media_count: approval.mediaUrls.length,
    },
  });

  await syncPublicationLedger(data);
  return data;
}

export async function publishMetaPublication({
  publicationId,
  actorId,
  action = "publish_now",
}: {
  publicationId: string;
  actorId?: string | null;
  action?: "publish_now" | "publish_due";
}) {
  assertMetaPublishFeatureReady();
  const db = createServiceClient();
  const { data, error } = await db
    .from("social_publication_records")
    .select(
      [
        "id",
        "ai_output_id",
        "daily_video_id",
        "platform_post_id",
        "meta_connection_id",
        "provider",
        "platform",
        "page_id",
        "account_id",
        "status",
        "approval_status",
        "verification_status",
        "caption",
        "media_urls",
        "scheduled_at",
        "approved_by",
        "approved_at",
        "metadata",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("id", publicationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Publication record was not found.");
  const publication = data as unknown as SocialPublicationRow;
  const connectionId = publication.meta_connection_id;
  if (publication.provider !== "meta" || !connectionId) {
    throw new Error("Publication is not attached to a Meta connection.");
  }
  if (publication.status === "published") return { ok: true, skipped: true, reason: "already_published" };
  if (publication.approval_status !== "approved") throw new Error("Publication is not approved.");
  if (!["verified", "not_required"].includes(publication.verification_status ?? "")) {
    throw new Error("Publication is not verified.");
  }

  const source = sourceFromPublication(publication);
  const connection = await getMetaConnectionForPublishing(connectionId);
  const platform = normalizePlatform(publication.platform);
  const mediaUrls = normalizeMediaUrls(publication.media_urls);
  const approval = await assertSocialPublishAllowed({
    source,
    destination: {
      provider: "facebook",
      platform,
      pageId: connection.pageId ?? undefined,
      accountId: platform === "instagram" ? connection.instagramBusinessAccountId ?? undefined : connection.pageId ?? undefined,
    },
    action: "send_external",
    actorId,
    text: publication.caption ?? undefined,
    mediaUrls,
  });

  try {
    const result =
      platform === "instagram"
        ? await publishMetaInstagramImagePost({
            instagramBusinessAccountId: requireValue(
              connection.instagramBusinessAccountId,
              "Instagram business account is not connected.",
            ),
            pageAccessToken: connection.pageAccessToken,
            caption: approval.text,
            mediaUrls,
          })
        : await publishMetaFacebookPagePost({
            pageId: requireValue(connection.pageId, "Facebook page is not connected."),
            pageAccessToken: connection.pageAccessToken,
            message: approval.text,
            mediaUrls,
          });

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await db
      .from("social_publication_records")
      .update({
        status: "published",
        external_post_id: result.externalPostId,
        external_url: result.externalUrl,
        published_at: now,
        last_publish_attempt_at: now,
        last_publish_error: null,
        raw_provider_payload: result.raw,
      })
      .eq("id", publication.id)
      .select(
        "id,platform,status,approval_status,verification_status,external_url,scheduled_at,published_at,approved_by,approved_at,created_at,updated_at",
      )
      .single();
    if (updateError) throw new Error(updateError.message);

    await db.from("social_publish_attempts").insert({
      publication_id: publication.id,
      connection_id: connection.id,
      provider: "meta",
      platform,
      action,
      status: "published",
      attempted_by: actorId ?? null,
      request_payload: { platform, media_count: mediaUrls.length },
      response_payload: result.raw,
      external_post_id: result.externalPostId,
      external_url: result.externalUrl,
    });

    await syncPublicationLedger(updated);
    return { ok: true, skipped: false, publication: updated };
  } catch (error) {
    const message = publishErrorMessage(error);
    const status = error instanceof SocialPublishBlockedError ? "blocked" : "failed";
    const now = new Date().toISOString();
    const { data: updated } = await db
      .from("social_publication_records")
      .update({
        status,
        last_publish_attempt_at: now,
        last_publish_error: message,
      })
      .eq("id", publication.id)
      .select(
        "id,platform,status,approval_status,verification_status,external_url,scheduled_at,published_at,approved_by,approved_at,created_at,updated_at",
      )
      .maybeSingle();

    await db.from("social_publish_attempts").insert({
      publication_id: publication.id,
      connection_id: connection.id,
      provider: "meta",
      platform,
      action,
      status,
      attempted_by: actorId ?? null,
      request_payload: { platform, media_count: mediaUrls.length },
      response_payload: error instanceof MetaGraphApiError ? error.payload : {},
      error_message: message,
    });

    if (error instanceof MetaGraphApiError && error.status === 401) {
      await recordMetaConnectionError(connection.id, message);
    }
    if (updated) await syncPublicationLedger(updated);
    return { ok: false, skipped: false, error: message };
  }
}

export async function publishDueMetaPublications({
  limit = 10,
  actorId,
}: {
  limit?: number;
  actorId?: string | null;
}) {
  assertMetaPublishFeatureReady();
  const db = createServiceClient();
  const { data, error } = await db
    .from("social_publication_records")
    .select("id")
    .eq("provider", "meta")
    .eq("publish_mode", "meta_auto")
    .eq("publish_after_approval", true)
    .eq("status", "scheduled")
    .eq("approval_status", "approved")
    .in("verification_status", ["verified", "not_required"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results = [];
  for (const row of data ?? []) {
    results.push(await publishMetaPublication({ publicationId: String(row.id), actorId, action: "publish_due" }));
  }

  return results;
}

function assertMetaPublishFeatureReady() {
  if (!boolEnv("ENABLE_META_CONNECTED_PUBLISHING")) {
    throw new SocialPublishBlockedError("Meta connected publishing is disabled.", 503, "meta_connected_publishing_disabled");
  }
  if (!boolEnv("ENABLE_META_AUTO_PUBLISHING")) {
    throw new SocialPublishBlockedError("Meta auto-publishing is disabled.", 503, "meta_auto_publishing_disabled");
  }
}

function sourceFromPublication(publication: SocialPublicationRow): SocialPublishSource {
  if (publication.ai_output_id) return { type: "ai_output", outputId: publication.ai_output_id };
  if (publication.daily_video_id && publication.platform_post_id) {
    return {
      type: "daily_video_platform_post",
      videoId: publication.daily_video_id,
      postId: publication.platform_post_id,
    };
  }
  throw new Error("Publication does not have a supported approved source.");
}

function normalizePlatform(platform: string) {
  return platform.toLowerCase().includes("instagram") ? "instagram" : "facebook";
}

function normalizeMediaUrls(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.map((url) => String(url).trim()).filter(Boolean) : [];
}

function requireValue(value: string | null | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

function publishErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Meta publishing failed.";
}

async function syncPublicationLedger(row: {
  id: string;
  platform: string | null;
  status: string | null;
  approval_status: string | null;
  verification_status: string | null;
  external_url?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}) {
  const result = await syncSocialPublicationRecordLedger({
    id: String(row.id),
    platform: String(row.platform ?? "facebook"),
    status: String(row.status ?? "draft"),
    approvalStatus: row.approval_status,
    verificationStatus: row.verification_status,
    externalUrl: row.external_url ?? null,
    scheduledAt: row.scheduled_at ?? null,
    publishedAt: row.published_at ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  });
  if (!result.ok) console.warn("[approval-ledger] meta publication sync skipped:", result.error);
}
