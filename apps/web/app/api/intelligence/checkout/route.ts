import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-27",
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/intelligence/checkout
// Accepts: tier, city, category, market_size, businessName, email, phone
// - Looks up pricing from property_intelligence_tiers
// - Checks founding_slots availability
// - Creates Stripe checkout session
// - Creates founding_membership record (if founding available)
// - Updates founding_slots.slots_taken
// - Returns { checkoutUrl }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const db = createServiceClient();

  try {
    const body = await req.json();
    const {
      tier,
      city,
      category,
      market_size,
      businessName,
      email,
      phone,
      userId,
    } = body;

    if (!tier || !city || !businessName || !email || !phone) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: tier, city, businessName, email, phone",
        },
        { status: 400 }
      );
    }

    // Step 1: Look up pricing from property_intelligence_tiers
    const { data: tierData, error: tierError } = await db
      .from("property_intelligence_tiers")
      .select("*")
      .eq("tier", tier)
      .eq("is_active", true)
      .single();

    if (tierError || !tierData) {
      return NextResponse.json(
        { error: "Tier not found or inactive" },
        { status: 404 }
      );
    }

    // Step 2: Check founding_slots availability
    const { data: slot, error: slotError } = await db
      .from("founding_slots")
      .select("*")
      .eq("product", `intelligence_${tier}`)
      .eq("city", city)
      .eq("founding_open", true)
      .single();

    if (slotError) {
      console.error("Error checking founding slots:", slotError);
    }

    // Determine if founding is available and use appropriate pricing
    let isFounding = false;
    let priceCents = tierData.standard_price_cents;

    if (slot && slot.slots_remaining > 0 && slot.founding_open) {
      isFounding = true;
      priceCents = tierData.founding_price_cents;
    }

    // Step 3: Create Stripe checkout session
    const isSubscription = tier === "t2" || tier === "t3";
    const mode: "payment" | "subscription" = isSubscription ? "subscription" : "payment";

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = isSubscription
      ? {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Property Intelligence ${tier.toUpperCase()} - ${city}`,
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
              name: `Property Intelligence ${tier.toUpperCase()} - ${city}`,
              description: `One-time purchase${
                isFounding ? " (Founding Member Rate)" : ""
              }`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [lineItem],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://homereach.app"}/intelligence?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://homereach.app"}/intelligence?cancelled=true`,
      customer_email: email,
      metadata: {
        city,
        category: category || "all",
        tier,
        founding_flag: isFounding.toString(),
        locked_price: priceCents.toString(),
        business_name: businessName,
      },
    });

    // Step 4: Create founding_membership record if founding
    if (isFounding && slot) {
      const { error: memberError } = await db
        .from("founding_memberships")
        .insert({
          business_name: businessName,
          city,
          category: category || null,
          product: `intelligence_${tier}`,
          tier,
          locked_price_cents: priceCents,
          standard_price_cents: tierData.standard_price_cents,
          stripe_subscription_id: isSubscription ? session.subscription : null,
          stripe_checkout_session_id: session.id,
          status: "active",
        });

      if (memberError) {
        console.error("Error creating founding membership:", memberError);
      }

      // Step 5: Update founding_slots.slots_taken
      const newSlotsTaken = (slot.slots_taken || 0) + 1;
      const { error: updateError } = await db
        .from("founding_slots")
        .update({
          slots_taken: newSlotsTaken,
          slots_remaining: Math.max(0, slot.total_slots - newSlotsTaken),
        })
        .eq("id", slot.id);

      if (updateError) {
        console.error("Error updating founding slot:", updateError);
      }
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      isFounding,
      priceCents,
      stripeSessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
