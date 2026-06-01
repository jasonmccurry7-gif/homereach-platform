import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { getCreativeProviderStatus } from "./provider-adapter";
import {
  seedCreativeAutomationRules,
  seedCreativeBrandKits,
  seedCreativePromptTemplates,
} from "./templates";
import type {
  CreativeAssetStatus,
  CreativeAutomationRule,
  CreativeBrandKit,
  CreativeBrandVoice,
  CreativeGenerationLog,
  CreativeOfferKey,
  CreativePlatform,
  CreativePromptTemplate,
  CreativeReferenceOption,
  CreativeStudioAsset,
  CreativeStudioCommandCenterData,
  CreativeStoryboardScene,
} from "./types";

type GenericRow = Record<string, unknown>;

const MIGRATION_HINT =
  "Apply supabase/migrations/20260526083000_ai_creative_production_studio.sql to persist Creative Studio assets, reviews, prompts, brand kits, generation logs, and automation rules.";

export async function isCreativeStudioEnabled(): Promise<boolean> {
  if (process.env.CREATIVE_STUDIO_ENABLED === "false") return false;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.CREATIVE_STUDIO_ENABLED !== "false";
  }

  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("platform_feature_flags")
      .select("enabled,status")
      .eq("flag_key", "creative_studio_enabled")
      .maybeSingle();

    if (error) return process.env.CREATIVE_STUDIO_ENABLED !== "false";
    if (!data) return process.env.CREATIVE_STUDIO_ENABLED !== "false";

    return Boolean(data.enabled) && data.status !== "paused" && data.status !== "retired";
  } catch {
    return process.env.CREATIVE_STUDIO_ENABLED !== "false";
  }
}

export async function loadCreativeStudioCommandCenter(): Promise<CreativeStudioCommandCenterData> {
  const reusedSystems = [
    "Existing admin route group and role gate",
    "Existing platform_feature_flags safety registry",
    "Existing AI Assets approval-first artifact model",
    "Existing AI Workforce activity and human approval rules",
    "Existing campaign, business, candidate, procurement, government contract, and content systems",
  ];

  const safetyNotes = [
    "Creative Studio creates drafts and review records only.",
    "Generated assets are never posted, sent, published, attached to outreach, or used in paid ads automatically.",
    "Political creative uses geography, route, cost, timing, logistics, and campaign-provided copy only.",
    "Provider keys and MCP secrets remain server-side and are never exposed to the frontend.",
    "Procurement and government-contract claims stay review-gated before public use.",
  ];

  const providerStatus = getCreativeProviderStatus();
  const featureEnabled = await isCreativeStudioEnabled();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return seedData({
      featureEnabled,
      providerStatus,
      warnings: ["Supabase service credentials are unavailable, so Creative Studio is using seed-only data."],
      reusedSystems,
      safetyNotes,
    });
  }

  const db = createServiceClient();
  const [
    brandKitsResult,
    templatesResult,
    assetsResult,
    logsResult,
    automationRulesResult,
    campaignsResult,
    businessesResult,
    candidatesResult,
  ] = await Promise.all([
    safeList(db, "creative_brand_kits", "updated_at"),
    safeList(db, "creative_prompt_templates", "updated_at"),
    safeList(db, "creative_assets", "created_at"),
    safeList(db, "creative_generation_logs", "created_at"),
    safeList(db, "creative_automation_rules", "created_at", true),
    safeList(db, "marketing_campaigns", "created_at"),
    safeList(db, "businesses", "created_at"),
    safeList(db, "campaign_candidates", "updated_at"),
  ]);

  const creativeResults = [
    brandKitsResult,
    templatesResult,
    assetsResult,
    logsResult,
    automationRulesResult,
  ];
  const creativeErrors = creativeResults.flatMap((result) => (result.error ? [result.error] : []));

  if (creativeErrors.length > 0) {
    return seedData({
      featureEnabled,
      providerStatus,
      warnings: Array.from(new Set(creativeErrors.map((error) => error.message).filter(Boolean))),
      references: {
        campaigns: mapCampaignReferences(campaignsResult.data ?? []),
        businesses: mapBusinessReferences(businessesResult.data ?? []),
        candidates: mapCandidateReferences(candidatesResult.data ?? []),
      },
      reusedSystems,
      safetyNotes,
    });
  }

  return {
    schemaReady: true,
    featureEnabled,
    migrationHint: null,
    warnings: [],
    providerStatus,
    brandKits: (brandKitsResult.data ?? []).map(mapBrandKit).concat(
      brandKitsResult.data?.length ? [] : seedCreativeBrandKits,
    ),
    promptTemplates: (templatesResult.data ?? []).map(mapPromptTemplate).concat(
      templatesResult.data?.length ? [] : seedCreativePromptTemplates,
    ),
    assets: (assetsResult.data ?? []).map(mapAsset),
    generationLogs: (logsResult.data ?? []).map(mapLog),
    automationRules: (automationRulesResult.data ?? []).map(mapAutomationRule).concat(
      automationRulesResult.data?.length ? [] : seedCreativeAutomationRules,
    ),
    references: {
      campaigns: mapCampaignReferences(campaignsResult.data ?? []),
      businesses: mapBusinessReferences(businessesResult.data ?? []),
      candidates: mapCandidateReferences(candidatesResult.data ?? []),
    },
    reusedSystems,
    safetyNotes,
  };
}

