import { eventTypeLabel, generateStormOutreachDraft, generateStormSubject, impactedAreaLabel } from "./outreach";

export { eventTypeLabel, generateStormOutreachDraft, generateStormSubject, impactedAreaLabel };

export const CATEGORY_OUTREACH_PROFILES: Record<string, { serviceContext: string; riskNote: string }> = {
  roofing: {
    serviceContext: "roof inspections, shingle issues, gutters, and exterior repair conversations",
    riskNote: "Do not promise roof damage exists or reference insurance claim guarantees.",
  },
  "tree service": {
    serviceContext: "downed limbs, cleanup, trimming, and property access",
    riskNote: "Do not imply an emergency response relationship or government affiliation.",
  },
  restoration: {
    serviceContext: "cleanup, drying, smoke, water, and storm-related restoration",
    riskNote: "Do not use disaster exploitation language or claim damage at a specific home.",
  },
  hvac: {
    serviceContext: "heating, cooling, filter, and comfort checks",
    riskNote: "Keep heat, smoke, or cold-weather claims source-backed and general.",
  },
  plumbing: {
    serviceContext: "pipes, sump pumps, backups, drainage, and freeze-related issues",
    riskNote: "Do not imply a property has water damage unless the source supports area-level impact only.",
  },
  generators: {
    serviceContext: "backup power, outage preparedness, and generator installation",
    riskNote: "Do not predict outages or guarantee availability.",
  },
  "gutters/siding/windows": {
    serviceContext: "gutters, siding, windows, screens, and exterior checks",
    riskNote: "Avoid language that says a recipient's customers definitely have storm damage.",
  },
  "basement waterproofing": {
    serviceContext: "basement moisture, sump systems, waterproofing, and drainage",
    riskNote: "Do not claim flooding occurred inside any individual home.",
  },
  "junk/debris removal": {
    serviceContext: "cleanup, debris removal, yard waste, and property access",
    riskNote: "Avoid emergency-service impersonation and fear-based cleanup claims.",
  },
};

export const OUTREACH_DRAFT_ENGINE_GUARDRAILS = {
  humanReviewRequiredByDefault: true,
  variantsRequired: true,
  unsubscribeOrReplyNoRequired: true,
  sourceClaimsMustBeTraceable: true,
};
