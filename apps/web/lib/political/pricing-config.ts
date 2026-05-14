// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Pricing Config
//
// All money in USD cents (integer) to avoid float drift anywhere in the
// revenue math. Matches HomeReach's existing money-in-cents convention.
//
// These are public data tables — no DB access, no IO. They're deliberately
// separable from quote.ts so that:
//   (a) A future admin UI can swap them out at runtime via a config override
//       parameter on generatePoliticalQuote().
//   (b) Regional / state-specific multipliers can be layered in without
//       touching the engine.
//
// Source-of-truth alignment with the master brief:
//   postage flat   ≈ $0.242/pc
//   print @ 2,500  ≈ $0.09/pc → total cost ≈ $0.33/pc
//   print @ 5–10k  ≈ $0.06/pc → total cost ≈ $0.30/pc
//   print @ 20k+   ≈ $0.05/pc → total cost ≈ $0.29/pc
//
//   Local 2,500    → $0.70/pc ; 5k → $0.65/pc
//   State 5–15k    → $0.55–$0.65/pc
//   Federal 20k+   → $0.50–$0.58/pc
//
// Rounding: we store per-piece figures as whole cents. Fractional cents
// within the brief's ranges are rounded to the nearest integer.
// ─────────────────────────────────────────────────────────────────────────────

import type { DistrictType } from "./queries";

// ── Volume bands ─────────────────────────────────────────────────────────────

export type VolumeBand =
  | "2500_to_5000"
  | "5000_to_15000"
  | "15000_to_50000"
  | "50000_plus";

export interface VolumeBandDef {
  key: VolumeBand;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound; Infinity for the top band. */
  max: number;
  label: string;
}

export const VOLUME_BANDS: ReadonlyArray<VolumeBandDef> = [
  { key: "2500_to_5000",   min: 2_500,   max: 4_999,               label: "2,500–5,000" },
  { key: "5000_to_15000",  min: 5_000,   max: 14_999,              label: "5,000–15,000" },
  { key: "15000_to_50000", min: 15_000,  max: 49_999,              label: "15,000–50,000" },
  { key: "50000_plus",     min: 50_000,  max: Number.POSITIVE_INFINITY, label: "50,000+" },
];

/** Minimum billable order. Below this, the engine throws BelowMinimumVolumeError. */
export const MINIMUM_TOTAL_PIECES = 2_500;
export const MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS = 70;
export const POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS = 9;
export const POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS = 24;

/** Resolves the volume band for a given piece count. Assumes pieces >= min. */
export function resolveVolumeBand(totalPieces: number): VolumeBand {
  if (totalPieces < MINIMUM_TOTAL_PIECES) {
    // Caller should check this before us; if it slips through, fail loudly.
    throw new RangeError(
      `resolveVolumeBand: ${totalPieces} is below minimum ${MINIMUM_TOTAL_PIECES}`,
    );
  }
  if (totalPieces < 5_000)  return "2500_to_5000";
  if (totalPieces < 15_000) return "5000_to_15000";
  if (totalPieces < 50_000) return "15000_to_50000";
  return "50000_plus";
}

// ── Cost per piece (cents) ───────────────────────────────────────────────────
//
// Cost is mostly postage (≈24¢ flat) + print (varies by volume). Stored as
// the integer cent total per-piece at each band. These are HomeReach's
// internal numbers and never appear in the client-facing quote surface.

export const DEFAULT_COST_PER_PIECE_CENTS: Readonly<Record<VolumeBand, number>> = {
  "2500_to_5000":    33, // 24.2 postage + 9 print  ≈ 33
  "5000_to_15000":   30, // 24.2 + 6 ≈ 30
  "15000_to_50000":  30, // bridges the 5–10k and 20k+ bands; conservative
  "50000_plus":      29, // 24.2 + 5 ≈ 29
};

// ── Sell price per piece (cents) ────────────────────────────────────────────
//
// Local > State > Federal at the same volume — higher per-piece margin on
// smaller campaigns, tighter margin on large-volume federal runs.

export const DEFAULT_PRICE_PER_PIECE_CENTS: Readonly<Record<DistrictType, Record<VolumeBand, number>>> = {
  local: {
    "2500_to_5000":    70,
    "5000_to_15000":   65,
    "15000_to_50000":  62,
    "50000_plus":      60,
  },
  state: {
    "2500_to_5000":    65,
    "5000_to_15000":   60,
    "15000_to_50000":  56,
    "50000_plus":      54,
  },
  federal: {
    "2500_to_5000":    60,
    "5000_to_15000":   56,
    "15000_to_50000":  52,
    "50000_plus":      50,
  },
};

