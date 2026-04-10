// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Pricing Engine
//
// Modular, composable pricing system. All pricing logic lives here.
// No prices are hardcoded in UI components — always call this engine.
//
// Design:
//   • PricingEngine.calculate(ctx, config) — pure sync function, no DB
//   • PricingEngine.loadConfig(repo) — async, fetches live config from repo
//   • PricingService — convenience class that combines both (preferred for server)
//
// Usage (server — async, repo-backed):
//   const service = new PricingService(getPricingConfigRepository());
//   const result  = await service.calculate(pricingCtx);
//   const slotsLeft = await service.foundingMemberSlotsRemaining();
//
// Usage (client / sync — hardcoded defaults):
//   const result = PricingEngine.calculate(pricingCtx, DEFAULT_PRICING_CONFIG);
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PricingContext,
  PriceResult,
  AppliedDiscount,
} from "./types";
import type {
  IPricingConfigRepository,
  PricingConfigRecord,
  DiscountTierRecord,
  PromoCodeRecord,
} from "./db/interfaces";
import { getPricingConfigRepository } from "./db/factory";

// ── Default config (used client-side / in tests before DB is connected) ───────
export const DEFAULT_PRICING_CONFIG: PricingConfigRecord = {
  baseSpotPrice:       299,
  fullCardPrice:       799,
  foundingMemberRate:  199,
  foundingMemberLimit: 20,
  militaryDiscountPct: 10,
  updatedAt:           "2026-04-01T00:00:00Z",
};

export const DEFAULT_DISCOUNT_TIERS: DiscountTierRecord[] = [
  { id: "tier-1", type: "multispot", minSpots: 1, discountPct: 0,  label: "Single spot",            active: true },
  { id: "tier-2", type: "multispot", minSpots: 2, discountPct: 5,  label: "2-spot bundle (5% off)",  active: true },
  { id: "tier-3", type: "multispot", minSpots: 3, discountPct: 10, label: "3-spot bundle (10% off)", active: true },
  { id: "tier-4", type: "multispot", minSpots: 5, discountPct: 15, label: "5-spot bundle (15% off)", active: true },
];

// ── Pure engine ───────────────────────────────────────────────────────────────

export class PricingEngine {
  /**
   * Main calculation function. Fully pure — no DB access, no side effects.
   *
   * Pass a PricingContext plus the loaded config data.
   * Use PricingService.calculate() for the async all-in-one convenience method.
   */
  static calculate(
    ctx: PricingContext,
    config: PricingConfigRecord,
    tiers: DiscountTierRecord[],
    promoRecord: PromoCodeRecord | null
  ): PriceResult {
    const discounts: AppliedDiscount[] = [];
    let price = ctx.isFullCard
      ? config.fullCardPrice
      : config.baseSpotPrice * ctx.spotCount;

    const originalPrice = price;

    // ── Founding member discount ──────────────────────────────────────────
    if (ctx.isFoundingMember && !ctx.isFullCard) {
      const foundingTotal = config.foundingMemberRate * ctx.spotCount;
      const savings = price - foundingTotal;
      if (savings > 0) {
        discounts.push({ type: "founding", label: "Founding Member Rate", savings });
        price = foundingTotal;
      }
    }

    // ── Multi-spot discount (skip when founding — already discounted) ─────
    if (!ctx.isFoundingMember && !ctx.isFullCard && ctx.spotCount > 1) {
      const activeTiers = tiers.filter((t) => t.active && t.type === "multispot");
      const tier = [...activeTiers]
        .sort((a, b) => b.minSpots - a.minSpots)
        .find((t) => ctx.spotCount >= t.minSpots);
      if (tier && tier.discountPct > 0) {
        const savings = Math.round(price * (tier.discountPct / 100));
        discounts.push({ type: "multispot", label: tier.label, savings });
        price -= savings;
      }
    }

    // ── Military discount (stacks on top) ─────────────────────────────────
    if (ctx.isMilitary && config.militaryDiscountPct > 0) {
      const savings = Math.round(price * (config.militaryDiscountPct / 100));
      discounts.push({
        type: "military",
        label: `Military/Veteran Discount (${config.militaryDiscountPct}% off)`,
        savings,
      });
      price -= savings;
    }

    // ── Promo code ────────────────────────────────────────────────────────
    if (promoRecord) {
      const savings = Math.round(price * (promoRecord.discountPct / 100));
      discounts.push({ type: "promo", label: promoRecord.label, savings });
      price -= savings;
    }

    const totalSavings = discounts.reduce((sum, d) => sum + d.savings, 0);

    return {
      originalPrice,
      finalPrice: price,
      totalSavings,
      appliedDiscounts: discounts,
      perSpotPrice: ctx.spotCount > 0
        ? Math.round(price / (ctx.isFullCard ? 1 : ctx.spotCount))
        : price,
      billingLabel: ctx.isFoundingMember
        ? "per month — founding rate locked in"
        : "per month",
      isFoundingRate:  ctx.isFoundingMember,
      displayOriginal: totalSavings > 0,
    };
  }

