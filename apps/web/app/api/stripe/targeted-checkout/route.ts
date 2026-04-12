// POST /api/stripe/targeted-checkout
// Creates a Stripe Checkout session for a Targeted Route Campaign.
// Price is always $400 flat (40000 cents) for ~500 homes.

import { NextResponse } from "next/server";
import { db, targetedRouteCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";

const CheckoutSchema = z.object({
  campaignId: z.string().uuid(),
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "https://homereach.com";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { campaignId } = parsed.data;

    // ── Fetch campaign ────────────────────────────────────────────────────────
    const [campaign] = await db
      .select()
      .from(targetedRouteCampaigns)
      .where(eq(targetedRouteCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Idempotency — if already paid, return existing session
    if (campaign.status === "paid" || campaign.status === "mailed" || campaign.status === "complete") {
      return NextResponse.json(
        { error: "Campaign is already paid" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = getBaseUrl();
    const priceInCents = campaign.priceCents; // 40000 = $400

    const session = await stripe.checkout.sessions.create({
      mode:               "payment",
      customer_email:     campaign.email,
      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency:     "usd",
            unit_amount:  priceInCents,
            product_data: {
              name:        `HomeReach Targeted Campaign — ${campaign.businessName}`,
              description: `Targeted direct mail to ~${campaign.homesCount.toLocaleString()} homes around your business in ${campaign.targetCity ?? "your area"}`,
            },
          },
          quantity: 1,
        },
      ],

      metadata: {
        type:           "targeted_route_campaign",
        campaignId:     campaign.id,
        businessName:   campaign.businessName,
        email:          campaign.email,
        homesCount:     String(campaign.homesCount),
      },

      success_url: `${baseUrl}/targeted/confirmed?campaign=${campaign.id}`,
      cancel_url:  `${baseUrl}/targeted/checkout?campaign=${campaign.id}&cancelled=true`,
    });

    // Store session ID in DB for webhook matching
    await db
      .update(targetedRouteCampaigns)
      .set({
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(targetedRouteCampaigns.id, campaignId));

    return NextResponse.json({ url: session.url });

  } catch (err) {
    console.error("[api/stripe/targeted-checkout] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
