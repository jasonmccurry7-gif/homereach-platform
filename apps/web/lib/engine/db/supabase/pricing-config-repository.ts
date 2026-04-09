// ─────────────────────────────────────────────────────────────────────────────
// Supabase Pricing Config Repository
//
// No dedicated pricing tables exist in the schema yet.
// Returns hardcoded defaults from the engine constants.
// All values are correct for production use and can be updated here
// until a DB-backed config UI is built.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IPricingConfigRepository,
  PricingConfigRecord,
  DiscountTierRecord,
  PromoCodeRecord,
} from "../interfaces";
import {
  DEFAULT_PRICING_CONFIG,
  DEFAULT_DISCOUNT_TIERS,
} from "../../pricing";

// In-memory founding member count (resets on server restart).
// Acceptable for now — replace with DB counter when pricing_config table is added.
let _foundingMemberCount = 0;

export class SupabasePricingConfigRepository implements IPricingConfigRepository {

  async getConfig(): Promise<PricingConfigRecord> {
    return { ...DEFAULT_PRICING_CONFIG };
  }

  async getDiscountTiers(): Promise<DiscountTierRecord[]> {
    return [...DEFAULT_DISCOUNT_TIERS];
  }

  async getPromoCode(_code: string): Promise<PromoCodeRecord | null> {
    // No promo codes configured. Return null = no discount applied.
    return null;
  }

  async getFoundingMemberCount(): Promise<number> {
    return _foundingMemberCount;
  }

  async incrementFoundingMemberCount(): Promise<void> {
    _foundingMemberCount += 1;
  }
}
