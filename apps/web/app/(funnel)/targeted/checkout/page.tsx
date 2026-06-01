"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  FileText,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";

const ClientSuspense = Suspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => React.ReactNode;

type Addon = {
  id:
    | "door_hangers"
    | "fliers"
    | "yard_signs"
    | "business_cards"
    | "website_setup"
    | "website_maintenance"
    | "sms_automation"
    | "email_automation"
    | "full_automation"
    | "nonprofit";
  name: string;
  desc: string;
  price: number;
  unit: string;
  recurring: boolean;
  icon: LucideIcon;
  badge?: "Popular" | "Best Value" | "Community" | "Retention";
};

const ADDONS: Addon[] = [
  {
    id: "full_automation",
    name: "Full Follow-Up Automation",
    desc: "SMS and email follow-up paths for leads generated from the campaign.",
    price: 79,
    unit: "first month; renewal reviewed",
    recurring: true,
    icon: Sparkles,
    badge: "Best Value",
  },
  {
    id: "website_setup",
    name: "Campaign Landing Page Setup",
    desc: "A mobile-friendly page that supports the QR or offer path from the mailer.",
    price: 497,
    unit: "one-time",
    recurring: false,
    icon: Globe2,
    badge: "Popular",
  },
  {
    id: "door_hangers",
    name: "Door Hangers - 500",
    desc: "Add route-level doorstep visibility around the same local push.",
    price: 400,
    unit: "500 included",
    recurring: false,
    icon: DoorOpen,
  },
  {
    id: "yard_signs",
    name: "Yard Signs - 10",
    desc: "Add jobsite and roadside visibility that reinforces the mail campaign.",
    price: 300,
    unit: "10 signs",
    recurring: false,
    icon: Target,
  },
  {
    id: "business_cards",
    name: "Premium Business Cards - 500",
    desc: "Keep the brand handoff consistent after calls, estimates, and visits.",
    price: 105,
    unit: "500 cards",
    recurring: false,
    icon: WalletCards,
  },
  {
    id: "fliers",
    name: "Fliers - 500",
    desc: "Useful for events, counters, bulletin boards, and field-team handoffs.",
    price: 225,
    unit: "500 sheets",
    recurring: false,
    icon: FileText,
  },
  {
    id: "sms_automation",
    name: "SMS Follow-Up Automation",
    desc: "Text sequences for campaign inquiries and missed follow-up moments.",
    price: 49,
    unit: "first month; renewal reviewed",
    recurring: true,
    icon: MessageSquareText,
    badge: "Retention",
  },
  {
    id: "email_automation",
    name: "Email Follow-Up Automation",
    desc: "Email nurture for homeowners who need more time before they book.",
    price: 49,
    unit: "first month; renewal reviewed",
    recurring: true,
    icon: BadgeDollarSign,
    badge: "Retention",
  },
  {
    id: "website_maintenance",
    name: "Website Hosting and Maintenance",
    desc: "Ongoing hosting, support, and updates for the HomeReach-built page.",
    price: 97,
    unit: "first month; renewal reviewed",
    recurring: true,
    icon: ShieldCheck,
  },
  {
    id: "nonprofit",
    name: "Sponsor a Local Nonprofit",
    desc: "Add a community sponsorship element with owner review before use.",
    price: 25,
    unit: "first month; renewal reviewed",
    recurring: true,
    icon: HeartHandshake,
    badge: "Community",
  },
];

const BADGE_STYLES: Record<NonNullable<Addon["badge"]>, string> = {
  Popular: "bg-blue-100 text-blue-700",
  "Best Value": "bg-amber-100 text-amber-800",
  Community: "bg-emerald-100 text-emerald-700",
  Retention: "bg-violet-100 text-violet-700",
};

type CampaignSummary = {
  id: string;
  status: string;
  businessName: string;
  targetCity: string | null;
  homesCount: number;
  priceCents: number;
  eligibleForCheckout: boolean;
  checkoutToken?: string | null;
};

