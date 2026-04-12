"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Targeted Campaign Pricing Tiers
//
// Cost basis: ~$0.25 print + ~$0.25 postage = ~$0.50/piece
// Minimum sell price: $0.70/piece (40% gross margin minimum)
// ─────────────────────────────────────────────────────────────────────────────

const PRICING_TIERS = [
  {
    homes: 500,
    perPieceCents: 80,     // $0.80/piece — 37.5% margin
    label: "Starter",
    description: "Perfect for local storefronts or tight radius targeting",
  },
  {
    homes: 1000,
    perPieceCents: 77,     // $0.77/piece — ~39% margin
    label: "Growth",
    description: "Ideal for service businesses covering a few neighborhoods",
  },
  {
    homes: 2500,
    perPieceCents: 73,     // $0.73/piece — ~42% margin
    label: "Reach",
    description: "Full zip code or multi-neighborhood coverage",
    popular: true,
  },
  {
    homes: 5000,
    perPieceCents: 70,     // $0.70/piece — ~44% margin
    label: "Scale",
    description: "City-wide saturation and high-frequency visibility",
  },
];

function totalCents(tier: typeof PRICING_TIERS[0]) {
  return tier.homes * tier.perPieceCents;
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function IntakeFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token  = searchParams.get("token") ?? undefined;
  const leadId = searchParams.get("lead")  ?? undefined;

  const [selectedTier, setSelectedTier] = useState<typeof PRICING_TIERS[0]>(PRICING_TIERS[0]);
  const [orgType, setOrgType] = useState<"business" | "nonprofit">("business");
  const [form, setForm] = useState({
    businessName:    "",
    contactName:     "",
    email:           "",
    phone:           "",
    businessAddress: "",
    targetCity:      "",
    targetAreaNotes: "",
    notes:           "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/targeted/intake", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeToken:     token,
          leadId,
          businessName:    form.businessName,
          contactName:     form.contactName   || undefined,
          email:           form.email,
          phone:           form.phone         || undefined,
          businessAddress: form.businessAddress || undefined,
          targetCity:      form.targetCity    || undefined,
          targetAreaNotes: form.targetAreaNotes,
          notes:           form.notes         || undefined,
          homesCount:      selectedTier.homes,
          priceCents:      totalCents(selectedTier),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Nonprofits go to the verification page first
      if (orgType === "nonprofit") {
        const params = new URLSearchParams({
          ...(form.businessName && { orgName: form.businessName }),
          ...(form.contactName  && { contactName: form.contactName }),
          ...(form.email        && { email: form.email }),
          ...(form.phone        && { phone: form.phone }),
          ...(form.targetCity   && { city: form.targetCity }),
        });
        router.push(`/nonprofit?${params.toString()}`);
        return;
      }

      router.push(`/targeted/checkout?campaign=${data.campaign.id}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  const total = totalCents(selectedTier);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Step 2 of 3
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Campaign Setup
          </h1>
          <p className="mt-2 text-gray-500">
            Direct mail sent to homeowners around <em>your</em> business or any U.S. city.
          </p>
        </div>

        {/* Product distinction banner */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Targeted Campaign</strong> — You choose the geography. Postcards go only to the exact area you want.
          Unlike our shared postcard product, you are not limited to pre-set cities and your reach is completely flexible.
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── PRICING CALCULATOR ────────────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Choose Your Reach
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                All prices include design, printing, postage, and delivery.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRICING_TIERS.map((tier) => {
                  const isSelected = tier.homes === selectedTier.homes;
                  return (
                    <button
                      key={tier.homes}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`relative flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-1"
                          : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                      }`}
                    >
                      {tier.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                          Most Popular
                        </span>
                      )}
                      <span className="text-xs font-semibold text-gray-500 mt-1">{tier.label}</span>
                      <span className="text-lg font-black text-gray-900 mt-0.5">
                        {tier.homes.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-500">homes</span>
                      <span className="mt-1.5 text-sm font-bold text-blue-700">
                        {formatDollars(totalCents(tier))}/mo
                      </span>
                      <span className="text-[10px] text-gray-400">
                        ${(tier.perPieceCents / 100).toFixed(2)}/piece
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Live price summary */}
              <div className="mt-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {selectedTier.homes.toLocaleString()} homes · ${(selectedTier.perPieceCents / 100).toFixed(2)}/piece
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">{selectedTier.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-blue-900">{formatDollars(total)}<span className="text-sm font-medium">/mo</span></p>
                    <p className="text-[10px] text-blue-600">Design + Print + Postage included</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* ── BUSINESS INFO ─────────────────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Your Organization
              </h3>

              {/* Org type selector */}
              <div className="flex gap-2 mb-3">
                {([
                  { value: "business",  label: "🏢 Business" },
                  { value: "nonprofit", label: "❤️ Nonprofit" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrgType(opt.value)}
                    className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-all ${
                      orgType === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {orgType === "nonprofit" && (
                <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
                  <p className="font-semibold">Nonprofits get special rates 🎉</p>
                  <p className="mt-0.5 text-xs text-green-700">
                    After submitting this form, you&apos;ll also be redirected to our nonprofit
                    verification page to unlock discounted pricing and co-sponsorship visibility.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Business name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      placeholder="Jane's Cleaning Co."
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Your name</label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => update("contactName", e.target.value)}
                      placeholder="Jane Smith"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="jane@yourbusiness.com"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone <span className="text-xs text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="(512) 555-0100"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* ── TARGET AREA ───────────────────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
                Where You Want Customers
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Works in any U.S. city — we map the route around your business or any address you choose.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Business address <span className="text-xs text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.businessAddress}
                      onChange={(e) => update("businessAddress", e.target.value)}
                      placeholder="123 Main St, Austin TX"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      City / Zip <span className="text-xs text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.targetCity}
                      onChange={(e) => update("targetCity", e.target.value)}
                      placeholder="Austin, TX — or 78701"
                      className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Describe the area you want to target <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Neighborhoods, zip codes, radius around your shop — anything specific helps us map it exactly.
                  </p>
                  <textarea
                    required
                    rows={3}
                    value={form.targetAreaNotes}
                    onChange={(e) => update("targetAreaNotes", e.target.value)}
                    placeholder="e.g., The streets within a mile of my shop in South Austin. Homeowners only, not apartments."
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Anything else? <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="e.g., We specialize in deep cleaning. Looking for budget-conscious homeowners."
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={
                loading ||
                !form.businessName.trim() ||
                !form.email.trim() ||
                !form.targetAreaNotes.trim()
              }
              className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Submitting…"
                : orgType === "nonprofit"
                ? "Submit & Apply for Nonprofit Pricing →"
                : `Continue to Payment → ${formatDollars(total)}/mo`}
            </button>

            <p className="text-center text-xs text-gray-400">
              You'll review your order before anything is charged. Secure checkout via Stripe.
            </p>
          </form>
        </div>

        {/* Product comparison callout */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm">
          <h4 className="font-semibold text-gray-700 mb-3">Targeted vs. Shared Postcards</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-blue-700 mb-1">✅ Targeted Campaign (this)</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>→ Any U.S. city, any geography</li>
                <li>→ Direct mail to your exact target area</li>
                <li>→ Flexible volume, per-piece pricing</li>
                <li>→ No exclusivity restrictions</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-600 mb-1">📬 Shared Postcard</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>→ 2,500+ homeowners per select city</li>
                <li>→ One business per category guaranteed</li>
                <li>→ Monthly recurring, flat rate</li>
                <li>→ <a href="/get-started" className="text-blue-600 underline">View available cities →</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TargetedIntakePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <IntakeFormInner />
    </Suspense>
  );
}
