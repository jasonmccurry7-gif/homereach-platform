// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Household Estimator
//
// Pure function that returns an approximate household count for a given
// (state, geography_type, geography_value) triple. Used by the quote engine
// when the operator doesn't pass an explicit householdCountOverride.
//
// Returns null when no data is available — the caller throws
// NoHouseholdEstimateError in that case, telling the operator to either
// add this geography to the table or pass an explicit override.
//
// Design:
//   - Pure, synchronous, no DB / IO / network.
//   - Case-insensitive lookup on geography_value (stored upper-case).
//   - Separable from quote.ts so real Census ACS / state election office
//     data can be swapped in without touching the engine.
//
// Data policy:
//   - The Ohio seeds below are OPERATIONAL APPROXIMATIONS based on publicly
//     available rough counts. They give the engine something to work with
//     during Phase 3 validation. Replace with real Census ACS household
//     counts before production quotes are sent externally.
//   - This module does not store voter counts, turnout projections, or
//     ideology data. Household count is a pure logistics input — "how
//     many physical mailboxes does this area have."
// ─────────────────────────────────────────────────────────────────────────────

import type { GeographyType } from "./queries";

/**
 * Estimate → null when missing. Case-insensitive match on geography_value.
 */
export function estimateHouseholds(
  state: string,
  geographyType: GeographyType,
  geographyValue: string,
): number | null {
  if (!state || !geographyValue) return null;
  const stateKey = state.trim().toUpperCase();
  const valueKey = geographyValue.trim().toUpperCase();

  // State-level: not seeded yet — future Phase 3 revision can add
  // state-wide household totals once a dataset lands. Until then, quotes
  // at the state level require householdCountOverride.
  if (geographyType === "state") {
    const stateTotal = STATE_TOTAL_HOUSEHOLDS[stateKey];
    return stateTotal ?? null;
  }

  const stateTable = HOUSEHOLD_ESTIMATES[stateKey];
  if (!stateTable) return null;

  const typeTable = stateTable[geographyType];
  if (!typeTable) return null;

  const count = typeTable[valueKey];
  return typeof count === "number" ? count : null;
}

// ── State-total seeds (very sparse — extend as needed) ──────────────────────

const STATE_TOTAL_HOUSEHOLDS: Readonly<Record<string, number>> = {
  // OH: omitted intentionally — we operate on counties/cities, not a
  //     state-wide blast, so the state-total field is unused for now.
};

// ── Sub-state seeds ─────────────────────────────────────────────────────────
//
// Structure: state → geography_type → geography_value (UPPER) → household count
//
// Ohio seeds below are rough approximations. Numbers are order-of-magnitude
// correct for quote preview purposes. Swap for Census ACS values before
// production.

const HOUSEHOLD_ESTIMATES: Readonly<Record<string, Record<GeographyType, Readonly<Record<string, number>>>>> = {
  OH: {
    state: {},

    // Counties — ~10 largest by population, plus some representative suburban
    // and rural counties for range coverage. Numbers reflect ACS-adjacent
    // household estimates (households, not people, not voters).
    county: {
      FRANKLIN:    540_000, // Columbus metro
      CUYAHOGA:    540_000, // Cleveland metro
      HAMILTON:    340_000, // Cincinnati
      MONTGOMERY:  225_000, // Dayton
      SUMMIT:      225_000, // Akron
      LUCAS:       180_000, // Toledo
      STARK:       155_000, // Canton
      BUTLER:      150_000,
      LORAIN:      125_000,
      MAHONING:    100_000, // Youngstown
      WARREN:      90_000,
      CLERMONT:    85_000,
      LAKE:        95_000,
      DELAWARE:    75_000,
      MEDINA:      70_000,
      TRUMBULL:    88_000,
    },

    // Cities — major OH cities. These are city-limits households, not metro.
    city: {
      COLUMBUS:      370_000,
      CLEVELAND:     170_000,
      CINCINNATI:    150_000,
      TOLEDO:        115_000,
      AKRON:         90_000,
      DAYTON:        65_000,
      "PARMA":       30_000,
      "CANTON":      30_000,
      "YOUNGSTOWN":  25_000,
      "LORAIN":      26_000,
      "HAMILTON":    26_000, // city of Hamilton (not the county)
      "SPRINGFIELD": 25_000,
      "KETTERING":   25_000,
      "ELYRIA":      22_000,
      "LAKEWOOD":    23_000,
    },

    // Districts — Ohio Congressional districts are numbered OH-1 … OH-15.
    // Typical CD has ~300–330k households. Seed the key ones that were
    // competitive in recent cycles; operators can always pass an override
    // for any district not in the seed.
    district: {
      "OH-1":  310_000,
      "OH-2":  310_000,
      "OH-3":  300_000,
      "OH-4":  310_000,
      "OH-5":  315_000,
      "OH-6":  300_000,
      "OH-7":  305_000,
      "OH-8":  310_000,
      "OH-9":  300_000,
      "OH-10": 310_000,
      "OH-11": 295_000,
      "OH-12": 315_000,
      "OH-13": 300_000,
      "OH-14": 320_000,
      "OH-15": 310_000,
    },
  },
};

/**
 * Helpers for diagnostics — UIs can call hasEstimate() to decide whether
 * to show "estimated" vs "required" next to the household field.
 */
export function hasEstimate(
  state: string,
  geographyType: GeographyType,
  geographyValue: string,
): boolean {
  return estimateHouseholds(state, geographyType, geographyValue) !== null;
}

/** Lists the geographies we have estimates for in a given state — useful
 *  for autocomplete in a future UI. */
export function listSeededGeographies(
  state: string,
  geographyType: GeographyType,
): string[] {
  const stateKey = state.trim().toUpperCase();
  const stateTable = HOUSEHOLD_ESTIMATES[stateKey];
  if (!stateTable) return [];
  const typeTable = stateTable[geographyType];
  return typeTable ? Object.keys(typeTable).sort() : [];
}
