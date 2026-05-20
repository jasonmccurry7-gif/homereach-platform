import { NextResponse } from "next/server";
import { constructWebhookEvent } from "@homereach/services/stripe";
import { db, orders, businesses, marketingCampaigns } from "@homereach/db";
import { createServiceClient } from "@/lib/supabase/service";
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
  const checkoutType = session.metadata?.type;
  if (checkoutType === "targeted_route_campaign") {
    await handleTargetedRouteCampaignCheckout(session);
    return;
  }
  if (checkoutType === "property_intelligence") {
    await handlePropertyIntelligenceCheckout(session);
    return;
  }
  if (checkoutType === "ai_shared_postcard_intake") {
    await handleAiSharedPostcardCheckout(session);
    return;
  }

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

async function handleTargetedRouteCampaignCheckout(session: Stripe.Checkout.Session) {
  const campaignId = session.metadata?.campaignId;
  if (!campaignId) {
    console.error("[stripe/webhook] targeted checkout missing campaignId");
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("targeted_route_campaigns")
    .update({
      status: "paid",
      design_status: "queued",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string | null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .not("status", "in", "(mailed,complete)");

  if (error) throw new Error(`[stripe/webhook] targeted update failed: ${error.message}`);

  console.log(`[stripe/webhook] targeted campaign ${campaignId} paid`);
}

async function handlePropertyIntelligenceCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const tier = metadata.tier;
  const city = metadata.city;
  const businessName = metadata.business_name;

  if (!tier || !city || !businessName) {
    console.error("[stripe/webhook] intelligence checkout missing required metadata");
    return;
  }

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("founding_memberships")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existing) {
    console.log(`[stripe/webhook] intelligence checkout ${session.id} already fulfilled`);
    return;
  }

  const lockedPriceCents = Number(metadata.locked_price);
  const standardPriceCents = Number(metadata.standard_price);
  const isFounding = metadata.founding_flag === "true";

  const { error: memberError } = await supabase
    .from("founding_memberships")
    .insert({
      business_name: businessName,
      city,
      category: metadata.category === "all" ? null : metadata.category ?? null,
      product: `intelligence_${tier}`,
      tier,
      locked_price_cents: Number.isFinite(lockedPriceCents) ? lockedPriceCents : null,
      standard_price_cents: Number.isFinite(standardPriceCents) ? standardPriceCents : null,
      stripe_subscription_id: session.subscription as string | null,
      stripe_checkout_session_id: session.id,
      status: "active",
    });

  if (memberError) {
    throw new Error(`[stripe/webhook] intelligence membership insert failed: ${memberError.message}`);
  }

  if (isFounding && metadata.slot_id) {
    const { data: slot, error: slotError } = await supabase
      .from("founding_slots")
      .select("id, total_slots, slots_taken")
      .eq("id", metadata.slot_id)
      .single();

    if (slotError) {
      console.error("[stripe/webhook] founding slot lookup failed:", slotError.message);
    } else if (slot) {
      const slotsTaken = (slot.slots_taken ?? 0) + 1;
      const { error: updateError } = await supabase
        .from("founding_slots")
        .update({
          slots_taken: slotsTaken,
          slots_remaining: Math.max(0, (slot.total_slots ?? slotsTaken) - slotsTaken),
        })
        .eq("id", slot.id);

      if (updateError) {
        console.error("[stripe/webhook] founding slot update failed:", updateError.message);
      }
    }
  }

  console.log(`[stripe/webhook] property intelligence checkout ${session.id} fulfilled`);
}

async function handleAiSharedPostcardCheckout(session: Stripe.Checkout.Session) {
  const sessionId = session.metadata?.aiIntakeSessionId;
  if (!sessionId) {
    console.error("[stripe/webhook] AI intake checkout missing session id");
    return;
  }

  const supabase = createServiceClient();
  const now = new Date();
  const commitmentEndsAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const subscriptionId = session.subscription as string | null;
  const customerId = session.customer as string | null;
  const paymentIntentId = session.payment_intent as string | null;

  const { data: intakeSession, error: sessionError } = await supabase
    .from("ai_intake_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !intakeSession) {
    throw new Error(`[stripe/webhook] AI intake session lookup failed: ${sessionError?.message ?? sessionId}`);
  }

  const { data: cartItems, error: cartError } = await supabase
    .from("ai_intake_cart_items")
    .select(
      "id, business_id, order_id, spot_assignment_id, city_id, category_id, bundle_id, subtotal_cents, quantity, availability_status",
    )
    .eq("session_id", sessionId);

  if (cartError) {
    throw new Error(`[stripe/webhook] AI intake cart lookup failed: ${cartError.message}`);
  }

  for (let index = 0; index < (cartItems ?? []).length; index += 1) {
    const item = (cartItems ?? [])[index] as any;
    if (!item.business_id || !item.order_id || !item.spot_assignment_id) {
      console.error("[stripe/webhook] AI intake cart item missing fulfillment ids", item.id);
      continue;
    }

    const orderUpdate: Record<string, unknown> = {
      status: "paid",
      stripe_customer_id: customerId,
      paid_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    if (index === 0 && paymentIntentId) orderUpdate.stripe_payment_intent_id = paymentIntentId;

    const { error: orderError } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", item.order_id);
    if (orderError) throw new Error(`[stripe/webhook] AI order update failed: ${orderError.message}`);

    const { error: businessError } = await supabase
      .from("businesses")
      .update({
        status: "active",
        stripe_customer_id: customerId,
        updated_at: now.toISOString(),
      })
      .eq("id", item.business_id);
    if (businessError) throw new Error(`[stripe/webhook] AI business update failed: ${businessError.message}`);

    const assignmentUpdate: Record<string, unknown> = {
      status: "active",
      stripe_customer_id: customerId,
      activated_at: now.toISOString(),
      commitment_ends_at: commitmentEndsAt,
      monthly_value_cents: Number(item.subtotal_cents ?? 0),
      updated_at: now.toISOString(),
    };
    if (index === 0 && subscriptionId) {
      assignmentUpdate.stripe_subscription_id = subscriptionId;
    }

    const { error: assignmentError } = await supabase
      .from("spot_assignments")
      .update(assignmentUpdate)
      .eq("id", item.spot_assignment_id);
    if (assignmentError) {
      throw new Error(`[stripe/webhook] AI spot assignment update failed: ${assignmentError.message}`);
    }

    const { data: existingIntake, error: existingIntakeError } = await supabase
      .from("intake_submissions")
      .select("id")
      .eq("spot_assignment_id", item.spot_assignment_id)
      .maybeSingle();
    if (existingIntakeError) {
      throw new Error(`[stripe/webhook] AI intake lookup failed: ${existingIntakeError.message}`);
    }

    if (!existingIntake) {
      const { error: intakeError } = await supabase.from("intake_submissions").insert({
        spot_assignment_id: item.spot_assignment_id,
        business_id: item.business_id,
        status: "pending",
      });
      if (intakeError) throw new Error(`[stripe/webhook] AI intake insert failed: ${intakeError.message}`);
    }

    const startDate = now.toISOString();
    const nextDropDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const renewalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: campaignError } = await supabase
      .from("marketing_campaigns")
      .upsert(
        {
          business_id: item.business_id,
          order_id: item.order_id,
          city_id: item.city_id,
          category_id: item.category_id,
          bundle_id: item.bundle_id,
          status: "upcoming",
          start_date: startDate,
          next_drop_date: nextDropDate,
          renewal_date: renewalDate,
          total_drops: 1,
          drops_completed: 0,
          homes_per_drop: 2500,
          notes: `Created from AI intake session ${sessionId}`,
        },
        { onConflict: "order_id" },
      );
    if (campaignError) {
      throw new Error(`[stripe/webhook] AI campaign upsert failed: ${campaignError.message}`);
    }

    const { error: itemError } = await supabase
      .from("ai_intake_cart_items")
      .update({
        availability_status: "paid",
        availability_message: "Payment completed and downstream records activated.",
      })
      .eq("id", item.id);
    if (itemError) throw new Error(`[stripe/webhook] AI item update failed: ${itemError.message}`);
  }

  const { error: updateSessionError } = await supabase
    .from("ai_intake_sessions")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: customerId,
      updated_at: now.toISOString(),
    })
    .eq("id", sessionId);
  if (updateSessionError) {
    throw new Error(`[stripe/webhook] AI session paid update failed: ${updateSessionError.message}`);
  }

  const { error: confirmationError } = await supabase
    .from("ai_intake_confirmations")
    .update({
      confirmation_status: "paid",
      updated_at: now.toISOString(),
    })
    .eq("session_id", sessionId)
    .in("confirmation_status", ["confirmed", "checkout_created"]);
  if (confirmationError) {
    throw new Error(`[stripe/webhook] AI confirmation paid update failed: ${confirmationError.message}`);
  }

  console.log(`[stripe/webhook] AI intake session ${sessionId} paid and activated`);
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
