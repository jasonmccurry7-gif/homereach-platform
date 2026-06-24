import type { NormalizedStormEvent } from "../types";
import {
  cleanText,
  detectEventType,
  parseHazardMetrics,
  splitAreaDescription,
  toIso,
  type WeatherProvider,
  type WeatherProviderFetchOptions,
  type WeatherProviderResult,
} from "./provider.types";

const DEFAULT_IPAWS_CAP_URL = "";

function configuredUrl() {
  return process.env.STORMREACH_FEMA_IPAWS_CAP_URL || DEFAULT_IPAWS_CAP_URL;
}

function mapCapAlert(alertXml: string, now: Date, sourceUrl: string): NormalizedStormEvent | null {
  const identifier = textOf(alertXml, "identifier") || textOf(alertXml, "id");
  const sent = toIso(textOf(alertXml, "sent")) ?? now.toISOString();
  const status = textOf(alertXml, "status");
  const msgType = textOf(alertXml, "msgType");
  const scope = textOf(alertXml, "scope");
  const infoXml = firstBlock(alertXml, "info") || alertXml;
  const eventName = textOf(infoXml, "event");
  const headline = textOf(infoXml, "headline");
  const description = textOf(infoXml, "description") || textOf(infoXml, "instruction");
  const eventType = detectEventType(`${eventName} ${headline} ${description}`);
  if (eventType === "unknown") return null;

  const areaBlocks = blocks(infoXml, "area");
  const areaDescriptions = areaBlocks.map((block) => textOf(block, "areaDesc")).filter(Boolean);
  const areaParts = areaDescriptions.flatMap((area) => {
    const split = splitAreaDescription(area);
    return [...split.counties.map((county) => ({ county, city: "" })), ...split.cities.map((city) => ({ county: "", city }))];
  });
  const counties = unique(areaParts.map((part) => part.county).filter(Boolean));
  const cities = unique(areaParts.map((part) => part.city).filter(Boolean)).slice(0, 20);
  const polygonText = areaBlocks.map((block) => textOf(block, "polygon")).find(Boolean);
  const state = inferStateFromCap(areaBlocks.join("\n"), areaDescriptions.join(" "));
  const title = headline || eventName || "FEMA IPAWS public alert";
  const id = identifier || `${eventName}:${areaDescriptions[0] ?? ""}:${sent}`;

  return {
    eventId: `fema-ipaws:${id}`.toLowerCase().replace(/[^a-z0-9:.-]+/g, "-"),
    eventType,
    source: "FEMA IPAWS CAP",
    sourceUrl,
    title,
    description,
    startTime: toIso(textOf(infoXml, "onset")) ?? toIso(textOf(infoXml, "effective")) ?? sent,
    endTime: toIso(textOf(infoXml, "expires")),
    detectedAt: sent,
    geographyType: polygonText ? "cap_polygon" : "cap_area",
    impactedPolygonGeojson: polygonText ? capPolygonToGeoJson(polygonText) : {},
    impactedCounties: counties,
    impactedCities: cities,
    impactedZipCodes: [],
    impactedState: state,
    estimatedHouseholds: 0,
    estimatedHomeowners: 0,
    confidenceScore: confidenceFromCap(infoXml, status),
    sourcePayload: {
      provider: "fema_ipaws",
      identifier,
      status,
      msgType,
      scope,
      areaDescriptions,
    },
    hazardMetrics: parseHazardMetrics(`${eventName} ${headline} ${description}`),
    metadata: {
      cap_event: eventName || null,
      cap_urgency: textOf(infoXml, "urgency") || null,
      cap_severity: textOf(infoXml, "severity") || null,
      cap_certainty: textOf(infoXml, "certainty") || null,
      source_status: status || null,
    },
  };
}

function confidenceFromCap(infoXml: string, status: string) {
  const urgency = textOf(infoXml, "urgency").toLowerCase();
  const severity = textOf(infoXml, "severity").toLowerCase();
  const certainty = textOf(infoXml, "certainty").toLowerCase();
  let score = 68;
  if (status.toLowerCase() === "actual") score += 6;
  if (urgency === "immediate") score += 10;
  if (urgency === "expected") score += 6;
  if (severity === "extreme") score += 10;
  if (severity === "severe") score += 7;
  if (certainty === "observed") score += 10;
  if (certainty === "likely") score += 7;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function capPolygonToGeoJson(value: string) {
  const coordinates = value
    .split(/\s+/)
    .map((pair) => pair.split(",").map((part) => Number(part.trim())))
    .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([lat, lon]) => [lon, lat] as [number, number]);

  if (coordinates.length < 3) return {};
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) coordinates.push(first);

  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}

function inferStateFromCap(areaXml: string, areaText: string) {
  const geocodeBlocks = blocks(areaXml, "geocode");
  for (const geocode of geocodeBlocks) {
    const valueName = textOf(geocode, "valueName").toUpperCase();
    const value = textOf(geocode, "value").toUpperCase();
    if (valueName === "UGC") {
      const match = value.match(/^([A-Z]{2})[CZ]\d{3}/);
      if (match) return match[1] ?? null;
    }
  }
  const stateMatch = areaText.match(/\b([A-Z]{2})\b(?:\s|$)/);
  return stateMatch?.[1] ?? null;
}

function textOf(xml: string, tag: string) {
  const block = firstBlock(xml, tag);
  return cleanText(decodeXml(block));
}

function firstBlock(xml: string, tag: string) {
  return blocks(xml, tag)[0] ?? "";
}

function blocks(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}>`, "gi");
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1] ?? "");
  }
  return matches;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function alertBlocks(payload: string) {
  const alerts = blocks(payload, "alert");
  return alerts.length ? alerts : [payload];
}

export const femaIpawsProvider: WeatherProvider = {
  key: "fema_ipaws",
  label: "FEMA IPAWS CAP Alerts",
  async fetchEvents(options: WeatherProviderFetchOptions = {}): Promise<WeatherProviderResult> {
    const sourceUrl = configuredUrl();
    if (!sourceUrl) {
      return {
        provider: "fema_ipaws",
        sourceUrl: "",
        events: [],
        warnings: ["FEMA IPAWS CAP feed is not configured. Set STORMREACH_FEMA_IPAWS_CAP_URL to enable it."],
      };
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": process.env.STORMREACH_NWS_USER_AGENT || "HomeReach StormReach (admin@home-reach.com)",
        Accept: "application/cap+xml, application/xml, text/xml, */*",
      },
      signal: options.signal,
    });
    if (!response.ok) {
      throw new Error(`FEMA IPAWS CAP failed: ${response.status} ${response.statusText}`);
    }

    const now = options.now ?? new Date();
    const payload = await response.text();
    const events = alertBlocks(payload)
      .map((alertXml) => mapCapAlert(alertXml, now, sourceUrl))
      .filter((event): event is NormalizedStormEvent => Boolean(event))
      .slice(0, options.limit ?? 100);

    return {
      provider: "fema_ipaws",
      sourceUrl,
      events,
      warnings: events.length === 0 ? ["FEMA IPAWS CAP feed returned no supported severe-weather alerts."] : [],
    };
  },
};

export const __stormReachFemaIpawsTestUtils = {
  mapCapAlert,
  capPolygonToGeoJson,
};
