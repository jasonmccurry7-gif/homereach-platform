import type { Metadata } from "next";
import { generateCampaignStrategy } from "@/lib/political/strategy-engine";
import { CommandPanel, PublicHero, TimelinePreview } from "../_components/PublicCommand";

export const metadata: Metadata = {
  title: "Political Mail Calendar - HomeReach Political",
  description: "Plan print deadlines, mail cutoffs, drop waves, and in-home delivery windows.",
};

export default function PoliticalCalendarPage() {
  const recommendation = generateCampaignStrategy({
    goal: "gotv",
    budgetCents: 50_000_00,
    state: "OH",
    geographyType: "county",
    geographyValue: "Franklin",
    districtType: "local",
    daysUntilElection: 45,
    dropCount: 3,
    campaignListAddresses: 7500,
  });

  return (
    <>
      <PublicHero
        eyebrow="Timing Intelligence"
        title="Plan Mail Drops Around the Election Calendar"
        subtitle="Turn election dates into print deadlines, mail cutoffs, drop windows, and urgency messaging."
        primaryHref="/political/timeline"
        primaryLabel="Calculate My Timeline"
        primaryRequiresAccount={false}
        secondaryHref="/political/pricing"
        secondaryLabel="Pricing Options"
      />
      <section className="mx-auto max-w-7xl space-y-6 px-5 py-12">
        <CommandPanel title="Execution Timeline" body={recommendation.timeToImpact.printDeadlineText}>
          <TimelinePreview />
        </CommandPanel>
        <CommandPanel title="Suggested Drop Schedule">
          <div className="grid gap-3 md:grid-cols-3">
            {recommendation.suggestedDropSchedule.map((drop) => (
              <div key={drop.wave} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                  Wave {drop.wave}
                </div>
                <div className="mt-2 text-lg font-black text-white">{drop.objective}</div>
                <div className="mt-1 text-sm text-slate-300">
                  {drop.daysBeforeElection !== null ? `${drop.daysBeforeElection} days before election` : "Election date needed"}
                </div>
                <div className="mt-2 font-mono text-sm text-blue-200">
                  {drop.volume.toLocaleString()} pieces
                </div>
              </div>
            ))}
          </div>
        </CommandPanel>
      </section>
    </>
  );
}
