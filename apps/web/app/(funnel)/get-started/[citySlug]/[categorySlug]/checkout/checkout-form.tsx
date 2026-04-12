"use client";

import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Add-on Catalog — DISABLED FOR LAUNCH (v2 feature)
//
// Add-ons require end-to-end Stripe line-item support, a DB addon_purchases
// table, and webhook handling before they can be safely offered. The catalog
// is preserved here for reference but NOT rendered in the UI. All state,
// calculations, and Stripe wiring will be added in a dedicated v2 sprint.
//
// DO NOT re-enable this section until the following are complete:
//   1. CheckoutSchema in /api/spots/checkout accepts addons[]
//   2. createSubscriptionCheckoutSession passes line items to Stripe
//   3. Webhook stores addonSlugs on spot_assignment activation
//   4. Business dashboard displays purchased add-ons
// ─────────────────────────────────────────────────────────────────────────────

interface CheckoutFormProps {
  bundleId: string;
  bundleName: string;
  /** Authoritative price from pricing engine (cents). NEVER use bundle.price here. */
  resolvedPriceCents: number;
  isFoundingPrice?: boolean;
  cityId: string;
  cityName: string;
  categoryId: string;
  categoryName: string;
  citySlug: string;
  categorySlug: string;
  isAuthenticated: boolean;
  userEmail: string | null;
}

export function CheckoutForm({
  bundleId,
  bundleName,
  resolvedPriceCents,
  isFoundingPrice = false,
  cityId,
  cityName,
  categoryId,
  categoryName,
  citySlug,
  categorySlug,
  isAuthenticated,
  userEmail,
}: CheckoutFormProps) {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail]               = useState(userEmail ?? "");
  const [phone, setPhone]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isAuthenticated) {
      const returnUrl = encodeURIComponent(
        `/get-started/${citySlug}/${categorySlug}/checkout?bundle=${bundleId}`
      );
      window.location.href = `/signup?redirect=${returnUrl}`;
      return;
    }

    try {
      // NOTE: /api/spots/checkout creates a pending spot_assignment then returns
      // a Stripe subscription checkout URL. This is the correct path for the
      // shared postcard product — subscription mode, not one-time payment.
      const res = await fetch("/api/spots/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId,
          categoryId,
          spotType:               "anchor",
          businessName,
          phone:                  phone || undefined,
          // User must acknowledge the 3-month commitment to proceed
          commitmentAcknowledged: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">

      {/* ── Business info ── */}
      <div>
        <h2 className="font-bold text-gray-900 mb-1">Your business information</h2>
        <p className="text-sm text-gray-500">
          Tell us a bit about your business so we can set up your campaign.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
          <p className="font-medium text-blue-800">You&apos;ll create an account at checkout</p>
          <p className="mt-0.5 text-blue-700">
            Your account gives you access to your campaign dashboard and results.{" "}
            <Link
              href={`/login?redirect=${encodeURIComponent(`/get-started/${citySlug}/${categorySlug}/checkout?bundle=${bundleId}`)}`}
              className="font-semibold underline"
            >
              Already have one? Sign in
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
            Business name <span className="text-red-500">*</span>
          </label>
          <input
            id="businessName"
            type="text"
            required
            placeholder={`Your ${categoryName.toLowerCase()} business name`}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@yourbusiness.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isAuthenticated && !!userEmail}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
          {isAuthenticated && (
            <p className="mt-1 text-xs text-gray-400">Signed in as {email}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone number
            <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="(512) 555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* ── Order summary ─────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium text-gray-700">{bundleName}</span>
              <span className="mx-1 text-gray-400">·</span>
              <span className="text-gray-500">{cityName}</span>
            </div>
            <div className="flex items-center gap-2">
              {isFoundingPrice && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                  Founding rate
                </span>
              )}
              <span className="font-medium text-gray-700">
                ${(resolvedPriceCents / 100).toLocaleString()}/mo
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-2">
            <span className="text-sm font-bold text-gray-800">Monthly total</span>
            <span className="text-sm font-bold text-gray-900">
              ${(resolvedPriceCents / 100).toLocaleString()}/mo
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !businessName.trim()}
          className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
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
            `Continue to payment → $${(resolvedPriceCents / 100).toLocaleString()}/mo`
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          You&apos;ll be redirected to Stripe&apos;s secure checkout page.
          Your card details are never stored on our servers.
        </p>
      </form>
    </div>
  );
}
