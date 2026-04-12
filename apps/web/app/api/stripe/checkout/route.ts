import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db, orders, orderItems, products, bundles, businesses, cities } from "@homereach/db";
import { eq, and } from "drizzle-orm";
import { createOneTimeCheckoutSession } from "@homereach/services/stripe";
import { snapshotPrice } from "@homereach/services/pricing";
import type { ResolvePriceInput, DiscountContext } from "@homereach/types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/checkout
// Creates a Stripe Checkout session and an Order record in pending status.
// The webhook will activate the order on payment.success.
// ─────────────────────────────────────────────────────────────────────────────

// Add-on shape from checkout form (client-defined, price re-validated server-side)
const AddonInputSchema = z.object({
  slug:        z.string().min(1).max(100),
  name:        z.string().min(1).max(200),
  priceCents:  z.number().int().min(0).max(1_000_000),
  billingType: z.enum(["one_time", "monthly"]),
});

// Authoritative add-on price catalog — CLIENT prices are validated against this.
// If a slug is unknown, the client-provided price is used (allows new add-ons).
const ADDON_PRICE_CATALOG: Record<string, number> = {
  "fridge-magnet":      4900,
  "calendar-insert":    7900,
  "flyer-bundle-250":   3900,
  "business-cards-500": 2900,
  "automation-monthly": 9900,
  "website-build":      49900,
};

