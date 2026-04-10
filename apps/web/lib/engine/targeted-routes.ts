// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Targeted Route Engine
//
// Entirely separate from the shared postcard system.
// Handles: pricing tiers, reach calculation, campaign cost,
//          route filtering, and future targeting support.
//
// Design principle: keep ALL targeted-campaign logic in this file.
// Never mix with pricing.ts (shared postcard) or availability.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { CarrierRoute, RoutePricingTier, TargetedCampaign } from "./types";

// ── Pricing Configuration ────────────────────────────────────────────────────
// TODO: Pull from Supabase `route_pricing_tiers` table when DB is connected.

export const ROUTE_PRICING_TIERS: RoutePricingTier[] = [
  {
    id:               "tier-starter",
    label:            "Starter",
    minHouseholds:    2_500,
    maxHouseholds:    4_999,
    pricePerThousand: 40,
    description:      "Great for testing a new area or category",
  },
  {
    id:               "tier-growth",
    label:            "Growth",
    minHouseholds:    5_000,
    maxHouseholds:    9_999,
    pricePerThousand: 37,
    description:      "Ideal for neighborhood-level saturation",
  },
  {
    id:               "tier-scale",
    label:            "Scale",
    minHouseholds:    10_000,
    maxHouseholds:    24_999,
    pricePerThousand: 34,
    description:      "City-wide reach at volume pricing",
  },
  {
    id:               "tier-enterprise",
    label:            "Enterprise",
    minHouseholds:    25_000,
    maxHouseholds:    Infinity,
    pricePerThousand: 30,
    description:      "Maximum market penetration — best rate",
  },
];

export const MINIMUM_HOUSEHOLDS = 2_500;

// ── Reach Summary ────────────────────────────────────────────────────────────

