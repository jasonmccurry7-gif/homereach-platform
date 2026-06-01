import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Landmark,
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
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TargetedTerritoryCommandVisual } from "@/components/marketing/homepage-visuals";
import {
  MARKET_CAPTURE_MANAGEMENT_FEE_CENTS,
  MARKET_CAPTURE_MIN_COMMITMENT_MONTHS,
  MARKET_CAPTURE_PRICING_TIERS,
  MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS,
  formatUsd,
  isMarketCaptureEnabled,
} from "@/lib/market-capture/config";

export const metadata: Metadata = {
  title: "Market Capture | HomeReach",
  description:
    "Own the neighborhoods around your best customers with HomeReach Market Capture: digital targeting, campaign planning, and optional direct mail for local businesses.",
  alternates: { canonical: "/market-capture" },
  openGraph: {
    title: "Market Capture | HomeReach",
    description:
      "Digital targeting and optional direct mail around jobsites, service areas, competitors, events, and high-value neighborhoods.",
  },
};

const howItWorks = [
  {
    title: "Choose your target area",
    body: "Jobsites, neighborhoods, competitors, events, service areas, districts, ZIPs, or custom local pockets.",
    icon: MapPinned,
  },
  {
    title: "Choose your budget",
    body: `You control ad spend. HomeReach starts at ${formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/month for tightly scoped management.`,
    icon: CircleDollarSign,
  },
  {
    title: "Upload your business information",
    body: "Send logo, photos, offer, website, and campaign details so the plan can be reviewed quickly.",
    icon: FileText,
  },
  {
    title: "HomeReach builds your campaign plan",
    body: "Your request becomes a qualified sales opportunity with payment readiness and a clean handoff to fulfillment.",
    icon: Radar,
  },
];

const targetingOptions = [
  { title: "Jobsite Halo Campaign", body: "Turn recent jobs into neighborhood visibility opportunities.", icon: Route },
  { title: "Competitor Area Campaign", body: "Build local visibility near competitor areas where platform rules allow.", icon: Store },
  { title: "Neighborhood Saturation", body: "Focus on streets, subdivisions, ZIPs, and high-value local pockets.", icon: Trees },
  { title: "Service Area Targeting", body: "Support city, ZIP, radius, and route-level local demand.", icon: Navigation },
  { title: "Event Area Targeting", body: "Stay visible around local events, seasonal moments, fundraisers, or rallies.", icon: CalendarDays },
  { title: "Political District Saturation", body: "Use neutral geography-based awareness with compliance guardrails.", icon: Landmark },
  { title: "Digital + Direct Mail Campaign", body: "Pair online visibility with postcards to the same neighborhoods.", icon: Megaphone },
];

const industries = [
  "Roofing",
  "Lawn care",
  "HVAC",
  "Landscaping",
  "Concrete",
  "Pest control",
  "Real estate",
  "Med spas",
  "Dentists",
  "Restaurants",
  "Political campaigns",
];

const faqs = [
  {
    q: "What is Market Capture?",
    a: "Market Capture helps a local business stay visible in the neighborhoods, jobsites, service areas, competitor areas, events, or districts that matter most.",
  },
  {
    q: "How does it work?",
    a: "You choose the area and budget. HomeReach reviews your details, builds a campaign plan, prepares recommendations, and creates the handoff for fulfillment.",
  },
  {
    q: "Is ad spend included?",
    a: `No. The ${formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/month starter fee is the HomeReach management fee. Ad spend is separate and funded by the client.`,
  },
  {
    q: "Can postcards be included?",
    a: "Yes. Direct mail is one of the biggest HomeReach advantages because the same neighborhoods can see you online and in the mailbox.",
  },
  {
    q: "Can I target competitors?",
    a: "Campaigns can be planned around competitor areas where platform rules and policies allow.",
  },
  {
    q: "Do you guarantee results?",
    a: "No. Results vary. HomeReach does not guarantee leads, sales, ROI, conversions, visits, or platform approval.",
  },
];

