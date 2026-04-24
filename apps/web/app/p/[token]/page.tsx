// ─────────────────────────────────────────────────────────────────────────────
// Public proposal page — /p/[token]
//
// No Supabase Auth. The 32-byte opaque public_token IS the authentication.
//
// Flag-gated: returns 404 when ENABLE_POLITICAL is unset.
//
// Compliance: this page renders ONLY the clientSummary fields
// (households, drops, total_pieces, total investment, delivery window).
// Internal cost, margin, and profit are NEVER surfaced here, even though
// they exist on the underlying proposal record.
//
// Flow:
//   1. Customer opens link → proposal shows summary + Approve / Decline
//   2. Customer clicks Approve → status = approved, order row created
//   3. Payment buttons appear: "Pay 50% deposit" + "Pay in full"
//   4. Stripe Checkout opens
//   5. On success Stripe redirects to /p/[token]?paid=1&session_id=cs_...
//   6. This page retrieves the session server-side, updates political_orders,
//      and renders a "paid" banner
//
// No webhook edit was required. If the customer closes the tab before the
// redirect completes, payment status stays pending; admin can resolve via a
// "Refresh payment status" action in a later phase.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { notFound } from "next/navigation";
import { isPoliticalEnabled } from "@/lib/political/env";
import {
  findActiveOrderForProposal,
  loadPublicProposal,
  markProposalViewed,
  type PublicProposalContext,
} from "@/lib/political/proposals";
import { loadActiveContractForProposalPublic } from "@/lib/political/contracts";
import {
  approveAction,
  declineAction,
  handleSuccessReturn,
  startCheckoutAction,
} from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function geographyLabel(ctx: PublicProposalContext): string {
  if (!ctx.geographyType || !ctx.geographyValue) return ctx.state;
  return `${ctx.geographyValue} (${ctx.geographyType}) · ${ctx.state}`;
}

