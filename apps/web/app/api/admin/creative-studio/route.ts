import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/api-guards";
import { syncCreativeAssetLedger } from "@/lib/approvals/creative-ledger";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  clampVariationCount,
  generateCreativeAssetDraft,
} from "@/lib/creative-studio/generator";
import { isCreativeStudioEnabled, mapAsset } from "@/lib/creative-studio/repository";
import type { CreativeGenerationInput } from "@/lib/creative-studio/types";

const offerKeys = [
  "shared_postcards",
  "targeted_mail",
  "political_mail",
  "procurement_dashboard",
  "government_contracts",
  "facebook_group_post",
  "dm_followup",
  "short_form_video",
  "local_business_promo",
  "candidate_explainer",
  "home_service_before_after",
] as const;

const assetTypes = [
  "15_second_ugc_ad",
  "30_second_ugc_ad",
  "60_second_explainer_video",
  "product_service_promo_video",
  "political_campaign_intro_video",
  "local_business_testimonial_ad",
  "facebook_group_post_creative",
  "static_image_ad",
  "thumbnail",
  "postcard_qr_hero_image",
  "before_after_visual_concept",
  "campaign_offer_graphic",
  "multi_language_version",
  "voiceover_script",
  "scene_by_scene_storyboard",
] as const;

const platforms = [
  "facebook",
  "instagram",
  "youtube_shorts",
  "tiktok",
  "website",
  "email",
  "sms",
  "postcard_qr_landing_page",
] as const;

const brandVoices = [
  "homereach_executive",
  "procurement_margin_protection",
  "local_business_practical",
  "political_compliance_neutral",
  "government_contract_operator",
  "warm_follow_up",
] as const;

const uuidLike = z.string().uuid().nullable().optional();

const generateSchema = z.object({
  action: z.literal("generate"),
  campaignId: uuidLike,
  businessId: uuidLike,
  candidateId: uuidLike,
  offerKey: z.enum(offerKeys),
  assetType: z.enum(assetTypes),
  platform: z.enum(platforms),
  brandVoice: z.enum(brandVoices),
  brandKitId: uuidLike,
  audience: z.string().max(220).optional(),
  localMarket: z.string().max(160).optional(),
  painPoint: z.string().max(260).optional(),
  campaignGoal: z.string().max(260).optional(),
  language: z.string().max(80).optional(),
  variationCount: z.number().int().min(1).max(10).optional(),
  advancedPrompt: z.string().max(1200).optional(),
});

const assetActionSchema = z.object({
  action: z.enum(["approve", "reject", "needs_revision", "mark_winner", "save_to_campaign"]),
  assetId: z.string().uuid(),
  notes: z.string().max(1200).optional(),
});

const regenerateSchema = z.object({
  action: z.literal("regenerate_variation"),
  assetId: z.string().uuid(),
});

type ApiBody =
  | z.infer<typeof generateSchema>
  | z.infer<typeof assetActionSchema>
  | z.infer<typeof regenerateSchema>;

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limited = checkRateLimit(req, {
    key: "admin-creative-studio",
    identifier: guard.user?.id ?? null,
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!(await isCreativeStudioEnabled())) {
    return NextResponse.json(
      { error: "Creative Studio is disabled by the creative_studio_enabled feature flag." },
      { status: 403 },
    );
  }

  let body: ApiBody;
  try {
    const json = await req.json();
    body = parseBody(json);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid Creative Studio request." },
      { status: 400 },
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase service credentials are required for Creative Studio persistence." },
      { status: 503 },
    );
  }

  try {
    if (body.action === "generate") {
      return await handleGenerate(body, guard.user?.id ?? null);
    }

    if (body.action === "regenerate_variation") {
      return await handleRegenerate(body.assetId, guard.user?.id ?? null);
    }

    return await handleAssetAction(body, guard.user?.id ?? null);
  } catch (error) {
    await logPlatformAuditEvent({
      actorType: "human",
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "Admin",
      module: "creative_studio",
      actionType: body.action,
      resultStatus: "failure",
      approvalState: "needs_review",
      severity: "medium",
      message: "Creative Studio action failed.",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Creative Studio action failed." },
      { status: 500 },
    );
  }
}

function parseBody(json: unknown): ApiBody {
  const action = typeof json === "object" && json && "action" in json ? String((json as { action?: unknown }).action) : "";
  if (action === "generate") return generateSchema.parse(json);
  if (action === "regenerate_variation") return regenerateSchema.parse(json);
  return assetActionSchema.parse(json);
}