export default function MarketCapturePage() {
  if (!isMarketCaptureEnabled()) notFound();

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <Link href="/" aria-label="HomeReach home">
            <HomeReachLogo size="md" sublabel="Market Capture" />
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-bold text-slate-600 lg:flex">
            <Link href="#how-it-works" className="hover:text-slate-950">How It Works</Link>
            <Link href="#targeting-options" className="hover:text-slate-950">Targeting</Link>
            <Link href="#direct-mail" className="hover:text-slate-950">Direct Mail</Link>
            <Link href="#pricing" className="hover:text-slate-950">Pricing</Link>
            <Link href="#faq" className="hover:text-slate-950">FAQ</Link>
          </nav>
          <Link href="/market-capture/intake" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600">
            Start My Campaign
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-6 lg:py-16">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Market Capture</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Own the neighborhoods around your best customers.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach helps local businesses stay visible with digital targeting and optional direct mail around jobsites,
                service areas, competitors, events, and high-value neighborhoods.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/market-capture/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 text-sm font-black text-white hover:bg-blue-400">
                  Start My Campaign
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-sm font-black text-white hover:bg-white/10">
                  See How It Works
                </Link>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["Starter management", `${formatUsd(MARKET_CAPTURE_MANAGEMENT_FEE_CENTS)}/mo`],
                  ["Recommended ad spend", `${formatUsd(MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS)}/mo`],
                  ["Launch path", "Manual-first"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-2 text-lg font-black">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <TargetedTerritoryCommandVisual className="self-center" mode="compact" />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <SectionIntro eyebrow="How it works" title="Four steps from interest to sales-ready opportunity." />
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <Icon className="h-6 w-6 text-blue-700" aria-hidden="true" />
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</p>
                  <h2 className="mt-2 text-lg font-black">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="targeting-options" className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
            <SectionIntro eyebrow="Targeting options" title="Built around local business outcomes, not ad-tech confusion." />
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {targetingOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div key={option.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <Icon className="h-6 w-6 text-blue-700" aria-hidden="true" />
                    <h2 className="mt-4 text-lg font-black">{option.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{option.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <SectionIntro eyebrow="Best industries" title="Strong fit for local businesses that win neighborhood by neighborhood." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {industries.map((industry) => (
                <div key={industry} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">
                  {industry}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="direct-mail" className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">HomeReach advantage</p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
                Digital targeting can be paired with postcards to the same neighborhoods.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Most agencies only run ads. HomeReach can pair Market Capture with direct mail, giving local homeowners a
                simple repeated-exposure path online and in the mailbox.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Same area", "Keep the target geography aligned across digital and mail."],
                ["Simple offer", "Use one clear message instead of disconnected campaigns."],
                ["Sales ready", "Capture the add-on interest now and quote fulfillment later."],
              ].map(([label, body]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
                  <Megaphone className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  <h2 className="mt-3 text-sm font-black">{label}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <SectionIntro eyebrow="Pricing" title="Start at $499/month. Upsell when scope grows." />
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Market Capture keeps the buying decision clear: HomeReach manages planning, sales-to-fulfillment handoff,
            and monthly reporting, while the client separately funds the media budget. Starter campaigns work best with
            at least {formatUsd(MARKET_CAPTURE_RECOMMENDED_AD_SPEND_CENTS)}/month in ad spend and a {MARKET_CAPTURE_MIN_COMMITMENT_MONTHS}-month commitment.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {MARKET_CAPTURE_PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-lg border p-5 shadow-sm ${
                  tier.id === "growth"
                    ? "border-blue-300 bg-blue-50"
                    : tier.id === "dominance"
                      ? "border-slate-800 bg-slate-950 text-white"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-xs font-black uppercase tracking-[0.18em] ${tier.id === "dominance" ? "text-cyan-200" : "text-blue-700"}`}>
                      {tier.id === "starter" ? "Front-door offer" : tier.id === "growth" ? "Best margin fit" : "Premium saturation"}
                    </p>
                    <h3 className="mt-2 text-xl font-black">{tier.name}</h3>
                    <p className="mt-3 text-4xl font-black">
                      {formatUsd(tier.managementFeeCents)}
                      <span className={`text-base ${tier.id === "dominance" ? "text-slate-400" : "text-slate-500"}`}>/month</span>
                    </p>
                    <p className={`mt-2 text-sm ${tier.id === "dominance" ? "text-slate-300" : "text-slate-600"}`}>
                      Ad spend separate. Recommended: {formatUsd(tier.recommendedAdSpendCents)}/month.
                    </p>
                  </div>
                  <BadgeDollarSign className={`h-7 w-7 ${tier.id === "dominance" ? "text-cyan-200" : "text-blue-700"}`} aria-hidden="true" />
                </div>
                <p className={`mt-4 text-sm leading-6 ${tier.id === "dominance" ? "text-slate-300" : "text-slate-600"}`}>
                  {tier.summary}
                </p>
                <div className="mt-5 grid gap-2">
                  {tier.scope.map((item) => (
                    <div key={item} className={`flex items-start gap-2 text-sm ${tier.id === "dominance" ? "text-slate-200" : "text-slate-700"}`}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
                <Link
                  href={`/market-capture/intake?plan=${tier.id}`}
                  className={`mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-black ${
                    tier.id === "dominance"
                      ? "bg-white text-slate-950 hover:bg-slate-100"
                      : "bg-blue-700 text-white hover:bg-blue-600"
                  }`}
                >
                  Start {tier.id === "starter" ? "My Campaign" : tier.name.replace("Market Capture ", "")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
            <SectionIntro eyebrow="FAQ" title="Clear answers before the first call." />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-black">{faq.q}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-black">Compliance and platform guardrails</h2>
                <p className="mt-2 text-sm leading-7">
                  Results vary. Ad platform approval is required. Targeting depends on platform availability and policy.
                  No individual-level targeting or private identity display. HomeReach does not use prohibited targeting categories,
                  and does not guarantee leads, sales, visits, conversions, ROI, or political outcomes. Paid ads are never auto-launched.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-blue-700 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Ready for review</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Start a Market Capture campaign.</h2>
            </div>
            <Link href="/market-capture/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-black text-blue-800 hover:bg-blue-50">
              Start My Campaign
              <Target className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
    </div>
  );
}
