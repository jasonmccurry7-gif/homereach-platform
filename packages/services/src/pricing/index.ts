// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Pricing Engine
//
// Deterministic price resolution for all billing flows.
// All six functions are pure business logic — no HTTP, no Stripe calls.
//
// Resolution order (LOCKED — do not modify without architecture review):
//   1. base_price_cents from pricing_profiles
//   2. founding_price_cents override (if isFounding=true)
//   3. bundle-level profile override (if bundleId provided)
//   4. military discount (discount_rules, priority=10)
//   5. multi-spot discount (discount_rules, priority=20)
//   6. admin override (reserved — not implemented)
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, isNull, lte, gte, or, asc } from "drizzle-orm";
import { db } from "@homereach/db";
import {
  pricingProfiles,
  discountRules,
  bundles,
} from "@homereach/db/schema";
import type {
  PricingProductType,
  SpotType,
  BillingInterval,
  CampaignTier,
  ResolvePriceInput,
  ResolvedPrice,
  DiscountContext,
  DiscountResult,
  AppliedDiscount,
  CampaignPriceResult,
  PricingSnapshot,
  DiscountRuleType,
} from "@homereach/types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. getActivePricingProfile
//
// Resolves the correct pricing profile for a product + billing interval.
// Currently returns the global default profile.
//
// TODO (Task 2 integration): When cities.pricing_profile_id exists, join
// cities table and return the city-level override if it matches the criteria.
// The TODO comment below marks exactly where to insert that branch.
// ─────────────────────────────────────────────────────────────────────────────