async function handleGenerate(body: z.infer<typeof generateSchema>, userId: string | null) {
  const db = createServiceClient();
  const started = Date.now();
  const input: CreativeGenerationInput = {
    campaignId: body.campaignId ?? null,
    businessId: body.businessId ?? null,
    candidateId: body.candidateId ?? null,
    offerKey: body.offerKey,
    assetType: body.assetType,
    platform: body.platform,
    brandVoice: body.brandVoice,
    brandKitId: body.brandKitId ?? null,
    audience: body.audience,
    localMarket: body.localMarket,
    painPoint: body.painPoint,
    campaignGoal: body.campaignGoal,
    language: body.language,
    variationCount: body.variationCount,
    advancedPrompt: body.advancedPrompt,
  };
  const variationCount = clampVariationCount(body.variationCount);
  const inserted = [];

  for (let index = 0; index < variationCount; index += 1) {
    const draft = await generateCreativeAssetDraft(input, index);
    const isPolitical =
      input.offerKey === "political_mail" ||
      input.offerKey === "candidate_explainer" ||
      input.assetType === "political_campaign_intro_video";

    const { data, error } = await db
      .from("creative_assets")
      .insert({
        campaign_id: input.campaignId || null,
        business_id: input.businessId || null,
        candidate_id: input.candidateId || null,
        offer_key: input.offerKey,
        asset_type: input.assetType,
        platform: input.platform,
        brand_voice: input.brandVoice,
        brand_kit_id: input.brandKitId || null,
        provider_key: draft.provider.providerKey,
        provider_job_id: draft.provider.providerJobId,
        provider_status: draft.provider.providerStatus,
        prompt_used: draft.prompt,
        script_used: draft.script,
        storyboard: draft.storyboard,
        caption: draft.caption,
        hashtags: draft.hashtags,
        file_url: draft.provider.fileUrl,
        thumbnail_url: draft.provider.thumbnailUrl,
        status: "awaiting_review",
        approval_status: "needs_review",
        compliance_review_status: isPolitical ? "needs_review" : "not_required",
        quality_score: draft.qualityReview.overallScore,
        best_use_case: draft.qualityReview.bestUseCase,
        strengths: draft.qualityReview.strengths,
        weaknesses: draft.qualityReview.weaknesses,
        recommended_improvement: draft.qualityReview.recommendedImprovement,
        approval_recommendation: draft.qualityReview.approvalRecommendation,
        metadata: {
          title: draft.title,
          input,
          providerResponse: draft.provider.responsePayload,
          qualityChecklist: draft.qualityReview.checklist,
          humanApprovalRequired: true,
          autoPublish: false,
        },
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    const mappedAsset = mapAsset(data as Record<string, unknown>);
    inserted.push(mappedAsset);

    await db.from("creative_generation_logs").insert({
      asset_id: data.id,
      provider_key: draft.provider.providerKey,
      action_type: "generate",
      request_payload: { input, variationIndex: index },
      response_payload: draft.provider.responsePayload,
      status: "success",
      duration_ms: Date.now() - started,
      created_by: userId,
    });

    await logPlatformAuditEvent({
      actorType: "human",
      actorId: userId,
      module: "creative_studio",
      actionType: "generate",
      entityType: "creative_asset",
      entityId: data.id,
      provider: draft.provider.providerKey,
      resultStatus: "pending_approval",
      approvalState: "needs_review",
      severity: isPolitical ? "high" : "low",
      message: `${draft.title} generated and queued for review.`,
      metadata: { offerKey: input.offerKey, platform: input.platform, assetType: input.assetType },
    });

    const ledgerResult = await syncCreativeAssetLedger(mappedAsset, {
      actorId: userId,
      actorLabel: "creative_studio_generate",
      eventType: "creative_asset_generated",
    });
    if (!ledgerResult.ok) {
      console.warn("[approval-ledger] creative asset generate sync skipped:", ledgerResult.error);
    }
  }

  return NextResponse.json({
    ok: true,
    message: `${inserted.length} creative draft${inserted.length === 1 ? "" : "s"} queued for review.`,
    assets: inserted,
  });
}

async function handleRegenerate(assetId: string, userId: string | null) {
  const db = createServiceClient();
  const { data: existing, error } = await db.from("creative_assets").select("*").eq("id", assetId).single();
  if (error) throw new Error(error.message);

  const metadata = isRecord(existing.metadata) ? existing.metadata : {};
  const input = isRecord(metadata.input)
    ? (metadata.input as CreativeGenerationInput)
    : {
        campaignId: existing.campaign_id,
        businessId: existing.business_id,
        candidateId: existing.candidate_id,
        offerKey: existing.offer_key,
        assetType: existing.asset_type,
        platform: existing.platform,
        brandVoice: existing.brand_voice,
        brandKitId: existing.brand_kit_id,
      };

  const response = await handleGenerate({ action: "generate", ...input, variationCount: 1 } as z.infer<typeof generateSchema>, userId);
  await logPlatformAuditEvent({
    actorType: "human",
    actorId: userId,
    module: "creative_studio",
    actionType: "regenerate_variation",
    entityType: "creative_asset",
    entityId: assetId,
    resultStatus: "pending_approval",
    approvalState: "needs_review",
    severity: "low",
    message: "Creative variation regenerated from existing asset.",
  });
  return response;
}

async function handleAssetAction(body: z.infer<typeof assetActionSchema>, userId: string | null) {
  const db = createServiceClient();
  const now = new Date().toISOString();

  if (body.action === "mark_winner") {
    const { data, error } = await db
      .from("creative_assets")
      .update({
        winning_label: "winner",
        winning_asset: true,
        notes: body.notes ?? "Marked as reusable winning creative by admin.",
        updated_at: now,
      })
      .eq("id", body.assetId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const mappedAsset = mapAsset(data as Record<string, unknown>);

    await logReview(body.assetId, userId, "approved", Number(data.quality_score ?? 0), {
      winner: true,
      notes: body.notes ?? null,
    });
    const ledgerResult = await syncCreativeAssetLedger(mappedAsset, {
      actorId: userId,
      actorLabel: "creative_studio_review",
      eventType: "creative_asset_marked_winner",
    });
    if (!ledgerResult.ok) {
      console.warn("[approval-ledger] creative asset winner sync skipped:", ledgerResult.error);
    }
    return NextResponse.json({ ok: true, message: "Creative marked as winner.", asset: mappedAsset });
  }

  if (body.action === "save_to_campaign") {
    const { data, error } = await db
      .from("creative_assets")
      .update({
        saved_to_campaign: true,
        notes:
          body.notes ??
          "Saved to the related campaign/business/candidate record as a draft asset. Approval is still required before use.",
        updated_at: now,
      })
      .eq("id", body.assetId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const mappedAsset = mapAsset(data as Record<string, unknown>);

    await logReview(body.assetId, userId, String(data.approval_status ?? "needs_review"), Number(data.quality_score ?? 0), {
      savedToCampaign: true,
      notes: body.notes ?? null,
    });
    const ledgerResult = await syncCreativeAssetLedger(mappedAsset, {
      actorId: userId,
      actorLabel: "creative_studio_review",
      eventType: "creative_asset_saved_to_campaign",
    });
    if (!ledgerResult.ok) {
      console.warn("[approval-ledger] creative asset save sync skipped:", ledgerResult.error);
    }
    return NextResponse.json({ ok: true, message: "Creative saved as a draft campaign asset.", asset: mappedAsset });
  }

  const statusMap = {
    approve: { status: "approved", approvalStatus: "approved", complianceStatus: "approved" },
    reject: { status: "rejected", approvalStatus: "rejected", complianceStatus: "blocked" },
    needs_revision: { status: "needs_revision", approvalStatus: "needs_revision", complianceStatus: "needs_review" },
  } as const;
  const next = statusMap[body.action];

  const { data, error } = await db
    .from("creative_assets")
    .update({
      status: next.status,
      approval_status: next.approvalStatus,
      compliance_review_status: next.complianceStatus,
      approved_by: body.action === "approve" ? userId : null,
      approved_at: body.action === "approve" ? now : null,
      notes: body.notes ?? null,
      updated_at: now,
    })
    .eq("id", body.assetId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const mappedAsset = mapAsset(data as Record<string, unknown>);
  await logReview(body.assetId, userId, next.approvalStatus, Number(data.quality_score ?? 0), {
    notes: body.notes ?? null,
    complianceReviewStatus: next.complianceStatus,
  });

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: userId,
    module: "creative_studio",
    actionType: body.action,
    entityType: "creative_asset",
    entityId: body.assetId,
    resultStatus: "success",
    approvalState: next.approvalStatus === "approved" ? "approved" : "needs_review",
    severity: "low",
    message: `Creative asset marked ${next.approvalStatus}.`,
  });
  const ledgerResult = await syncCreativeAssetLedger(mappedAsset, {
    actorId: userId,
    actorLabel: "creative_studio_review",
    eventType: `creative_asset_${body.action}`,
  });
  if (!ledgerResult.ok) {
    console.warn("[approval-ledger] creative asset review sync skipped:", ledgerResult.error);
  }

  return NextResponse.json({
    ok: true,
    message: `Creative asset marked ${next.approvalStatus.replaceAll("_", " ")}.`,
    asset: mappedAsset,
  });
}

async function logReview(
  assetId: string,
  userId: string | null,
  reviewStatus: string,
  qualityScore: number,
  checklist: Record<string, unknown>,
) {
  const db = createServiceClient();
  await db.from("creative_asset_reviews").insert({
    asset_id: assetId,
    reviewer_user_id: userId,
    review_status: reviewStatus,
    quality_score: Math.max(0, Math.min(10, Math.round(qualityScore))),
    checklist,
    review_notes: typeof checklist.notes === "string" ? checklist.notes : null,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
