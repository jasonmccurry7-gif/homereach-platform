import type { Metadata } from "next";
import { CommandPanel, PublicHero } from "../_components/PublicCommand";
import { PoliticalInteractiveMapLoader } from "../_components/PoliticalInteractiveMapLoader";
import {
  buildStrategySelectionPlans,
  getStrategySelectionCandidate,
} from "@/lib/political/campaign-strategy-selection";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "PoliticalReach Campaign Route Maps - HomeReach",
  description:
    "Select routes, see coverage, compare scenarios, and move directly to proposal.",
};

type PoliticalMapsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function PoliticalMapsPage({
  searchParams,
}: {
  searchParams?: PoliticalMapsSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const rawCandidate = Array.isArray(params.candidate)
    ? params.candidate[0]
    : params.candidate;
  const rawStrategy = Array.isArray(params.strategy)
    ? params.strategy[0]
    : params.strategy;
  const selectedCandidate = rawCandidate
    ? getStrategySelectionCandidate(rawCandidate)
    : null;
  const selectedPlans = selectedCandidate
    ? buildStrategySelectionPlans(selectedCandidate)
    : [];
  const selectedPlan =
    selectedPlans.find((plan) => plan.id === rawStrategy) ??
    selectedPlans.find(
      (plan) => `${selectedCandidate?.id}:${plan.id}` === rawStrategy,
    ) ??
    selectedPlans[0] ??
    null;
  const planContext =
    selectedCandidate && selectedPlan
      ? {
          candidateId: selectedCandidate.id,
          candidateName: selectedCandidate.candidateName,
          office: selectedCandidate.office,
          electionDate: selectedCandidate.electionYear,
          strategyId: selectedPlan.id,
          strategyTitle: selectedPlan.title,
          countiesIncluded: selectedPlan.countiesIncluded,
          citiesIncluded: selectedPlan.citiesIncluded,
          drops: selectedPlan.drops,
        }
      : null;

  return (
    <>
      <PublicHero
        eyebrow="Route Intelligence"
        title="Interactive Political Coverage Maps"
        subtitle="Select Ohio, Illinois, or Tennessee, toggle county, ZIP, city, and district planning views, then review route-safe estimates with clear demo-data and checkout guardrails."
        primaryHref="/political/plan"
        primaryLabel="Start Coverage Plan"
        secondaryHref="/political/routes"
        secondaryLabel="View Route Catalog"
      />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <PoliticalInteractiveMapLoader initialPlanContext={planContext} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <CommandPanel
            title="Map Operating Model"
            body="The map starts with real county geometry, uses Ohio's official 2026-2032 congressional district layer in District mode, and keeps USPS cells marked as demo until carrier-route polygons are imported."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {["Coverage %", "Cost per household", "Route gaps"].map(
                (label) => (
                  <div
                    key={label}
                    className="rounded-lg border border-white/10 bg-slate-900 p-4"
                  >
                    <div className="text-sm font-bold text-white">{label}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      Updates live as routes, drops, budget, and strategy
                      change.
                    </div>
                  </div>
                ),
              )}
            </div>
          </CommandPanel>
          <CommandPanel
            title="Compliance Safe"
            body="Maps are geographic and operational only. They do not classify voters, infer ideology, predict turnout, or model persuasion."
          />
        </div>
      </section>
    </>
  );
}
