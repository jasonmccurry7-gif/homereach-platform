// ─────────────────────────────────────────────────────────────────────────────
// MultiMonthDiscountEngine
//
// Applies commitment-based discounts to any priced campaign or product.
// Enforces a minimum profitability floor so discounts never destroy margin.
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscountTier {
  months: number;
  label: string;        // e.g. "3-Month Commitment"
  discountRate: number; // e.g. 0.10 = 10%
  badgeLabel: string;   // e.g. "Save 10%"
}

export interface DiscountResult {
  originalPrice: number;
  discountedPrice: number;
  discountRate: number;       // actual discount applied (may be lower than requested if floor hit)
  requestedDiscount: number;  // the discount the tier asked for
  savingsAmount: number;
  floorEnforced: boolean;     // true if we had to cap the discount to protect margin
  floorNote?: string;
}

/** Default commitment tiers */
export const COMMITMENT_TIERS: DiscountTier[] = [
  { months: 1,  label: "Month-to-Month",     discountRate: 0.00, badgeLabel: "No commitment" },
  { months: 3,  label: "3-Month Commitment", discountRate: 0.10, badgeLabel: "Save 10%"      },
  { months: 6,  label: "6-Month Commitment", discountRate: 0.15, badgeLabel: "Save 15%"      },
  { months: 12, label: "Annual Commitment",  discountRate: 0.20, badgeLabel: "Save 20%"      },
];

export class MultiMonthDiscountEngine {
  /**
   * Minimum gross margin floor (as a decimal).
   * Discounts will be capped before breaching this threshold.
   * 15% = HomeReach never sells at less than 15% gross margin.
   */
  static readonly MIN_GROSS_MARGIN = 0.15;

  // ── Core API ────────────────────────────────────────────────────────────────

  /**
   * Get the discount rate for a given commitment length.
   * Returns 0 for any length below 3 months.
   */
  static getDiscountRate(months: number): number {
    const tier = this.getTierForMonths(months);
    return tier?.discountRate ?? 0;
  }

  /**
   * Get the matching tier for a given number of months.
   * Returns the highest tier at or below the given months.
   */
  static getTierForMonths(months: number): DiscountTier | null {
    const matching = COMMITMENT_TIERS.filter((t) => t.months <= months);
    if (matching.length === 0) return null;
    return matching[matching.length - 1];
  }

  /**
   * Apply a commitment discount to a price, enforcing the profitability floor.
   *
   * @param price      - Original sell price
   * @param totalCost  - Total vendor + postage cost (used for floor enforcement)
   * @param months     - Commitment length in months
   */
  static applyDiscount(
    price: number,
    totalCost: number,
    months: number
  ): DiscountResult {
    const requestedDiscount = this.getDiscountRate(months);
    const tentativePrice    = round2(price * (1 - requestedDiscount));

    // Calculate minimum price that maintains our floor margin
    // grossMargin = (sell - cost) / sell >= floor
    // sell >= cost / (1 - floor)
    const minimumPrice = round2(totalCost / (1 - this.MIN_GROSS_MARGIN));

    const floorEnforced   = tentativePrice < minimumPrice;
    const discountedPrice = floorEnforced ? minimumPrice : tentativePrice;
    const actualDiscount  = round2(1 - discountedPrice / price);
    const savingsAmount   = round2(price - discountedPrice);

    return {
      originalPrice: price,
      discountedPrice,
      discountRate:     actualDiscount,
      requestedDiscount,
      savingsAmount,
      floorEnforced,
      floorNote: floorEnforced
        ? `Discount capped at ${(actualDiscount * 100).toFixed(0)}% to maintain minimum ${(this.MIN_GROSS_MARGIN * 100).toFixed(0)}% margin`
        : undefined,
    };
  }

  /**
   * Apply a multi-month discount for a full commitment period.
   * Total price = monthly_discounted_price × months.
   */
  static applyCommitmentTotal(
    monthlyPrice: number,
    totalCostPerMonth: number,
    months: number
  ): DiscountResult & { totalPrice: number; totalCost: number } {
    const monthly = this.applyDiscount(monthlyPrice, totalCostPerMonth, months);
    return {
      ...monthly,
      totalPrice: round2(monthly.discountedPrice * months),
      totalCost:  round2(totalCostPerMonth * months),
    };
  }

  // ── Display Helpers ─────────────────────────────────────────────────────────

  /** All available commitment tiers for display in the campaign builder */
  static getAllTiers(): DiscountTier[] {
    return [...COMMITMENT_TIERS];
  }

  /** Formatted savings label for customer display */
  static formatSavings(originalPrice: number, months: number): string {
    const rate = this.getDiscountRate(months);
    if (rate === 0) return "";
    const saved = round2(originalPrice * rate);
    return `Save $${saved.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** Human-readable discount summary */
  static formatDiscountLabel(months: number): string {
    const tier = this.getTierForMonths(months);
    if (!tier || tier.discountRate === 0) return "No discount";
    return `${(tier.discountRate * 100).toFixed(0)}% off (${tier.label})`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
