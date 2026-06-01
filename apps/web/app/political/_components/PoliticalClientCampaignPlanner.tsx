"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  MapPinned,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  buildCustomStrategySelectionCandidate,
  buildStrategySelectionPlans,
  findStrategySelectionCandidate,
  getDefaultStrategySelectionCandidateId,
  getStrategySelectionCandidate,
  OHIO_STATEWIDE_COUNTIES,
  STRATEGY_SELECTION_CANDIDATES,
  type StrategySelectionCandidate,
  type StrategySelectionPlan,
} from "@/lib/political/campaign-strategy-selection";
import { ohioHistoricalMapTone } from "@/lib/political/county-presidential-results-2024";
import {
  OhioCountyMap,
  type OhioCountyMapCity,
  type OhioCountyMapCounty,
} from "./OhioCountyMap";

type FilterValue =
  | "all"
  | "Democrat"
  | "Republican"
  | "Statewide"
  | "Mayoral"
  | "County"
  | "Legislative"
  | "School Board"
  | "Nonpartisan"
  | "Other";

const FILTERS: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Democrat", value: "Democrat" },
  { label: "Republican", value: "Republican" },
  { label: "Statewide", value: "Statewide" },
  { label: "Mayoral", value: "Mayoral" },
  { label: "County", value: "County" },
  { label: "Legislative", value: "Legislative" },
  { label: "School Board", value: "School Board" },
  { label: "Nonpartisan", value: "Nonpartisan" },
  { label: "Other", value: "Other" },
];

const CARD_STYLES = [
  {
    cap: "from-red-600 to-red-800",
    shadow: "shadow-red-950/35",
    badge: "text-red-700",
  },
  {
    cap: "from-blue-600 to-blue-900",
    shadow: "shadow-blue-950/35",
    badge: "text-blue-700",
  },
  {
    cap: "from-blue-700 to-red-700",
    shadow: "shadow-blue-950/35",
    badge: "text-blue-800",
  },
  {
    cap: "from-slate-950 to-blue-950",
    shadow: "shadow-slate-950/40",
    badge: "text-blue-950",
  },
] as const;

const CANDIDATE_READINESS = {
  source_backed: {
    label: "Source-linked profile",
    detail:
      "Public or campaign sources are attached; human review is still required before client use.",
    className: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  },
  needs_source_verification: {
    label: "Needs source verification",
    detail:
      "Workspace is ready for planning, but candidate details and sources must be verified.",
    className: "border-amber-300/25 bg-amber-500/10 text-amber-100",
  },
  admin_review: {
    label: "Admin review needed",
    detail: "Internal review must clear this campaign before proposal or production.",
    className: "border-blue-300/25 bg-blue-500/10 text-blue-100",
  },
} satisfies Record<
  StrategySelectionCandidate["status"],
  { label: string; detail: string; className: string }
>;

const PLAN_READINESS = {
  planning_estimate: {
    label: "Planning estimate",
    detail: "Uses modeled households and route logic. Not a checkout quote.",
    className: "border-amber-300/25 bg-amber-50 text-amber-800",
  },
  needs_usps_counts: {
    label: "USPS counts needed",
    detail: "Carrier-route or EDDM counts must be imported before quote lock.",
    className: "border-amber-300/25 bg-amber-50 text-amber-800",
  },
  ready_for_admin_review: {
    label: "Admin review ready",
    detail: "Ready for operator review, not final human approval.",
    className: "border-blue-300/30 bg-blue-50 text-blue-800",
  },
} satisfies Record<
  StrategySelectionPlan["productionStatus"],
  { label: string; detail: string; className: string }
>;

const STATEWIDE_FOCUS_COUNTIES = [
  "Franklin",
  "Cuyahoga",
  "Hamilton",
  "Summit",
  "Lucas",
  "Montgomery",
] as const;

const STATEWIDE_CITY_ANCHORS = [
  "Columbus",
  "Cleveland",
  "Cincinnati",
  "Akron",
  "Toledo",
  "Dayton",
] as const;

const NON_PLOTTABLE_GEO_LABELS = new Set([
  "Adjacent county",
  "County seat",
  "Nearby route cluster",
  "Primary suburbs",
]);

function safeCustomCandidateQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeCampaignLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function findCandidateInUniverse(
  value: string | undefined,
  candidates: StrategySelectionCandidate[],
) {
  if (!value) return undefined;
  const normalized = normalizeCampaignLookup(value);
  return candidates.find(
    (candidate) =>
      normalizeCampaignLookup(candidate.id) === normalized ||
      normalizeCampaignLookup(candidate.candidateName) === normalized,
  );
}

function uniqueSourceLinks(candidate: StrategySelectionCandidate) {
  const seen = new Set<string>();
  return (candidate.verificationSources ?? []).filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function planMetric(plan: StrategySelectionPlan, label: string) {
  return plan.metrics.find((metric) => metric.label === label)?.value ?? "-";
}

function planDecisionMeta(plan: StrategySelectionPlan) {
  const costPerHousehold = planMetric(plan, "Cost / household");

  if (plan.optionLabel === "A") {
    return {
      useCase: "Name ID and broad visibility",
      audience: "District-wide households",
      action: `Lock review for ${plan.drops} drops`,
      economics: `${costPerHousehold} modeled CPH`,
    };
  }

  if (plan.optionLabel === "B") {
    return {
      useCase: "Efficient metro or county focus",
      audience: "Highest-density route clusters",
      action: "Inspect route fit before quote",
      economics: `${costPerHousehold} modeled CPH`,
    };
  }

  if (plan.optionLabel === "C") {
    return {
      useCase: "Suburban or rural balance",
      audience: "Mixed community coverage",
      action: "Compare gaps and expansion",
      economics: `${costPerHousehold} modeled CPH`,
    };
  }

  return {
    useCase: "Late-window acceleration",
    audience: "Fastest reachable households",
    action: "Request deadline review",
    economics: `${costPerHousehold} modeled CPH`,
  };
}

function candidateGeographyLabel(candidate: StrategySelectionCandidate) {
  if (candidate.raceType === "Statewide" || candidate.district.toLowerCase().includes("statewide")) {
    return `${candidate.geography} statewide`;
  }

  if (candidate.district && candidate.district !== "Ohio campaign geography") {
    return candidate.district;
  }

  return candidate.geography || candidate.county;
}

function planHref(candidate: StrategySelectionCandidate, plan: StrategySelectionPlan) {
  const params = new URLSearchParams({
    candidate: candidate.candidateName,
    candidateId: candidate.id,
    strategy: plan.id,
    option: plan.optionLabel,
    geography: candidateGeographyLabel(candidate),
    readiness: PLAN_READINESS[plan.productionStatus].label,
  });

  return `/political/plan?${params.toString()}`;
}

function candidateUrlValue(
  candidate: StrategySelectionCandidate,
  customCandidate: StrategySelectionCandidate | null,
) {
  return customCandidate?.id === candidate.id ? candidate.candidateName : candidate.id;
}

function planAiPrompt(candidate: StrategySelectionCandidate, plan: StrategySelectionPlan) {
  return [
    `Explain Option ${plan.optionLabel}, ${plan.title}, for ${candidate.candidateName}.`,
    `Use the selected candidate workspace only: ${candidate.office}, ${candidate.party}, ${candidateGeographyLabel(candidate)}.`,
    `Focus on aggregate geography, ${plan.drops} drops, ${planMetric(plan, "Households")} households, ${planMetric(plan, "Total cost")} planning cost, and ${plan.uspsRoutesIncluded.toLocaleString()} modeled USPS routes.`,
    "List the verification items needed before proposal, outreach, checkout, or production.",
  ].join(" ");
}

function candidateAiPrompt(
  candidate: StrategySelectionCandidate,
  plans: StrategySelectionPlan[],
) {
  const topPlan = plans[0];

  if (!topPlan) {
    return `Load ${candidate.candidateName} and summarize the campaign review workspace, missing public sources, contact data, geography, and approval gates.`;
  }

  return [
    `Summarize the current campaign manager readout for ${candidate.candidateName}.`,
    `Compare the four options at a high level, starting with Option ${topPlan.optionLabel}, ${topPlan.title}.`,
    "Keep it inside aggregate geography, route logistics, timing, budget, and human approval gates.",
  ].join(" ");
}

export function PoliticalClientCampaignPlanner({
  initialCandidateId = getDefaultStrategySelectionCandidateId(),
  candidateOptions,
}: {
  initialCandidateId?: string;
  candidateOptions?: StrategySelectionCandidate[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateUniverse = useMemo(
    () =>
      candidateOptions && candidateOptions.length > 0
        ? candidateOptions
        : STRATEGY_SELECTION_CANDIDATES,
    [candidateOptions],
  );
  const [candidateId, setCandidateId] = useState(
    () =>
      findCandidateInUniverse(initialCandidateId, candidateUniverse)?.id ??
      getStrategySelectionCandidate(initialCandidateId).id,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [customCandidate, setCustomCandidate] =
    useState<StrategySelectionCandidate | null>(null);
  const [notice, setNotice] = useState(
    "Select a candidate to compare four campaign mail options.",
  );

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sourceCandidates = customCandidate
      ? [customCandidate, ...candidateUniverse]
      : candidateUniverse;

    return sourceCandidates.filter((candidate) => {
      const haystack = [
        candidate.candidateName,
        candidate.office,
        candidate.party,
        candidate.geography,
        candidate.county,
        candidate.district,
        candidate.electionYear,
        candidate.raceType,
        candidate.campaignStatus,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        !normalizedQuery || haystack.includes(normalizedQuery);
      const normalizedFilter = filter.toLowerCase();
      const normalizedParty = candidate.party.toLowerCase();
      const normalizedRaceType = candidate.raceType.toLowerCase();
      const matchesFilter =
        filter === "all" ||
        normalizedParty.includes(normalizedFilter) ||
        normalizedRaceType === normalizedFilter ||
        (filter === "Other" &&
          !["democrat", "republican", "nonpartisan"].some((party) =>
            normalizedParty.includes(party),
          ));
      return matchesQuery && matchesFilter;
    });
  }, [candidateUniverse, customCandidate, filter, query]);

  const selectedCandidate = useMemo(
    () =>
      customCandidate?.id === candidateId
        ? customCandidate
        : findCandidateInUniverse(candidateId, candidateUniverse) ??
          getStrategySelectionCandidate(candidateId),
    [candidateId, candidateUniverse, customCandidate],
  );
  const plans = useMemo(
    () => buildStrategySelectionPlans(selectedCandidate),
    [selectedCandidate],
  );
  const candidateReadiness = CANDIDATE_READINESS[selectedCandidate.status];
  const selectedGeography = candidateGeographyLabel(selectedCandidate);
  const sourceLinks = uniqueSourceLinks(selectedCandidate);
  const highestReachPlan = useMemo(
    () => {
      const firstPlan = plans[0];
      if (!firstPlan) return null;
      return plans.reduce(
        (best, plan) =>
          plan.estimatedVoterReach > best.estimatedVoterReach ? plan : best,
        firstPlan,
      );
    },
    [plans],
  );

  useEffect(() => {
    const candidateParam = searchParams?.get("candidate");
    if (!candidateParam) return;
    const nextCandidate =
      findCandidateInUniverse(candidateParam, candidateUniverse) ??
      findStrategySelectionCandidate(candidateParam) ??
      buildCustomStrategySelectionCandidate(candidateParam);
    if (
      !findCandidateInUniverse(candidateParam, candidateUniverse) &&
      !findStrategySelectionCandidate(candidateParam)
    ) {
      setCustomCandidate(nextCandidate);
      setQuery(nextCandidate.candidateName);
    }
    if (nextCandidate.id === candidateId) return;
    setCandidateId(nextCandidate.id);
    setNotice(`${nextCandidate.candidateName} loaded.`);
  }, [candidateId, candidateUniverse, searchParams]);

  function selectCandidate(nextCandidate: StrategySelectionCandidate) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("candidate", nextCandidate.id);
    if (nextCandidate.id !== customCandidate?.id) {
      setCustomCandidate(null);
    }
    setCandidateId(nextCandidate.id);
    setNotice(
      `${nextCandidate.candidateName} loaded. Four campaign options are ready.`,
    );
    router.replace(`/political?${params.toString()}`, {
      scroll: false,
    });
  }

  function generateCustomCandidate() {
    const safeQuery = safeCustomCandidateQuery(query);
    if (!safeQuery) return;
    const generatedCandidate = buildCustomStrategySelectionCandidate(safeQuery);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("candidate", generatedCandidate.candidateName);
    setCustomCandidate(generatedCandidate);
    setCandidateId(generatedCandidate.id);
    setNotice(
      `${generatedCandidate.candidateName} intake workspace generated. The four-option plan is ready for source verification and human review.`,
    );
    router.replace(`/political?${params.toString()}`, { scroll: false });
  }

  function askCampaignAi(prompt: string, plan?: StrategySelectionPlan) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("candidate", candidateUrlValue(selectedCandidate, customCandidate));
    router.replace(`/political?${params.toString()}#campaign-ai-chat`, {
      scroll: false,
    });
    window.requestAnimationFrame(() => {
      document
        .querySelector("#campaign-ai-chat")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.dispatchEvent(
        new CustomEvent("political-campaign-ai-prompt", {
          detail: {
            prompt,
            candidateId: selectedCandidate.id,
            candidateName: selectedCandidate.candidateName,
            filter,
            query: query.trim(),
            planContext: plan
              ? {
                  optionLabel: plan.optionLabel,
                  title: plan.title,
                  candidateName: selectedCandidate.candidateName,
                  geography: candidateGeographyLabel(selectedCandidate),
                  estimatedVoterReach: plan.estimatedVoterReach,
                  drops: plan.drops,
                  uspsRoutesIncluded: plan.uspsRoutesIncluded,
                  totalCampaignCostCents: plan.totalCampaignCostCents,
                  householdsLabel: planMetric(plan, "Households"),
                  totalCostLabel: planMetric(plan, "Total cost"),
                  productionStatus: PLAN_READINESS[plan.productionStatus].label,
                }
              : null,
          },
        }),
      );
    });
  }

  function askCampaignAiAboutPlan(plan: StrategySelectionPlan) {
    askCampaignAi(planAiPrompt(selectedCandidate, plan), plan);
  }

  const showCustomCandidatePrompt =
    filteredCandidates.length === 0 && safeCustomCandidateQuery(query).length >= 3;

  return (
    <section id="campaign-options" className="scroll-mt-24 space-y-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] shadow-2xl shadow-slate-950/40">
        <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <CandidatePortrait candidate={selectedCandidate} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-blue-100">
                  <span className={`rounded-full border px-3 py-1 ${candidateReadiness.className}`}>
                    {candidateReadiness.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                    Four campaign options
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
                  {selectedCandidate.candidateName}
                </h2>
                <p className="mt-2 text-base font-semibold text-slate-200">
                  {selectedCandidate.office} / {selectedCandidate.party}
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                  Pick a candidate, book a consultation, then compare four
                  side-by-side mail plans. Every number below is a planning
                  estimate until public sources, geography, USPS counts,
                  pricing, and human approval are complete.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={planHref(selectedCandidate, plans[0]!)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Book Your Consultation
                  </Link>
                  <button
                    type="button"
                    onClick={() => askCampaignAi(candidateAiPrompt(selectedCandidate, plans))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/25 bg-blue-500/15 px-4 py-3 text-sm font-black text-blue-50 transition hover:bg-blue-500/25"
                  >
                    <Bot className="h-4 w-4" />
                    Ask Campaign AI
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <TruthMetric
                icon={MapPinned}
                label="Aggregate geography"
                value={selectedGeography}
                detail={`${selectedCandidate.county} / ${selectedCandidate.raceType}`}
              />
              <TruthMetric
                icon={CalendarDays}
                label="Election year"
                value={selectedCandidate.electionYear}
                detail={selectedCandidate.campaignStatus}
              />
              <TruthMetric
                icon={ClipboardCheck}
                label="Approval status"
                value="Review required"
                detail="No outreach, checkout, or production without human approval."
              />
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Source status
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {selectedCandidate.sourceNote}
                  </p>
                </div>
                {sourceLinks.length > 0 ? (
                  <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                    {sourceLinks.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-50 transition hover:bg-emerald-500/20"
                        title={source.note}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {source.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex shrink-0 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-50">
                    Public source research required
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <CampaignReadout
                label="Manager next step"
                value={sourceLinks.length > 0 ? "Verify contact path" : "Find campaign contact"}
                detail={
                  sourceLinks.length > 0
                    ? "Confirm campaign manager email, reply owner, disclaimer needs, and final route-count source."
                    : "Source a public campaign site, campaign manager email, or filing contact before outreach draft use."
                }
              />
              <CampaignReadout
                label="Best option to inspect"
                value={highestReachPlan ? `Option ${highestReachPlan.optionLabel}` : "Review options"}
                detail={
                  highestReachPlan
                    ? `${highestReachPlan.title}: ${highestReachPlan.estimatedVoterReach.toLocaleString()} modeled reach across ${highestReachPlan.drops} drops.`
                    : "Generate or reload campaign options before comparing modeled reach."
                }
              />
              <CampaignReadout
                label="AI context loaded"
                value={`${plans.length} plans`}
                detail="Chat answers follow the currently selected candidate, filter state, aggregate geography, and approval gates."
              />
            </div>
          </div>

          <aside className="min-w-0 border-t border-white/10 bg-slate-950/70 p-4 sm:p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-400">
                  Change campaign
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Search by name, office, county, or race.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-200" />
            </div>

            <div className="mt-4 grid gap-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search or type candidate name..."
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-10 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
              <label className="relative block">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as FilterValue)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-blue-300/50 focus:ring-2 focus:ring-blue-500/20"
                >
                  {FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-blue-300/15 bg-blue-500/10 p-3 text-xs leading-5 text-blue-50">
              Includes 30 priority Republican and 30 priority Democratic
              workspaces, all public-safe admin candidate records, plus
              source-backed local campaign programs. Unknown names generate a
              review-required planning workspace.
            </div>

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
              {filteredCandidates.map((candidate) => {
                const active = candidate.id === selectedCandidate.id;
                const readiness = CANDIDATE_READINESS[candidate.status];
                return (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={() => selectCandidate(candidate)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-blue-300/60 bg-blue-500/20 shadow-lg shadow-blue-950/25"
                        : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CandidatePortrait candidate={candidate} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-black text-white">
                            {candidate.candidateName}
                          </p>
                          {active ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-200" />
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {candidate.office} / {candidate.party}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {readiness.label}
                        </p>
                        {candidate.verificationSources?.length ? (
                          <p className="mt-1 text-[11px] font-black text-emerald-200">
                            Ohio SOS source linked
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredCandidates.length === 0 ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p className="font-bold">
                    {showCustomCandidatePrompt
                      ? `No exact match for "${safeCustomCandidateQuery(query)}".`
                      : "No matching campaigns."}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-50/85">
                    {showCustomCandidatePrompt
                      ? "Generate a four-option intake plan, then verify public history, platform, contact, geography, and sources before using it."
                      : "Clear the search or filter to return to the full planner list."}
                  </p>
                  {showCustomCandidatePrompt ? (
                    <button
                      type="button"
                      onClick={generateCustomCandidate}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate 4-option plan
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
            <span>
              {notice} {candidateReadiness.detail}
            </span>
          </div>
          <button
            type="button"
            onClick={() => askCampaignAi(candidateAiPrompt(selectedCandidate, plans))}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
          >
            <Bot className="h-4 w-4" />
            Ask AI About This Candidate
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, index) => (
          <ClientStrategyCard
            key={`${selectedCandidate.id}:${plan.id}`}
            candidate={selectedCandidate}
            plan={plan}
            style={CARD_STYLES[index] ?? CARD_STYLES[0]}
            onAskPlan={askCampaignAiAboutPlan}
          />
        ))}
      </div>
    </section>
  );
}

function ClientStrategyCard({
  candidate,
  plan,
  style,
  onAskPlan,
}: {
  candidate: StrategySelectionCandidate;
  plan: StrategySelectionPlan;
  style: (typeof CARD_STYLES)[number];
  onAskPlan: (plan: StrategySelectionPlan) => void;
}) {
  const readiness = PLAN_READINESS[plan.productionStatus];
  const geography = candidateGeographyLabel(candidate);
  const decisionMeta = planDecisionMeta(plan);

  return (
    <article className={`flex min-h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-950 shadow-2xl ${style.shadow}`}>
      <div className={`relative bg-gradient-to-br ${style.cap} p-5 text-white`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black text-white/75">
              Option {plan.optionLabel}
            </p>
            <h3 className="mt-3 text-xl font-black leading-tight">
              {plan.title}
            </h3>
          </div>
          <div className="rounded-b-2xl rounded-tl-2xl bg-white px-4 py-3 text-center shadow-xl">
            <div className="text-[10px] font-black text-slate-400">
              Plan
            </div>
            <div className={`text-4xl font-black ${style.badge}`}>
              {plan.optionLabel}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <CandidatePortrait candidate={candidate} size="xs" />
          <p className="min-w-0 truncate text-xs font-black text-white/80">
            {candidate.candidateName} / {candidate.office}
          </p>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/88">{plan.tagline}</p>
      </div>

      <div className="flex flex-1 flex-col space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <CardStat label="Cost" value={planMetric(plan, "Total cost")} />
          <CardStat label="Drops" value={`${plan.drops}`} />
          <CardStat label="Households" value={planMetric(plan, "Households")} />
          <CardStat label="Timeline" value={plan.timelineLength} />
        </div>

        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          <DecisionPoint label="Use case" value={decisionMeta.useCase} />
          <DecisionPoint label="Recommended audience" value={decisionMeta.audience} />
          <DecisionPoint label="Next action" value={decisionMeta.action} />
          <DecisionPoint label="Economics" value={decisionMeta.economics} />
        </div>

        <OptionCoverageMap candidate={candidate} plan={plan} />

        <div className="space-y-3 border-y border-slate-200 py-3">
          <div className="flex items-start gap-2">
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <p className="text-xs font-black text-slate-500">Geography basis</p>
              <p className="mt-1 text-sm leading-5 text-slate-800">
                {geography}. {plan.countiesIncluded.length} county group(s),
                {` ${plan.citiesIncluded.length}`} city group(s), and
                {` ${plan.uspsRoutesIncluded.toLocaleString()}`} estimated
                USPS routes.
              </p>
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2 text-xs font-black ${readiness.className}`}>
            {readiness.label}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {readiness.detail}
          </p>
        </div>

        <div>
          <p className="text-xs font-black text-slate-500">Best fit</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {plan.candidateFit}
          </p>
        </div>

        <div className="mt-auto grid gap-2">
          <Link
            href={planHref(candidate, plan)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            <Rocket className="h-4 w-4" />
            Request Reviewed Plan
          </Link>
          <button
            type="button"
            onClick={() => onAskPlan(plan)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50"
          >
            <Bot className="h-4 w-4" />
            Ask AI About This Plan
          </button>
        </div>
      </div>
    </article>
  );
}

function DecisionPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-black leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function CampaignReadout({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

type MapPoint = {
  label: string;
  x: number;
  y: number;
  kind: "county" | "city";
};

const OHIO_COUNTY_POINTS: Record<string, Omit<MapPoint, "label" | "kind">> = {
  Adams: { x: 151, y: 192 },
  Allen: { x: 111, y: 94 },
  Athens: { x: 179, y: 160 },
  Auglaize: { x: 83, y: 98 },
  Butler: { x: 116, y: 171 },
  Clermont: { x: 151, y: 177 },
  Cuyahoga: { x: 180, y: 45 },
  Darke: { x: 67, y: 127 },
  Delaware: { x: 145, y: 100 },
  Fairfield: { x: 160, y: 134 },
  Franklin: { x: 145, y: 123 },
  Greene: { x: 122, y: 144 },
  Hamilton: { x: 129, y: 188 },
  Hancock: { x: 104, y: 78 },
  Lake: { x: 198, y: 42 },
  Lorain: { x: 158, y: 49 },
  Lucas: { x: 94, y: 37 },
  Mahoning: { x: 218, y: 83 },
  Medina: { x: 162, y: 69 },
  Mercer: { x: 66, y: 103 },
  Miami: { x: 92, y: 134 },
  Montgomery: { x: 94, y: 153 },
  Stark: { x: 184, y: 95 },
  Summit: { x: 176, y: 78 },
  Trumbull: { x: 214, y: 65 },
  Warren: { x: 128, y: 157 },
  Wood: { x: 105, y: 53 },
};

const OHIO_CITY_POINTS: Record<string, Omit<MapPoint, "label" | "kind">> = {
  Akron: { x: 176, y: 79 },
  Batavia: { x: 151, y: 177 },
  Beavercreek: { x: 119, y: 146 },
  Canton: { x: 186, y: 98 },
  Cincinnati: { x: 129, y: 188 },
  Cleveland: { x: 181, y: 46 },
  Columbus: { x: 145, y: 123 },
  Dayton: { x: 94, y: 153 },
  Delaware: { x: 145, y: 100 },
  Findlay: { x: 104, y: 78 },
  Lima: { x: 111, y: 94 },
  Lorain: { x: 158, y: 49 },
  Mason: { x: 128, y: 164 },
  Medina: { x: 162, y: 69 },
  Mentor: { x: 201, y: 44 },
  Milford: { x: 147, y: 178 },
  Toledo: { x: 94, y: 37 },
  Troy: { x: 90, y: 132 },
  "Van Wert": { x: 72, y: 91 },
  "West Chester": { x: 121, y: 171 },
  Wapakoneta: { x: 83, y: 98 },
  Warren: { x: 213, y: 66 },
  Youngstown: { x: 221, y: 84 },
};

function OptionCoverageMap({
  candidate,
  plan,
}: {
  candidate: StrategySelectionCandidate;
  plan: StrategySelectionPlan;
}) {
  const isStatewide = plan.countiesIncluded.length >= OHIO_STATEWIDE_COUNTIES.length;
  const countyFocus = isStatewide
    ? [...STATEWIDE_FOCUS_COUNTIES]
    : uniqueCountyLabels([
        ...plan.mapHighlights,
        ...plan.countiesIncluded,
      ]).slice(0, 7);
  const cityFocus = isStatewide
    ? [...STATEWIDE_CITY_ANCHORS]
    : uniqueCityLabels([
        ...plan.mapHighlights,
        ...plan.citiesIncluded,
      ]).slice(0, 5);
  const highlightedCountyNames = isStatewide
    ? [...OHIO_STATEWIDE_COUNTIES]
    : countyFocus;
  const highlightedCounties: OhioCountyMapCounty[] = highlightedCountyNames.map((name) => ({
    name,
    tone: ohioHistoricalMapTone(name),
  }));
  const cityMarkers = cityFocus
    .map((label, index) => toOhioCityMarker(label, index))
    .filter((marker): marker is OhioCountyMapCity => Boolean(marker));
  const headline = isStatewide
    ? "Ohio statewide coverage map"
    : `${candidateGeographyLabel(candidate)} coverage map`;
  const detail = isStatewide
    ? "All 88 Ohio counties are included. Dots show major metro anchors for consultation review, not the full boundary."
    : `${countyFocus.length} county layer with ${plan.uspsRoutesIncluded.toLocaleString()} planning routes.`;
  const mapAccent = historicalMapAccent();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Map preview
          </p>
          <p className="mt-1 text-sm font-black">{headline}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-black text-white">
            Option {plan.optionLabel}
          </span>
          <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${mapAccent.badgeClass}`}>
            {mapAccent.label}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-3">
        <OhioCountyMap
          counties={highlightedCounties}
          cities={cityMarkers}
          title={`${headline}. ${detail}`}
          compact
          showHeader={false}
          showLegend={false}
          labelCountyNames={isStatewide ? [...STATEWIDE_FOCUS_COUNTIES] : countyFocus}
        />
        <HistoricalCountyLegend />

        <div className="grid gap-2">
          <MapChipGroup
            label={isStatewide ? "Statewide layer" : "County layer"}
            values={
              isStatewide
                ? ["88 Ohio counties", ...STATEWIDE_FOCUS_COUNTIES]
                : countyFocus
            }
          />
          <MapChipGroup
            label="City anchors"
            values={
              cityFocus.length ? cityFocus : plan.citiesIncluded.slice(0, 5)
            }
          />
          {isStatewide ? (
            <div className={`rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5 ${mapAccent.noticeClass}`}>
              Statewide race coverage remains all 88 counties. County colors
              show 2024 presidential lean; anchors are review landmarks only,
              not the full campaign boundary.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function historicalMapAccent() {
  return {
    label: "2024 county vote history",
    badgeClass: "border-white/15 bg-white/10 text-slate-100",
    noticeClass: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  };
}

function HistoricalCountyLegend() {
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[9px] font-black uppercase tracking-[0.08em] text-slate-300">
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
        Dem lean
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
        Rep lean
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
        Mixed
      </span>
    </div>
  );
}

function MapChipGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.slice(0, 6).map((value) => (
          <span
            key={value}
            className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-slate-100"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function resolveMapLabels<T extends Record<string, unknown>>(labels: string[], source: T) {
  const normalized = new Set<string>();
  for (const label of labels) {
    const exact = Object.keys(source).find(
      (candidate) => candidate.toLowerCase() === label.toLowerCase(),
    );
    if (exact) normalized.add(exact);
  }
  return [...normalized];
}

function uniqueCountyLabels(labels: string[]) {
  return uniqueGeoLabels(labels).filter((label) => label in OHIO_COUNTY_POINTS);
}

function uniqueCityLabels(labels: string[]) {
  return uniqueGeoLabels(labels).filter((label) => label in OHIO_CITY_CENTROIDS);
}

function uniqueGeoLabels(labels: string[]) {
  const normalized = new Set<string>();
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed || NON_PLOTTABLE_GEO_LABELS.has(trimmed)) continue;
    if (normalized.has(trimmed)) continue;
    normalized.add(trimmed);
  }
  return [...normalized];
}

function toOhioCityMarker(
  label: string,
  index: number,
): OhioCountyMapCity | null {
  const coordinates = OHIO_CITY_CENTROIDS[label];
  if (!coordinates) return null;
  return {
    name: label,
    lat: coordinates.lat,
    lon: coordinates.lon,
    tone: index < 3 ? "primary" : index < 5 ? "secondary" : "watch",
  };
}

const OHIO_CITY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  Akron: { lat: 41.08, lon: -81.52 },
  Athens: { lat: 39.33, lon: -82.1 },
  Batavia: { lat: 39.08, lon: -84.18 },
  Beavercreek: { lat: 39.71, lon: -84.06 },
  Canton: { lat: 40.8, lon: -81.38 },
  Celina: { lat: 40.55, lon: -84.57 },
  Cincinnati: { lat: 39.1, lon: -84.51 },
  Cleveland: { lat: 41.5, lon: -81.69 },
  Columbus: { lat: 39.96, lon: -82.99 },
  Dayton: { lat: 39.76, lon: -84.19 },
  Delaware: { lat: 40.3, lon: -83.07 },
  Findlay: { lat: 41.04, lon: -83.65 },
  Lima: { lat: 40.74, lon: -84.11 },
  Lorain: { lat: 41.45, lon: -82.18 },
  Mason: { lat: 39.36, lon: -84.31 },
  Medina: { lat: 41.14, lon: -81.86 },
  Mentor: { lat: 41.67, lon: -81.34 },
  Milford: { lat: 39.18, lon: -84.29 },
  Piqua: { lat: 40.14, lon: -84.24 },
  Sidney: { lat: 40.28, lon: -84.16 },
  Strongsville: { lat: 41.31, lon: -81.84 },
  Toledo: { lat: 41.65, lon: -83.54 },
  Troy: { lat: 40.04, lon: -84.2 },
  Wapakoneta: { lat: 40.57, lon: -84.19 },
  Warren: { lat: 41.24, lon: -80.82 },
  "West Chester": { lat: 39.33, lon: -84.41 },
  Youngstown: { lat: 41.1, lon: -80.65 },
};

const STATEWIDE_DOT_GRID = [
  { x: 86, y: 56 },
  { x: 116, y: 52 },
  { x: 148, y: 57 },
  { x: 166, y: 76 },
  { x: 96, y: 82 },
  { x: 126, y: 83 },
  { x: 156, y: 96 },
  { x: 83, y: 113 },
  { x: 116, y: 113 },
  { x: 146, y: 123 },
  { x: 166, y: 136 },
  { x: 96, y: 146 },
  { x: 129, y: 154 },
  { x: 154, y: 163 },
];

function CandidatePortrait({
  candidate,
  size,
}: {
  candidate: StrategySelectionCandidate;
  size: "xs" | "sm" | "lg";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const portrait = candidate.portrait ?? candidate.agent?.profile.portrait;
  const shouldShowPortrait = Boolean(portrait && !imageFailed);
  const initials = candidate.candidateName
    .replace(/^Dr\.\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const sizeClass =
    size === "lg"
      ? "h-24 w-24 rounded-2xl"
      : size === "sm"
        ? "h-11 w-11 rounded-xl"
        : "h-9 w-9 rounded-lg";

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden border border-white/20 bg-slate-900 shadow-lg shadow-slate-950/25`}
      title={
        portrait
          ? `${portrait.sourceLabel}: review before production use`
          : "Portrait pending"
      }
    >
      {shouldShowPortrait && portrait ? (
        <img
          src={portrait.url}
          alt={portrait.alt}
          className="h-full w-full object-cover object-top"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-700 to-red-700 text-sm font-black text-white">
          {initials || "HR"}
        </div>
      )}
    </div>
  );
}

function TruthMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof MapPinned;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-xs font-black text-slate-400">
        <Icon className="h-4 w-4 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-black text-white">
        {value}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950" title={value}>
        {value}
      </p>
    </div>
  );
}
