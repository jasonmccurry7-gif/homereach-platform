import { NextResponse } from "next/server";
import { constructWebhookEvent } from "@homereach/services/stripe";
import {
  notifyAdminCampaignPaid,
  sendPaymentConfirmation,
} from "@homereach/services/targeted";
import { db, orders, businesses, marketingCampaigns } from "@homereach/db";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDigitalPaymentConfirmation } from "@/lib/digital-targeting/messaging";
import { ensureMarketCaptureFulfillment } from "@/lib/market-capture/fulfillment";
import { recordPaymentCompleted, type PaymentMode } from "@/lib/political/proposals";
import { eq, sql } from "drizzle-orm";
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

type StripeWebhookEventStatus = "received" | "processed" | "failed" | "skipped";

type StripeWebhookLedgerRow = {
  id: string;
  event_type: string;
  status: StripeWebhookEventStatus | string;
  error: string | null;
  received_at: Date | string | null;
  processed_at: Date | string | null;
  inserted: boolean;
};

type StripeWebhookClaim =
  | {
      action: "process";
      idempotencyAvailable: boolean;
      duplicate: boolean;
    }
  | {
      action: "skip";
      idempotencyAvailable: true;
      duplicate: true;
      status: string;
      responseStatus?: number;
    };

type HandledStripeWebhookStatus = "processed" | "skipped";

const STALE_RECEIVED_RETRY_MS = 5 * 60 * 1000;

