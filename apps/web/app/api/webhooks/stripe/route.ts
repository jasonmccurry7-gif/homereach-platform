import { NextResponse } from "next/server";
import { constructWebhookEvent } from "@homereach/services/stripe";
import { db, orders, businesses, marketingCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/stripe
// Receives Stripe webhook events and updates order + business state.
//
// IMPORTANT: Raw body must be consumed before JSON parsing.
// The `config` export disables Next.js body parsing for this route.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  api: { bodyParser: false },
};

// Stripe requires the raw request body for signature verification
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // ── Event dispatch ─────────────────────────────────────────────────────────

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        // Unhandled event types — log and acknowledge
        console.log(`[stripe/webhook] unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe/webhook] error handling ${event.type}:`, err);
    // Return 500 so Stripe retries
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error("[stripe/webhook] no orderId in session metadata");
    return;
  }

  await db
    .update(orders)
    .set({
      status: "paid",
      stripePaymentIntentId: session.payment_intent as string | null,
      stripeCustomerId: session.customer as string | null,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // Activate the associated business
  const [order] = await db
    .select({ businessId: orders.businessId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (order) {
    await db
      .update(businesses)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(businesses.id, order.businessId));

    // Fetch order details for campaign creation
    const [fullOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, order.businessId))
      .limit(1);

    if (fullOrder && business) {
      // Campaign starts today, runs for ~30 days, first drop in ~14 days
      const startDate = new Date();
      const nextDropDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await db
        .insert(marketingCampaigns)
        .values({
          businessId: order.businessId,
          orderId,
          cityId: business.cityId,
          categoryId: business.categoryId,
          bundleId: fullOrder.bundleId,
          status: "upcoming",
          startDate,
          nextDropDate,
          renewalDate,
          totalDrops: 1,
          dropsCompleted: 0,
          homesPerDrop: 2500,
        })
        .onConflictDoNothing(); // idempotent — safe on webhook retries
    }
  }

  console.log(`[stripe/webhook] order ${orderId} paid, business activated, campaign created`);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { id } = paymentIntent;

  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(orders.stripePaymentIntentId, id));

  console.log(`[stripe/webhook] payment failed for intent ${id}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) return;

  await db
    .update(orders)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(orders.stripePaymentIntentId, paymentIntentId));

  console.log(`[stripe/webhook] refund processed for intent ${paymentIntentId}`);
}
