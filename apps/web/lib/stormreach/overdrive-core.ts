import { createHash } from "node:crypto";
import type { NormalizedStormEvent, ScoredStormEvent, StormBusinessProspectInput, StormDashboardEvent, StormEventType } from "./types";
import { STORMREACH_STORM_OUTREACH_INDUSTRIES } from "./prospecting";

export const STORMREACH_OVERDRIVE_SERVICE_CATEGORIES = STORMREACH_STORM_OUTREACH_INDUSTRIES;

export type OverdriveThreatScore = {
  score: number;
  label: "urgent" | "high" | "watch" | "inactive";
  color: "red" | "orange" | "yellow" | "gray";
  reasons: string[];
};

export type ManualStormEventInput = {
  eventType?: StormEventType | string | null;
  headline?: string | null;
  description?: string | null;
  windMph?: number | string | null;
  hailSize?: number | string | null;
  tornadoPossible?: boolean | string | null;
  state?: string | null;
  counties?: string[] | string | null;
  cities?: string[] | string | null;
  zipCodes?: string[] | string | null;
  startTime?: string | null;
  endTime?: string | null;
};

export function calculateOverdriveThreatScore(event: NormalizedStormEvent | StormDashboardEvent, context: {
  majorOutageArea?: boolean;
  highHouseholdDensity?: boolean;
  olderHousingStock?: boolean;
  overlapCount?: number;
} = {}): OverdriveThreatScore {
  const text = `${read(event, "title")} ${read(event, "description")} ${read(event, "event_type")}`.toLowerCase();
  const hazard = hazardMetrics(event);
  const wind = Number(hazard.windSpeedMph ?? 0);
  const hail = Number(hazard.hailSizeInches ?? 0);
  const households = Number(read(event, "estimated_households") ?? read(event, "estimatedHouseholds") ?? 0);
  const areaUnits = Math.max(1, arrayValue(read(event, "impacted_zip_codes") ?? read(event, "impactedZipCodes")).length || arrayValue(read(event, "impacted_cities") ?? read(event, "impactedCities")).length || arrayValue(read(event, "impacted_counties") ?? read(event, "impactedCounties")).length);
  const metadata = objectValue(read(event, "metadata"));
  const reasons: string[] = [];
  let score = Number(read(event, "severity_score") ?? read(event, "severityScore") ?? 0);

  if (String(read(event, "event_type") ?? read(event, "eventType")) === "tornado" || /tornado warning|confirmed tornado|radar indicated tornado/.test(text)) {
    score = 100;
    reasons.push("Tornado warning or tornado signal.");
  } else if (wind >= 75) {
    score = Math.max(score, 95);
    reasons.push("Wind threat 75 mph or higher.");
  } else if (wind >= 65) {
    score = Math.max(score, 90);
    reasons.push("Wind threat 65-74 mph.");
  } else if (wind >= 58) {
    score = Math.max(score, 80);
    reasons.push("Severe wind threshold 58-64 mph.");
  }

  if (hail >= 1) {
    score = Math.max(score, 90);
    reasons.push("Hail one inch or larger.");
  }
  if (context.majorOutageArea || metadata.major_outage_area === true || metadata.power_outage_signal === true) {
    score += 10;
    reasons.push("Major outage placeholder signal.");
  }
  if (context.highHouseholdDensity || households / areaUnits >= 7000) {
    score += 5;
    reasons.push("High household density placeholder.");
  }
  if (context.olderHousingStock || metadata.older_housing_stock_signal === true) {
    score += 5;
    reasons.push("Older housing stock placeholder.");
  }
  if ((context.overlapCount ?? Number(metadata.overlap_count ?? 0)) > 1) {
    score += 10;
    reasons.push("Multiple overlapping warnings or reports.");
  }

  const capped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: capped,
    label: capped >= 95 ? "urgent" : capped >= 80 ? "high" : capped >= 50 ? "watch" : "inactive",
    color: capped >= 95 ? "red" : capped >= 80 ? "orange" : capped >= 50 ? "yellow" : "gray",
    reasons: reasons.length ? reasons : ["No emergency Overdrive threshold matched yet."],
  };
}

export function recommendOverdriveServices(event: Pick<NormalizedStormEvent, "eventType" | "title" | "description"> | StormDashboardEvent) {
  void event;
  return [...STORMREACH_OVERDRIVE_SERVICE_CATEGORIES];
}

