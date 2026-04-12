"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function TargetedCheckoutInner() {
  const searchParams = useSearchParams();
  const campaignId  = searchParams.get("campaign");
  const cancelled   = searchParams.get("cancelled") === "true";

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(cancelled ? "Your payment was cancelled. Click below to try again." : null);

  if (!campaignId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Campaign not found</h1>
          <p className="mt-2 text-gray-500">
            Please go back and fill out the intake form again.
          </p>
          <a href="/targeted/start" className="mt-4 inline-block text-blue-600 underline">
            Start Over
          </a>
        </div>
      </div>
    );
  }

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/targeted-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Payment setup failed. Please try again.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Step 3 of 3
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Complete Payment
          </h1>
          <p className="mt-2 text-gray-500">
            One payment to get your campaign started.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {error && (
            <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${cancelled ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-red-200 bg-red-50 text-red-700"}`}>
              {error}
            </div>
          )}

          {/* Order Summary */}
          <div className="space-y-3 mb-6">
            <h2 className="font-bold text-gray-900">Order Summary</h2>

            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Product</span>
                <span className="font-medium">Targeted Route Campaign</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Homes reached</span>
                <span className="font-medium">~500 homes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Design</span>
                <span className="font-medium text-green-600">Included</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Print + postage</span>
                <span className="font-medium text-green-600">Included</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Total today</span>
                <span className="text-2xl font-bold text-gray-900">$400</span>
              </div>
              <p className="text-right text-xs text-gray-400 mt-0.5">One-time payment</p>
            </div>
          </div>

          {/* Trust signals */}
          <div className="space-y-1.5 border-t border-gray-100 pt-4 mb-5">
            {[
              "🔒 Secure Stripe checkout",
              "🏦 We never store your card",
              "📬 Campaign launches within 10–14 days",
              "✅ Design preview before anything mails",
            ].map((s) => (
              <p key={s} className="text-xs text-gray-500">{s}</p>
            ))}
          </div>

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Taking you to checkout…
              </span>
            ) : (
              "Pay $400 → Start My Campaign"
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            You'll be redirected to Stripe's secure checkout page.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TargetedCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <TargetedCheckoutInner />
    </Suspense>
  );
}