export default async function PublicProposalPage({ params, searchParams }: PageProps) {
  if (!isPoliticalEnabled()) notFound();

  const { token } = await params;
  const sp = await searchParams;

  const paidFlag = first(sp["paid"]) === "1";
  const sessionId = first(sp["session_id"]) ?? null;
  const approvedFlag = first(sp["approved"]) === "1";
  const declinedFlag = first(sp["declined"]) === "1";
  const canceledFlag = first(sp["canceled"]) === "1";
  const errorParam = first(sp["error"]) ?? null;

  // Best-effort view tracking. Never fails the page render.
  try {
    await markProposalViewed(token);
  } catch {
    // Non-fatal; continue rendering the page.
  }

  // Best-effort post-payment reconciliation. If session_id is present we try
  // to close out the order before rendering.
  let paymentNoticeVariant: "success" | "processing" | "error" | null = null;
  let paymentNoticeText: string | null = null;
  if (paidFlag && sessionId) {
    const res = await handleSuccessReturn("", sessionId);
    if (res.error) {
      paymentNoticeVariant = "error";
      paymentNoticeText = `Couldn't confirm payment: ${res.error}`;
    } else if (res.paid) {
      paymentNoticeVariant = "success";
      paymentNoticeText = "Payment received. Thank you.";
    } else {
      paymentNoticeVariant = "processing";
      paymentNoticeText = "Payment is processing. Refresh in a minute.";
    }
  }

  const ctx = await loadPublicProposal(token);
  if (!ctx) {
    return <ExpiredOrMissing />;
  }

  const [order, contract] = await Promise.all([
    findActiveOrderForProposal(ctx.proposal.id),
    loadActiveContractForProposalPublic(ctx.proposal.id),
  ]);

  const isApproved = ctx.proposal.status === "approved";
  const isDeclined = ctx.proposal.status === "declined";
  const isExpired = ctx.proposal.status === "expired";
  const contractSigned = contract?.status === "signed";

  const fullyPaid = order?.paymentStatus === "paid";
  const depositPaid = order?.paymentStatus === "deposit_paid";

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-slate-50 px-4 py-8">
      {/* Post-action notices */}
      {paymentNoticeText && (
        <Notice variant={paymentNoticeVariant ?? "processing"}>{paymentNoticeText}</Notice>
      )}
      {approvedFlag && !paymentNoticeText && (
        <Notice variant="success">Proposal approved. Complete payment below to start production.</Notice>
      )}
      {declinedFlag && !paymentNoticeText && (
        <Notice variant="neutral">Proposal declined. Contact HomeReach if this was a mistake.</Notice>
      )}
      {canceledFlag && (
        <Notice variant="neutral">Payment canceled. You can try again below.</Notice>
      )}
      {errorParam && (
        <Notice variant="error">
          Something went wrong: <code className="rounded bg-rose-100 px-1">{errorParam}</code>
        </Notice>
      )}

      {/* Header */}
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-slate-500">HomeReach · Direct Mail Plan</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {ctx.candidateName}
        </h1>
        {ctx.candidateOffice && (
          <p className="mt-0.5 text-sm text-slate-600">{ctx.candidateOffice}</p>
        )}
        <p className="mt-2 text-sm text-slate-700">{ctx.campaignName}</p>
        <p className="mt-0.5 text-xs text-slate-500">{geographyLabel(ctx)}</p>
        {ctx.electionDate && (
          <p className="mt-2 text-xs text-slate-500">
            Election date: <span className="font-medium text-slate-800">{formatDate(ctx.electionDate)}</span>
          </p>
        )}
      </header>

      {/* Client-facing summary — NEVER internal cost / margin / profit */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mail plan</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Stat label="Households reached" value={ctx.proposal.households.toLocaleString()} />
          <Stat label="Mail drops" value={ctx.proposal.drops.toLocaleString()} />
          <Stat label="Total pieces" value={ctx.proposal.totalPieces.toLocaleString()} />
          <Stat label="Delivery window" value={ctx.proposal.deliveryWindowText ?? "~12–19 business days"} />
        </dl>

        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-4">
          <div>
            <div className="text-xs text-slate-500">Total campaign investment</div>
            <div className="mt-0.5 text-3xl font-semibold tracking-tight text-slate-900">
              {formatCents(ctx.proposal.totalInvestmentCents)}
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      {!isApproved && !isDeclined && !isExpired && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next step</h2>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <form action={approveAction} className="flex-1">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Approve this plan
              </button>
            </form>
            <form action={declineAction} className="md:w-auto">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Not right now
              </button>
            </form>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Approving creates an order. Payment happens in the next step via Stripe.
          </p>
        </section>
      )}

      {/* Contract — surface once the proposal is approved */}
      {isApproved && contract && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Services agreement
          </h2>
          {contractSigned ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="text-emerald-800">
                  Signed by <span className="font-medium">{contract.signerName}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(contract.signedAt ?? "").toLocaleString()}
                </p>
              </div>
              {contract.publicToken && (
                <Link
                  href={`/c/${contract.publicToken}`}
                  className="text-xs text-blue-700 hover:underline"
                >
                  View signed agreement →
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-slate-700">
                Please review and sign the services agreement.
              </p>
              {contract.publicToken && (
                <Link
                  href={`/c/${contract.publicToken}`}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  Review &amp; sign →
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* Payment */}
      {isApproved && !fullyPaid && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {depositPaid ? "Balance due" : "Secure payment"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {depositPaid
              ? `Deposit received. Remaining balance is ${formatCents(
                  (order?.totalCents ?? 0) - (order?.amountPaidCents ?? 0),
                )}.`
              : "Pay a 50% deposit to start production, or pay in full."}
          </p>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            {!depositPaid && (
              <form action={startCheckoutAction} className="flex-1">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="mode" value="deposit" />
                <button
                  type="submit"
                  className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Pay 50% deposit
                  <span className="ml-1 text-xs text-slate-500">
                    ({formatCents(Math.round(ctx.proposal.totalInvestmentCents * 0.5))})
                  </span>
                </button>
              </form>
            )}
            <form action={startCheckoutAction} className="flex-1">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="mode" value="full" />
              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {depositPaid ? "Pay balance" : "Pay in full"}
                <span className="ml-1 text-xs opacity-90">
                  ({formatCents((order?.totalCents ?? ctx.proposal.totalInvestmentCents) - (order?.amountPaidCents ?? 0))})
                </span>
              </button>
            </form>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            Secure checkout by Stripe. HomeReach never sees or stores your card.
          </p>
        </section>
      )}

      {/* Status panels */}
      {fullyPaid && (
        <Notice variant="success">
          Paid in full. We&apos;ll be in touch with the production schedule and proofs.
        </Notice>
      )}

      {isDeclined && (
        <Notice variant="neutral">
          This plan was declined. Reach out to HomeReach if you&apos;d like to revise it.
        </Notice>
      )}

      {isExpired && (
        <Notice variant="neutral">
          This plan has expired. Contact HomeReach for an updated quote.
        </Notice>
      )}

      <footer className="pt-4 text-center text-xs text-slate-400">
        HomeReach · {new Date().getFullYear()} · home-reach.com
      </footer>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Notice({
  variant,
  children,
}: {
  variant: "success" | "processing" | "error" | "neutral";
  children: React.ReactNode;
}) {
  const cls = {
    success:    "border-emerald-200 bg-emerald-50 text-emerald-900",
    processing: "border-cyan-200 bg-cyan-50 text-cyan-900",
    error:      "border-rose-200 bg-rose-50 text-rose-900",
    neutral:    "border-slate-200 bg-slate-50 text-slate-700",
  }[variant];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
  );
}

function ExpiredOrMissing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-16 text-center">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">HomeReach</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">This link is no longer available.</h1>
        <p className="mt-1 text-sm text-slate-600">
          The proposal may have expired or been revoked. Contact HomeReach for an updated quote.
        </p>
      </div>
    </div>
  );
}
