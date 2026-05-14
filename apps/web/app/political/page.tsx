import Link from "next/link";
import type { Metadata } from "next";
import { CommandPanel, MetricBand, PublicHero, TimelinePreview } from "./_components/PublicCommand";
import { PoliticalCandidateAgentChat } from "./_components/PoliticalCandidateAgentChat";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Plan, Price, and Launch Campaign Mail in Minutes - HomeReach",
  description:
    "Map your district, compare coverage options, see costs instantly, and secure your mail drop.",
};

export default async function PoliticalLanding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const startHref = user
    ? "/political/plan"
    : `/signup?redirect=${encodeURIComponent("/political/plan")}`;

  return (
    <>
      <PublicHero
        eyebrow="Campaign Execution OS"
        title="Plan, Price, and Launch Campaign Mail in Minutes"
        subtitle="Map your district, compare coverage options, see costs instantly, and secure your mail drop."
        primaryHref={startHref}
        primaryLabel="Start Campaign Mail Plan"
        secondaryHref="/political/candidate-agent"
        secondaryLabel="Chat with Campaign AI Agent"
      />

      <section className="mx-auto max-w-7xl space-y-10 px-5 py-12">
        <section className="rounded-lg border border-blue-300/20 bg-blue-950/30 p-5 shadow-2xl shadow-blue-950/20">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-200">
                Live candidate agent
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Dr. Amy Acton for Ohio Governor is loaded and ready to chat.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                The agent shows four compliant mail campaign paths with cities, households, drops, postcard cost, aggregate voter reach, and cost per voter. It uses public campaign/election context and aggregate geography only.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/political/candidate-agent"
                className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Chat with Campaign AI Agent
              </Link>
              <Link
                href="/political/maps"
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Validate Map
              </Link>
            </div>
          </div>
        </section>

        <MetricBand
          metrics={[
            { label: "Speed", value: "60s", detail: "approve-ready plan flow" },
            { label: "Coverage", value: "1-5", detail: "drop campaign structures" },
            { label: "Trust", value: "13+", detail: "years mail logistics" },
            { label: "Control", value: "Live", detail: "coverage and pricing engine" },
          ]}
        />

        <PoliticalCandidateAgentChat />

        <div className="grid gap-4 lg:grid-cols-3">
          <CommandPanel
            title="Coverage Strategy"
            body="Broad route-level household reach using aggregate carrier-route counts. Built for awareness and district visibility."
          >
            <Link href="/political/maps" className="text-sm font-bold text-blue-200 hover:text-white">
              Open maps
            </Link>
          </CommandPanel>
          <CommandPanel
            title="Precision Strategy"
            body="Campaign-provided list mail for lawful reinforcement without voter prediction, ideology scoring, or individual persuasion modeling."
          >
            <Link href="/political/pricing" className="text-sm font-bold text-blue-200 hover:text-white">
              Price scenarios
            </Link>
          </CommandPanel>
          <CommandPanel
            title="Winning Strategy"
            body="Hybrid planning combines broad visibility with a compliant campaign-provided list layer and multi-wave timing."
          >
            <Link href="/political/simulator" className="text-sm font-bold text-blue-200 hover:text-white">
              Run simulator
            </Link>
          </CommandPanel>
        </div>

        <CommandPanel
          title="Launch Timeline"
          body="Every proposal connects strategy, pricing, drop windows, approval, payment, production, and in-home delivery timing."
        >
          <TimelinePreview />
        </CommandPanel>

        <section className="rounded-lg border border-red-300/20 bg-red-950/30 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-xl font-black text-white">Secure your mail slot</h2>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                Production windows are finite. Build a plan, compare scenarios,
                and lock the recommended route and drop schedule before capacity tightens.
              </p>
            </div>
            <Link
              href={startHref}
              className="rounded-lg bg-red-600 px-5 py-3 text-center text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
            >
              Start Campaign Mail Plan
            </Link>
          </div>
        </section>

        <CommandPanel title="Compliance Guardrails">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
                Allowed
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Geographic route planning</li>
                <li>Aggregate household counts</li>
                <li>Timing, logistics, costs, and coverage</li>
                <li>Campaign-provided list integration</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-amber-200">
                Not Used
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Voter prediction</li>
                <li>Ideology classification</li>
                <li>Individual persuasion scoring</li>
                <li>Historical results to predict individual behavior</li>
              </ul>
            </div>
          </div>
          <Link
            href="/political/data-sources"
            className="mt-5 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            View Data Sources and Methodology
          </Link>
        </CommandPanel>
      </section>
    </>
  );
}
