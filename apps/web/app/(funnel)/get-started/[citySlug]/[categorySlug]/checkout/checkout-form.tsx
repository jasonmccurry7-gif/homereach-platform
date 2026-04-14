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

// ── Add-on catalog ────────────────────────────────────────────────────────────

type AddonCategory = "print" | "digital" | "automation" | "bundle";

const ADDONS: {
  id: string;
  category: AddonCategory;
  name: string;
  description: string;
  price: number;
  unit: string;
  recurring: boolean;
  badge?: string;
  icon: string;
}[] = [
  // ── Print Products ──────────────────────────────────────────────────────────
  {
    id: "door_hangers",
    category: "print",
    name: "Door Hangers",
    description: "500 professionally designed door hangers distributed in your target area.",
    price: 197,
    unit: "per run",
    recurring: false,
    icon: "🚪",
  },
  {
    id: "fliers",
    category: "print",
    name: "Fliers",
    description: "500 full-color fliers — great for events, bulletin boards, and local distribution.",
    price: 97,
    unit: "per run",
    recurring: false,
    icon: "📄",
  },
  {
    id: "yard_signs",
    category: "print",
    name: "Yard Signs",
    description: "10 branded yard signs with stakes. Perfect for job sites, events, and neighborhoods.",
    price: 147,
    unit: "per order",
    recurring: false,
    icon: "🪧",
  },
  {
    id: "business_cards",
    category: "print",
    name: "Business Cards",
    description: "500 premium business cards, professionally designed and printed.",
    price: 79,
    unit: "per order",
    recurring: false,
    icon: "🪪",
  },
  // ── Digital ─────────────────────────────────────────────────────────────────
  {
    id: "website_design",
    category: "digital",
    name: "Website Design",
    description: "A clean, mobile-friendly website built for your business. Includes hosting and updates.",
    price: 97,
    unit: "/mo",
    recurring: true,
    badge: "Popular",
    icon: "🌐",
  },
  // ── Automation ───────────────────────────────────────────────────────────────
  {
    id: "sms_automation",
    category: "automation",
    name: "SMS Follow-Up Automation",
    description: "Automated text sequences follow up with every lead from your postcard campaign.",
    price: 49,
    unit: "/mo",
    recurring: true,
    badge: "New",
    icon: "📱",
  },
  {
    id: "email_automation",
    category: "automation",
    name: "Email Automation",
    description: "Drip email sequences nurture postcard leads until they're ready to buy.",
    price: 49,
    unit: "/mo",
    recurring: true,
    icon: "📧",
  },
  {
    id: "full_automation",
    category: "automation",
    name: "Full Automation Bundle",
    description: "SMS + Email automation together. Our system contacts, follows up, and converts leads automatically.",
    price: 79,
    unit: "/mo",
    recurring: true,
    badge: "Best Value",
    icon: "🤖",
  },
  // ── Nonprofit Sponsorship ────────────────────────────────────────────────────
  {
    id: "nonprofit",
    category: "bundle",
    name: "Sponsor a Local Nonprofit",
    description: "Feature a local nonprofit cause on your ad. We donate $25/mo on your behalf — great for community goodwill.",
    price: 25,
    unit: "/mo",
    recurring: true,
    badge: "Community",
    icon: "❤️",
  },
];

const CATEGORY_LABELS: Record<AddonCategory, string> = {
  print:      "Print Products",
  digital:    "Digital",
  automation: "Marketing Automation",
  bundle:     "Community & Bundles",
};

const CATEGORY_ORDER: AddonCategory[] = ["print", "digital", "automation", "bundle"];

