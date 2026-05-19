"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import {
  AMY_ACTON_CAMPAIGN_PROFILE,
  AMY_ACTON_CAMPAIGN_RECOMMENDATIONS,
  summarizeAmyActonRecommendations,
  type CandidateCampaignRecommendation,
} from "@/lib/political/candidate-agent-recommendations";

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

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US");

const QUICK_PROMPTS = [
  "Show the 4 Acton campaign paths",
  "Explain cost per voter",
  "Which cities are included?",
  "What are the compliance limits?",
] as const;

function moneyFromCents(cents: number) {
  return MONEY.format(cents / 100);
}

function number(value: number) {
  return INTEGER.format(value);
}

export function PoliticalCandidateAgentChat() {
  const summary = useMemo(() => summarizeAmyActonRecommendations(), []);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("ready");
  const [statusMessage, setStatusMessage] = useState("Ready for a real chat about the selected campaign profile.");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "agent-initial",
      role: "agent",
      text: "Dr. Amy Acton is loaded as the selected candidate profile. Type a question and I will answer from the campaign context, route-safe geography, pricing model, readiness gates, and compliance rules.",
    },
  ]);

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
    setStatusMessage("Reading the selected campaign context and preparing a reply...");
    setMessages(outgoingMessages);
    setInput("");

    try {
      const response = await fetch("/api/political/candidate-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: "amy-acton",
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
          ? "Reply generated from the selected campaign context. Human approval is still required for proposal, outreach, or production."
          : "Live AI was unavailable, so I answered from the loaded campaign context and readiness rules.",
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
      <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-300/20 bg-blue-500/15 text-blue-100">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                AI Campaign Launch Agent
              </p>
              <h2 className="text-xl font-black text-white">{AMY_ACTON_CAMPAIGN_PROFILE.candidateName}</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AgentMetric icon={FileText} label="Office" value={AMY_ACTON_CAMPAIGN_PROFILE.office} />
            <AgentMetric icon={MapPinned} label="Geography" value={AMY_ACTON_CAMPAIGN_PROFILE.state} />
            <AgentMetric icon={Mail} label="Campaigns" value={`${summary.plans} recommended paths`} />
            <AgentMetric icon={Users} label="Mode" value="Aggregate reach only" />
          </div>

          <div className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-50">
              <ShieldCheck className="h-4 w-4" />
              Compliance lock
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              {AMY_ACTON_CAMPAIGN_PROFILE.complianceMode}
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
              Candidate-specific signal
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {AMY_ACTON_CAMPAIGN_PROFILE.publicCampaignFrame}
            </p>
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
                placeholder="Type a question, for example: Which strategy should we present first, and why?"
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
                If campaign details, route data, or pricing are incomplete, the agent will keep checkout and proposal actions in review mode until a HomeReach operator verifies them.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                4 recommended campaign paths
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">Acton for Governor mail planner</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Each option is modeled per drop and repeated by phase. Estimated voter reach is aggregate reach, not an individual voter list or prediction model.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Combined modeled reach
              </div>
              <div className="mt-1 text-lg font-black text-white">{number(summary.estimatedVoterReach)}</div>
              <div className="text-xs text-slate-400">aggregate voter reach</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.map((plan) => (
              <RecommendationCard key={plan.id} plan={plan} />
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Sources loaded</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {AMY_ACTON_CAMPAIGN_PROFILE.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/30 hover:text-white"
                >
                  {source.label}
                </a>
              ))}
            </div>
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
      <div className="mt-2 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function RecommendationCard({ plan }: { plan: CandidateCampaignRecommendation }) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">{plan.planType}</div>
          <h4 className="mt-1 text-lg font-black text-white">{plan.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">{plan.summary}</p>
        </div>
        <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
          {plan.confidenceScore}% confidence
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PlanMetric icon={Users} label="Households" value={number(plan.households)} />
        <PlanMetric icon={CheckCircle2} label="Voter reach" value={number(plan.estimatedVoterReach)} />
        <PlanMetric icon={Mail} label="Drops" value={`${plan.drops}`} />
        <PlanMetric icon={DollarSign} label="Postcard" value={moneyFromCents(plan.pricePerPostcardCents)} />
        <PlanMetric icon={DollarSign} label="Cost / voter" value={moneyFromCents(plan.costPerVoterCents)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Cities and geography</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.cities.map((city) => (
              <span key={city} className="rounded-md border border-blue-300/15 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-50">
                {city}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{plan.geographyRationale}</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Budget</div>
          <div className="mt-2 text-2xl font-black text-white">{moneyFromCents(plan.estimatedTotalCents)}</div>
          <div className="mt-1 text-xs text-slate-400">
            {number(plan.totalPieces)} total postcards across {plan.drops} drops
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{plan.candidateFit}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Drop cadence</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {plan.phaseCadence.map((phase) => (
            <div key={phase} className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold leading-5 text-slate-300">
              {phase}
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs font-bold text-amber-100">{plan.nextAction}</div>
      </div>
    </article>
  );
}

function PlanMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
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
