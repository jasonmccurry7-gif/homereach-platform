import { buildPostcardDraft } from "./packages";
import type { ScoredStormEvent } from "./types";

export { buildPostcardDraft };

export function buildUspsEddmPlanningUrl(zipCode?: string | null) {
  const baseUrl = process.env.STORMREACH_USPS_EDDM_URL || "https://eddm.usps.com/eddm/select-routes.htm";
  const url = new URL(baseUrl);
  if (zipCode) url.searchParams.set("searchInput", zipCode);
  return url.toString();
}

export function buildPostcardRoutePlanningMetadata(event: ScoredStormEvent, industry: string) {
  return {
    industry,
    zipCodes: event.impactedZipCodes,
    counties: event.impactedCounties,
    cities: event.impactedCities,
    uspsEddmUrl: buildUspsEddmPlanningUrl(event.impactedZipCodes[0]),
    routePlanningStatus: "manual_review_required",
    humanApprovalRequired: true,
  };
}

export const POSTCARD_CAMPAIGN_ENGINE_GUARDRAILS = {
  uspsCarrierRoutesRequireManualReview: true,
  noPostcardOrderWithoutApproval: true,
  noDamageGuarantees: true,
};
