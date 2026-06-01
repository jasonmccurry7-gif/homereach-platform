"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { formatUsd } from "@/lib/digital-targeting/config";

const ClientSuspense = Suspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => React.ReactNode;

type Summary = {
  id: string;
  businessName: string;
  email: string;
  paymentStatus: string;
  campaignStatus: string;
  monthlyManagementFee: number;
  monthlyAdSpend: number;
  setupFee: number;
  stripeAvailable: boolean;
  eligibleForCheckout: boolean;
};

function DigitalCheckoutInner() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const cancelled = searchParams?.get("cancelled") === "true";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(
    cancelled ? "Payment was cancelled. You can review and try again." : null,
  );

  useEffect(() => {
    if (!token) {
      setError("Missing checkout token.");
      setLoading(false);
      return;
    }

    let active = true;
    fetch(`/api/stripe/digital-targeting-checkout?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Campaign summary unavailable.");
        if (active) setSummary(data.campaign);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Campaign summary unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handlePay() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/digital-targeting-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment setup failed.");
        setPaying(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPaying(false);
    }
  }

  const dueToday = (summary?.monthlyManagementFee ?? 49900) + (summary?.setupFee ?? 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/digital-targeting" className="flex items-center gap-2 text-sm font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
            HomeReach
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 sm:inline-flex">
            Payment review
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-6">
        <section className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Launch path</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Secure the management fee and keep launch approval protected.</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Ad spend is separate. HomeReach will not launch paid ads until target areas, creative, tracking, spend,
              compliance, and admin approval are confirmed.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              { label: "Secure payment", icon: CreditCard },
              { label: "Admin approval before launch", icon: ShieldCheck },
              { label: "Manual launch mode if API keys are missing", icon: CheckCircle2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.08] p-3">
                  <Icon className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  <p className="text-sm font-bold text-slate-200">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/25">
          {loading ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              Loading campaign payment summary...
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          {summary ? (
            <div className="mt-4 space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Neighborhood Digital Targeting</p>
                <h2 className="mt-2 text-2xl font-black">{summary.businessName}</h2>
                <p className="mt-1 text-sm text-slate-500">{summary.email}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Monthly management fee</span>
                  <span className="font-black">{formatUsd(summary.monthlyManagementFee)}/mo</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Client ad spend budget</span>
                  <span className="font-black">{formatUsd(summary.monthlyAdSpend)}/mo separate</span>
                </div>
                {summary.setupFee > 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Setup fee</span>
                    <span className="font-black">{formatUsd(summary.setupFee)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black">
                  <span>Due today</span>
                  <span>{formatUsd(dueToday)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {summary.stripeAvailable
                  ? "You will be redirected to Stripe secure checkout. Card details are not stored by HomeReach."
                  : "Stripe is not configured in this environment, so the system will create an admin payment-required task instead of breaking the flow."}
              </div>

              <button
                type="button"
                onClick={handlePay}
                disabled={paying || !summary.eligibleForCheckout}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying
                  ? "Preparing payment path..."
                  : summary.stripeAvailable
                    ? "Start Monthly Management Subscription"
                    : "Create Manual Payment Task"}
                {!paying ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default function DigitalTargetingCheckoutPage() {
  return (
    <ClientSuspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <p className="text-sm font-semibold text-slate-300">Loading payment review...</p>
        </div>
      }
    >
      <DigitalCheckoutInner />
    </ClientSuspense>
  );
}
