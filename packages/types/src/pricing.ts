// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Pricing Engine Types
// All types for the pricing resolution pipeline.
// Import from "@homereach/types" — re-exported via index.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Core Enums ──────────────────────────────────────────────────────────────

export type PricingProductType =
  | "spot"
  | "addon"
  | "automation"
  | "bundle"
  | "campaign"
  | "setup_fee";

export type SpotType =
  | "anchor"
  | "front_feature"
  | "back_feature"
  | "full_card";

export type BillingInterval =
  | "monthly"
  | "one_time"
  | "per_unit"
  | "per_drop";

export type CampaignTier = "standard" | "premium" | "saturation";

export type DiscountRuleType =
  | "military"
  | "multi_spot"
  | "promo_code"
  | "future_reserved";

// ─── Pricing Resolution ───────────────────────────────────────────────────────

/** Input to resolvePrice() */
export interface ResolvePriceInput {
  productType: PricingProductType;
  /** Required when productType = "spot" */
  spotType?: SpotType;
  /** Defaults to "monthly" if not specified */
  billingInterval?: BillingInterval;
  /** Used for city-level pricing profile override (fully active after Task 2) */
  cityId?: string;
  /** If resolving bundle pricing — enables bundle profile lookup */
  bundleId?: string;
  /** Whether to use founding_price_cents instead of base_price_cents */
  isFounding?: boolean;
  /** For per_unit products (campaigns) */
  quantity?: number;
}

/** Output of resolvePrice() — price before any discounts */
export interface ResolvedPrice {
  pricingProfileId: string;
  productType: PricingProductType;
  spotType?: SpotType;
  billingInterval: BillingInterval;
  /** Standard price from pricing_profiles.base_price_cents */
  basePriceCents: number;
  /** Price after founding/bundle override, before discounts */
  workingPriceCents: number;
  /** For UI strike-through display — null if no compare price set */
  compareAtPriceCents?: number;
  isFoundingPrice: boolean;
}

// ─── Discount Application ─────────────────────────────────────────────────────

/** Qualification context passed to applyDiscounts() */
export interface DiscountContext {
  isVerifiedMilitary?: boolean;
  /** Total number of spot line items in the current checkout session */
  spotCountInCart?: number;
  /** For future promo_code rule type */
  promoCodes?: string[];
}

/** A single applied discount — written into the snapshot */
export interface AppliedDiscount {
  ruleId: string;
  ruleType: DiscountRuleType;
  label: string;
  discountAmountCents: number;
}

/** Output of applyDiscounts() */
export interface DiscountResult {
  originalPriceCents: number;
  finalPriceCents: number;
  discountsApplied: AppliedDiscount[];
  totalDiscountCents: number;
}

// ─── Campaign Pricing ─────────────────────────────────────────────────────────

/** Output of calculateCampaignPrice() */
export interface CampaignPriceResult {
  tier: CampaignTier;
  quantity: number;
  /** Resolved midpoint rate within the tier's per-unit range */
  perUnitPriceCents: number;
  /** quantity * perUnitPriceCents */
  subtotalCents: number;
  setupFeeCents: number;
  totalCents: number;
  pricingProfileId: string;
}

// ─── Pricing Snapshot ─────────────────────────────────────────────────────────

/**
 * The immutable pricing snapshot.
 *
 * Written ONCE before Stripe checkout session creation.
 * Stored in spot_assignments.pricing_snapshot (Task 1).
 * Also embedded in the Stripe session metadata for webhook recovery.
 *
 * NEVER mutated after write. Price increases do not affect existing snapshots.
 * snapshotVersion allows future format changes without breaking old records.
 */
export interface PricingSnapshot {
  pricingProfileId: string;
  productType: PricingProductType;
  spotType?: SpotType;
  billingInterval: BillingInterval;
  /** Standard price — preserved for audit trail even when founding price applies */
  basePriceCents: number;
  /** Strike-through price for UI — null if no compare price */
  compareAtPriceCents?: number;
  /** Price after founding/bundle override, before discounts */
  workingPriceCents: number;
  isFoundingPrice: boolean;
  discountsApplied: AppliedDiscount[];
  /** The final amount — Stripe MUST use exactly this value */
  finalPriceCents: number;
  /** ISO 8601 timestamp of snapshot creation */
  snapshotAt: string;
  /** Format version — always 1 for snapshots created by this implementation */
  snapshotVersion: 1;
}

// ─── Stripe Checkout ──────────────────────────────────────────────────────────

/**
 * Payload for createSubscriptionCheckoutSession().
 * Replaces the one-time CheckoutSessionPayload for spot purchases.
 */
export interface SubscriptionCheckoutPayload {
  businessId: string;
  cityId: string;
  /** The spot reservation ID — must exist before calling this */
  reservationId: string;
  /** One or more spot IDs included in this checkout session */
  spotIds: string[];
  productType: PricingProductType;
  spotType?: SpotType;
  bundleId?: string;
  isFounding?: boolean;
  isVerifiedMilitary?: boolean;
  email: string;
  categoryId: string;
}