// Stripe requires the raw request body for signature verification
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  // ── Event dispatch ─────────────────────────────────────────────────────────

  let claim: StripeWebhookClaim;

  try {
    claim = await claimStripeWebhookEvent(event);
  } catch (err) {
    console.error(`[stripe/webhook] failed to claim event ${event.id}:`, err);
    return NextResponse.json(
      { error: "Webhook idempotency claim failed" },
      { status: 500 },
    );
  }

  if (claim.action === "skip") {
    return NextResponse.json(
      {
        received: true,
        duplicate: true,
        status: claim.status,
      },
      { status: claim.responseStatus ?? 200 },
    );
  }

  try {
    const status = await dispatchStripeWebhookEvent(event);
    try {
      await markStripeWebhookEventComplete(event, claim, status);
    } catch (err) {
      console.error(
        `[stripe/webhook] processed ${event.type} (${event.id}) but failed to mark ${status}:`,
        err,
      );
      return NextResponse.json(
        { error: "Webhook idempotency update failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    await markStripeWebhookEventFailed(event, claim, err);
    console.error(
      `[stripe/webhook] error handling ${event.type} (${event.id}):`,
      err,
    );
    // Return 500 so Stripe retries
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

async function dispatchStripeWebhookEvent(
  event: Stripe.Event,
): Promise<HandledStripeWebhookStatus> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      return "processed";

    case "checkout.session.expired":
      await handleCheckoutExpired(
        event.data.object as Stripe.Checkout.Session,
      );
      return "processed";

    case "checkout.session.async_payment_failed":
      console.warn(
        `[stripe/webhook] async checkout payment failed (${event.id}); no fulfillment performed`,
      );
      return "processed";

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      return "processed";

    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      return "processed";

    default:
      // Unhandled event types — log and acknowledge
      console.log(
        `[stripe/webhook] unhandled event ${event.type} (${event.id}); marked skipped`,
      );
      return "skipped";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook ledger
// ─────────────────────────────────────────────────────────────────────────────

async function claimStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeWebhookClaim> {
  const payload = JSON.stringify(event);

  try {
    const result = await db.execute(sql`
      with inserted as (
        insert into public.stripe_webhook_events
          (id, event_type, status, payload, received_at)
        values
          (${event.id}, ${event.type}, 'received', ${payload}::jsonb, now())
        on conflict (id) do nothing
        returning id, event_type, status, error, received_at, processed_at, true as inserted
      )
      select id, event_type, status, error, received_at, processed_at, inserted
      from inserted
      union all
      select id, event_type, status, error, received_at, processed_at, false as inserted
      from public.stripe_webhook_events
      where id = ${event.id}
        and not exists (select 1 from inserted)
      limit 1
    `);
    const [row] = rowsFromExecute<StripeWebhookLedgerRow>(result);

    if (!row) {
      throw new Error(
        `Stripe webhook idempotency ledger returned no row for ${event.type} (${event.id})`,
      );
    }

    if (row.inserted) {
      console.info(
        `[stripe/webhook] recorded event ${event.type} (${event.id}) for processing`,
      );
      return {
        action: "process",
        idempotencyAvailable: true,
        duplicate: false,
      };
    }

    return resolveDuplicateStripeWebhookEvent(event, row, payload);
  } catch (err) {
    if (isMissingWebhookLedgerError(err)) {
      throw new Error(
        `Stripe webhook ledger is unavailable; refusing to process without idempotency guard: ${getErrorMessage(err)}`,
      );
    }

    throw err;
  }
}

async function resolveDuplicateStripeWebhookEvent(
  event: Stripe.Event,
  row: StripeWebhookLedgerRow,
  payload: string,
): Promise<StripeWebhookClaim> {
  if (row.status === "processed" || row.status === "skipped") {
    console.info(
      `[stripe/webhook] duplicate ${row.status} event ${event.type} (${event.id}) ignored`,
      { processedAt: row.processed_at },
    );
    return {
      action: "skip",
      idempotencyAvailable: true,
      duplicate: true,
      status: row.status,
    };
  }

  if (row.status === "failed") {
    console.warn(
      `[stripe/webhook] duplicate failed event ${event.type} (${event.id}) will be retried`,
      { previousError: row.error },
    );
    const reclaimed = await reclaimWebhookEventForRetry(
      event,
      payload,
      "failed",
    );
    if (reclaimed) {
      return { action: "process", idempotencyAvailable: true, duplicate: true };
    }

    return {
      action: "skip",
      idempotencyAvailable: true,
      duplicate: true,
      status: row.status,
      responseStatus: 500,
    };
  }

  if (row.status === "received") {
    const receivedAt = parseWebhookLedgerDate(row.received_at);
    const isStale =
      receivedAt !== null &&
      Date.now() - receivedAt.getTime() > STALE_RECEIVED_RETRY_MS;

    if (isStale) {
      console.warn(
        `[stripe/webhook] duplicate stale received event ${event.type} (${event.id}) will be retried`,
        { receivedAt: row.received_at },
      );
      const reclaimed = await reclaimWebhookEventForRetry(
        event,
        payload,
        "received",
      );
      if (reclaimed) {
        return {
          action: "process",
          idempotencyAvailable: true,
          duplicate: true,
        };
      }
    }

    console.info(
      `[stripe/webhook] duplicate recently received event ${event.type} (${event.id}) deferred for retry`,
      { receivedAt: row.received_at },
    );
    return {
      action: "skip",
      idempotencyAvailable: true,
      duplicate: true,
      status: row.status,
      responseStatus: 409,
    };
  }

  console.warn(
    `[stripe/webhook] duplicate event ${event.type} (${event.id}) has unknown ledger status ${row.status}; ignoring duplicate`,
  );
  return {
    action: "skip",
    idempotencyAvailable: true,
    duplicate: true,
    status: row.status,
  };
}

async function reclaimWebhookEventForRetry(
  event: Stripe.Event,
  payload: string,
  currentStatus: "failed" | "received",
) {
  const result = await db.execute(sql`
    update public.stripe_webhook_events
    set
      status = 'received',
      payload = ${payload}::jsonb,
      error = null,
      received_at = now(),
      processed_at = null
    where id = ${event.id}
      and status = ${currentStatus}
    returning id, event_type, status, error, received_at, processed_at, false as inserted
  `);

  const [row] = rowsFromExecute<StripeWebhookLedgerRow>(result);
  if (!row) {
    console.info(
      `[stripe/webhook] duplicate event ${event.type} (${event.id}) changed before retry claim; ignoring duplicate`,
    );
  }

  return row;
}

async function markStripeWebhookEventComplete(
  event: Stripe.Event,
  claim: StripeWebhookClaim,
  status: HandledStripeWebhookStatus,
) {
  if (!claim.idempotencyAvailable) return;

  await db.execute(sql`
    update public.stripe_webhook_events
    set
      status = ${status},
      error = null,
      processed_at = now()
    where id = ${event.id}
  `);

  console.info(
    `[stripe/webhook] event ${event.type} (${event.id}) marked ${status}`,
  );
}

async function markStripeWebhookEventFailed(
  event: Stripe.Event,
  claim: StripeWebhookClaim,
  err: unknown,
) {
  if (!claim.idempotencyAvailable) return;

  try {
    await db.execute(sql`
      update public.stripe_webhook_events
      set
        status = 'failed',
        error = ${getErrorMessage(err)},
        processed_at = null
      where id = ${event.id}
    `);

    console.warn(
      `[stripe/webhook] event ${event.type} (${event.id}) marked failed`,
    );
  } catch (ledgerErr) {
    console.error(
      `[stripe/webhook] failed to mark event ${event.type} (${event.id}) as failed:`,
      ledgerErr,
    );
  }
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];

  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }

  return [];
}

function parseWebhookLedgerDate(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMissingWebhookLedgerError(err: unknown) {
  const maybe = err as { code?: string; message?: string };
  const message = maybe.message ?? "";

  return (
    maybe.code === "42P01" ||
    (message.includes("stripe_webhook_events") &&
      (message.includes("does not exist") ||
        message.includes("not found") ||
        message.includes("Could not find")))
  );
}

function getErrorMessage(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : safeStringify(err);

  return message.slice(0, 4000);
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Handlers

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    console.warn(
      `[stripe/webhook] checkout session ${session.id} completed with payment_status=${session.payment_status}; waiting for paid event`,
    );
    return;
  }

  const checkoutType = session.metadata?.type;
  if (checkoutType === "targeted_route_campaign") {
    await handleTargetedRouteCampaignCheckout(session);
    return;
  }
  if (checkoutType === "digital_targeting_management") {
    await handleDigitalTargetingCheckout(session);
    return;
  }
  if (checkoutType === "market_capture_management") {
    await handleMarketCaptureCheckout(session);
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
  if (checkoutType === "political_proposal") {
    await handlePoliticalProposalCheckout(session);
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

  console.log(
    `[stripe/webhook] order ${orderId} paid, business activated, campaign created`,
  );
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const checkoutType = session.metadata?.type;

  if (checkoutType === "political_proposal") {
    await handlePoliticalProposalCheckoutExpired(session);
    return;
  }
  if (checkoutType === "digital_targeting_management") {
    await handleDigitalTargetingCheckoutExpired(session);
    return;
  }
  if (checkoutType === "market_capture_management") {
    await handleMarketCaptureCheckoutExpired(session);
    return;
  }
  if (checkoutType === "ai_shared_postcard_intake") {
    await handleAiSharedPostcardCheckoutExpired(session);
    return;
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.log(
      `[stripe/webhook] expired checkout ${session.id} has no shared order id; no cleanup needed`,
    );
    return;
  }

  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(sql`${orders.id} = ${orderId} and ${orders.status} = 'pending'`);

  console.log(
    `[stripe/webhook] expired shared checkout ${session.id}; pending order ${orderId} marked cancelled if still unpaid`,
  );
}

async function handlePoliticalProposalCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  const orderId = metadata.politicalOrderId;
  const mode = metadata.paymentMode;

  if (!orderId || (mode !== "deposit" && mode !== "full")) {
    throw new Error(
      `[stripe/webhook] political proposal checkout ${session.id} missing political order metadata`,
    );
  }

  await recordPaymentCompleted({
    orderId,
    sessionId: session.id,
    paymentIntentId: session.payment_intent as string | null,
    stripeCustomerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null,
    amountPaidCents: session.amount_total ?? 0,
    mode: mode as PaymentMode,
  });

  console.log(
    `[stripe/webhook] political order ${orderId} reconciled from checkout ${session.id}`,
  );
}

async function handlePoliticalProposalCheckoutExpired(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.politicalOrderId;
  if (!orderId) {
    console.log(
      `[stripe/webhook] expired political checkout ${session.id} has no politicalOrderId; no cleanup needed`,
    );
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("political_orders")
    .update({
      payment_status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: "Stripe Checkout session expired before payment.",
    })
    .eq("id", orderId)
    .eq("payment_status", "pending");

  if (error) {
    throw new Error(
      `[stripe/webhook] political checkout expiration update failed: ${error.message}`,
    );
  }

  console.log(
    `[stripe/webhook] expired political checkout ${session.id}; pending political order ${orderId} marked canceled if still unpaid`,
  );
}

async function handleTargetedRouteCampaignCheckout(
  session: Stripe.Checkout.Session,
) {
  const campaignId = session.metadata?.campaignId;
  if (!campaignId) {
    console.error("[stripe/webhook] targeted checkout missing campaignId");
    return;
  }

  const supabase = createServiceClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("targeted_route_campaigns")
    .select("id, status, email, business_name, contact_name, homes_count, price_cents, lead_id, target_city")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(
      `[stripe/webhook] targeted lookup failed: ${campaignError?.message ?? campaignId}`,
    );
  }

  if (["mailed", "complete", "cancelled"].includes(String(campaign.status))) {
    console.warn(
      `[stripe/webhook] targeted campaign ${campaignId} is ${campaign.status}; payment event recorded but fulfillment state was not changed`,
    );
    return;
  }

  const shouldNotify = campaign.status !== "paid";
  const now = new Date().toISOString();
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const campaignEmail =
    typeof campaign.email === "string" ? campaign.email.trim() : "";
  const businessName =
    typeof campaign.business_name === "string" &&
    campaign.business_name.trim()
      ? campaign.business_name.trim()
      : String(session.metadata?.businessName ?? "Targeted campaign");

  const { error } = await supabase
    .from("targeted_route_campaigns")
    .update({
      status: "paid",
      design_status: "queued",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      updated_at: now,
    })
    .eq("id", campaignId)
    .not("status", "in", "(mailed,complete,cancelled)");

  if (error)
    throw new Error(
      `[stripe/webhook] targeted update failed: ${error.message}`,
    );

  if (campaign.lead_id) {
    const { error: leadError } = await supabase
      .from("leads")
      .update({
        status: "paid",
        paid_at: now,
        updated_at: now,
      })
      .eq("id", campaign.lead_id);

    if (leadError) {
      throw new Error(
        `[stripe/webhook] targeted lead paid update failed: ${leadError.message}`,
      );
    }
  }

  if (shouldNotify) {
    if (!campaignEmail) {
      throw new Error(
        `[stripe/webhook] targeted campaign ${campaignId} has no email for payment confirmation`,
      );
    }

    await Promise.all([
      sendPaymentConfirmation({
        contactName: campaign.contact_name,
        email: campaignEmail,
        businessName,
        homesCount: Number(campaign.homes_count ?? 500),
        priceCents: Number(campaign.price_cents ?? session.amount_total ?? 0),
      }),
      notifyAdminCampaignPaid({
        businessName,
        email: campaignEmail,
        targetCity: campaign.target_city,
        campaignId,
      }),
    ]);
  }

  console.log(`[stripe/webhook] targeted campaign ${campaignId} paid`);
}

async function handleDigitalTargetingCheckout(session: Stripe.Checkout.Session) {
  const campaignId = session.metadata?.campaignId;
  if (!campaignId) {
    console.error("[stripe/webhook] digital targeting checkout missing campaignId");
    return;
  }

  const supabase = createServiceClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("digital_targeting_campaigns")
    .select("id, payment_status, campaign_status, email, business_name, contact_name")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(
      `[stripe/webhook] digital targeting lookup failed: ${campaignError?.message ?? campaignId}`,
    );
  }

  if (String(campaign.campaign_status) === "cancelled") {
    console.warn(
      `[stripe/webhook] digital targeting campaign ${campaignId} is cancelled; payment event recorded but fulfillment state was not changed`,
    );
    return;
  }

  const shouldNotify = campaign.payment_status !== "paid";
  const now = new Date().toISOString();
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const { error: updateError } = await supabase
    .from("digital_targeting_campaigns")
    .update({
      payment_status: "paid",
      campaign_status: "target_area_review",
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      updated_at: now,
    })
    .eq("id", campaignId)
    .neq("campaign_status", "cancelled");

  if (updateError) {
    throw new Error(`[stripe/webhook] digital targeting update failed: ${updateError.message}`);
  }

  await supabase
    .from("digital_campaign_tasks")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
      notes: "Stripe subscription checkout completed.",
    })
    .eq("campaign_id", campaignId)
    .ilike("title", "Confirm payment");

  if (shouldNotify) {
    const email = typeof campaign.email === "string" ? campaign.email.trim() : "";
    if (email) {
      await sendDigitalPaymentConfirmation({
        businessName: String(campaign.business_name ?? "your business"),
        contactName: campaign.contact_name,
        email,
      });
    }
  }

  console.log(`[stripe/webhook] digital targeting campaign ${campaignId} paid`);
}

