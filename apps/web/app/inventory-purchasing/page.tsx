import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  PackageSearch,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CtaButton } from "@/components/marketing/cta-button";
import { PurchasingVisual } from "@/components/marketing/homepage-visuals";
import { PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";

export const metadata: Metadata = {
  title: "Free Supply Cost Review & Procurement Dashboard - HomeReach",
  description:
    "HomeReach helps small businesses protect margin, see recurring spend clearly, compare vendor pricing, and uncover approval-ready supply cost review opportunities.",
  keywords: [
    "free supply cost review",
    "procurement dashboard",
    "margin protection",
    "supplier savings",
    "purchasing visibility",
    "vendor price comparison",
    "operational command center",
    "small business cost reduction",
  ],
  alternates: { canonical: "/inventory-purchasing" },
};

const valueProps = [
  {
    title: "Profit Leak Visibility",
    body: "See the recurring spend categories quietly shaping margin every week.",
    icon: PackageSearch,
  },
  {
    title: "Savings Signals",
    body: "Compare current vendor pricing against lower-cost options before money leaves the business.",
    icon: TrendingDown,
  },
  {
    title: "Controlled Decisions",
    body: "Keep every savings recommendation tied to owner approval instead of unmanaged auto-buying.",
    icon: ClipboardCheck,
  },
  {
    title: "Margin Intelligence",
    body: "Turn spend history into a clearer view of timing, leverage, risk, and profitability.",
    icon: BadgeDollarSign,
  },
];

const savingsRollupPreview = [
  {
    label: "This week",
    value: "$420 est.",
    detail: "Found signals stay labeled estimated until quote or invoice proof is loaded.",
  },
  {
    label: "This month",
    value: "$1,840 est.",
    detail: "Captured savings are separated from opportunities still waiting on review.",
  },
  {
    label: "Since enrollment",
    value: "$6,210 identified",
    detail: "The owner sees total opportunity and approved savings without spreadsheet work.",
  },
];

const sourceLabels = [
  {
    label: "Verified",
    detail: "Invoice, supplier quote, CSV import, account price, or approved portal data.",
    icon: FileCheck2,
  },
  {
    label: "Observed",
    detail: "Public benchmark or search reference that still needs supplier/account confirmation.",
    icon: BarChart3,
  },
  {
    label: "Estimated",
    detail: "Planning math used to start a review, never to commit spend on its own.",
    icon: Clock3,
  },
];

const adminControls = [
  "Normalize units, delivery fees, minimums, taxes, and receiving burden.",
  "Separate verified account pricing from observed benchmarks and estimates.",
  "Queue approval records instead of placing orders or switching vendors.",
  "Show stale price snapshots and missing quote coverage before owner-facing claims.",
];

export default function InventoryPurchasingPage() {
  const startHref = PRODUCT_START_PATHS.inventoryIntelligence;

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <HomeReachLogo tone="light" size="sm" sublabel="Supply Cost Review" />
              <h1 className="mt-8 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Stop overpaying for recurring business supplies.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                HomeReach helps restaurants, contractors, service companies, and multi-location SMBs see where
                money may be leaking through vendor price drift, supply waste, reorder risk, and disconnected
                purchasing decisions.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={startHref} variant="green">
                  Request My Savings Review
                </CtaButton>
                <CtaButton href="/#supply-savings" variant="secondary">
                  View Supply Savings Overview
                </CtaButton>
              </div>
            </div>
            <PurchasingVisual />
          </div>
        </section>

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Margin Protection
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Built for the supplies that quietly shape owner margin.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {valueProps.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Procurement Dashboard Experience
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                The owner sees decisions. The admin side keeps the hard math.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                HomeReach is designed to make operational control feel calm: weekly, monthly, and since-enrollment
                savings rollups up front, source labels always visible, and no supplier order or vendor change
                without human approval.
              </p>
              <div className="mt-6 grid gap-3">
                {sourceLabels.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-black text-slate-950">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                      Owner View Example
                    </p>
                    <h3 className="mt-2 text-2xl font-black">Savings without operational noise</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-100">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Approval only
                  </span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {savingsRollupPreview.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">{metric.value}</p>
                      <p className="mt-2 text-xs leading-5 text-neutral-300">{metric.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                    <div>
                      <p className="font-black text-white">Urgent decisions only</p>
                      <p className="mt-1 text-sm leading-6 text-amber-50">
                        Customers see pending approvals, high-risk reorders, delivery exceptions, and clear next
                        actions. Lower-priority price analysis stays in the background review layer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <h3 className="font-black text-slate-950">Weekly owner rhythm</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Weekly and monthly views make savings progress visible without asking the owner to compare
                    supplier rows, unit conversions, and stale price notes.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    <h3 className="font-black text-slate-950">Admin-side control</h3>
                  </div>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                    {adminControls.map((control) => (
                      <li key={control}>{control}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
