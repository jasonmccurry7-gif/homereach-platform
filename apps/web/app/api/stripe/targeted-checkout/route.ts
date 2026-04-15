// POST /api/stripe/targeted-checkout
// Creates a Stripe Checkout session for a Targeted Route Campaign + optional add-ons.
// Uses Supabase JS (HTTP) — no Drizzle.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key, { apiVersion: "2025-03-31.basil" });
}

export async function POST(req: Request) {
  try {
    const { campaignId, addons = [] } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }

    const db  = createServiceClient();
    const { data: campaign, error } = await db
      .from("targeted_route_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (["paid", "mailed", "complete"].includes(campaign.status)) {
      return NextResponse.json({ error: "Campaign is already paid" }, { status: 400 });
    }

    const stripe  = getStripe();
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
    const basePrice = campaign.price_cents ?? 40000;

    // ── Main campaign line item ───────────────────────────────────────────────
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          unit_amount: basePrice,
          product_data: {
            name: `HomeReach Targeted Campaign — ${campaign.business_name ?? "Your Business"}`,
            description: `Targeted direct mail to ~${(campaign.homes_count ?? 500).toLocaleString()} homes`,
          },
        },
        quantity: 1,
      },
    ];

    // ── Print add-ons (one-time) ──────────────────────────────────────────────
    if (addons.includes("door_hangers"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 40000, product_data: { name: "Door Hangers (500) — 3.5\" × 8.5\"", description: "500 door hangers, 3.5\" × 8.5\", professionally designed and printed" } }, quantity: 1 });
    if (addons.includes("fliers"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 22500, product_data: { name: "Fliers (500) — 8.5\" × 11\"", description: "500 full-color fliers, 8.5\" × 11\"" } }, quantity: 1 });
    if (addons.includes("yard_signs"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 30000, product_data: { name: "Yard Signs (10) — 18\" × 24\"", description: "10 branded yard signs with stakes, 18\" × 24\"" } }, quantity: 1 });
    if (addons.includes("business_cards"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 10500, product_data: { name: "Business Cards (500) — 3.5\" × 2\"", description: "500 premium business cards, standard 3.5\" × 2\"" } }, quantity: 1 });

    // ── Digital add-ons ───────────────────────────────────────────────────────
    if (addons.includes("website_setup"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 49700, product_data: { name: "Website Design (One-Time Setup)", description: "Professional mobile-friendly website designed and built for your business" } }, quantity: 1 });
    if (addons.includes("website_maintenance"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 9700, product_data: { name: "Website Hosting & Maintenance (first month)", description: "Hosting, updates, and support — $97/mo going forward" } }, quantity: 1 });
    if (addons.includes("full_automation"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 7900, product_data: { name: "Full Automation Bundle (first month)", description: "SMS + Email automation — billed monthly going forward" } }, quantity: 1 });
    else {
      if (addons.includes("sms_automation"))
        lineItems.push({ price_data: { currency: "usd", unit_amount: 4900, product_data: { name: "SMS Automation (first month)", description: "SMS follow-up sequences — billed monthly going forward" } }, quantity: 1 });
      if (addons.includes("email_automation"))
        lineItems.push({ price_data: { currency: "usd", unit_amount: 4900, product_data: { name: "Email Automation (first month)", description: "Email drip sequences — billed monthly going forward" } }, quantity: 1 });
    }
    if (addons.includes("nonprofit"))
      lineItems.push({ price_data: { currency: "usd", unit_amount: 2500, product_data: { name: "Nonprofit Sponsorship (first month)", description: "Local nonprofit feature — billed monthly going forward" } }, quantity: 1 });

    // ── Create Stripe session ─────────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      customer_email:       campaign.email,
      payment_method_types: ["card"],
      line_items:           lineItems,
      allow_promotion_codes: true,
      metadata: {
        type:         "targeted_route_campaign",
        campaignId:   campaign.id,
        businessName: campaign.business_name ?? "",
        email:        campaign.email ?? "",
        addons:       addons.join(","),
      },
      success_url: `${appUrl}/targeted/confirmed?campaign=${campaign.id}`,
      cancel_url:  `${appUrl}/targeted/checkout?campaign=${campaign.id}&cancelled=true`,
    });

    // Save session ID to campaign row
    await db
      .from("targeted_route_campaigns")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", campaignId);

    return NextResponse.json({ url: session.url });

  } catch (err) {
    console.error("[api/stripe/targeted-checkout] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
