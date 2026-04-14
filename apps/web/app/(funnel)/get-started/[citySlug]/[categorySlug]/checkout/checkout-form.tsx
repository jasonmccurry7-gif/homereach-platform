"use client";

import { useState } from "react";
import Link from "next/link";

interface CheckoutFormProps {
  bundleId: string;
  bundleName: string;
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

const ADDONS = [
  {
    id: "design_upgrade",
    name: "Premium Design Upgrade",
    description: "Our creative team builds a fully custom, hand-crafted postcard ad for your business.",
    price: 99,
    recurring: true,
    badge: null,
  },
  {
    id: "rush_launch",
    name: "Rush Launch",
    description: "Skip the line — your campaign goes live within 5 business days instead of 10–14.",
    price: 149,
    recurring: false,
    badge: "One-time",
  },
  {
    id: "nonprofit",
    name: "Sponsor a Local Nonprofit",
    description: "Feature a local nonprofit cause on your ad. We donate $25/mo on your behalf — great for brand image.",
    price: 25,
    recurring: true,
    badge: "Community",
  },
];

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
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  function toggleAddon(id: string) {
    setSelectedAddons(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  // Calculate total
  const addonTotal = ADDONS
    .filter(a => selectedAddons.includes(a.id) && a.recurring)
    .reduce((sum, a) => sum + a.price * 100, 0);
  const oneTimeTotal = ADDONS
    .filter(a => selectedAddons.includes(a.id) && !a.recurring)
    .reduce((sum, a) => sum + a.price * 100, 0);
  const monthlyTotal = resolvedPriceCents + addonTotal;

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
      const res = await fetch("/api/spots/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId,
          cityId,
          categoryId,
          citySlug,
          categorySlug,
          businessName,
          phone: phone || undefined,
          addons: selectedAddons,
          nonprofitId: selectedAddons.includes("nonprofit") ? "local" : null,
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
    <div className="space-y-5">

      {/* ── Business info ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-1">Your business information</h2>
        <p className="text-sm text-gray-500 mb-5">
          Tell us about your business so we can set up your campaign.
        </p>

        {!isAuthenticated && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm mb-5">
            <p className="font-medium text-blue-800">You&apos;ll create an account at checkout</p>
            <p className="mt-0.5 text-blue-700">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/get-started/${citySlug}/${categorySlug}/checkout?bundle=${bundleId}`)}`}
                className="font-semibold underline"
              >
                Already have an account? Sign in
              </Link>
            </p>
          </div>
        )}

        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
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
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone
              <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="(330) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </form>
      </div>

      {/* ── Add-ons ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-1">Boost your campaign</h2>
        <p className="text-sm text-gray-500 mb-4">Optional add-ons — add them now or skip.</p>

        <div className="space-y-3">
          {ADDONS.map((addon) => {
            const selected = selectedAddons.includes(addon.id);
            return (
              <button
                key={addon.id}
                type="button"
                onClick={() => toggleAddon(addon.id)}
                className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all ${
                  selected
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{addon.name}</span>
                      {addon.badge && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {addon.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">{addon.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      +${addon.price}
                    </p>
                    <p className="text-xs text-gray-400">
                      {addon.recurring ? "/mo" : "one-time"}
                    </p>
                  </div>
                </div>
                {selected && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Added
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Price summary + CTA ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-600">{bundleName} · {cityName}</span>
            <span className="font-medium">${(resolvedPriceCents / 100).toLocaleString()}/mo</span>
          </div>
          {ADDONS.filter(a => selectedAddons.includes(a.id)).map(addon => (
            <div key={addon.id} className="flex justify-between text-gray-500">
              <span>{addon.name}</span>
              <span>+${addon.price}{addon.recurring ? "/mo" : " once"}</span>
            </div>
          ))}
          {isFoundingPrice && (
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold pt-1">
              <span>🎉</span> Founding rate applied
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-gray-900">
            <span>Monthly total</span>
            <span>${(monthlyTotal / 100).toLocaleString()}/mo</span>
          </div>
          {oneTimeTotal > 0 && (
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Due today (one-time)</span>
              <span>${(oneTimeTotal / 100).toLocaleString()}</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          form="checkout-form"
          disabled={loading || !businessName.trim()}
          className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Taking you to checkout…
            </span>
          ) : (
            `Continue to payment → $${(monthlyTotal / 100).toLocaleString()}/mo`
          )}
        </button>

        <p className="mt-3 text-center text-xs text-gray-400">
          Secure Stripe checkout · Card details never stored on our servers
        </p>
      </div>
    </div>
  );
}
