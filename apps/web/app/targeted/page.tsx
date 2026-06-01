import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock3,
  Compass,
  Gauge,
  Layers,
  LockKeyhole,
  MapPinned,
  Megaphone,
  MousePointerClick,
  Radar,
  Repeat2,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CtaButton } from "@/components/marketing/cta-button";
import { TargetedTerritoryCommandVisual } from "@/components/marketing/homepage-visuals";
import { PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";
import {
  formatTargetedCampaignDollars,
  getTargetedCampaignTotalCents,
  TARGETED_CAMPAIGN_PLAYBOOKS,
  TARGETED_PRICING_TIERS,
} from "@/lib/targeted/pricing";

export const metadata: Metadata = {
  title: "Neighborhood Customer Acquisition Platform | HomeReach Targeted Mail",
  description:
    "HomeReach helps local businesses plan, approve, and launch premium neighborhood campaigns with route-level targeting, homeowner reach, campaign visibility, and human-reviewed execution.",
  alternates: { canonical: "/targeted" },
  openGraph: {
    title: "Neighborhood Customer Acquisition Platform | HomeReach",
    description:
      "A premium route-level visibility system for local businesses that need controlled neighborhood growth, not generic direct mail.",
  },
};

const launchSignals = [
  {
    label: "Protected Category Review",
    value: "Human approved",
    body: "Category protection and territory conflicts are checked before a campaign moves forward.",
    icon: LockKeyhole,
  },
  {
    label: "Neighborhood Availability",
    value: "Limited by route",
    body: "HomeReach reviews route capacity, timing, and saturation before launch.",
    icon: MapPinned,
  },
  {
    label: "Founding Rate Lock",
    value: "Request first",
    body: "Early campaigns can be reviewed for rate-lock eligibility before checkout.",
    icon: ShieldCheck,
  },
];

const workflow = [
  {
    title: "Choose Area",
    body: "Tell us the neighborhood, ZIP, radius, or service zone you want to own.",
    icon: MapPinned,
  },
  {
    title: "Approve Campaign",
    body: "HomeReach prepares the plan, package, timeline, and creative direction for review.",
    icon: CheckCircle2,
  },
  {
    title: "Reach Homeowners",
    body: "Your campaign is produced and mailed to the approved homeowner territory.",
    icon: Route,
  },
  {
    title: "Generate Customers",
    body: "Use visibility, repetition, QR pages, and follow-up paths to turn attention into conversations.",
    icon: TrendingUp,
  },
];

const differences = [
  {
    title: "No coupon clutter",
    body: "HomeReach sells premium visibility and market presence, not cheap crowded coupon aesthetics.",
    icon: Layers,
  },
  {
    title: "No print-shop confusion",
    body: "The system recommends reach, timing, package fit, and next steps instead of forcing owners to decode mail terminology.",
    icon: Sparkles,
  },
  {
    title: "No operational opacity",
    body: "Customers see the path from route selection to approval, production, mail timing, and follow-up.",
    icon: Radar,
  },
  {
    title: "No generic geography",
    body: "Campaigns are framed around neighborhoods, service zones, homeowner reach, and local market penetration.",
    icon: Target,
  },
];

const trustBuilders = [
  "Premium campaign design and homeowner-facing creative direction",
  "Design, print, postage, and delivery included in the campaign path",
  "Human review before payment-sensitive or launch-sensitive actions",
  "Clear route notes, homeowner reach, package fit, and launch timeline",
  "Approval-first execution for creative, production, and campaign changes",
  "Built inside the existing HomeReach operations and campaign systems",
];

const operatorSegments = [
  {
    title: "Home service operators",
    body: "Roofing, HVAC, plumbing, landscaping, remodeling, flooring, solar, pest control, concrete, and exterior services.",
    icon: Target,
  },
  {
    title: "Local trust categories",
    body: "Dentists, med spas, chiropractors, insurance teams, realtors, and professional services that win through repetition.",
    icon: UsersRound,
  },
  {
    title: "Campaign and field teams",
    body: "Organizations that need clean geography, clear timing, controlled approvals, and market-level visibility.",
    icon: Megaphone,
  },
];

const ownershipModel = [
  {
    title: "Claim the route",
    body: "Start with the neighborhoods where your best customers already live, search, and refer.",
    icon: Compass,
  },
  {
    title: "Saturate attention",
    body: "Use homeowner reach, premium creative, and launch timing to become harder to ignore.",
    icon: Gauge,
  },
  {
    title: "Repeat momentum",
    body: "Reorder, expand, or layer follow-up so visibility compounds instead of restarting every campaign.",
    icon: Repeat2,
  },
];

export default function TargetedLandingPage() {
  const startHref = PRODUCT_START_PATHS.targetedCampaigns;

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader variant="targeted" />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:54px_54px]" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-blue-600/25 to-transparent" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-6 lg:py-20">
            <div>
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                Localized Customer Acquisition OS
              </p>
              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Own the neighborhoods your next customers drive through every day.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                HomeReach turns targeted mail into a guided neighborhood growth system for roofing, HVAC, plumbing,
                landscaping, remodeling, pest control, and other local businesses that need route-level visibility and
                simpler execution.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaButton href={startHref} variant="primary">
                  Build My Territory Plan
                </CtaButton>
                <CtaButton href="#how-it-works" variant="secondary">
                  See How It Works
                </CtaButton>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {launchSignals.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-3">
                      <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                      <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <TargetedTerritoryCommandVisual className="min-h-[35rem]" />
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-8 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3">
            {launchSignals.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-slate-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                Built For Local Operators
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                The owner should feel guided before they ever think about print specs.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Targeted Mail is framed around market pressure, homeowner visibility, protected categories, and
                next-step confidence for businesses that already know neighborhoods matter.
              </p>
              <div className="mt-6 grid gap-3">
                {ownershipModel.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-slate-950">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              {operatorSegments.map((segment) => {
                const Icon = segment.icon;
                return (
                  <div key={segment.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-black text-slate-950">{segment.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{segment.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-28 px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                How It Works
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Four steps from local pressure to a reviewed neighborhood campaign.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                The customer does not need to learn direct mail. HomeReach guides the strategy, package, geography,
                approval, production, and follow-up path.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="packages" className="scroll-mt-28 bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-200">
                  Productized Campaign Packages
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Pick the growth outcome, not the print math.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  Each package includes design, print, postage, delivery coordination, and a human-reviewed launch path.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TARGETED_PRICING_TIERS.map((tier) => (
                  <div
                    key={tier.homes}
                    className="relative rounded-lg border border-white/10 bg-white/[0.08] p-4"
                  >
                    {"popular" in tier && tier.popular ? (
                      <span className="absolute right-3 top-3 rounded-full bg-blue-500 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                        Recommended
                      </span>
                    ) : null}
                    <p className="pr-24 text-lg font-black text-white">{tier.label}</p>
                    <p className="mt-3 text-3xl font-black text-blue-100">
                      {tier.homes.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                      households reached
                    </p>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{tier.purpose}</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-300">
                      <p>{tier.neighborhoods}</p>
                      <p>{tier.frequency}</p>
                      <p>{tier.visibilityImpact}</p>
                    </div>
                    <p className="mt-5 text-xl font-black text-white">
                      {formatTargetedCampaignDollars(getTargetedCampaignTotalCents(tier))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">
                Why HomeReach Wins
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Built to feel like market control, not a postcard order form.
              </h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {differences.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
                      <h3 className="mt-4 text-base font-black text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <TargetedTerritoryCommandVisual mode="compact" className="min-h-[29rem]" />
          </div>
        </section>

        <section id="ai-assistance" className="scroll-mt-28 px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                AI Assistance Layer
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                The system recommends the next smart move.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                HomeReach can recommend package fit, campaign timing, route notes, and expansion ideas while keeping
                customer-facing actions approval-first.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {TARGETED_CAMPAIGN_PLAYBOOKS.map((playbook) => (
                <div key={playbook.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Sparkles className="h-5 w-5 text-blue-700" aria-hidden="true" />
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                      {playbook.packageHomes.toLocaleString()} homes
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{playbook.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{playbook.signal}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="trust-builders" className="scroll-mt-28 bg-white px-4 py-16 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">
                Trust Builders
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Premium execution with the approval gates local businesses need.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trustBuilders.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-200">
                Routes Fill By Category, Timing, And Capacity
              </p>
              <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">
                Secure the neighborhoods you want reviewed before a competitor makes them harder to own.
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Speed to launch", icon: Clock3 },
                  { label: "Owner visibility", icon: UsersRound },
                  { label: "Clear next action", icon: MousePointerClick },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
                      <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                      <p className="mt-3 text-sm font-black text-white">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:min-w-72">
              <CtaButton href={startHref} variant="primary" className="w-full">
                Start Territory Review
              </CtaButton>
              <CtaButton href="/shared-postcards" variant="secondary" className="w-full">
                Compare Shared Campaigns
              </CtaButton>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
