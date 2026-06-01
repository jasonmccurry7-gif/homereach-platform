import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { DailyVideoContentRow, DailyVideoDraft } from "@/lib/daily-content/types";
import { buildContentHash } from "./hash";

export async function upsertContentAssetFromDailyVideo(video: DailyVideoContentRow, draft: DailyVideoDraft) {
  try {
    const db = createServiceClient();
    const contentHash = buildContentHash([
      draft.title,
      draft.videoHook,
      draft.voiceoverScript,
      draft.storyboard,
      draft.platformPosts,
      draft.hashtags,
    ]);

    const assetPayload = {
      asset_type: "short_form_video",
      title: draft.title,
      vertical: draft.vertical,
      category: draft.vertical,
      status: "needs_review",
      approval_status: "needs_review",
      source_workflow: "daily_ai_video_content_engine",
      source_table: "daily_video_content",
      source_id: video.id,
      source_context: draft.sourceContext,
      metadata: {
        content_date: draft.contentDate,
        emotional_tone: draft.emotionalTone,
        primary_cta: draft.primaryCta,
      },
    };

    const { data: existingAsset, error: lookupError } = await db
      .from("content_assets")
      .select("id")
      .eq("source_table", "daily_video_content")
      .eq("source_id", video.id)
      .maybeSingle();

    if (lookupError) {
      if (lookupError.code !== "42P01") console.warn("[content-library] asset lookup skipped:", lookupError.message);
      return;
    }

    const { data: asset, error: assetError } = existingAsset
      ? await db
          .from("content_assets")
          .update(assetPayload)
          .eq("id", (existingAsset as { id: string }).id)
          .select("id")
          .single()
      : await db
          .from("content_assets")
          .insert(assetPayload)
          .select("id")
          .single();

    if (assetError) {
      if (assetError.code !== "42P01") console.warn("[content-library] asset upsert skipped:", assetError.message);
      return;
    }

    const assetId = (asset as { id: string }).id;
    await db
      .from("content_asset_versions")
      .upsert(
        {
          asset_id: assetId,
          version_number: 1,
          title: draft.title,
          body: draft.voiceoverScript,
          content_hash: contentHash,
          daily_video_id: video.id,
          platform_payload: {
            storyboard: draft.storyboard,
            platform_posts: draft.platformPosts,
            repurposed_assets: draft.repurposedAssets,
            canva_prompt: draft.canvaPrompt,
            thumbnail_concept: draft.thumbnailConcept,
          },
          media_urls: [],
          created_by_agent: "daily_ai_video_content_engine",
          approval_status: "needs_review",
          verification_status: "needs_review",
          metadata: {
            hooks: [draft.videoHook, ...draft.alternateHooks],
            hashtags: draft.hashtags,
            repurposed_asset_count: draft.repurposedAssets.length,
            optimization_notes: draft.optimizationNotes,
          },
        },
        { onConflict: "asset_id,content_hash" },
      );

    await db.from("content_asset_sources").insert({
      asset_id: assetId,
      source_type: "daily_video_content",
      source_id: video.id,
      source_label: draft.title,
      metadata: {
        content_date: draft.contentDate,
        vertical: draft.vertical,
      },
    });
  } catch (error) {
    console.warn("[content-library] daily video asset sync skipped:", error instanceof Error ? error.message : String(error));
  }
}
