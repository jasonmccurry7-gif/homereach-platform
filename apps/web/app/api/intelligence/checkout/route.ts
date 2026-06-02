import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";

const CheckoutSchema = z.object({
  tier: z.string().trim().min(1).max(24).regex(/^[a-z0-9_-]+$/i),
  city: z.string().trim().min(1).max(120),
  category: z.string().trim().max(120).optional().nullable(),
  market_size: z.union([z.string().trim().max(80), z.number()]).optional().nullable(),
  businessName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional().default(""),
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

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
  const limited = checkRateLimit(req, {
    key: "property-intelligence-checkout",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const db = createServiceClient();

  try {
    const body = await req.json().catch(() => null);
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkout request" },
        { status: 400 },
      );
    }

    const {
      tier,
      city,
      category,
      market_size,
      businessName,
      email,
      phone,
    } = parsed.data;

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
      .maybeSingle();

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
    const stripe = getStripe();
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://homereach.app"}/intelligence?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://homereach.app"}/intelligence?cancelled=true`,
      customer_email: email,
      metadata: {
        type: "property_intelligence",
        city,
        category: category || "all",
        market_size: market_size ? String(market_size) : "",
        tier,
        founding_flag: isFounding.toString(),
        locked_price: priceCents.toString(),
        standard_price: tierData.standard_price_cents.toString(),
        business_name: businessName,
        email,
        phone,
        user_id: "",
        slot_id: slot?.id ?? "",
      },
    });

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
