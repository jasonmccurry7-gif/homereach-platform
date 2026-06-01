import type {
  CreativeAssetType,
  CreativeAutomationRule,
  CreativeBrandKit,
  CreativeBrandVoice,
  CreativeOfferKey,
  CreativePlatform,
  CreativePromptTemplate,
  CreativeStoryboardScene,
} from "./types";

export const creativeAssetTypes: Array<{ value: CreativeAssetType; label: string }> = [
  { value: "15_second_ugc_ad", label: "15-second UGC ad" },
  { value: "30_second_ugc_ad", label: "30-second UGC ad" },
  { value: "60_second_explainer_video", label: "60-second explainer video" },
  { value: "product_service_promo_video", label: "Product/service promo video" },
  { value: "political_campaign_intro_video", label: "Political campaign intro video" },
  { value: "local_business_testimonial_ad", label: "Local business testimonial-style ad" },
  { value: "facebook_group_post_creative", label: "Facebook group post creative" },
  { value: "static_image_ad", label: "Static image ad" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "postcard_qr_hero_image", label: "Postcard QR landing page hero image" },
  { value: "before_after_visual_concept", label: "Before/after visual concept" },
  { value: "campaign_offer_graphic", label: "Campaign offer graphic" },
  { value: "multi_language_version", label: "Multi-language version" },
  { value: "voiceover_script", label: "Voiceover script" },
  { value: "scene_by_scene_storyboard", label: "Scene-by-scene storyboard" },
];

export const creativePlatforms: Array<{ value: CreativePlatform; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "tiktok", label: "TikTok" },
  { value: "website", label: "Website" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "postcard_qr_landing_page", label: "Postcard QR landing page" },
];

export const creativeBrandVoices: Array<{ value: CreativeBrandVoice; label: string; detail: string }> = [
  {
    value: "homereach_executive",
    label: "HomeReach executive",
    detail: "Premium, concise, operational, and command-center oriented.",
  },
  {
    value: "procurement_margin_protection",
    label: "Procurement margin protection",
    detail: "Clear, ROI-aware, calm, and focused on hidden supply costs.",
  },
  {
    value: "local_business_practical",
    label: "Local business practical",
    detail: "Plain-spoken and action-first for busy owners.",
  },
  {
    value: "political_compliance_neutral",
    label: "Political compliance neutral",
    detail: "Geography, timing, cost, and logistics. No voter belief inference.",
  },
  {
    value: "government_contract_operator",
    label: "Government contract operator",
    detail: "Process-driven and compliance-aware for bid support.",
  },
  {
    value: "warm_follow_up",
    label: "Warm follow-up",
    detail: "Human, helpful, and low-pressure.",
  },
];

export const creativeOfferTemplates: Record<
  CreativeOfferKey,
  {
    label: string;
    promise: string;
    audience: string;
    painPoint: string;
    cta: string;
    guardrails: string[];
  }