async function handleDigitalTargetingCheckoutExpired(session: Stripe.Checkout.Session) {
  const campaignId = session.metadata?.campaignId;
  if (!campaignId) {
    console.log(
      `[stripe/webhook] expired digital targeting checkout ${session.id} has no campaignId; no cleanup needed`,
    );
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("digital_targeting_campaigns")
    .update({
      payment_status: "payment_required",
      campaign_status: "payment_pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("payment_status", "checkout_created");

  if (error) {
    throw new Error(`[stripe/webhook] digital targeting expiration update failed: ${error.message}`);
  }

  console.log(
    `[stripe/webhook] expired digital targeting checkout ${session.id}; campaign ${campaignId} returned to payment required if still unpaid`,
  );
}

async function handleMarketCaptureCheckout(session: Stripe.Checkout.Session) {
  const leadId = session.metadata?.marketCaptureLeadId;
  if (!leadId) {
    console.error("[stripe/webhook] market capture checkout missing lead id");
    return;
  }

  const supabase = createServiceClient();
  const { data: lead, error: leadError } = await supabase
    .from("market_capture_leads")
    .select("id, payment_status, status, email, business_name, contact_name")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(
      `[stripe/webhook] market capture lookup failed: ${leadError?.message ?? leadId}`,
    );
  }

  if (String(lead.status) === "closed_lost") {
    console.warn(
      `[stripe/webhook] market capture lead ${leadId} is closed_lost; payment event recorded but sales state was not changed`,
    );
    return;
  }

  const now = new Date().toISOString();
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const [leadUpdate, pipelineUpdate, taskUpdate, noteInsert] =
    await Promise.all([
      supabase
        .from("market_capture_leads")
        .update({
          payment_status: "paid",
          status: "closed_won",
          stripe_checkout_session_id: session.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId,
          paid_at: now,
          updated_at: now,
        })
        .eq("id", leadId),
      supabase
        .from("market_capture_pipeline")
        .update({
          stage: "closed_won",
          status: "won",
          next_action: "Prepare fulfillment handoff",
          last_activity_at: now,
          updated_at: now,
        })
        .eq("market_capture_lead_id", leadId),
      supabase
        .from("market_capture_tasks")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
          notes: "Stripe subscription checkout completed.",
        })
        .eq("market_capture_lead_id", leadId)
        .ilike("title", "Payment follow-up"),
      supabase.from("market_capture_notes").insert({
        market_capture_lead_id: leadId,
        author: "stripe_webhook",
        note_type: "payment",
        content:
          "Stripe subscription checkout completed. Market Capture opportunity marked closed won for fulfillment handoff.",
        metadata: {
          checkout_session_id: session.id,
          subscription_id: subscriptionId,
          customer_id: customerId,
        },
      }),
    ]);

  const error =
    leadUpdate.error ??
    pipelineUpdate.error ??
    taskUpdate.error ??
    noteInsert.error;
  if (error) {
    throw new Error(`[stripe/webhook] market capture update failed: ${error.message}`);
  }

  try {
    await ensureMarketCaptureFulfillment({
      supabase,
      leadId,
      createdBy: "stripe_webhook",
    });
  } catch (err) {
    console.error(
      `[stripe/webhook] market capture fulfillment initialization failed for ${leadId}:`,
      err,
    );
  }

  console.log(`[stripe/webhook] market capture lead ${leadId} paid`);
}

