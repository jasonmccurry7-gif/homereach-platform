"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  DollarSign,
  FileText,
  Headphones,
  Loader2,
  Mail,
  MapPinned,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  CandidateAgentCoverageOption,
  CandidateAgentCoveragePlan,
  CandidateCoverageTier,
} from "@/lib/political/candidate-coverage-plan";
import type { OhioCandidateSelectorOption } from "@/lib/political/ohio-candidate-selector";
import { CandidateCoverageMapPreview } from "./CandidateCoverageMapPreview";

type MessageRole = "agent" | "user";
type AgentStatus = "ready" | "thinking" | "error";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

interface ChatApiResponse {
  ok: boolean;
  reply?: string;
  mode?: "ai" | "fallback";
  error?: string;
}

interface PoliticalCandidateAgentChatProps {
  candidate: OhioCandidateSelectorOption;
  coveragePlan: CandidateAgentCoveragePlan;
}

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US");

const QUICK_PROMPTS = [
  "Compare the 4 coverage options",
  "Which option fits a lower budget?",
  "Explain the recommended geographies",
  "What keeps checkout locked?",
] as const;

function moneyFromCents(cents: number) {
  return MONEY.format(cents / 100);
}

function centsFromCents(cents: number) {
  return CENTS.format(cents / 100);
}

function number(value: number) {
  return INTEGER.format(value);
}

function initialAgentMessage(candidate: OhioCandidateSelectorOption, plan: CandidateAgentCoveragePlan) {
  return `${plan.agentName} is loaded. I can compare the four coverage options, explain the multi-phase mail plan, walk through geography and route assumptions, and identify what must be verified before proposal, checkout, or production.`;
}

