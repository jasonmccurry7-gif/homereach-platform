"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Public /p/[token] server actions — approve / decline / initiate payment.
//
// No Supabase Auth on this path. The public_token IS the authentication.
// All DB writes go through the service-role client (see lib/political/proposals).
//
// These actions use redirect() to post-process completion, so the browser
// always lands on a known URL after the action resolves.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { isPoliticalEnabled } from "@/lib/political/env";
import {
  approveProposalByToken,
  declineProposalByToken,
  attachCheckoutSession,
  recordPaymentCompleted,
  type PaymentMode,
} from "@/lib/political/proposals";
import { ensureContractForProposal } from "@/lib/political/contracts";
import { stripe } from "@homereach/services/stripe";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
}

function requireFlag(): void {
  if (!isPoliticalEnabled()) {
    // Flag-off path surfaces as a 404 at the page layer; actions short-circuit.
    throw new Error("Political Command Center is disabled.");
  }
}

// ── Approve / Decline ────────────────────────────────────────────────────────

export async function approveAction(formData: FormData): Promise<void> {
  requireFlag();
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");
  const { proposal } = await approveProposalByToken(token);

  // Auto-create the contract so it's ready when the customer is. This is
  // best-effort — a failure here doesn't block approval. Admin can
  // retry via ensureContractForProposal() later if this logs an error.
  try {
    await ensureContractForProposal(proposal.id, null);
  } catch (err) {
    console.error("[political/approveAction] contract auto-create failed:", err);
  }

  redirect(`/p/${token}?approved=1`);
}

export async function declineAction(formData: FormData): Promise<void> {
  requireFlag();
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");
  await declineProposalByToken(token);
  redirect(`/p/${token}?declined=1`);
}

// ── Stripe checkout ──────────────────────────────────────────────────────────

const DEPOSIT_FRACTION = 0.5; // 50% deposit

/**
 * Creates a Stripe Checkout Session for a proposal and redirects the
 * customer to Stripe. On successful payment Stripe redirects back to
 * `/p/[token]?paid=1&session_id=cs_...` where the server page retrieves
 * the session and updates political_orders.
 *
 * Uses the Stripe SDK client directly (imported from @homereach/services/stripe)
 * rather than the existing `createOneTimeCheckoutSession` helper because that
 * helper is tightly coupled to the spots/orders shape.
 *
 * metadata.type = "political_proposal" disambiguates from the existing
 * webhook's "targeted_route_campaign" and default spot flows. Critically we
 * NEVER set metadata.orderId (which the default webhook handler reads into
 * the spot `orders` table — wrong table).
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  requireFlag();
  const token = String(formData.get("token") ?? "");
  const mode = String(formData.get("mode") ?? "") as PaymentMode;

  if (!token) redirect("/");
  if (mode !== "deposit" && mode !== "full") {
    redirect(`/p/${token}?error=invalid_payment_mode`);
  }

  // Ensure approved + order exists (idempotent). If already approved, reuses
  // the existing order; else approves + creates a pending order.
  const { proposal, order } = await approveProposalByToken(token);

  // Ensure the contract exists too. Idempotent; no-op if already present.
  // Best-effort — we don't want a transient contract-create failure to
  // block the customer from paying.
  try {
    await ensureContractForProposal(proposal.id, null);
  } catch (err) {
    console.error("[political/startCheckoutAction] contract auto-create failed:", err);
  }

  const baseUrl = appUrl();

  // Compute the amount to charge for this checkout session.
  const totalCents = order.totalCents;
  let chargeCents = totalCents;
  if (mode === "deposit") {
    // Deposit only applies if nothing has been paid yet; otherwise treat as
    // a balance-due full charge of (total - amountPaid).
    const outstanding = Math.max(0, totalCents - order.amountPaidCents);
    chargeCents =
      order.amountPaidCents > 0
        ? outstanding
        : Math.max(1, Math.round(totalCents * DEPOSIT_FRACTION));
  } else {
    chargeCents = Math.max(1, totalCents - order.amountPaidCents);
  }

  if (chargeCents <= 0) {
    redirect(`/p/${token}?error=already_paid`);
  }

  // Build the Stripe Checkout Session.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `HomeReach political mail — ${mode === "deposit" ? "deposit" : "balance"}`,
            description: `Proposal ${proposal.id.slice(0, 8)} · ${proposal.totalPieces.toLocaleString()} pieces over ${proposal.drops} drop${proposal.drops === 1 ? "" : "s"}`,
          },
          unit_amount: chargeCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      // NOTE: never use metadata.orderId here — the existing webhook
      // default handler treats that as a spot order and writes to the
      // wrong table. politicalProposalId / politicalOrderId are safe.
      type: "political_proposal",
      politicalProposalId: proposal.id,
      politicalOrderId: order.id,
      politicalPublicToken: token,
      paymentMode: mode,
    },
    payment_intent_data: {
      metadata: {
        type: "political_proposal",
        politicalProposalId: proposal.id,
        politicalOrderId: order.id,
        paymentMode: mode,
      },
    },
    success_url: `${baseUrl}/p/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/p/${token}?canceled=1`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    redirect(`/p/${token}?error=no_session_url`);
  }

  // Record the session on the order so the success_url handler can find it.
  await attachCheckoutSession({
    orderId: order.id,
    sessionId: session.id,
    paymentMode: mode,
    amountCents: chargeCents,
  });

  redirect(session.url);
}

// ── Poll helper exported for the page's success-url handler ─────────────────
//
// Separated so the page can call it server-side during render. Returns true
// when the order has been advanced to a paid status.

export async function refreshOrderFromStripe(
  sessionId: string,
): Promise<{ ok: true; paid: boolean } | { ok: false; error: string }> {
  requireFlag();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    // We only act when Stripe says the payment is complete. For pending
    // sessions we return paid=false and the page renders a "processing" state.
    if (session.payment_status !== "paid") {
      return { ok: true, paid: false };
    }

    const metadata = session.metadata ?? {};
    const orderId = metadata["politicalOrderId"];
    const modeRaw = metadata["paymentMode"];
    if (!orderId || (modeRaw !== "deposit" && modeRaw !== "full")) {
      return { ok: false, error: "Stripe session metadata missing political fields" };
    }
    const mode = modeRaw as PaymentMode;

    const intent = session.payment_intent;
    const paymentIntentId =
      typeof intent === "string" ? intent : intent?.id ?? null;

    // Amount paid in this session (in cents).
    const amount = session.amount_total ?? 0;

    await recordPaymentCompleted({
      orderId,
      sessionId,
      paymentIntentId,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      amountPaidCents: amount,
      mode,
    });

    return { ok: true, paid: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error retrieving Stripe session",
    };
  }
}

/** Silent-refresh wrapper used by the /p/[token]?paid=1 handler. Server-only. */
export async function handleSuccessReturn(
  proposalId: string,
  sessionId: string,
): Promise<{ paid: boolean; error: string | null }> {
  // proposalId is captured for possible future audit logging; not used today.
  void proposalId;
  const res = await refreshOrderFromStripe(sessionId);
  if ("error" in res) return { paid: false, error: res.error };
  return { paid: res.paid, error: null };
}