function seedData({
  featureEnabled,
  providerStatus,
  references,
  reusedSystems,
  safetyNotes,
  warnings,
}: {
  featureEnabled: boolean;
  providerStatus: CreativeStudioCommandCenterData["providerStatus"];
  references?: CreativeStudioCommandCenterData["references"];
  reusedSystems: string[];
  safetyNotes: string[];
  warnings: string[];
}): CreativeStudioCommandCenterData {
  return {
    schemaReady: false,
    featureEnabled,
    migrationHint: MIGRATION_HINT,
    warnings,
    providerStatus,
    brandKits: seedCreativeBrandKits,
    promptTemplates: seedCreativePromptTemplates,
    assets: [],
    generationLogs: [],
    automationRules: seedCreativeAutomationRules,
    references: references ?? { campaigns: [], businesses: [], candidates: [] },
    reusedSystems,
    safetyNotes,
  };
}

async function safeList(
  db: ReturnType<typeof createServiceClient>,
  table: string,
  orderColumn: string,
  ascending = false,
): Promise<{ data: GenericRow[] | null; error: { message: string; code?: string } | null }> {
  try {
    const { data, error } = await db.from(table).select("*").order(orderColumn, { ascending }).limit(100);
    return {
      data: (data ?? null) as GenericRow[] | null,
      error: error ? { message: error.message, code: error.code } : null,
    };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

function mapBrandKit(row: GenericRow): CreativeBrandKit {
  return {
    id: String(row.id),
    name: String(row.name ?? "Brand Kit"),
    ownerType: String(row.owner_type ?? "homereach"),
    logoUrl: asNullableString(row.logo_url),
    colors: asStringArray(row.colors),
    tone: String(row.tone ?? ""),
    fonts: asStringArray(row.fonts),
    ctaLanguage: asStringArray(row.cta_language),
    offerLanguage: String(row.offer_language ?? ""),
    forbiddenClaims: asStringArray(row.forbidden_claims),
    requiredDisclaimerLanguage: asStringArray(row.required_disclaimer_language),
    status: String(row.status ?? "active"),
    createdAt: asNullableString(row.created_at) ?? undefined,
    updatedAt: asNullableString(row.updated_at) ?? undefined,
  };
}

function mapPromptTemplate(row: GenericRow): CreativePromptTemplate {
  return {
    id: String(row.id),
    templateKey: String(row.template_key ?? ""),
    name: String(row.name ?? "Creative template"),
    offerKey: asOfferKey(row.offer_key),
    assetType: String(row.asset_type ?? "30_second_ugc_ad") as CreativePromptTemplate["assetType"],
    platform: (String(row.platform ?? "any") || "any") as CreativePromptTemplate["platform"],
    promptText: String(row.prompt_text ?? ""),
    scriptSeed: String(row.script_seed ?? ""),
    storyboardSeed: asStoryboard(row.storyboard_seed),
    complianceNotes: String(row.compliance_notes ?? ""),
    status: String(row.status ?? "active"),
    createdAt: asNullableString(row.created_at) ?? undefined,
    updatedAt: asNullableString(row.updated_at) ?? undefined,
  };
}

export function mapAsset(row: GenericRow): CreativeStudioAsset {
  return {
    id: String(row.id),
    campaignId: asNullableString(row.campaign_id),
    businessId: asNullableString(row.business_id),
    candidateId: asNullableString(row.candidate_id),
    offerKey: asOfferKey(row.offer_key),
    assetType: String(row.asset_type ?? "30_second_ugc_ad") as CreativeStudioAsset["assetType"],
    platform: String(row.platform ?? "facebook") as CreativePlatform,
    brandVoice: String(row.brand_voice ?? "homereach_executive") as CreativeBrandVoice,
    brandKitId: asNullableString(row.brand_kit_id),
    promptTemplateId: asNullableString(row.prompt_template_id),
    providerKey: String(row.provider_key ?? "mock"),
    providerJobId: asNullableString(row.provider_job_id),
    providerStatus: String(row.provider_status ?? "mock_ready"),
    promptUsed: String(row.prompt_used ?? ""),
    scriptUsed: String(row.script_used ?? ""),
    storyboard: asStoryboard(row.storyboard),
    caption: String(row.caption ?? ""),
    hashtags: asStringArray(row.hashtags),
    fileUrl: asNullableString(row.file_url),
    thumbnailUrl: asNullableString(row.thumbnail_url),
    status: String(row.status ?? "awaiting_review") as CreativeAssetStatus,
    approvalStatus: String(row.approval_status ?? "needs_review") as CreativeStudioAsset["approvalStatus"],
    complianceReviewStatus: String(row.compliance_review_status ?? "needs_review") as CreativeStudioAsset["complianceReviewStatus"],
    qualityScore: Number(row.quality_score ?? 0),
    bestUseCase: String(row.best_use_case ?? ""),
    strengths: asStringArray(row.strengths),
    weaknesses: asStringArray(row.weaknesses),
    recommendedImprovement: String(row.recommended_improvement ?? ""),
    approvalRecommendation: String(row.approval_recommendation ?? "revise") as CreativeStudioAsset["approvalRecommendation"],
    notes: asNullableString(row.notes),
    winningLabel: String(row.winning_label ?? "untested") as CreativeStudioAsset["winningLabel"],
    winningAsset: Boolean(row.winning_asset ?? false),
    savedToCampaign: Boolean(row.saved_to_campaign ?? false),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    approvedAt: asNullableString(row.approved_at),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapLog(row: GenericRow): CreativeGenerationLog {
  return {
    id: String(row.id),
    assetId: asNullableString(row.asset_id),
    providerKey: String(row.provider_key ?? "mock"),
    actionType: String(row.action_type ?? "generate"),
    status: String(row.status ?? "logged"),
    errorMessage: asNullableString(row.error_message),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapAutomationRule(row: GenericRow): CreativeAutomationRule {
  return {
    id: String(row.id),
    ruleKey: String(row.rule_key ?? ""),
    name: String(row.name ?? "Creative automation rule"),
    cadence: String(row.cadence ?? "manual"),
    assetType: String(row.asset_type ?? "30_second_ugc_ad") as CreativeAutomationRule["assetType"],
    platform: String(row.platform ?? "facebook") as CreativePlatform,
    enabled: Boolean(row.enabled ?? false),
    approvalRequired: Boolean(row.approval_required ?? true),
    status: String(row.status ?? "future_ready"),
    notes: asNullableString(row.notes),
  };
}

function mapCampaignReferences(rows: GenericRow[]): CreativeReferenceOption[] {
  return rows.slice(0, 80).map((row) => ({
    id: String(row.id),
    label: `Campaign ${String(row.id).slice(0, 8)}`,
    detail: String(row.status ?? "campaign"),
  }));
}

function mapBusinessReferences(rows: GenericRow[]): CreativeReferenceOption[] {
  return rows.slice(0, 80).map((row) => ({
    id: String(row.id),
    label: String(row.name ?? `Business ${String(row.id).slice(0, 8)}`),
    detail: String(row.status ?? "business"),
  }));
}

function mapCandidateReferences(rows: GenericRow[]): CreativeReferenceOption[] {
  return rows.slice(0, 80).map((row) => ({
    id: String(row.id),
    label: String(row.candidate_name ?? `Candidate ${String(row.id).slice(0, 8)}`),
    detail: [row.office_sought, row.state, row.candidate_status].filter(Boolean).map(String).join(" - "),
  }));
}

function asOfferKey(value: unknown): CreativeOfferKey {
  const raw = String(value ?? "procurement_dashboard");
  const allowed: CreativeOfferKey[] = [
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
  ];
  return allowed.includes(raw as CreativeOfferKey) ? (raw as CreativeOfferKey) : "procurement_dashboard";
}

function asStoryboard(value: unknown): CreativeStoryboardScene[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = isRecord(item) ? item : {};
    return {
      sceneNumber: Number(row.sceneNumber ?? row.scene_number ?? index + 1),
      visualDescription: String(row.visualDescription ?? row.visual_description ?? ""),
      voiceoverLine: String(row.voiceoverLine ?? row.voiceover_line ?? ""),
      textOverlay: String(row.textOverlay ?? row.text_overlay ?? ""),
      cameraStyle: String(row.cameraStyle ?? row.camera_style ?? ""),
      motionDirection: String(row.motionDirection ?? row.motion_direction ?? ""),
      cta: String(row.cta ?? ""),
      requiredBrandElements: asStringArray(row.requiredBrandElements ?? row.required_brand_elements),
    };
  });
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