async function handleMarketCaptureCheckoutExpired(session: Stripe.Checkout.Session) {
  const leadId = session.metadata?.marketCaptureLeadId;
  if (!leadId) {
    console.log(
      `[stripe/webhook] expired market capture checkout ${session.id} has no lead id; no cleanup needed`,
    );
    return;
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const [leadUpdate, pipelineUpdate, noteInsert] = await Promise.all([
    supabase
      .from("market_capture_leads")
      .update({
        payment_status: "payment_required",
        updated_at: now,
      })
      .eq("id", leadId)
      .eq("payment_status", "checkout_created"),
    supabase
      .from("market_capture_pipeline")
      .update({
        stage: "payment_pending",
        next_action: "Follow up on payment",
        last_activity_at: now,
        updated_at: now,
      })
      .eq("market_capture_lead_id", leadId),
    supabase.from("market_capture_notes").insert({
      market_capture_lead_id: leadId,
      author: "stripe_webhook",
      note_type: "payment",
      content: "Stripe Checkout session expired before Market Capture payment.",
      metadata: { checkout_session_id: session.id },
    }),
  ]);

  const error = leadUpdate.error ?? pipelineUpdate.error ?? noteInsert.error;
  if (error) {
    throw new Error(
      `[stripe/webhook] market capture expiration update failed: ${error.message}`,
    );
  }

  console.log(
    `[stripe/webhook] expired market capture checkout ${session.id}; lead ${leadId} returned to payment required if still unpaid`,
  );
}

async function handlePropertyIntelligenceCheckout(
  session: Stripe.Checkout.Session,
) {
  const metadata = session.metadata ?? {};
  const tier = metadata.tier;
  const city = metadata.city;
  const businessName = metadata.business_name;

  if (!tier || !city || !businessName) {
    console.error(
      "[stripe/webhook] intelligence checkout missing required metadata",
    );
    return;
  }

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("founding_memberships")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existing) {
    console.log(
      `[stripe/webhook] intelligence checkout ${session.id} already fulfilled`,
    );
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
      category:
        metadata.category === "all" ? null : (metadata.category ?? null),
      product: `intelligence_${tier}`,
      tier,
      locked_price_cents: Number.isFinite(lockedPriceCents)
        ? lockedPriceCents
        : null,
      standard_price_cents: Number.isFinite(standardPriceCents)
        ? standardPriceCents
        : null,
      stripe_subscription_id: session.subscription as string | null,
      stripe_checkout_session_id: session.id,
      status: "active",
    });

  if (memberError) {
    throw new Error(
      `[stripe/webhook] intelligence membership insert failed: ${memberError.message}`,
    );
  }

  if (isFounding && metadata.slot_id) {
    const { data: slot, error: slotError } = await supabase
      .from("founding_slots")
      .select("id, total_slots, slots_taken")
      .eq("id", metadata.slot_id)
      .single();

    if (slotError) {
      console.error(
        "[stripe/webhook] founding slot lookup failed:",
        slotError.message,
      );
    } else if (slot) {
      const slotsTaken = (slot.slots_taken ?? 0) + 1;
      const { error: updateError } = await supabase
        .from("founding_slots")
        .update({
          slots_taken: slotsTaken,
          slots_remaining: Math.max(
            0,
            (slot.total_slots ?? slotsTaken) - slotsTaken,
          ),
        })
        .eq("id", slot.id);

      if (updateError) {
        console.error(
          "[stripe/webhook] founding slot update failed:",
          updateError.message,
        );
      }
    }
  }

  console.log(
    `[stripe/webhook] property intelligence checkout ${session.id} fulfilled`,
  );
}

