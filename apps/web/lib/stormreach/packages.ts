import { randomBytes } from "node:crypto";
import type { ScoredStormEvent, StormCampaignType, StormMarketingPackageDraft } from "./types";
import { eventTypeLabel, impactedAreaLabel } from "./outreach";

type Tier = {
  name: string;
  type: StormCampaignType;
  geofenceImpressions: number;
  postcards: number;
  basePriceCents: number;
};

const DEFAULT_TIERS: Tier[] = [
  {
    name: "Starter",
    type: "combined_geofence_postcard",
    geofenceImpressions: 5000,
    postcards: 500,
    basePriceCents: 95000,
  },
  {
    name: "Growth",
    type: "combined_geofence_postcard",
    geofenceImpressions: 25000,
    postcards: 2500,
    basePriceCents: 325000,
  },
  {
    name: "Market Leader",
    type: "combined_geofence_postcard",
    geofenceImpressions: 75000,
    postcards: 5000,
    basePriceCents: 725000,
  },
  {
    name: "Emergency First-to-Market",
    type: "emergency_first_to_market",
    geofenceImpressions: 100000,
    postcards: 7500,
    basePriceCents: 995000,
  },
];

export function buildStormMarketingPackages(event: ScoredStormEvent, industry: string): StormMarketingPackageDraft[] {
  return DEFAULT_TIERS.map((tier) => buildPackage(event, industry, tier));
}

export function recommendedGeofenceRadiusMiles(event: Pick<ScoredStormEvent, "severityLevel" | "severityScore" | "eventType">) {
  if (event.severityLevel === "Extreme") return 15;
  if (event.severityLevel === "High") return 10;
  if (event.eventType === "hurricane_tropical_storm" || event.eventType === "derecho") return 12;
  return 5;
}

export function estimateCampaignRevenueCents(event: Pick<ScoredStormEvent, "severityLevel" | "estimatedHouseholds">, industryCount: number) {
  const base = event.severityLevel === "Extreme" ? 995000 : event.severityLevel === "High" ? 325000 : 95000;
  const householdMultiplier = Math.min(3, Math.max(1, Math.round(Number(event.estimatedHouseholds ?? 0) / 25000)));
  return base * Math.max(1, industryCount) * householdMultiplier;
}

export function buildGeofenceExport(event: ScoredStormEvent, industry: string, packageId?: string | null) {
  const zips = event.impactedZipCodes ?? [];
  const households = Number(event.estimatedHouseholds ?? 0);
  const homeowners = Number(event.estimatedHomeowners ?? 0);
  const audience = Math.max(homeowners, Math.round(households * 0.7));
  return {
    polygonGeojson: event.impactedPolygonGeojson ?? {},
    selectedZipCodes: zips,
    radiusMiles: recommendedGeofenceRadiusMiles(event),
    estimatedAudienceSize: audience,
    exportGeojson: event.impactedPolygonGeojson ?? {},
    exportZipCsv: zips.join(","),
    campaignBrief: [
      `StormReach geofence setup for ${industry}.`,
      `Event: ${event.title}`,
      `Area: ${impactedAreaLabel(event)}`,
      `Audience estimate: ${audience}`,
      "Human approval required before external ad platform setup or paid launch.",
    ].join("\n"),
    metadata: {
      package_id: packageId ?? null,
      source_event_id: event.eventId,
      no_auto_launch: true,
    },
  };
}

export function buildPostcardDraft(event: ScoredStormEvent, industry: string, packageId?: string | null) {
  const area = impactedAreaLabel(event);
  const quantity = recommendedPostcardQuantity(event);
  return {
    headline: postcardHeadline(event, industry),
    body: `Severe weather moved through ${area} recently. If you are checking your property, local ${industry.toLowerCase()} help is available for a simple inspection or repair conversation.`,
    cta: "Scan to request a quick review",
    imageDirection: `Helpful, calm ${industry.toLowerCase()} service visual in a real neighborhood setting. Avoid fear, disaster imagery, and insurance-claim framing.`,
    mailQuantity: quantity,
    estimatedPrintPostageCostCents: Math.round(quantity * Number(process.env.STORMREACH_POSTCARD_COST_CENTS ?? 72)),
    estimatedPriceToClientCents: Math.round(quantity * Number(process.env.STORMREACH_POSTCARD_PRICE_CENTS ?? 145)),
    campaignTimeline: "Approve creative, export impacted household list, print, and mail within 3 to 7 business days when data and artwork are ready.",
    metadata: {
      package_id: packageId ?? null,
      source_event_id: event.eventId,
      human_approval_required: true,
    },
  };
}

