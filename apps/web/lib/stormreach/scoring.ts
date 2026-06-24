import type { NormalizedStormEvent, ScoredStormEvent, StormSeverityLevel } from "./types";

const EVENT_BASE_SCORE: Record<string, number> = {
  hail: 48,
  tornado: 62,
  high_wind: 42,
  hurricane_tropical_storm: 68,
  flooding: 52,
  winter_storm_ice: 42,
  heat_wave: 38,
  wildfire_smoke: 44,
  severe_thunderstorm: 34,
  derecho: 66,
  unknown: 18,
};

export function severityLevel(score: number): StormSeverityLevel {
  if (score >= 84) return "Extreme";
  if (score >= 65) return "High";
  if (score >= 38) return "Moderate";
  return "Low";
}

export function scoreStormEvent(event: NormalizedStormEvent, now = new Date()): ScoredStormEvent {
  const hazard = event.hazardMetrics ?? {};
  const households = Math.max(0, Number(event.estimatedHouseholds ?? 0));
  const homeowners = Math.max(0, Number(event.estimatedHomeowners ?? 0));
  const zipCount = event.impactedZipCodes.length;
  const cityCount = event.impactedCities.length;
  const countyCount = event.impactedCounties.length;
  const base = EVENT_BASE_SCORE[event.eventType] ?? EVENT_BASE_SCORE.unknown ?? 18;
  const recency = recencyScore(event.detectedAt || event.startTime, now);
  const hail = hailScore(hazard.hailSizeInches);
  const wind = windScore(hazard.windSpeedMph);
  const tornado = tornadoScore(hazard.tornadoRating);
  const flood = floodScore(hazard.floodSeverity);
  const household = householdScore(households, homeowners);
  const density = densityProxyScore({ households, zipCount, cityCount, countyCount });
  const geography = Math.min(8, zipCount * 1.2 + cityCount * 0.8 + countyCount * 0.5);
  const competitiveUrgency = ["hail", "tornado", "hurricane_tropical_storm", "derecho"].includes(event.eventType) ? 8 : 4;
  const contractorDemand = contractorDemandScore(event.eventType);
  const confidenceAdjustment = Math.max(-8, Math.min(8, ((event.confidenceScore ?? 50) - 60) / 4));

  const raw =
    base +
    recency +
    hail +
    wind +
    tornado +
    flood +
    household +
    density +
    geography +
    competitiveUrgency +
    contractorDemand +
    confidenceAdjustment;
  const severityScore = clamp(raw);

  return {
    ...event,
    severityScore,
    severityLevel: severityLevel(severityScore),
    confidenceScore: clamp(event.confidenceScore ?? 50),
    scoringFactors: {
      base,
      recency,
      hail,
      wind,
      tornado,
      flood,
      household,
      density,
      geography,
      competitiveUrgency,
      contractorDemand,
      confidenceAdjustment: Number(confidenceAdjustment.toFixed(2)),
      hailSizeInches: hazard.hailSizeInches ?? null,
      windSpeedMph: hazard.windSpeedMph ?? null,
      tornadoRating: hazard.tornadoRating ?? null,
      floodSeverity: hazard.floodSeverity ?? null,
    },
  };
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recencyScore(value: string | null | undefined, now: Date) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const hours = Math.max(0, (now.getTime() - timestamp) / 36e5);
  if (hours <= 6) return 14;
  if (hours <= 24) return 11;
  if (hours <= 72) return 7;
  if (hours <= 168) return 3;
  return -4;
}

function hailScore(size?: number | null) {
  if (!size || !Number.isFinite(size)) return 0;
  if (size >= 2.75) return 24;
  if (size >= 2) return 19;
  if (size >= 1.5) return 14;
  if (size >= 1) return 9;
  return 3;
}

function windScore(speed?: number | null) {
  if (!speed || !Number.isFinite(speed)) return 0;
  if (speed >= 95) return 22;
  if (speed >= 80) return 17;
  if (speed >= 70) return 13;
  if (speed >= 58) return 8;
  return 2;
}

function tornadoScore(rating?: string | null) {
  if (!rating) return 0;
  const numeric = Number(rating.replace(/[^0-5]/g, ""));
  if (!Number.isFinite(numeric)) return 9;
  return [9, 14, 21, 27, 31, 34][numeric] ?? 9;
}

function floodScore(severity?: string | null) {
  if (severity === "catastrophic") return 26;
  if (severity === "major") return 19;
  if (severity === "moderate") return 12;
  if (severity === "minor") return 5;
  return 0;
}

function householdScore(households: number, homeowners: number) {
  const effective = Math.max(households, homeowners);
  if (effective >= 100000) return 17;
  if (effective >= 50000) return 13;
  if (effective >= 20000) return 9;
  if (effective >= 7500) return 5;
  if (effective >= 1500) return 2;
  return 0;
}

function densityProxyScore(input: { households: number; zipCount: number; cityCount: number; countyCount: number }) {
  if (!input.households) return 0;
  const areaUnits = Math.max(1, input.zipCount || input.cityCount || input.countyCount * 4 || 1);
  const householdsPerUnit = input.households / areaUnits;
  if (householdsPerUnit >= 9000) return 10;
  if (householdsPerUnit >= 5000) return 7;
  if (householdsPerUnit >= 2500) return 4;
  return 1;
}

function contractorDemandScore(eventType: string) {
  if (eventType === "hail") return 12;
  if (eventType === "tornado" || eventType === "derecho" || eventType === "hurricane_tropical_storm") return 11;
  if (eventType === "flooding") return 9;
  if (eventType === "winter_storm_ice") return 6;
  if (eventType === "heat_wave") return 7;
  if (eventType === "wildfire_smoke") return 5;
  if (eventType === "high_wind") return 8;
  return 3;
}

export const __stormReachScoringTestUtils = {
  hailScore,
  windScore,
  tornadoScore,
  floodScore,
  recencyScore,
};
