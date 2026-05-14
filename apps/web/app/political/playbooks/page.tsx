import type { Metadata } from "next";
import { generateCampaignStrategy, type CampaignGoal } from "@/lib/political/strategy-engine";
import { CommandPanel, PublicHero } from "../_components/PublicCommand";

export const metadata: Metadata = {
  title: "Campaign Mail Playbooks - HomeReach Political",
  description: "Campaign mail structures for awareness, persuasion, GOTV, and hybrid execution.",
};

const goals: Array<{ goal: CampaignGoal; label: string; budget: number; days: number; drops: number }> = [
  { goal: "awareness", label: "Awareness Launch", budget: 25000, days: 90, drops: 2 },
  { goal: "persuasion", label: "List Reinforcement", budget: 65000, days: 60, drops: 3 },
  { goal: "gotv", label: "GOTV Close", budget: 100000, days: 28, drops: 5 },
];

export default function PoliticalPlaybooksPage() {
  const playbooks = goals.map((item) => ({
    ...item,
    result: generateCampaignStrategy({
      goal: item.goal,
      budgetCents: item.budget * 100,
      state: "OH",
      geographyType: "county",
      geographyValue: "Franklin",
      districtType: "local",
      daysUntilElection: item.days,
      dropCount: item.drops,
      campaignListAddresses: 8500,
    }),
  }));

  return (
    <>
      <PublicHero
        eyebrow="Campaign Playbooks"
        title="Pre-Built Mail Campaign Structures"
        subtitle="Start from a proven execution model, then adjust routes, budget, waves, and timeline inside the planner."
        primaryHref="/political/plan"
        primaryLabel="Customize a Playbook"
        secondaryHref="/political/calendar"
        secondaryLabel="View Timeline"
      />
      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-12 lg:grid-cols-3">
        {playbooks.map((playbook) => (
          <CommandPanel
            key={playbook.label}
            title={playbook.label}
            body={playbook.result.whyThisPlan}
          >
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between"><span>Recommended</span><span className="font-bold text-white">{playbook.result.headline.replace("Recommended Plan: ", "")}</span></div>
              <div className="flex justify-between"><span>Drops</span><span>{playbook.drops}</span></div>
              <div className="flex justify-between"><span>Strength</span><span>{playbook.result.coverageStrengthScore}/100</span></div>
              <div className="flex justify-between"><span>Confidence</span><span>{playbook.result.deliveryConfidence}</span></div>
            </div>
          </CommandPanel>
        ))}
      </section>
    </>
  );
}