> = {
  shared_postcards: {
    label: "Shared Postcard Ad",
    promise: "Local businesses sharing space on one high-visibility postcard mailed directly to homeowners.",
    audience: "local service businesses that need affordable neighborhood visibility",
    painPoint: "advertising is expensive, inconsistent, and hard to keep in front of homeowners",
    cta: "Reserve a shared postcard spot",
    guardrails: ["Do not guarantee leads.", "Keep category availability subject to review."],
  },
  targeted_mail: {
    label: "Targeted Mail Campaign",
    promise: "Reach the neighbors around your best customers with a focused direct mail campaign.",
    audience: "contractors and local businesses that want route-level homeowner reach",
    painPoint: "marketing spend gets wasted when it is too broad",
    cta: "Build a targeted campaign plan",
    guardrails: ["Do not promise exact delivery dates without operations confirmation."],
  },
  political_mail: {
    label: "Political Mail",
    promise: "Fast, clear campaign mail planning with route, geography, cost, and print execution visibility.",
    audience: "campaign teams, candidates, and consultants",
    painPoint: "campaign teams need speed, clarity, and operational discipline",
    cta: "Launch a campaign mail plan",
    guardrails: [
      "Do not infer voter beliefs.",
      "Do not create persuasion scoring.",
      "Do not make claims about opponents or voters unless campaign-provided and reviewed.",
    ],
  },
  procurement_dashboard: {
    label: "Inventory/Procurement Dashboard",
    promise: "Stop overpaying for supplies. Let HomeReach help compare vendors, track spend, and find savings.",
    audience: "restaurants, contractors, shops, and local businesses with recurring supply spend",
    painPoint: "rising supplier costs quietly eat margin before owners can see the pattern",
    cta: "Get a free supply cost review",
    guardrails: ["Do not guarantee savings.", "Do not imply vendor switching without approval."],
  },
  government_contracts: {
    label: "Government Contract Dashboard",
    promise: "Find, track, and prepare small business bids faster with AI-assisted contract opportunity workflows.",
    audience: "small businesses evaluating federal, state, or local contract opportunities",
    painPoint: "bid opportunities are hard to track, interpret, and prepare on time",
    cta: "Open a contract workflow",
    guardrails: ["Do not certify compliance.", "Do not imply bids are submitted automatically."],
  },
  facebook_group_post: {
    label: "Facebook Group Post",
    promise: "Create useful local content that starts a conversation without sounding automated.",
    audience: "local business owners and community group members",
    painPoint: "most group posts feel generic or salesy",
    cta: "Ask for a quick review",
    guardrails: ["No mass posting.", "Human approval required before posting."],
  },
  dm_followup: {
    label: "DM Follow-up Asset",
    promise: "Turn interest into a clear next step with helpful, personalized follow-up creative.",
    audience: "warm leads and local prospects",
    painPoint: "owners miss opportunities when follow-up is slow or unclear",
    cta: "Send a simple next-step message",
    guardrails: ["Do not send automatically.", "Respect opt-out and consent rules."],
  },
  short_form_video: {
    label: "Short-form Video Ad",
    promise: "Create premium vertical content that explains the offer quickly and drives a next step.",
    audience: "mobile-first local business and campaign audiences",
    painPoint: "short videos need a strong hook, clear offer, and fast visual rhythm",
    cta: "Approve the best variation",
    guardrails: ["No auto-posting.", "Avoid repetitive AI-looking content."],
  },
  local_business_promo: {
    label: "Local Business Promo Video",
    promise: "Show the business, the problem it solves, and the easy customer action in a polished local format.",
    audience: "homeowners and local customers",
    painPoint: "good local businesses struggle to look premium online",
    cta: "Book or call today",
    guardrails: ["Do not invent testimonials or customer results."],
  },
  candidate_explainer: {
    label: "Candidate/Campaign Explainer",
    promise: "Explain the campaign's geography, timing, and message with a clear approval-first storyboard.",
    audience: "campaign supporters, donors, and voters using campaign-provided context",
    painPoint: "campaign messages can get cluttered when timing is compressed",
    cta: "Review the campaign plan",
    guardrails: ["Campaign claims must be source-provided.", "Compliance review required before use."],
  },
  home_service_before_after: {
    label: "Before/After Home-service Ad",
    promise: "Frame the before/after transformation without fake claims or misleading imagery.",
    audience: "homeowners near completed jobs or service areas",
    painPoint: "homeowners need proof, clarity, and a simple reason to call",
    cta: "Request a local quote",
    guardrails: ["Do not fabricate before/after proof.", "Label concepts clearly if illustrative."],
  },
};

