"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CarrierRoute, RoutePricingTier, TargetedCampaign } from "@/lib/engine/types";
import { TargetedRouteEngine, MINIMUM_HOUSEHOLDS } from "@/lib/engine/targeted-routes";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Targeted Route Campaign Builder — 5-step public-facing flow
// Completely separate from shared postcard system.
// ─────────────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { n: 1, label: "Campaign Type",  short: "Type"     },
  { n: 2, label: "Select City",    short: "City"     },
  { n: 3, label: "Select Routes",  short: "Routes"   },
  { n: 4, label: "Review & Price", short: "Review"   },
  { n: 5, label: "Your Details",   short: "Details"  },
] as const;

interface CityOption {
  id: string;
  name: string;
  totalRoutes: number;
  totalHomes: number;
}

interface Props {
  cities: CityOption[];
  allRoutes: CarrierRoute[];
  pricingTiers: RoutePricingTier[];
}

interface ContactForm {
  businessName: string;
  contactName:  string;
  phone:        string;
  email:        string;
  notes:        string;
}

const BLANK_CONTACT: ContactForm = {
  businessName: "",
  contactName:  "",
  phone:        "",
  email:        "",
  notes:        "",
};

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 w-full max-w-2xl mx-auto">
      {STEPS.map((s, i) => {
        const done    = current > s.n;
        const active  = current === s.n;
        return (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                done   ? "bg-blue-600 text-white" :
                active ? "bg-white text-gray-900 ring-2 ring-blue-500" :
                         "bg-gray-800 text-gray-500"
              )}>
                {done ? "✓" : s.n}
              </div>
              <span className={cn(
                "text-xs mt-1 hidden sm:block",
                active ? "text-white font-semibold" : "text-gray-600"
              )}>
                {s.short}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-1 mb-5 transition-all",
                current > s.n ? "bg-blue-600" : "bg-gray-800"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Campaign Type Selection ──────────────────────────────────────────

function StepCampaignType({ onSelect }: { onSelect: (type: "shared" | "targeted") => void }) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Choose Your Campaign Type</h2>
        <p className="text-gray-400">Both options put your business in front of homeowners. Choose based on your goals.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Shared Postcard */}
        <button
          onClick={() => onSelect("shared")}
          className="group text-left p-6 bg-gray-900 border border-gray-700 hover:border-blue-500 rounded-2xl transition-all"
        >
          <div className="text-3xl mb-3">📮</div>
          <h3 className="text-lg font-bold text-white mb-1">Shared Postcard</h3>
          <p className="text-xs text-blue-400 font-semibold mb-3">Exclusive category spot · From $299/mo</p>
          <ul className="space-y-1.5 text-sm text-gray-400">
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> One business per category per city</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> 15,000 homeowners every month</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> Lock out your competitors permanently</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> Monthly recurring campaign</li>
          </ul>
          <div className="mt-4 text-sm font-semibold text-blue-400 group-hover:text-blue-300">
            Select →
          </div>
        </button>

        {/* Targeted Route */}
        <button
          onClick={() => onSelect("targeted")}
          className="group text-left p-6 bg-gray-900 border border-blue-600 hover:border-blue-400 rounded-2xl transition-all relative overflow-hidden"
        >
          <div className="absolute top-3 right-3">
            <span className="text-xs font-bold px-2 py-1 bg-blue-600 text-white rounded-full">PREMIUM</span>
          </div>
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-lg font-bold text-white mb-1">Targeted Route Campaign</h3>
          <p className="text-xs text-blue-400 font-semibold mb-3">You choose exact routes · From $100/campaign</p>
          <ul className="space-y-1.5 text-sm text-gray-400">
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> Pick specific carrier routes</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> Reach 2,500–30,000+ homes</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> Filter by home value & income</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">✓</span> Dedicated postcard — 100% yours</li>
          </ul>
          <div className="mt-4 text-sm font-semibold text-blue-400 group-hover:text-blue-300">
            Build campaign →
          </div>
        </button>
      </div>

      <p className="text-center text-xs text-gray-600">
        Already have a shared spot?{" "}
        <Link href="/get-started" className="text-blue-500 hover:text-blue-400">
          Claim your category here →
        </Link>
      </p>
    </div>
  );
}

// ── Step 2: City Selection ────────────────────────────────────────────────────

