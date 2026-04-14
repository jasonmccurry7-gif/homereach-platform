"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ── Shared add-on catalog (same as spot checkout) ──────────────────────────────
const ADDONS = [
  { id: "door_hangers",    name: "Door Hangers (500)",      desc: "500 door hangers for local distribution.",                         price: 400,  unit: "500 @ $0.80 ea", recurring: false, icon: "🚪" },
  { id: "fliers",          name: "Fliers (500)",            desc: "500 full-color fliers for events and bulletin boards.",             price: 125,  unit: "500 @ $0.25 ea", recurring: false, icon: "📄" },
  { id: "yard_signs",      name: "Yard Signs (10)",         desc: "10 branded yard signs with stakes.",                                price: 300,  unit: "10 @ $30 ea",    recurring: false, icon: "🪧" },
  { id: "business_cards",  name: "Business Cards (500)",    desc: "500 premium business cards, professionally designed.",             price: 100,  unit: "500 @ $0.20 ea", recurring: false, icon: "🪪" },
  { id: "website_design",  name: "Website Design & Hosting",desc: "Mobile-friendly website with hosting and ongoing updates.",        price: 97,   unit: "/mo",            recurring: true,  icon: "🌐", badge: "Popular" },
  { id: "sms_automation",  name: "SMS Follow-Up Automation",desc: "Automated text sequences that follow up with every lead.",         price: 49,   unit: "/mo",            recurring: true,  icon: "📱" },
  { id: "email_automation",name: "Email Automation",        desc: "Drip email sequences that nurture leads until they're ready.",     price: 49,   unit: "/mo",            recurring: true,  icon: "📧" },
  { id: "full_automation", name: "Full Automation Bundle",  desc: "SMS + Email automation together — convert postcard leads automatically.", price: 79, unit: "/mo", recurring: true, icon: "🤖", badge: "Best Value" },
  { id: "nonprofit",       name: "Sponsor a Local Nonprofit",desc: "Feature a nonprofit on your campaign — $25/mo donated.",        price: 25,   unit: "/mo",            recurring: true,  icon: "❤️", badge: "Community" },
];

const BADGE_STYLES: Record<string, string> = {
  "Popular":    "bg-blue-100 text-blue-700",
  "Best Value": "bg-amber-100 text-amber-700",
  "Community":  "bg-emerald-100 text-emerald-700",
};

function TargetedCheckoutInner() {
  const searchParams = useSearchParams();
  const campaignId   = searchParams.get("campaign");
  const cancelled    = searchParams.get("cancelled") === "true";

  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(
    cancelled ? "Your payment was cancelled. Click below to try again." : null
  );
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  if (!campaignId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Campaign not found</h1>
          <p className="mt-2 text-gray-500">Please go back and fill out the intake form again.</p>
          <a href="/targeted/start" className="mt-4 inline-block text-blue-600 underline">Start Over</a>
        </div>
      </div>
    );
  }

  function toggleAddon(id: string) {
    if (id === "full_automation") {
      setSelectedAddons(prev => {
        const without = prev.filter(a => a !== "sms_automation" && a !== "email_automation");
        return without.includes("full_automation")
          ? without.filter(a => a !== "full_automation")
          : [...without, "full_automation"];
      });
      return;
    }
    if ((id === "sms_automation" || id === "email_automation") && selectedAddons.includes("full_automation")) return;
    setSelectedAddons(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  const BASE_PRICE = 400;
  const selectedItems   = ADDONS.filter(a => selectedAddons.includes(a.id));
  const oneTimeTotal    = selectedItems.filter(a => !a.recurring).reduce((s, a) => s + a.price, 0);
  const monthlyAddons   = selectedItems.filter(a => a.recurring).reduce((s, a) => s + a.price, 0);
  const todayTotal      = BASE_PRICE + oneTimeTotal;

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/targeted-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, addons: selectedAddons }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Payment setup failed."); setLoading(false); return; }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Step 3 of 3</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Complete Your Campaign</h1>
          <p className="mt-2 text-gray-500">Review your order and add optional extras below.</p>
        </div>

        <div className="space-y-5">
          {/* Order summary */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
              {[
                ["Product", "Targeted Route Campaign"],
                ["Homes reached", "~500 homes"],
                ["Design", "Included"],
                ["Print + postage", "Included"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className={`font-medium ${v === "Included" ? "text-green-600" : ""}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-1">Add more to your campaign</h2>
            <p className="text-sm text-gray-500 mb-5">Supercharge your results with print, digital, and automation products.</p>
            <div className="space-y-2">
              {ADDONS.map(addon => {
                const selected = selectedAddons.includes(addon.id);
                const covered  = (addon.id === "sms_automation" || addon.id === "email_automation") && selectedAddons.includes("full_automation");
                return (
                  <button key={addon.id} type="button"
                    onClick={() => !covered && toggleAddon(addon.id)}
                    disabled={covered}
                    className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all ${
                      covered ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                        : selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-xl shrink-0 mt-0.5">{addon.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{addon.name}</span>
                            {addon.badge && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_STYLES[addon.badge] ?? ""}`}>{addon.badge}</span>}
                            {covered && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Included in bundle</span>}
                          </div>
                          <p className="text-xs text-gray-500 leading-snug">{addon.desc}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">+${addon.price}</p>
                        <p className="text-xs text-gray-400">{addon.unit}</p>
                      </div>
                    </div>
                    {selected && !covered && (
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

          {/* Price + CTA */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {error && (
              <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                cancelled ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-red-200 bg-red-50 text-red-700"
              }`}>{error}</div>
            )}

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-600">Targeted Route Campaign</span>
                <span className="font-medium">${BASE_PRICE}</span>
              </div>
              {selectedItems.map(a => (
                <div key={a.id} className="flex justify-between text-gray-500">
                  <span className="flex items-center gap-1.5"><span>{a.icon}</span>{a.name}</span>
                  <span>+${a.price}{a.unit.startsWith("/") ? a.unit : ""}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-gray-900">
                <span>Due today</span>
                <span>${todayTotal}</span>
              </div>
              {monthlyAddons > 0 && (
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>Monthly add-ons (billed next month)</span>
                  <span>+${monthlyAddons}/mo</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t border-gray-100 pt-4 mb-5">
              {["🔒 Secure Stripe checkout", "🏦 We never store your card", "✅ Design preview before anything mails"].map(s => (
                <p key={s} className="text-xs text-gray-500">{s}</p>
              ))}
            </div>

            <button onClick={handlePay} disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Taking you to checkout…
                </span>
              ) : `Pay $${todayTotal} → Start My Campaign`}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">You'll be redirected to Stripe's secure checkout.</p>
          </div>
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
