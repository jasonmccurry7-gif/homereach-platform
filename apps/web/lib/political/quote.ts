// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Command Center: Quote Engine
//
// generatePoliticalQuote(input) — pure function, <1ms latency.
//
// Returns a typed quote covering:
//   • Estimated households (from operator override OR seeded estimator)
//   • Volume band selection
//   • Per-piece cost / price / margin (USD cents, integer)
//   • Add-ons (setup, design, rush%, targeting, yard signs, door hangers)
//   • Totals (subtotal + add-ons = total)
//   • Internal-only: cost, margin, profit margin % (NEVER sent to client)
//   • Client-safe summary: households, drops, total pieces, investment, timeline
//   • Operational recommendations (drop cadence based on election proximity)
//
// Pure + deterministic: same input → same output, every time.
// No DB, no network, no IO. Performance is trivially <1s (microseconds).
//
// Compliance:
//   • Zero persuasion modeling, voter scoring, or ideology inference.
//   • Drop-cadence recommendations are TIMING ONLY (based on calendar days
//     until election), not based on any prediction about who to reach or
//     what to say.
//   • "Targeting" add-on is a fee for audience-list refinement (geographic
//     / household aggregation), NOT individual voter targeting.
//   • Internal cost/margin/profit is NEVER surfaced in clientSummary.
//
// Extension points (future phases):
//   • `configOverride` parameter lets admin UI swap pricing tables at runtime.
//   • `regionMultipliers` lets per-state multipliers apply without code changes.
//   • `householdCountOverride` always wins when provided — so operators can
//     plug in real mail-list counts from an upstream audience tool.
// ─────────────────────────────────────────────────────────────────────────────

import type { DistrictType, GeographyType } from "./queries";
import {
  DEFAULT_ADD_ON_PRICES,
  DEFAULT_COST_PER_PIECE_CENTS,
  DEFAULT_PRICE_PER_PIECE_CENTS,
  DEFAULT_REGION_MULTIPLIERS,
  DEFAULT_TIMELINE,
  MINIMUM_TOTAL_PIECES,
  capPoliticalPostcardPriceCents,
  recommendDrops,
  resolveVolumeBand,
  type AddOnPrices,
  type RegionMultiplier,
  type TimelineConfig,
  type VolumeBand,
} from "./pricing-config";
import { estimateHouseholds } from "./household-estimator";

// ── Input / Output types ─────────────────────────────────────────────────────

export interface AddOnSelection {
  setup?: boolean;
  design?: boolean;
  rush?: boolean;
  targeting?: boolean;
  yardSigns?: { quantity: number };
  doorHangers?: { quantity: number };
}

export interface PoliticalQuoteInput {
  state: string;
  geographyType: GeographyType;
  geographyValue: string;
  districtType: DistrictType;

  /** Operator-supplied household count. Wins over the estimator. */
  householdCountOverride?: number | undefined;

  /** Number of mail touches. Default 1. */
  drops?: number | undefined;

  /** Days until election. Null / undefined → no countdown-based rec. */
  daysUntilElection?: number | null | undefined;

  addOns?: AddOnSelection | undefined;

  /** Per-piece price override (cents). Skips the district×band lookup. */
  pricePerPieceCentsOverride?: number | undefined;

  /** Per-piece cost override (cents). Skips the band lookup. */
  costPerPieceCentsOverride?: number | undefined;

  /** Future-proof config hook for admin-driven pricing tables. */
  configOverride?: Partial<PoliticalQuoteConfig> | undefined;
}

export interface PoliticalQuoteConfig {
  costPerPieceCents: Readonly<Record<VolumeBand, number>>;
  pricePerPieceCents: Readonly<Record<DistrictType, Record<VolumeBand, number>>>;
  addOnPrices: AddOnPrices;
  timeline: TimelineConfig;
  regionMultipliers: Readonly<Record<string, RegionMultiplier>>;
}

export interface PoliticalQuoteResult {
  // Echoed inputs (audit trail)
  input: {
    state: string;
    geographyType: GeographyType;
    geographyValue: string;
    districtType: DistrictType;
    drops: number;
    daysUntilElection: number | null;
  };