export function manualStormEventToNormalizedEvent(input: ManualStormEventInput, now = new Date()): NormalizedStormEvent {
  const state = normalizeState(input.state || process.env.STORMREACH_DEFAULT_STATE || "OH");
  const counties = stringList(input.counties);
  const cities = stringList(input.cities);
  const zipCodes = stringList(input.zipCodes);
  const eventType = normalizeEventType(input.eventType);
  const windMph = numberOrNull(input.windMph);
  const hailSize = numberOrNull(input.hailSize);
  const tornadoPossible = input.tornadoPossible === true || String(input.tornadoPossible ?? "").toLowerCase() === "true";
  const title = clean(input.headline) || `Manual ${eventType.replaceAll("_", " ")} event${state ? ` in ${state}` : ""}`;
  const description = clean(input.description) || "Manual StormReach Overdrive event entered by an admin.";
  const idSeed = [state, eventType, title, counties.join("|"), cities.join("|"), zipCodes.join("|"), input.startTime ?? now.toISOString()].join(":");
  const households = Math.max(1500, zipCodes.length * 3800, cities.length * 14000, counties.length * 55000);

  return {
    eventId: `manual-overdrive:${stableHash(idSeed)}`,
    eventType,
    source: "Manual StormReach Overdrive",
    sourceUrl: "/admin/stormreach",
    title,
    description,
    startTime: isoOrNow(input.startTime, now),
    endTime: toIso(input.endTime),
    detectedAt: now.toISOString(),
    geographyType: "manual_area",
    impactedPolygonGeojson: {},
    impactedCounties: counties,
    impactedCities: cities,
    impactedZipCodes: zipCodes,
    impactedState: state,
    estimatedHouseholds: households,
    estimatedHomeowners: Math.round(households * 0.64),
    confidenceScore: 72,
    hazardMetrics: {
      windSpeedMph: windMph,
      hailSizeInches: hailSize,
      tornadoRating: tornadoPossible ? "possible" : null,
    },
    sourcePayload: { provider: "manual_overdrive", raw: input },
    metadata: {
      overdrive_mode: true,
      manual_entry: true,
      tornado_possible: tornadoPossible,
      no_auto_send: true,
      human_approval_required: true,
    },
  };
}

export function buildOverdriveOutreachDraft(input: {
  channel: "email" | "sms" | "facebook_dm";
  event: Pick<ScoredStormEvent, "eventId" | "title" | "impactedCities" | "impactedCounties" | "impactedState">;
  prospect?: Partial<StormBusinessProspectInput> | null;
  category: string;
  sequence?: number;
}) {
  const area = areaLabel(input.event);
  const business = clean(input.prospect?.businessName) || "your team";
  const first = clean(input.prospect?.ownerName).split(/\s+/)[0] || business;
  const variant = `overdrive-${input.channel}-${(input.sequence ?? 0) + 1}`;
  const detailsCta = (input.sequence ?? 0) % 2 === 0 ? "reply \"storm\"" : "reply back";
  const riskNotes = [
    "Human approval required before sending.",
    "Do not claim confirmed damage unless verified by source.",
    "Use storm impacted, potential damage, or storm response language.",
    "Suppression and unsubscribe checks required before any send.",
  ];

  if (input.channel === "sms") {
    return {
      subject: null,
      body: `${overdriveSms(area, business)} Reply STOP to opt out.`,
      variantKey: variant,
      riskNotes,
    };
  }

  if (input.channel === "facebook_dm") {
    return {
      subject: null,
      body: `Hey ${business}, storms with damaging wind potential are moving through ${area} tonight. I am preparing StormReach campaigns for contractors who want to quickly reach impacted neighborhoods with geofence ads and postcard follow-up. Want details?`,
      variantKey: variant,
      riskNotes,
    };
  }

  return {
    subject: `Storm Damage Opportunity Alert - ${area}`,
    body: [
      `Hi ${first},`,
      "",
      `Severe storms with damaging wind potential moved through or are approaching ${area} tonight.`,
      "",
      "StormReach is identifying neighborhoods that may need help with roof, tree, siding, window, fence, and exterior property damage.",
      "",
      "We can help you move quickly with:",
      "- geofence ads around impacted neighborhoods",
      "- homeowner targeting",
      "- storm-response landing page",
      "- postcard follow-up within 24-48 hours",
      "- simple lead tracking",
      "",
      `If you want us to prepare a storm-response campaign for ${area}, ${detailsCta} and I will send the details.`,
      "",
      "Jason",
      "HomeReach / StormReach",
    ].join("\n"),
    variantKey: variant,
    riskNotes,
  };
}

