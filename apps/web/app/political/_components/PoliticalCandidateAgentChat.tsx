"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Heart,
  Loader2,
  Mail,
  MapPinned,
  MessageSquare,
  PenLine,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import {
  getCandidateCampaignAgent,
  getDefaultCandidateId,
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  REVIEW_ACTIONS,
  summarizeCandidateAgent,
  type CandidateCampaignAgent,
  type CandidateCampaignPhase,
  type CandidateCampaignStrategy,
  type CandidateTargetId,
  type CreativeCategory,
  type PostcardConcept,
  type ReviewAction,
} from "@/lib/political/candidate-agent-recommendations";

type MessageRole = "agent" | "user";
type AgentStatus = "ready" | "thinking" | "error";
type CardSide = "front" | "back";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const MONEY_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const INTEGER = new Intl.NumberFormat("en-US");

const QUICK_PROMPTS = [
  "Show recommended strategies",
  "Explain route clusters",
  "Show postcard concepts",
  "What is missing before checkout?",
] as const;

function moneyFromCents(cents: number, whole = false) {
  return (whole ? MONEY_WHOLE : MONEY).format(cents / 100);
}

function number(value: number) {
  return INTEGER.format(value);
}

function buildAgentReply(agent: CandidateCampaignAgent, prompt: string): string {
  const normalized = prompt.toLowerCase();
  const profile = agent.profile;
  const primaryStrategy = agent.strategies[0]!;
  const firstGeo = agent.geographicRecommendations[0];

  if (normalized.includes("route") || normalized.includes("map") || normalized.includes("geograph")) {
    return `${profile.shortName}'s strongest aggregate route-planning layer starts with ${profile.topCounties
      .slice(0, 4)
      .join(", ")} and ${profile.routeClusters.slice(0, 2).join(", ")}. These are planning recommendations only until USPS EDDM or carrier-route counts are imported and timestamped.`;
  }

  if (normalized.includes("postcard") || normalized.includes("creative") || normalized.includes("concept")) {
    return `The flipbook has complete front/back concepts for every phase and four creative categories: Emotional/Human, Policy/Issue Focused, Testimonial/Social Proof, and Contrast/Urgency. Current phase starts with "${primaryStrategy.phases[0]?.postcardConcepts[0]?.headline ?? "a complete concept"}".`;
  }

  if (normalized.includes("checkout") || normalized.includes("missing") || normalized.includes("quote")) {
    return "Checkout stays locked until campaign contact, final geography, USPS route counts, print/postage math, source timestamps, disclaimer review, and human approval are complete. This is intentional so demo/sample planning data cannot become a production quote.";
  }

  if (normalized.includes("strategy") || normalized.includes("recommend")) {
    return `${profile.candidateName} has ${agent.strategies.length} strategy paths. The first is ${primaryStrategy.title}, modeled at ${number(primaryStrategy.households)} households per major wave, ${primaryStrategy.drops} drops, and ${moneyFromCents(primaryStrategy.pricePerPostcardCents)} per postcard.`;
  }

  if (normalized.includes("source") || normalized.includes("compliance") || normalized.includes("guardrail")) {
    return `The ${profile.shortName} agent uses public sources, aggregate geographies, route logistics, and HomeReach pricing only. It does not infer individual political beliefs, score voters, or create sensitive-demographic targeting.`;
  }

  return `${profile.candidateName} is loaded. I can walk through strategy, route/geography planning, budget assumptions, postcard concepts, review actions, and the readiness gates before proposal or checkout.`;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

interface PoliticalCandidateAgentChatProps {
  initialCandidateId?: CandidateTargetId;
}

export function PoliticalCandidateAgentChat({
  initialCandidateId = getDefaultCandidateId(),
}: PoliticalCandidateAgentChatProps = {}) {
  const [candidateId, setCandidateId] = useState<CandidateTargetId>(initialCandidateId);
  const agent = useMemo(() => getCandidateCampaignAgent(candidateId), [candidateId]);
  const summary = useMemo(() => summarizeCandidateAgent(candidateId), [candidateId]);
  const [strategyId, setStrategyId] = useState(agent.strategies[0]?.id ?? "statewide-foundation");
  const strategy = useMemo(
    () => agent.strategies.find((item) => item.id === strategyId) ?? agent.strategies[0]!,
    [agent, strategyId],
  );
  const [phaseKey, setPhaseKey] = useState(strategy.phases[0]?.phaseKey ?? "introduction");
  const phase = useMemo(
    () => strategy.phases.find((item) => item.phaseKey === phaseKey) ?? strategy.phases[0]!,
    [strategy, phaseKey],
  );
  const [category, setCategory] = useState<CreativeCategory>("Emotional/Human");
  const concept = useMemo(
    () => phase.postcardConcepts.find((item) => item.category === category) ?? phase.postcardConcepts[0]!,
    [phase, category],
  );
  const [cardSide, setCardSide] = useState<CardSide>("front");
  const [input, setInput] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("ready");
  const [statusMessage, setStatusMessage] = useState("Ready. Select a target, strategy, phase, or postcard concept.");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "agent-initial",
      role: "agent",
      text: "Multi-candidate campaign agents are loaded. Choose a candidate or party program to review source-backed strategy, geography, creative, and launch-readiness gates.",
    },
  ]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [revisionLog, setRevisionLog] = useState<Record<string, string[]>>({});

  function resetSelection(nextCandidateId: CandidateTargetId) {
    const nextAgent = getCandidateCampaignAgent(nextCandidateId);
    const nextStrategy = nextAgent.strategies[0]!;
    setCandidateId(nextCandidateId);
    setStrategyId(nextStrategy.id);
    setPhaseKey(nextStrategy.phases[0]?.phaseKey ?? "introduction");
    setCategory("Emotional/Human");
    setCardSide("front");
    setStatusMessage(`${nextAgent.profile.candidateName} agent loaded.`);
  }

  function sendMessage(value = input) {
    const trimmed = value.trim();
    if (!trimmed) return;

    const timestamp = `${Date.now()}`;
    setAgentStatus("thinking");
    setStatusMessage("Reviewing aggregate campaign planning context...");
    setMessages((current) => [...current, { id: `user-${timestamp}`, role: "user", text: trimmed }]);
    setInput("");

    window.setTimeout(() => {
      try {
        const reply = buildAgentReply(agent, trimmed);
        setMessages((current) => [...current, { id: `agent-${timestamp}`, role: "agent", text: reply }]);
        setAgentStatus("ready");
        setStatusMessage("Ready. Human approval is required before proposal, checkout, outreach, or production handoff.");
      } catch {
        setAgentStatus("error");
        setStatusMessage("The agent could not complete that answer. Use the readiness checklist or request human support.");
      }
    }, 260);
  }

  function setActionMessage(action: ReviewAction, target = concept) {
    setStatusMessage(`${action}: ${target.title}`);
  }

  function handleReviewAction(action: ReviewAction) {
    switch (action) {
      case "Preview Front":
        setCardSide("front");
        setActionMessage(action);
        return;
      case "Preview Back":
        setCardSide("back");
        setActionMessage(action);
        return;
      case "Select Design":
      case "Add to Campaign Plan":
        setSelectedIds((current) => (current.includes(concept.id) ? current : [...current, concept.id]));
        setActionMessage(action);
        return;
      case "Compare Designs":
        setCompareMode((current) => !current);
        setActionMessage(action);
        return;
      case "Save Draft":
        setDraftIds((current) => (current.includes(concept.id) ? current : [...current, concept.id]));
        setActionMessage(action);
        return;
      case "Approve Design":
        setApprovedIds((current) => (current.includes(concept.id) ? current : [...current, concept.id]));
        setActionMessage(action);
        return;
      case "Duplicate Design": {
        const note = `Duplicated for internal review at ${new Date().toLocaleTimeString()}.`;
        setRevisionLog((current) => ({ ...current, [concept.id]: [...(current[concept.id] ?? []), note] }));
        setActionMessage(action);
        return;
      }
      case "Request AI Revision":
      case "Generate Variants": {
        const note = comment.trim()
          ? `Revision request: ${comment.trim()}`
          : `${action} requested. Preserve facts, compliance, branding, and selected geography.`;
        setRevisionLog((current) => ({ ...current, [concept.id]: [...(current[concept.id] ?? []), note] }));
        setComment("");
        setActionMessage(action);
        return;
      }
      case "Leave Comment": {
        const note = comment.trim();
        if (!note) {
          setStatusMessage("Leave Comment: add a staff note first.");
          return;
        }
        setComments((current) => ({ ...current, [concept.id]: [...(current[concept.id] ?? []), note] }));
        setComment("");
        setActionMessage(action);
        return;
      }
      case "Export Proposal":
        downloadJson(`${agent.profile.id}-proposal-export.json`, {
          profile: agent.profile,
          strategy,
          selectedConceptIds: selectedIds,
          approvedConceptIds: approvedIds,
          compliance: agent.profile.complianceMode,
        });
        setActionMessage(action);
        return;
      case "Export Creative Brief":
        downloadJson(`${concept.id}-creative-brief.json`, { concept, comments: comments[concept.id] ?? [], revisions: revisionLog[concept.id] ?? [] });
        setActionMessage(action);
        return;
      case "Send to Admin Review":
      case "Send to Client Review":
        setActionMessage(action);
        return;
      default:
        setActionMessage(action);
    }
  }

  return (
    <section className="rounded-lg border border-blue-300/15 bg-slate-950 shadow-2xl shadow-blue-950/20">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-300/20 bg-blue-500/15 text-blue-100">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                  Multi-Candidate AI Campaign Agents
                </p>
                <h2 className="text-2xl font-black text-white">{agent.profile.candidateName}</h2>
              </div>
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Dedicated campaign intelligence, aggregate geography planning, complete postcard concepts, and review/export workflows for each target. Planning data remains estimated until source timestamps and USPS counts are verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill icon={ShieldCheck} label="No individual voter scoring" tone="emerald" />
            <StatusPill icon={AlertTriangle} label="USPS counts required before checkout" tone="amber" />
            <StatusPill icon={CheckCircle2} label={`${MULTI_CANDIDATE_CAMPAIGN_AGENTS.length} agents loaded`} tone="blue" />
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {MULTI_CANDIDATE_CAMPAIGN_AGENTS.map((candidateAgent) => {
            const active = candidateAgent.profile.id === candidateId;
            return (
              <button
                key={candidateAgent.profile.id}
                type="button"
                onClick={() => resetSelection(candidateAgent.profile.id)}
                className={`rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-blue-300/60 bg-blue-500/20 shadow-lg shadow-blue-950/20"
                    : "border-white/10 bg-white/[0.04] hover:border-blue-300/30 hover:bg-blue-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-white">{candidateAgent.profile.candidateName}</div>
                    <div className="mt-1 text-xs text-slate-400">{candidateAgent.profile.office}</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
                    {candidateAgent.profile.partyOrCommittee}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[430px_1fr]">
        <aside className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
          <CandidateProfilePanel agent={agent} summary={summary} status={agentStatus} statusMessage={statusMessage} />

          <div className="mt-5 space-y-3">
            <div className="h-72 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/80 p-3">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[86%] rounded-lg bg-blue-600 px-3 py-2 text-sm leading-6 text-white"
                        : "max-w-[92%] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-200"
                    }
                  >
                    {message.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={agentStatus === "thinking"}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/30 hover:bg-blue-500/15 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={`Ask the ${agent.profile.shortName} launch agent...`}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-300 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send message to candidate campaign launch agent"
                disabled={agentStatus === "thinking"}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-600 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {agentStatus === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </aside>

        <div className="space-y-6 p-5">
          <StrategySelector
            agent={agent}
            selectedStrategy={strategy}
            onSelect={(nextStrategy) => {
              setStrategyId(nextStrategy.id);
              setPhaseKey(nextStrategy.phases[0]?.phaseKey ?? "introduction");
              setCategory("Emotional/Human");
              setCardSide("front");
              setStatusMessage(`${nextStrategy.title} selected.`);
            }}
          />

          <GeographyIntelligence agent={agent} />

          <PhaseTimeline
            strategy={strategy}
            phase={phase}
            onSelect={(nextPhase) => {
              setPhaseKey(nextPhase.phaseKey);
              setCategory("Emotional/Human");
              setCardSide("front");
              setStatusMessage(`${nextPhase.phaseKey.replaceAll("-", " ")} phase selected.`);
            }}
          />

          <PostcardFlipbook
            agent={agent}
            strategy={strategy}
            phase={phase}
            concept={concept}
            category={category}
            side={cardSide}
            favoriteIds={favoriteIds}
            selectedIds={selectedIds}
            approvedIds={approvedIds}
            draftIds={draftIds}
            compareMode={compareMode}
            comment={comment}
            comments={comments[concept.id] ?? []}
            revisions={revisionLog[concept.id] ?? []}
            onCategory={setCategory}
            onSide={setCardSide}
            onComment={setComment}
            onAction={handleReviewAction}
            onToggleFavorite={() => {
              setFavoriteIds((current) =>
                current.includes(concept.id) ? current.filter((id) => id !== concept.id) : [...current, concept.id],
              );
              setStatusMessage(favoriteIds.includes(concept.id) ? "Removed from favorites." : "Added to favorites.");
            }}
          />
        </div>
      </div>
    </section>
  );
}

function CandidateProfilePanel({
  agent,
  summary,
  status,
  statusMessage,
}: {
  agent: CandidateCampaignAgent;
  summary: ReturnType<typeof summarizeCandidateAgent>;
  status: AgentStatus;
  statusMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div className={`rounded-lg bg-gradient-to-br ${agent.profile.colorClass} p-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${agent.profile.accentClass}`}>
              Dedicated Agent
            </p>
            <h3 className="mt-2 text-xl font-black text-white">{agent.profile.candidateName}</h3>
            <p className="mt-1 text-sm text-slate-200">{agent.profile.office}</p>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
              Election
            </div>
            <div className="text-sm font-black text-white">{agent.profile.electionDate}</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-100">{agent.profile.publicCampaignFrame}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AgentMetric icon={FileText} label="Strategies" value={`${summary.plans}`} />
        <AgentMetric icon={Users} label="Modeled Reach" value={number(summary.estimatedReach)} />
        <AgentMetric icon={Mail} label="Investment" value={moneyFromCents(summary.investmentCents, true)} />
        <AgentMetric icon={MapPinned} label="Geographies" value={`${agent.geographicRecommendations.length} clusters`} />
      </div>

      <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-black text-emerald-50">
          <ShieldCheck className="h-4 w-4" />
          Compliance lock
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-50/80">{agent.profile.complianceMode}</p>
      </div>

      <div className="rounded-lg border border-blue-300/20 bg-blue-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-black text-blue-50">
          {status === "thinking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          Agent status: {status === "thinking" ? "Thinking" : status === "error" ? "Needs fallback" : "Online"}
        </div>
        <p className="mt-2 text-sm leading-6 text-blue-50/80">{statusMessage}</p>
      </div>

      <DisclosurePanel title="Source-backed profile">
        <div className="space-y-2">
          {agent.profile.biographyBullets.map((item) => (
            <p key={item} className="text-xs leading-5 text-slate-300">
              {item}
            </p>
          ))}
        </div>
      </DisclosurePanel>

      <DisclosurePanel title="Research gaps">
        <div className="space-y-2">
          {agent.profile.riskOrResearchGaps.map((item) => (
            <p key={item} className="text-xs leading-5 text-amber-100">
              {item}
            </p>
          ))}
        </div>
      </DisclosurePanel>
    </div>
  );
}

function StrategySelector({
  agent,
  selectedStrategy,
  onSelect,
}: {
  agent: CandidateCampaignAgent;
  selectedStrategy: CandidateCampaignStrategy;
  onSelect: (strategy: CandidateCampaignStrategy) => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
            Strategy Generator
          </p>
          <h3 className="mt-1 text-2xl font-black text-white">4 campaign paths for {agent.profile.shortName}</h3>
        </div>
        <div className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
          Planning estimates, not checkout quotes
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        {agent.strategies.map((strategy) => {
          const active = strategy.id === selectedStrategy.id;
          return (
            <button
              key={strategy.id}
              type="button"
              onClick={() => onSelect(strategy)}
              className={`rounded-lg border p-4 text-left transition ${
                active ? "border-blue-300/60 bg-blue-500/20" : "border-white/10 bg-slate-950/70 hover:border-blue-300/30"
              }`}
            >
              <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">{strategy.campaignTheme}</div>
              <h4 className="mt-2 text-base font-black text-white">{strategy.title}</h4>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-300">{strategy.strategyOverview}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MiniStat label="Drops" value={`${strategy.drops}`} />
                <MiniStat label="Pieces" value={number(strategy.totalPieces)} />
                <MiniStat label="Postcard" value={moneyFromCents(strategy.pricePerPostcardCents)} />
                <MiniStat label="Budget" value={moneyFromCents(strategy.estimatedTotalCents, true)} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GeographyIntelligence({ agent }: { agent: CandidateCampaignAgent }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
            Candidate-Specific Geographic Intelligence
          </p>
          <h3 className="mt-1 text-xl font-black text-white">Aggregate mail opportunities by geography</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            These are candidate-specific planning clusters based on public geography, historic aggregate election context, route-density logic, and campaign fit. USPS counts must replace estimates before quote or checkout.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agent.geographicRecommendations.slice(0, 9).map((geo) => (
          <article key={`${geo.type}-${geo.label}`} className="rounded-lg border border-white/10 bg-slate-950 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">{geo.label}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {geo.type.replaceAll("_", " ")} / {geo.phaseFit}
                </div>
              </div>
              <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-100">
                {geo.dataStatus.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">{geo.rationale}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Volume" value={number(geo.estimatedMailVolume)} />
              <MiniStat label="Mail Fit" value={`${geo.mailEfficiencyScore}`} />
              <MiniStat label="Routes" value={`${geo.routeDensityScore}`} />
            </div>
            <p className="mt-3 text-xs font-bold text-blue-100">
              {geo.messageFit} / {geo.postcardStyle}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PhaseTimeline({
  strategy,
  phase,
  onSelect,
}: {
  strategy: CandidateCampaignStrategy;
  phase: CandidateCampaignPhase;
  onSelect: (phase: CandidateCampaignPhase) => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-blue-200" />
        <h3 className="font-black text-white">Multi-phase campaign plan</h3>
      </div>
      <div className="mt-4 grid gap-2 xl:grid-cols-6">
        {strategy.phases.map((item) => {
          const active = item.phaseKey === phase.phaseKey;
          return (
            <button
              key={item.phaseKey}
              type="button"
              onClick={() => onSelect(item)}
              className={`rounded-lg border p-3 text-left transition ${
                active ? "border-red-300/50 bg-red-500/20" : "border-white/10 bg-slate-950/70 hover:bg-white/10"
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Phase {item.phaseNumber}
              </div>
              <div className="mt-1 text-sm font-black capitalize text-white">{item.phaseKey.replaceAll("-", " ")}</div>
              <div className="mt-2 text-xs leading-5 text-slate-300">{item.timing}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MiniStat label="Objective" value={phase.objective} />
        <MiniStat label="Target Geography" value={phase.targetGeography} />
        <MiniStat label="Mail Quantity" value={number(phase.mailQuantity)} />
      </div>
    </section>
  );
}

function PostcardFlipbook({
  agent,
  strategy,
  phase,
  concept,
  category,
  side,
  favoriteIds,
  selectedIds,
  approvedIds,
  draftIds,
  compareMode,
  comment,
  comments,
  revisions,
  onCategory,
  onSide,
  onComment,
  onAction,
  onToggleFavorite,
}: {
  agent: CandidateCampaignAgent;
  strategy: CandidateCampaignStrategy;
  phase: CandidateCampaignPhase;
  concept: PostcardConcept;
  category: CreativeCategory;
  side: CardSide;
  favoriteIds: string[];
  selectedIds: string[];
  approvedIds: string[];
  draftIds: string[];
  compareMode: boolean;
  comment: string;
  comments: string[];
  revisions: string[];
  onCategory: (category: CreativeCategory) => void;
  onSide: (side: CardSide) => void;
  onComment: (value: string) => void;
  onAction: (action: ReviewAction) => void;
  onToggleFavorite: () => void;
}) {
  const currentIndex = phase.postcardConcepts.findIndex((item) => item.id === concept.id);

  function step(direction: -1 | 1) {
    const nextIndex = (currentIndex + direction + phase.postcardConcepts.length) % phase.postcardConcepts.length;
    onCategory(phase.postcardConcepts[nextIndex]?.category ?? "Emotional/Human");
  }

  return (
    <section className="rounded-lg border border-blue-300/20 bg-blue-950/20 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
            Complete Postcard Flipbook
          </p>
          <h3 className="mt-1 text-2xl font-black text-white">{concept.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Every phase includes four complete front/back concepts with editable copy, CTA, image, compliance, comment, revision, approval, and export states.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {phase.postcardConcepts.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onCategory(item.category)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              item.category === category
                ? "border-blue-300/60 bg-blue-500/20 text-white"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
            }`}
          >
            {item.category}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSide("front")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${side === "front" ? "bg-blue-600 text-white" : "bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}
            >
              Preview Front
            </button>
            <button
              type="button"
              onClick={() => onSide("back")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${side === "back" ? "bg-blue-600 text-white" : "bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}
            >
              Preview Back
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
            >
              <Heart className={`h-4 w-4 ${favoriteIds.includes(concept.id) ? "fill-red-400 text-red-300" : "text-slate-300"}`} />
              Favorite
            </button>
          </div>

          <PostcardPreview agent={agent} strategy={strategy} phase={phase} concept={concept} side={side} />

          {compareMode && (
            <div className="grid gap-3 lg:grid-cols-2">
              {phase.postcardConcepts
                .filter((item) => selectedIds.includes(item.id) || item.id === concept.id)
                .slice(0, 2)
                .map((item) => (
                  <PostcardPreview key={item.id} agent={agent} strategy={strategy} phase={phase} concept={item} side="front" compact />
                ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Selected" value={selectedIds.includes(concept.id) ? "Yes" : "No"} />
              <MiniStat label="Draft" value={draftIds.includes(concept.id) ? "Saved" : "Unsaved"} />
              <MiniStat label="Approved" value={approvedIds.includes(concept.id) ? "Yes" : "No"} />
              <MiniStat label="Comments" value={`${comments.length}`} />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
            <h4 className="font-black text-white">Creative metadata</h4>
            <div className="mt-3 space-y-3 text-xs leading-5 text-slate-300">
              <p><span className="font-bold text-white">CTA:</span> {concept.cta}</p>
              <p><span className="font-bold text-white">Imagery:</span> {concept.suggestedImagery}</p>
              <p><span className="font-bold text-white">Geography:</span> {concept.geographicFit}</p>
              <p><span className="font-bold text-white">Compliance:</span> {concept.complianceDisclaimer}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
            <h4 className="font-black text-white">Staff comment</h4>
            <textarea
              value={comment}
              onChange={(event) => onComment(event.target.value)}
              rows={4}
              placeholder="Example: Make this more local and more focused on working families."
              className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-300 focus:outline-none"
            />
            {(comments.length > 0 || revisions.length > 0) && (
              <div className="mt-3 space-y-2">
                {[...comments.map((item) => `Comment: ${item}`), ...revisions.map((item) => `Revision: ${item}`)].map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            {REVIEW_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onAction(action)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white transition hover:border-blue-300/40 hover:bg-blue-500/15"
              >
                <ActionIcon action={action} />
                {action}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PostcardPreview({
  agent,
  strategy,
  phase,
  concept,
  side,
  compact = false,
}: {
  agent: CandidateCampaignAgent;
  strategy: CandidateCampaignStrategy;
  phase: CandidateCampaignPhase;
  concept: PostcardConcept;
  side: CardSide;
  compact?: boolean;
}) {
  const isFront = side === "front";
  return (
    <div className={`rounded-xl border border-white/15 bg-white p-3 text-slate-950 shadow-2xl ${compact ? "" : "min-h-[360px]"}`}>
      <div className={`grid min-h-[320px] overflow-hidden rounded-lg border border-slate-200 ${isFront ? "grid-cols-[1fr_0.62fr]" : "grid-cols-[1fr_0.48fr]"}`}>
        <div className={`bg-gradient-to-br ${agent.profile.colorClass} p-6 text-white`}>
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              {concept.category}
            </div>
            <div className="text-right text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
              {phase.phaseKey.replaceAll("-", " ")}
            </div>
          </div>
          <h4 className={`${compact ? "mt-5 text-2xl" : "mt-8 text-4xl"} font-black leading-tight`}>
            {isFront ? concept.headline : concept.subheadline}
          </h4>
          <p className={`${compact ? "mt-3 text-sm" : "mt-5 text-base"} leading-7 text-white/88`}>
            {isFront ? concept.frontBody : concept.backBody}
          </p>
          <div className="mt-6 rounded-lg border border-white/25 bg-white/10 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Visual direction</div>
            <p className="mt-1 text-xs leading-5 text-white/85">{concept.visualDirection}</p>
          </div>
        </div>

        <div className="flex flex-col bg-slate-50 p-5">
          {isFront ? (
            <>
              <div className="flex-1 rounded-lg border-2 border-dashed border-slate-300 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Image zone</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-800">{concept.suggestedImagery}</p>
              </div>
              <div className="mt-4 rounded-lg bg-red-600 px-4 py-3 text-center text-sm font-black text-white">
                {concept.cta}
              </div>
            </>
          ) : (
            <>
              <div className="h-16 rounded border border-slate-300 bg-white p-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Postage / indicia
              </div>
              <div className="mt-4 flex-1 rounded border border-slate-300 bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Address panel</div>
                <div className="mt-8 h-2 w-36 rounded bg-slate-200" />
                <div className="mt-2 h-2 w-44 rounded bg-slate-200" />
                <div className="mt-2 h-2 w-28 rounded bg-slate-200" />
              </div>
              <div className="mt-4 rounded border border-slate-300 bg-white p-3">
                <div className="text-xs font-black text-slate-900">QR / landing page</div>
                <div className="mt-2 grid h-16 w-16 grid-cols-3 gap-1 bg-slate-900 p-1">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className={index % 2 ? "bg-white" : "bg-slate-900"} />
                  ))}
                </div>
              </div>
            </>
          )}
          <p className="mt-4 text-[10px] leading-4 text-slate-500">{concept.complianceDisclaimer}</p>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
          <div><span className="font-black text-slate-950">Strategy:</span> {strategy.title}</div>
          <div><span className="font-black text-slate-950">Geography:</span> {phase.targetGeography}</div>
          <div><span className="font-black text-slate-950">Mail:</span> {number(phase.mailQuantity)} pieces</div>
        </div>
      )}
    </div>
  );
}

function ActionIcon({ action }: { action: ReviewAction }) {
  if (action.includes("Preview")) return <Eye className="h-3.5 w-3.5" />;
  if (action.includes("Export")) return <Download className="h-3.5 w-3.5" />;
  if (action.includes("Copy") || action.includes("Duplicate")) return <Copy className="h-3.5 w-3.5" />;
  if (action.includes("Comment") || action.includes("Revision")) return <MessageSquare className="h-3.5 w-3.5" />;
  if (action.includes("Approve") || action.includes("Select")) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (action.includes("Edit") || action.includes("Swap") || action.includes("Generate")) return <PenLine className="h-3.5 w-3.5" />;
  if (action.includes("Client") || action.includes("Admin")) return <Send className="h-3.5 w-3.5" />;
  return <Star className="h-3.5 w-3.5" />;
}

function AgentMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-bold text-white" title={value}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 line-clamp-2 text-xs font-bold text-white" title={value}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  tone: "emerald" | "amber" | "blue";
}) {
  const className =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "amber"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : "border-blue-300/20 bg-blue-500/10 text-blue-100";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function DisclosurePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <Sparkles className="h-4 w-4 text-amber-200" />
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
