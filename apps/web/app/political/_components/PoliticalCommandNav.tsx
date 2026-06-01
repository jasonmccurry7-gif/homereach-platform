"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bot, ChevronRight, Loader2, MapPinned, Send, X } from "lucide-react";
import {
  getCandidateCampaignAgent,
  getDefaultCandidateId,
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  type CandidateCampaignAgent,
  type CandidateTargetId,
} from "@/lib/political/candidate-agent-recommendations";

const NAV = [
  { label: "Overview", href: "/political" },
  { label: "AI Agent", href: "/political/candidate-agent" },
  { label: "Deck", href: "/political/presentation" },
  { label: "Plan", href: "/political/plan" },
  { label: "Maps", href: "/political/maps" },
  { label: "Pricing", href: "/political/pricing" },
  { label: "Routes", href: "/political/routes" },
  { label: "Timeline", href: "/political/timeline" },
  { label: "Calendar", href: "/political/calendar" },
  { label: "Simulator", href: "/political/simulator" },
  { label: "Analytics", href: "/political/analytics" },
  { label: "Data", href: "/political/data-sources" },
] as const;

const FLOW = [
  { label: "Start Campaign", href: "/political/plan", match: "/political/plan" },
  { label: "Select Geography", href: "/political/maps", match: "/political/maps" },
  { label: "Review Pricing", href: "/political/pricing", match: "/political/pricing" },
  { label: "Request Review", href: "/political/plan?intent=generate_proposal", match: "/political/thanks" },
  { label: "Schedule Drops", href: "/political/timeline", match: "/political/timeline" },
  { label: "Track Campaign", href: "/political/analytics", match: "/political/analytics" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/political") return pathname === "/political";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PoliticalCommandNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label={mobile ? "Mobile political command navigation" : "Political command navigation"}
      className={
        mobile
          ? "mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-3 [scrollbar-width:none] 2xl:hidden [&::-webkit-scrollbar]:hidden"
          : "hidden items-center gap-1 overflow-x-auto 2xl:flex"
      }
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-blue-300/50 bg-blue-500/20 text-white"
                      : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                : `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-blue-500/20 text-white ring-1 ring-blue-300/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PoliticalFlowStrip() {
  const pathname = usePathname() ?? "";

  return (
    <div className="border-b border-white/10 bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
          <MapPinned className="h-4 w-4" />
          Campaign launch flow
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FLOW.map((step, index) => {
            const active = pathname.startsWith(step.match);

            return (
              <Link
                key={`${step.href}-${index}`}
                href={step.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-blue-300/50 bg-blue-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px]">
                  {index + 1}
                </span>
                {step.label}
                {index < FLOW.length - 1 && <ChevronRight className="h-3 w-3 text-slate-500" />}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type PoliticalAgentChatLauncherVariant = "header" | "floating";
type PoliticalAgentMessage = {
  id: string;
  role: "agent" | "user";
  text: string;
};

const QUICK_AGENT_PROMPTS = [
  "What should we do next?",
  "Explain the four mail options",
  "What needs human review?",
  "Summarize the geography plan",
] as const;

export function PoliticalAgentChatLauncher({
  variant = "header",
}: {
  variant?: PoliticalAgentChatLauncherVariant;
}) {
  const searchParams = useSearchParams();
  const candidateParam = searchParams?.get("candidate") ?? null;
  const initialCandidateId = resolveCandidateId(candidateParam);
  const workspaceCandidateName = resolveWorkspaceCandidateName(candidateParam);
  const [open, setOpen] = useState(false);
  const [candidateId, setCandidateId] =
    useState<CandidateTargetId>(initialCandidateId);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const agent = useMemo(
    () => getCandidateCampaignAgent(candidateId),
    [candidateId],
  );
  const activeWorkspaceCandidateName =
    candidateId === initialCandidateId ? workspaceCandidateName : null;
  const [messages, setMessages] = useState<PoliticalAgentMessage[]>([
    {
      id: "agent-ready",
      role: "agent",
      text: initialAgentMessage(agent, workspaceCandidateName),
    },
  ]);

  useEffect(() => {
    setCandidateId(initialCandidateId);
    setMessages([
      {
        id: `agent-ready-${workspaceCandidateName ?? initialCandidateId}`,
        role: "agent",
        text: initialAgentMessage(
          getCandidateCampaignAgent(initialCandidateId),
          workspaceCandidateName,
        ),
      },
    ]);
    setThinking(false);
    setInput("");
  }, [initialCandidateId, workspaceCandidateName]);

  function openChat() {
    setOpen(true);
  }

  function send(value = input) {
    const prompt = value.trim();
    if (!prompt || thinking) return;

    const timestamp = `${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `user-${timestamp}`, role: "user", text: prompt },
    ]);
    setInput("");
    setThinking(true);

    setMessages((current) => [
      ...current,
      {
        id: `agent-${timestamp}`,
        role: "agent",
        text: buildQuickAgentReply(agent, prompt, activeWorkspaceCandidateName),
      },
    ]);
    setThinking(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openChat}
        aria-label="Open campaign AI agent chat"
        className={
          variant === "floating"
            ? "fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-blue-200/30 bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-2xl shadow-blue-950/50 transition hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            : "hidden items-center gap-2 rounded-lg border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-50 transition hover:bg-blue-500/20 md:inline-flex"
        }
      >
        <Bot className={variant === "floating" ? "h-5 w-5" : "h-4 w-4"} />
        <span className={variant === "header" ? "hidden xl:inline" : ""}>
          Chat with PoliticalReach AI
        </span>
        {variant === "header" ? <span className="xl:hidden">AI Agent</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close campaign AI chat backdrop"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <section className="absolute bottom-4 right-4 top-4 flex w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-blue-200/20 bg-slate-950 shadow-2xl shadow-blue-950/60">
            <header className="border-b border-white/10 bg-blue-950/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                    PoliticalReach
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">
                    Campaign Mail AI
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Aggregate geography, mail logistics, budget, creative review,
                    and human-approval planning only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close campaign AI chat"
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="mt-4 block">
                <span className="sr-only">Select campaign AI agent</span>
                <select
                  value={candidateId}
                  onChange={(event) => {
                    const nextCandidateId = event.target.value as CandidateTargetId;
                    const nextAgent = getCandidateCampaignAgent(nextCandidateId);
                    setCandidateId(nextCandidateId);
                    setMessages([
                      {
                        id: `agent-ready-${nextCandidateId}`,
                        role: "agent",
                        text: initialAgentMessage(nextAgent, null),
                      },
                    ]);
                  }}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-300"
                >
                  {MULTI_CANDIDATE_CAMPAIGN_AGENTS.map((candidateAgent) => (
                    <option
                      key={candidateAgent.profile.id}
                      value={candidateAgent.profile.id}
                    >
                      {candidateAgent.profile.candidateName} -{" "}
                      {candidateAgent.profile.office}
                    </option>
                  ))}
                </select>
              </label>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-50">
                No individual voter scoring, ideology prediction, sensitive
                demographic targeting, or autonomous political outreach.
              </div>
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[88%] rounded-2xl bg-blue-600 px-3 py-2 text-sm leading-6 text-white"
                        : "max-w-[92%] rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100"
                    }
                  >
                    {message.text}
                  </div>
                ))}
                {thinking ? (
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reviewing campaign context...
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="border-t border-white/10 bg-slate-950 p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {QUICK_AGENT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    disabled={thinking}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-slate-200 transition hover:border-blue-300/30 hover:bg-blue-500/15 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={`Ask about ${activeWorkspaceCandidateName ?? agent.profile.shortName}...`}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-300"
                />
                <button
                  type="submit"
                  disabled={thinking || !input.trim()}
                  aria-label="Send campaign AI message"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {thinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function resolveCandidateId(value: string | null): CandidateTargetId {
  if (
    value &&
    MULTI_CANDIDATE_CAMPAIGN_AGENTS.some((agent) => agent.profile.id === value)
  ) {
    return value as CandidateTargetId;
  }
  return getDefaultCandidateId();
}

function resolveWorkspaceCandidateName(value: string | null) {
  if (!value) return null;
  if (
    MULTI_CANDIDATE_CAMPAIGN_AGENTS.some((agent) => agent.profile.id === value)
  ) {
    return null;
  }

  const normalized = value.replace(/^candidate-/i, "").replace(/^custom-/i, "");
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(normalized)) {
    return "Selected candidate";
  }

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || null;
}

function initialAgentMessage(
  agent: CandidateCampaignAgent,
  workspaceCandidateName: string | null,
) {
  if (workspaceCandidateName) {
    return `${workspaceCandidateName} planning workspace is ready. I can help compare mail options, explain aggregate route/geography planning, flag missing approval items, and outline the next step before proposal or production.`;
  }

  return `${agent.profile.candidateName} PoliticalReach AI is ready. I can help compare mail options, explain route/geography planning, flag missing approval items, strengthen postcard creative hierarchy, and outline the next step before proposal or production.`;
}

function buildQuickAgentReply(
  agent: CandidateCampaignAgent,
  prompt: string,
  workspaceCandidateName: string | null = null,
) {
  const normalized = prompt.toLowerCase();
  const profile = agent.profile;
  const primaryStrategy = agent.strategies[0]!;
  const displayName = workspaceCandidateName ?? profile.candidateName;
  const shortName = workspaceCandidateName
    ? workspaceCandidateName.replace(/^Dr\.\s+/i, "").split(/\s+/)[0] || "campaign"
    : profile.shortName;

  if (
    normalized.includes("option") ||
    normalized.includes("strategy") ||
    normalized.includes("four")
  ) {
    if (workspaceCandidateName) {
      return `${displayName} has a review-required planning workspace loaded. Start by comparing household reach, drops, timing, and approval risk. Verify public sources, campaign contact, route counts, pricing, and disclaimer language before any external use.`;
    }

    return `${profile.candidateName} has ${agent.strategies.length} mail options loaded. Start by comparing household reach, drops, timing, and approval risk. The strongest first review path is "${primaryStrategy.title}" with ${primaryStrategy.drops} planned drops and estimated production math still requiring USPS/vendor verification.`;
  }

  if (
    normalized.includes("geography") ||
    normalized.includes("route") ||
    normalized.includes("county") ||
    normalized.includes("map")
  ) {
    if (workspaceCandidateName) {
      return `${displayName}'s planning layer should stay at aggregate geography level until verified. Use route density, county/city context, timing, budget, and production feasibility only; do not infer individual voter beliefs or score individual voters.`;
    }

    return `${shortName}'s planning layer starts with ${profile.topCounties
      .slice(0, 4)
      .join(", ")} plus ${profile.routeClusters
      .slice(0, 2)
      .join(", ")}. Use this for aggregate route planning only until final USPS counts are attached.`;
  }

  if (
    normalized.includes("review") ||
    normalized.includes("missing") ||
    normalized.includes("approve")
  ) {
    return "Before proposal, checkout, outreach, or production, HomeReach still needs human approval, verified campaign contact, final geography, USPS/carrier-route counts, print/postage math, disclaimer review, and source timestamps.";
  }

  if (
    normalized.includes("next") ||
    normalized.includes("do") ||
    normalized.includes("start")
  ) {
    return `Next best action: pick the campaign option to review, validate the geography assumptions, then request human review before creating a proposal for ${displayName}.`;
  }

  return `${displayName} is loaded. I can explain the mail options, route/geography logic, budget assumptions, postcard creative lanes, and approval gates before anything becomes client-facing.`;
}

export function PoliticalFloatingAgentButton() {
  return (
    <PoliticalAgentChatLauncher variant="floating" />
  );
}
