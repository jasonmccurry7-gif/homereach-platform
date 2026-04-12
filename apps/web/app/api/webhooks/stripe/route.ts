import { NextResponse } from "next/server";
import { constructWebhookEvent } from "@homereach/services/stripe";
import {
  db, orders, businesses, marketingCampaigns,
  targetedRouteCampaigns, leads,
  spotAssignments, intakeSubmissions,
} from "@homereach/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { PricingSnapshot } from "@homereach/types";
import {
  sendPaymentConfirmation,
  notifyAdminCampaignPaid,
} from "@homereach/services/targeted";
import { createServiceClient } from "@homereach/services/auth";
import { sendEmail } from "@homereach/services/outreach";

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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Route to correct handler based on metadata.type
        if (session.metadata?.type === "targeted_route_campaign") {
          await handleTargetedCheckoutCompleted(session);
        } else {
          await handleCheckoutCompleted(session);
        }
        break;
      }

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      // ── Subscription lifecycle ─────────────────────────────────────────────

      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(sub);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(inv);
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(inv);
        break;
      }

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

  // ── Parse pricing snapshot from metadata ───────────────────────────────────
  // The checkout route embeds the snapshot as a JSON string in session metadata.
  // If absent (pre-Task-20 orders), pricingSnapshotJson remains null.
  let pricingSnapshotJson: PricingSnapshot | null = null;
  if (session.metadata?.pricingSnapshot) {
    try {
      pricingSnapshotJson = JSON.parse(session.metadata.pricingSnapshot) as PricingSnapshot;
    } catch {
      console.warn("[stripe/webhook] failed to parse pricingSnapshot from metadata — orderId:", orderId);
    }
  }

  await db
    .update(orders)
    .set({
      status: "paid",
      stripePaymentIntentId: session.payment_intent as string | null,
      // orders.stripeCustomerId is deprecated — authoritative copy is on businesses.stripeCustomerId
      // We still set it here for backward compatibility with any admin queries reading orders directly
      stripeCustomerId: session.customer as string | null,
      paidAt: new Date(),
      updatedAt: new Date(),
      // Write immutable snapshot — never update this field after this point.
      // Cast required: orders schema types jsonb as Record<string, unknown> to avoid
      // cross-package dependency; PricingSnapshot satisfies that shape at runtime.
      ...(pricingSnapshotJson
        ? { pricingSnapshotJson: pricingSnapshotJson as unknown as Record<string, unknown> }
        : {}),
    })
    .where(eq(orders.id, orderId));

  // Activate the associated business
  const [order] = await db
    .select({ businessId: orders.businessId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (order) {
    // Update businesses.stripeCustomerId (authoritative per Task 20 architecture)
    const stripeCustomerId = session.customer as string | null;
    await db
      .update(businesses)
      .set({
        status: "active",
        updatedAt: new Date(),
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
      })
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

// ─────────────────────────────────────────────────────────────────────────────
// Subscription lifecycle handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * customer.subscription.created
 * Fires after Stripe processes a successful subscription checkout.
 *
 * Actions:
 *   1. Find the spot_assignment by reservationId (from subscription metadata)
 *   2. Activate it: status → active, set activated_at + commitment_ends_at
 *   3. Link stripe_subscription_id + stripe_customer_id
 *   4. Activate the business: status → active
 *   5. Invite business to Supabase via inviteUserByEmail
 *   6. Create intake_submission record
 *   7. Send intake invitation email
 */
async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  const reservationId = sub.metadata?.reservationId;
  const businessId    = sub.metadata?.businessId;

  if (!reservationId) {
    console.error("[stripe/webhook] subscription.created — no reservationId in metadata", sub.id);
    return;
  }

  // ── 1. Activate spot_assignment ───────────────────────────────────────────
  const activatedAt      = new Date();
  const commitmentEndsAt = new Date(activatedAt.getTime() + 90 * 24 * 60 * 60 * 1000); // +90 days

  await db
    .update(spotAssignments)
    .set({
      status:              "active",
      stripeSubscriptionId: sub.id,
      stripeCustomerId:     sub.customer as string,
      activatedAt,
      commitmentEndsAt,
      updatedAt:           new Date(),
    })
    .where(eq(spotAssignments.id, reservationId));

  // ── 2. Activate business ──────────────────────────────────────────────────
  let businessEmail: string | null = null;
  let businessName:  string | null = null;

  if (businessId) {
    const [biz] = await db
      .select({ email: businesses.email, name: businesses.name, stripeCustomerId: businesses.stripeCustomerId })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (biz) {
      businessEmail = biz.email;
      businessName  = biz.name;

      await db
        .update(businesses)
        .set({
          status:           "active",
          stripeCustomerId: biz.stripeCustomerId ?? (sub.customer as string),
          updatedAt:        new Date(),
        })
        .where(eq(businesses.id, businessId));
    }
  }

  // ── 3. Invite business user to Supabase ───────────────────────────────────
  if (businessEmail && businessId) {
    try {
      const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
      const supaAdmin = createServiceClient();

      const { data: inviteData, error: inviteError } = await supaAdmin.auth.admin.inviteUserByEmail(
        businessEmail,
        { redirectTo: `${appUrl}/dashboard` }
      );

      if (inviteError) {
        console.error("[stripe/webhook] inviteUserByEmail failed:", inviteError.message);
      } else if (inviteData?.user?.id) {
        // Store supabase_user_id on the business for dashboard auth lookup
        await db
          .update(businesses)
          .set({ supabaseUserId: inviteData.user.id, updatedAt: new Date() })
          .where(eq(businesses.id, businessId));
      }
    } catch (err) {
      console.error("[stripe/webhook] Supabase invite error:", err);
    }
  }

  // ── 4. Create intake_submission ────────────────────────────────────────────
  let intakeToken: string | null = null;
  if (businessId) {
    try {
      const [intake] = await db
        .insert(intakeSubmissions)
        .values({
          spotAssignmentId: reservationId,
          businessId,
          status:           "pending",
        })
        .returning({ accessToken: intakeSubmissions.accessToken })
        .onConflictDoNothing();

      intakeToken = intake?.accessToken ?? null;
    } catch (err) {
      console.error("[stripe/webhook] intake_submission creation error:", err);
    }
  }

  // ── 5. Send intake invitation email ───────────────────────────────────────
  if (businessEmail && intakeToken) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
    const intakeUrl = `${appUrl}/intake/${intakeToken}`;

    await sendEmail({
      to:      businessEmail,
      subject: "Welcome to HomeReach — Complete Your Campaign Setup (5 min)",
      html: `
        <h2>You're in! One last step to launch your campaign.</h2>
        <p>Hi ${businessName ?? "there"},</p>
        <p>Your HomeReach spot is confirmed. To build your campaign, we need a few quick details from you.</p>
        <p><strong>It takes about 5 minutes.</strong></p>
        <p>
          <a href="${intakeUrl}" style="
            display: inline-block; padding: 14px 28px; background: #2563EB;
            color: white; text-decoration: none; border-radius: 6px;
            font-weight: bold; font-size: 16px;
          ">
            Complete My Campaign Setup →
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          If the button doesn't work, copy this link:<br/>
          <a href="${intakeUrl}">${intakeUrl}</a>
        </p>
        <p>Questions? Reply to this email — we're here.</p>
        <p>— The HomeReach Team</p>
      `,
    }).catch((err) => console.error("[stripe/webhook] intake email error:", err));
  }

  console.log(
    `[stripe/webhook] subscription.created — spot ${reservationId} activated,` +
    ` business ${businessId} active, intake created`
  );
}

/**
 * customer.subscription.updated
 * Handles Stripe status transitions: active→past_due, past_due→active, etc.
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  if (!sub.id) return;

  const stripeStatus = sub.status;

  // Map Stripe subscription statuses to our spot assignment statuses
  let newStatus: "active" | "paused" | null = null;
  if (stripeStatus === "active") {
    newStatus = "active";
  } else if (stripeStatus === "past_due" || stripeStatus === "unpaid") {
    newStatus = "paused";
  }

  if (newStatus) {
    await db
      .update(spotAssignments)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(spotAssignments.stripeSubscriptionId, sub.id));

    console.log(
      `[stripe/webhook] subscription.updated — sub ${sub.id} → spot status: ${newStatus}`
    );
  }
}

/**
 * customer.subscription.deleted
 * Fires when a subscription is cancelled or expires.
 * Releases the spot back to available inventory.
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  if (!sub.id) return;

  await db
    .update(spotAssignments)
    .set({
      status:     "churned",
      releasedAt: new Date(),
      updatedAt:  new Date(),
    })
    .where(eq(spotAssignments.stripeSubscriptionId, sub.id));

  console.log(
    `[stripe/webhook] subscription.deleted — sub ${sub.id} spot released (churned)`
  );
}

/**
 * invoice.paid
 * Fires on each successful recurring payment.
 * Restores active status if previously paused and updates updatedAt.
 */
async function handleInvoicePaid(inv: Stripe.Invoice) {
  const subscriptionId = inv.subscription as string | null;
  if (!subscriptionId) return;

  // Restore to active if it was paused (payment recovered)
  await db
    .update(spotAssignments)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(spotAssignments.stripeSubscriptionId, subscriptionId));

  console.log(
    `[stripe/webhook] invoice.paid — sub ${subscriptionId} spot confirmed active`
  );
}

