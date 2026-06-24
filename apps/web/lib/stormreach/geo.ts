import type { StormGeoJson } from "./types";

export type StormEventGeoLike = {
  impactedPolygonGeojson?: StormGeoJson | null;
  impacted_polygon_geojson?: StormGeoJson | null;
  impactedState?: string | null;
  impacted_state?: string | null;
  detectedAt?: string | null;
  detected_at?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  endTime?: string | null;
  end_time?: string | null;
};

export const STATE_CENTERS: Record<string, [number, number]> = {
  AL: [-86.8, 32.8],
  AK: [-152, 64],
  AZ: [-111.7, 34.2],
  AR: [-92.4, 35],
  CA: [-119.5, 36.5],
  CO: [-105.5, 39],
  CT: [-72.7, 41.6],
  DE: [-75.5, 39],
  FL: [-82.4, 28.6],
  GA: [-83.4, 32.6],
  HI: [-157.5, 20.8],
  ID: [-114.6, 44.1],
  IL: [-89.2, 40],
  IN: [-86.1, 40],
  IA: [-93.5, 42.1],
  KS: [-98.3, 38.5],
  KY: [-85.2, 37.5],
  LA: [-91.9, 31],
  ME: [-69.2, 45.2],
  MD: [-76.7, 39],
  MA: [-71.8, 42.2],
  MI: [-85.5, 44.3],
  MN: [-94.5, 46],
  MS: [-89.7, 32.7],
  MO: [-92.5, 38.5],
  MT: [-109.6, 47],
  NE: [-99.8, 41.5],
  NV: [-116.6, 39.3],
  NH: [-71.6, 43.7],
  NJ: [-74.5, 40.1],
  NM: [-106, 34.4],
  NY: [-75, 43],
  NC: [-79.4, 35.5],
  ND: [-100.5, 47.5],
  OH: [-82.8, 40.3],
  OK: [-97.5, 35.6],
  OR: [-120.5, 44],
  PA: [-77.7, 41],
  RI: [-71.5, 41.7],
  SC: [-80.9, 33.9],
  SD: [-100, 44.4],
  TN: [-86.4, 35.8],
  TX: [-99.3, 31.5],
  UT: [-111.7, 39.3],
  VT: [-72.7, 44],
  VA: [-78.7, 37.5],
  WA: [-120.5, 47.4],
  WV: [-80.6, 38.6],
  WI: [-89.8, 44.6],
  WY: [-107.5, 43],
};

export function stormReachLookbackHours() {
  const envValue = typeof process !== "undefined" ? process.env.STORMREACH_LOOKBACK_HOURS : undefined;
  return positiveNumber(envValue, 24);
}

export function eventCentroid(event: StormEventGeoLike): [number, number] | null {
  const geojson = event.impactedPolygonGeojson ?? event.impacted_polygon_geojson ?? {};
  const type = String((geojson as { type?: unknown }).type ?? "");
  const coordinates = (geojson as { coordinates?: unknown }).coordinates;
  if (type === "Point" && Array.isArray(coordinates) && coordinates.length >= 2) {
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat];
  }

  const flattened = flattenCoordinates(coordinates);
  if (flattened.length) {
    const sum = flattened.reduce((acc, item) => [acc[0] + item[0], acc[1] + item[1]] as [number, number], [0, 0]);
    return [sum[0] / flattened.length, sum[1] / flattened.length];
  }

  const state = String(event.impactedState ?? event.impacted_state ?? "").toUpperCase();
  return state ? STATE_CENTERS[state] ?? null : null;
}

export function flattenCoordinates(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") return [[value[0], value[1]]];
  return value.flatMap((item) => flattenCoordinates(item));
}

export function distanceMiles(a: [number, number], b: [number, number]) {
  const radiusMiles = 3958.7613;
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = toRadians(b[1] - a[1]);
  const deltaLon = toRadians(b[0] - a[0]);
  const hav =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return radiusMiles * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

export function isRecentStormEvent(event: StormEventGeoLike, lookbackHours = stormReachLookbackHours(), now = new Date()) {
  const eventTime = newestDate(event.detectedAt ?? event.detected_at, event.startTime ?? event.start_time, event.endTime ?? event.end_time);
  if (!eventTime) return false;
  const cutoff = now.getTime() - lookbackHours * 60 * 60 * 1000;
  return eventTime.getTime() >= cutoff && eventTime.getTime() <= now.getTime() + 5 * 60 * 1000;
}

function newestDate(...values: Array<string | null | undefined>) {
  const dates = values
    .map((value) => {
      const time = value ? Date.parse(value) : Number.NaN;
      return Number.isFinite(time) ? new Date(time) : null;
    })
    .filter((value): value is Date => Boolean(value));
  if (!dates.length) return null;
  return dates.sort((a, b) => b.getTime() - a.getTime())[0];
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
