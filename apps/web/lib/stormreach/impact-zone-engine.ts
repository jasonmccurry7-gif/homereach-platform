import { eventCentroid } from "./geo";
import { buildGeofenceExport, recommendedGeofenceRadiusMiles } from "./packages";
import type { ScoredStormEvent } from "./types";

export type CensusGeographyLookupInput = {
  longitude: number;
  latitude: number;
  benchmark?: string;
  vintage?: string;
};

export function buildImpactZoneSummary(event: ScoredStormEvent) {
  const centroid = eventCentroid(event);
  return {
    geographyType: event.geographyType,
    centroid,
    state: event.impactedState,
    counties: event.impactedCounties,
    cities: event.impactedCities,
    zipCodes: event.impactedZipCodes,
    estimatedHouseholds: event.estimatedHouseholds ?? 0,
    estimatedHomeowners: event.estimatedHomeowners ?? 0,
    confidenceScore: event.confidenceScore ?? 50,
    recommendedGeofenceRadiusMiles: recommendedGeofenceRadiusMiles(event),
    polygonGeojson: event.impactedPolygonGeojson ?? {},
  };
}

export function buildCensusGeographyUrl(input: CensusGeographyLookupInput) {
  const baseUrl = process.env.STORMREACH_CENSUS_GEOCODER_URL || "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
  const url = new URL(baseUrl);
  url.searchParams.set("x", String(input.longitude));
  url.searchParams.set("y", String(input.latitude));
  url.searchParams.set("benchmark", input.benchmark || "Public_AR_Current");
  url.searchParams.set("vintage", input.vintage || "Current_Current");
  url.searchParams.set("format", "json");
  return url.toString();
}

export function buildImpactGeofenceExport(event: ScoredStormEvent, industry: string, packageId?: string | null) {
  return buildGeofenceExport(event, industry, packageId);
}

export const IMPACT_ZONE_ENGINE_GUARDRAILS = {
  adminCanEditBeforeCampaign: true,
  censusBoundaryLookupOptional: true,
  uspsCarrierRoutesRequireApprovedTooling: true,
};
