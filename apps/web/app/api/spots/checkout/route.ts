import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import Stripe from "stripe";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/spots/checkout
// Creates a Stripe checkout session for a HomeReach ad spot.
// Uses Supabase JS (HTTP) — no Drizzle, reliable in Vercel serverless.
// ─────────────────────────────────────────────────────────────────────────────

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-03-31.basil" });
}

const SPOT_LABEL: Record<string, string> = {
  anchor: "Anchor Spot",
  front:  "Front Feature Spot",
  back:   "Back Feature Spot",
};

export async function POST(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createServiceClient();
    const body = await req.json();
    const { bundleId, cityId, categoryId, businessName, phone,
            addons = [], nonprofitId = null, citySlug = "", categorySlug = "" } = body;

    if (!bundleId || !cityId || !categoryId || !businessName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Load bundle
    const { data: bundle } = await db.from("bundles").select("*")
      .eq("id", bundleId).eq("is_active", true).single();
    if (!bundle) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });

    const meta       = (bundle.metadata ?? {}) as Record<string, unknown>;
    const spotType   = (meta.spotType as string) ?? "back";
    const maxSpots   = (meta.maxSpots as number) ?? 1;
    const bundlePrice = Math.round(Number(bundle.price) * 100);

    // 2. Load city
    const { data: city } = await db.from("cities")
      .select("id, name, state, founding_eligible").eq("id", cityId).single();
    if (!city) return NextResponse.json({ error: "City not found" }, { status: 404 });

    // 3. Check availability
    const { count: takenCount } = await db.from("spot_assignments")
      .select("id", { count: "exact" })
      .eq("city_id", cityId).eq("category_id", categoryId)
      .in("status", ["pending", "active"]);
    if ((takenCount ?? 0) >= maxSpots) {
      return NextResponse.json({ error: "This spot is no longer available." }, { status: 409 });
    }

    // 4. Resolve or create business
    let businessId: string;
    let existingStripeCustomerId: string | null = null;

    const { data: existingBiz } = await db.from("businesses")
      .select("id, stripe_customer_id").eq("owner_id", user.id)
      .eq("city_id", cityId).eq("category_id", categoryId)
      .eq("status", "pending").maybeSingle();

    if (existingBiz) {
      businessId = existingBiz.id;
      existingStripeCustomerId = existingBiz.stripe_customer_id ?? null;
    } else {
      const { data: newBiz, error: bizErr } = await db.from("businesses")
        .insert({ owner_id: user.id, name: businessName.trim(), phone: phone ?? null,
                  email: user.email, city_id: cityId, category_id: categoryId, status: "pending" })
        .select("id").single();
      if (bizErr || !newBiz) return NextResponse.json({ error: "Failed to create business" }, { status: 500 });
      businessId = newBiz.id;
    }

    // 5. Create pending spot_assignment
    const { data: assignment, error: assignErr } = await db.from("spot_assignments")
      .insert({ business_id: businessId, city_id: cityId, category_id: categoryId,
                bundle_id: bundleId, spot_type: spotType, status: "pending",
                monthly_value_cents: bundlePrice })
      .select("id").single();
    if (assignErr || !assignment) return NextResponse.json({ error: "Failed to reserve spot" }, { status: 500 });

    // 6. Resolve or create Stripe customer
    const stripe = getStripe();
    let stripeCustomerId = existingStripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { businessId },
      });
      stripeCustomerId = customer.id;
      await db.from("businesses").update({ stripe_customer_id: stripeCustomerId }).eq("id", businessId);
    }

    // 7. Build line items
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd", unit_amount: bundlePrice,
          recurring: { interval: "month" },
          product_data: {
            name: `HomeReach ${SPOT_LABEL[spotType] ?? "Ad Spot"} — ${city.name}`,
            description: `Monthly exclusive ad spot · ${city.name}, ${city.state}`,
          },
        },
        quantity: 1,
      },
    ];

    // ── Print products (one-time) ─────────────────────────────────────────────
    if (addons.includes("door_hangers")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 19700,
        product_data: { name: "Door Hangers (500)", description: "500 professionally designed door hangers for local distribution" } }, quantity: 1 });
    }
    if (addons.includes("fliers")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 9700,
        product_data: { name: "Fliers (500)", description: "500 full-color fliers for events and local distribution" } }, quantity: 1 });
    }
    if (addons.includes("yard_signs")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 14700,
        product_data: { name: "Yard Signs (10)", description: "10 branded yard signs with stakes" } }, quantity: 1 });
    }
    if (addons.includes("business_cards")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 7900,
        product_data: { name: "Business Cards (500)", description: "500 premium business cards, professionally designed and printed" } }, quantity: 1 });
    }

    // ── Digital (recurring) ───────────────────────────────────────────────────
    if (addons.includes("website_design")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 9700, recurring: { interval: "month" },
        product_data: { name: "Website Design & Hosting", description: "Mobile-friendly business website with hosting and ongoing updates" } }, quantity: 1 });
    }

    // ── Automation (recurring) ────────────────────────────────────────────────
    if (addons.includes("full_automation")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 7900, recurring: { interval: "month" },
        product_data: { name: "Full Automation Bundle (SMS + Email)", description: "Automated SMS and email follow-up sequences to convert postcard leads" } }, quantity: 1 });
    } else {
      if (addons.includes("sms_automation")) {
        lineItems.push({ price_data: { currency: "usd", unit_amount: 4900, recurring: { interval: "month" },
          product_data: { name: "SMS Follow-Up Automation", description: "Automated text sequences that follow up with every lead" } }, quantity: 1 });
      }
      if (addons.includes("email_automation")) {
        lineItems.push({ price_data: { currency: "usd", unit_amount: 4900, recurring: { interval: "month" },
          product_data: { name: "Email Automation", description: "Drip email sequences that nurture leads until they're ready to buy" } }, quantity: 1 });
      }
    }

    // ── Nonprofit (recurring) ─────────────────────────────────────────────────
    if (addons.includes("nonprofit")) {
      lineItems.push({ price_data: { currency: "usd", unit_amount: 2500, recurring: { interval: "month" },
        product_data: { name: "Local Nonprofit Sponsorship", description: "Feature a local nonprofit on your ad — $25/mo donated to the cause" } }, quantity: 1 });
    }

    // 8. Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      metadata: { businessId, cityId, categoryId, bundleId,
                  reservationId: assignment.id, addons: addons.join(","),
                  nonprofitId: nonprofitId ?? "" },
      subscription_data: {
        metadata: { reservationId: assignment.id, businessId, cityId, bundleId },
      },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/get-started/${citySlug}/${categorySlug}?bundle=${bundleId}`,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
    });

    return NextResponse.json({ checkoutUrl: session.url, spotAssignmentId: assignment.id });

  } catch (err) {
    console.error("[api/spots/checkout] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
