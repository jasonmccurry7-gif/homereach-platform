import type { Metadata } from "next";
import { Bot, CalendarDays, Grid3X3, Mail, ShieldCheck } from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CtaButton } from "@/components/marketing/cta-button";
import { CampaignOpsVisual } from "@/components/marketing/homepage-visuals";
import { accountStartHref, PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";
import { isAiIntakeAgentEnabled } from "@/lib/ai-intake/env";

export const metadata: Metadata = {
  title: "Shared Postcards Overview | HomeReach",
  description:
    "Review the HomeReach shared postcard program before creating an account and reserving a city/category spot.",
};

const workflow = [
  {
    title: "Choose City",
    body: "Start from a city overview with 12 available postcard positions and live sold-spot visibility.",
    icon: Mail,
  },
  {
    title: "Select Category",
    body: "Category exclusivity stays intact so only one business per category can reserve in a city.",
    icon: ShieldCheck,
  },
  {
    title: "Preview Placement",
    body: "City-level postcard previews show assigned client designs in their reserved 4 x 3.5 spots.",
    icon: Grid3X3,
  },
  {
    title: "Reserve Schedule",
    body: "Move into the existing checkout, contract, payment, approval, and mail scheduling flow.",
    icon: CalendarDays,
  },
];

export default function SharedPostcardsOverviewPage() {
  const startHref = accountStartHref(PRODUCT_START_PATHS.sharedPostcards);
  const aiIntakeEnabled = isAiIntakeAgentEnabled();

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white lg:px-6">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-blue-600/25 to-transparent" />
          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <HomeReachLogo tone="light" size="sm" sublabel="Shared Postcards" />
              <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-blue-200">
                City-Level Overview
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Reserve a category-exclusive spot on a premium 9 x 12 city postcard.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Shared postcards let local businesses buy one 4 x 3.5 placement in a 12-spot city mailer. Review
                the program here, then create an account before entering the live spot selection and payment flow.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {aiIntakeEnabled && (
                  <CtaButton href="/shared-postcards/ai-intake" variant="primary">
                    Build with AI Intake
                  </CtaButton>
                )}
                <CtaButton href={startHref} variant="primary">
                  Create Account to Reserve
                </CtaButton>
                <CtaButton href="/#shared-postcards" variant="secondary">
                  View Platform Context
                </CtaButton>
              </div>
            </div>
            <CampaignOpsVisual />
          </div>
        </section>

        {aiIntakeEnabled && (
          <section className="border-b border-blue-100 bg-blue-50 px-4 py-6 lg:px-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-950">AI Conversational Intake is available</p>
                  <p className="text-sm text-slate-600">
                    Build a multi-city, multi-category cart before protected Stripe checkout.
                  </p>
                </div>
              </div>
              <CtaButton href="/shared-postcards/ai-intake" variant="secondary">
                Open AI Intake
              </CtaButton>
            </div>
          </section>
        )}

        <section className="px-4 py-16 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
                How Shared Postcards Work
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Overview first. Account second. Protected checkout flow after that.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflow.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
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
