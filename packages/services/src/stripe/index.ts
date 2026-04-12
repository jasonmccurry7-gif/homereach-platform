import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@homereach/db";
import { businesses } from "@homereach/db/schema";
import type {
  CheckoutSessionPayload,
  SubscriptionCheckoutPayload,
  PricingSnapshot,
} from "@homereach/types";

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
// createOneTimeCheckoutSession (formerly createCheckoutSession)
//
// Use for NON-RECURRING purchases only:
//   - Add-ons (flyers, business cards, premium design)
//   - Automation setup fees
//   - Campaign setup fees
//   - Any product with billing_interval = "one_time"
//
// For monthly spot subscriptions use createSubscriptionCheckoutSession() below.
// ─────────────────────────────────────────────────────────────────────────────

export async function createOneTimeCheckoutSession(
  payload: CheckoutSessionPayload & {
    orderId: string;
    priceInCents: number;
    /** Optional: pricing snapshot to embed in Stripe metadata for webhook recovery */
    pricingSnapshot?: PricingSnapshot;
  }
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
    pricingSnapshot,
  } = payload;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `HomeReach — ${businessName}`,
            description: "Local marketing",
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
      // Embed pricing snapshot when available — used by webhook for price audit trail.
      // When Task 1 ships, subscription sessions will carry this via
      // createSubscriptionCheckoutSession() instead.
      ...(pricingSnapshot
        ? { pricingSnapshot: JSON.stringify(pricingSnapshot) }
        : {}),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: "auto",
    allow_promotion_codes: true,
  });

  return session;
}

/**
 * @deprecated Use createOneTimeCheckoutSession() for one-time purchases
 * or createSubscriptionCheckoutSession() for monthly spots.
 * This alias exists only to prevent import errors during the transition period.
 * Remove after all callers are updated.
 */
export const createCheckoutSession = createOneTimeCheckoutSession;

// ─────────────────────────────────────────────────────────────────────────────
// createSubscriptionCheckoutSession
//
// Creates a Stripe Checkout session in mode:"subscription" for monthly spots.
//
// Key behaviours:
//   1. Resolves or creates a Stripe customer on businesses.stripeCustomerId
//   2. Uses snapshot.finalPriceCents as the authoritative billing amount
//   3. Embeds the full pricing snapshot in session metadata for webhook recovery
//   4. On success: Stripe fires customer.subscription.created → webhook creates
//      the spot_assignment and order (Task 1 webhook handler)
//
// snapshot MUST be produced by snapshotPrice() from packages/services/src/pricing.
// Never pass a manually constructed snapshot.
// ─────────────────────────────────────────────────────────────────────────────

export async function createSubscriptionCheckoutSession(
  payload: SubscriptionCheckoutPayload,
  snapshot: PricingSnapshot
): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";

  // ── 1. Resolve or create Stripe customer ──────────────────────────────────
  const [business] = await db
    .select({
      id: businesses.id,
      stripeCustomerId: businesses.stripeCustomerId,
    })
    .from(businesses)
    .where(eq(businesses.id, payload.businessId))
    .limit(1);

  if (!business) {
    throw new Error(`Business ${payload.businessId} not found`);
  }

  let stripeCustomerId = business.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: payload.email,
      metadata: {
        businessId: payload.businessId,
        homeReachEnv: process.env.NODE_ENV ?? "unknown",
      },
    });
    stripeCustomerId = customer.id;

    // Persist customer ID to businesses table immediately
    await db
      .update(businesses)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(businesses.id, payload.businessId));
  }

  // ── 2. Build line item from snapshot — NEVER from hardcoded price ──────────
  // snapshot.finalPriceCents is the single source of billing truth.
  const productLabel = payload.spotType
    ? `HomeReach ${payload.spotType.replace("_", " ")} Spot`
    : `HomeReach ${payload.productType}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: snapshot.finalPriceCents,
          recurring: { interval: "month" },
          product_data: {
            name: productLabel,
            description: `Monthly subscription — ${payload.cityId}`,
            metadata: {
              pricingProfileId: snapshot.pricingProfileId,
              snapshotVersion: String(snapshot.snapshotVersion),
              spotType: payload.spotType ?? "",
            },
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      businessId:      payload.businessId,
      cityId:          payload.cityId,
      reservationId:   payload.reservationId,
      spotIds:         payload.spotIds.join(","),
      categoryId:      payload.categoryId,
      // Full snapshot embedded for webhook recovery — no DB lookup needed on event
      pricingSnapshot: JSON.stringify(snapshot),
    },
    subscription_data: {
      metadata: {
        reservationId: payload.reservationId,
        businessId:    payload.businessId,
        cityId:        payload.cityId,
      },
    },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/get-started`,
    billing_address_collection: "auto",
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
