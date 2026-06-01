"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CheckoutFormProps {
  bundleId: string;
  bundleName: string;
  bundlePrice: string;
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
  bundlePrice,
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
  const [email, setEmail] = useState(userEmail ?? "");
  const [phone, setPhone] = useState("");
  const [approvalAccepted, setApprovalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftKey = `homereach:shared-checkout:${citySlug}:${categorySlug}:${bundleId}`;

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(draftKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as {
        businessName?: string;
        email?: string;
        phone?: string;
      };
      if (draft.businessName) setBusinessName(draft.businessName);
      if (!userEmail && draft.email) setEmail(draft.email);
      if (draft.phone) setPhone(draft.phone);
    } catch {
      // Ignore malformed local drafts; checkout can continue normally.
    }
  }, [draftKey, userEmail]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        draftKey,
        JSON.stringify({ businessName, email, phone }),
      );
    } catch {
      // Session storage is a convenience only.
    }
  }, [businessName, draftKey, email, phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // If not authenticated, redirect to signup with return URL
    if (!isAuthenticated) {
      try {
        window.sessionStorage.setItem(
          draftKey,
          JSON.stringify({ businessName, email, phone }),
        );
      } catch {
        // Session storage is a convenience only.
      }
      const returnUrl = encodeURIComponent(
        `/get-started/${citySlug}/${categorySlug}/checkout?bundle=${bundleId}`
      );
      window.location.href = `/signup?redirect=${returnUrl}`;
      return;
    }

    try {
      if (!approvalAccepted) {
        setError("Please acknowledge the shared postcard terms before payment.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/spots/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId,
          businessName,
          phone,
          cityId,
          categoryId,
          citySlug,
          categorySlug,
          addons: [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      if (!data.checkoutUrl) {
        setError("Checkout could not be created. Please try again.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-bold text-gray-900">Your business information</h2>
      <p className="mb-6 text-sm text-gray-500">
        Tell us a bit about your business so we can set up your campaign.
      </p>

      {!isAuthenticated && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
          <p className="font-medium text-blue-800">You&apos;ll create an account at checkout</p>
          <p className="mt-0.5 text-blue-700">
            Your account gives you access to your campaign dashboard and results.{" "}
            <Link href={`/login?redirect=${encodeURIComponent(`/get-started/${citySlug}/${categorySlug}/checkout?bundle=${bundleId}`)}`} className="font-semibold underline">
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
            autoComplete="organization"
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
            autoComplete="email"
            inputMode="email"
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
            autoComplete="tel"
            inputMode="tel"
            placeholder="(512) 555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div>
            <span className="font-medium text-gray-700">{bundleName}</span>
            <span className="mx-1 text-gray-400">|</span>
            <span className="text-gray-500">{cityName}</span>
          </div>
          <span className="font-bold text-gray-900">
            ${Number(bundlePrice).toLocaleString()}/mo
          </span>
        </div>

        <label className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
          <input
            type="checkbox"
            checked={approvalAccepted}
            onChange={(event) => setApprovalAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            I understand HomeReach will recheck city/category availability at checkout, prepare a proof for approval before print, and that shared postcard visibility does not guarantee leads, calls, sales, delivery dates beyond vendor/USPS estimates, or category exclusivity unless the inventory check passes.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !businessName.trim() || !email.trim() || !approvalAccepted}
          className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Taking you to checkout...
            </span>
          ) : (
            `Continue to payment - $${Number(bundlePrice).toLocaleString()}/mo`
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