const CheckoutSchema = z.object({
  bundleId: z.string().uuid(),
  addonIds: z.array(z.string().uuid()).optional().default([]),   // legacy, not used
  addons:   z.array(AddonInputSchema).optional().default([]),    // structured add-ons
  businessId: z.string().uuid().optional(), // existing business
  // If no businessId, create a new business from these fields:
  businessName: z.string().min(1).optional(),
  phone: z.string().optional(),
  cityId: z.string().uuid(),
  categoryId: z.string().uuid(),
  // NOTE: isFounding and isVerifiedMilitary are intentionally NOT in this schema.
  // Discount eligibility is always derived server-side from the DB:
  //   isFounding        ← cities.founding_eligible (admin-controlled)
  //   isVerifiedMilitary ← businesses.is_military (admin-set after proof of service)
  // Accepting these from the client would allow discount spoofing.
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      bundleId,
      addons: rawAddons,
      businessId,
      businessName,
      phone,
      cityId,
      categoryId,
    } = parsed.data;

    // Validate add-on prices server-side against authoritative catalog.
    // Unknown slugs pass through (allows admin-seeded products not in catalog).
    const validatedAddons = rawAddons.map((a) => ({
      ...a,
      priceCents: ADDON_PRICE_CATALOG[a.slug] ?? a.priceCents,
    }));

    // ── Validate city + derive founding eligibility (Phase 5, fail-fast) ────────
    // Done before any writes so we don't create orphaned records for bad city IDs.
    // Client input for isFounding is IGNORED — eligibility comes from the DB only.
    const [cityRecord] = await db
      .select({ id: cities.id, foundingEligible: cities.foundingEligible })
      .from(cities)
      .where(eq(cities.id, cityId))
      .limit(1);

    if (!cityRecord) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const isFounding = cityRecord.foundingEligible;

    // ── Fetch bundle ──────────────────────────────────────────────────────────
    const [bundle] = await db
      .select()
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (!bundle || !bundle.isActive) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // ── Resolve or create business — IDEMPOTENT ──────────────────────────────
    // If a pending business already exists for this user + city + category,
    // reuse it rather than creating a duplicate. This prevents double-records
    // on form retries or back-button re-submits.
    let resolvedBusinessId = businessId;

    if (!resolvedBusinessId) {
      if (!businessName) {
        return NextResponse.json(
          { error: "businessName required when creating a new business" },
          { status: 400 }
        );
      }

      // Check for an existing pending business for this user+city+category
      const [existing] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(
          and(
            eq(businesses.ownerId,    user.id),
            eq(businesses.cityId,     cityId),
            eq(businesses.categoryId, categoryId),
            eq(businesses.status,     "pending")
          )
        )
        .limit(1);

      if (existing) {
        resolvedBusinessId = existing.id;
      } else {
        const [newBusiness] = await db
          .insert(businesses)
          .values({
            ownerId:    user.id,
            name:       businessName,
            phone:      phone ?? null,
            cityId,
            categoryId,
            status:     "pending",
          })
          .returning({ id: businesses.id });

        resolvedBusinessId = newBusiness!.id;
      }
    }

    // ── Phase 5: Derive military eligibility server-side (anti-spoof) ─────────
    // Client input for isVerifiedMilitary is IGNORED.
    // businesses.is_military is admin-set — never trusted from client.
    // New businesses default to false; admin verifies and sets after sign-up.
    let isVerifiedMilitary = false;
    if (resolvedBusinessId) {
      const [bizRecord] = await db
        .select({ isMilitary: businesses.isMilitary })
        .from(businesses)
        .where(eq(businesses.id, resolvedBusinessId))
        .limit(1);
      isVerifiedMilitary = bizRecord?.isMilitary ?? false;
    }

    // ── Resolve authoritative price via pricing engine ────────────────────────
    // snapshotPrice() is the ONLY source of billing truth for this order.
    // bundle.price is display-only and MUST NOT be used for Stripe charges.
    //
    // NOTE — Subscription path (Task 1):
    //   Once spot_assignments exist, spot/bundle purchases must switch to
    //   createSubscriptionCheckoutSession(). That function requires a reservationId
    //   and spotIds which only exist after Task 1. Until then, all checkouts use
    //   mode:"payment" via createOneTimeCheckoutSession().
    const priceInput: ResolvePriceInput = {
      productType: "bundle",
      billingInterval: "monthly",
      cityId,
      bundleId,
      isFounding,
    };
    const discountCtx: DiscountContext = {
      isVerifiedMilitary,
      spotCountInCart: 1, // single-bundle checkout; multi-spot carts update this in the future
    };
    const snapshot = await snapshotPrice(priceInput, discountCtx);
    const priceInCents = snapshot.finalPriceCents;

    // ── Create order record — IDEMPOTENT ──────────────────────────────────────
    // If a pending order already exists for this business + bundle (no session
    // yet), reuse it. This prevents orphaned orders on retries.
    const [existingOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.businessId, resolvedBusinessId),
          eq(orders.bundleId,   bundleId),
          eq(orders.status,     "pending")
        )
      )
      .limit(1);

    let orderId: string;

    // Total including add-ons
    const addonTotalCents = validatedAddons.reduce((s, a) => s + a.priceCents, 0);
    const grandTotalCents = priceInCents + addonTotalCents;

    if (existingOrder) {
      orderId = existingOrder.id;
    } else {
      // Store resolved cents as decimal strings (Drizzle numeric columns expect this)
      const subtotalDecimal = (priceInCents / 100).toFixed(2);
      const totalDecimal    = (grandTotalCents / 100).toFixed(2);
      const [order] = await db
        .insert(orders)
        .values({
          businessId: resolvedBusinessId,
          bundleId,
          status:   "pending",
          subtotal: subtotalDecimal,
          total:    totalDecimal,
        })
        .returning({ id: orders.id });
      orderId = order!.id;
    }

    // ── Persist add-on order items ─────────────────────────────────────────────
    // Upsert products by slug, then create orderItems for each selected add-on.
    if (validatedAddons.length > 0) {
      for (const addon of validatedAddons) {
        try {
          // Find or create product by slug
          let [product] = await db
            .select({ id: products.id })
            .from(products)
            .where(eq(products.slug, addon.slug))
            .limit(1);

          if (!product) {
            const [newProduct] = await db
              .insert(products)
              .values({
                name:      addon.name,
                slug:      addon.slug,
                type:      "addon",
                basePrice: (addon.priceCents / 100).toFixed(2),
                isActive:  true,
              })
              .returning({ id: products.id });
            product = newProduct!;
          }

          // Create order item
          const unitStr  = (addon.priceCents / 100).toFixed(2);
          await db
            .insert(orderItems)
            .values({
              orderId,
              productId:  product.id,
              quantity:   1,
              unitPrice:  unitStr,
              totalPrice: unitStr,
            })
            .onConflictDoNothing();
        } catch (err) {
          // Non-fatal — log and continue; don't block the checkout
          console.error(`[checkout] Failed to create orderItem for addon ${addon.slug}:`, err);
        }
      }
    }

    // ── Create Stripe Checkout session ────────────────────────────────────────
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";

    const session = await createOneTimeCheckoutSession({
      orderId,
      bundleId,
      addonIds: [],   // structured addons handled above via orderItems
      businessName: businessName ?? resolvedBusinessId,
      cityId,
      categoryId,
      email: user.email!,
      priceInCents: grandTotalCents,
      pricingSnapshot: snapshot,
      successUrl: `${appUrl}/checkout/success?order=${orderId}`,
      cancelUrl: `${appUrl}/get-started`,
    });

    // Store checkout session ID on the order for webhook correlation
    await db
      .update(orders)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/checkout]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
