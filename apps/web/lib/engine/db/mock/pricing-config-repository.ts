// ─────────────────────────────────────────────────────────────────────────────
// Mock Pricing Config Repository
// In-memory implementation of IPricingConfigRepository.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IPricingConfigRepository,
  PricingConfigRecord,
  DiscountTierRecord,
  PromoCodeRecord,
} from "../interfaces";

const MOCK_CONFIG: PricingConfigRecord = {
  baseSpotPrice:      299,
  fullCardPrice:      799,
  foundingMemberRate: 199,
  foundingMemberLimit: 20,
  militaryDiscountPct: 10,
  updatedAt: "2026-04-01T00:00:00Z",
};

const MOCK_DISCOUNT_TIERS: DiscountTierRecord[] = [
  { id: "tier-1", type: "multispot", minSpots: 1, discountPct: 0,  label: "Single spot",            active: true },
  { id: "tier-2", type: "multispot", minSpots: 2, discountPct: 5,  label: "2-spot bundle (5% off)",  active: true },
  { id: "tier-3", type: "multispot", minSpots: 3, discountPct: 10, label: "3-spot bundle (10% off)", active: true },
  { id: "tier-4", type: "multispot", minSpots: 5, discountPct: 15, label: "5-spot bundle (15% off)", active: true },
];

const MOCK_PROMO_CODES: PromoCodeRecord[] = [
  { code: "LAUNCH25", discountPct: 25, label: "Launch promo (25% off)", active: true,  usageLimit: 50,   usageCount: 3,  expiresAt: "2026-06-01T00:00:00Z" },
  { code: "FRIEND10", discountPct: 10, label: "Referral discount",      active: true,  usageLimit: null, usageCount: 12, expiresAt: null },
  { code: "OLDCODE",  discountPct: 20, label: "Expired promo",          active: false, usageLimit: 10,   usageCount: 10, expiresAt: "2026-01-01T00:00:00Z" },
];

export class MockPricingConfigRepository implements IPricingConfigRepository {
  private config = structuredClone(MOCK_CONFIG);
  private tiers  = structuredClone(MOCK_DISCOUNT_TIERS);
  private codes  = new Map(MOCK_PROMO_CODES.map((c) => [c.code.toUpperCase(), { ...c }]));
  private foundingMemberCount = 8; // current count

  async getConfig(): Promise<PricingConfigRecord> {
    return { ...this.config };
  }

  async getDiscountTiers(): Promise<DiscountTierRecord[]> {
    return this.tiers.filter((t) => t.active);
  }

  async getPromoCode(code: string): Promise<PromoCodeRecord | null> {
    const record = this.codes.get(code.toUpperCase());
    if (!record) return null;
    if (!record.active) return null;
    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return null;
    if (record.usageLimit !== null && record.usageCount >= record.usageLimit) return null;
    return { ...record };
  }

  async getFoundingMemberCount(): Promise<number> {
    return this.foundingMemberCount;
  }

  async incrementFoundingMemberCount(): Promise<void> {
    this.foundingMemberCount = Math.min(
      this.foundingMemberCount + 1,
      this.config.foundingMemberLimit
    );
  }
}
