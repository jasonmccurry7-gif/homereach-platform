"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Heart,
  MapPinned,
  MessageSquareText,
  PenLine,
  Rocket,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  buildStrategySelectionPlans,
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
  | "School Board";

const CARD_STYLES = [
  {
    cap: "from-red-600 to-red-800",
    shadow: "shadow-red-950/35",
    badge: "text-red-700",
    rail: "bg-red-600",
  },
  {
    cap: "from-blue-600 to-blue-900",
    shadow: "shadow-blue-950/35",
    badge: "text-blue-700",
    rail: "bg-blue-600",
  },
  {
    cap: "from-blue-700 to-red-700",
    shadow: "shadow-blue-950/35",
    badge: "text-blue-800",
    rail: "bg-red-600",
  },
  {
    cap: "from-slate-950 to-blue-950",
    shadow: "shadow-slate-950/40",
    badge: "text-blue-950",
    rail: "bg-blue-900",
  },
] as const;

const FILTERS: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Democrat", value: "Democrat" },
  { label: "Republican", value: "Republican" },
  { label: "Statewide", value: "Statewide" },
  { label: "Mayoral", value: "Mayoral" },
  { label: "County", value: "County" },
  { label: "Legislative", value: "Legislative" },
  { label: "School Board", value: "School Board" },
];

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
  "Van Wert": { lat: 40.87, lon: -84.58 },
  Wapakoneta: { lat: 40.57, lon: -84.19 },
  Warren: { lat: 41.24, lon: -80.82 },
  "West Chester": { lat: 39.33, lon: -84.41 },
  Youngstown: { lat: 41.1, lon: -80.65 },
};

const NON_PLOTTABLE_GEO_LABELS = new Set([
  "Adjacent county",
  "County seat",
  "Nearby route cluster",
  "Primary suburbs",
]);

