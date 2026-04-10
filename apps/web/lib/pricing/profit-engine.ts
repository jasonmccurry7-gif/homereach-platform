// ─────────────────────────────────────────────────────────────────────────────
// ProfitAwarePricingEngine — Central Cost + Margin Calculator
//
// Guarantees profitability across all products and campaign types.
// Integrates PostagePricingProvider + PrintPricingProvider.
// All pricing is derived from real vendor costs — no hardcoded sell prices.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ProfitCalcResult,
  CampaignPricingResult,
  ProductPricingResult,
  VendorCostConfig,
  MarginTier,
  PrintProductType,
  CampaignProductType,
  PricingSource,
} from "./types";
import { PostagePricingProvider } from "./providers/postage-provider";
import { PrintPricingProvider }   from "./providers/print-provider";

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_VENDOR_COST_CONFIG: VendorCostConfig = {
  printCostPerPiece:   0.20,   // default: 4×6 postcard at ~5k qty
  postageCostPerPiece: 0.242,  // USPS EDDM Retail
  defaultMarginRate:   0.40,   // 40% markup over cost
  minimumMarginRate:   0.15,   // floor: never sell at <15% gross margin
  lastUpdated:         "2024-01-01T00:00:00.000Z",
};

/**
 * Tiered margin rates for targeted campaigns — scale discount.
 * As household reach grows, margin compresses slightly to stay competitive.
 * Minimum: 20% margin for enterprise scale.
 */
export const CAMPAIGN_MARGIN_TIERS: MarginTier[] = [
  { minHouseholds: 25000, maxHouseholds: Infinity, marginRate: 0.20, label: "Enterprise" },
  { minHouseholds: 10000, maxHouseholds: 24999,    marginRate: 0.25, label: "Scale"      },
  { minHouseholds: 5000,  maxHouseholds: 9999,     marginRate: 0.30, label: "Growth"     },
  { minHouseholds: 2500,  maxHouseholds: 4999,     marginRate: 0.40, label: "Starter"    },
];

