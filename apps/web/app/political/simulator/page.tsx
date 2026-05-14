import type { Metadata } from "next";
import { CampaignStrategyPlanner } from "../_components/CampaignStrategyPlanner";
import { CommandPanel, PublicHero } from "../_components/PublicCommand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campaign Strategy Simulator - HomeReach Political",
  description: "Compare campaign mail strategies, coverage, drops, timeline, and pricing.",
};

export default function PoliticalSimulatorPage() {
  return (
    <>
      <PublicHero
        eyebrow="Strategy Simulator"
        title="Model Coverage, Precision, and Hybrid Plans"
        subtitle="Run compliant decision logic against budget, timeline, geography, route coverage, and drop count to see what plan is strongest."
        primaryHref="/political/plan"
        primaryLabel="Turn Simulation Into Proposal"
        secondaryHref="/political/data-sources"
        secondaryLabel="Compliance Rules"
      />
      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-12 lg:grid-cols-[1fr_430px]">
        <CommandPanel
          title="What the Engine Uses"
          body="Budget, geography, aggregate route counts, campaign-provided list size, drop count, and days until election. It does not use voter prediction, ideology, turnout modeling, or individual persuasion logic."
        />
        <CampaignStrategyPlanner />
      </section>
    </>
  );
}
