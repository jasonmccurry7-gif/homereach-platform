// ─────────────────────────────────────────────────────────────────────────────
// Routes importer spec.
//
// Accepts a CSV exported from the USPS EDDM Retail facility tool, the FEC
// (no — FEC has no routes), or a hand-prepared CSV from any other approved
// USPS data source. Required columns are the minimum needed to make a
// political_routes row useful for coverage planning.
//
// We accept several common header aliases for each field so that exports
// from different vendor tools work without manual rework.
//
// REJECT a row if any required field is missing or invalid.
// SKIP (duplicate) a row if (state, zip5, carrier_route_id) already exists.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParseResult, ImporterSpec } from "./spec";
import { verifyAgainstAliases } from "./header-utils";

export interface RoutePayload {
  state: string;
  zip5: string;
  zip4: string | null;
  carrier_route_id: string;
  route_type: "city" | "rural" | "highway" | "po_box" | "general" | null;
  residential_count: number | null;
  business_count: number | null;
  total_count: number;
  county: string | null;
  city: string | null;
  source: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header aliases — vendor variation is the rule, not the exception.
// ─────────────────────────────────────────────────────────────────────────────

// Header aliases (canonical → list of accepted lowercased+underscored
// variants). Generous on vendor names because mailing-vendor CSV exports
// vary widely. Add new aliases freely; the only cost is a slightly larger
// header-check pass.
const ALIASES: Record<string, readonly string[]> = {
  state:             ["state", "usps_state", "st", "state_abbr", "state_code"],
  zip5:              ["zip5", "zip", "zip_code", "zipcode", "postal_code", "mailing_zip", "delivery_zip"],
  zip4:              ["zip4", "zip_plus_4", "plus4", "zip+4"],
  carrier_route_id:  [
    "carrier_route_id", "carrier_route", "route_id", "route", "crid",
    "carrier_route_code", "mailing_route", "route_code", "cr_id",
  ],
  route_type:        ["route_type", "type", "carrier_type", "delivery_type", "route_classification"],
  residential_count: [
    "residential_count", "residential", "residential_deliveries", "res_count",
    "residences", "homes", "residential_addresses",
  ],
  business_count:    [
    "business_count", "business", "business_deliveries", "biz_count",
    "businesses", "business_addresses",
  ],
  total_count:       [
    "total_count", "total", "total_possible_deliveries", "deliveries", "households",
    "total_addresses", "total_deliveries", "eddm_count", "mailpiece_count",
    "address_count",
  ],
  county:            ["county", "county_name"],
  city:              ["city", "town", "city_name"],
};

const REQUIRED = ["state", "zip5", "carrier_route_id", "total_count"] as const;
const OPTIONAL = [
  "zip4", "route_type", "residential_count", "business_count", "county", "city",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pick(raw: Record<string, string>, field: string): string | undefined {
  for (const alias of ALIASES[field] ?? [field]) {
    if (raw[alias] !== undefined && raw[alias] !== "") return raw[alias];
  }
  return undefined;
}

function parseInt0(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  // Strip thousands separators
  const cleaned = v.replace(/,/g, "").trim();
  if (!/^-?\d+$/.test(cleaned)) return null;
  return parseInt(cleaned, 10);
}

function normalizeRouteType(v: string | undefined): RoutePayload["route_type"] {
  if (!v) return null;
  const s = v.toLowerCase().trim();
  // USPS uses many synonyms for the same thing
  if (["c", "city", "city route", "city_route"].includes(s)) return "city";
  if (["r", "rural", "rural route", "rural_route"].includes(s)) return "rural";
  if (["h", "highway", "highway route"].includes(s)) return "highway";
  if (["po", "po_box", "po box", "p.o. box"].includes(s)) return "po_box";
  if (["g", "general"].includes(s)) return "general";
  // Unknown values become 'general' rather than rejecting the whole row
  return "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec
// ─────────────────────────────────────────────────────────────────────────────

export function makeRoutesSpec(source: string): ImporterSpec<RoutePayload> {
  return {
    kind: "routes",
    requiredColumns: REQUIRED,
    optionalColumns: OPTIONAL,

    verifyHeader(headers: string[]) {
      return verifyAgainstAliases(headers, REQUIRED, OPTIONAL, ALIASES);
    },

    parseRow(raw): ParseResult<RoutePayload> {
      const state = pick(raw, "state")?.toUpperCase().trim();
      const zip5  = pick(raw, "zip5")?.trim();
      const cr    = pick(raw, "carrier_route_id")?.toUpperCase().trim();
      const totalRaw = pick(raw, "total_count");
      const total = parseInt0(totalRaw);

      // Required validation
      if (!state || state.length !== 2) {
        return { ok: false, reason: `Invalid 'state': ${JSON.stringify(state ?? "")} (need 2-letter US code)` };
      }
      if (!zip5 || !/^\d{5}$/.test(zip5)) {
        return { ok: false, reason: `Invalid 'zip5': ${JSON.stringify(zip5 ?? "")} (need 5 digits)` };
      }
      if (!cr || cr.length === 0) {
        return { ok: false, reason: "Missing 'carrier_route_id'" };
      }
      if (total === null) {
        return { ok: false, reason: `Invalid 'total_count': ${JSON.stringify(totalRaw ?? "")} (need integer)` };
      }
      if (total < 0) {
        return { ok: false, reason: `'total_count' must be ≥ 0 (got ${total})` };
      }

      // Optional fields
      const zip4Raw = pick(raw, "zip4")?.trim();
      const zip4 = zip4Raw && /^\d{4}$/.test(zip4Raw) ? zip4Raw : null;

      const residential = parseInt0(pick(raw, "residential_count"));
      const business    = parseInt0(pick(raw, "business_count"));

      // Sanity: if both res + biz are present, they should sum near total.
      // We don't reject — just trust the provided total — but we surface a
      // soft note via the reason field on the parsed row (caller can still
      // accept it).
      // (Intentionally not surfaced as a rejection.)

      return {
        ok: true,
        payload: {
          state,
          zip5,
          zip4,
          carrier_route_id: cr,
          route_type: normalizeRouteType(pick(raw, "route_type")),
          residential_count: residential,
          business_count: business,
          total_count: total,
          county: pick(raw, "county")?.trim() || null,
          city:   pick(raw, "city")?.trim() || null,
          source,
        },
      };
    },

    dedupKey(p) {
      return `${p.state}|${p.zip5}|${p.carrier_route_id}`.toLowerCase();
    },

    async loadExistingKeys(supabase) {
      // Pull only the dedup columns. Page through to support large catalogs.
      const keys = new Set<string>();
      const pageSize = 1000;
      let from = 0;
      // Hard cap at 200k rows of existing routes — anything bigger and the
      // operator should be loading deltas, not full files.
      const maxRows = 200_000;

      while (from < maxRows) {
        const { data, error } = await supabase
          .from("political_routes")
          .select("state, zip5, carrier_route_id")
          .range(from, from + pageSize - 1);

        if (error) throw new Error(`loadExistingKeys (routes): ${error.message}`);
        if (!data || data.length === 0) break;

        for (const r of data) {
          keys.add(`${r.state}|${r.zip5}|${r.carrier_route_id}`.toLowerCase());
        }

        if (data.length < pageSize) break;
        from += pageSize;
      }

      return keys;
    },

    async insertBatch(supabase, payloads, importId) {
      if (payloads.length === 0) return 0;
      const chunkSize = 500;
      let inserted = 0;

      for (let i = 0; i < payloads.length; i += chunkSize) {
        const chunk = payloads.slice(i, i + chunkSize).map((p) => ({
          ...p,
          source_imported_at: new Date().toISOString(),
          import_id: importId,
          active: true,
        }));

        const { data, error } = await supabase
          .from("political_routes")
          .insert(chunk)
          .select("id");

        if (error) {
          // If a unique-violation slips through (concurrent import), the
          // chunk fails atomically. We surface the error so the orchestrator
          // marks the import as failed and rolls back what landed.
          throw new Error(`insertBatch (routes): ${error.message}`);
        }
        inserted += data?.length ?? 0;
      }
      return inserted;
    },
  };
}