export function PoliticalCandidateAgentChat({
  candidate,
  coveragePlan,
}: PoliticalCandidateAgentChatProps) {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("ready");
  const [selectedOptionKey, setSelectedOptionKey] = useState<CandidateCoverageTier>("standard");
  const [statusMessage, setStatusMessage] = useState(
    "Ready for a campaign-specific chat about the selected candidate profile.",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "agent-initial",
      role: "agent",
      text: initialAgentMessage(candidate, coveragePlan),
    },
  ]);

  const summary = useMemo(() => {
    const standard = coveragePlan.options[0];
    const premium = coveragePlan.options[coveragePlan.options.length - 1] ?? standard;
    return {
      optionCount: coveragePlan.options.length,
      standardHouseholds: standard?.households ?? 0,
      premiumHouseholds: premium?.households ?? 0,
      premiumEstimate: premium?.totalEstimateCents ?? 0,
    };
  }, [coveragePlan.options]);

  useEffect(() => {
    setInput("");
    setAgentStatus("ready");
    setSelectedOptionKey("standard");
    setStatusMessage("Ready for a campaign-specific chat about the selected candidate profile.");
    setMessages([
      {
        id: `agent-initial-${candidate.value}`,
        role: "agent",
        text: initialAgentMessage(candidate, coveragePlan),
      },
    ]);
  }, [candidate.value, candidate.candidateName, coveragePlan]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [agentStatus, messages]);

  async function sendMessage(value = input) {
    const trimmed = value.trim();
    if (!trimmed || agentStatus === "thinking") return;

    const timestamp = `${Date.now()}`;
    const userMessage: ChatMessage = { id: `user-${timestamp}`, role: "user", text: trimmed };
    const outgoingMessages = [...messages, userMessage];

    setAgentStatus("thinking");
    setStatusMessage("Reading the selected candidate plan and preparing a reply...");
    setMessages(outgoingMessages);
    setInput("");

    try {
      const response = await fetch("/api/political/candidate-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: candidate.value,
          candidateProfile: candidate,
          message: trimmed,
          messages: outgoingMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        }),
      });
      const data = (await response.json()) as ChatApiResponse;

      if (!response.ok || !data.ok || !data.reply) {
        throw new Error(data.error ?? "The campaign agent could not answer.");
      }

      setMessages((current) => [
        ...current,
        {
          id: `agent-${timestamp}`,
          role: "agent",
          text: data.reply ?? "I could not generate a useful answer from the selected campaign context.",
        },
      ]);
      setAgentStatus("ready");
      setStatusMessage(
        data.mode === "ai"
          ? "Reply generated from the selected candidate context. Human approval is still required for proposal, outreach, checkout, or production."
          : "Live AI was unavailable, so I answered from the loaded candidate plan and readiness rules.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent could not complete that answer.";
      setMessages((current) => [
        ...current,
        {
          id: `agent-error-${timestamp}`,
          role: "agent",
          text: `${message} You can keep asking, or use Plan/Maps while a HomeReach operator verifies campaign data.`,
        },
      ]);
      setAgentStatus("error");
      setStatusMessage("The chat endpoint hit an error. Your message stayed in the thread.");
    }
  }

  return (
    <section className="rounded-lg border border-blue-300/15 bg-slate-950 shadow-2xl shadow-blue-950/20">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-300/20 bg-blue-500/15 text-blue-100">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                Dedicated AI Campaign Agent
              </p>
              <h2 className="text-xl font-black text-white">{coveragePlan.agentName}</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AgentMetric icon={FileText} label="Office" value={candidate.officeSought} />
            <AgentMetric icon={MapPinned} label="Geography" value={candidate.geography} />
            <AgentMetric icon={Mail} label="Options" value={`${summary.optionCount} coverage paths`} />
            <AgentMetric icon={Users} label="Mode" value="Aggregate reach only" />
          </div>

          <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-50">
              <ShieldCheck className="h-4 w-4" />
              Compliance lock
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              Geography, household counts, budget, timing, and USPS logistics only. No individual voter scoring,
              ideology prediction, or vote-impact claims.
            </p>
          </div>

          <div className="mt-5 rounded-lg border border-blue-300/20 bg-blue-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-blue-50">
              {agentStatus === "thinking" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              Agent status: {agentStatus === "thinking" ? "Thinking" : agentStatus === "error" ? "Needs fallback" : "Online"}
            </div>
            <p className="mt-2 text-sm leading-6 text-blue-50/80">{statusMessage}</p>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Sparkles className="h-4 w-4 text-amber-200" />
              Candidate-specific plan frame
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{coveragePlan.planFrame}</p>
            <div className="mt-3 space-y-2">
              {coveragePlan.strategicNeeds.map((need) => (
                <div key={need} className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-300">
                  {need}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="h-[420px] overflow-y-auto rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[86%] rounded-lg bg-blue-600 px-3 py-2 text-sm leading-6 text-white"
                          : "max-w-[92%] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-200"
                      }
                    >
                      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] opacity-70">
                        {message.role === "user" ? "You" : "Campaign AI Agent"}
                      </div>
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    </div>
                  </div>
                ))}
                {agentStatus === "thinking" && (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-lg border border-blue-300/15 bg-blue-500/10 px-3 py-2 text-sm leading-6 text-blue-50">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Campaign AI Agent is typing
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={agentStatus === "thinking"}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/30 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="grid gap-2 sm:grid-cols-[1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <label className="sr-only" htmlFor="campaign-agent-chat-input">
                Type a message to the campaign AI agent
              </label>
              <textarea
                id="campaign-agent-chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
                placeholder={`Ask ${candidate.candidateName}'s agent about coverage, phases, geography, budget, or readiness gates.`}
                disabled={agentStatus === "thinking"}
                className="min-h-24 min-w-0 resize-y rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm leading-6 text-white placeholder:text-slate-500 focus:border-blue-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label="Send message to candidate campaign launch agent"
                disabled={agentStatus === "thinking" || input.trim().length === 0}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {agentStatus === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </form>

            <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                <Headphones className="h-4 w-4" />
                Human support fallback
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-50/80">
                If campaign details, route data, or pricing are incomplete, the agent keeps checkout and proposal
                actions in review mode until a HomeReach operator verifies them.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                4 coverage options
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">{candidate.candidateName} mail coverage plan</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Four budget tiers are modeled from standard coverage to command coverage. Every tier includes multiple
                phases and candidate-specific geography assumptions.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Planning universe
              </div>
              <div className="mt-1 text-lg font-black text-white">{number(coveragePlan.universeHouseholds)}</div>
              <div className="text-xs text-slate-400">{coveragePlan.universeLabel}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {coveragePlan.options.map((option) => (
              <CoverageOptionCard
                key={option.key}
                candidate={candidate}
                option={option}
                selected={selectedOptionKey === option.key}
                onSelect={() => setSelectedOptionKey(option.key)}
              />
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Methodology</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{coveragePlan.methodology}</p>
            <p className="mt-2 text-sm leading-6 text-amber-100">{coveragePlan.sourceNotice}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function CoverageOptionCard({
  candidate,
  option,
  selected,
  onSelect,
}: {
  candidate: OhioCandidateSelectorOption;
  option: CandidateAgentCoverageOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={
        selected
          ? "rounded-lg border border-blue-300/40 bg-blue-950/40 p-4 shadow-lg shadow-blue-950/30"
          : "rounded-lg border border-white/10 bg-slate-900/80 p-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
            {option.label} / {option.budgetLevel}
          </div>
          <h4 className="mt-1 text-lg font-black text-white">{option.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">{option.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={
              selected
                ? "rounded-md bg-blue-600 px-3 py-2 text-xs font-black text-white"
                : "rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-100 transition hover:border-blue-300/30 hover:bg-blue-500/15"
            }
          >
            {selected ? "Selected Option" : "Select Option"}
          </button>
          <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
            {option.coveragePct}% coverage model
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <PlanMetric icon={Users} label="Households" value={number(option.households)} />
        <PlanMetric icon={MapPinned} label="Routes" value={number(option.routeCount)} />
        <PlanMetric icon={Mail} label="Drops" value={`${option.drops}`} />
        <PlanMetric icon={CheckCircle2} label="Pieces" value={number(option.totalPieces)} />
        <PlanMetric icon={DollarSign} label="Est. total" value={moneyFromCents(option.totalEstimateCents)} />
        <PlanMetric icon={DollarSign} label="Per home" value={centsFromCents(option.costPerHouseholdCents)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <CandidateCoverageMapPreview option={option} selected={selected} />

        <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Recommended geography</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {option.recommendedGeographies.map((geo) => (
              <span key={geo} className="rounded-md border border-blue-300/15 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-50">
                {geo}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{option.whyThisPlan}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Estimate detail</div>
          <div className="mt-2 text-2xl font-black text-white">{moneyFromCents(option.totalEstimateCents)}</div>
          <div className="mt-1 text-xs text-slate-400">
            {number(option.totalPieces)} pieces at {centsFromCents(option.pricePerPieceCents)} planning price
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-300">
            <div>Print estimate: {moneyFromCents(option.printEstimateCents)}</div>
            <div>Postage estimate: {moneyFromCents(option.postageEstimateCents)}</div>
            <div>Complexity: {option.operationalComplexity}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Multi-phase plan</div>
        <div className="mt-3 grid gap-2">
          {option.phases.map((phase) => (
            <div key={`${option.key}-${phase.phaseNumber}`} className="rounded-md border border-white/10 bg-slate-950 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-black uppercase tracking-[0.12em] text-white">
                  Phase {phase.phaseNumber}: {phase.name}
                </div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">
                  {phase.timing}
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{phase.objective}</p>
              <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div>Geography: {phase.targetGeography}</div>
                <div>Quantity: {number(phase.mailQuantity)} postcards</div>
                <div>Message focus: {phase.messageFocus}</div>
                <div>Outcome: {phase.expectedOutcome}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          {option.readinessNote}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/political/maps?candidate=${encodeURIComponent(candidate.value)}&coverage=${option.key}`}
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-500"
        >
          View Route Details
        </Link>
        <Link
          href={`/political/plan?candidate=${encodeURIComponent(candidate.value)}&coverage=${option.key}`}
          className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-100 transition hover:bg-white/[0.08]"
        >
          Add to Campaign Plan
        </Link>
        <button
          type="button"
          disabled
          title="Requires verified USPS counts, quote lock, and human approval."
          className="cursor-not-allowed rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-xs font-black text-slate-500"
        >
          Export Proposal Locked
        </button>
      </div>
    </article>
  );
}

function PlanMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 text-base font-black text-white">{value}</div>
    </div>
  );
}
