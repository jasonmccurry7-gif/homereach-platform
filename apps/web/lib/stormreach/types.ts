export type StormEventType =
  | "hail"
  | "tornado"
  | "high_wind"
  | "hurricane_tropical_storm"
  | "flooding"
  | "winter_storm_ice"
  | "heat_wave"
  | "wildfire_smoke"
  | "severe_thunderstorm"
  | "derecho"
  | "unknown";

export type StormEventStatus =
  | "detected"
  | "scored"
  | "prospecting"
  | "outreach_ready"
  | "campaign_ready"
  | "launched"
  | "archived"
  | "dismissed";

export type StormSeverityLevel = "Low" | "Moderate" | "High" | "Extreme";

export type StormCampaignType =
  | "geofence_only"
  | "postcard_only"
  | "combined_geofence_postcard"
  | "emergency_first_to_market";

export type StormGeoJson = Record<string, unknown>;

export type StormHazardMetrics = {
  hailSizeInches?: number | null;
  windSpeedMph?: number | null;
  tornadoRating?: string | null;
  floodSeverity?: "minor" | "moderate" | "major" | "catastrophic" | null;
  snowIceSignal?: number | null;
};

export type NormalizedStormEvent = {
  eventId: string;
  eventType: StormEventType;
  source: string;
  sourceUrl?: string | null;
  title: string;
  description: string;
  startTime?: string | null;
  endTime?: string | null;
  detectedAt: string;
  geographyType: string;
  impactedPolygonGeojson: StormGeoJson;
  impactedCounties: string[];
  impactedCities: string[];
  impactedZipCodes: string[];
  impactedState?: string | null;
  estimatedHouseholds?: number;
  estimatedHomeowners?: number;
  confidenceScore?: number;
  sourcePayload?: Record<string, unknown>;
  hazardMetrics?: StormHazardMetrics;
  metadata?: Record<string, unknown>;
};

export type ScoredStormEvent = NormalizedStormEvent & {
  severityScore: number;
  severityLevel: StormSeverityLevel;
  scoringFactors: Record<string, number | string | null>;
};

export type IndustryMatch = {
  industry: string;
  matchScore: number;
  reason: string;
  adminOverride?: boolean;
};

export type StormBusinessProspectInput = {
  id?: string | null;
  sourceBusinessId?: string | null;
  sourceSalesLeadId?: string | null;
  sourceOutreachProspectId?: string | null;
  businessName: string;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  category: string;
  source: string;
  confidenceScore?: number;
  distanceToEvent?: number | null;
  priorContactStatus?: string | null;
  crmStatus?: string | null;
  suppressionStatus?: "unchecked" | "clear" | "suppressed" | "unknown";
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type StormOutreachDraft = {
  subject: string;
  body: string;
  variantKey: string;
  senderKey: "jason" | "josh" | "chelsi" | "heather";
  personalization: Record<string, string>;
  riskNotes: string[];
  approvalStatus: "needs_review";
};

export type StormMarketingPackageDraft = {
  packageName: string;
  packageType: StormCampaignType;
  industry: string;
  eventSummary: string;
  estimatedHouseholds: number;
  recommendedGeofenceRadiusMiles: number;
  recommendedPostcardQuantity: number;
  suggestedTimeline: string;
  suggestedBudgetCents: number;
  estimatedPriceToClientCents: number;
  revenueEstimateCents: number;
  emailDraft: string;
  smsDraft: string;
  landingPageCopy: string;
  postcardCopy: string;
  adCopy: string;
  metadata: Record<string, unknown>;
};

export type StormDashboardEvent = {
  id: string;
  event_id: string;
  event_type: StormEventType;
  source: string;
  source_url: string | null;
  title: string;
  description: string;
  start_time: string | null;
  end_time: string | null;
  detected_at: string;
  severity_score: number;
  severity_level: StormSeverityLevel;
  confidence_score: number;
  geography_type: string;
  impacted_polygon_geojson: StormGeoJson;
  impacted_counties: string[];
  impacted_cities: string[];
  impacted_zip_codes: string[];
  impacted_state: string | null;
  estimated_households: number;
  estimated_homeowners: number;
  recommended_industries: string[];
  recommended_campaigns: Record<string, unknown>[];
  status: StormEventStatus;
  approval_status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type StormDashboardData = {
  events: StormDashboardEvent[];
  prospects: Record<string, unknown>[];
  outreachMessages: Record<string, unknown>[];
  packages: Record<string, unknown>[];
  geofenceCampaigns: Record<string, unknown>[];
  postcardCampaigns: Record<string, unknown>[];
  generatedAssets: Record<string, unknown>[];
  agentRuns: Record<string, unknown>[];
  campaigns: Record<string, unknown>[];
  improvements: Record<string, unknown>[];
  metrics: {
    activeEvents: number;
    last24HourEvents: number;
    highOrExtremeEvents: number;
    prospectsReady: number;
    contractorProspectsReady: number;
    outreachDrafts: number;
    campaignPackages: number;
    generatedAssets: number;
    projectedRevenueCents: number;
  };
  providerStatus: Record<string, unknown>[];
  errors: string[];
};
