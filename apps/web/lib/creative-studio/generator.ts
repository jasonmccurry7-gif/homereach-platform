import "server-only";

import {
  creativeOfferTemplates,
  labelForAssetType,
  labelForBrandVoice,
  labelForPlatform,
} from "./templates";
import { getCreativeProviderAdapter, type CreativeProviderResult } from "./provider-adapter";
import type {
  CreativeGenerationInput,
  CreativeQualityReview,
  CreativeStoryboardScene,
} from "./types";

type CreativeDraft = {
  title: string;
  prompt: string;
  script: string;
  storyboard: CreativeStoryboardScene[];
  caption: string;
  hashtags: string[];
  qualityReview: CreativeQualityReview;
  provider: CreativeProviderResult;
};

export async function generateCreativeAssetDraft(
  input: CreativeGenerationInput,
  variationIndex = 0,
): Promise<CreativeDraft> {
  const requestId = crypto.randomUUID();
  const prompt = buildProviderPrompt(input, variationIndex);
  const script = buildScript(input, variationIndex);
  const storyboard = buildStoryboard(input, script, variationIndex);
  const caption = buildCaption(input, variationIndex);
  const qualityReview = scoreCreativeDraft(input, script, storyboard);
  const provider = await getCreativeProviderAdapter().generate({
    requestId,
    input,
    prompt,
    script,
    storyboard,
    qualityReview,
  });

  return {
    title: buildTitle(input, variationIndex),
    prompt,
    script,
    storyboard,
    caption,
    hashtags: buildHashtags(input),
    qualityReview,
    provider,
  };
}

export function clampVariationCount(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 1;
  return Math.max(1, Math.min(10, Math.round(numberValue)));
}

function buildTitle(input: CreativeGenerationInput, variationIndex: number) {
  const offer = creativeOfferTemplates[input.offerKey];
  const suffix = variationIndex > 0 ? ` Variation ${variationIndex + 1}` : "";
  return `${offer.label} ${labelForAssetType(input.assetType)}${suffix}`;
}

