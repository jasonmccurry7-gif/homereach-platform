import type { NormalizedStormEvent, StormEventType, StormHazardMetrics } from "../types";

export type WeatherProviderKey = "nws" | "noaa_spc" | "fema" | "fema_ipaws";

export type WeatherProviderFetchOptions = {
  now?: Date;
  limit?: number;
  state?: string | null;
  signal?: AbortSignal;
};

export type WeatherProviderResult = {
  provider: WeatherProviderKey;
  sourceUrl: string;
  events: NormalizedStormEvent[];
  warnings: string[];
};

export interface WeatherProvider {
  key: WeatherProviderKey;
  label: string;
  fetchEvents(options?: WeatherProviderFetchOptions): Promise<WeatherProviderResult>;
}

export function clampScore(value: number, fallback = 50) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value).replace(/^,|,$/g, ""))
        .filter(Boolean),
    ),
  );
}

export function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function detectEventType(text: string): StormEventType {
  const value = text.toLowerCase();
  if (/\bhail\b|hail size|large hail/.test(value)) return "hail";
  if (/\btornado\b|waterspout/.test(value)) return "tornado";
  if (/\bderecho\b/.test(value)) return "derecho";
  if (/\bhurricane\b|tropical storm|storm surge|typhoon/.test(value)) return "hurricane_tropical_storm";
  if (/\bflood\b|flash flood|river flood|coastal flood/.test(value)) return "flooding";
  if (/\bwinter storm\b|ice storm|freezing rain|blizzard|snow squall|heavy snow/.test(value)) return "winter_storm_ice";
  if (/\bheat wave\b|excessive heat|extreme heat|heat advisory|dangerous heat/.test(value)) return "heat_wave";
  if (/\bwildfire\b|red flag|smoke|fire weather/.test(value)) return "wildfire_smoke";
  if (/\bsevere thunderstorm\b/.test(value)) return "severe_thunderstorm";
  if (/\bwind\b|high wind|damaging wind|straight-line/.test(value)) return "high_wind";
  return "unknown";
}

export function parseHazardMetrics(text: string): StormHazardMetrics {
  const value = text.toLowerCase();
  const hailMatch =
    value.match(/(?:hail(?: size)?(?: up to)?|diameter)\s*(?:of|to)?\s*(\d+(?:\.\d+)?)\s*(?:inch|inches|in\b)/i) ??
    value.match(/(\d+(?:\.\d+)?)\s*(?:inch|inches|in\b)\s*hail/i);
  const windMatch =
    value.match(/(\d{2,3})\s*(?:mph|miles per hour)\s*(?:wind|gust|winds|gusts)?/i) ??
    value.match(/(?:wind|gust|winds|gusts)\D{0,16}(\d{2,3})\s*(?:mph|miles per hour)/i);
  const tornadoMatch = value.match(/\b(EF[0-5]|F[0-5])\b/i);
  const floodSeverity: StormHazardMetrics["floodSeverity"] = value.includes("catastrophic")
    ? "catastrophic"
    : value.includes("major flood")
      ? "major"
      : value.includes("moderate flood")
        ? "moderate"
        : value.includes("minor flood")
          ? "minor"
          : null;

  return {
    hailSizeInches: hailMatch ? Number(hailMatch[1]) : null,
    windSpeedMph: windMatch ? Number(windMatch[1]) : null,
    tornadoRating: tornadoMatch?.[1]?.toUpperCase() ?? null,
    floodSeverity,
    snowIceSignal: /\bice\b|freezing rain|blizzard|heavy snow|snow squall/.test(value) ? 1 : null,
  };
}

export function splitAreaDescription(area: string) {
  const parts = area
    .split(/;|,|\sand\s/i)
    .map((part) => cleanText(part))
    .filter(Boolean);
  const counties = parts
    .filter((part) => /\bcounty\b|\bparish\b|\bborough\b/i.test(part))
    .map((part) => part.replace(/\s+(County|Parish|Borough)$/i, ""));
  const cities = parts.filter((part) => !/\bcounty\b|\bparish\b|\bborough\b|\b[a-z]{2}z\d{3}\b/i.test(part));
  return {
    counties: uniqueStrings(counties),
    cities: uniqueStrings(cities).slice(0, 20),
  };
}

export function inferStateFromProperties(properties: Record<string, unknown>) {
  const areaDesc = cleanText(properties.areaDesc);
  const same = properties.geocode && typeof properties.geocode === "object"
    ? (properties.geocode as Record<string, unknown>).UGC
    : null;
  if (Array.isArray(same)) {
    const code = String(same[0] ?? "");
    const match = code.match(/^([A-Z]{2})/);
    if (match) return match[1] ?? null;
  }
  const stateMatch = areaDesc.match(/\b([A-Z]{2})\b(?:\s|$)/);
  return stateMatch?.[1] ?? null;
}
