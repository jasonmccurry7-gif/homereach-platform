import type { NormalizedStormEvent, StormEventType } from "../types";
import {
  cleanText,
  detectEventType,
  parseHazardMetrics,
  toIso,
  type WeatherProvider,
  type WeatherProviderFetchOptions,
  type WeatherProviderResult,
} from "./provider.types";

const DEFAULT_SPC_REPORTS_URL = "https://www.spc.noaa.gov/climo/reports/today_filtered.csv";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function toObjects(csvText: string) {
  const rows = parseCsv(csvText);
  const headers = (rows.shift() ?? []).map((header) => cleanText(header).toLowerCase());
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, cleanText(row[index])])));
}

function spcType(row: Record<string, string>): StormEventType {
  const typeText = [
    row.type,
    row.event,
    row.event_type,
    row.report_type,
    row.comments,
    row.magnitude,
  ].join(" ");
  const detected = detectEventType(typeText);
  if (detected !== "unknown") return detected;
  if (row.size) return "hail";
  if (row.speed || row.f_speed || row.magnitude?.toLowerCase().includes("wind")) return "high_wind";
  return "severe_thunderstorm";
}

function numberValue(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function eventDate(now: Date, timeValue: string) {
  const compact = timeValue.replace(/\D/g, "");
  if (compact.length < 3) return now.toISOString();
  const hours = Number(compact.slice(0, compact.length - 2));
  const minutes = Number(compact.slice(-2));
  const date = new Date(now);
  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    date.setUTCHours(hours, minutes, 0, 0);
  }
  return date.toISOString();
}

function mapSpcReport(row: Record<string, string>, now: Date): NormalizedStormEvent | null {
  const eventType = spcType(row);
  const state = cleanText(row.state || row.st);
  const county = cleanText(row.county);
  const city = cleanText(row.location || row.city);
  const lat = numberValue(row.lat || row.latitude);
  const lon = numberValue(row.lon || row.lng || row.longitude);
  const comments = cleanText(row.comments || row.remark || row.remarks);
  const magnitude = numberValue(row.size || row.speed || row.magnitude || row.f_scale);
  const time = eventDate(now, row.time || row.utc_time || row.datetime || "");
  const title = `${labelForType(eventType)} report${city ? ` near ${city}` : ""}${state ? `, ${state}` : ""}`;
  const eventId = [
    "noaa-spc",
    eventType,
    state,
    county,
    city,
    row.time || row.utc_time || time,
    magnitude ?? "",
  ]
    .map((part) => cleanText(part).toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean)
    .join(":");

  return {
    eventId,
    eventType,
    source: "NOAA Storm Prediction Center",
    sourceUrl: process.env.STORMREACH_NOAA_STORM_REPORTS_URL || DEFAULT_SPC_REPORTS_URL,
    title,
    description: comments || title,
    startTime: time,
    endTime: null,
    detectedAt: now.toISOString(),
    geographyType: lat !== null && lon !== null ? "point_report" : "storm_report_area",
    impactedPolygonGeojson:
      lat !== null && lon !== null
        ? {
            type: "Point",
            coordinates: [lon, lat],
          }
        : {},
    impactedCounties: county ? [county] : [],
    impactedCities: city ? [city] : [],
    impactedZipCodes: [],
    impactedState: state || null,
    estimatedHouseholds: 0,
    estimatedHomeowners: 0,
    confidenceScore: 78,
    sourcePayload: { provider: "noaa_spc", row },
    hazardMetrics: {
      ...parseHazardMetrics(`${title} ${comments}`),
      hailSizeInches: eventType === "hail" ? magnitude : parseHazardMetrics(comments).hailSizeInches,
      windSpeedMph: eventType === "high_wind" || eventType === "derecho" ? magnitude : parseHazardMetrics(comments).windSpeedMph,
      tornadoRating: row.f_scale || row.tor_f_scale || parseHazardMetrics(comments).tornadoRating,
    },
    metadata: {
      county,
      city,
      lat,
      lon,
      magnitude,
    },
  };
}

function labelForType(type: StormEventType) {
  return type
    .replace("hurricane_tropical_storm", "hurricane/tropical storm")
    .replace("winter_storm_ice", "winter storm/ice")
    .replace("wildfire_smoke", "wildfire/smoke")
    .replaceAll("_", " ");
}

export const noaaSpcProvider: WeatherProvider = {
  key: "noaa_spc",
  label: "NOAA Storm Prediction Center Storm Reports",
  async fetchEvents(options: WeatherProviderFetchOptions = {}): Promise<WeatherProviderResult> {
    const sourceUrl = process.env.STORMREACH_NOAA_STORM_REPORTS_URL || DEFAULT_SPC_REPORTS_URL;
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": process.env.STORMREACH_NWS_USER_AGENT || "HomeReach StormReach (admin@home-reach.com)",
        Accept: "text/csv,*/*",
      },
      signal: options.signal,
    });
    if (!response.ok) {
      throw new Error(`NOAA SPC storm reports failed: ${response.status} ${response.statusText}`);
    }
    const rows = toObjects(await response.text());
    const now = options.now ?? new Date();
    const events = rows
      .map((row) => mapSpcReport(row, now))
      .filter((event): event is NormalizedStormEvent => Boolean(event))
      .slice(0, options.limit ?? 200);
    return {
      provider: "noaa_spc",
      sourceUrl,
      events,
      warnings: rows.length === 0 ? ["NOAA SPC report feed returned no rows."] : [],
    };
  },
};

export const __stormReachNoaaTestUtils = {
  parseCsv,
  toObjects,
  mapSpcReport,
  toIso,
};