async function handleAiSharedPostcardCheckout(
  session: Stripe.Checkout.Session,
) {
  const sessionId = session.metadata?.aiIntakeSessionId;
  if (!sessionId) {
    console.error("[stripe/webhook] AI intake checkout missing session id");
    return;
  }

  const supabase = createServiceClient();
  const now = new Date();
  const commitmentEndsAt = new Date(
    now.getTime() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const subscriptionId = session.subscription as string | null;
  const customerId = session.customer as string | null;
  const paymentIntentId = session.payment_intent as string | null;

  const { data: intakeSession, error: sessionError } = await supabase
    .from("ai_intake_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !intakeSession) {
    throw new Error(
      `[stripe/webhook] AI intake session lookup failed: ${sessionError?.message ?? sessionId}`,
    );
  }

  const { data: cartItems, error: cartError } = await supabase
    .from("ai_intake_cart_items")
    .select(
      "id, business_id, order_id, spot_assignment_id, city_id, category_id, bundle_id, subtotal_cents, quantity, availability_status",
    )
    .eq("session_id", sessionId);

  if (cartError) {
    throw new Error(
      `[stripe/webhook] AI intake cart lookup failed: ${cartError.message}`,
    );
  }

  for (let index = 0; index < (cartItems ?? []).length; index += 1) {
    const item = (cartItems ?? [])[index] as any;
    if (!item.business_id || !item.order_id || !item.spot_assignment_id) {
      console.error(
        "[stripe/webhook] AI intake cart item missing fulfillment ids",
        item.id,
      );
      continue;
    }

    const orderUpdate: Record<string, unknown> = {
      status: "paid",
      stripe_customer_id: customerId,
      paid_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    if (index === 0 && paymentIntentId)
      orderUpdate.stripe_payment_intent_id = paymentIntentId;

    const { error: orderError } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", item.order_id);
    if (orderError)
      throw new Error(
        `[stripe/webhook] AI order update failed: ${orderError.message}`,
      );

    const { error: businessError } = await supabase
      .from("businesses")
      .update({
        status: "active",
        stripe_customer_id: customerId,
        updated_at: now.toISOString(),
      })
      .eq("id", item.business_id);
    if (businessError)
      throw new Error(
        `[stripe/webhook] AI business update failed: ${businessError.message}`,
      );

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
      throw new Error(
        `[stripe/webhook] AI spot assignment update failed: ${assignmentError.message}`,
      );
    }

    const { data: existingIntake, error: existingIntakeError } = await supabase
      .from("intake_submissions")
      .select("id")
      .eq("spot_assignment_id", item.spot_assignment_id)
      .maybeSingle();
    if (existingIntakeError) {
      throw new Error(
        `[stripe/webhook] AI intake lookup failed: ${existingIntakeError.message}`,
      );
    }

    if (!existingIntake) {
      const { error: intakeError } = await supabase
        .from("intake_submissions")
        .insert({
          spot_assignment_id: item.spot_assignment_id,
          business_id: item.business_id,
          status: "pending",
        });
      if (intakeError)
        throw new Error(
          `[stripe/webhook] AI intake insert failed: ${intakeError.message}`,
        );
    }

    const startDate = now.toISOString();
    const nextDropDate = new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const renewalDate = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

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
      throw new Error(
        `[stripe/webhook] AI campaign upsert failed: ${campaignError.message}`,
      );
    }

    const { error: itemError } = await supabase
      .from("ai_intake_cart_items")
      .update({
        availability_status: "paid",
        availability_message:
          "Payment completed and downstream records activated.",
      })
      .eq("id", item.id);
    if (itemError)
      throw new Error(
        `[stripe/webhook] AI item update failed: ${itemError.message}`,
      );
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
    throw new Error(
      `[stripe/webhook] AI session paid update failed: ${updateSessionError.message}`,
    );
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
    throw new Error(
      `[stripe/webhook] AI confirmation paid update failed: ${confirmationError.message}`,
    );
  }

  console.log(
    `[stripe/webhook] AI intake session ${sessionId} paid and activated`,
  );
}

