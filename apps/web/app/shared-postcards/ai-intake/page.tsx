import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { isAiIntakeAgentEnabled } from "@/lib/ai-intake/env";
import { AiIntakeAgentClient } from "./ai-intake-agent-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Shared Postcard Intake | HomeReach",
  description:
    "Build a multi-city, multi-category shared postcard cart with guided AI intake.",
};

export default function SharedPostcardsAiIntakePage() {
  if (!isAiIntakeAgentEnabled()) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 px-4 py-12 text-white lg:px-6">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-600/25 to-transparent" />
          <div className="relative mx-auto max-w-7xl">
            <HomeReachLogo tone="light" size="sm" sublabel="Shared Postcards" />
            <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-blue-200">
              Conversational Intake
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
              Build a shared-postcard cart with guided city, category, and placement logic.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
              Add multiple cities and categories, review availability, apply eligible discounts,
              confirm the order, then continue into protected Stripe checkout.
            </p>
          </div>
        </section>

        <AiIntakeAgentClient />
      </main>
      <SiteFooter />
    </div>
  );
}
