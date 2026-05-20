import type { Metadata } from "next";
import { Building2, Database, Map, Target } from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { CtaButton } from "@/components/marketing/cta-button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { IntelligenceVisual, RouteMapPanel } from "@/components/marketing/homepage-visuals";
import { accountStartHref, PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";

export const metadata: Metadata = {
  title: "Property Intelligence Overview | HomeReach",
  description:
    "Explore HomeReach property intelligence before creating an account and choosing a market, category, and intelligence tier.",
};

const layers = [
  {
    title: "Property Signals",
    body: "Home, neighborhood, and ownership context for better audience selection.",
    icon: Building2,
  },
  {
    title: "Geographic Layers",
    body: "Campaign planning context across ZIPs, local markets, neighborhoods, and custom areas.",
    icon: Map,
  },
  {
    title: "Audience Fit",
    body: "Category-level signals help focus spend on households with stronger service fit.",
    icon: Target,
  },
  {
    title: "Operational Data",
    body: "Intelligence feeds can connect into campaigns, routes, proposals, and customer views.",
    icon: Database,
  },
];

export default function PropertyIntelligenceOverviewPage() {
  const startHref = accountStartHref(PRODUCT_START_PATHS.propertyIntelligence);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-slate-500/25 to-transparent" />
          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <HomeReachLogo tone="light" size="sm" sublabel="Property Intelligence" />
              <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-slate-300">
                Geographic Data Overview
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                See where property data can sharpen direct mail, outreach, and market planning.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Property intelligence turns household and neighborhood context into clearer targeting decisions.
                Review the overview first, then create an account before selecting a market and intelligence tier.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={startHref} variant="light">
                  Create Account to Continue
                </CtaButton>
                <CtaButton href="/#property-intelligence" variant="secondary">
                  View Platform Context
                </CtaButton>
              </div>
            </div>
            <div className="grid gap-4">
              <IntelligenceVisual />
              <RouteMapPanel className="min-h-[18rem]" />
            </div>
          </div>
        </section>

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">
                Intelligence Layers
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Built to support smarter geographic marketing decisions.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {layers.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
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
