import type { NormalizedStormEvent } from "../types";
import {
  cleanText,
  detectEventType,
  inferStateFromProperties,
  parseHazardMetrics,
  splitAreaDescription,
  toIso,
  uniqueStrings,
  type WeatherProvider,
  type WeatherProviderFetchOptions,
  type WeatherProviderResult,
} from "./provider.types";

type NwsFeature = {
  id?: string;
  geometry?: Record<string, unknown> | null;
  properties?: Record<string, unknown>;
};

const DEFAULT_ALERTS_URL = "https://api.weather.gov/alerts/active";

function userAgent() {
  return (
    process.env.STORMREACH_NWS_USER_AGENT ||
    process.env.NWS_API_USER_AGENT ||
    "HomeReach StormReach (admin@home-reach.com)"
  );
}

function relevantEventType(title: string) {
  const normalized = cleanText(title).toLowerCase();
  if (
    normalized.includes("beach hazards") ||
    normalized.includes("rip current") ||
    normalized.includes("small craft advisory") ||
    normalized.includes("marine warning")
  ) {
    return null;
  }
  const eventType = detectEventType(title);
  return eventType === "unknown" ? null : eventType;
}

function mapFeature(feature: NwsFeature, now: Date): NormalizedStormEvent | null {
  const properties = feature.properties ?? {};
  const eventName = cleanText(properties.event);
  const headline = cleanText(properties.headline);
  const title = headline || eventName || "National Weather Service alert";
  const description = cleanText(properties.description ?? properties.instruction ?? "");
  const eventType = relevantEventType(`${eventName} ${headline}`);
  if (!eventType) return null;

  const area = cleanText(properties.areaDesc);
  const areaParts = splitAreaDescription(area);
  const id = cleanText(properties.id ?? feature.id ?? properties["@id"] ?? `${eventName}:${area}:${properties.sent}`);
  const sent = toIso(properties.sent) ?? now.toISOString();
  const startTime = toIso(properties.onset) ?? toIso(properties.effective) ?? sent;
  const endTime = toIso(properties.ends) ?? toIso(properties.expires);
  const state = inferStateFromProperties(properties);

  return {
    eventId: `nws:${id}`,
    eventType,
    source: "National Weather Service",
    sourceUrl: cleanText(properties["@id"] ?? DEFAULT_ALERTS_URL),
    title,
    description,
    startTime,
    endTime,
    detectedAt: sent,
    geographyType: feature.geometry ? "alert_polygon" : "forecast_zone",
    impactedPolygonGeojson: feature.geometry ?? {},
    impactedCounties: areaParts.counties,
    impactedCities: areaParts.cities,
    impactedZipCodes: [],
    impactedState: state,
    estimatedHouseholds: 0,
    estimatedHomeowners: 0,
    confidenceScore: confidenceFromNws(properties),
    sourcePayload: {
      provider: "nws",
      properties,
      geometryType: feature.geometry?.type ?? null,
    },
    hazardMetrics: parseHazardMetrics(`${title} ${description}`),
    metadata: {
      areaDescription: area,
      nwsSeverity: properties.severity ?? null,
      nwsUrgency: properties.urgency ?? null,
      nwsCertainty: properties.certainty ?? null,
      sourceStatus: properties.status ?? null,
    },
  };
}

function confidenceFromNws(properties: Record<string, unknown>) {
  const certainty = cleanText(properties.certainty).toLowerCase();
  const urgency = cleanText(properties.urgency).toLowerCase();
  let score = 70;
  if (certainty === "observed") score += 16;
  if (certainty === "likely") score += 10;
  if (urgency === "immediate") score += 10;
  if (urgency === "expected") score += 5;
  if (cleanText(properties.status).toLowerCase() === "actual") score += 5;
  return Math.min(100, score);
}

export const nwsProvider: WeatherProvider = {
  key: "nws",
  label: "National Weather Service Active Alerts",
  async fetchEvents(options: WeatherProviderFetchOptions = {}): Promise<WeatherProviderResult> {
    const state = cleanText(options.state).toUpperCase();
    const sourceUrl = nwsSourceUrl(state);
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/geo+json, application/json",
      },
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`NWS active alerts failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { features?: NwsFeature[] };
    const now = options.now ?? new Date();
    const events = (payload.features ?? [])
      .map((feature) => mapFeature(feature, now))
      .filter((event): event is NormalizedStormEvent => Boolean(event))
      .slice(0, options.limit ?? 250);

    return {
      provider: "nws",
      sourceUrl,
      events: dedupeByEventId(events),
      warnings: [],
    };
  },
};

export const __stormReachNwsTestUtils = {
  mapFeature,
  relevantEventType,
};

function nwsSourceUrl(state: string) {
  const sourceUrl = process.env.STORMREACH_NWS_ALERTS_URL || DEFAULT_ALERTS_URL;
  if (!state) return sourceUrl;
  try {
    const url = new URL(sourceUrl);
    if (!url.searchParams.has("area")) url.searchParams.set("area", state);
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

function dedupeByEventId(events: NormalizedStormEvent[]) {
  const map = new Map<string, NormalizedStormEvent>();
  for (const event of events) {
    const existing = map.get(event.eventId);
    if (!existing) {
      map.set(event.eventId, event);
      continue;
    }
    map.set(event.eventId, {
      ...existing,
      impactedCounties: uniqueStrings([...existing.impactedCounties, ...event.impactedCounties]),
      impactedCities: uniqueStrings([...existing.impactedCities, ...event.impactedCities]),
    });
  }
  return Array.from(map.values());
}