const storyboardSeed: CreativeStoryboardScene[] = [
  {
    sceneNumber: 1,
    visualDescription: "Mobile-first opening shot with dashboard, local storefront, or campaign route context.",
    voiceoverLine: "Most teams do not see the operational leak until it is already costing them.",
    textOverlay: "Hidden cost. Clear next step.",
    cameraStyle: "fast handheld or clean dashboard push-in",
    motionDirection: "quick zoom to the clearest pain point",
    cta: "Keep watching",
    requiredBrandElements: ["HomeReach mark", "high-contrast text"],
  },
  {
    sceneNumber: 2,
    visualDescription: "Show the specific HomeReach workflow: savings, routes, campaign plan, or content review.",
    voiceoverLine: "HomeReach turns the messy parts into a review-ready operating plan.",
    textOverlay: "Review-ready. Approval-first.",
    cameraStyle: "screen recording with premium overlays",
    motionDirection: "slide between three focused proof points",
    cta: "See the workflow",
    requiredBrandElements: ["approved CTA language", "brand color accent"],
  },
  {
    sceneNumber: 3,
    visualDescription: "End on a clear action card with offer, disclaimer, and next step.",
    voiceoverLine: "Start with one review before you spend more time or money.",
    textOverlay: "Request the review",
    cameraStyle: "stable final frame",
    motionDirection: "hold final CTA for readability",
    cta: "Request review",
    requiredBrandElements: ["CTA", "human approval note"],
  },
];

export const seedCreativeBrandKits: CreativeBrandKit[] = [
  {
    id: "seed-brand-homereach",
    name: "HomeReach",
    ownerType: "homereach",
    logoUrl: null,
    colors: ["#07111f", "#2563eb", "#10b981", "#ffffff"],
    tone: "Premium, operational, clear, executive, and local-business friendly.",
    fonts: ["Geist", "system sans-serif"],
    ctaLanguage: ["Get a Free Supply Cost Review", "Build My Campaign Plan", "Request Review"],
    offerLanguage: "HomeReach helps local businesses and campaigns protect margin, stay visible, and execute smarter.",
    forbiddenClaims: ["guaranteed leads", "guaranteed savings", "automatic publishing", "automatic bid submission"],
    requiredDisclaimerLanguage: ["Human approval required before sending, publishing, or paid usage."],
    status: "active",
  },
  {
    id: "seed-brand-procurement",
    name: "Supply Savings",
    ownerType: "inventory_procurement",
    logoUrl: null,
    colors: ["#052e2b", "#059669", "#e6fffb", "#111827"],
    tone: "Calm, ROI-aware, margin-protective, and practical.",
    fonts: ["Geist", "system sans-serif"],
    ctaLanguage: ["Get a Free Supply Cost Review", "Find Hidden Savings"],
    offerLanguage: "Stop overpaying for supplies through vendor comparison, spend tracking, and owner-visible workflows.",
    forbiddenClaims: ["guaranteed savings", "vendor switch without approval", "automatic ordering"],
    requiredDisclaimerLanguage: ["Savings examples are estimates until reviewed."],
    status: "active",
  },
  {
    id: "seed-brand-political",
    name: "Political Campaign",
    ownerType: "political_campaign",
    logoUrl: null,
    colors: ["#0f172a", "#dc2626", "#ffffff", "#2563eb"],
    tone: "Clear, disciplined, geography-aware, and compliance-first.",
    fonts: ["Geist", "system sans-serif"],
    ctaLanguage: ["Review Campaign Plan", "Approve Mail Plan"],
    offerLanguage: "Campaign mail planning with geography, cost, print, timing, and approval visibility.",
    forbiddenClaims: ["voter ideology inference", "persuasion scoring", "unsupported opponent claims"],
    requiredDisclaimerLanguage: ["Political creative requires human compliance review before use."],
    status: "active",
  },
  {
    id: "seed-brand-gov-contracts",
    name: "Government Contract Offer",
    ownerType: "government_contracts",
    logoUrl: null,
    colors: ["#0f172a", "#38bdf8", "#f8fafc", "#64748b"],
    tone: "Precise, compliance-aware, organized, and operator-friendly.",
    fonts: ["Geist", "system sans-serif"],
    ctaLanguage: ["Open Bid Workflow", "Review Opportunity Fit"],
    offerLanguage: "AI-assisted contract opportunity workflows for tracking, bid/no-bid review, and draft preparation.",
    forbiddenClaims: ["guaranteed award", "automatic bid submission", "certified compliance without review"],
    requiredDisclaimerLanguage: ["Submission and compliance decisions require human approval."],
    status: "active",
  },
];

