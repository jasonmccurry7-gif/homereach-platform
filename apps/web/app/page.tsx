import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Landmark,
  Mail,
  MapPinned,
  Megaphone,
  Navigation,
  Radar,
  Route,
  ShieldCheck,
  Store,
  Target,
  Trees,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CtaButton } from "@/components/marketing/cta-button";
import { JsonLd } from "@/components/seo/JsonLd";
import { TargetedTerritoryCommandVisual } from "@/components/marketing/homepage-visuals";
import {
  PRODUCT_OVERVIEW_PATHS,
  PRODUCT_START_PATHS,
} from "@/lib/marketing/product-routes";
import {
  MARKET_CAPTURE_MANAGEMENT_FEE_CENTS,
  MARKET_CAPTURE_MIN_COMMITMENT_MONTHS,
  MARKET_CAPTURE_PRICING_TIERS,
  MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS,
  formatUsd,
} from "@/lib/market-capture/config";
import { buildServiceCatalogLd, buildWebPageLd, type JsonLd as JsonLdShape } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "HomeReach | Market Capture for Local Businesses",
  description:
    "HomeReach helps local businesses own the neighborhoods around their best customers with Market Capture, digital targeting, and optional direct mail.",
  keywords: [
    "market capture",
    "neighborhood digital targeting",
    "jobsite halo campaign",
    "competitor area campaign",
    "direct mail and digital ads",
    "local business marketing",
    "neighborhood saturation",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "HomeReach | Market Capture for Local Businesses",
    description:
      "Own the neighborhoods around your best customers with digital targeting and optional direct mail.",
  },
};
export const dynamic = "force-dynamic";

const primaryHref = PRODUCT_START_PATHS.marketCapture;

const howItWorks = [
  {
    title: "Choose your target area",
    body: "Jobsites, neighborhoods, competitors, events, service areas, districts, ZIPs, or custom local pockets.",
    icon: MapPinned,
  },
  {
    title: "Choose your budget",
    body: `Starter management is ${formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/month. Ad spend stays client-funded and separate.`,
    icon: CircleDollarSign,
  },
  {
    title: "Upload business details",
    body: "Send logo, photos, offer, website, and local notes so HomeReach can prepare the campaign plan.",
    icon: ClipboardList,
  },
  {
    title: "Approve the launch plan",
    body: "HomeReach creates the plan, payment path, tasks, drafts, and approval-gated fulfillment handoff.",
    icon: ShieldCheck,
  },
];

const targetingOptions = [
  { title: "Jobsite Halo Campaign", body: "Turn every completed job into a neighborhood visibility opportunity.", icon: Route },
  { title: "Competitor Area Campaign", body: "Build local awareness near competitor areas where platform policies allow.", icon: Store },
  { title: "Neighborhood Saturation", body: "Stay visible in subdivisions, ZIPs, streets, and high-value local pockets.", icon: Trees },
  { title: "Service Area Targeting", body: "Support city, ZIP, radius, and route-level demand across your core market.", icon: Navigation },
  { title: "Event Area Targeting", body: "Prepare campaigns around local events, seasonal moments, fundraisers, and rallies.", icon: Megaphone },
  { title: "Political District Saturation", body: "Use geography-based awareness with clear compliance guardrails.", icon: Landmark },
];

const proofPoints = [
  "No confusing ad-tech jargon",
  "Manual-first launch control",
  "Client-funded ad spend",
  "Optional postcards to the same neighborhoods",
  "Monthly reporting where data is available",
  "No guaranteed-result claims",
];

const ecosystemModules = [
  {
    title: "Direct mail saturation",
    body: "Pair digital visibility with postcards reaching the same neighborhoods.",
    href: PRODUCT_OVERVIEW_PATHS.targetedCampaigns,
    icon: Mail,
  },
  {
    title: "AI Growth OS",
    body: "Use HomeReach to surface opportunities, tasks, campaigns, and owner-ready next actions.",
    href: PRODUCT_OVERVIEW_PATHS.aiGrowthOs,
    icon: Radar,
  },
  {
    title: "Cost control",
    body: "After growth is moving, use HomeReach to find supplier and spending opportunities.",
    href: PRODUCT_OVERVIEW_PATHS.inventoryIntelligence,
    icon: BarChart3,
  },
];

