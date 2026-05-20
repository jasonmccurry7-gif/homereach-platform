import type { Metadata } from "next";
import { BadgeDollarSign, ClipboardCheck, PackageSearch, TrendingDown } from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CtaButton } from "@/components/marketing/cta-button";
import { PurchasingVisual } from "@/components/marketing/homepage-visuals";
import { accountStartHref, PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";

export const metadata: Metadata = {
  title: "Inventory Purchasing Dashboard & Supplier Savings",
  description:
    "Track recurring supplies, compare supplier pricing, and uncover supplier savings opportunities with the HomeReach inventory purchasing dashboard.",
  keywords: [
    "inventory purchasing dashboard",
    "supplier savings",
    "supplier price comparison",
    "recurring supplies",
    "print purchasing",
  ],
};

const valueProps = [
  {
    title: "Recurring Supply Visibility",
    body: "Track the categories that repeat every month, quarter, or campaign cycle.",
    icon: PackageSearch,
  },
  {
    title: "Supplier Savings Signals",
    body: "Compare current vendor pricing against lower-cost opportunities before the next order.",
    icon: TrendingDown,
  },
  {
    title: "Approval Workflow",
    body: "Keep savings recommendations tied to operational approval instead of unmanaged auto-buying.",
    icon: ClipboardCheck,
  },
  {
    title: "Spend Intelligence",
    body: "Turn purchasing history into a clearer view of margin, timing, and supplier leverage.",
    icon: BadgeDollarSign,
  },
];

export default function InventoryPurchasingPage() {
  const startHref = accountStartHref(PRODUCT_START_PATHS.inventoryIntelligence);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <HomeReachLogo tone="light" size="sm" sublabel="Inventory Intelligence" />
              <h1 className="mt-8 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Inventory & Purchasing Intelligence for recurring supplies.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Track supplies, compare supplier pricing, find savings opportunities, and connect purchasing
                decisions to an operational dashboard built for HomeReach's broader platform ecosystem.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={startHref} variant="green">
                  Find My Savings
                </CtaButton>
                <CtaButton href="/#inventory-intelligence" variant="secondary">
                  View Platform Overview
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
                Supplier Savings
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Built for the supplies that quietly shape campaign margin.
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
      </main>
      <SiteFooter />
    </div>
  );
}
