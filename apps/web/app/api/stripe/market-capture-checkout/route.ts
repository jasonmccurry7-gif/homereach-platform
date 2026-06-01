import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import {
  MARKET_CAPTURE_MANAGEMENT_FEE_CENTS,
  getMarketCaptureStripePriceId,
  hasMarketCaptureStripeCheckout,
  isMarketCapturePaymentEnabled,
} from "@/lib/market-capture/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { signPublicFlowToken, verifyPublicFlowToken } from "@/lib/security/signed-token";
import { createServiceClient } from "@/lib/supabase/service";

const CheckoutSchema = z.object({
  checkoutToken: z.string().min(20),
});

type MarketCaptureCheckoutTokenPayload = {
  scope: "market_capture_checkout";
  marketCaptureLeadId: string;
  iat: number;
  exp: number;
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function resolveLeadId(token: string | null) {
  const verified = verifyPublicFlowToken<MarketCaptureCheckoutTokenPayload>(token, "market_capture_checkout");
  if (!verified.ok) {
    return { ok: false as const, error: `Invalid or expired checkout token: ${verified.reason}` };
  }
  const parsed = z.string().uuid().safeParse(verified.payload.marketCaptureLeadId);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid checkout token lead id" };
  }
  return { ok: true as const, marketCaptureLeadId: parsed.data };
}

export async function GET(req: Request) {
  const limited = checkRateLimit(req, {
    key: "market-capture-checkout-summary",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const resolved = resolveLeadId(url.searchParams.get("token"));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 403 });

  const supabase = createServiceClient();
  const { data: lead, error } = await supabase
    .from("market_capture_leads")
    .select("id, business_name, email, payment_status, status, monthly_management_fee, monthly_ad_budget")
    .eq("id", resolved.marketCaptureLeadId)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Market Capture record not found" }, { status: 404 });
  }

  return NextResponse.json({
    lead: {
      id: lead.id,
      businessName: lead.business_name,
      email: lead.email,
      paymentStatus: lead.payment_status,
      status: lead.status,
      monthlyManagementFee: Number(lead.monthly_management_fee ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS),
      monthlyAdBudget: Number(lead.monthly_ad_budget ?? 0),
      stripeAvailable: hasMarketCaptureStripeCheckout(),
      eligibleForCheckout: !["paid", "refunded"].includes(String(lead.payment_status)),
    },
  });
}

export async function POST(req: Request) {
  try {
    if (!isMarketCapturePaymentEnabled()) {
      return NextResponse.json({ error: "Market Capture payment is disabled." }, { status: 404 });
    }

    const limited = checkRateLimit(req, {
      key: "market-capture-checkout-create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const resolved = resolveLeadId(parsed.data.checkoutToken);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 403 });

    const supabase = createServiceClient();
    const { data: lead, error } = await supabase
      .from("market_capture_leads")
      .select("id, business_name, contact_name, email, payment_status, monthly_management_fee, monthly_ad_budget, stripe_checkout_session_id")
      .eq("id", resolved.marketCaptureLeadId)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: "Market Capture record not found" }, { status: 404 });
    }

    if (["paid", "refunded"].includes(String(lead.payment_status))) {
      return NextResponse.json({ error: "Market Capture record is not eligible for checkout" }, { status: 400 });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com").replace(/\/+$/, "");
    const checkoutToken = signPublicFlowToken({
      scope: "market_capture_checkout",
      marketCaptureLeadId: lead.id,
    });
    const statusUrl = `${appUrl}/market-capture/status?token=${encodeURIComponent(checkoutToken)}`;

    const stripe = getStripe();
    if (!stripe) {
      const now = new Date().toISOString();
      const [{ data: pipeline }] = await Promise.all([
        supabase.from("market_capture_pipeline").select("id").eq("market_capture_lead_id", lead.id).limit(1).maybeSingle(),
        supabase
          .from("market_capture_leads")
          .update({ payment_status: "manual_invoice_needed", updated_at: now })
          .eq("id", lead.id),
        supabase
          .from("market_capture_pipeline")
          .update({
            stage: "payment_pending",
            next_action: "Create secure payment/subscription link",
            last_activity_at: now,
            updated_at: now,
          })
          .eq("market_capture_lead_id", lead.id),
      ]);

      await Promise.all([
        supabase.from("market_capture_tasks").insert({
          market_capture_lead_id: lead.id,
          pipeline_id: pipeline?.id ?? null,
          title: "Create secure payment/subscription link",
          owner: "jason",
          status: "open",
          due_date: now,
          notes: "Stripe secret key is missing. Manual payment task created instead of failing checkout.",
          task_order: 0,
        }),
        supabase.from("market_capture_notes").insert({
          market_capture_lead_id: lead.id,
          author: "system",
          note_type: "payment",
          content: "Stripe is unavailable. Manual payment task created.",
        }),
      ]);

      return NextResponse.json({ manual: true, url: `${statusUrl}&manual=true` });
    }

    const managementFee = Number(lead.monthly_management_fee ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS);
    if (!Number.isInteger(managementFee) || managementFee < MARKET_CAPTURE_MANAGEMENT_FEE_CENTS) {
      return NextResponse.json({ error: "Market Capture pricing requires admin review." }, { status: 409 });
    }

    const businessName =
      typeof lead.business_name === "string" && lead.business_name.trim()
        ? lead.business_name.trim().slice(0, 120)
        : "Market Capture";
    const configuredPriceId = getMarketCaptureStripePriceId();
    const useConfiguredStarterPrice = Boolean(
      configuredPriceId && managementFee === MARKET_CAPTURE_MANAGEMENT_FEE_CENTS,
    );
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = useConfiguredStarterPrice
      ? {
          price: configuredPriceId!,
          quantity: 1,
        }
      : {
          price_data: {
            currency: "usd",
            unit_amount: managementFee,
            recurring: { interval: "month" },
            product_data: {
              name: "HomeReach Market Capture Management",
              description: `${businessName} - monthly management fee. Ad spend is funded separately by the client.`,
            },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        client_reference_id: lead.id,
        customer_email: String(lead.email),
        line_items: [lineItem],
        metadata: {
          type: "market_capture_management",
          marketCaptureLeadId: lead.id,
          businessName,
          monthlyAdBudget: String(lead.monthly_ad_budget ?? 0),
          priceSource: useConfiguredStarterPrice ? "configured_stripe_price" : "inline_price_data",
        },
        subscription_data: {
          metadata: {
            type: "market_capture_management",
            marketCaptureLeadId: lead.id,
            businessName,
            priceSource: useConfiguredStarterPrice ? "configured_stripe_price" : "inline_price_data",
          },
        },
        success_url: `${statusUrl}&paid=1`,
        cancel_url: `${appUrl}/market-capture/checkout?token=${encodeURIComponent(checkoutToken)}&cancelled=true`,
      },
      { idempotencyKey: `market-capture-checkout:${lead.id}:${managementFee}:${configuredPriceId ?? "inline"}` },
    );

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("market_capture_leads")
      .update({
        payment_status: "checkout_created",
        stripe_checkout_session_id: session.id,
        updated_at: now,
      })
      .eq("id", lead.id);

    if (updateError) {
      throw new Error(`Failed to store Stripe checkout session: ${updateError.message}`);
    }

    await supabase
      .from("market_capture_pipeline")
      .update({
        stage: "payment_pending",
        next_action: "Confirm payment",
        last_activity_at: now,
        updated_at: now,
      })
      .eq("market_capture_lead_id", lead.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[api/stripe/market-capture-checkout] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