export function CampaignStrategySelectionEngine({
  initialCandidateId = getDefaultStrategySelectionCandidateId(),
}: {
  initialCandidateId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidateId, setCandidateId] = useState(
    () => getStrategySelectionCandidate(initialCandidateId).id,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [notice, setNotice] = useState(
    "Select a candidate to compare four AI-generated campaign mail strategies.",
  );
  const [approvedCreativeIds, setApprovedCreativeIds] = useState<string[]>([]);
  const [favoritePlanIds, setFavoritePlanIds] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return STRATEGY_SELECTION_CANDIDATES.filter((candidate) => {
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
      const matchesFilter =
        filter === "all" ||
        candidate.party.includes(filter) ||
        candidate.raceType === filter;
      return matchesQuery && matchesFilter;
    }).slice(0, 12);
  }, [filter, query]);

  const selectedCandidate = useMemo(
    () => getStrategySelectionCandidate(candidateId),
    [candidateId],
  );
  const plans = useMemo(
    () => buildStrategySelectionPlans(selectedCandidate),
    [selectedCandidate.id],
  );
  const expandedPlan =
    plans.find((plan) => plan.id === expandedPlanId) ?? plans[0] ?? null;

  useEffect(() => {
    const candidateParam = searchParams?.get("candidate");
    if (!candidateParam) return;
    const nextCandidate = getStrategySelectionCandidate(candidateParam);
    if (nextCandidate.id === candidateId) return;
    setCandidateId(nextCandidate.id);
    setExpandedPlanId(null);
    setCompareMode(false);
    setNotice(
      `${nextCandidate.candidateName} loaded from the shared campaign context.`,
    );
  }, [candidateId, searchParams]);

  function syncCandidateUrl(nextCandidateId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("candidate", nextCandidateId);
    router.replace(`/political/candidate-agent?${params.toString()}`, {
      scroll: false,
    });
  }

  function selectCandidate(nextCandidate: StrategySelectionCandidate) {
    setCandidateId(nextCandidate.id);
    setExpandedPlanId(null);
    setCompareMode(false);
    setNotice(
      `${nextCandidate.candidateName} loaded. Four strategy options are ready for comparison.`,
    );
    syncCandidateUrl(nextCandidate.id);
  }

  function exportProposal(plan: StrategySelectionPlan) {
    const payload = {
      exportedAt: new Date().toISOString(),
      candidate: selectedCandidate,
      selectedStrategy: plan,
      compliance:
        "Planning export only. USPS counts, official source verification, final creative approval, payment, and production handoff require human approval.",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homereach-${selectedCandidate.id}-${plan.id}-strategy.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${plan.title}. Review-only planning JSON downloaded.`);
  }

  function approveCreative(
    plan: StrategySelectionPlan,
    planInstanceId: string,
  ) {
    setApprovedCreativeIds((current) =>
      current.includes(planInstanceId) ? current : [...current, planInstanceId],
    );
    setNotice(
      `${plan.title} creative marked ready for human review. It is not approved for production or client use.`,
    );
  }

  function requestEdits(plan: StrategySelectionPlan, planInstanceId: string) {
    const comment = commentDrafts[planInstanceId]?.trim();
    setNotice(
      comment
        ? `Edit request saved for ${plan.title}: ${comment}`
        : `Edit request opened for ${plan.title}. Add a note such as "make this more local" or "increase urgency."`,
    );
  }

  return (
    <section id="campaign-options" className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.2),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] p-4 shadow-2xl shadow-slate-950/40 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              <span className="rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1">
                Candidate Selection
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                4 campaign options
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Select the campaign first.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              The cards below stay focused on the decision: who the campaign is for, what each option costs, how many drops it includes, and which plan should move into review.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-950/25 p-3 text-xs leading-5 text-emerald-50">
            <div className="flex items-center gap-2 font-black text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Client-safe view
            </div>
            <p className="mt-1">
              Detailed route QA, creative comments, and production gates stay in the other tabs or admin.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_210px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search candidate, office, county, district, party..."
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-10 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/50 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <label className="relative block">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterValue)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-blue-300/50 focus:ring-2 focus:ring-blue-500/20"
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

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {filteredCandidates.slice(0, 10).map((candidate) => {
            const active = candidate.id === selectedCandidate.id;
            return (
              <button
                type="button"
                key={candidate.id}
                onClick={() => selectCandidate(candidate)}
                className={`rounded-xl border p-3 text-left transition ${
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
                    <p className="mt-2 truncate text-xs text-slate-500">
                      {candidate.geography} / {candidate.electionYear}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-200" />
            <span>{notice}</span>
          </div>
          <a
            href="#campaign-ai-chat"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
          >
            <Bot className="h-4 w-4" />
            Ask AI About This Candidate
          </a>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {plans.map((plan, index) => (
          <ClientStrategyCard
            key={`${selectedCandidate.id}:${plan.id}`}
            candidate={selectedCandidate}
            plan={plan}
            style={CARD_STYLES[index] ?? CARD_STYLES[0]}
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
}: {
  candidate: StrategySelectionCandidate;
  plan: StrategySelectionPlan;
  style: (typeof CARD_STYLES)[number];
}) {
  const topMetrics = plan.metrics.slice(0, 8);

  return (
    <article className={`overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-950 shadow-2xl ${style.shadow}`}>
      <div className={`relative bg-gradient-to-br ${style.cap} p-5 text-white`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/75">
              Option {plan.optionLabel}
            </p>
            <h3 className="mt-3 text-2xl font-black leading-tight">
              {plan.title}
            </h3>
          </div>
          <div className="rounded-b-2xl rounded-tl-2xl bg-white px-4 py-3 text-center shadow-xl">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Plan
            </div>
            <div className={`text-4xl font-black ${style.badge}`}>
              {plan.optionLabel}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <CandidatePortrait candidate={candidate} size="xs" />
          <p className="min-w-0 truncate text-xs font-black uppercase tracking-[0.18em] text-white/80">
            {candidate.candidateName} / {candidate.office}
          </p>
        </div>
        <p className="mt-4 text-sm leading-6 text-white/88">{plan.tagline}</p>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {topMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {metric.label}
              </p>
              <p className="mt-1 truncate text-sm font-black text-slate-950" title={metric.value}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Best fit
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {plan.candidateFit}
          </p>
        </div>

        <div className="grid gap-2">
          <Link
            href={`/political/plan?candidate=${encodeURIComponent(candidate.candidateName)}&strategy=${encodeURIComponent(plan.id)}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500"
          >
            <Rocket className="h-4 w-4" />
            Start With Option {plan.optionLabel}
          </Link>
          <a
            href="#campaign-ai-chat"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50"
          >
            <Bot className="h-4 w-4" />
            Ask AI About This Plan
          </a>
        </div>
      </div>
    </article>
  );
}

function CandidateIntelligenceHeader({
  candidate,
}: {
  candidate: StrategySelectionCandidate;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <CandidatePortrait candidate={candidate} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Selected campaign intelligence
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              {candidate.candidateName} - {candidate.office}
            </h3>
            {candidate.portrait ? (
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Portrait source:{" "}
                <a
                  href={candidate.portrait.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-200 hover:text-white"
                >
                  {candidate.portrait.sourceLabel}
                </a>
                . Review required before paid creative use.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            {candidate.party}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            {candidate.geography}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            {candidate.district}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            {candidate.electionYear}
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          {candidate.sourceNote}
        </p>
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-amber-950/20 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
          Readiness status
        </p>
        <div className="mt-3 grid gap-2 text-sm">
          <ReadinessRow
            label="Campaign profile"
            done={candidate.status === "source_backed"}
          />
          <ReadinessRow label="USPS route counts" done={false} />
          <ReadinessRow label="Final quote lock" done={false} />
          <ReadinessRow label="Human approval" done={false} />
        </div>
      </div>
    </section>
  );
}

function StrategyCard({
  candidate,
  plan,
  style,
  expanded,
  compareMode,
  favorite,
  creativeApproved,
  commentDraft,
  onToggleFavorite,
  onExpand,
  onExport,
  onApprove,
  onRequestEdits,
  onCommentChange,
}: {
  candidate: StrategySelectionCandidate;
  plan: StrategySelectionPlan;
  style: (typeof CARD_STYLES)[number];
  expanded: boolean;
  compareMode: boolean;
  favorite: boolean;
  creativeApproved: boolean;
  commentDraft: string;
  onToggleFavorite(): void;
  onExpand(): void;
  onExport(): void;
  onApprove(): void;
  onRequestEdits(): void;
  onCommentChange(value: string): void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-950 shadow-2xl ${style.shadow}`}
    >
      <div
        className={`relative min-h-48 bg-gradient-to-br ${style.cap} p-5 text-white`}
      >
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={favorite ? "Remove favorite" : "Favorite plan"}
          className="absolute left-4 top-4 rounded-full border border-white/25 bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
        >
          <Heart className={`h-4 w-4 ${favorite ? "fill-white" : ""}`} />
        </button>
        <div className="absolute right-4 top-4 rounded-b-2xl rounded-tl-2xl bg-white px-4 py-3 text-center shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Option
          </div>
          <div className={`text-4xl font-black ${style.badge}`}>
            {plan.optionLabel}
          </div>
        </div>
        <div className="pt-20">
          <div className="flex items-center gap-3">
            <CandidatePortrait candidate={candidate} size="xs" />
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">
              {candidate.candidateName} / {candidate.office}
            </p>
          </div>
          <h3 className="mt-2 text-2xl font-black leading-tight">
            {plan.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/85">{plan.tagline}</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Snapshot metrics
          </p>
          <div
            className={
              compareMode
                ? "mt-3 grid grid-cols-2 gap-2"
                : "mt-3 grid grid-cols-2 gap-2"
            }
          >
            {plan.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {metric.label}
                </div>
                <div
                  className="mt-1 truncate text-sm font-black text-slate-950"
                  title={metric.value}
                >
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <OhioStrategyMap candidate={candidate} plan={plan} style={style} />

        <PostcardPreviewStrip plan={plan} style={style} />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Why this plan
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {plan.whyThisPlan}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {plan.indicators.map((indicator) => (
            <div
              key={indicator.label}
              className="rounded-lg border border-slate-200 bg-white p-2"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {indicator.label}
              </p>
              <p className="mt-1 text-xs font-black text-slate-950">
                {indicator.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Mail wave timeline
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {plan.timeline.map((item) => (
              <div
                key={`${plan.id}-${item.week}`}
                className="min-w-28 rounded-lg bg-slate-950 px-3 py-2 text-white"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {item.week}
                </p>
                <p className="mt-1 text-xs font-black">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Staff comment
            </span>
            <textarea
              value={commentDraft}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Example: make this stronger for suburban families."
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={Eye}
            label="View Full Strategy"
            onClick={onExpand}
            active={expanded}
          />
          <ActionLinkButton
            icon={Rocket}
            label="Open Plan Intake"
            href={`/political/plan?candidate=${encodeURIComponent(candidate.candidateName)}&strategy=${encodeURIComponent(plan.id)}`}
          />
          <ActionButton
            icon={PenLine}
            label="Request Edits"
            onClick={onRequestEdits}
          />
          <ActionLinkButton
            icon={Bot}
            label="Talk To AI Strategist"
            href={`/political/candidate-agent?candidate=${encodeURIComponent(candidate.id)}`}
          />
          <ActionButton
            icon={Download}
            label="Export Review File"
            onClick={onExport}
          />
          <ActionButton
            icon={CheckCircle2}
            label={creativeApproved ? "Ready For Review" : "Mark For Review"}
            onClick={onApprove}
            active={creativeApproved}
          />
          <ActionLinkButton
            icon={Route}
            label="View Route Details"
            href={`/political/maps?candidate=${encodeURIComponent(candidate.id)}&strategy=${encodeURIComponent(plan.id)}`}
          />
          <ActionButton
            icon={FileText}
            label="Compare Plans"
            onClick={onExpand}
          />
        </div>
      </div>
    </article>
  );
}

function OhioStrategyMap({
  candidate,
  plan,
  style,
}: {
  candidate: StrategySelectionCandidate;
  plan: StrategySelectionPlan;
  style: (typeof CARD_STYLES)[number];
}) {
  const isStatewidePlan = plan.countiesIncluded.length >= 80;
  const priorityCountyAnchors = plan.mapHighlights.filter((label) =>
    OHIO_STATEWIDE_COUNTIES.includes(
      label as (typeof OHIO_STATEWIDE_COUNTIES)[number],
    ),
  );
  const countyLabels = uniqueGeoLabels(
    isStatewidePlan && priorityCountyAnchors.length > 0
      ? priorityCountyAnchors
      : plan.countiesIncluded,
  ).slice(0, isStatewidePlan ? 8 : 5);
  const cityLabels = uniqueGeoLabels(plan.citiesIncluded).slice(0, 5);
  const highlightedCountyLabels = isStatewidePlan
    ? [...OHIO_STATEWIDE_COUNTIES]
    : countyLabels;
  const highlightedCounties = highlightedCountyLabels.map(
    (name): OhioCountyMapCounty => ({
      name,
      tone: ohioHistoricalMapTone(name),
    }),
  );
  const cityMarkers = cityLabels
    .map((label, index) => toOhioCityMarker(label, index))
    .filter((marker): marker is OhioCountyMapCity => Boolean(marker));
  const unplottedLabels = cityLabels.filter(
    (label) => !cityMarkers.some((marker) => marker.name === label),
  );
  const partyAccent = partyMapAccent(candidate.party);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950 p-3 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Ohio geography reference
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {isStatewidePlan
              ? `${candidate.candidateName} is a statewide Ohio plan. All 88 counties are covered; highlighted counties are priority planning anchors.`
              : `${candidate.candidateName} geography anchors are plotted from Ohio coordinates.`}{" "}
            USPS route counts require source verification.
          </p>
        </div>
        <MapPinned className={`h-5 w-5 ${partyAccent.iconClass}`} />
      </div>
      <div className={`mt-3 h-1.5 rounded-full ${style.rail}`} />
      <div className="mt-3 grid gap-3">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(96,165,250,0.22),transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))]">
          <OhioCountyMap
            counties={highlightedCounties}
            cities={cityMarkers}
            title={`${plan.title} Ohio county reference`}
            compact
            showHeader={false}
            showLegend={false}
            labelCountyNames={countyLabels}
          />
          <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {candidate.candidateName}
          </div>
          <div className={`absolute right-3 top-3 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${partyAccent.badgeClass}`}>
            Candidate: {partyAccent.label}
          </div>
          <div className="absolute bottom-3 left-3 right-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-200">
            <div className="rounded-lg border border-white/10 bg-slate-950/75 px-2 py-1">
              {isStatewidePlan
                ? "Scope: statewide"
                : `Counties: ${countyLabels.length}`}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/75 px-2 py-1">
              {isStatewidePlan
                ? `Anchors: ${countyLabels.length}`
                : `City dots: ${cityMarkers.length}/${cityLabels.length}`}
            </div>
          </div>
        </div>
        <HistoricalCountyLegend />
        <div className="grid gap-2">
          {countyLabels.length > 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {isStatewidePlan
                  ? "Priority county anchors"
                  : "County layer"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {countyLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-white"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {isStatewidePlan ? (
            <div className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${partyAccent.noticeClass}`}>
              Statewide race coverage remains all 88 Ohio counties. County
              colors show 2024 presidential lean; anchors show where this
              option starts the planning review.
            </div>
          ) : null}
          {cityLabels.length > 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Municipal anchors
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cityLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-blue-300/10 px-2 py-1 text-[11px] font-bold text-blue-100"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {unplottedLabels.length > 0 ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] font-semibold text-amber-100">
              Needs geography validation:{" "}
              {unplottedLabels.slice(0, 4).join(", ")}
            </div>
          ) : null}
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
            <span className="font-black">Planning route estimate:</span>{" "}
            {plan.uspsRoutesIncluded.toLocaleString()} routes /{" "}
            {plan.routeDensity} density. USPS/vendor route counts pending.
          </div>
        </div>
      </div>
    </div>
  );
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

function partyMapAccent(party: string) {
  const normalized = party.toLowerCase();
  if (normalized.includes("democrat")) {
    return {
      label: "Democratic",
      badgeClass: "border-blue-300/20 bg-blue-500/15 text-blue-100",
      iconClass: "text-blue-200",
      noticeClass: "border-blue-300/20 bg-blue-300/10 text-blue-100",
    };
  }
  if (normalized.includes("republican")) {
    return {
      label: "Republican",
      badgeClass: "border-red-300/20 bg-red-500/15 text-red-100",
      iconClass: "text-red-200",
      noticeClass: "border-red-300/20 bg-red-300/10 text-red-100",
    };
  }
  return {
    label: "Independent",
    badgeClass: "border-slate-300/20 bg-slate-500/15 text-slate-100",
    iconClass: "text-slate-200",
    noticeClass: "border-slate-300/20 bg-slate-300/10 text-slate-100",
  };
}

function uniqueGeoLabels(labels: string[]) {
  const seen = new Set<string>();
  return labels
    .map((label) => label.trim())
    .filter((label) => label.length > 0 && !NON_PLOTTABLE_GEO_LABELS.has(label))
    .filter((label) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
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

function PostcardPreviewStrip({
  plan,
  style,
}: {
  plan: StrategySelectionPlan;
  style: (typeof CARD_STYLES)[number];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Review-ready postcard concepts
        </p>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          Draft assets
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {plan.postcards.slice(0, 4).map((postcard, index) => (
          <div
            key={postcard.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className={`bg-gradient-to-r ${style.cap} p-3 text-white`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                    {postcard.category}
                  </p>
                  <h4 className="mt-1 line-clamp-2 text-sm font-black">
                    {postcard.headline}
                  </h4>
                </div>
                <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black">
                  {index + 1}
                </span>
              </div>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-xs leading-5 text-slate-600">
                {postcard.subheadline}
              </p>
              <div className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                CTA: {postcard.cta}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandedStrategyView({
  candidate,
  plan,
  onExport,
  onApprove,
}: {
  candidate: StrategySelectionCandidate;
  plan: StrategySelectionPlan;
  onExport(): void;
  onApprove(): void;
}) {
  return (
    <section className="rounded-2xl border border-blue-300/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_38%),rgba(15,23,42,0.92)] p-5 shadow-2xl shadow-slate-950/40">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
            Expanded Campaign Command View
          </p>
          <h3 className="mt-2 text-3xl font-black text-white">{plan.title}</h3>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            {plan.strategyOverview}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export Review File
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark For Review
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <CommandPanel title="Route analysis" icon={Route}>
          <MetricLine
            label="Estimated USPS routes"
            value={plan.uspsRoutesIncluded.toLocaleString()}
          />
          <MetricLine label="Route density" value={plan.routeDensity} />
          <MetricLine label="Saturation" value={`${plan.saturationPct}%`} />
          <MetricLine
            label="Verification"
            value={plan.productionStatus.replaceAll("_", " ")}
          />
        </CommandPanel>
        <CommandPanel title="Budget allocation" icon={FileText}>
          <MetricLine
            label="Total cost"
            value={formatMoney(plan.totalCampaignCostCents)}
          />
          <MetricLine
            label="Cost per household"
            value={formatMoney(plan.costPerHouseholdCents)}
          />
          <MetricLine
            label="Mail pieces"
            value={plan.estimatedImpressions.toLocaleString()}
          />
          <MetricLine label="Drops" value={String(plan.drops)} />
        </CommandPanel>
        <CommandPanel title="AI recommendations" icon={Sparkles}>
          <p className="text-sm leading-6 text-slate-300">{plan.whyThisPlan}</p>
          <p className="mt-3 text-xs leading-5 text-amber-100">
            Proposal, payment, and production remain locked until route counts,
            final quote, source timestamp, and human approval are complete.
          </p>
        </CommandPanel>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <CommandPanel title="Mail calendar" icon={MapPinned}>
          <div className="grid gap-2">
            {plan.timeline.map((wave) => (
              <div
                key={`${plan.id}-${wave.week}-expanded`}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
              >
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {wave.week}
                </p>
                <p className="mt-1 font-bold text-white">{wave.label}</p>
              </div>
            ))}
          </div>
        </CommandPanel>
        <CommandPanel title="Creative review queue" icon={MessageSquareText}>
          <div className="grid gap-2">
            {plan.postcards.map((postcard) => (
              <div
                key={`${postcard.id}-approval`}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
              >
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">
                  {postcard.category}
                </p>
                <p className="mt-1 font-bold text-white">{postcard.headline}</p>
                <p className="mt-1 text-xs text-slate-400">{postcard.tone}</p>
              </div>
            ))}
          </div>
        </CommandPanel>
      </div>

      <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-950/20 p-4 text-sm leading-6 text-emerald-50">
        <strong>{candidate.candidateName} command note:</strong>{" "}
        {plan.candidateFit}
      </div>
    </section>
  );
}

function CommandPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Route;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-200" />
        <h4 className="font-black text-white">{title}</h4>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2 text-sm last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-black text-white capitalize">{value}</span>
    </div>
  );
}

function ReadinessRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <span className="text-slate-200">{label}</span>
      <span className={done ? "text-emerald-200" : "text-amber-200"}>
        {done ? "Ready" : "Needs review"}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: typeof Eye;
  label: string;
  onClick(): void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
          : "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900 transition hover:bg-slate-50"
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ActionLinkButton({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Rocket;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900 transition hover:bg-slate-50"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
