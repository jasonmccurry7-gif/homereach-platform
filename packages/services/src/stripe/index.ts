import Stripe from "stripe";
import type { CheckoutSessionPayload } from "@homereach/types";

// ─────────────────────────────────────────────────────────────────────────────
// Stripe Client
// Single instance — import `stripe` anywhere in the services package.
// ─────────────────────────────────────────────────────────────────────────────

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// createCheckoutSession
// Creates a Stripe Checkout session for a bundle purchase.
// Stores relevant metadata so the webhook can activate the order.
// ─────────────────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  payload: CheckoutSessionPayload & { orderId: string; priceInCents: number }
): Promise<Stripe.Checkout.Session> {
  const {
    orderId,
    bundleId,
    addonIds = [],
    businessName,
    cityId,
    categoryId,
    email,
    priceInCents,
    successUrl,
    cancelUrl,
  } = payload;

  // ── BILLING MODE DECISION ──────────────────────────────────────────────────
  // mode: "payment"  → one-time charge (current). Use for per-drop or upfront pricing.
  // mode: "subscription" → recurring billing. Requires a Stripe Price ID (not unit_amount).
  //
  // To switch to subscriptions:
  //   1. Create a recurring Price in Stripe Dashboard (or via API).
  //   2. Change mode to "subscription".
  //   3. Replace line_items[0].price_data with { price: "price_xxxxx", quantity: 1 }.
  //   4. Remove priceInCents from this function — the Price object owns the amount.
  //   5. Handle subscription lifecycle events in the webhook:
  //      customer.subscription.created, invoice.paid, customer.subscription.deleted
  // ─────────────────────────────────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: "payment", // ← CHANGE TO "subscription" when recurring billing is needed
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `HomeReach — ${businessName}`,
            description: "Local marketing bundle",
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId,
      bundleId,
      addonIds: JSON.stringify(addonIds),
      businessName,
      cityId,
      categoryId,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Collect billing address for tax / records
    billing_address_collection: "auto",
    // Allow promotion codes
    allow_promotion_codes: true,
  });

  return session;
}

// ─────────────────────────────────────────────────────────────────────────────
// constructWebhookEvent
// Verifies a Stripe webhook signature and returns the parsed event.
// Always use this — never trust raw request body without verification.
// ─────────────────────────────────────────────────────────────────────────────

export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required");
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// ─────────────────────────────────────────────────────────────────────────────
// issueRefund
// Refunds a payment intent in full or partially.
// ─────────────────────────────────────────────────────────────────────────────

export async function issueRefund(
  paymentIntentId: string,
  amountInCents?: number
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountInCents ? { amount: amountInCents } : {}),
  });
}
