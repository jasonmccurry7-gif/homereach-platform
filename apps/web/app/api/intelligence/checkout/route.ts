import { createServiceClient } from "@/lib/supabase/service";
import { getPublicAppBaseUrl } from "@/lib/runtime/app-url";
import {
  buildPropertyIntelligenceCheckoutMetadata,
  pickFoundingSlot,
  readIntelligenceCheckoutPayload,
  toPositiveCents,
} from "@/lib/intelligence/checkout";
import { NextResponse } from "next/server";
import { getStripe } from "@homereach/services/stripe";
import type Stripe from "stripe";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/intelligence/checkout
// Accepts: tier, city, category, market_size, businessName, email, phone
// - Looks up pricing from property_intelligence_tiers
// - Checks founding_slots availability
// - Creates Stripe checkout session
// - Defers membership/slot activation to signed Stripe webhook after payment
// - Returns { checkoutUrl }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const normalized = await readIntelligenceCheckoutPayload(req);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const checkout = normalized.value;
    const db = createServiceClient();

    // Step 1: Look up pricing from property_intelligence_tiers
    const { data: tierData, error: tierError } = await db
      .from("property_intelligence_tiers")
      .select("*")
      .eq("tier", checkout.tier)
      .eq("is_active", true)
      .single();

    if (tierError || !tierData) {
      return NextResponse.json(
        { error: "Tier not found or inactive" },
        { status: 404 }
      );
    }

    const standardPriceCents = toPositiveCents(tierData.standard_price_cents);
    if (standardPriceCents === null) {
      return NextResponse.json(
        { error: "Tier pricing is not configured" },
        { status: 500 }
      );
    }

    const product = `intelligence_${checkout.tier}`;

    // Step 2: Check founding_slots availability. Fetch city/product slots so
    // category-specific availability can win over a citywide fallback slot.
    const { data: slots, error: slotError } = await db
      .from("founding_slots")
      .select("*")
      .eq("product", product)
      .eq("city", checkout.city)
      .eq("founding_open", true);

    if (slotError) {
      console.error("Error checking founding slots:", slotError);
    }

    // Determine if founding is available and use appropriate pricing
    const slot = pickFoundingSlot(slots, checkout.category);
    const foundingPriceCents = toPositiveCents(tierData.founding_price_cents);
    const isFounding = Boolean(slot && foundingPriceCents !== null);
    const priceCents = isFounding ? foundingPriceCents! : standardPriceCents;

    // Step 3: Create Stripe checkout session. Do not write active membership
    // or decrement founding inventory until the signed Stripe webhook confirms payment.
    const isSubscription = checkout.tier === "t2" || checkout.tier === "t3";
    const mode: "payment" | "subscription" = isSubscription ? "subscription" : "payment";
    const appUrl = getPublicAppBaseUrl();
    const metadata = buildPropertyIntelligenceCheckoutMetadata({
      checkout,
      product,
      isFounding,
      lockedPriceCents: priceCents,
      standardPriceCents,
      slotId: slot?.id ?? null,
      slotCategory: slot?.category ?? null,
    });

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = isSubscription
      ? {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Property Intelligence ${checkout.tier.toUpperCase()} - ${checkout.city}`,
              description: `Monthly subscription${
                isFounding ? " (Founding Member Rate)" : ""
              }`,
            },
            unit_amount: priceCents,
            recurring: {
              interval: "month",
              interval_count: 1,
            },
          },
          quantity: 1,
        }
      : {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Property Intelligence ${checkout.tier.toUpperCase()} - ${checkout.city}`,
              description: `One-time purchase${
                isFounding ? " (Founding Member Rate)" : ""
              }`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        };

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [lineItem],
      success_url: `${appUrl}/intelligence?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/intelligence?cancelled=true`,
      customer_email: checkout.email,
      client_reference_id: checkout.email,
      metadata,
      ...(isSubscription
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      isFounding,
      priceCents,
      stripeSessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating intelligence checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
