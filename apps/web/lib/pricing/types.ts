// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Profit-Aware Pricing Engine — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Where a pricing value came from */
export type PricingSource = "live" | "cached" | "manual";

/** Physical products the print provider supports */
export type PrintProductType =
  | "postcard_4x6"
  | "postcard_6x9"
  | "postcard_6x11"
  | "magnet"
  | "yard_sign"
  | "door_hanger";

/** Campaign-level product types */
export type CampaignProductType =
  | "targeted_campaign"
  | "shared_postcard";

/** All product types the pricing engine covers */
export type AnyProductType = PrintProductType | CampaignProductType;

// ─── Postage ───────────────────────────────────────────────────────────────

export interface PostageRate {
  ratePerPiece: number;
  rateName: string;       // e.g. "EDDM Retail", "EDDM BMEU", "Manual Override"
  source: PricingSource;
  fetchedAt: string;      // ISO timestamp
}

// ─── Print ────────────────────────────────────────────────────────────────

export interface PrintQuantityTier {
  minQty: number;
  maxQty: number;         // Infinity for open-ended
  pricePerPiece: number;
}

export interface PrintPricingRecord {
  productType: PrintProductType;
  quantity: number;
  pricePerPiece: number;
  size: string;
  material: string;
  finish: string;
  vendorName: string;
  source: PricingSource;
  fetchedAt: string;
}

export interface PrintProductSpec {
  type: PrintProductType;
  label: string;
  defaultSize: string;
  defaultMaterial: string;
  defaultFinish: string;
  minimumQty: number;
}

// ─── Vendor Cost Summary ──────────────────────────────────────────────────

export interface VendorCostRecord {
  printCostPerPiece: number;
  postageCostPerPiece: number;
  totalCostPerPiece: number;
  printSource: PricingSource;
  postageSource: PricingSource;
  printFetchedAt: string;
  postageFetchedAt: string;
}

// ─── Profit Calculation Results ───────────────────────────────────────────

/** Core result from the profit engine for any product or campaign */
export interface ProfitCalcResult {
  quantity: number;
  vendorCost: number;           // total print cost
  postageCost: number;          // total postage cost
  totalCost: number;            // vendorCost + postageCost
  finalPrice: number;           // customer-facing sell price
  grossProfit: number;          // finalPrice - totalCost
  grossMarginPercent: number;   // (grossProfit / finalPrice) × 100
  appliedMarginRate: number;    // margin multiplier used (e.g. 0.40)
  costPerPiece: number;         // totalCost / quantity
  pricePerPiece: number;        // finalPrice / quantity
  pricingSource: PricingSource;
  pricingTimestamp: string;
}

/** Extended result for campaign pricing */
export interface CampaignPricingResult extends ProfitCalcResult {
  productType: CampaignProductType;
  campaignId?: string;
  totalHouseholds: number;
  pricePerThousand: number;     // finalPrice / (totalHouseholds / 1000)
  tierLabel: string;
  discountRate: number;         // e.g. 0.10 = 10%
  monthsCommitted: number;
  priceAfterDiscount: number;
  profitAfterDiscount: number;
  marginAfterDiscount: number;
}

/** Extended result for print product pricing */
export interface ProductPricingResult extends ProfitCalcResult {
  productType: PrintProductType;
  productLabel: string;
  size: string;
  material: string;
  finish: string;
  vendorName: string;
}

// ─── Configuration ─────────────────────────────────────────────────────────

/** Admin-configurable cost inputs */
export interface VendorCostConfig {
  printCostPerPiece: number;      // default: 0.20
  postageCostPerPiece: number;    // default: 0.242 (USPS EDDM retail)
  defaultMarginRate: number;      // default: 0.40 (40%)
  minimumMarginRate: number;      // floor: 0.15 (15% gross margin, never go below)
  lastUpdated: string;
  updatedBy?: string;
}

/** Per-scale margin override for targeted campaigns */
export interface MarginTier {
  minHouseholds: number;
  maxHouseholds: number;
  marginRate: number;
  label: string;
}

// ─── Pricing Snapshot (stored on campaign/product records) ────────────────

/** Snapshot stored on every campaign or product record in the DB */
export interface PricingSnapshot {
  productType: AnyProductType;
  quantity: number;
  vendorCost: number;
  postageCost: number;
  totalCost: number;
  finalPrice: number;
  grossProfit: number;
  marginPercent: number;
  pricingSource: PricingSource;
  pricingTimestamp: string;
}

// ─── Admin Profit View ────────────────────────────────────────────────────

/** Row in the admin Profit Center table */
export interface ProfitRow {
  id: string;
  name: string;
  productType: AnyProductType;
  quantity: number;
  vendorCost: number;
  postageCost: number;
  totalCost: number;
  sellPrice: number;
  grossProfit: number;
  marginPercent: number;
  pricingSource: PricingSource;
  pricingTimestamp: string;
  status?: string;
}
