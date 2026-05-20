import type { Metadata } from "next";
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  CreditCard,
  Database,
  DoorOpen,
  Flag,
  Landmark,
  Layers,
  Mail,
  Map,
  MapPinned,
  PackageCheck,
  PackageSearch,
  Radar,
  Route,
  ShieldCheck,
  Target,
  Truck,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CtaButton } from "@/components/marketing/cta-button";
import { ProductCard } from "@/components/marketing/product-card";
import { OfferingSection } from "@/components/marketing/offering-section";
import {
  CampaignOpsVisual,
  HeroPlatformVisual,
  IntelligenceVisual,
  PrintProductVisual,
  PurchasingVisual,
  RouteMapPanel,
} from "@/components/marketing/homepage-visuals";
import {
  accountStartHref,
  PRODUCT_OVERVIEW_PATHS,
  PRODUCT_START_PATHS,
} from "@/lib/marketing/product-routes";

export const metadata: Metadata = {
  title:
    "HomeReach | Geographic Intelligence & Operational Execution Platform",
  description:
    "HomeReach unifies shared postcards, targeted direct mail, political mail, property intelligence, yard signs, door hangers, business cards, and inventory purchasing intelligence for local visibility.",
  keywords: [
    "shared postcards",
    "targeted direct mail",
    "political mail",
    "campaign postcards",
    "yard signs",
    "door hangers",
    "business cards",
    "property intelligence",
    "inventory purchasing dashboard",
    "supplier savings",
    "local advertising",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title:
      "HomeReach | Geographic Intelligence & Operational Execution Platform",
    description:
      "A premium operational platform for shared postcards, targeted campaigns, political mail, property intelligence, purchasing savings, and supporting print products.",
  },
};

const products = [
  {
    title: "Co-op Shared Postcards",
    body: "Affordable visibility through shared premium postcards mailed to local homeowners.",
    cta: "Reserve My Spot",
    href: PRODUCT_OVERVIEW_PATHS.sharedPostcards,
    icon: Mail,
    accent: "blue" as const,
    meta: "Shared",
  },
  {
    title: "Targeted Campaigns",
    body: "Route-level campaigns built around ZIPs, neighborhoods, income zones, and custom delivery areas.",
    cta: "Build Targeted Campaign",
    href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns,
    icon: MapPinned,
    accent: "blue" as const,
    meta: "Routes",
  },
  {
    title: "Political Postcard Campaigns",
    body: "Plan, price, approve, and execute campaign mail from a political command center.",
    cta: "Launch Campaign Plan",
    href: PRODUCT_OVERVIEW_PATHS.politicalCampaigns,
    icon: Landmark,
    accent: "red" as const,
    meta: "Campaigns",
  },
  {
    title: "Inventory & Purchasing Dashboard",
    body: "Track recurring supplies, compare supplier pricing, and uncover savings opportunities.",
    cta: "Find My Savings",
    href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence,
    icon: PackageSearch,
    accent: "green" as const,
    meta: "Savings",
  },
  {
    title: "Property Intelligence",
    body: "Use property, neighborhood, and geographic data to target better campaigns.",
    cta: "Explore Property Intelligence",
    href: PRODUCT_OVERVIEW_PATHS.propertyIntelligence,
    icon: Database,
    accent: "slate" as const,
    meta: "Data",
  },
  {
    title: "Yard Signs",
    body: "Campaign and local business visibility products connected to the HomeReach ecosystem.",
    cta: "Order Yard Signs",
    href: accountStartHref(PRODUCT_START_PATHS.yardSigns),
    icon: Flag,
    accent: "amber" as const,
    meta: "Print",
  },
  {
    title: "Door Hangers",
    body: "Local saturation marketing for neighborhoods, routes, and service areas.",
    cta: "Build Door Hanger Campaign",
    href: accountStartHref(PRODUCT_START_PATHS.doorHangers),
    icon: DoorOpen,
    accent: "red" as const,
    meta: "Local",
  },
  {
    title: "Business Cards",
    body: "Premium business cards and branded materials for local visibility.",
    cta: "Create Business Cards",
    href: accountStartHref(PRODUCT_START_PATHS.businessCards),
    icon: CreditCard,
    accent: "slate" as const,
    meta: "Brand",
  },
];

