import type { Metadata } from "next";
import Link from "next/link";
import Stripe from "stripe";

// ─────────────────────────────────────────────────────────────────────────────
// /checkout/success
//
// Confirmation page for the shared-postcard subscription flow. Reached after
// Stripe redirects from a successful Checkout Session created by
// /api/spots/checkout (success_url = /checkout/success?session_id=...).
//
// This page is purely informational — it does NOT activate the spot or
// generate the intake link. The Stripe webhook (customer.subscription.created)
// is the authoritative source for both. This page reassures the customer
// that payment landed and points them to their email for the intake link.
//
// Owner: Hotfix — fills the gap where customers were hitting 404 after pay.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Payment Confirmed — HomeReach",
  description: "Your HomeReach campaign payment is confirmed.",
};

export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    })
  : null;

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  let businessName: string | null = null;
  let paymentReceived = false;
  let processing = false;

  if (sessionId && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      paymentReceived = session.payment_status === "paid";
      processing = session.payment_status === "unpaid" || session.status === "open";
      const meta = session.metadata ?? {};
      businessName = (meta.businessName as string | undefined) ?? null;
    } catch (err) {
      // Don't fail the page — payment may still be valid; webhook is the
      // authoritative source. Just show generic confirmation copy.
      console.warn("[checkout/success] could not retrieve session:", err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {processing ? "Payment processing..." : "Payment confirmed!"}
        </h1>
        <p className="mt-3 text-gray-500">
          {businessName
            ? `Welcome to HomeReach, ${businessName}. Your spot is reserved.`
            : "Your spot is reserved and your campaign is officially in motion."}
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-left space-y-4">
          <h2 className="font-bold text-gray-900">What happens next</h2>
          {[
            {
              icon: "📧",
              title: "Check your email (5 minutes)",
              body: "We just sent your intake form link. Look for a message from HomeReach. Check spam if it doesn't arrive within 5 minutes.",
            },
            {
              icon: "📝",
              title: "5-minute intake form",
              body: "Tell us about your business — service area, target customers, your key offer, and what makes you different. This shapes your campaign.",
            },
            {
              icon: "🎨",
              title: "Custom design preview (2–3 business days)",
              body: "We'll send a custom postcard preview for your approval. One click to approve, or request a change.",
            },
            {
              icon: "📬",
              title: "Mailed to your homes",
              body: "Once approved, we print, stamp, and deliver. Your campaign goes live across your category and city — exclusive to you.",
            },
          ].map((step) => (
            <div key={step.title} className="flex gap-3">
              <div className="text-2xl leading-none mt-0.5">{step.icon}</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Didn&rsquo;t get the email within 5 minutes? Reach us at{" "}
          <a href="mailto:jason@home-reach.com" className="text-blue-600 underline">
            jason@home-reach.com
          </a>{" "}
          or call{" "}
          <a href="tel:+13303044916" className="text-blue-600 underline">
            (330) 304-4916
          </a>
          .
        </p>

        {processing && (
          <p className="mt-4 text-xs text-gray-400">
            Your payment is still processing on Stripe&rsquo;s side. You&rsquo;ll get the
            intake email within a few minutes once it confirms.
          </p>
        )}

        {!sessionId && (
          <p className="mt-4 text-xs text-gray-400">
            (Session reference not found — if you just paid, your confirmation email is on the way.)
          </p>
        )}

        {paymentReceived && (
          <p className="sr-only" data-testid="checkout-success-paid">
            Payment received
          </p>
        )}

        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-400 underline"
        >
          Return to HomeReach
        </Link>
      </div>
    </div>
  );
}