function StepSelectCity({
  cities,
  selectedCityId,
  onSelect,
}: {
  cities: CityOption[];
  selectedCityId: string | null;
  onSelect: (cityId: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Choose Your Target City</h2>
        <p className="text-gray-400">Select the market where you want to reach homeowners.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cities.map((city) => (
          <button
            key={city.id}
            onClick={() => onSelect(city.id)}
            className={cn(
              "text-left p-5 rounded-xl border transition-all",
              selectedCityId === city.id
                ? "border-blue-500 bg-blue-900/20"
                : "border-gray-700 bg-gray-900 hover:border-gray-500"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white">{city.name}</h3>
              {selectedCityId === city.id && (
                <span className="text-blue-400 text-lg">✓</span>
              )}
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>{city.totalRoutes} routes available</span>
              <span>{(city.totalHomes / 1_000).toFixed(1)}k homes total</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Route Selection ───────────────────────────────────────────────────

function DemoBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", color)}>
      {children}
    </span>
  );
}

function RouteCard({
  route,
  selected,
  onToggle,
}: {
  route: CarrierRoute;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={!route.available}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all",
        !route.available
          ? "border-gray-800 bg-gray-900/30 opacity-40 cursor-not-allowed"
          : selected
            ? "border-blue-500 bg-blue-900/20"
            : "border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition",
              selected ? "bg-blue-600 border-blue-600" : "border-gray-600"
            )}>
              {selected && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className="text-sm font-semibold text-white truncate">{route.name}</span>
            {!route.available && (
              <span className="text-[10px] text-gray-600 font-medium">Unavailable</span>
            )}
          </div>
          <p className="text-xs text-gray-500 ml-6">{route.routeCode}</p>
          <div className="flex flex-wrap gap-1.5 mt-2 ml-6">
            <DemoBadge color="bg-gray-800 text-gray-400">🏠 {route.demographics.medianHomeValue}</DemoBadge>
            <DemoBadge color="bg-gray-800 text-gray-400">💰 {route.demographics.medianIncome}</DemoBadge>
            <DemoBadge color="bg-gray-800 text-gray-400">👤 {route.demographics.homeownerPct}% own</DemoBadge>
            <DemoBadge color="bg-gray-800 text-gray-400">📅 {route.demographics.primaryAgeGroup}</DemoBadge>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-white">{route.households.toLocaleString()}</p>
          <p className="text-xs text-gray-500">homes</p>
        </div>
      </div>
    </button>
  );
}

function StepSelectRoutes({
  routes,
  selectedIds,
  onToggle,
  summary,
}: {
  routes: CarrierRoute[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  summary: ReturnType<typeof TargetedRouteEngine.summarize>;
}) {
  const callout = TargetedRouteEngine.getPricingCallout(summary.totalHouseholds);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white">Select Your Routes</h2>
        <p className="text-gray-400 text-sm">Choose the mail routes you want your campaign to reach.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Route List — 2/3 */}
        <div className="lg:col-span-2 space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              selected={selectedIds.has(route.id)}
              onToggle={() => onToggle(route.id)}
            />
          ))}
        </div>

        {/* Running Total — 1/3 */}
        <div className="space-y-3 sticky top-4 self-start">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Campaign Reach</h3>

            {/* Homes counter */}
            <div>
              <p className={cn(
                "text-3xl font-bold transition-all",
                summary.isBelowMinimum ? "text-gray-500" : "text-white"
              )}>
                {summary.totalHouseholds.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">homes selected</p>
            </div>

            {/* Minimum bar */}
            {summary.isBelowMinimum ? (
              <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-xl">
                <p className="text-xs font-semibold text-amber-400">
                  {summary.shortfallHomes.toLocaleString()} more homes to reach minimum
                </p>
                <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (summary.totalHouseholds / MINIMUM_HOUSEHOLDS) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  {summary.totalHouseholds.toLocaleString()} / {MINIMUM_HOUSEHOLDS.toLocaleString()} minimum
                </p>
              </div>
            ) : (
              <>
                {/* Pricing tier badge */}
                <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300">{callout.tierLabel}</span>
                    <span className="text-xs text-blue-400">{callout.rateLabel}</span>
                  </div>
                  {callout.nextTierMsg && (
                    <p className="text-[10px] text-gray-500 mt-1">{callout.nextTierMsg}</p>
                  )}
                </div>

                {/* Total price */}
                <div className="border-t border-gray-800 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Campaign Total</span>
                    <span className="text-xl font-bold text-white">
                      {TargetedRouteEngine.formatPrice(summary.totalPrice)}
                    </span>
                  </div>
                  {summary.savingsVsBase > 0 && (
                    <p className="text-xs text-green-400 text-right mt-0.5">
                      Save {TargetedRouteEngine.formatPrice(summary.savingsVsBase)} vs base rate
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Routes count */}
            <div className="text-xs text-gray-600">
              {summary.selectedRoutes.length} route{summary.selectedRoutes.length !== 1 ? "s" : ""} selected
            </div>
          </div>

          {/* Pricing tiers reference */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Volume Pricing</p>
            <div className="space-y-2">
              {[
                { label: "Starter",    range: "2,500–4,999",  rate: "$40" },
                { label: "Growth",     range: "5,000–9,999",  rate: "$37" },
                { label: "Scale",      range: "10k–24,999",   rate: "$34" },
                { label: "Enterprise", range: "25,000+",      rate: "$30" },
              ].map((tier) => {
                const isActive = summary.tier?.label === tier.label;
                return (
                  <div key={tier.label} className={cn(
                    "flex items-center justify-between text-xs px-2 py-1.5 rounded transition",
                    isActive ? "bg-blue-900/30 text-blue-300" : "text-gray-600"
                  )}>
                    <div>
                      <span className="font-semibold">{tier.label}</span>
                      <span className="ml-1.5">{tier.range} homes</span>
                    </div>
                    <span className="font-bold">{tier.rate}/1k</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────────────────────

function StepReview({
  city,
  selectedRoutes,
  summary,
  pricingTiers,
}: {
  city: CityOption;
  selectedRoutes: CarrierRoute[];
  summary: ReturnType<typeof TargetedRouteEngine.summarize>;
  pricingTiers: RoutePricingTier[];
}) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white">Review Your Campaign</h2>
        <p className="text-gray-400 text-sm">Confirm your routes and pricing before continuing.</p>
      </div>

      {/* Hero summary */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-6 text-center">
        <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide mb-1">Targeted Route Campaign</p>
        <p className="text-5xl font-bold text-white">{summary.totalHouseholds.toLocaleString()}</p>
        <p className="text-blue-200 mt-1">homeowners reached · {city.name}</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <div>
            <p className="text-2xl font-bold text-white">{TargetedRouteEngine.formatPrice(summary.totalPrice)}</p>
            <p className="text-xs text-blue-300">campaign total</p>
          </div>
          <div className="w-px h-10 bg-blue-600" />
          <div>
            <p className="text-2xl font-bold text-white">{selectedRoutes.length}</p>
            <p className="text-xs text-blue-300">routes selected</p>
          </div>
          <div className="w-px h-10 bg-blue-600" />
          <div>
            <p className="text-2xl font-bold text-white">{TargetedRouteEngine.formatPrice(summary.pricePerThousand)}</p>
            <p className="text-xs text-blue-300">per 1,000 homes</p>
          </div>
        </div>
        {summary.tier && (
          <div className="mt-3 inline-block text-xs px-3 py-1 bg-blue-600/60 text-blue-200 rounded-full">
            {summary.tier.label} Rate · {summary.tier.description}
          </div>
        )}
      </div>

      {/* Routes breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Selected Routes</h3>
        <div className="space-y-2">
          {selectedRoutes.map((r, i) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div>
                <span className="text-xs text-gray-600 mr-2">{i + 1}.</span>
                <span className="text-sm text-white">{r.name}</span>
                <span className="text-xs text-gray-500 ml-2">{r.routeCode}</span>
              </div>
              <span className="text-sm font-semibold text-gray-300">{r.households.toLocaleString()} homes</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-3 font-bold">
          <span className="text-sm text-white">Total</span>
          <span className="text-sm text-white">{summary.totalHouseholds.toLocaleString()} homes</span>
        </div>
      </div>

      {/* Pricing breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Pricing Breakdown</h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{summary.totalHouseholds.toLocaleString()} households</span>
          <span className="text-gray-300">÷ 1,000</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">× ${summary.pricePerThousand} ({summary.tier?.label ?? "Starter"} rate)</span>
          <span className="text-gray-300">{TargetedRouteEngine.formatPrice(summary.totalPrice)}</span>
        </div>
        {summary.savingsVsBase > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span>Volume discount savings</span>
            <span>−{TargetedRouteEngine.formatPrice(summary.savingsVsBase)}</span>
          </div>
        )}
        <div className="border-t border-gray-700 pt-3 flex justify-between">
          <span className="text-sm font-bold text-white">Campaign Total</span>
          <span className="text-xl font-bold text-white">{TargetedRouteEngine.formatPrice(summary.totalPrice)}</span>
        </div>
        <p className="text-xs text-gray-600">One-time campaign fee. No recurring charges unless you continue.</p>
      </div>
    </div>
  );
}

// ── Step 5: Contact Details ───────────────────────────────────────────────────

function StepContactDetails({
  form,
  onChange,
  onSubmit,
  submitting,
}: {
  form: ContactForm;
  onChange: <K extends keyof ContactForm>(k: K, v: ContactForm[K]) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  function FormField({ label, name, type = "text", placeholder, required }: {
    label: string; name: keyof ContactForm; type?: string; placeholder: string; required?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-400">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={form[name] as string}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white">Your Details</h2>
        <p className="text-gray-400 text-sm">Tell us about your business so we can get your campaign started.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Business Name" name="businessName" placeholder="Harrington Plumbing" required />
          </div>
          <FormField label="Your Name" name="contactName" placeholder="Mike Harrington" required />
          <FormField label="Phone" name="phone" type="tel" placeholder="+1 (330) 555-0100" required />
          <div className="col-span-2">
            <FormField label="Email" name="email" type="email" placeholder="mike@harringtonplumbing.com" required />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400">Additional Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              placeholder="Any special requests, preferred start date, or targeting preferences…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-400">What happens next:</p>
        <p>→ We'll review your campaign and confirm route availability within 1 business day.</p>
        <p>→ You'll receive a campaign summary and invoice via email.</p>
        <p>→ Once approved, your postcards go to print within 5–7 business days.</p>
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting || !form.businessName || !form.email || !form.phone}
        className={cn(
          "w-full py-4 rounded-2xl text-base font-bold transition-all",
          submitting || !form.businessName || !form.email || !form.phone
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        )}
      >
        {submitting ? "Submitting…" : "Submit Campaign →"}
      </button>
    </div>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  campaign,
  contact,
}: {
  campaign: ReturnType<typeof TargetedRouteEngine.summarize>;
  contact: ContactForm;
}) {
  return (
    <div className="text-center space-y-6 max-w-lg mx-auto py-8">
      <div className="w-20 h-20 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center text-4xl mx-auto">
        🎯
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">Campaign Submitted!</h2>
        <p className="text-gray-400 mt-2">
          We've received your targeted route campaign for{" "}
          <span className="text-white font-semibold">{contact.businessName}</span>.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign Summary</p>
        <div className="flex justify-between"><span className="text-gray-500 text-sm">Total reach</span><span className="text-white font-semibold">{campaign.totalHouseholds.toLocaleString()} homes</span></div>
        <div className="flex justify-between"><span className="text-gray-500 text-sm">Routes selected</span><span className="text-white font-semibold">{campaign.selectedRoutes.length} routes</span></div>
        <div className="flex justify-between"><span className="text-gray-500 text-sm">Pricing tier</span><span className="text-white font-semibold">{campaign.tier?.label ?? "Starter"}</span></div>
        <div className="flex justify-between border-t border-gray-800 pt-3"><span className="text-gray-400 font-semibold">Campaign Total</span><span className="text-white font-bold text-lg">{TargetedRouteEngine.formatPrice(campaign.totalPrice)}</span></div>
      </div>

      <p className="text-xs text-gray-500">
        Confirmation sent to <span className="text-gray-300">{contact.email}</span>.
        Our team will be in touch within 1 business day.
      </p>

      <div className="flex gap-3 justify-center">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold transition"
        >
          Back to Home
        </Link>
        <Link
          href="/targeted"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
        >
          Start Another →
        </Link>
      </div>
    </div>
  );
}

// ── Main Builder ──────────────────────────────────────────────────────────────

export function CampaignBuilder({ cities, allRoutes, pricingTiers }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [campaignType, setCampaignType] = useState<"shared" | "targeted" | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(new Set());
  const [contact, setContact] = useState<ContactForm>(BLANK_CONTACT);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedCity = cities.find((c) => c.id === selectedCityId) ?? null;
  const cityRoutes = useMemo(
    () => selectedCityId
      ? allRoutes.filter((r) => r.cityId === selectedCityId && r.available)
      : [],
    [selectedCityId, allRoutes]
  );
  const selectedRoutes = useMemo(
    () => cityRoutes.filter((r) => selectedRouteIds.has(r.id)),
    [cityRoutes, selectedRouteIds]
  );
  const summary = useMemo(
    () => TargetedRouteEngine.summarize(selectedRoutes),
    [selectedRoutes]
  );

  function toggleRoute(id: string) {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleCampaignTypeSelect(type: "shared" | "targeted") {
    setCampaignType(type);
    if (type === "shared") {
      window.location.href = "/get-started";
    } else {
      setStep(2);
    }
  }

  function handleCitySelect(cityId: string) {
    setSelectedCityId(cityId);
    setSelectedRouteIds(new Set());
  }

  function canProceed(): boolean {
    if (step === 2) return selectedCityId !== null;
    if (step === 3) return !summary.isBelowMinimum && summary.totalHouseholds > 0;
    if (step === 4) return true;
    if (step === 5) return !!contact.businessName && !!contact.email && !!contact.phone;
    return false;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/targeted-campaign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          businessName: contact.businessName,
          contactName:  contact.contactName,
          phone:        contact.phone,
          email:        contact.email,
          notes:        contact.notes,
          cityId:       selectedCity?.id,
          cityName:     selectedCity?.name,
          totalHomes:   summary.totalHouseholds,
          totalPrice:   summary.totalPrice,
          routeCount:   summary.selectedRoutes.length,
          tierLabel:    summary.tier?.label,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[CampaignBuilder] Submit failed:", err);
      }
    } catch (err) {
      console.error("[CampaignBuilder] Submit error:", err);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  function updateContact<K extends keyof ContactForm>(k: K, v: ContactForm[K]) {
    setContact((prev) => ({ ...prev, [k]: v }));
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center px-6 py-16">
          <SuccessScreen campaign={summary} contact={contact} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header />

      <div className="flex-1 px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Progress — only show after type selection */}
        {step > 1 && (
          <div className="px-4">
            <ProgressBar current={step} />
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 max-w-5xl mx-auto w-full">
          {step === 1 && (
            <StepCampaignType onSelect={handleCampaignTypeSelect} />
          )}
          {step === 2 && (
            <StepSelectCity
              cities={cities}
              selectedCityId={selectedCityId}
              onSelect={handleCitySelect}
            />
          )}
          {step === 3 && selectedCity && (
            <StepSelectRoutes
              routes={cityRoutes}
              selectedIds={selectedRouteIds}
              onToggle={toggleRoute}
              summary={summary}
            />
          )}
          {step === 4 && selectedCity && (
            <StepReview
              city={selectedCity}
              selectedRoutes={selectedRoutes}
              summary={summary}
              pricingTiers={pricingTiers}
            />
          )}
          {step === 5 && (
            <StepContactDetails
              form={contact}
              onChange={updateContact}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </div>

        {/* Navigation footer — not shown on step 1 or step 5 (submit handles it) */}
        {step > 1 && step < 5 && (
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between px-4 pb-6">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(5, s + 1) as Step)}
              disabled={!canProceed()}
              className={cn(
                "px-8 py-3 rounded-xl font-semibold text-sm transition-all",
                canProceed()
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              )}
            >
              {step === 4 ? "Add Details →" : "Continue →"}
            </button>
          </div>
        )}
        {step === 5 && (
          <div className="max-w-5xl mx-auto w-full px-4 pb-4">
            <button
              onClick={() => setStep(4)}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              ← Back to review
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
            HR
          </div>
          <span className="text-sm font-bold text-white">HomeReach</span>
          <span className="text-xs text-gray-600">· Targeted Campaigns</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/get-started" className="text-xs text-gray-500 hover:text-gray-300 transition">
            Shared Postcard →
          </Link>
        </div>
      </div>
    </header>
  );
}
