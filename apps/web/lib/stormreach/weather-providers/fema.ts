import type { NormalizedStormEvent } from "../types";
import {
  cleanText,
  detectEventType,
  parseHazardMetrics,
  toIso,
  type WeatherProvider,
  type WeatherProviderFetchOptions,
  type WeatherProviderResult,
} from "./provider.types";

const DEFAULT_FEMA_URL = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries";

type FemaRow = Record<string, unknown>;

function femaIncidentType(row: FemaRow) {
  const incident = cleanText(row.incidentType || row.incident_type || row.declarationTitle);
  const detected = detectEventType(incident);
  if (detected !== "unknown") return detected;
  const normalized = incident.toLowerCase();
  if (normalized.includes("fire")) return "wildfire_smoke";
  if (normalized.includes("snow") || normalized.includes("severe ice")) return "winter_storm_ice";
  if (normalized.includes("severe storm")) return "severe_thunderstorm";
  return "unknown";
}

function mapFemaDeclaration(row: FemaRow, now: Date): NormalizedStormEvent | null {
  const eventType = femaIncidentType(row);
  if (eventType === "unknown") return null;
  const disasterNumber = cleanText(row.disasterNumber || row.disaster_number);
  const state = cleanText(row.state);
  const county = cleanText(row.designatedArea || row.designated_area);
  const title = cleanText(row.declarationTitle || row.declaration_title || `${state} ${eventType} disaster declaration`);
  const declarationDate = toIso(row.declarationDate || row.declaration_date) ?? now.toISOString();
  const incidentBeginDate = toIso(row.incidentBeginDate || row.incident_begin_date) ?? declarationDate;
  const incidentEndDate = toIso(row.incidentEndDate || row.incident_end_date);

  return {
    eventId: `fema:${disasterNumber}:${state}:${county}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-"),
    eventType,
    source: "FEMA Disaster Declarations",
    sourceUrl: process.env.STORMREACH_FEMA_DECLARATIONS_URL || DEFAULT_FEMA_URL,
    title,
    description: `${title}. FEMA declaration ${disasterNumber}${county ? ` for ${county}` : ""}${state ? `, ${state}` : ""}.`,
    startTime: incidentBeginDate,
    endTime: incidentEndDate,
    detectedAt: declarationDate,
    geographyType: "fema_designated_area",
    impactedPolygonGeojson: {},
    impactedCounties: county ? [county.replace(/\s*\(County\)$/i, "")] : [],
    impactedCities: [],
    impactedZipCodes: [],
    impactedState: state || null,
    estimatedHouseholds: 0,
    estimatedHomeowners: 0,
    confidenceScore: 86,
    sourcePayload: { provider: "fema", row },
    hazardMetrics: parseHazardMetrics(title),
    metadata: {
      disasterNumber,
      declarationType: row.declarationType ?? row.declaration_type ?? null,
      incidentType: row.incidentType ?? row.incident_type ?? null,
      designatedArea: county || null,
    },
  };
}

function recentFilter(now: Date) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const iso = cutoff.toISOString().slice(0, 10);
  return `$filter=declarationDate ge '${iso}'&$orderby=declarationDate desc&$top=100`;
}

export const femaProvider: WeatherProvider = {
  key: "fema",
  label: "FEMA Disaster Declarations",
  async fetchEvents(options: WeatherProviderFetchOptions = {}): Promise<WeatherProviderResult> {
    const now = options.now ?? new Date();
    const baseUrl = process.env.STORMREACH_FEMA_DECLARATIONS_URL || DEFAULT_FEMA_URL;
    const sourceUrl = baseUrl.includes("$filter") || baseUrl.includes("?")
      ? baseUrl
      : `${baseUrl}?${recentFilter(now)}`;
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": process.env.STORMREACH_NWS_USER_AGENT || "HomeReach StormReach (admin@home-reach.com)",
        Accept: "application/json",
      },
      signal: options.signal,
    });
    if (!response.ok) {
      throw new Error(`FEMA declarations failed: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as { DisasterDeclarationsSummaries?: FemaRow[] };
    const rows = payload.DisasterDeclarationsSummaries ?? [];
    const events = rows
      .map((row) => mapFemaDeclaration(row, now))
      .filter((event): event is NormalizedStormEvent => Boolean(event))
      .slice(0, options.limit ?? 100);
    return {
      provider: "fema",
      sourceUrl,
      events,
      warnings: rows.length === 0 ? ["FEMA declaration feed returned no recent declarations."] : [],
    };
  },
};

export const __stormReachFemaTestUtils = {
  mapFemaDeclaration,
};