export const seedCreativePromptTemplates: CreativePromptTemplate[] = Object.entries(creativeOfferTemplates).map(
  ([offerKey, offer], index) => ({
    id: `seed-prompt-${offerKey}`,
    templateKey: `${offerKey}_starter`,
    name: `${offer.label} starter workflow`,
    offerKey: offerKey as CreativeOfferKey,
    assetType: index % 3 === 0 ? "30_second_ugc_ad" : index % 3 === 1 ? "static_image_ad" : "scene_by_scene_storyboard",
    platform: "any",
    promptText: [
      `Create a premium HomeReach creative asset for: ${offer.promise}`,
      `Audience: ${offer.audience}.`,
      `Pain point: ${offer.painPoint}.`,
      `CTA: ${offer.cta}.`,
      `Guardrails: ${offer.guardrails.join(" ")}`,
    ].join("\n"),
    scriptSeed: `${offer.promise} The message should make the business or campaign feel clearer, safer, and easier to act on.`,
    storyboardSeed,
    complianceNotes: offer.guardrails.join(" "),
    status: "active",
  }),
);

export const seedCreativeAutomationRules: CreativeAutomationRule[] = [
  {
    id: "seed-rule-daily-facebook",
    ruleKey: "daily_facebook_post_draft",
    name: "Daily Facebook post draft",
    cadence: "daily",
    assetType: "facebook_group_post_creative",
    platform: "facebook",
    enabled: false,
    approvalRequired: true,
    status: "paused",
    notes: "Draft-only. Never posts without human approval.",
  },
  {
    id: "seed-rule-weekly-business-ads",
    ruleKey: "weekly_business_ad_variations",
    name: "Weekly business ad variations",
    cadence: "weekly",
    assetType: "30_second_ugc_ad",
    platform: "instagram",
    enabled: false,
    approvalRequired: true,
    status: "future_ready",
    notes: "Generates review queue items only.",
  },
  {
    id: "seed-rule-political-batch",
    ruleKey: "weekly_political_creative_batch",
    name: "Weekly political campaign creative batch",
    cadence: "weekly",
    assetType: "political_campaign_intro_video",
    platform: "facebook",
    enabled: false,
    approvalRequired: true,
    status: "future_ready",
    notes: "Requires campaign-provided claims and compliance review.",
  },
  {
    id: "seed-rule-monthly-postcard-pack",
    ruleKey: "monthly_postcard_promo_pack",
    name: "Monthly postcard campaign promo pack",
    cadence: "monthly",
    assetType: "campaign_offer_graphic",
    platform: "website",
    enabled: false,
    approvalRequired: true,
    status: "future_ready",
    notes: "Creates drafts for shared and targeted mail offers.",
  },
  {
    id: "seed-rule-lead-followup",
    ruleKey: "new_lead_followup_creative_draft",
    name: "New lead follow-up creative draft",
    cadence: "event_based",
    assetType: "static_image_ad",
    platform: "sms",
    enabled: false,
    approvalRequired: true,
    status: "future_ready",
    notes: "Never sends automatically. Approval and consent checks remain required.",
  },
];

export function labelForAssetType(value: CreativeAssetType) {
  return creativeAssetTypes.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function labelForPlatform(value: CreativePlatform) {
  return creativePlatforms.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function labelForBrandVoice(value: CreativeBrandVoice) {
  return creativeBrandVoices.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}