export function overdrivePackagePresets(event: ScoredStormEvent, industry: string) {
  const area = areaLabel(event);
  const households = Math.max(1500, Number(event.estimatedHouseholds ?? 0));
  const mailQty = Math.min(5000, Math.max(500, Math.round(households * 0.12)));
  return [
    {
      packageName: "Rapid Geofence Launch",
      packageType: "geofence_only" as const,
      eventSummary: `${event.title}. StormReach Overdrive score ${calculateOverdriveThreatScore(event).score} for ${area}.`,
      recommendedPostcardQuantity: 0,
      suggestedTimeline: "Tonight/tomorrow after admin approval. Ready for external ad platform setup, not auto-launched.",
      suggestedBudgetCents: 125000,
      estimatedPriceToClientCents: 125000,
      revenueEstimateCents: 72500,
      postcardCopy: "Postcard follow-up can be added after the first response window.",
      adCopy: `Storm response help for ${area} homeowners. Fast local ${industry.toLowerCase()} support without pressure.`,
    },
    {
      packageName: "Storm Mail Follow-Up",
      packageType: "postcard_only" as const,
      eventSummary: `${event.title}. Target impacted ZIPs/routes after weather source review.`,
      recommendedPostcardQuantity: mailQty,
      suggestedTimeline: "24-48 hours after approval and route review.",
      suggestedBudgetCents: Math.round(mailQty * 145),
      estimatedPriceToClientCents: Math.round(mailQty * 145),
      revenueEstimateCents: Math.round(mailQty * 65),
      postcardCopy: `Storm come through your neighborhood? Local ${industry.toLowerCase()} help is available for a simple property check. Scan to request a fast estimate.`,
      adCopy: "Postcard-only follow-up package for impacted ZIPs and carrier routes.",
    },
    {
      packageName: "Full Storm Response Package",
      packageType: "combined_geofence_postcard" as const,
      eventSummary: `${event.title}. Full geofence + landing page + postcard + lead tracking package for ${area}.`,
      recommendedPostcardQuantity: mailQty,
      suggestedTimeline: "Approve tonight, geofence setup tomorrow, postcard follow-up in 24-48 hours after route review.",
      suggestedBudgetCents: 325000,
      estimatedPriceToClientCents: 325000,
      revenueEstimateCents: 188500,
      postcardCopy: `Need help after the recent storm? Fast help for roof, tree, siding, window, and exterior storm response in ${area}.`,
      adCopy: `${landingPageCopy(area)} CTA: Request a fast storm damage estimate.`,
    },
  ];
}

function overdriveSms(area: string, businessName: string) {
  return `Severe storms are moving through ${area} tonight. StormReach can help ${businessName} quickly target impacted neighborhoods with geofence ads + postcard follow-up. Want me to send details?`;
}

function landingPageCopy(area: string) {
  return [
    `Storm damage help for ${area} homeowners`,
    "Fast help for roof, tree, siding, window, and exterior storm damage.",
    "Request a fast storm damage estimate",
  ].join("\n");
}

function hazardMetrics(event: NormalizedStormEvent | StormDashboardEvent): NonNullable<ScoredStormEvent["hazardMetrics"]> {
  const metadata = objectValue(read(event, "metadata"));
  const direct = objectValue(read(event, "hazardMetrics"));
  const stored = objectValue(metadata.hazard_metrics);
  return { ...stored, ...direct };
}

function areaLabel(event: Pick<ScoredStormEvent, "impactedCities" | "impactedCounties" | "impactedState">) {
  return event.impactedCities[0] || event.impactedCounties[0]
    ? `${event.impactedCities[0] ?? event.impactedCounties[0]}${event.impactedState ? `, ${event.impactedState}` : ""}`
    : event.impactedState ?? "the impacted area";
}

function read(event: unknown, key: string) {
  return event && typeof event === "object" ? (event as Record<string, unknown>)[key] : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return unique(value.map(clean));
  return unique(String(value ?? "").split(/,|;|\n/).map(clean));
}

function normalizeEventType(value: string | null | undefined): StormEventType {
  const cleanValue = String(value ?? "severe_thunderstorm").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const allowed: StormEventType[] = ["hail", "tornado", "high_wind", "hurricane_tropical_storm", "flooding", "winter_storm_ice", "heat_wave", "wildfire_smoke", "severe_thunderstorm", "derecho", "unknown"];
  return allowed.includes(cleanValue as StormEventType) ? cleanValue as StormEventType : "severe_thunderstorm";
}

function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberOrNull(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isoOrNow(value: string | null | undefined, now: Date) {
  return toIso(value) ?? now.toISOString();
}

function toIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stableHash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

export const __stormReachOverdriveTestUtils = {
  calculateOverdriveThreatScore,
  recommendOverdriveServices,
  manualStormEventToNormalizedEvent,
  buildOverdriveOutreachDraft,
  overdrivePackagePresets,
};