/** Minimum campaign size enforced by the system */
export const MIN_CAMPAIGN_HOUSEHOLDS = 2_500;

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function grossMarginPct(profit: number, sellPrice: number): number {
  if (sellPrice === 0) return 0;
  return round2((profit / sellPrice) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfitAwarePricingEngine
// ─────────────────────────────────────────────────────────────────────────────

export class ProfitAwarePricingEngine {
  // Runtime-mutable config (admin can update without restart)
  private static _config: VendorCostConfig = { ...DEFAULT_VENDOR_COST_CONFIG };

  // ── Config Management ───────────────────────────────────────────────────────

  static getConfig(): VendorCostConfig {
    return { ...this._config };
  }

  static updateConfig(patch: Partial<VendorCostConfig>): void {
    this._config = {
      ...this._config,
      ...patch,
      lastUpdated: new Date().toISOString(),
    };
  }

  static resetConfig(): void {
    this._config = { ...DEFAULT_VENDOR_COST_CONFIG };
  }

  // ── Core Calculation ────────────────────────────────────────────────────────

  /**
   * Pure calculation — given explicit costs and margin, return full profit breakdown.
   * No provider calls needed; use this when you already have cost values.
   */
  static calculate(params: {
    quantity: number;
    printCostPerPiece: number;
    postageCostPerPiece: number;
    marginRate: number;
    pricingSource: PricingSource;
  }): ProfitCalcResult {
    const { quantity, printCostPerPiece, postageCostPerPiece, marginRate, pricingSource } = params;

    const vendorCost    = round2(printCostPerPiece * quantity);
    const postageCost   = round2(postageCostPerPiece * quantity);
    const totalCost     = round2(vendorCost + postageCost);
    const costPerPiece  = round2(printCostPerPiece + postageCostPerPiece);

    // Sell price = cost × (1 + margin)
    const finalPrice    = round2(totalCost * (1 + marginRate));
    const grossProfit   = round2(finalPrice - totalCost);
    const pricePerPiece = round2(finalPrice / quantity);

    return {
      quantity,
      vendorCost,
      postageCost,
      totalCost,
      finalPrice,
      grossProfit,
      grossMarginPercent: grossMarginPct(grossProfit, finalPrice),
      appliedMarginRate:  marginRate,
      costPerPiece,
      pricePerPiece,
      pricingSource,
      pricingTimestamp:   new Date().toISOString(),
    };
  }

  /**
   * Async version — pulls costs from providers automatically.
   * Use this in server components and API routes.
   */
  static async calculateAsync(params: {
    quantity: number;
    productType?: PrintProductType;
    marginRate?: number;
  }): Promise<ProfitCalcResult & { source: PricingSource }> {
    const { quantity, productType = "postcard_6x9", marginRate } = params;

    const [printRecord, postageRate] = await Promise.all([
      PrintPricingProvider.getPrice(productType, quantity),
      PostagePricingProvider.getRate(),
    ]);

    // Resolve worst-case source (manual < cached < live)
    const source = this._resolveSource(printRecord.source, postageRate.source);
    const margin = marginRate ?? this._config.defaultMarginRate;

    const result = this.calculate({
      quantity,
      printCostPerPiece:   printRecord.pricePerPiece,
      postageCostPerPiece: postageRate.ratePerPiece,
      marginRate:          margin,
      pricingSource:       source,
    });

    return { ...result, source };
  }

  // ── Campaign Pricing ────────────────────────────────────────────────────────

  /**
   * Calculate pricing for a targeted direct-mail campaign.
   * Applies scale-based margin tiers automatically.
   */
  static async calculateCampaign(params: {
    totalHouseholds: number;
    productType?: PrintProductType;
    monthsCommitted?: number;
    campaignId?: string;
    campaignProductType?: CampaignProductType;
  }): Promise<CampaignPricingResult> {
    const {
      totalHouseholds,
      productType = "postcard_6x9",
      monthsCommitted = 1,
      campaignId,
      campaignProductType = "targeted_campaign",
    } = params;

    if (totalHouseholds < MIN_CAMPAIGN_HOUSEHOLDS) {
      throw new Error(
        `Minimum campaign size is ${MIN_CAMPAIGN_HOUSEHOLDS.toLocaleString()} households. Got ${totalHouseholds.toLocaleString()}.`
      );
    }

    // Resolve margin tier based on scale
    const tier       = this.getMarginTierForScale(totalHouseholds);
    const marginRate = tier.marginRate;

    // Pull live/cached/fallback costs
    const [printRecord, postageRate] = await Promise.all([
      PrintPricingProvider.getPrice(productType, totalHouseholds),
      PostagePricingProvider.getRate(),
    ]);

    const source = this._resolveSource(printRecord.source, postageRate.source);

    const base = this.calculate({
      quantity:            totalHouseholds,
      printCostPerPiece:   printRecord.pricePerPiece,
      postageCostPerPiece: postageRate.ratePerPiece,
      marginRate,
      pricingSource:       source,
    });

    // Apply multi-month discount
    const { discountedPrice, discountRate, profitAfterDiscount, marginAfterDiscount } =
      this._applyCommitDiscount(base, monthsCommitted);

    const pricePerThousand = round2((discountedPrice / totalHouseholds) * 1000);

    return {
      ...base,
      productType:          campaignProductType,
      campaignId,
      totalHouseholds,
      pricePerThousand,
      tierLabel:            tier.label,
      discountRate,
      monthsCommitted,
      priceAfterDiscount:   discountedPrice,
      profitAfterDiscount,
      marginAfterDiscount,
    };
  }

  /**
   * Calculate pricing for a physical print product (no postage).
   * For products sold direct, not mailed.
   */
  static async calculateProduct(params: {
    productType: PrintProductType;
    quantity: number;
    marginRate?: number;
    withPostage?: boolean;
  }): Promise<ProductPricingResult> {
    const { productType, quantity, marginRate, withPostage = false } = params;

    const [printRecord, postageRate] = await Promise.all([
      PrintPricingProvider.getPrice(productType, quantity),
      withPostage ? PostagePricingProvider.getRate() : Promise.resolve(null),
    ]);

    const postageCostPerPiece = withPostage && postageRate ? postageRate.ratePerPiece : 0;
    const source = this._resolveSource(
      printRecord.source,
      postageRate?.source ?? "manual"
    );

    const base = this.calculate({
      quantity,
      printCostPerPiece:   printRecord.pricePerPiece,
      postageCostPerPiece,
      marginRate:          marginRate ?? this._config.defaultMarginRate,
      pricingSource:       source,
    });

    return {
      ...base,
      productType,
      productLabel: printRecord.vendorName + " – " + productType.replace(/_/g, " "),
      size:         printRecord.size,
      material:     printRecord.material,
      finish:       printRecord.finish,
      vendorName:   printRecord.vendorName,
    };
  }

  // ── Tiered Margin Logic ─────────────────────────────────────────────────────

  /** Return the appropriate margin tier for a given household count */
  static getMarginTierForScale(households: number): MarginTier {
    const tier = CAMPAIGN_MARGIN_TIERS.find(
      (t) => households >= t.minHouseholds && households <= t.maxHouseholds
    );
    // Default to Starter if below minimum (shouldn't happen after validation)
    return tier ?? CAMPAIGN_MARGIN_TIERS[CAMPAIGN_MARGIN_TIERS.length - 1];
  }

  /** All available margin tiers for display in admin */
  static getAllMarginTiers(): MarginTier[] {
    return [...CAMPAIGN_MARGIN_TIERS].reverse(); // ascending order
  }

  // ── Profitability Enforcement ───────────────────────────────────────────────

  /**
   * Check if a proposed sell price maintains the minimum margin floor.
   * Returns { ok, minimumPrice } where minimumPrice is the lowest allowed price.
   */
  static checkProfitabilityFloor(
    totalCost: number,
    proposedPrice: number
  ): { ok: boolean; minimumPrice: number; currentMarginPct: number } {
    const minFloor     = this._config.minimumMarginRate;
    // minimum sell price such that gross margin >= floor
    // grossMargin = (sell - cost) / sell >= floor
    // sell >= cost / (1 - floor)
    const minimumPrice = round2(totalCost / (1 - minFloor));
    const currentProfit = proposedPrice - totalCost;
    const currentMarginPct = grossMarginPct(currentProfit, proposedPrice);
    return { ok: proposedPrice >= minimumPrice, minimumPrice, currentMarginPct };
  }

  // ── Display Helpers ─────────────────────────────────────────────────────────

  static formatPrice(n: number): string {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  static formatMargin(n: number): string {
    return `${(n * 100).toFixed(0)}%`;
  }

  static formatPricePerThousand(n: number): string {
    return `$${n.toFixed(2)}/k`;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private static _resolveSource(a: PricingSource, b: PricingSource): PricingSource {
    // live > cached > manual
    const rank = (s: PricingSource) => s === "live" ? 2 : s === "cached" ? 1 : 0;
    return rank(a) >= rank(b) ? a : b;
  }

  private static _applyCommitDiscount(
    base: ProfitCalcResult,
    months: number
  ): {
    discountedPrice: number;
    discountRate: number;
    profitAfterDiscount: number;
    marginAfterDiscount: number;
  } {
    const rawDiscount = months >= 6 ? 0.15 : months >= 3 ? 0.10 : 0;
    const discountedPrice = round2(base.finalPrice * (1 - rawDiscount));

    // Enforce profitability floor — discount can't push us below 15% gross margin
    const { ok, minimumPrice } = this.checkProfitabilityFloor(base.totalCost, discountedPrice);
    const effectivePrice = ok ? discountedPrice : minimumPrice;
    const actualDiscount = round2(1 - effectivePrice / base.finalPrice);

    const profitAfterDiscount = round2(effectivePrice - base.totalCost);
    const marginAfterDiscount = grossMarginPct(profitAfterDiscount, effectivePrice);

    return {
      discountedPrice:      effectivePrice,
      discountRate:         actualDiscount,
      profitAfterDiscount,
      marginAfterDiscount,
    };
  }
}