export async function getActivePricingProfile(
  productType: PricingProductType,
  billingInterval: BillingInterval,
  spotType?: SpotType,
  cityId?: string
) {
  const now = new Date();

  // TODO (Task 2): If cityId is provided, query:
  //   const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId), with: { pricingProfile: true } });
  //   if (city?.pricingProfile?.isActive && city.pricingProfile.productType === productType) {
  //     return city.pricingProfile;
  //   }
  // Fall through to global default if city has no override.

  const filters = [
    eq(pricingProfiles.productType, productType),
    eq(pricingProfiles.billingInterval, billingInterval),
    eq(pricingProfiles.isActive, true),
    or(
      isNull(pricingProfiles.effectiveFrom),
      lte(pricingProfiles.effectiveFrom, now)
    ),
    or(
      isNull(pricingProfiles.effectiveUntil),
      gte(pricingProfiles.effectiveUntil, now)
    ),
  ];

  // Spot type must match exactly — null for non-spot products
  if (spotType) {
    filters.push(eq(pricingProfiles.spotType, spotType));
  } else {
    filters.push(isNull(pricingProfiles.spotType));
  }

  const rows = await db
    .select()
    .from(pricingProfiles)
    .where(and(...filters))
    .limit(2); // limit 2 so we can detect non-determinism for spot products

  if (rows.length === 0) {
    throw new Error(
      `No active pricing profile found for productType=${productType} billingInterval=${billingInterval} spotType=${spotType ?? "null"}`
    );
  }

  // Phase 8: Non-determinism guard — applies to spot products only.
  //
  // Spot profiles are governed by the partial unique index idx_pp_unique_spot_profile
  // on (product_type, spot_type, billing_interval) WHERE is_active = TRUE AND spot_type IS NOT NULL.
  // That index guarantees exactly one active profile per spot type. If we see 2+ results,
  // the index has been violated — this is a data integrity error that must not be silenced.
  //
  // Non-spot products (addons, bundles, automations) intentionally have multiple active
  // profiles per (product_type, billing_interval) — they're differentiated by name.
  // getActivePricingProfile() for non-spot types is a "best first match" and the caller
  // (resolvePrice / resolveBundlePrice) is responsible for providing a more specific
  // discriminator (bundleId, name lookup, etc.) when multiple profiles exist.
  if (spotType && rows.length > 1) {
    throw new Error(
      `[pricing] Non-deterministic: ${rows.length} active spot profiles found for ` +
      `productType=${productType} spotType=${spotType} billingInterval=${billingInterval}. ` +
      `Partial unique index idx_pp_unique_spot_profile may be violated — inspect pricing_profiles table.`
    );
  }

  return rows[0]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. resolvePrice
//
// Follows the locked resolution order to produce a working price before discounts.
// Steps 1-3 of the resolution chain.
// ─────────────────────────────────────────────────────────────────────────────

export async function resolvePrice(
  input: ResolvePriceInput
): Promise<ResolvedPrice> {
  const {
    productType,
    spotType,
    billingInterval = "monthly",
    cityId,
    bundleId,
    isFounding = false,
  } = input;

  // ── Bundle fast-path (promoted from Step 3) ───────────────────────────────
  // When bundleId is provided and the bundle has a pricingProfileId, resolve
  // directly from that specific profile WITHOUT calling getActivePricingProfile().
  //
  // WHY: Multiple bundle profiles share the same (product_type='bundle',
  // billing_interval='monthly') lookup keys. getActivePricingProfile() for bundles
  // would be non-deterministic (returns whichever row the DB fetches first).
  // Bundles must always resolve via their specific pricingProfileId — this is the
  // authoritative link set by migration 09.
  if (bundleId) {
    const [bundleRow] = await db
      .select({ pricingProfileId: bundles.pricingProfileId })
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (bundleRow?.pricingProfileId) {
      const [bundleProfile] = await db
        .select()
        .from(pricingProfiles)
        .where(
          and(
            eq(pricingProfiles.id, bundleRow.pricingProfileId),
            eq(pricingProfiles.isActive, true)
          )
        )
        .limit(1);

      if (bundleProfile) {
        const bundleFoundingApplies =
          isFounding &&
          bundleProfile.foundingPriceCents !== null &&
          bundleProfile.foundingPriceCents !== undefined;

        const workingPriceCents = bundleFoundingApplies
          ? bundleProfile.foundingPriceCents!
          : bundleProfile.basePriceCents;

        return {
          pricingProfileId: bundleProfile.id,
          productType,
          spotType,
          billingInterval,
          basePriceCents: bundleProfile.basePriceCents,
          workingPriceCents,
          compareAtPriceCents: bundleProfile.compareAtPriceCents ?? undefined,
          isFoundingPrice: bundleFoundingApplies,
        };
      }
    }
    // Fall through: bundle has no pricingProfileId (should not happen after migration 09).
    // Proceeds to standard getActivePricingProfile() path as a safe fallback.
  }

  // ── Standard path ─────────────────────────────────────────────────────────
  // Resolves by (product_type, billing_interval, spot_type) lookup.
  // Deterministic for spots (unique index enforced). For non-spot products
  // without a bundleId discriminator, the first matching profile is used.

  // Step 1: Load the base profile
  const profile = await getActivePricingProfile(
    productType,
    billingInterval,
    spotType,
    cityId
  );

  let workingPriceCents = profile.basePriceCents;
  let isFoundingPrice = false;

  // Step 2: Apply founding price override
  // Only applies if founding_price_cents is not null AND not zero.
  // foundingPriceCents === 0 is treated as "truly free" and IS a valid founding price.
  if (isFounding && profile.foundingPriceCents !== null && profile.foundingPriceCents !== undefined) {
    workingPriceCents = profile.foundingPriceCents;
    isFoundingPrice = true;
  }

  return {
    pricingProfileId: profile.id,
    productType,
    spotType,
    billingInterval,
    basePriceCents: profile.basePriceCents,
    workingPriceCents,
    compareAtPriceCents: profile.compareAtPriceCents ?? undefined,
    isFoundingPrice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveBundlePrice
//
// Resolves bundle total. Prefers the bundle-level pricing profile.
// Falls back to summing component product profiles if no bundle profile exists.
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveBundlePrice(
  bundleId: string,
  cityId: string,
  isFounding = false
): Promise<{ totalCents: number; isFoundingPrice: boolean; pricingProfileId: string | null }> {
  const [bundle] = await db
    .select({
      id: bundles.id,
      pricingProfileId: bundles.pricingProfileId,
    })
    .from(bundles)
    .where(eq(bundles.id, bundleId))
    .limit(1);

  if (!bundle) throw new Error(`Bundle ${bundleId} not found`);

  // Use bundle-level profile if available and active
  if (bundle.pricingProfileId) {
    const resolved = await resolvePrice({
      productType: "bundle",
      billingInterval: "monthly",
      cityId,
      bundleId,
      isFounding,
    });
    return {
      totalCents: resolved.workingPriceCents,
      isFoundingPrice: resolved.isFoundingPrice,
      pricingProfileId: resolved.pricingProfileId,
    };
  }

  // Fallback: sum component profiles
  // Fetches bundleProducts with product type, then resolves each product's price.
  // This is the path for bundles that don't yet have a pricingProfileId set.
  const bundleProductRows = await db.query.bundleProducts.findMany({
    where: (bp) => eq(bp.bundleId, bundleId),
    with: { product: true },
  });

  let totalCents = 0;
  for (const bp of bundleProductRows) {
    // Map catalog product type to pricing product type
    const pricingType: PricingProductType =
      bp.product.type === "automation" ? "automation" : "addon";

    try {
      const resolved = await resolvePrice({
        productType: pricingType,
        billingInterval: "monthly",
        cityId,
        isFounding,
      });
      totalCents += resolved.workingPriceCents * (bp.quantity ?? 1);
    } catch {
      // If a component has no pricing profile, skip it (non-fatal for display)
      console.warn(`[pricing] No profile for bundle component: ${bp.product.slug}`);
    }
  }

  return { totalCents, isFoundingPrice: isFounding, pricingProfileId: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. applyDiscounts
//
// Applies all active, qualifying discount rules in priority order.
// Respects the stackable flag — when stackable=false, stops after that rule fires.
//
// IMPORTANT: workingPriceCents here is the price for a SINGLE item being discounted.
// For multi-spot: call this once per additional spot (spots 2+), not once for all.
// ─────────────────────────────────────────────────────────────────────────────

export async function applyDiscounts(
  workingPriceCents: number,
  context: DiscountContext
): Promise<DiscountResult> {
  const rules = await db
    .select()
    .from(discountRules)
    .where(eq(discountRules.isActive, true))
    .orderBy(asc(discountRules.priority));

  let remaining = workingPriceCents;
  const applied: AppliedDiscount[] = [];

  for (const rule of rules) {
    let qualifies = false;

    if (rule.ruleType === "military") {
      qualifies = context.isVerifiedMilitary === true;
    } else if (rule.ruleType === "multi_spot") {
      const cond = rule.conditions as { min_spots_in_cart?: number };
      qualifies = (context.spotCountInCart ?? 1) >= (cond.min_spots_in_cart ?? 2);
    }
    // promo_code and future_reserved: not yet implemented — will never qualify

    if (!qualifies) continue;

    const pct = rule.discountPct ? parseFloat(rule.discountPct) : 0;
    const flat = rule.discountCents ?? 0;
    const effect = rule.effect as { apply_to?: string; label?: string };

    // Calculate discount amount
    // Both percentage and flat are supported; percentage takes priority if set
    const discountAmountCents =
      pct > 0
        ? Math.round(remaining * pct / 100)
        : flat;

    remaining = Math.max(0, remaining - discountAmountCents);
    applied.push({
      ruleId: rule.id,
      ruleType: rule.ruleType as DiscountRuleType,
      label: effect.label ?? rule.name,
      discountAmountCents,
    });

    // Stop processing if this rule is not stackable
    if (!rule.stackable) break;
  }

  return {
    originalPriceCents: workingPriceCents,
    finalPriceCents: remaining,
    discountsApplied: applied,
    totalDiscountCents: workingPriceCents - remaining,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. calculateCampaignPrice
//
// Per-unit pricing for targeted direct-mail campaigns.
// Per-unit rate = midpoint of the tier's price range.
// Setup fee is charged as a separate one_time line item.
// ─────────────────────────────────────────────────────────────────────────────

export async function calculateCampaignPrice(
  quantity: number,
  tier: CampaignTier
): Promise<CampaignPriceResult> {
  const profileNames: Record<CampaignTier, string> = {
    standard: "Campaign — Standard",
    premium: "Campaign — Premium",
    saturation: "Campaign — Saturation",
  };

  const setupFeeNames: Record<CampaignTier, string | null> = {
    standard: "Campaign — Standard Setup Fee",
    premium: "Campaign — Standard Setup Fee", // Premium uses same setup fee as Standard
    saturation: null, // No setup fee for saturation tier
  };

  const [profile] = await db
    .select()
    .from(pricingProfiles)
    .where(
      and(
        eq(pricingProfiles.name, profileNames[tier]),
        eq(pricingProfiles.isActive, true)
      )
    )
    .limit(1);

  if (!profile) {
    throw new Error(`No active campaign pricing profile found for tier: ${tier}`);
  }

  const minQty = profile.minQuantity ?? 2500;
  if (quantity < minQty) {
    throw new Error(
      `Minimum quantity for ${tier} campaigns is ${minQty.toLocaleString()} homes. Requested: ${quantity.toLocaleString()}.`
    );
  }

  // Resolve per-unit rate as midpoint of the range
  const minRate = profile.perUnitPriceCentsMin ?? 0;
  const maxRate = profile.perUnitPriceCentsMax ?? minRate;
  const perUnitPriceCents = Math.round((minRate + maxRate) / 2);

  const subtotalCents = quantity * perUnitPriceCents;

  // Resolve setup fee
  let setupFeeCents = 0;
  const setupFeeName = setupFeeNames[tier];
  if (setupFeeName) {
    const [setupProfile] = await db
      .select({ basePriceCents: pricingProfiles.basePriceCents })
      .from(pricingProfiles)
      .where(
        and(
          eq(pricingProfiles.name, setupFeeName),
          eq(pricingProfiles.isActive, true)
        )
      )
      .limit(1);
    setupFeeCents = setupProfile?.basePriceCents ?? 0;
  }

  return {
    tier,
    quantity,
    perUnitPriceCents,
    subtotalCents,
    setupFeeCents,
    totalCents: subtotalCents + setupFeeCents,
    pricingProfileId: profile.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. snapshotPrice
//
// Creates the immutable pricing snapshot. This is the last function called
// before createSubscriptionCheckoutSession().
//
// The snapshot output:
//   - Is passed as a parameter to createSubscriptionCheckoutSession()
//   - Is stored in Stripe session metadata (for webhook recovery)
//   - Is written to spot_assignments.pricing_snapshot (Task 1 webhook handler)
//   - Is used to populate orderItems.unitPrice and orderItems.totalPrice
//
// The Stripe line item unit_amount MUST equal snapshot.finalPriceCents.
// Any divergence is a billing bug.
// ─────────────────────────────────────────────────────────────────────────────

export async function snapshotPrice(
  input: ResolvePriceInput,
  discountContext: DiscountContext = {}
): Promise<PricingSnapshot> {
  // Step 1–3: Resolve base price with founding/bundle overrides
  const resolved = await resolvePrice(input);

  // Steps 4–5: Apply discount rules
  const discountResult = await applyDiscounts(
    resolved.workingPriceCents,
    discountContext
  );

  const snapshot: PricingSnapshot = {
    pricingProfileId:    resolved.pricingProfileId,
    productType:         resolved.productType,
    spotType:            resolved.spotType,
    billingInterval:     resolved.billingInterval,
    basePriceCents:      resolved.basePriceCents,
    compareAtPriceCents: resolved.compareAtPriceCents,
    workingPriceCents:   resolved.workingPriceCents,
    isFoundingPrice:     resolved.isFoundingPrice,
    discountsApplied:    discountResult.discountsApplied,
    finalPriceCents:     discountResult.finalPriceCents,
    snapshotAt:          new Date().toISOString(),
    snapshotVersion:     1,
  };

  return snapshot;
}