export function capPoliticalPostcardPriceCents(value: number): number {
  if (!Number.isFinite(value)) return MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS;
  return Math.min(
    MAX_POLITICAL_POSTCARD_PRICE_PER_PIECE_CENTS,
    Math.max(0, Math.round(value)),
  );
}

export function resolvePoliticalPostcardPriceCents(
  districtType: DistrictType,
  totalPieces: number,
): number {
  const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, Math.floor(totalPieces));
  const band = resolveVolumeBand(billablePieces);
  return capPoliticalPostcardPriceCents(
    DEFAULT_PRICE_PER_PIECE_CENTS[districtType][band],
  );
}

// ── Add-ons ──────────────────────────────────────────────────────────────────

export interface AddOnPrices {
  /** Flat setup fee (cents). Brief range: $250–$1,000. Default: $250. */
  setupCents: number;
  /** Flat design fee (cents). Brief range: $150–$500. Default: $250. */
  designCents: number;
  /** Rush applies a percentage surcharge on the pieces subtotal. Brief
   *  range: 10–20%. Default: 15% = 0.15. */
  rushRate: number;
  /** Flat audience-targeting fee (cents). Brief range: $100–$500. Default: $250. */
  targetingCents: number;
  /** Per-sign price (cents). Brief describes yard signs as an optional add-on. */
  yardSignPerUnitCents: number;
  /** Per-door-hanger price (cents). Piece-priced, similar to mail. */
  doorHangerPerUnitCents: number;
}

export const DEFAULT_ADD_ON_PRICES: Readonly<AddOnPrices> = {
  setupCents:              25_000, // $250
  designCents:             25_000, // $250
  rushRate:                0.15,   // 15%
  targetingCents:          25_000, // $250
  yardSignPerUnitCents:    1_200,  // $12 / sign
  doorHangerPerUnitCents:  40,     // $0.40 / hanger (bulk rate)
};

// ── Timeline ─────────────────────────────────────────────────────────────────

export interface TimelineConfig {
  /** Business days from approval to press-ready + presort. */
  productionDays: number;
  /** Typical in-home transit window after drop at USPS (Marketing Mail). */
  mailMinDays: number;
  mailMaxDays: number;
  /** Threshold in calendar days below which the delivery window is "tight". */
  tightThresholdDays: number;
}

export const DEFAULT_TIMELINE: Readonly<TimelineConfig> = {
  productionDays:      5,
  mailMinDays:         7,
  mailMaxDays:         14,
  tightThresholdDays:  21,
};

// ── Region multipliers (future hook) ────────────────────────────────────────
//
// Empty by default. Populated once per-state data is available (e.g. CA
// costs more, rural states cheaper). Kept at module scope so callers can
// override via the config parameter on generatePoliticalQuote().

export interface RegionMultiplier {
  /** Multiplier applied to base cost per piece. 1.0 = unchanged. */
  costMultiplier?: number;
  /** Multiplier applied to base price per piece. 1.0 = unchanged. */
  priceMultiplier?: number;
  /** Absolute cents added per piece to cost (e.g. higher-postage markets). */
  postageAdjustmentCents?: number;
}

export const DEFAULT_REGION_MULTIPLIERS: Readonly<Record<string, RegionMultiplier>> = {
  // Populate as we expand. Example for future reference:
  // CA: { priceMultiplier: 1.05 },
  // AK: { priceMultiplier: 1.10, postageAdjustmentCents: 5 },
};

// ── Recommended drops ────────────────────────────────────────────────────────
//
// Operational recommendation only — never a persuasion model. Ties touches
// to the calendar: earlier campaigns get more touches; tight timelines get
// a single focused drop.

export interface DropsRecommendation {
  recommended: number;
  reason: string;
}

export function recommendDrops(daysUntilElection: number | null | undefined): DropsRecommendation {
  if (daysUntilElection == null) {
    return { recommended: 3, reason: "No election date — default to full 3-touch cadence." };
  }
  if (daysUntilElection < 0) {
    return { recommended: 1, reason: "Election has passed. Verify timing before scheduling more drops." };
  }
  if (daysUntilElection < 21) {
    return { recommended: 1, reason: "Urgent window — one focused drop is all the mail window allows." };
  }
  if (daysUntilElection < 60) {
    return { recommended: 1, reason: "Short window — one strong drop close to election." };
  }
  if (daysUntilElection < 120) {
    return { recommended: 2, reason: "Mid window — two drops: one awareness, one closing." };
  }
  return { recommended: 3, reason: "Full window — three drops recommended: awareness, reinforcement, closing." };
}
