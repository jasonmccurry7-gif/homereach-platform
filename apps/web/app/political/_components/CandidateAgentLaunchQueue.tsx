"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Lock,
  MapPinned,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type {
  CandidateLaunchReadiness,
  CandidateReadinessGate,
} from "@/lib/political/candidate-readiness";

export interface CandidateAgentLaunchQueueItem {
  id: string;
  candidateName: string;
  officeSought: string;
  party: string;
  geography: string;
  electionLabel: string;
  raceType: string;
  campaignStatus: string;
  agentStatus: string;
  nextAction: string;
  confidenceScore: number;
  planStatus: string;
  hasResearch: boolean;
  hasPlan: boolean;
  hasCampaignWebsite: boolean;
  hasSource: boolean;
  readiness: CandidateLaunchReadiness;
}

type QueueFilter = "all" | "blocked" | "verification" | "verified";
type AgentPrompt = "brief" | "missing" | "checkout" | "next";

const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: "all", label: "All agents" },
  { key: "blocked", label: "Needs data" },
  { key: "verification", label: "In verification" },
  { key: "verified", label: "Verified" },
];

function gateTone(status: CandidateReadinessGate["status"]) {
  if (status === "complete") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  if (status === "review") return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  return "border-red-300/20 bg-red-500/10 text-red-100";
}

function GateIcon({ status }: { status: CandidateReadinessGate["status"] }) {
  if (status === "complete") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "review") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Lock className="h-3.5 w-3.5" />;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function filterItem(item: CandidateAgentLaunchQueueItem, filter: QueueFilter) {
  if (filter === "verified") return item.readiness.checkoutEnabled;
  if (filter === "verification") {
    return !item.readiness.checkoutEnabled && item.readiness.score >= 50;
  }
  if (filter === "blocked") return item.readiness.gates.some((gate) => gate.status === "blocked");
  return true;
}

function agentReply(item: CandidateAgentLaunchQueueItem, prompt: AgentPrompt) {
  const missing = item.readiness.gates.filter((gate) => gate.status !== "complete");
  const missingLabels = missing.map((gate) => gate.label).join(", ") || "none";

  if (prompt === "missing") {
    return `${item.candidateName} is ${item.readiness.score}% ready. Missing or review gates: ${missingLabels}. The agent can discuss stored candidate fields, public-source research, geography, plan status, and next actions, but it will not invent campaign contact details or final USPS pricing.`;
  }

  if (prompt === "checkout") {
    return item.readiness.checkoutEnabled
      ? `${item.candidateName} has a verified launch package. Proposal/checkout can move through the protected workflow with human approval.`
      : `Checkout stays locked for ${item.candidateName}. Next blocker: ${item.readiness.nextRequiredAction}`;
  }

  if (prompt === "next") {
    return `Next best action for ${item.candidateName}: ${item.readiness.nextRequiredAction} Current workspace status is ${item.agentStatus}; plan status is ${item.planStatus}.`;
  }

  return `${item.candidateName} is loaded as a campaign-specific AI launch agent for ${item.officeSought} in ${item.geography}. The agent can speak on stored public-source context, aggregate geography, route-safe planning, campaign timing, budget assumptions, and readiness gates.`;
}