export function createProposalToken() {
  return randomBytes(18).toString("hex");
}

function buildPackage(event: ScoredStormEvent, industry: string, tier: Tier): StormMarketingPackageDraft {
  const area = impactedAreaLabel(event);
  const label = eventTypeLabel(event.eventType);
  const households = Math.max(0, event.estimatedHouseholds ?? 0);
  const postcardQuantity = Math.min(tier.postcards, recommendedPostcardQuantity(event, tier.postcards));
  const suggestedBudget = tier.basePriceCents;
  const revenueEstimate = Math.round(suggestedBudget * 0.58);

  return {
    packageName: `${tier.name} ${industry} StormReach Package`,
    packageType: tier.type,
    industry,
    eventSummary: `${event.title}. ${label} activity was detected near ${area}. Source: ${event.source}. Confidence ${event.confidenceScore}%.`,
    estimatedHouseholds: households,
    recommendedGeofenceRadiusMiles: recommendedGeofenceRadiusMiles(event),
    recommendedPostcardQuantity: postcardQuantity,
    suggestedTimeline: tier.type === "emergency_first_to_market"
      ? "Review today, geofence export ready same day, postcard follow-up queued after approval."
      : "Review within 24 hours, launch geofence after approval, mail postcards within 3 to 7 business days.",
    suggestedBudgetCents: suggestedBudget,
    estimatedPriceToClientCents: suggestedBudget,
    revenueEstimateCents: revenueEstimate,
    emailDraft: `Short contractor outreach for ${industry} in ${area}. Human approval required before sending.`,
    smsDraft: `StormReach map ready for ${area}. Want the quick geofence + postcard option? Reply STOP to opt out.`,
    landingPageCopy: `Severe weather moved through ${area} recently. This campaign helps your ${industry.toLowerCase()} business show up in front of homeowners who may be checking their property, using geofenced ads first and targeted postcards as the follow-up.`,
    postcardCopy: postcardHeadline(event, industry),
    adCopy: `Recent ${label} near ${area}? Local ${industry.toLowerCase()} help is available for a simple property check.`,
    metadata: {
      tier: tier.name,
      geofence_impressions: tier.geofenceImpressions,
      no_auto_charge: true,
      no_auto_launch: true,
      human_approval_required: true,
    },
  };
}

function postcardHeadline(event: Pick<ScoredStormEvent, "eventType">, industry: string) {
  if (/roof/i.test(industry)) return event.eventType === "hail" ? "Need your roof checked after the recent hail?" : "Storm come through your neighborhood?";
  if (/water|mold/i.test(industry)) return "Water or moisture concerns after the storm?";
  if (/tree/i.test(industry)) return "Need help cleaning up after the recent storm?";
  if (/hvac|insulation/i.test(industry)) return event.eventType === "heat_wave" ? "Keeping your home comfortable during the heat?" : "Need help after the recent weather?";
  if (/generator|electrical/i.test(industry)) return "Thinking about backup power after recent weather?";
  if (/debris|junk/i.test(industry)) return "Need cleanup help after the recent storm?";
  return "Local help for storm-related home repairs.";
}

function recommendedPostcardQuantity(event: Pick<ScoredStormEvent, "severityLevel" | "estimatedHouseholds">, cap = 5000) {
  const households = Number(event.estimatedHouseholds ?? 0);
  const severityFloor = event.severityLevel === "Extreme" ? 5000 : event.severityLevel === "High" ? 2500 : 500;
  const quantity = Math.max(severityFloor, Math.min(cap, Math.round(households * 0.18)));
  return Math.max(250, Math.min(cap, quantity || severityFloor));
}