/**
 * invoice.payment_failed
 * Fires when a recurring payment fails.
 * Pauses the spot and sends a dunning email to the business.
 */
async function handleInvoicePaymentFailed(inv: Stripe.Invoice) {
  const subscriptionId = inv.subscription as string | null;
  if (!subscriptionId) return;

  // Mark spot as paused
  await db
    .update(spotAssignments)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(spotAssignments.stripeSubscriptionId, subscriptionId));

  // Fetch business email for dunning
  const [spot] = await db
    .select({
      businessId: spotAssignments.businessId,
    })
    .from(spotAssignments)
    .where(eq(spotAssignments.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (spot?.businessId) {
    const [biz] = await db
      .select({ email: businesses.email, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, spot.businessId))
      .limit(1);

    if (biz?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";

      await sendEmail({
        to:      biz.email,
        subject: "Action Required: Update Your HomeReach Payment Method",
        html: `
          <h2>Your payment didn't go through.</h2>
          <p>Hi ${biz.name ?? "there"},</p>
          <p>We couldn't process your monthly HomeReach payment. Your spot is temporarily paused.</p>
          <p>
            <a href="${appUrl}/dashboard" style="
              display: inline-block; padding: 14px 28px; background: #DC2626;
              color: white; text-decoration: none; border-radius: 6px;
              font-weight: bold;
            ">
              Update Payment Method →
            </a>
          </p>
          <p>If we can't process payment within 7 days, your spot will be released.</p>
          <p>— The HomeReach Team</p>
        `,
      }).catch((err) => console.error("[stripe/webhook] dunning email error:", err));
    }
  }

  console.log(
    `[stripe/webhook] invoice.payment_failed — sub ${subscriptionId} spot paused, dunning sent`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Targeted Route Campaign — checkout completed handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleTargetedCheckoutCompleted(session: Stripe.Checkout.Session) {
  const campaignId = session.metadata?.campaignId;
  if (!campaignId) {
    console.error("[stripe/webhook] targeted checkout — no campaignId in metadata");
    return;
  }

  // ── Update campaign to paid ───────────────────────────────────────────────
  await db
    .update(targetedRouteCampaigns)
    .set({
      status:                "paid",
      designStatus:          "queued",
      stripePaymentIntentId: session.payment_intent as string | null,
      updatedAt:             new Date(),
    })
    .where(eq(targetedRouteCampaigns.id, campaignId));

  // ── Fetch campaign for notifications ─────────────────────────────────────
  const [campaign] = await db
    .select()
    .from(targetedRouteCampaigns)
    .where(eq(targetedRouteCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) return;

  // ── Update lead status ────────────────────────────────────────────────────
  if (campaign.leadId) {
    await db
      .update(leads)
      .set({
        status:    "paid",
        paidAt:    new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, campaign.leadId));
  }

  // ── Send payment confirmation to customer ─────────────────────────────────
  // ── Notify admin to queue design job ─────────────────────────────────────
  await Promise.all([
    sendPaymentConfirmation({
      contactName:  campaign.contactName,
      email:        campaign.email,
      businessName: campaign.businessName,
      homesCount:   campaign.homesCount,
      priceCents:   campaign.priceCents,
    }),
    notifyAdminCampaignPaid({
      businessName: campaign.businessName,
      email:        campaign.email,
      targetCity:   campaign.targetCity,
      campaignId:   campaign.id,
    }),
  ]).catch((err) => console.error("[stripe/webhook] targeted notification error:", err));

  console.log(`[stripe/webhook] targeted campaign ${campaignId} paid — design queued`);
}
