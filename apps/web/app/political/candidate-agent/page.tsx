import { ShieldCheck } from "lucide-react";
import { PoliticalClientCampaignPlanner } from "../_components/PoliticalClientCampaignPlanner";
import { PoliticalCandidateAgentChat } from "../_components/PoliticalCandidateAgentChat";
import {
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  type CandidateTargetId,
} from "@/lib/political/candidate-agent-recommendations";
import {
  getStrategySelectionCandidate,
  type StrategySelectionCandidate,
} from "@/lib/political/campaign-strategy-selection";
import { loadPublicPoliticalCandidatesForPlanner } from "@/lib/political/public-candidates";

export const dynamic = "force-dynamic";
export const metadata = { title: "PoliticalReach AI Campaign Agent - HomeReach" };

type CandidateAgentSearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeCandidateLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveInitialCandidateId(
  value: string | string[] | undefined,
): CandidateTargetId | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return MULTI_CANDIDATE_CAMPAIGN_AGENTS.some(
    (agent) => agent.profile.id === candidate,
  )
    ? (candidate as CandidateTargetId)
    : undefined;
}

function findCandidateOption(
  value: string | undefined,
  candidates: StrategySelectionCandidate[],
) {
  if (!value) return undefined;
  const normalized = normalizeCandidateLookup(value);
  return candidates.find(
    (candidate) =>
      normalizeCandidateLookup(candidate.id) === normalized ||
      normalizeCandidateLookup(candidate.candidateName) === normalized,
  );
}

export default async function PoliticalCandidateAgentOverviewPage({
  searchParams,
}: {
  searchParams?: CandidateAgentSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const candidateOptions = await loadPublicPoliticalCandidatesForPlanner();
  const rawCandidateParam = Array.isArray(params.candidate)
    ? params.candidate[0]
    : params.candidate;
  const initialCandidateId = resolveInitialCandidateId(params.candidate);
  const selectedCampaign =
    findCandidateOption(rawCandidateParam, candidateOptions) ??
    getStrategySelectionCandidate(rawCandidateParam ?? initialCandidateId ?? "amy-acton");

  return (
    <main className="mx-auto w-full max-w-[100vw] space-y-6 overflow-x-hidden px-4 py-6 sm:px-5 lg:py-8 xl:max-w-7xl">
      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.94))] p-5 shadow-2xl shadow-slate-950/40">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
              Political Campaign Planner
            </p>
            <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
              {selectedCampaign.candidateName} campaign dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Choose the campaign, compare four side-by-side mail plans, and
              use the visible AI chat for planning questions before requesting a
              reviewed plan.
            </p>
          </div>
          <aside className="rounded-xl border border-emerald-300/20 bg-emerald-950/20 p-4 text-sm leading-6 text-emerald-50">
            <div className="flex items-center gap-2 font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Safe planning boundary
            </div>
            <p className="mt-2">
              {selectedCampaign.office} / {selectedCampaign.party}. Aggregate
              geography, timing, budget, and production planning only. Human
              approval remains required before outreach, proposal, payment, or
              production.
            </p>
          </aside>
        </div>
      </section>

      <PoliticalCandidateAgentChat
        candidateOptions={candidateOptions}
        initialCandidateId={initialCandidateId}
        mode="compact"
      />

      <PoliticalClientCampaignPlanner
        candidateOptions={candidateOptions}
        initialCandidateId={rawCandidateParam}
      />
    </main>
  );
}