export interface RouteSelection {
  selectedRoutes:   CarrierRoute[];
  totalHouseholds:  number;
  tier:             RoutePricingTier | null;  // null if below minimum
  pricePerThousand: number;
  totalPrice:       number;
  isBelowMinimum:   boolean;
  shortfallHomes:   number;   // how many more to hit minimum
  savingsVsBase:    number;   // $ saved vs base rate ($40/k)
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class TargetedRouteEngine {

  // ── Pure static pricing ────────────────────────────────────────────────

  /**
   * Find the best pricing tier for a given household count.
   * Returns null if below MINIMUM_HOUSEHOLDS.
   */
  static getTier(households: number): RoutePricingTier | null {
    if (households < MINIMUM_HOUSEHOLDS) return null;
    return (
      [...ROUTE_PRICING_TIERS]
        .reverse()
        .find((t) => households >= t.minHouseholds) ?? null
    );
  }

  /**
   * Calculate total campaign price for a given household count.
   * Returns 0 if below minimum.
   */
  static calculatePrice(households: number): number {
    const tier = TargetedRouteEngine.getTier(households);
    if (!tier) return 0;
    return Math.round((households / 1_000) * tier.pricePerThousand);
  }

  /**
   * Full selection summary — the main entry point for the builder UI.
   */
  static summarize(selectedRoutes: CarrierRoute[]): RouteSelection {
    const totalHouseholds = selectedRoutes.reduce((s, r) => s + r.households, 0);
    const tier             = TargetedRouteEngine.getTier(totalHouseholds);
    const pricePerThousand = tier?.pricePerThousand ?? ROUTE_PRICING_TIERS[0].pricePerThousand;
    const totalPrice       = TargetedRouteEngine.calculatePrice(totalHouseholds);
    const isBelowMinimum   = totalHouseholds < MINIMUM_HOUSEHOLDS;
    const shortfallHomes   = Math.max(0, MINIMUM_HOUSEHOLDS - totalHouseholds);

    // Savings vs always-on base rate ($40/k)
    const baseCost = Math.round((totalHouseholds / 1_000) * 40);
    const savingsVsBase = baseCost - totalPrice;

    return {
      selectedRoutes,
      totalHouseholds,
      tier,
      pricePerThousand,
      totalPrice,
      isBelowMinimum,
      shortfallHomes,
      savingsVsBase: Math.max(0, savingsVsBase),
    };
  }

  /**
   * How many routes need to be added to reach the next pricing tier.
   * Returns null if already at the top tier.
   */
  static householdsToNextTier(currentHouseholds: number): number | null {
    const sorted = ROUTE_PRICING_TIERS.sort((a, b) => a.minHouseholds - b.minHouseholds);
    const next = sorted.find((t) => t.minHouseholds > currentHouseholds);
    return next ? next.minHouseholds - currentHouseholds : null;
  }

  /**
   * Label for the current tier + savings headline for the UI.
   */
  static getPricingCallout(households: number): {
    tierLabel: string;
    rateLabel: string;
    nextTierMsg: string | null;
  } {
    const tier = TargetedRouteEngine.getTier(households);
    const toNext = TargetedRouteEngine.householdsToNextTier(households);

    const tierLabel = tier ? `${tier.label} Rate` : "Below Minimum";
    const rateLabel = tier
      ? `$${tier.pricePerThousand}/1,000 homes`
      : `Add ${(MINIMUM_HOUSEHOLDS - households).toLocaleString()} more homes to unlock pricing`;

    const nextTierMsg = toNext
      ? `Add ${toNext.toLocaleString()} more homes to unlock a better rate`
      : null;

    return { tierLabel, rateLabel, nextTierMsg };
  }

  // ── Route filtering ────────────────────────────────────────────────────

  /**
   * Filter routes by city. Pure function — no DB.
   */
  static getRoutesForCity(allRoutes: CarrierRoute[], cityId: string): CarrierRoute[] {
    return allRoutes
      .filter((r) => r.cityId === cityId && r.available)
      .sort((a, b) => b.households - a.households);
  }

  /**
   * Future-ready: filter by targeting criteria.
   * Currently a no-op pass-through — logic added when UI supports it.
   */
  static applyTargetingFilters(
    routes: CarrierRoute[],
    filters: {
      incomeRange?: string;
      homeValueRange?: string;
      zipCluster?: string;
    }
  ): CarrierRoute[] {
    let result = routes;

    // TODO: implement real filter logic when targeting UI is built
    if (filters.incomeRange) {
      // result = result.filter((r) => r.targetingFilters.incomeRange === filters.incomeRange);
    }
    if (filters.homeValueRange) {
      // result = result.filter((r) => r.targetingFilters.homeValueRange === filters.homeValueRange);
    }
    if (filters.zipCluster) {
      // result = result.filter((r) => r.targetingFilters.zipCluster === filters.zipCluster);
    }

    return result;
  }

  // ── Campaign building ──────────────────────────────────────────────────

  /**
   * Assemble a TargetedCampaign from builder inputs.
   * Does NOT persist — call the repository to save.
   */
  static buildCampaign(params: {
    businessName: string;
    contactName:  string;
    phone:        string;
    email:        string;
    cityId:       string;
    city:         string;
    selectedRoutes: CarrierRoute[];
    notes?:       string;
    targetingFilters?: TargetedCampaign["targetingFilters"];
  }): Omit<TargetedCampaign, "id" | "createdAt"> {
    const summary = TargetedRouteEngine.summarize(params.selectedRoutes);

    return {
      campaignType:    "targeted",
      businessId:      null,
      businessName:    params.businessName,
      contactName:     params.contactName,
      phone:           params.phone,
      email:           params.email,
      cityId:          params.cityId,
      city:            params.city,
      selectedRouteIds: params.selectedRoutes.map((r) => r.id),
      totalHouseholds:  summary.totalHouseholds,
      pricePerThousand: summary.pricePerThousand,
      totalPrice:       summary.totalPrice,
      pricingTierLabel: summary.tier?.label ?? "Starter",
      targetingFilters: params.targetingFilters ?? {},
      status:           "pending_review",
      appearsInAdminDashboard:  true,
      appearsInClientDashboard: true,
      notes:            params.notes,
    };
  }

  // ── Formatting helpers ─────────────────────────────────────────────────

  static formatPrice(n: number): string {
    return `$${n.toLocaleString()}`;
  }

  static formatHomes(n: number): string {
    return n >= 1_000 ? `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k` : String(n);
  }
}