function buildProviderPrompt(input: CreativeGenerationInput, variationIndex: number) {
  const offer = creativeOfferTemplates[input.offerKey];
  const politicalGuardrail =
    input.offerKey === "political_mail" || input.assetType === "political_campaign_intro_video"
      ? "Political safeguards: use geography, timing, cost, logistics, and campaign-provided copy only. Do not infer voter beliefs, create ideology segments, or make unsourced claims."
      : "";

  return [
    `Create a ${labelForAssetType(input.assetType)} for ${offer.label}.`,
    `Platform: ${labelForPlatform(input.platform)}.`,
    `Brand voice: ${labelForBrandVoice(input.brandVoice)}.`,
    `Audience: ${input.audience?.trim() || offer.audience}.`,
    `Local market: ${input.localMarket?.trim() || "local HomeReach market"}.`,
    `Customer pain point: ${input.painPoint?.trim() || offer.painPoint}.`,
    `Campaign goal: ${input.campaignGoal?.trim() || "drive a review-ready next step"}.`,
    `Core promise: ${offer.promise}`,
    `CTA: ${offer.cta}`,
    `Guardrails: ${offer.guardrails.join(" ")}`,
    politicalGuardrail,
    input.advancedPrompt ? `Additional operator direction: ${input.advancedPrompt.slice(0, 1200)}` : "",
    `Variation direction: ${variationIndex % 3 === 0 ? "clarity-first" : variationIndex % 3 === 1 ? "emotion-first" : "ROI-proof-first"}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildScript(input: CreativeGenerationInput, variationIndex: number) {
  const offer = creativeOfferTemplates[input.offerKey];
  const audience = input.audience?.trim() || offer.audience;
  const pain = input.painPoint?.trim() || offer.painPoint;
  const goal = input.campaignGoal?.trim() || "turn interest into a review-ready next step";
  const opener =
    variationIndex % 3 === 0
      ? `Most ${audience} do not see the problem until it is already costing them.`
      : variationIndex % 3 === 1
        ? `There is a quieter way to get control of ${pain}.`
        : `Before you spend more, make the operating picture clear.`;

  const politicalLine =
    input.offerKey === "political_mail" || input.assetType === "political_campaign_intro_video"
      ? "This stays focused on geography, timing, cost, mail execution, and campaign-provided message review."
      : "";

  return [
    opener,
    `HomeReach helps with ${offer.promise.toLowerCase()}`,
    `The point is simple: ${goal}.`,
    politicalLine,
    `Start with a human-reviewed draft before anything is sent, posted, published, or launched.`,
    offer.cta,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildStoryboard(
  input: CreativeGenerationInput,
  script: string,
  variationIndex: number,
): CreativeStoryboardScene[] {
  const offer = creativeOfferTemplates[input.offerKey];
  const scenes = script.split(". ").filter(Boolean).slice(0, 4);
  const isPolitical = input.offerKey === "political_mail" || input.assetType === "political_campaign_intro_video";

  return [
    {
      sceneNumber: 1,
      visualDescription:
        input.offerKey === "procurement_dashboard"
          ? "Owner reviews a clean supplier spend dashboard with highlighted recurring categories."
          : input.offerKey === "targeted_mail"
            ? "Map route overlay around completed jobs and nearby homeowner clusters."
            : isPolitical
              ? "Campaign command view with geography, route, cost, and print timeline cards."
              : "Premium HomeReach command screen with local business or campaign context.",
      voiceoverLine: scenes[0] ?? offer.promise,
      textOverlay: variationIndex % 2 === 0 ? "See the hidden leak" : "Make the next move clear",
      cameraStyle: "mobile-native vertical push-in",
      motionDirection: "fast open, then hold text long enough to read",
      cta: "Keep watching",
      requiredBrandElements: ["HomeReach mark", "high-contrast text", "no unsupported guarantee"],
    },
    {
      sceneNumber: 2,
      visualDescription: "Show the structured workflow: intake, script, review queue, score, and approval status.",
      voiceoverLine: scenes[1] ?? "HomeReach turns the messy work into a review-ready operating plan.",
      textOverlay: "Review queue. Quality score. Approval gate.",
      cameraStyle: "dashboard walkthrough with subtle cursor movement",
      motionDirection: "slide across three workflow cards",
      cta: "Review the plan",
      requiredBrandElements: ["approval badge", "score label", "brand color accent"],
    },
    {
      sceneNumber: 3,
      visualDescription: "Cut to local context: owner, storefront, route map, campaign office, or bid workspace.",
      voiceoverLine: scenes[2] ?? `The goal is to ${offer.cta.toLowerCase()}.`,
      textOverlay: offer.cta,
      cameraStyle: "clean documentary-style shot or premium b-roll",
      motionDirection: "soft pan with CTA reveal",
      cta: offer.cta,
      requiredBrandElements: ["CTA", "platform-specific safe area"],
    },
    {
      sceneNumber: 4,
      visualDescription: "Final static end card with HomeReach identity, disclaimer, and next step.",
      voiceoverLine:
        scenes[3] ??
        "Nothing goes out automatically. Human approval stays in control before publishing or paid use.",
      textOverlay: "Human approval required before use",
      cameraStyle: "stable final frame",
      motionDirection: "hold for readability",
      cta: "Approve or revise",
      requiredBrandElements: ["HomeReach logo", "required disclaimer", "manual approval note"],
    },
  ];
}

function buildCaption(input: CreativeGenerationInput, variationIndex: number) {
  const offer = creativeOfferTemplates[input.offerKey];
  const hook =
    variationIndex % 2 === 0
      ? offer.painPoint
      : `A clearer operating workflow changes how ${offer.audience} decide what to do next.`;

  return [
    hook,
    "",
    offer.promise,
    "",
    `Next step: ${offer.cta}.`,
    "Generated as a draft for human review before use.",
  ].join("\n");
}

function buildHashtags(input: CreativeGenerationInput) {
  const base = ["HomeReach", "LocalBusiness", "OperationalExecution"];
  if (input.offerKey === "procurement_dashboard") return base.concat(["SupplySavings", "InventoryManagement"]);
  if (input.offerKey === "political_mail") return base.concat(["CampaignMail", "PoliticalCampaign"]);
  if (input.offerKey === "government_contracts") return base.concat(["GovernmentContracts", "BidSupport"]);
  if (input.platform === "tiktok" || input.platform === "youtube_shorts") return base.concat(["ShortFormVideo"]);
  return base.concat(["LocalMarketing"]);
}

function scoreCreativeDraft(
  input: CreativeGenerationInput,
  script: string,
  storyboard: CreativeStoryboardScene[],
): CreativeQualityReview {
  const hasSpecificAudience = Boolean(input.audience?.trim());
  const hasPain = Boolean(input.painPoint?.trim());
  const isPolitical = input.offerKey === "political_mail" || input.assetType === "political_campaign_intro_video";
  const ctaStrength = script.toLowerCase().includes("review") || script.toLowerCase().includes("plan") ? 8 : 7;
  const baseScore = 7 + (hasSpecificAudience ? 1 : 0) + (hasPain ? 1 : 0) - (isPolitical ? 1 : 0);
  const overallScore = Math.max(1, Math.min(10, baseScore));

  return {
    overallScore,
    bestUseCase: isPolitical
      ? "Review-ready political creative storyboard with compliance gate."
      : "First-pass creative draft for admin review and provider rendering.",
    strengths: [
      "Clear offer and CTA",
      "Human approval is explicit",
      "Storyboard is structured for a provider handoff",
    ],
    weaknesses: [
      hasSpecificAudience ? "Needs final local proof before publishing" : "Audience should be more specific before final use",
      isPolitical ? "Political claims require campaign-provided source review" : "Rendered visuals still need provider output review",
    ],
    recommendedImprovement: isPolitical
      ? "Add campaign-provided copy, disclaimer language, and compliance notes before approval."
      : "Add a real business, campaign, or dashboard asset before final export.",
    approvalRecommendation: overallScore >= 8 && !isPolitical ? "approve" : "revise",
    checklist: {
      visualQuality: 7,
      brandConsistency: 8,
      messageClarity: hasPain ? 9 : 8,
      offerClarity: 9,
      ctaStrength,
      platformFit: input.platform === "sms" && input.assetType.includes("video") ? 5 : 8,
      motionQuality: storyboard.length >= 3 ? 8 : 6,
      textReadability: 8,
      professionalAppearance: 8,
      visualErrorRisk: 7,
    },
  };
}