const whyItems = [
  {
    title: "Route-Level Precision",
    body: "Campaigns can be planned around carrier routes, ZIP codes, neighborhoods, custom territories, and known local visibility zones.",
    icon: Route,
  },
  {
    title: "Operational Execution",
    body: "HomeReach connects planning, pricing, approvals, print, mail logistics, and fulfillment in one operating workflow.",
    icon: Truck,
  },
  {
    title: "Campaign-Grade Systems",
    body: "Political teams and businesses can move from strategy to approved mail plans without losing control of timing or costs.",
    icon: ShieldCheck,
  },
  {
    title: "Purchasing Intelligence",
    body: "Recurring supplies, print runs, and supplier pricing become visible enough to catch savings opportunities before spend repeats.",
    icon: BadgeDollarSign,
  },
  {
    title: "Property Intelligence",
    body: "Property, household, and neighborhood signals help teams focus spend on better-fit delivery areas and audiences.",
    icon: Building2,
  },
  {
    title: "USPS and Mail Expertise",
    body: "The platform reflects real production, postage, scheduling, and delivery constraints instead of treating mail like a generic ad unit.",
    icon: PackageCheck,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-600/25 to-transparent" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-6 lg:py-24">
            <div>
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                HomeReach Platform Ecosystem
              </p>
              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Geographic Intelligence &amp; Operational Execution for Businesses and Campaigns
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach helps businesses and campaigns dominate local visibility through shared postcards,
                targeted campaigns, political mail, property intelligence, purchasing intelligence, and supporting
                print products.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={accountStartHref(PRODUCT_START_PATHS.sharedPostcards)} variant="primary">
                  Get Started
                </CtaButton>
                <CtaButton href="#platforms" variant="secondary">
                  Explore Platforms
                </CtaButton>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-3">
                {[
                  ["Route maps", "Plan by geography"],
                  ["Mail ops", "Execute with control"],
                  ["Savings", "See supplier gaps"],
                ].map(([value, label]) => (
                  <div key={value} className="rounded-lg border border-white/10 bg-white/[0.08] p-3 backdrop-blur">
                    <p className="text-sm font-black text-white">{value}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <HeroPlatformVisual />
          </div>
        </section>

        <section id="platforms" className="scroll-mt-28 px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                Product Navigation
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                One ecosystem for local reach, campaign execution, and operating leverage.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.title} {...product} />
              ))}
            </div>
          </div>
        </section>

        <OfferingSection
          id="shared-postcards"
          eyebrow="Co-op Shared Postcards"
          title="Affordable local visibility on premium shared postcards."
          body="Shared postcard campaigns give local businesses repeated mailbox presence without carrying the full cost of a standalone mailer."
          bullets={[
            "One business per category in each available city",
            "Premium homeowner-facing postcards mailed to local routes",
            "Spot selection and checkout continue through the existing live funnel",
          ]}
          cta="Reserve My Spot"
          href={accountStartHref(PRODUCT_START_PATHS.sharedPostcards)}
          icon={Mail}
          tone="blue"
        >
          <CampaignOpsVisual />
        </OfferingSection>

        <OfferingSection
          id="targeted-campaigns"
          eyebrow="Targeted Geographic Campaigns"
          title="Build direct mail around the exact neighborhoods that matter."
          body="Targeted campaigns support ZIPs, neighborhoods, radius campaigns, route-level planning, and custom delivery areas for businesses that need more control."
          bullets={[
            "Flexible geography for any U.S. market",
            "Volume options for local, ZIP, and multi-neighborhood reach",
            "Design, print, postage, and delivery connected to one flow",
          ]}
          cta="Build Targeted Campaign"
          href={accountStartHref(PRODUCT_START_PATHS.targetedCampaigns)}
          icon={Target}
          tone="blue"
          reverse
        >
          <CampaignOpsVisual />
        </OfferingSection>

        <OfferingSection
          id="political-campaigns"
          eyebrow="Political Postcard Campaigns"
          title="A command center for campaign mail planning, pricing, approval, and launch."
          body="Political teams can map coverage, compare scenarios, price mail drops, and move into production with a workflow built for campaign timing."
          bullets={[
            "District and route planning from the public political platform",
            "Pricing scenarios for one-drop and multi-wave campaigns",
            "Approval, payment, production, and delivery timing in one operating path",
          ]}
          cta="Launch Campaign Plan"
          href={accountStartHref(PRODUCT_START_PATHS.politicalCampaigns)}
          icon={Landmark}
          tone="red"
        >
          <CampaignOpsVisual tone="red" />
        </OfferingSection>

        <OfferingSection
          id="inventory-intelligence"
          eyebrow="Inventory & Purchasing Dashboard"
          title="Turn recurring supply spend into visible savings opportunities."
          body="Inventory intelligence gives operators a clearer view of recurring supplies, supplier pricing, replenishment patterns, and purchase timing."
          bullets={[
            "Track print, campaign, signage, and operational supplies",
            "Compare supplier pricing and spot variance across categories",
            "Surface savings opportunities before the next purchase cycle",
          ]}
          cta="Find My Savings"
          href={accountStartHref(PRODUCT_START_PATHS.inventoryIntelligence)}
          icon={PackageSearch}
          tone="green"
          reverse
        >
          <PurchasingVisual />
        </OfferingSection>

        <OfferingSection
          id="property-intelligence"
          eyebrow="Property Intelligence"
          title="Use neighborhood and property data to target better campaigns."
          body="Property intelligence adds geographic context around households, neighborhoods, and local opportunity signals so campaigns can focus spend more intelligently."
          bullets={[
            "Map overlays for property, neighborhood, and household signals",
            "Targeting context for direct mail, door hangers, and field visibility",
            "Better-fit audiences for local service businesses and campaigns",
          ]}
          cta="Explore Property Intelligence"
          href={PRODUCT_OVERVIEW_PATHS.propertyIntelligence}
          icon={Map}
          tone="slate"
        >
          <IntelligenceVisual />
        </OfferingSection>

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">
                  Supporting Print Products
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Yard signs, door hangers, and business cards connected to the same execution system.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Local visibility rarely depends on one channel. HomeReach connects mailbox, route, jobsite,
                  neighborhood, and handoff materials into a cohesive operating platform.
                </p>
              </div>
              <PrintProductVisual />
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  id: "yard-signs",
                  title: "Yard Signs",
                  body: "Campaign and local business visibility products connected to the HomeReach ecosystem.",
                  href: accountStartHref(PRODUCT_START_PATHS.yardSigns),
                  cta: "Order Yard Signs",
                },
                {
                  id: "door-hangers",
                  title: "Door Hangers",
                  body: "Local saturation marketing for neighborhoods, routes, and service areas.",
                  href: accountStartHref(PRODUCT_START_PATHS.doorHangers),
                  cta: "Build Door Hanger Campaign",
                },
                {
                  id: "business-cards",
                  title: "Business Cards",
                  body: "Premium business cards and branded materials for local visibility.",
                  href: accountStartHref(PRODUCT_START_PATHS.businessCards),
                  cta: "Create Business Cards",
                },
              ].map((item) => (
                <div
                  id={item.id}
                  key={item.title}
                  className="scroll-mt-28 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-xl font-black text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                  <CtaButton href={item.href} variant="light" className="mt-5">
                    {item.cta}
                  </CtaButton>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                Why HomeReach
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Built for local visibility and operational execution, not just printing.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {whyItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
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

        <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-200">
                Dashboard + Map Intelligence
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                A local marketing command center with maps, mail, savings, and production signals.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                The HomeReach platform presentation now matches the expanded business: route intelligence, campaign
                planning, purchasing visibility, property overlays, and supporting print products under one brand.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Route planning",
                  "Campaign workflows",
                  "Property overlays",
                  "Supplier savings",
                ].map((item) => (
                  <div key={item} className="rounded-lg border border-white/10 bg-white/[0.08] p-3 text-sm font-bold text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-4 shadow-2xl shadow-blue-950/20">
              <RouteMapPanel className="min-h-[24rem]" />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                  <BarChart3 className="h-5 w-5 text-blue-200" aria-hidden="true" />
                  <p className="mt-2 text-sm font-black">Campaign ROI</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                  <Layers className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                  <p className="mt-2 text-sm font-black">Data Layers</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/10 p-3">
                  <Radar className="h-5 w-5 text-red-200" aria-hidden="true" />
                  <p className="mt-2 text-sm font-black">Route Signals</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-5xl rounded-lg bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-12 text-center text-white shadow-2xl shadow-blue-950/20">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-100">
              Build local dominance with one operating platform
            </p>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Start with shared postcards, targeted geography, campaign mail, purchasing savings, or property intelligence.
            </h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaButton href={accountStartHref(PRODUCT_START_PATHS.sharedPostcards)} variant="light">
                Get Started
              </CtaButton>
              <CtaButton href={accountStartHref(PRODUCT_START_PATHS.targetedCampaigns)} variant="secondary">
                Build Targeted Campaign
              </CtaButton>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
