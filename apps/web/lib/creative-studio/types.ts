export type CreativeOfferKey =
  | "shared_postcards"
  | "targeted_mail"
  | "political_mail"
  | "procurement_dashboard"
  | "government_contracts"
  | "facebook_group_post"
  | "dm_followup"
  | "short_form_video"
  | "local_business_promo"
  | "candidate_explainer"
  | "home_service_before_after";

export type CreativeAssetType =
  | "15_second_ugc_ad"
  | "30_second_ugc_ad"
  | "60_second_explainer_video"
  | "product_service_promo_video"
  | "political_campaign_intro_video"
  | "local_business_testimonial_ad"
  | "facebook_group_post_creative"
  | "static_image_ad"
  | "thumbnail"
  | "postcard_qr_hero_image"
  | "before_after_visual_concept"
  | "campaign_offer_graphic"
  | "multi_language_version"
  | "voiceover_script"
  | "scene_by_scene_storyboard";

export type CreativePlatform =
  | "facebook"
  | "instagram"
  | "youtube_shorts"
  | "tiktok"
  | "website"
  | "email"
  | "sms"
  | "postcard_qr_landing_page";

export type CreativeBrandVoice =
  | "homereach_executive"
  | "procurement_margin_protection"
  | "local_business_practical"
  | "political_compliance_neutral"
  | "government_contract_operator"
  | "warm_follow_up";

export type CreativeAssetStatus =
  | "draft"
  | "generating"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "needs_revision"
  | "archived";

export type CreativeApprovalRecommendation = "approve" | "revise" | "reject";

export type CreativeStoryboardScene = {
  sceneNumber: number;
  visualDescription: string;
  voiceoverLine: string;
  textOverlay: string;
  cameraStyle: string;
  motionDirection: string;
  cta: string;
  requiredBrandElements: string[];
};

export type CreativeQualityReview = {
  overallScore: number;
  bestUseCase: string;
  strengths: string[];
  weaknesses: string[];
  recommendedImprovement: string;
  approvalRecommendation: CreativeApprovalRecommendation;
  checklist: {
    visualQuality: number;
    brandConsistency: number;
    messageClarity: number;
    offerClarity: number;
    ctaStrength: number;
    platformFit: number;
    motionQuality: number;
    textReadability: number;
    professionalAppearance: number;
    visualErrorRisk: number;
  };
};

export type CreativeGenerationInput = {
  campaignId?: string | null;
  businessId?: string | null;
  candidateId?: string | null;
  offerKey: CreativeOfferKey;
  assetType: CreativeAssetType;
  platform: CreativePlatform;
  brandVoice: CreativeBrandVoice;
  brandKitId?: string | null;
  audience?: string;
  localMarket?: string;
  painPoint?: string;
  campaignGoal?: string;
  language?: string;
  variationCount?: number;
  advancedPrompt?: string;
};

export type CreativeProviderStatus = {
  providerKey: string;
  displayName: string;
  configured: boolean;
  mode: "mock" | "adapter_ready" | "not_configured";
  message: string;
};

export type CreativeBrandKit = {
  id: string;
  name: string;
  ownerType: string;
  logoUrl: string | null;
  colors: string[];
  tone: string;
  fonts: string[];
  ctaLanguage: string[];
  offerLanguage: string;
  forbiddenClaims: string[];
  requiredDisclaimerLanguage: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreativePromptTemplate = {
  id: string;
  templateKey: string;
  name: string;
  offerKey: CreativeOfferKey;
  assetType: CreativeAssetType;
  platform: CreativePlatform | "any";
  promptText: string;
  scriptSeed: string;
  storyboardSeed: CreativeStoryboardScene[];
  complianceNotes: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreativeStudioAsset = {
  id: string;
  campaignId: string | null;
  businessId: string | null;
  candidateId: string | null;
  offerKey: CreativeOfferKey;
  assetType: CreativeAssetType;
  platform: CreativePlatform;
  brandVoice: CreativeBrandVoice;
  brandKitId: string | null;
  promptTemplateId: string | null;
  providerKey: string;
  providerJobId: string | null;
  providerStatus: string;
  promptUsed: string;
  scriptUsed: string;
  storyboard: CreativeStoryboardScene[];
  caption: string;
  hashtags: string[];
  fileUrl: string | null;
  thumbnailUrl: string | null;
  status: CreativeAssetStatus;
  approvalStatus: "needs_review" | "approved" | "rejected" | "needs_revision";
  complianceReviewStatus: "not_required" | "needs_review" | "approved" | "blocked";
  qualityScore: number;
  bestUseCase: string;
  strengths: string[];
  weaknesses: string[];
  recommendedImprovement: string;
  approvalRecommendation: CreativeApprovalRecommendation;
  notes: string | null;
  winningLabel: "untested" | "winner" | "loser" | "control";
  winningAsset: boolean;
  savedToCampaign: boolean;
  metadata: Record<string, unknown>;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreativeGenerationLog = {
  id: string;
  assetId: string | null;
  providerKey: string;
  actionType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type CreativeAutomationRule = {
  id: string;
  ruleKey: string;
  name: string;
  cadence: string;
  assetType: CreativeAssetType;
  platform: CreativePlatform;
  enabled: boolean;
  approvalRequired: boolean;
  status: string;
  notes: string | null;
};

export type CreativeReferenceOption = {
  id: string;
  label: string;
  detail?: string | null;
};

export type CreativeStudioCommandCenterData = {
  schemaReady: boolean;
  featureEnabled: boolean;
  migrationHint: string | null;
  warnings: string[];
  providerStatus: CreativeProviderStatus;
  brandKits: CreativeBrandKit[];
  promptTemplates: CreativePromptTemplate[];
  assets: CreativeStudioAsset[];
  generationLogs: CreativeGenerationLog[];
  automationRules: CreativeAutomationRule[];
  references: {
    campaigns: CreativeReferenceOption[];
    businesses: CreativeReferenceOption[];
    candidates: CreativeReferenceOption[];
  };
  reusedSystems: string[];
  safetyNotes: string[];
};

