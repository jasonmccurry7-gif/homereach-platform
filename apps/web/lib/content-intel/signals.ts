// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Market Signals Client
//
// V1 source: NOAA / api.weather.gov (free, no auth required).
// Fetches active severe-weather alerts for configured service states and
// maps storm-type alerts into ci_market_signals rows tagged for relevant
// HomeReach categories (roofing first, gutter_cleaning secondary).
//
// We run this as a lightweight daily job separate from the main pipeline.
// Dedup is by (source='noaa', source_id=alert.id) so re-fetches don't
// duplicate. Expired alerts auto-filter via expires_at in the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";

type Supa = ReturnType<typeof createServiceClient>;

const NOAA_BASE = "https://api.weather.gov";

// NOAA event types that drive roofing/gutter demand
const STORM_EVENT_PATTERNS = [
  /hail/i, /high wind/i, /severe thunderstorm/i, /tornado/i,
  /wind advisory/i, /windstorm/i, /derecho/i, /hurricane/i,
  /ice storm/i, /winter storm/i, /heavy snow/i,
];

// Which HomeReach categories each event impacts
const EVENT_CATEGORY_MAP: Array<{ match: RegExp; categories: string[]; intensity: number }> = [
  { match: /hail|tornado|hurricane|derecho/i,                 categories: ["roofing", "gutter_cleaning"],                        intensity: 5 },
  { match: /high wind|windstorm|severe thunderstorm/i,        categories: ["roofing", "gutter_cleaning"],                        intensity: 4 },
  { match: /wind advisory/i,                                   categories: ["roofing"],                                           intensity: 3 },
  { match: /ice storm|winter storm|heavy snow/i,              categories: ["gutter_cleaning", "roofing"],                        intensity: 4 },
];

export type SignalRunSummary = {
  ok: boolean;
  statesPolled: string[];
  alertsFetched: number;
  signalsInserted: number;
  signalsSkippedDedup: number;
  errors: string[];
};

/** Run a signal refresh for all configured service states. */
export async function refreshMarketSignals(): Promise<SignalRunSummary> {
  const supa: Supa = createServiceClient();
  const errors: string[] = [];

  // Pull configured states from ci_ingestion_rules (single row, id='default')
  const { data: rules } = await supa
    .from("ci_ingestion_rules").select("service_states").eq("id", "default").maybeSingle();
  const states = (rules as any)?.service_states ?? ["OH"];

  let alertsFetched = 0;
  let signalsInserted = 0;
  let signalsSkippedDedup = 0;

  for (const state of states) {
    try {
      const alerts = await fetchActiveAlerts(state);
      alertsFetched += alerts.length;

      for (const a of alerts) {
        if (!isStormish(a.event)) continue;

        const mapping = EVENT_CATEGORY_MAP.find((m) => m.match.test(a.event));
        if (!mapping) continue;

        for (const category of mapping.categories) {
          const row = {
            signal_type: "storm" as const,
            category,
            location: `${a.areaDesc || ""} (${state})`.trim(),
            severity: a.severity || null,
            intensity_score: normalizeIntensity(a.severity, mapping.intensity),
            headline: a.event + (a.headline ? ` — ${a.headline}` : ""),
            description: a.description?.slice(0, 2000) ?? null,
            source: "noaa",
            source_id: `${a.id}::${category}`,
            effective_at: a.effective || a.onset || a.sent || null,
            expires_at: a.expires || a.ends || null,
            raw: a,
          };

          // Dedup on (source, source_id) — upsert with do-nothing on conflict
          const { error, count } = await supa
            .from("ci_market_signals")
            .upsert(row, { onConflict: "source,source_id", ignoreDuplicates: true, count: "exact" });
          if (error) {
            errors.push(`insert(${row.source_id}): ${error.message}`);
          } else if ((count ?? 0) > 0) {
            signalsInserted++;
          } else {
            signalsSkippedDedup++;
          }
        }
      }
    } catch (err: any) {
      errors.push(`noaa(${state}): ${err?.message ?? String(err)}`);
    }
  }

  return {
    ok: errors.length === 0,
    statesPolled: states,
    alertsFetched,
    signalsInserted,
    signalsSkippedDedup,
    errors,
  };
}

/** Fetch active alerts for a US state from NOAA. */
async function fetchActiveAlerts(state: string): Promise<any[]> {
  const url = `${NOAA_BASE}/alerts/active?area=${encodeURIComponent(state)}`;
  const res = await fetch(url, {
    headers: {
      // NOAA asks for a User-Agent with contact info.
      "User-Agent": "HomeReach/1.0 (content-intel; contact: admin@home-reach.com)",
      "Accept": "application/geo+json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`NOAA ${res.status}`);
  }
  const json = (await res.json()) as any;
  const features = Array.isArray(json?.features) ? json.features : [];
  return features.map((f: any) => ({
    id: f?.id ?? f?.properties?.id ?? `${f?.properties?.event}-${f?.properties?.onset}`,
    event: String(f?.properties?.event ?? ""),
    severity: f?.properties?.severity ?? null,
    headline: f?.properties?.headline ?? null,
    description: f?.properties?.description ?? null,
    areaDesc: f?.properties?.areaDesc ?? null,
    effective: f?.properties?.effective ?? null,
    onset: f?.properties?.onset ?? null,
    sent: f?.properties?.sent ?? null,
    expires: f?.properties?.expires ?? null,
    ends: f?.properties?.ends ?? null,
  }));
}

function isStormish(event: string): boolean {
  return STORM_EVENT_PATTERNS.some((re) => re.test(event));
}

function normalizeIntensity(severity: string | null, fallback: number): number {
  if (!severity) return fallback;
  const s = severity.toLowerCase();
  if (s === "extreme") return 5;
  if (s === "severe")  return 4;
  if (s === "moderate") return 3;
  if (s === "minor") return 2;
  return fallback;
}
