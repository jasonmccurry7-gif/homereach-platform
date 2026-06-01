import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { signPublicFlowToken, verifyPublicFlowToken } from "@/lib/security/signed-token";
import { hasDigitalTargetingStripeCheckout } from "@/lib/digital-targeting/config";

const CheckoutSchema = z.object({
  checkoutToken: z.string().min(20),
});

type DigitalCheckoutTokenPayload = {
  scope: "digital_targeting_checkout";
  campaignId: string;
  iat: number;
  exp: number;
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function resolveCampaignId(token: string | null) {
  const verified = verifyPublicFlowToken<DigitalCheckoutTokenPayload>(token, "digital_targeting_checkout");
  if (!verified.ok) {
    return { ok: false as const, error: `Invalid or expired checkout token: ${verified.reason}` };
  }
  const parsed = z.string().uuid().safeParse(verified.payload.campaignId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid checkout token campaign id" };
  }
  return { ok: true as const, campaignId: parsed.data };
}

export async function GET(req: Request) {
  const limited = checkRateLimit(req, {
    key: "digital-targeting-checkout-summary",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const resolved = resolveCampaignId(url.searchParams.get("token"));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 403 });

  const supabase = createServiceClient();
  const { data: campaign, error } = await supabase
    .from("digital_targeting_campaigns")
    .select("id, business_name, email, payment_status, campaign_status, monthly_management_fee, monthly_ad_spend, setup_fee")
    .eq("id", resolved.campaignId)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      businessName: campaign.business_name,
      email: campaign.email,
      paymentStatus: campaign.payment_status,
      campaignStatus: campaign.campaign_status,
      monthlyManagementFee: Number(campaign.monthly_management_fee ?? 49900),
      monthlyAdSpend: Number(campaign.monthly_ad_spend ?? 0),
      setupFee: Number(campaign.setup_fee ?? 0),
      stripeAvailable: hasDigitalTargetingStripeCheckout(),
      eligibleForCheckout: !["paid", "refunded"].includes(String(campaign.payment_status)) &&
        !["live", "cancelled"].includes(String(campaign.campaign_status)),
    },
  });
}

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(req, {
      key: "digital-targeting-checkout-create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const resolved = resolveCampaignId(parsed.data.checkoutToken);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 403 });

    const supabase = createServiceClient();
    const { data: campaign, error } = await supabase
      .from("digital_targeting_campaigns")
      .select("id, business_name, email, payment_status, campaign_status, monthly_management_fee, monthly_ad_spend, setup_fee, stripe_checkout_session_id")
      .eq("id", resolved.campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (["paid", "refunded"].includes(String(campaign.payment_status))) {
      return NextResponse.json({ error: "Campaign is not eligible for checkout" }, { status: 400 });
    }

    const stripe = getStripe();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com").replace(/\/+$/, "");
    const checkoutToken = signPublicFlowToken({
      scope: "digital_targeting_checkout",
      campaignId: campaign.id,
    });

    if (!stripe) {
      await Promise.all([
        supabase
          .from("digital_targeting_campaigns")
          .update({
            payment_status: "manual_invoice_needed",
            campaign_status: "payment_pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign.id),
        supabase.from("digital_campaign_tasks").insert({
          campaign_id: campaign.id,
          title: "Create secure payment/subscription link",
          status: "open",
          owner: "jason",
          due_date: new Date().toISOString(),
          notes: "Stripe secret key is missing. Manual payment task created instead of failing checkout.",
          task_order: 0,
        }),
      ]);

      return NextResponse.json({
        manual: true,
        url: `${appUrl}/digital-targeting/confirmed?campaign=${campaign.id}&manual=true`,
      });
    }

    const managementFee = Number(campaign.monthly_management_fee ?? 49900);
    const setupFee = Number(campaign.setup_fee ?? 0);
    if (!Number.isInteger(managementFee) || managementFee < 49900) {
      return NextResponse.json({ error: "Campaign pricing requires admin review." }, { status: 409 });
    }

    const businessName =
      typeof campaign.business_name === "string" && campaign.business_name.trim()
        ? campaign.business_name.trim().slice(0, 120)
        : "Neighborhood Digital Targeting";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          unit_amount: managementFee,
          recurring: { interval: "month" },
          product_data: {
            name: "HomeReach Neighborhood Digital Targeting Management",
            description: `${businessName} - monthly management fee. Ad spend is funded separately by the client.`,
          },
        },
        quantity: 1,
      },
    ];

    if (setupFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: setupFee,
          product_data: {
            name: "Digital Targeting Setup Fee",
            description: `${businessName} - optional one-time setup fee.`,
          },
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        client_reference_id: campaign.id,
        customer_email: String(campaign.email),
        line_items: lineItems,
        allow_promotion_codes: true,
        metadata: {
          type: "digital_targeting_management",
          campaignId: campaign.id,
          businessName,
          monthlyAdSpend: String(campaign.monthly_ad_spend ?? 0),
        },
        subscription_data: {
          metadata: {
            type: "digital_targeting_management",
            campaignId: campaign.id,
            businessName,
          },
        },
        success_url: `${appUrl}/digital-targeting/confirmed?campaign=${campaign.id}`,
        cancel_url: `${appUrl}/digital-targeting/checkout?token=${encodeURIComponent(checkoutToken)}&cancelled=true`,
      },
      { idempotencyKey: `digital-targeting-checkout:${campaign.id}:${managementFee}:${setupFee}` },
    );

    const { error: updateError } = await supabase
      .from("digital_targeting_campaigns")
      .update({
        payment_status: "checkout_created",
        campaign_status: "payment_pending",
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    if (updateError) {
      throw new Error(`Failed to store Stripe checkout session: ${updateError.message}`);
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[api/stripe/digital-targeting-checkout] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