const BADGE_STYLES: Record<string, string> = {
  "Popular":    "bg-blue-100 text-blue-700",
  "New":        "bg-purple-100 text-purple-700",
  "Best Value": "bg-amber-100 text-amber-700",
  "Community":  "bg-emerald-100 text-emerald-700",
};

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
    // full_automation replaces individual sms/email automation
    if (id === "full_automation") {
      setSelectedAddons(prev => {
        const without = prev.filter(a => a !== "sms_automation" && a !== "email_automation");
        return without.includes("full_automation")
          ? without.filter(a => a !== "full_automation")
          : [...without, "full_automation"];
      });
      return;
    }
    if ((id === "sms_automation" || id === "email_automation") && selectedAddons.includes("full_automation")) {
      return; // already covered by bundle
    }
    setSelectedAddons(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  // Calculate totals
  const selectedItems = ADDONS.filter(a => selectedAddons.includes(a.id));
  const monthlyAddons  = selectedItems.filter(a => a.recurring).reduce((s, a) => s + a.price * 100, 0);
  const oneTimeAddons  = selectedItems.filter(a => !a.recurring).reduce((s, a) => s + a.price * 100, 0);
  const monthlyTotal   = resolvedPriceCents + monthlyAddons;

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

      {/* ── Business info ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-1">Your business information</h2>
        <p className="text-sm text-gray-500 mb-5">Tell us about your business to get started.</p>

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
            <input id="businessName" type="text" required
              placeholder={`Your ${categoryName.toLowerCase()} business name`}
              value={businessName} onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address <span className="text-red-500">*</span>
            </label>
            <input id="email" type="email" required placeholder="you@yourbusiness.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={isAuthenticated && !!userEmail}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input id="phone" type="tel" placeholder="(330) 555-0100"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </form>
      </div>

      {/* ── Add-ons ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-gray-900 mb-1">Add more to your campaign</h2>
        <p className="text-sm text-gray-500 mb-5">
          Supercharge your results with print, digital, and automation products.
        </p>

        <div className="space-y-6">
          {CATEGORY_ORDER.map(cat => {
            const items = ADDONS.filter(a => a.category === cat);
            return (
              <div key={cat}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="space-y-2">
                  {items.map(addon => {
                    const selected = selectedAddons.includes(addon.id);
                    const coveredByBundle = (addon.id === "sms_automation" || addon.id === "email_automation")
                      && selectedAddons.includes("full_automation");
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => !coveredByBundle && toggleAddon(addon.id)}
                        disabled={coveredByBundle}
                        className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all ${
                          coveredByBundle
                            ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                            : selected
                              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-xl shrink-0 mt-0.5">{addon.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{addon.name}</span>
                                {addon.badge && (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_STYLES[addon.badge] ?? "bg-gray-100 text-gray-600"}`}>
                                    {addon.badge}
                                  </span>
                                )}
                                {coveredByBundle && (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                    Included in bundle
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 leading-snug">{addon.description}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900">+${addon.price}</p>
                            <p className="text-xs text-gray-400">{addon.unit}</p>
                          </div>
                        </div>
                        {selected && !coveredByBundle && (
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
            );
          })}
        </div>
      </div>

      {/* ── Price summary + CTA ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-gray-600">{bundleName} · {cityName}</span>
            <span className="font-medium">${(resolvedPriceCents / 100).toLocaleString()}/mo</span>
          </div>
          {selectedItems.map(addon => (
            <div key={addon.id} className="flex justify-between text-gray-500">
              <span className="flex items-center gap-1.5">
                <span>{addon.icon}</span> {addon.name}
              </span>
              <span>+${addon.price}{addon.unit}</span>
            </div>
          ))}
          {isFoundingPrice && (
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold pt-1">
              🎉 Founding rate applied
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-3 font-bold text-gray-900">
            <span>Monthly total</span>
            <span>${(monthlyTotal / 100).toLocaleString()}/mo</span>
          </div>
          {oneTimeAddons > 0 && (
            <div className="flex justify-between text-gray-500 text-xs">
              <span>One-time charges today</span>
              <span>+${(oneTimeAddons / 100).toLocaleString()}</span>
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
