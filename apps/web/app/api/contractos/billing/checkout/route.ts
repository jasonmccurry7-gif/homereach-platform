import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getContractOSBillingPlan } from "@/lib/contractos/billing";
import { contractOSFeatureFlags } from "@/lib/contractos/config";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

const CheckoutSchema = z
  .object({
    plan: z.enum(["watchtower", "workspace", "proposal_assist", "managed_bid"]),
    email: z.string().email().optional(),
    requestId: z.string().uuid().optional(),
  })
  .strict();

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com").replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const flags = contractOSFeatureFlags();
  if (!flags.enabled || !flags.billing) {
    return NextResponse.json({ ok: false, error: "ContractOS checkout is not enabled." }, { status: 404 });
  }

  const limited = checkRateLimit(request, {
    key: "contractos-checkout",
    limit: 6,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid ContractOS checkout request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const plan = getContractOSBillingPlan(parsed.data.plan);
  if (!plan) {
    return NextResponse.json({ ok: false, error: "Unknown ContractOS plan." }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY || !plan.priceId) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "ContractOS paid checkout is not configured yet.",
        missingEnv: [
          ...(process.env.STRIPE_SECRET_KEY ? [] : ["STRIPE_SECRET_KEY"]),
          ...(plan.priceId ? [] : [plan.priceEnvKey]),
        ],
        nextAction: "Create the Stripe product/price, set the env var, redeploy, then retry checkout.",
      },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const requestId = parsed.data.requestId ?? crypto.randomUUID();
  const baseUrl = appUrl();

  const session = await stripe.checkout.sessions.create(
    {
      mode: plan.mode,
      customer_email: parsed.data.email,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: {
        product: "contractos",
        plan: plan.key,
        pricePositioning: "founder_rate",
        checkoutAmount: plan.checkoutAmountLabel,
        approvalGate: "human_review_required_for_bids_pricing_and_submission",
      },
      success_url: `${baseUrl}/contractos/dashboard?contractos_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/contractos/dashboard?contractos_checkout=cancelled`,
    },
    {
      idempotencyKey: `contractos-checkout:${plan.key}:${requestId}`,
    },
  );

  return NextResponse.json({
    ok: true,
    url: session.url,
    sessionId: session.id,
    warnings: [
      "Checkout starts paid access only. It does not approve any bid, pricing, legal certification, or submission.",
    ],
  });
}