export function CandidateAgentLaunchQueue({ items }: { items: CandidateAgentLaunchQueueItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [prompt, setPrompt] = useState<AgentPrompt>("brief");

  const metrics = useMemo(() => {
    const verified = items.filter((item) => item.readiness.checkoutEnabled).length;
    const needsUsps = items.filter((item) =>
      item.readiness.gates.some((gate) => gate.key === "usps" && gate.status !== "complete"),
    ).length;
    const needsContact = items.filter((item) =>
      item.readiness.gates.some((gate) => gate.key === "contact" && gate.status !== "complete"),
    ).length;

    return { verified, needsUsps, needsContact };
  }, [items]);

  const filtered = useMemo(() => {
    const search = normalize(query);
    return items.filter((item) => {
      if (!filterItem(item, filter)) return false;
      if (!search) return true;
      return normalize(
        `${item.candidateName} ${item.officeSought} ${item.party} ${item.geography} ${item.electionLabel} ${item.raceType}`,
      ).includes(search);
    });
  }, [filter, items, query]);

  const selected =
    items.find((item) => item.id === selectedId) ??
    filtered[0] ??
    items[0] ??
    null;
  const selectedGateSummary = selected?.readiness.gates.slice(0, 7) ?? [];

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-200" />
          <h2 className="font-black text-white">Candidate agent queue</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          No source-backed candidate records are visible yet. Start a campaign plan or add candidate records in the
          admin workspace to queue dedicated campaign agents.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/political/plan"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
          >
            Start Campaign Plan
          </Link>
          <Link
            href="/political/maps"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10"
          >
            Validate Map
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-blue-300/15 bg-slate-950 p-5 shadow-2xl shadow-blue-950/20">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Prebuilt Campaign Agents
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">Agent launch queue</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                These agents are ready to speak on stored candidate records, public-source research, launch plans,
                route-safe geography, and missing readiness gates. They are not final USPS-quoted campaigns until
                verification is complete.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QueueMetric label="Agents queued" value={items.length.toLocaleString()} />
            <QueueMetric label="Need USPS counts" value={metrics.needsUsps.toLocaleString()} tone="amber" />
            <QueueMetric label="Need contact" value={metrics.needsContact.toLocaleString()} tone="amber" />
            <QueueMetric label="Verified packages" value={metrics.verified.toLocaleString()} tone="green" />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search candidate, office, county, district, party"
                className="h-11 w-full rounded-lg border border-white/10 bg-slate-900 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-300/60"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                    filter === item.key
                      ? "border-blue-300/40 bg-blue-500/20 text-blue-50"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                No candidate agents match this filter.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setPrompt("brief");
                  }}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selected?.id === item.id
                      ? "border-blue-300/40 bg-blue-500/15"
                      : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-white">{item.candidateName}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-300">
                        {item.officeSought} / {item.party} / {item.geography}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
                      {item.readiness.statusLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <QueueMini label="Readiness" value={`${item.readiness.score}%`} />
                    <QueueMini label="Confidence" value={`${item.confidenceScore}%`} />
                    <QueueMini label="Plan" value={item.planStatus} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selected && (
          <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  Selected Campaign Agent
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">{selected.candidateName}</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {selected.officeSought} / {selected.geography} / {selected.electionLabel}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Readiness
                </div>
                <div className="text-2xl font-black text-white">{selected.readiness.score}%</div>
                <div className="text-xs text-slate-300">{selected.readiness.statusLabel}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AgentFact icon={Bot} label="Agent status" value={selected.agentStatus} />
              <AgentFact icon={MapPinned} label="Race type" value={selected.raceType} />
              <AgentFact icon={ShieldCheck} label="Source" value={selected.hasSource ? "Attached" : "Missing"} />
              <AgentFact icon={CheckCircle2} label="Research" value={selected.hasResearch ? "Loaded" : "Needed"} />
            </div>

            <div className="mt-5 rounded-lg border border-blue-300/15 bg-blue-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-blue-50">
                <Bot className="h-4 w-4" />
                Agent answer
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-50/85">{agentReply(selected, prompt)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["brief", "What can it discuss?"],
                  ["missing", "Show gaps"],
                  ["checkout", "Why checkout is locked"],
                  ["next", "Next best action"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPrompt(key as AgentPrompt)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      prompt === key
                        ? "border-blue-200/40 bg-blue-400/20 text-blue-50"
                        : "border-white/10 bg-slate-950/50 text-slate-200 hover:bg-white/[0.08]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              {selectedGateSummary.map((gate) => (
                <div
                  key={gate.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-xs leading-5 ${gateTone(gate.status)}`}
                >
                  <GateIcon status={gate.status} />
                  <div>
                    <div className="font-black text-white">{gate.label}</div>
                    <div className="opacity-85">{gate.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/political/maps"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Validate Map
              </Link>
              <Link
                href="/political/plan"
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/10"
              >
                Start Plan
              </Link>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

function QueueMetric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "amber" | "green";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "amber"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : "border-blue-300/20 bg-blue-500/10 text-blue-100";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function QueueMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-bold capitalize text-white" title={value}>
        {value}
      </div>
    </div>
  );
}

function AgentFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-bold capitalize text-white" title={value}>
        {value}
      </div>
    </div>
  );
}
