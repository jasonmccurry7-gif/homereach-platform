import type { Metadata } from "next";
import { Bot, CalendarDays, Grid3X3, Mail, ShieldCheck } from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { CtaButton } from "@/components/marketing/cta-button";
import { CampaignOpsVisual } from "@/components/marketing/homepage-visuals";
import { PRODUCT_START_PATHS } from "@/lib/marketing/product-routes";
import { isAiIntakeAgentEnabled } from "@/lib/ai-intake/env";
import { sharedPostcardEmotionCopy } from "@/lib/brand/emotional-positioning";

export const metadata: Metadata = {
  title: "Shared Local Visibility | HomeReach",
  description:
    "Premium shared postcard visibility for local businesses that want affordable, category-protected mailbox presence without carrying the full cost alone.",
};

const workflowIcons = [Mail, ShieldCheck, Grid3X3, CalendarDays] as const;
const workflow = sharedPostcardEmotionCopy.workflow.map((item, index) => ({
  ...item,
  icon: workflowIcons[index] ?? Mail,
}));

export default function SharedPostcardsOverviewPage() {
  const startHref = PRODUCT_START_PATHS.sharedPostcards;
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
                {sharedPostcardEmotionCopy.eyebrow}
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                {sharedPostcardEmotionCopy.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                {sharedPostcardEmotionCopy.subtitle}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {aiIntakeEnabled && (
                  <CtaButton href="/shared-postcards/ai-intake" variant="primary">
                    {sharedPostcardEmotionCopy.ctaAi}
                  </CtaButton>
                )}
                <CtaButton href={startHref} variant="primary">
                  {sharedPostcardEmotionCopy.ctaPrimary}
                </CtaButton>
                <CtaButton href="/#shared-postcards" variant="secondary">
                  {sharedPostcardEmotionCopy.ctaContext}
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
                    Build a multi-city, multi-category cart that protects your spot before protected Stripe checkout.
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
                Shared Growth, Clear Execution
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {sharedPostcardEmotionCopy.valueLine}
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