export default function HomePage() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const schemas: JsonLdShape[] = [
    buildWebPageLd({
      name: "HomeReach Market Capture",
      description:
        "HomeReach helps local businesses stay visible in high-value neighborhoods with digital targeting and optional direct mail.",
      url: `${base}/`,
      primaryImage: `${base}/icons/icon-512.png`,
      about: [
        "Market Capture",
        "Neighborhood digital targeting",
        "Direct mail and digital saturation",
        "Jobsite halo campaigns",
        "Local business growth",
      ],
    }),
    buildServiceCatalogLd({
      name: "HomeReach local growth services",
      description:
        "HomeReach starts with Market Capture, then supports direct mail, AI growth workflows, cost control, reputation, and campaign execution.",
      url: `${base}/services`,
      services: [
        {
          name: "Market Capture",
          description:
            "Digital targeting and optional direct mail around jobsites, service areas, competitors, events, and high-value neighborhoods.",
          url: `${base}${PRODUCT_OVERVIEW_PATHS.marketCapture}`,
          category: "Revenue growth",
        },
        ...ecosystemModules.map((module) => ({
          name: module.title,
          description: module.body,
          url: `${base}${module.href}`,
          category: "HomeReach ecosystem",
        })),
      ],
    }),
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <JsonLd schemas={schemas} />
      <SiteHeader variant="digital" />

      <main>
        <section id="market-capture" className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-blue-500/20 to-transparent" />
          <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:px-6 lg:py-20">
            <div className="min-w-0">
              <p className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                Market Capture for local businesses
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Own the neighborhoods around your best customers.
              </h1>
              <p className="mt-5 max-w-2xl break-words text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach helps local businesses stay visible with digital targeting and optional direct mail around jobsites,
                service areas, competitors, events, and high-value neighborhoods.
              </p>
              <div className="mt-7 flex w-full min-w-0 flex-col gap-3 sm:flex-row">
                <CtaButton href={primaryHref} className="w-full min-w-0 text-center sm:w-auto">
                  Start My Campaign
                </CtaButton>
                <CtaButton href="#how-it-works" variant="secondary" className="w-full min-w-0 text-center sm:w-auto">
                  See How It Works
                </CtaButton>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["Starter management", `${formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/mo`],
                  ["Recommended ad spend", `${formatUsd(MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS)}/mo`],
                  ["Commitment", `${MARKET_CAPTURE_MIN_COMMITMENT_MONTHS} months`],
                ].map(([title, body]) => (
                  <div key={title} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.07] p-3 backdrop-blur">
                    <p className="text-sm font-black text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <TargetedTerritoryCommandVisual />
          </div>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-white px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="How it works"
              title="A simple path from neighborhood opportunity to campaign-ready plan."
              body="The first production goal is revenue: collect intake, qualify the opportunity, create the payment path, and move the campaign into approval-gated fulfillment."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {howItWorks.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</p>
                    <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="targeting-options" className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Targeting options"
              title="Sell local market capture, not complicated geofencing."
              body="The offer stays simple: choose the places where attention matters, then HomeReach prepares the campaign plan and launch checklist."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {targetingOptions.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                    <Icon className="h-6 w-6 text-blue-700" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-slate-200 bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="Pricing"
              title="Start at $499/month. Grow into higher-margin packages."
              body="The starter offer is designed to sell quickly. Growth and Dominance protect margin when the client needs more targets, more reporting, direct mail planning, or deeper strategy."
            />
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {MARKET_CAPTURE_PRICING_TIERS.map((tier) => (
                <article
                  key={tier.id}
                  className={`rounded-lg border p-5 shadow-sm ${
                    tier.id === "growth"
                      ? "border-blue-300 bg-blue-50"
                      : tier.id === "dominance"
                        ? "border-slate-800 bg-slate-950 text-white"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-black uppercase tracking-[0.16em] ${tier.id === "dominance" ? "text-cyan-200" : "text-blue-700"}`}>
                        {tier.id === "starter" ? "Front-door offer" : tier.id === "growth" ? "Best margin fit" : "Premium saturation"}
                      </p>
                      <h3 className="mt-2 text-xl font-black">{tier.name}</h3>
                    </div>
                    <BadgeDollarSign className={`h-7 w-7 ${tier.id === "dominance" ? "text-cyan-200" : "text-blue-700"}`} aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-4xl font-black">
                    {formatUsd(tier.managementFeeCents)}
                    <span className={`text-base ${tier.id === "dominance" ? "text-slate-400" : "text-slate-500"}`}>/month</span>
                  </p>
                  <p className={`mt-2 text-sm ${tier.id === "dominance" ? "text-slate-300" : "text-slate-600"}`}>
                    Recommended ad spend: {formatUsd(tier.recommendedAdSpendCents)}/month. Ad spend is separate.
                  </p>
                  <p className={`mt-4 text-sm leading-6 ${tier.id === "dominance" ? "text-slate-300" : "text-slate-600"}`}>
                    {tier.summary}
                  </p>
                  <div className="mt-5 grid gap-2">
                    {tier.scope.slice(0, 4).map((item) => (
                      <div key={item} className={`flex items-start gap-2 text-sm ${tier.id === "dominance" ? "text-slate-200" : "text-slate-700"}`}>
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <Link
                    href={`/market-capture/intake?plan=${tier.id}`}
                    className={`mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black ${
                      tier.id === "dominance"
                        ? "bg-white text-slate-950 hover:bg-slate-100"
                        : "bg-blue-700 text-white hover:bg-blue-600"
                    }`}
                  >
                    Start {tier.id === "starter" ? "My Campaign" : tier.name.replace("Market Capture ", "")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="direct-mail" className="px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <SectionIntro
              eyebrow="HomeReach advantage"
              title="Most agencies only run ads. HomeReach can pair the same neighborhoods with postcards."
              body="Digital plus direct mail gives the client repeated exposure without turning the buying decision into a technical ad-platform conversation."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {proofPoints.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                  <p className="text-sm font-bold leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ecosystem" className="bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="HomeReach operating system"
              title="Market Capture is the front door into the broader growth ecosystem."
              body="The homepage now leads with the fastest revenue path while preserving the platform's broader operating-system direction."
              dark
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {ecosystemModules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.title}
                    href={module.href}
                    className="rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
                  >
                    <Icon className="h-6 w-6 text-cyan-200" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-black">{module.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{module.body}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-5xl rounded-lg bg-blue-700 px-6 py-12 text-center text-white shadow-2xl shadow-blue-950/20">
            <Target className="mx-auto h-10 w-10 text-blue-100" aria-hidden="true" />
            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Turn your best local areas into campaign-ready opportunities.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-blue-50">
              Start with intake. HomeReach will review the target area, budget, offer, assets, and payment path before anything moves to fulfillment.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <CtaButton href={primaryHref} variant="light">
                Start My Campaign
              </CtaButton>
              <CtaButton href={PRODUCT_OVERVIEW_PATHS.marketCapture} variant="secondary">
                View Full Offer
              </CtaButton>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p className={`text-sm font-black uppercase tracking-[0.18em] ${dark ? "text-cyan-200" : "text-blue-700"}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${dark ? "text-white" : "text-slate-950"}`}>
        {title}
      </h2>
      {body ? (
        <p className={`mt-4 text-base leading-7 ${dark ? "text-slate-300" : "text-slate-600"}`}>
          {body}
        </p>
      ) : null}
    </div>
  );
}
