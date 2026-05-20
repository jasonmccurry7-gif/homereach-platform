"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  STRATEGY_SELECTION_CANDIDATES,
  type StrategySelectionCandidate,
  type StrategySelectionPlan,
} from "@/lib/political/campaign-strategy-selection";

type FilterValue = "all" | "Democrat" | "Republican" | "Statewide" | "Mayoral" | "County" | "Legislative" | "School Board";

const CARD_STYLES = [
  {
    cap: "from-rose-500 to-red-600",
    shadow: "shadow-rose-950/30",
    badge: "text-rose-600",
    rail: "bg-rose-500",
  },
  {
    cap: "from-amber-400 to-orange-500",
    shadow: "shadow-orange-950/30",
    badge: "text-orange-600",
    rail: "bg-orange-400",
  },
  {
    cap: "from-cyan-400 to-teal-500",
    shadow: "shadow-teal-950/30",
    badge: "text-teal-600",
    rail: "bg-teal-400",
  },
  {
    cap: "from-slate-700 to-teal-900",
    shadow: "shadow-slate-950/40",
    badge: "text-teal-800",
    rail: "bg-teal-700",
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

export function CampaignStrategySelectionEngine({
  initialCandidateId = getDefaultStrategySelectionCandidateId(),
}: {
  initialCandidateId?: string;
}) {
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [notice, setNotice] = useState("Select a candidate to compare four AI-generated campaign mail strategies.");
  const [approvedCreativeIds, setApprovedCreativeIds] = useState<string[]>([]);
  const [favoritePlanIds, setFavoritePlanIds] = useState<string[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

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
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        candidate.party.includes(filter) ||
        candidate.raceType === filter;
      return matchesQuery && matchesFilter;
    }).slice(0, 12);
  }, [filter, query]);

  const selectedCandidate = getStrategySelectionCandidate(candidateId);
  const plans = useMemo(
    () => buildStrategySelectionPlans(selectedCandidate),
    [selectedCandidate],
  );
  const expandedPlan =
    plans.find((plan) => plan.id === expandedPlanId) ?? plans[0] ?? null;

  function selectCandidate(nextCandidate: StrategySelectionCandidate) {
    setCandidateId(nextCandidate.id);
    setExpandedPlanId(null);
    setCompareMode(false);
    setNotice(`${nextCandidate.candidateName} loaded. Four strategy options are ready for comparison.`);
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
    setNotice(`Exported ${plan.title}. Client-safe planning JSON downloaded.`);
  }

  function approveCreative(plan: StrategySelectionPlan) {
    setApprovedCreativeIds((current) =>
      current.includes(plan.id) ? current : [...current, plan.id],
    );
    setNotice(`${plan.title} creative marked approved for internal review. Human final approval is still required before production.`);
  }

  function requestEdits(plan: StrategySelectionPlan) {
    const comment = commentDrafts[plan.id]?.trim();
    setNotice(
      comment
        ? `Edit request saved for ${plan.title}: ${comment}`
        : `Edit request opened for ${plan.title}. Add a note such as "make this more local" or "increase urgency."`,
    );
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.24),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.9))] p-5 shadow-2xl shadow-slate-950/50">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-200">
              <span className="rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1">
                AI Strategy Selection Engine
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {STRATEGY_SELECTION_CANDIDATES.length} Ohio campaign workspaces
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
              Pick the campaign path before buying mail.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Select a candidate, office, county, party, or election. HomeReach
              shows four side-by-side strategy options with geography, costs,
              mail waves, route assumptions, and postcard creative direction.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-950/30 p-4 text-sm leading-6 text-emerald-50 xl:max-w-sm">
            <div className="flex items-center gap-2 font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Safe campaign planning
            </div>
            <p className="mt-2">
              Aggregate geography, public sources, USPS logistics, timing, and
              budget planning only. No individual voter ideology or persuasion
              scoring.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_210px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search candidate, office, county, district, party, election..."
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

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {filteredCandidates.map((candidate) => {
            const active = candidate.id === selectedCandidate.id;
            return (
              <button
                type="button"
                key={candidate.id}
                onClick={() => selectCandidate(candidate)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-blue-300/50 bg-blue-500/15 shadow-lg shadow-blue-950/25"
                    : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{candidate.candidateName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {candidate.office} / {candidate.party}
                    </p>
                  </div>
                  {active ? <CheckCircle2 className="h-4 w-4 text-blue-200" /> : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {candidate.geography} / {candidate.electionYear} / {candidate.raceType}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <CandidateIntelligenceHeader candidate={selectedCandidate} />

      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-200" />
            <span>{notice}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCompareMode((value) => !value);
                setNotice(compareMode ? "Compare mode closed." : "Compare mode enabled. Use the same metrics across all four cards.");
              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              {compareMode ? "Close Compare" : "Compare Plans"}
            </button>
            <Link
              href={`/political/candidate-agent?candidate=${encodeURIComponent(selectedCandidate.id)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
            >
              <Bot className="h-4 w-4" />
              Talk To AI Strategist
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {plans.map((plan, index) => (
          <StrategyCard
            key={plan.id}
            candidate={selectedCandidate}
            plan={plan}
            style={CARD_STYLES[index] ?? CARD_STYLES[0]}
            expanded={expandedPlan?.id === plan.id}
            compareMode={compareMode}
            favorite={favoritePlanIds.includes(plan.id)}
            creativeApproved={approvedCreativeIds.includes(plan.id)}
            commentDraft={commentDrafts[plan.id] ?? ""}
            onToggleFavorite={() =>
              setFavoritePlanIds((current) =>
                current.includes(plan.id)
                  ? current.filter((id) => id !== plan.id)
                  : [...current, plan.id],
              )
            }
            onExpand={() => {
              setExpandedPlanId(plan.id);
              setNotice(`${plan.title} opened in Campaign Command View.`);
            }}
            onExport={() => exportProposal(plan)}
            onApprove={() => approveCreative(plan)}
            onRequestEdits={() => requestEdits(plan)}
            onCommentChange={(value) =>
              setCommentDrafts((current) => ({ ...current, [plan.id]: value }))
            }
          />
        ))}
      </div>

      {expandedPlan ? (
        <ExpandedStrategyView
          candidate={selectedCandidate}
          plan={expandedPlan}
          onExport={() => exportProposal(expandedPlan)}
          onApprove={() => approveCreative(expandedPlan)}
        />
      ) : null}
    </section>
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
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
          Selected campaign intelligence
        </p>
        <h3 className="mt-2 text-2xl font-black text-white">
          {candidate.candidateName} - {candidate.office}
        </h3>
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
        <p className="mt-4 text-sm leading-6 text-slate-300">{candidate.sourceNote}</p>
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-amber-950/20 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
          Readiness status
        </p>
        <div className="mt-3 grid gap-2 text-sm">
          <ReadinessRow label="Campaign profile" done={candidate.status === "source_backed"} />
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
      <div className={`relative min-h-48 bg-gradient-to-br ${style.cap} p-5 text-white`}>
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
          <div className={`text-4xl font-black ${style.badge}`}>{plan.optionLabel}</div>
        </div>
        <div className="pt-20">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">
            {candidate.office}
          </p>
          <h3 className="mt-2 text-2xl font-black leading-tight">{plan.title}</h3>
          <p className="mt-3 text-sm leading-6 text-white/85">{plan.tagline}</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Snapshot metrics
          </p>
          <div className={compareMode ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid grid-cols-2 gap-2"}>
            {plan.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {metric.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950" title={metric.value}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <OhioStrategyMap plan={plan} style={style} />

        <PostcardPreviewStrip plan={plan} style={style} />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Why this plan
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{plan.whyThisPlan}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {plan.indicators.map((indicator) => (
            <div key={indicator.label} className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {indicator.label}
              </p>
              <p className="mt-1 text-xs font-black text-slate-950">{indicator.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Mail wave timeline
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {plan.timeline.map((item) => (
              <div key={`${plan.id}-${item.week}`} className="min-w-28 rounded-lg bg-slate-950 px-3 py-2 text-white">
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
          <ActionButton icon={Eye} label="View Full Strategy" onClick={onExpand} active={expanded} />
          <ActionLinkButton icon={Rocket} label="Launch Campaign" href={`/political/plan?candidate=${encodeURIComponent(candidate.candidateName)}&strategy=${encodeURIComponent(plan.id)}`} />
          <ActionButton icon={PenLine} label="Request Edits" onClick={onRequestEdits} />
          <ActionLinkButton icon={Bot} label="Talk To AI Strategist" href={`/political/candidate-agent?candidate=${encodeURIComponent(candidate.id)}`} />
          <ActionButton icon={Download} label="Export Proposal" onClick={onExport} />
          <ActionButton icon={CheckCircle2} label={creativeApproved ? "Creative Approved" : "Approve Creative"} onClick={onApprove} active={creativeApproved} />
          <ActionLinkButton icon={Route} label="View Route Details" href={`/political/maps?candidate=${encodeURIComponent(candidate.id)}&strategy=${encodeURIComponent(plan.id)}`} />
          <ActionButton icon={FileText} label="Compare Plans" onClick={onExpand} />
        </div>
      </div>
    </article>
  );
}

function OhioStrategyMap({
  plan,
  style,
}: {
  plan: StrategySelectionPlan;
  style: (typeof CARD_STYLES)[number];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950 p-3 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Ohio targeting map
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Planning visualization. USPS route counts still require verification.
          </p>
        </div>
        <MapPinned className="h-5 w-5 text-blue-200" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative mx-auto h-40 w-36">
          <svg viewBox="0 0 140 160" className="h-full w-full drop-shadow-xl" role="img" aria-label="Ohio planning map">
            <path
              d="M24 38 L62 30 L100 36 L118 62 L111 118 L80 136 L42 128 L24 96 Z"
              fill="#e2e8f0"
              stroke="#ffffff"
              strokeWidth="3"
            />
            {plan.mapHighlights.slice(0, 7).map((highlight, index) => {
              const points = [
                [68, 54],
                [88, 76],
                [54, 88],
                [74, 112],
                [42, 62],
                [96, 104],
                [38, 112],
              ] as const;
              const [cx, cy] = points[index] ?? [70, 80];
              return (
                <circle
                  key={highlight}
                  cx={cx}
                  cy={cy}
                  r={index === 0 ? 11 : 8}
                  className={style.rail}
                  fill="currentColor"
                  opacity={0.84 - index * 0.06}
                />
              );
            })}
          </svg>
        </div>
        <div className="grid gap-2">
          {plan.mapHighlights.slice(0, 6).map((highlight) => (
            <div key={highlight} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold">
              {highlight}
            </div>
          ))}
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
            {plan.uspsRoutesIncluded.toLocaleString()} estimated routes / {plan.routeDensity} density
          </div>
        </div>
      </div>
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
          Production-ready postcard concepts
        </p>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          Flipbook ready
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {plan.postcards.slice(0, 4).map((postcard, index) => (
          <div key={postcard.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className={`bg-gradient-to-r ${style.cap} p-3 text-white`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                    {postcard.category}
                  </p>
                  <h4 className="mt-1 line-clamp-2 text-sm font-black">{postcard.headline}</h4>
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
            Export Proposal
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve Creative
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <CommandPanel title="Route analysis" icon={Route}>
          <MetricLine label="Estimated USPS routes" value={plan.uspsRoutesIncluded.toLocaleString()} />
          <MetricLine label="Route density" value={plan.routeDensity} />
          <MetricLine label="Saturation" value={`${plan.saturationPct}%`} />
          <MetricLine label="Verification" value={plan.productionStatus.replaceAll("_", " ")} />
        </CommandPanel>
        <CommandPanel title="Budget allocation" icon={FileText}>
          <MetricLine label="Total cost" value={formatMoney(plan.totalCampaignCostCents)} />
          <MetricLine label="Cost per household" value={formatMoney(plan.costPerHouseholdCents)} />
          <MetricLine label="Mail pieces" value={plan.estimatedImpressions.toLocaleString()} />
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
              <div key={`${plan.id}-${wave.week}-expanded`} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {wave.week}
                </p>
                <p className="mt-1 font-bold text-white">{wave.label}</p>
              </div>
            ))}
          </div>
        </CommandPanel>
        <CommandPanel title="Creative approvals" icon={MessageSquareText}>
          <div className="grid gap-2">
            {plan.postcards.map((postcard) => (
              <div key={`${postcard.id}-approval`} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
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
        <strong>{candidate.candidateName} command note:</strong> {plan.candidateFit}
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