function formatUsd(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function TargetedCheckoutInner() {
  const searchParams = useSearchParams();
  const campaignId = searchParams?.get("campaign");
  const checkoutToken = searchParams?.get("token");
  const cancelled = searchParams?.get("cancelled") === "true";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    cancelled ? "Your payment was cancelled. You can review the plan and try again below." : null,
  );
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [approvalAccepted, setApprovalAccepted] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(Boolean(campaignId || checkoutToken));

  useEffect(() => {
    if (!campaignId && !checkoutToken) return;

    let active = true;
    setSummaryLoading(true);

    const params = new URLSearchParams();
    if (checkoutToken) params.set("token", checkoutToken);
    else if (campaignId) params.set("campaignId", campaignId);

    fetch(`/api/stripe/targeted-checkout?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Campaign summary unavailable.");
        if (active) {
          setCampaignSummary(data.campaign);
          if (!data.campaign?.eligibleForCheckout) {
            setError("This campaign is not currently eligible for checkout.");
          }
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Campaign summary unavailable.");
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [campaignId, checkoutToken]);

  if (!campaignId && !checkoutToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.08] p-6 text-center">
          <h1 className="text-xl font-black">Campaign not found</h1>
          <p className="mt-2 text-sm text-slate-300">Please go back and fill out the campaign builder again.</p>
          <Link href="/targeted/start" className="mt-5 inline-flex text-sm font-bold text-blue-200 underline">
            Start over
          </Link>
        </div>
      </div>
    );
  }

  function toggleAddon(id: string) {
    if (id === "full_automation") {
      setSelectedAddons((prev) => {
        const without = prev.filter((addon) => addon !== "sms_automation" && addon !== "email_automation");
        return without.includes("full_automation")
          ? without.filter((addon) => addon !== "full_automation")
          : [...without, "full_automation"];
      });
      return;
    }
    if ((id === "sms_automation" || id === "email_automation") && selectedAddons.includes("full_automation")) {
      return;
    }
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((addon) => addon !== id) : [...prev, id]));
  }

  const basePriceCents = campaignSummary?.priceCents ?? 40000;
  const basePrice = basePriceCents / 100;
  const homesCount = campaignSummary?.homesCount ?? 500;
  const selectedItems = ADDONS.filter((addon) => selectedAddons.includes(addon.id));
  const addonTodayTotal = selectedItems.reduce((sum, addon) => sum + addon.price, 0);
  const renewalReviewTotal = selectedItems.filter((addon) => addon.recurring).reduce((sum, addon) => sum + addon.price, 0);
  const todayTotal = basePrice + addonTodayTotal;

  async function handlePay() {
    if (!approvalAccepted) {
      setError("Please confirm the campaign review and proof-approval terms before continuing to checkout.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/targeted-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId ?? undefined,
          checkoutToken: checkoutToken ?? campaignSummary?.checkoutToken ?? undefined,
          addons: selectedAddons,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment setup failed.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
            HomeReach
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-100 sm:inline-flex">
            Step 3 of 3
          </span>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-6 lg:py-8">
        <section className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-blue-950/10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
              Launch Review
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Secure the campaign path and keep launch control.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Payment starts the execution queue. HomeReach still reviews creative, route notes, and launch readiness before anything mails.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5">
            <h2 className="text-lg font-black">Campaign summary</h2>
            {summaryLoading && (
              <div className="mt-4 rounded-lg border border-blue-300/20 bg-blue-400/10 px-4 py-3 text-sm text-blue-100">
                Loading your exact campaign price...
              </div>
            )}
            <div className="mt-4 grid gap-3">
              {[
                ["Business", campaignSummary?.businessName ?? "Your campaign"],
                ["Territory", campaignSummary?.targetCity ?? "Custom neighborhood plan"],
                ["Homeowner reach", `${homesCount.toLocaleString()} homes`],
                ["Execution", "Design, print, postage, delivery"],
                ["Approval gate", "Creative preview before mail"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className="text-right text-sm font-black text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5">
            <h2 className="text-lg font-black">Trust controls</h2>
            <div className="mt-4 grid gap-3">
              {[
                { label: "Secure Stripe checkout", icon: LockKeyhole },
                { label: "Card details are not stored by HomeReach", icon: CreditCard },
                { label: "Design preview before anything mails", icon: CheckCircle2 },
                { label: "Human review remains in the loop", icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-3">
                    <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                    <p className="text-sm font-bold text-slate-200">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Expansion Options
                </p>
                <h2 className="mt-2 text-2xl font-black">Strengthen the campaign.</h2>
              </div>
              <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                Optional
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Add-ons are built around the same acquisition path: more visibility, better lead capture, and cleaner follow-up.
            </p>

            <div className="mt-5 grid gap-3">
              {ADDONS.map((addon) => {
                const selected = selectedAddons.includes(addon.id);
                const covered =
                  (addon.id === "sms_automation" || addon.id === "email_automation") &&
                  selectedAddons.includes("full_automation");
                const Icon = addon.icon;
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => !covered && toggleAddon(addon.id)}
                    disabled={covered}
                    className={`w-full rounded-lg border px-4 py-3.5 text-left transition ${
                      covered
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50"
                        : selected
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-blue-700">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-slate-950">{addon.name}</span>
                            {addon.badge ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-black ${BADGE_STYLES[addon.badge]}`}>
                                {addon.badge}
                              </span>
                            ) : null}
                            {covered ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">
                                Included in bundle
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{addon.desc}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-slate-950">+${addon.price}</p>
                        <p className="text-xs text-slate-400">{addon.unit}</p>
                      </div>
                    </div>
                    {selected && !covered ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-black text-blue-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Added
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/20">
            {error && (
              <div
                className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                  cancelled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {error}
              </div>
            )}

            <h2 className="text-lg font-black">Payment review</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Neighborhood campaign</span>
                <span className="font-black">{formatUsd(basePriceCents)}</span>
              </div>
              {selectedItems.map((addon) => {
                const Icon = addon.icon;
                return (
                  <div key={addon.id} className="flex justify-between gap-4 text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {addon.name}
                    </span>
                    <span>+${addon.price}</span>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-950">
                <span>Due today</span>
                <span>${todayTotal.toLocaleString("en-US")}</span>
              </div>
              {renewalReviewTotal > 0 ? (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Renewal reviewed after first month</span>
                  <span>${renewalReviewTotal}/mo if approved</span>
                </div>
              ) : null}
            </div>

            <label className="mt-5 flex gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-left text-xs leading-5 text-blue-950">
              <input
                type="checkbox"
                checked={approvalAccepted}
                onChange={(event) => setApprovalAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-blue-300 text-blue-700"
              />
              <span>
                I understand HomeReach will review the route, quantity, creative proof, and launch timing before
                anything is printed or mailed. Results vary, and direct mail does not guarantee leads, sales, calls,
                or delivery dates beyond vendor and USPS estimates.
              </span>
            </label>

            <button
              onClick={handlePay}
              disabled={loading || summaryLoading || !campaignSummary?.eligibleForCheckout || !approvalAccepted}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Taking you to checkout..."
                : summaryLoading
                  ? "Loading campaign total..."
                  : approvalAccepted
                    ? `Pay $${todayTotal.toLocaleString("en-US")} - Start Execution Queue`
                    : "Confirm review terms to continue"}
              {!loading && !summaryLoading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
            <p className="mt-3 text-center text-xs font-semibold text-slate-500">
              You will be redirected to Stripe secure checkout.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function TargetedCheckoutPage() {
  return (
    <ClientSuspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <p className="text-sm font-semibold text-slate-300">Loading checkout...</p>
        </div>
      }
    >
      <TargetedCheckoutInner />
    </ClientSuspense>
  );
}