  // Coverage
  estimatedHouseholds: number;
  householdSource: "override" | "estimate";

  // Volume
  totalPieces: number;
  volumeBand: VolumeBand;

  // Per-piece economics
  costPerPieceCents: number;
  pricePerPieceCents: number;
  marginPerPieceCents: number;

  // Breakdown (cents)
  subtotalCents: number;
  addOnsCents: number;
  rushSurchargeCents: number;
  totalCents: number;

  // Add-on detail
  addOnBreakdown: {
    setupCents: number;
    designCents: number;
    targetingCents: number;
    yardSignsCents: number;
    doorHangersCents: number;
  };

  // Internal only — NEVER surface to a client
  internal: {
    totalCostCents: number;
    totalMarginCents: number;
    profitMarginPct: number; // one-decimal precision
  };

  // Timeline (calendar days)
  estimatedDeliveryWindow: {
    productionDays: number;
    mailMinDays: number;
    mailMaxDays: number;
    minTotalDays: number;
    maxTotalDays: number;
    tight: boolean;
  };

  // Client-safe summary — this is what gets echoed into proposals
  clientSummary: {
    households: number;
    drops: number;
    totalPieces: number;
    totalInvestmentCents: number;
    deliveryWindowText: string;
  };

  // Operational recommendations (no persuasion modeling)
  recommendations: {
    recommendedDrops: number;
    recommendedDropsReason: string;
    warnings: string[];
  };