async function handleAiSharedPostcardCheckoutExpired(
  session: Stripe.Checkout.Session,
) {
  const sessionId = session.metadata?.aiIntakeSessionId;
  if (!sessionId) {
    console.log(
      `[stripe/webhook] expired AI shared postcard checkout ${session.id} has no session id; no cleanup needed`,
    );
    return;
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: cartItems, error: cartError } = await supabase
    .from("ai_intake_cart_items")
    .select("id, order_id, spot_assignment_id")
    .eq("session_id", sessionId);

  if (cartError) {
    throw new Error(
      `[stripe/webhook] expired AI intake cart lookup failed: ${cartError.message}`,
    );
  }

  const orderIds = Array.from(
    new Set(
      (cartItems ?? [])
        .map((item: any) => item.order_id)
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const spotAssignmentIds = Array.from(
    new Set(
      (cartItems ?? [])
        .map((item: any) => item.spot_assignment_id)
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  if (orderIds.length > 0) {
    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: now })
      .in("id", orderIds)
      .eq("status", "pending");
    if (orderError) {
      throw new Error(
        `[stripe/webhook] expired AI order cleanup failed: ${orderError.message}`,
      );
    }
  }

  if (spotAssignmentIds.length > 0) {
    const { error: assignmentError } = await supabase
      .from("spot_assignments")
      .update({
        status: "cancelled",
        released_at: now,
        updated_at: now,
      })
      .in("id", spotAssignmentIds)
      .eq("status", "pending");
    if (assignmentError) {
      throw new Error(
        `[stripe/webhook] expired AI spot cleanup failed: ${assignmentError.message}`,
      );
    }
  }

  const [itemUpdate, sessionUpdate, confirmationUpdate] = await Promise.all([
    supabase
      .from("ai_intake_cart_items")
      .update({
        availability_status: "expired",
        availability_message:
          "Stripe Checkout expired before payment. Inventory was released for review.",
      })
      .eq("session_id", sessionId)
      .in("availability_status", ["available", "reserved"]),
    supabase
      .from("ai_intake_sessions")
      .update({
        status: "expired",
        current_step: "checkout",
        updated_at: now,
      })
      .eq("id", sessionId)
      .in("status", ["confirmed", "checkout_created"]),
    supabase
      .from("ai_intake_confirmations")
      .update({
        confirmation_status: "expired",
        updated_at: now,
      })
      .eq("session_id", sessionId)
      .in("confirmation_status", ["confirmed", "checkout_created"]),
  ]);

  const error = itemUpdate.error ?? sessionUpdate.error ?? confirmationUpdate.error;
  if (error) {
    throw new Error(
      `[stripe/webhook] expired AI intake status cleanup failed: ${error.message}`,
    );
  }

  console.log(
    `[stripe/webhook] expired AI shared postcard checkout ${session.id}; session ${sessionId} released pending inventory`,
  );
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

  console.log(
    `[stripe/webhook] refund processed for intent ${paymentIntentId}`,
  );
}