  /** Find the best-matching multi-spot tier for a given spot count */
  static getMultiSpotTier(
    spotCount: number,
    tiers: DiscountTierRecord[] = DEFAULT_DISCOUNT_TIERS
  ): DiscountTierRecord {
    const active = tiers.filter((t) => t.active && t.type === "multispot");
    return (
      [...active].sort((a, b) => b.minSpots - a.minSpots).find((t) => spotCount >= t.minSpots) ??
      active[0] ??
      DEFAULT_DISCOUNT_TIERS[0]
    );
  }

  /** Format a price for display ($1,299) */
  static format(amount: number): string {
    return `$${amount.toLocaleString()}`;
  }
}

// ── Service (async, repo-backed) ──────────────────────────────────────────────

export class PricingService {
  private repo: IPricingConfigRepository;

  constructor(repo?: IPricingConfigRepository) {
    this.repo = repo ?? getPricingConfigRepository();
  }

  /**
   * Async all-in-one: load config from repo, then run PricingEngine.calculate().
   */
  async calculate(ctx: PricingContext): Promise<PriceResult> {
    const [config, tiers, promoRecord] = await Promise.all([
      this.repo.getConfig(),
      this.repo.getDiscountTiers(),
      ctx.promoCode ? this.repo.getPromoCode(ctx.promoCode) : Promise.resolve(null),
    ]);
    return PricingEngine.calculate(ctx, config, tiers, promoRecord);
  }

  /** Check whether founding member slots are still available */
  async isFoundingMemberAvailable(): Promise<boolean> {
    const [config, count] = await Promise.all([
      this.repo.getConfig(),
      this.repo.getFoundingMemberCount(),
    ]);
    return count < config.foundingMemberLimit;
  }

  /** How many founding member slots remain */
  async foundingMemberSlotsRemaining(): Promise<number> {
    const [config, count] = await Promise.all([
      this.repo.getConfig(),
      this.repo.getFoundingMemberCount(),
    ]);
    return Math.max(0, config.foundingMemberLimit - count);
  }

  /** Validate a promo code — returns the record or null */
  async validatePromoCode(code: string): Promise<PromoCodeRecord | null> {
    return this.repo.getPromoCode(code);
  }

  /** Record a new founding member purchase */
  async claimFoundingMemberSlot(): Promise<void> {
    return this.repo.incrementFoundingMemberCount();
  }

  /** Load raw config (useful for admin settings display) */
  async getConfig(): Promise<PricingConfigRecord> {
    return this.repo.getConfig();
  }

  /** Load all active discount tiers */
  async getDiscountTiers(): Promise<DiscountTierRecord[]> {
    return this.repo.getDiscountTiers();
  }
}