  generatedAt: string;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class InvalidQuoteInputError extends Error {
  constructor(message: string) {
    super(`Invalid quote input: ${message}`);
    this.name = "InvalidQuoteInputError";
  }
}

export class NoHouseholdEstimateError extends Error {
  readonly state: string;
  readonly geographyType: GeographyType;
  readonly geographyValue: string;
  constructor(state: string, geographyType: GeographyType, geographyValue: string) {
    super(
      `No household estimate for ${geographyType}="${geographyValue}" in ${state}. ` +
        `Pass \`householdCountOverride\` or add this geography to household-estimator.ts.`,
    );
    this.name = "NoHouseholdEstimateError";
    this.state = state;
    this.geographyType = geographyType;
    this.geographyValue = geographyValue;
  }
}

export class BelowMinimumVolumeError extends Error {
  readonly totalPieces: number;
  readonly minimumRequired: number;
  constructor(totalPieces: number, minimumRequired: number) {
    super(
      `Order volume ${totalPieces.toLocaleString()} pieces is below the ${minimumRequired.toLocaleString()}-piece minimum. ` +
        `Increase household count or drops, or request a custom quote.`,
    );
    this.name = "BelowMinimumVolumeError";
    this.totalPieces = totalPieces;
    this.minimumRequired = minimumRequired;
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

export function generatePoliticalQuote(
  input: PoliticalQuoteInput,
): PoliticalQuoteResult {
  // 1. Validate & normalize
  validateInput(input);

  const drops = input.drops ?? 1;
  const daysUntilElection = input.daysUntilElection ?? null;

  // 2. Resolve effective config (merge defaults + optional override)
  const cfg: PoliticalQuoteConfig = {
    costPerPieceCents:   input.configOverride?.costPerPieceCents   ?? DEFAULT_COST_PER_PIECE_CENTS,
    pricePerPieceCents:  input.configOverride?.pricePerPieceCents  ?? DEFAULT_PRICE_PER_PIECE_CENTS,
    addOnPrices:         input.configOverride?.addOnPrices         ?? DEFAULT_ADD_ON_PRICES,
    timeline:            input.configOverride?.timeline            ?? DEFAULT_TIMELINE,
    regionMultipliers:   input.configOverride?.regionMultipliers   ?? DEFAULT_REGION_MULTIPLIERS,
  };
  const multiplier = cfg.regionMultipliers[input.state.toUpperCase()] ?? {};

  // 3. Resolve household count
  const { households, source } = resolveHouseholdCount(input);

  // 4. Volume & band
  const totalPieces = households * drops;
  if (totalPieces < MINIMUM_TOTAL_PIECES) {
    throw new BelowMinimumVolumeError(totalPieces, MINIMUM_TOTAL_PIECES);
  }
  const volumeBand = resolveVolumeBand(totalPieces);

  // 5. Per-piece economics
  const baseCostPerPiece =
    input.costPerPieceCentsOverride ??
    cfg.costPerPieceCents[volumeBand];

  const basePricePerPiece =
    input.pricePerPieceCentsOverride ??
    cfg.pricePerPieceCents[input.districtType][volumeBand];

  const costPerPieceCents = applyCostMultipliers(baseCostPerPiece, multiplier);
  const pricePerPieceCents = applyPriceMultiplier(basePricePerPiece, multiplier);
  const marginPerPieceCents = pricePerPieceCents - costPerPieceCents;

  // 6. Subtotals
  const subtotalCents = pricePerPieceCents * totalPieces;

  // 7. Add-ons
  const addOns = input.addOns ?? {};
  const addOnBreakdown = {
    setupCents:       addOns.setup     ? cfg.addOnPrices.setupCents     : 0,
    designCents:      addOns.design    ? cfg.addOnPrices.designCents    : 0,
    targetingCents:   addOns.targeting ? cfg.addOnPrices.targetingCents : 0,
    yardSignsCents:   addOns.yardSigns
      ? Math.max(0, Math.floor(addOns.yardSigns.quantity)) * cfg.addOnPrices.yardSignPerUnitCents
      : 0,
    doorHangersCents: addOns.doorHangers
      ? Math.max(0, Math.floor(addOns.doorHangers.quantity)) * cfg.addOnPrices.doorHangerPerUnitCents
      : 0,
  };

  const flatAddOnsCents =
    addOnBreakdown.setupCents +
    addOnBreakdown.designCents +
    addOnBreakdown.targetingCents +
    addOnBreakdown.yardSignsCents +
    addOnBreakdown.doorHangersCents;

  // Rush is a percentage on the pieces subtotal (not on flat add-ons).
  const rushSurchargeCents = addOns.rush
    ? Math.round(subtotalCents * cfg.addOnPrices.rushRate)
    : 0;

  const addOnsCents = flatAddOnsCents + rushSurchargeCents;
  const totalCents = subtotalCents + addOnsCents;

  // 8. Internal economics
  const totalCostCents = costPerPieceCents * totalPieces;
  // Rush and add-ons are (mostly) margin — they don't carry material cost
  // in this model. A future revision could break out physical-sign cost.
  const totalMarginCents = totalCents - totalCostCents;
  const profitMarginPct =
    totalCents === 0 ? 0 : Math.round((totalMarginCents / totalCents) * 1000) / 10;

  // 9. Timeline
  const productionDays = cfg.timeline.productionDays;
  const minTotalDays = productionDays + cfg.timeline.mailMinDays;
  const maxTotalDays = productionDays + cfg.timeline.mailMaxDays;
  const tight =
    daysUntilElection !== null &&
    daysUntilElection <= cfg.timeline.tightThresholdDays;

  const deliveryWindowText = buildWindowText(minTotalDays, maxTotalDays);

  // 10. Recommendations + warnings
  const rec = recommendDrops(daysUntilElection);
  const warnings: string[] = [];
  if (tight) {
    warnings.push(
      `Tight window: only ${daysUntilElection} days until election; in-home may cut it close to mail window max of ${cfg.timeline.mailMaxDays} days.`,
    );
  }
  if (daysUntilElection !== null && daysUntilElection < 0) {
    warnings.push(`Election date has already passed (${Math.abs(daysUntilElection)} days ago).`);
  }
  if (rec.recommended !== drops) {
    warnings.push(
      `Selected ${drops} drop${drops === 1 ? "" : "s"}; engine recommends ${rec.recommended}: ${rec.reason}`,
    );
  }

  return {
    input: {
      state: input.state.toUpperCase(),
      geographyType: input.geographyType,
      geographyValue: input.geographyValue,
      districtType: input.districtType,
      drops,
      daysUntilElection,
    },
    estimatedHouseholds: households,
    householdSource: source,
    totalPieces,
    volumeBand,
    costPerPieceCents,
    pricePerPieceCents,
    marginPerPieceCents,
    subtotalCents,
    addOnsCents,
    rushSurchargeCents,
    totalCents,
    addOnBreakdown,
    internal: {
      totalCostCents,
      totalMarginCents,
      profitMarginPct,
    },
    estimatedDeliveryWindow: {
      productionDays,
      mailMinDays: cfg.timeline.mailMinDays,
      mailMaxDays: cfg.timeline.mailMaxDays,
      minTotalDays,
      maxTotalDays,
      tight,
    },
    clientSummary: {
      households,
      drops,
      totalPieces,
      totalInvestmentCents: totalCents,
      deliveryWindowText,
    },
    recommendations: {
      recommendedDrops: rec.recommended,
      recommendedDropsReason: rec.reason,
      warnings,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function validateInput(input: PoliticalQuoteInput): void {
  if (!input.state || input.state.trim().length !== 2) {
    throw new InvalidQuoteInputError(`state must be a 2-letter code, got "${input.state}"`);
  }
  if (!["state", "county", "city", "district"].includes(input.geographyType)) {
    throw new InvalidQuoteInputError(`geographyType invalid: "${input.geographyType}"`);
  }
  if (!input.geographyValue || !input.geographyValue.trim()) {
    throw new InvalidQuoteInputError("geographyValue is required");
  }
  if (!["federal", "state", "local"].includes(input.districtType)) {
    throw new InvalidQuoteInputError(`districtType invalid: "${input.districtType}"`);
  }
  if (input.drops !== undefined) {
    if (!Number.isInteger(input.drops) || input.drops < 1 || input.drops > 12) {
      throw new InvalidQuoteInputError(`drops must be an integer in [1, 12]; got ${input.drops}`);
    }
  }
  if (input.householdCountOverride !== undefined) {
    if (
      !Number.isFinite(input.householdCountOverride) ||
      input.householdCountOverride < 0 ||
      input.householdCountOverride > 10_000_000
    ) {
      throw new InvalidQuoteInputError(
        `householdCountOverride out of range: ${input.householdCountOverride}`,
      );
    }
  }
  if (input.pricePerPieceCentsOverride !== undefined) {
    if (
      !Number.isFinite(input.pricePerPieceCentsOverride) ||
      input.pricePerPieceCentsOverride < 1 ||
      input.pricePerPieceCentsOverride > 10_000
    ) {
      throw new InvalidQuoteInputError(
        `pricePerPieceCentsOverride out of range: ${input.pricePerPieceCentsOverride}`,
      );
    }
  }
  if (input.costPerPieceCentsOverride !== undefined) {
    if (
      !Number.isFinite(input.costPerPieceCentsOverride) ||
      input.costPerPieceCentsOverride < 0 ||
      input.costPerPieceCentsOverride > 10_000
    ) {
      throw new InvalidQuoteInputError(
        `costPerPieceCentsOverride out of range: ${input.costPerPieceCentsOverride}`,
      );
    }
  }
}

function resolveHouseholdCount(
  input: PoliticalQuoteInput,
): { households: number; source: "override" | "estimate" } {
  if (typeof input.householdCountOverride === "number") {
    return {
      households: Math.max(0, Math.floor(input.householdCountOverride)),
      source: "override",
    };
  }
  const est = estimateHouseholds(
    input.state,
    input.geographyType,
    input.geographyValue,
  );
  if (est === null) {
    throw new NoHouseholdEstimateError(
      input.state,
      input.geographyType,
      input.geographyValue,
    );
  }
  return { households: est, source: "estimate" };
}

function applyCostMultipliers(
  baseCents: number,
  m: RegionMultiplier,
): number {
  const postageAdjusted = baseCents + (m.postageAdjustmentCents ?? 0);
  const multiplied = m.costMultiplier
    ? Math.round(postageAdjusted * m.costMultiplier)
    : postageAdjusted;
  return Math.max(0, multiplied);
}

function applyPriceMultiplier(baseCents: number, m: RegionMultiplier): number {
  const multiplied = m.priceMultiplier
    ? Math.round(baseCents * m.priceMultiplier)
    : baseCents;
  return capPoliticalPostcardPriceCents(multiplied);
}

function buildWindowText(minDays: number, maxDays: number): string {
  if (minDays === maxDays) return `~${minDays} business days from approval`;
  return `~${minDays}–${maxDays} business days from approval`;
}
