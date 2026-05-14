import type { Metadata } from "next";
import { InstantQuote } from "../_components/InstantQuote";
import { CommandPanel, MetricBand, PublicHero } from "../_components/PublicCommand";

export const metadata: Metadata = {
  title: "Campaign Mail Pricing - HomeReach Political",
  description: "Compare coverage, precision, and hybrid campaign mail strategies with live pricing logic.",
};

export default function PoliticalPricingPage() {
  return (
    <>
      <PublicHero
        eyebrow="Pricing Strategy"
        title="Compare Campaign Mail Investment Before You Commit"
        subtitle="See budget-to-coverage tradeoffs, multi-drop cost scaling, payment options, and proposal-ready pricing without waiting on a manual quote."
        primaryHref="/political/plan"
        primaryLabel="Generate Proposal"
        secondaryHref="/political/simulator"
        secondaryLabel="Run Simulator"
      />
      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-12 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <MetricBand
            metrics={[
              { label: "Coverage", value: "EDDM", detail: "broad household visibility" },
              { label: "Precision", value: "List", detail: "campaign-provided addresses" },
              { label: "Hybrid", value: "Win", detail: "coverage plus reinforcement" },
              { label: "Payments", value: "4", detail: "deposit, full, milestone, subscription" },
            ]}
          />
          <CommandPanel title="Strategy Comparison">
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-300">
                  <tr>
                    <th className="px-3 py-3">Strategy</th>
                    <th className="px-3 py-3">Reach</th>
                    <th className="px-3 py-3">Cost</th>
                    <th className="px-3 py-3">Best Use</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  <tr><td className="px-3 py-3 font-bold">Coverage</td><td className="px-3 py-3">High</td><td className="px-3 py-3">Lower</td><td className="px-3 py-3">Awareness</td></tr>
                  <tr><td className="px-3 py-3 font-bold">Precision</td><td className="px-3 py-3">Medium</td><td className="px-3 py-3">Medium</td><td className="px-3 py-3">List reinforcement</td></tr>
                  <tr><td className="px-3 py-3 font-bold">Hybrid</td><td className="px-3 py-3">Maximum</td><td className="px-3 py-3">Higher</td><td className="px-3 py-3">Winning Strategy</td></tr>
                </tbody>
              </table>
            </div>
          </CommandPanel>
        </div>
        <InstantQuote />
      </section>
    </>
  );
}
