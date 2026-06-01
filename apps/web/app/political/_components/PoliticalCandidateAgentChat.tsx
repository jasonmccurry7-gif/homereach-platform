"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  buildCustomStrategySelectionCandidate,
  buildStrategySelectionPlans,
  findStrategySelectionCandidate,
  type StrategySelectionCandidate,
} from "@/lib/political/campaign-strategy-selection";
import {
  getCandidateCampaignAgent,
  getDefaultCandidateId,
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  REVIEW_ACTIONS,
  summarizeCandidateAgent,
  type CandidateCampaignAgent,
  type CandidateCampaignPhase,
  type CandidatePortraitAsset,
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

type PlanPromptContext = {
  optionLabel?: string;
  title?: string;
  candidateName?: string;
  geography?: string;
  estimatedVoterReach?: number;
  drops?: number;
  uspsRoutesIncluded?: number;
  totalCampaignCostCents?: number;
  householdsLabel?: string;
  totalCostLabel?: string;
  productionStatus?: string;
};

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

function buildAgentReply(
  agent: CandidateCampaignAgent,
  prompt: string,
  planContext?: PlanPromptContext | null,
): string {
  const normalized = prompt.toLowerCase();
  const profile = agent.profile;
  const primaryStrategy = agent.strategies[0]!;

  if (planContext?.optionLabel && planContext.title) {
    return `Option ${planContext.optionLabel}, ${planContext.title}, is loaded for ${planContext.candidateName ?? profile.candidateName}. The planning model shows ${number(planContext.estimatedVoterReach ?? 0)} total reach across ${planContext.drops ?? "-"} drops, ${number(planContext.uspsRoutesIncluded ?? 0)} modeled USPS routes, ${planContext.householdsLabel ?? "household count pending"} households, and ${planContext.totalCostLabel ?? moneyFromCents(planContext.totalCampaignCostCents ?? 0, true)} estimated cost. Before proposal, outreach, checkout, or production, verify public sources, campaign manager contact, final geography, USPS counts, disclaimer needs, pricing, and human approval.`;
  }

  if (
    normalized.includes("route") ||
    normalized.includes("map") ||
    normalized.includes("geograph")
  ) {
    return `${profile.shortName}'s strongest aggregate route-planning layer starts with ${profile.topCounties
      .slice(0, 4)
      .join(
        ", ",
      )} and ${profile.routeClusters.slice(0, 2).join(", ")}. These are planning recommendations only until USPS EDDM or carrier-route counts are imported and timestamped.`;
  }

  if (
    normalized.includes("postcard") ||
    normalized.includes("creative") ||
    normalized.includes("concept")
  ) {
    return `The flipbook has complete front/back concepts for every phase and four creative categories: Emotional/Human, Policy/Issue Focused, Testimonial/Social Proof, and Contrast/Urgency. Current phase starts with "${primaryStrategy.phases[0]?.postcardConcepts[0]?.headline ?? "a complete concept"}".`;
  }

  if (
    normalized.includes("checkout") ||
    normalized.includes("missing") ||
    normalized.includes("quote")
  ) {
    return "Checkout stays locked until campaign contact, final geography, USPS route counts, print/postage math, source timestamps, disclaimer review, and human approval are complete. This is intentional so demo/sample planning data cannot become a production quote.";
  }

  if (normalized.includes("strategy") || normalized.includes("recommend")) {
    return `${profile.candidateName} has ${agent.strategies.length} strategy paths. The first is ${primaryStrategy.title}, modeled at ${number(primaryStrategy.households)} households per major wave, ${primaryStrategy.drops} drops, and ${moneyFromCents(primaryStrategy.pricePerPostcardCents)} per postcard.`;
  }

  if (
    normalized.includes("source") ||
    normalized.includes("compliance") ||
    normalized.includes("guardrail")
  ) {
    return `The ${profile.shortName} agent uses public sources, aggregate geographies, route logistics, and HomeReach pricing only. It does not infer individual political beliefs, score voters, or create sensitive-demographic targeting.`;
  }

  return `${profile.candidateName} is loaded. I can walk through strategy, route/geography planning, budget assumptions, postcard concepts, review actions, and the readiness gates before proposal or checkout.`;
}

function buildWorkspaceReply(
  workspaceName: string,
  plans: ReturnType<typeof buildStrategySelectionPlans>,
  prompt: string,
): string {
  const normalized = prompt.toLowerCase();
  const primaryPlan = plans[0];
  const optionMatch = normalized.match(/\boption\s+([a-d])\b/);
  const requestedPlan = optionMatch
    ? plans.find((plan) => plan.optionLabel.toLowerCase() === optionMatch[1])
    : undefined;

  if (!primaryPlan) {
    return `${workspaceName} is loaded as a review-required planning workspace. Add verified public sources, office, geography, filing status, and contact information before any proposal or outreach.`;
  }

  const widestPlan = plans.reduce(
    (best, plan) =>
      plan.estimatedVoterReach > best.estimatedVoterReach ? plan : best,
    primaryPlan,
  );

  if (requestedPlan) {
    return `Option ${requestedPlan.optionLabel}, ${requestedPlan.title}, is modeled for ${workspaceName} at ${number(requestedPlan.estimatedVoterReach)} total voter reach across ${requestedPlan.drops} drops, ${number(requestedPlan.uspsRoutesIncluded)} planning USPS routes, and ${moneyFromCents(requestedPlan.totalCampaignCostCents, true)} estimated campaign cost. Before proposal, outreach, checkout, or production, verify public sources, campaign manager contact, final geography, USPS counts, disclaimer needs, pricing, and human approval.`;
  }

  if (
    normalized.includes("route") ||
    normalized.includes("map") ||
    normalized.includes("geograph")
  ) {
    return `${workspaceName}'s workspace is using aggregate geography planning only. Start with ${primaryPlan.countiesIncluded
      .slice(0, 4)
      .join(", ")} and verify USPS/vendor counts before quote, proposal, or production. No individual voter belief inference is used.`;
  }

  if (normalized.includes("option") || normalized.includes("strategy")) {
    return `${workspaceName} has four planning options ready. The widest option is ${widestPlan.title}, modeled at ${number(widestPlan.estimatedVoterReach)} total voter reach across ${widestPlan.drops} drops. Treat this as an intake draft until public sources and counts are verified.`;
  }

  if (
    normalized.includes("review") ||
    normalized.includes("missing") ||
    normalized.includes("approve")
  ) {
    return "Before client-facing use, verify public candidate history, current race status, campaign contact, platform claims, geography, USPS counts, pricing, disclaimer requirements, and human approval. The workspace can prepare the plan, but it cannot publish, submit, or send political outreach by itself.";
  }

  return `${workspaceName} is loaded as a safe campaign-planning workspace. I can explain the four options, aggregate geography, mail cadence, likely review items, and what needs verification before a consultation or proposal.`;
}

function normalizeCampaignLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function findCandidateInOptions(
  value: string,
  candidates: StrategySelectionCandidate[],
) {
  const normalized = normalizeCampaignLookup(value);
  return candidates.find(
    (candidate) =>
      normalizeCampaignLookup(candidate.id) === normalized ||
      normalizeCampaignLookup(candidate.candidateName) === normalized,
  );
}

function campaignShortName(name: string) {
  return (
    name
      .replace(/^Dr\.\s+/i, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] ?? "campaign"
  );
}

function campaignGeographySummary(
  candidate: StrategySelectionCandidate,
  plans: ReturnType<typeof buildStrategySelectionPlans>,
) {
  const primaryPlan = plans[0];
  const geography =
    candidate.raceType === "Statewide" ||
    candidate.district.toLowerCase().includes("statewide")
      ? `${candidate.geography} statewide`
      : candidate.district && candidate.district !== "Ohio campaign geography"
        ? candidate.district
        : candidate.geography || candidate.county;

  if (!primaryPlan) {
    return {
      label: geography,
      detail:
        "Public source verification, geography, and route counts are required before a quote, proposal, checkout, or production handoff.",
    };
  }

  return {
    label: geography,
    detail: `${primaryPlan.countiesIncluded
      .slice(0, 4)
      .join(", ")} with ${number(primaryPlan.uspsRoutesIncluded)} modeled USPS routes. Counts remain planning estimates until verified.`,
  };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
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
  candidateOptions?: StrategySelectionCandidate[];
  mode?: "full" | "compact";
}

export function PoliticalCandidateAgentChat({
  initialCandidateId = getDefaultCandidateId(),
  candidateOptions = [],
  mode = "full",
}: PoliticalCandidateAgentChatProps = {}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [candidateId, setCandidateId] =
    useState<CandidateTargetId>(initialCandidateId);
  const agent = useMemo(
    () => getCandidateCampaignAgent(candidateId),
    [candidateId],
  );
  const summary = useMemo(
    () => summarizeCandidateAgent(candidateId),
    [candidateId],
  );
  const requestedCandidateParam = searchParams?.get("candidate");
  const requestedWorkspace = useMemo(
    () =>
      requestedCandidateParam
        ? findCandidateInOptions(requestedCandidateParam, candidateOptions) ??
          findStrategySelectionCandidate(requestedCandidateParam) ??
          buildCustomStrategySelectionCandidate(requestedCandidateParam)
        : null,
    [candidateOptions, requestedCandidateParam],
  );
  const requestHasDedicatedAgent = requestedCandidateParam
    ? isCandidateTargetId(requestedCandidateParam)
    : true;
  const chatScopeName = requestHasDedicatedAgent
    ? agent.profile.candidateName
    : requestedWorkspace?.candidateName ?? agent.profile.candidateName;
  const activeGeo = agent.geographicRecommendations[0];
  const workspacePlans = useMemo(
    () => (requestedWorkspace ? buildStrategySelectionPlans(requestedWorkspace) : []),
    [requestedWorkspace],
  );
  const compactPlanCount = requestHasDedicatedAgent
    ? summary.plans
    : workspacePlans.length;
  const compactReach = requestHasDedicatedAgent
    ? summary.estimatedReach
    : Math.max(
        ...workspacePlans.map((plan) => plan.estimatedVoterReach),
        0,
      );
  const compactInvestmentCents = requestHasDedicatedAgent
    ? summary.investmentCents
    : workspacePlans[0]?.totalCampaignCostCents ?? 0;
  const compactIdentity = useMemo(() => {
    if (!requestHasDedicatedAgent && requestedWorkspace) {
      return {
        name: requestedWorkspace.candidateName,
        shortName: campaignShortName(requestedWorkspace.candidateName),
        subtitle: `${requestedWorkspace.office} / ${requestedWorkspace.party}`,
        portrait: requestedWorkspace.portrait,
        colorClass: "from-blue-700 to-red-700",
        complianceMode:
          "Review-required planning workspace. Use aggregate geography, route logistics, timing, budget, and approval gates only. No individual voter scoring or ideology inference.",
      };
    }

    return {
      name: agent.profile.candidateName,
      shortName: agent.profile.shortName,
      subtitle: agent.profile.office,
      portrait: agent.profile.portrait,
      colorClass: agent.profile.colorClass,
      complianceMode: agent.profile.complianceMode,
    };
  }, [agent, requestHasDedicatedAgent, requestedWorkspace]);
  const compactGeoNotice = useMemo(() => {
    if (!requestHasDedicatedAgent && requestedWorkspace) {
      const summary = campaignGeographySummary(requestedWorkspace, workspacePlans);
      return {
        label: summary.label,
        status: "planning estimate",
        detail: summary.detail,
      };
    }

    return activeGeo
      ? {
          label: activeGeo.label,
          status: activeGeo.dataStatus.replaceAll("_", " "),
          detail:
            "USPS or licensed counts must replace estimates before quote, checkout, or production.",
        }
      : null;
  }, [activeGeo, requestHasDedicatedAgent, requestedWorkspace, workspacePlans]);
  const activeScopeKey = requestHasDedicatedAgent
    ? candidateId
    : requestedWorkspace?.id ?? "review-workspace";
  const initialChatText = useMemo(
    () =>
      requestHasDedicatedAgent
        ? `${compactIdentity.name} campaign agent is loaded. Ask about strategy, aggregate route/geography planning, budget assumptions, postcard concepts, review actions, or approval gates.`
        : `${compactIdentity.name} planning workspace is loaded. I can answer in real time from the selected candidate plan, but public sources, contacts, USPS counts, pricing, disclaimer, and human approval must be verified before external use.`,
    [compactIdentity.name, requestHasDedicatedAgent],
  );
  const [strategyId, setStrategyId] = useState(
    agent.strategies[0]?.id ?? "statewide-foundation",
  );
  const strategy = useMemo(
    () =>
      agent.strategies.find((item) => item.id === strategyId) ??
      agent.strategies[0]!,
    [agent, strategyId],
  );
  const [phaseKey, setPhaseKey] = useState(
    strategy.phases[0]?.phaseKey ?? "introduction",
  );
  const phase = useMemo(
    () =>
      strategy.phases.find((item) => item.phaseKey === phaseKey) ??
      strategy.phases[0]!,
    [strategy, phaseKey],
  );
  const [category, setCategory] = useState<CreativeCategory>("Emotional/Human");
  const concept = useMemo(
    () =>
      phase.postcardConcepts.find((item) => item.category === category) ??
      phase.postcardConcepts[0]!,
    [phase, category],
  );
  const [cardSide, setCardSide] = useState<CardSide>("front");
  const [input, setInput] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("ready");
  const [statusMessage, setStatusMessage] = useState(
    "Ready. Select a target, strategy, phase, or postcard concept.",
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: `agent-initial-${activeScopeKey}`,
      role: "agent",
      text: initialChatText,
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

  const syncCandidateUrl = useCallback((nextCandidateId: CandidateTargetId) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("candidate", nextCandidateId);
    const targetPath = pathname === "/political" ? "/political" : "/political/candidate-agent";
    router.replace(`${targetPath}?${params.toString()}`, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const resetSelection = useCallback((nextCandidateId: CandidateTargetId, syncUrl = true) => {
    const nextAgent = getCandidateCampaignAgent(nextCandidateId);
    const nextStrategy = nextAgent.strategies[0]!;
    setCandidateId(nextCandidateId);
    setStrategyId(nextStrategy.id);
    setPhaseKey(nextStrategy.phases[0]?.phaseKey ?? "introduction");
    setCategory("Emotional/Human");
    setCardSide("front");
    setStatusMessage(`${nextAgent.profile.candidateName} agent loaded.`);
    if (syncUrl) syncCandidateUrl(nextCandidateId);
  }, [syncCandidateUrl]);

  useEffect(() => {
    const candidateParam = searchParams?.get("candidate") ?? null;
    if (!isCandidateTargetId(candidateParam)) {
      if (candidateParam) {
        const workspace =
          findCandidateInOptions(candidateParam, candidateOptions) ??
          findStrategySelectionCandidate(candidateParam) ??
          buildCustomStrategySelectionCandidate(candidateParam);
        setStatusMessage(
          `${workspace.candidateName} planning workspace loaded. Public source verification and human approval are required before client-facing use.`,
        );
      }
      return;
    }
    if (candidateParam === candidateId) return;
    resetSelection(candidateParam, false);
  }, [candidateId, candidateOptions, resetSelection, searchParams]);

  useEffect(() => {
    setMessages([
      {
        id: `agent-initial-${activeScopeKey}`,
        role: "agent",
        text: initialChatText,
      },
    ]);
    setInput("");
    setAgentStatus("ready");
    setStatusMessage(
      `${chatScopeName} loaded. Ask a planning question or use a quick prompt.`,
    );
  }, [activeScopeKey, chatScopeName, initialChatText]);

  const sendCampaignMessage = useCallback((value = input, planContext?: PlanPromptContext | null) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const timestamp = `${Date.now()}`;
    setAgentStatus("thinking");
    setStatusMessage("Reviewing aggregate campaign planning context...");
    setMessages((current) => [
      ...current,
      { id: `user-${timestamp}`, role: "user", text: trimmed },
    ]);
    setInput("");

    try {
      const reply =
        !requestHasDedicatedAgent && requestedWorkspace
          ? buildWorkspaceReply(
              requestedWorkspace.candidateName,
              workspacePlans,
              trimmed,
            )
          : buildAgentReply(agent, trimmed, planContext);
      setMessages((current) => [
        ...current,
        { id: `agent-${timestamp}`, role: "agent", text: reply },
      ]);
      setAgentStatus("ready");
      setStatusMessage(
        `Answered for ${chatScopeName}. Human approval is required before proposal, checkout, outreach, or production handoff.`,
      );
    } catch {
      setAgentStatus("error");
      setStatusMessage(
        "The agent could not complete that answer. Use the readiness checklist or request human support.",
      );
    }
  }, [
    agent,
    chatScopeName,
    input,
    requestHasDedicatedAgent,
    requestedWorkspace,
    workspacePlans,
  ]);

  useEffect(() => {
    function handlePlanPrompt(event: Event) {
      const detail = (event as CustomEvent<{
        prompt?: string;
        planContext?: PlanPromptContext | null;
      }>).detail;
      const prompt = detail?.prompt;
      if (!prompt) return;
      sendCampaignMessage(prompt, detail?.planContext ?? null);
    }

    window.addEventListener("political-campaign-ai-prompt", handlePlanPrompt);
    return () => {
      window.removeEventListener("political-campaign-ai-prompt", handlePlanPrompt);
    };
  }, [sendCampaignMessage]);

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
        setSelectedIds((current) =>
          current.includes(concept.id) ? current : [...current, concept.id],
        );
        setActionMessage(action);
        return;
      case "Compare Designs":
        setCompareMode((current) => !current);
        setActionMessage(action);
        return;
      case "Save Draft":
        setDraftIds((current) =>
          current.includes(concept.id) ? current : [...current, concept.id],
        );
        setActionMessage(action);
        return;
      case "Mark for Approval":
        setApprovedIds((current) =>
          current.includes(concept.id) ? current : [...current, concept.id],
        );
        setStatusMessage(
          `${concept.title} marked for human approval review. This does not approve production, outreach, or checkout.`,
        );
        return;
      case "Duplicate Design": {
        const note = `Duplicated for internal review at ${new Date().toLocaleTimeString()}.`;
        setRevisionLog((current) => ({
          ...current,
          [concept.id]: [...(current[concept.id] ?? []), note],
        }));
        setActionMessage(action);
        return;
      }
      case "Request AI Revision":
      case "Generate Variants": {
        const note = comment.trim()
          ? `Revision request: ${comment.trim()}`
          : `${action} requested. Preserve facts, compliance, branding, and selected geography.`;
        setRevisionLog((current) => ({
          ...current,
          [concept.id]: [...(current[concept.id] ?? []), note],
        }));
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
        setComments((current) => ({
          ...current,
          [concept.id]: [...(current[concept.id] ?? []), note],
        }));
        setComment("");
        setActionMessage(action);
        return;
      }
      case "Export Proposal":
        downloadJson(`${agent.profile.id}-proposal-export.json`, {
          profile: agent.profile,
          strategy,
          selectedConceptIds: selectedIds,
          reviewReadyConceptIds: approvedIds,
          approvalGate:
            "Human approval is still required before client use, political outreach, checkout, or production.",
          compliance: agent.profile.complianceMode,
        });
        setActionMessage(action);
        return;
      case "Export Creative Brief":
        downloadJson(`${concept.id}-creative-brief.json`, {
          concept,
          comments: comments[concept.id] ?? [],
          revisions: revisionLog[concept.id] ?? [],
        });
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

  if (mode === "compact") {
    return (
      <section
        id="campaign-ai-chat"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-blue-300/15 bg-slate-950 shadow-2xl shadow-blue-950/20"
      >
        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-3">
              <CampaignAvatar
                name={compactIdentity.name}
                portrait={compactIdentity.portrait}
                colorClass={compactIdentity.colorClass}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-black text-blue-200">
                  Campaign AI Chat
                </p>
                <p className="mt-1 truncate text-xl font-black text-white">
                  Ask about {chatScopeName}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {compactIdentity.subtitle}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniStat label="Options" value={`${compactPlanCount}`} />
              <MiniStat label="Reach" value={number(compactReach)} />
              <MiniStat
                label="Budget"
                value={moneyFromCents(compactInvestmentCents, true)}
              />
              <MiniStat label="Status" value="Review first" />
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-100">
                <ShieldCheck className="h-4 w-4" />
                Safe answer boundary
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Aggregate geography, route logistics, timing, budget, and
                review gates only. No individual voter scoring or ideology
                inference.
              </p>
            </div>

            {compactGeoNotice ? (
              <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-black text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Geography readiness
                </div>
                <p className="mt-2 text-xs leading-5 text-amber-50/85">
                  {compactGeoNotice.label} is marked {compactGeoNotice.status}.
                  {" "}
                  {compactGeoNotice.detail}
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              {compactIdentity.complianceMode}
            </p>
          </aside>

          <div className="flex min-h-[430px] min-w-0 flex-col p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="break-words text-xl font-black text-white sm:text-2xl">
                  Ask a campaign planning question
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  The answer appears here immediately and stays inside the
                  same review-safe planning boundary.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill
                  icon={ShieldCheck}
                  label="Human approval required"
                  tone="emerald"
                />
                <StatusPill
                  icon={AlertTriangle}
                  label="Planning estimates"
                  tone="amber"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/80 p-3">
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

            <p className="mt-3 rounded-lg border border-blue-300/15 bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-50/85" aria-live="polite">
              {agentStatus === "thinking" ? "Thinking..." : statusMessage}
            </p>

            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendCampaignMessage(prompt)}
                  disabled={agentStatus === "thinking"}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/30 hover:bg-blue-500/15 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                sendCampaignMessage();
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={`Ask the ${compactIdentity.shortName} campaign agent...`}
                className="min-w-0 rounded-lg border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-300 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send message to campaign AI agent"
                disabled={agentStatus === "thinking"}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {agentStatus === "thinking" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    );
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
                <h2 className="text-2xl font-black text-white">
                  {agent.profile.candidateName}
                </h2>
              </div>
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Dedicated campaign intelligence, aggregate geography planning,
              complete postcard concepts, and review/export workflows for each
              target. Planning data remains estimated until source timestamps
              and USPS counts are verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill
              icon={ShieldCheck}
              label="No individual voter scoring"
              tone="emerald"
            />
            <StatusPill
              icon={AlertTriangle}
              label="USPS counts required before checkout"
              tone="amber"
            />
            <StatusPill
              icon={CheckCircle2}
              label={`${MULTI_CANDIDATE_CAMPAIGN_AGENTS.length} agents loaded`}
              tone="blue"
            />
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
                  <div className="flex min-w-0 items-start gap-3">
                    <AgentPortrait agent={candidateAgent} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">
                        {candidateAgent.profile.candidateName}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {candidateAgent.profile.office}
                      </div>
                    </div>
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
          <CandidateProfilePanel
            agent={agent}
            summary={summary}
            status={agentStatus}
            statusMessage={statusMessage}
          />

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
                  onClick={() => sendCampaignMessage(prompt)}
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
                sendCampaignMessage();
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
                {agentStatus === "thinking" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
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
              setStatusMessage(
                `${nextPhase.phaseKey.replaceAll("-", " ")} phase selected.`,
              );
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
                current.includes(concept.id)
                  ? current.filter((id) => id !== concept.id)
                  : [...current, concept.id],
              );
              setStatusMessage(
                favoriteIds.includes(concept.id)
                  ? "Removed from favorites."
                  : "Added to favorites.",
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}

function isCandidateTargetId(value: string | null): value is CandidateTargetId {
  if (!value) return false;
  return MULTI_CANDIDATE_CAMPAIGN_AGENTS.some(
    (agent) => agent.profile.id === value,
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
      <div
        className={`rounded-lg bg-gradient-to-br ${agent.profile.colorClass} p-4`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <AgentPortrait agent={agent} size="lg" />
            <div className="min-w-0">
              <p
                className={`text-[10px] font-black uppercase tracking-[0.18em] ${agent.profile.accentClass}`}
              >
                Dedicated Agent
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                {agent.profile.candidateName}
              </h3>
              <p className="mt-1 text-sm text-slate-200">
                {agent.profile.office}
              </p>
              {agent.profile.portrait ? (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                  Portrait: {agent.profile.portrait.sourceLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
              Election
            </div>
            <div className="text-sm font-black text-white">
              {agent.profile.electionDate}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-100">
          {agent.profile.publicCampaignFrame}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AgentMetric
          icon={FileText}
          label="Strategies"
          value={`${summary.plans}`}
        />
        <AgentMetric
          icon={Users}
          label="Modeled Reach"
          value={number(summary.estimatedReach)}
        />
        <AgentMetric
          icon={Mail}
          label="Investment"
          value={moneyFromCents(summary.investmentCents, true)}
        />
        <AgentMetric
          icon={MapPinned}
          label="Geographies"
          value={`${agent.geographicRecommendations.length} clusters`}
        />
      </div>

      <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-black text-emerald-50">
          <ShieldCheck className="h-4 w-4" />
          Compliance lock
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-50/80">
          {agent.profile.complianceMode}
        </p>
      </div>

      <div className="rounded-lg border border-blue-300/20 bg-blue-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-black text-blue-50">
          {status === "thinking" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
          Agent status:{" "}
          {status === "thinking"
            ? "Thinking"
            : status === "error"
              ? "Needs fallback"
              : "Online"}
        </div>
        <p className="mt-2 text-sm leading-6 text-blue-50/80">
          {statusMessage}
        </p>
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

function CampaignAvatar({
  name,
  portrait,
  colorClass,
  size,
}: {
  name: string;
  portrait?: CandidatePortraitAsset;
  colorClass: string;
  size: "sm" | "lg";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const shouldShowPortrait = Boolean(portrait && !imageFailed);
  const initials = name
    .replace(/^Dr\.\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const sizeClass =
    size === "lg" ? "h-24 w-24 rounded-2xl" : "h-10 w-10 rounded-xl";

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden border border-white/20 bg-slate-950 shadow-lg shadow-slate-950/30`}
      title={
        portrait
          ? `${portrait.sourceLabel}: review before production use`
          : `${name} portrait pending`
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
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colorClass} text-sm font-black text-white`}>
          {initials || "HR"}
        </div>
      )}
    </div>
  );
}

function AgentPortrait({
  agent,
  size,
}: {
  agent: CandidateCampaignAgent;
  size: "sm" | "lg";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const portrait = agent.profile.portrait;
  const shouldShowPortrait = Boolean(portrait && !imageFailed);
  const initials = agent.profile.candidateName
    .replace(/^Dr\.\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const sizeClass =
    size === "lg" ? "h-24 w-24 rounded-2xl" : "h-10 w-10 rounded-xl";

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden border border-white/20 bg-slate-950 shadow-lg shadow-slate-950/30`}
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
          <h3 className="mt-1 text-2xl font-black text-white">
            4 campaign paths for {agent.profile.shortName}
          </h3>
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
                active
                  ? "border-blue-300/60 bg-blue-500/20"
                  : "border-white/10 bg-slate-950/70 hover:border-blue-300/30"
              }`}
            >
              <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">
                {strategy.campaignTheme}
              </div>
              <h4 className="mt-2 text-base font-black text-white">
                {strategy.title}
              </h4>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-300">
                {strategy.strategyOverview}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <MiniStat label="Drops" value={`${strategy.drops}`} />
                <MiniStat label="Pieces" value={number(strategy.totalPieces)} />
                <MiniStat
                  label="Postcard"
                  value={moneyFromCents(strategy.pricePerPostcardCents)}
                />
                <MiniStat
                  label="Budget"
                  value={moneyFromCents(strategy.estimatedTotalCents, true)}
                />
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
          <h3 className="mt-1 text-xl font-black text-white">
            Aggregate mail opportunities by geography
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            These are candidate-specific planning clusters based on public
            geography, historic aggregate election context, route-density logic,
            and campaign fit. USPS counts must replace estimates before quote or
            checkout.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agent.geographicRecommendations.slice(0, 9).map((geo) => (
          <article
            key={`${geo.type}-${geo.label}`}
            className="rounded-lg border border-white/10 bg-slate-950 p-3"
          >
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
            <p className="mt-3 text-xs leading-5 text-slate-300">
              {geo.rationale}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat
                label="Volume"
                value={number(geo.estimatedMailVolume)}
              />
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
                active
                  ? "border-red-300/50 bg-red-500/20"
                  : "border-white/10 bg-slate-950/70 hover:bg-white/10"
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Phase {item.phaseNumber}
              </div>
              <div className="mt-1 text-sm font-black capitalize text-white">
                {item.phaseKey.replaceAll("-", " ")}
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-300">
                {item.timing}
              </div>
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
  const currentIndex = phase.postcardConcepts.findIndex(
    (item) => item.id === concept.id,
  );

  function step(direction: -1 | 1) {
    const nextIndex =
      (currentIndex + direction + phase.postcardConcepts.length) %
      phase.postcardConcepts.length;
    onCategory(
      phase.postcardConcepts[nextIndex]?.category ?? "Emotional/Human",
    );
  }

  return (
    <section className="rounded-lg border border-blue-300/20 bg-blue-950/20 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
            Complete Postcard Flipbook
          </p>
          <h3 className="mt-1 text-2xl font-black text-white">
            {concept.title}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Every phase includes four complete front/back concepts with editable
            copy, CTA, image, compliance, comment, revision, review, and export
            states.
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
              <Heart
                className={`h-4 w-4 ${favoriteIds.includes(concept.id) ? "fill-red-400 text-red-300" : "text-slate-300"}`}
              />
              Favorite
            </button>
          </div>

          <PostcardPreview
            agent={agent}
            strategy={strategy}
            phase={phase}
            concept={concept}
            side={side}
          />

          {compareMode && (
            <div className="grid gap-3 lg:grid-cols-2">
              {phase.postcardConcepts
                .filter(
                  (item) =>
                    selectedIds.includes(item.id) || item.id === concept.id,
                )
                .slice(0, 2)
                .map((item) => (
                  <PostcardPreview
                    key={item.id}
                    agent={agent}
                    strategy={strategy}
                    phase={phase}
                    concept={item}
                    side="front"
                    compact
                  />
                ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat
                label="Selected"
                value={selectedIds.includes(concept.id) ? "Yes" : "No"}
              />
              <MiniStat
                label="Draft"
                value={draftIds.includes(concept.id) ? "Saved" : "Unsaved"}
              />
              <MiniStat
                label="Review Ready"
                value={approvedIds.includes(concept.id) ? "Yes" : "No"}
              />
              <MiniStat label="Comments" value={`${comments.length}`} />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
            <h4 className="font-black text-white">Creative metadata</h4>
            <div className="mt-3 space-y-3 text-xs leading-5 text-slate-300">
              <p>
                <span className="font-bold text-white">CTA:</span> {concept.cta}
              </p>
              <p>
                <span className="font-bold text-white">Imagery:</span>{" "}
                {concept.suggestedImagery}
              </p>
              <p>
                <span className="font-bold text-white">Geography:</span>{" "}
                {concept.geographicFit}
              </p>
              <p>
                <span className="font-bold text-white">Compliance:</span>{" "}
                {concept.complianceDisclaimer}
              </p>
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
                {[
                  ...comments.map((item) => `Comment: ${item}`),
                  ...revisions.map((item) => `Revision: ${item}`),
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300"
                  >
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
    <div
      className={`rounded-xl border border-white/15 bg-white p-3 text-slate-950 shadow-2xl ${compact ? "" : "min-h-[360px]"}`}
    >
      <div
        className={`grid min-h-[320px] overflow-hidden rounded-lg border border-slate-200 ${isFront ? "grid-cols-[1fr_0.62fr]" : "grid-cols-[1fr_0.48fr]"}`}
      >
        <div
          className={`bg-gradient-to-br ${agent.profile.colorClass} p-6 text-white`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              {concept.category}
            </div>
            <div className="text-right text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
              {phase.phaseKey.replaceAll("-", " ")}
            </div>
          </div>
          <h4
            className={`${compact ? "mt-5 text-2xl" : "mt-8 text-4xl"} font-black leading-tight`}
          >
            {isFront ? concept.headline : concept.subheadline}
          </h4>
          <p
            className={`${compact ? "mt-3 text-sm" : "mt-5 text-base"} leading-7 text-white/88`}
          >
            {isFront ? concept.frontBody : concept.backBody}
          </p>
          <div className="mt-6 rounded-lg border border-white/25 bg-white/10 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
              Visual direction
            </div>
            <p className="mt-1 text-xs leading-5 text-white/85">
              {concept.visualDirection}
            </p>
          </div>
        </div>

        <div className="flex flex-col bg-slate-50 p-5">
          {isFront ? (
            <>
              <div className="flex-1 rounded-lg border-2 border-dashed border-slate-300 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Image zone
                </div>
                {agent.profile.portrait ? (
                  <div className="mt-3 h-32 overflow-hidden rounded-lg bg-slate-100">
                    <img
                      src={agent.profile.portrait.url}
                      alt={agent.profile.portrait.alt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <p className="mt-3 text-sm font-bold leading-6 text-slate-800">
                  {concept.suggestedImagery}
                </p>
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
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Address panel
                </div>
                <div className="mt-8 h-2 w-36 rounded bg-slate-200" />
                <div className="mt-2 h-2 w-44 rounded bg-slate-200" />
                <div className="mt-2 h-2 w-28 rounded bg-slate-200" />
              </div>
              <div className="mt-4 rounded border border-slate-300 bg-white p-3">
                <div className="text-xs font-black text-slate-900">
                  QR / landing page
                </div>
                <div className="mt-2 grid h-16 w-16 grid-cols-3 gap-1 bg-slate-900 p-1">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div
                      key={index}
                      className={index % 2 ? "bg-white" : "bg-slate-900"}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          <p className="mt-4 text-[10px] leading-4 text-slate-500">
            {concept.complianceDisclaimer}
          </p>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
          <div>
            <span className="font-black text-slate-950">Strategy:</span>{" "}
            {strategy.title}
          </div>
          <div>
            <span className="font-black text-slate-950">Geography:</span>{" "}
            {phase.targetGeography}
          </div>
          <div>
            <span className="font-black text-slate-950">Mail:</span>{" "}
            {number(phase.mailQuantity)} pieces
          </div>
        </div>
      )}
    </div>
  );
}

function ActionIcon({ action }: { action: ReviewAction }) {
  if (action.includes("Preview")) return <Eye className="h-3.5 w-3.5" />;
  if (action.includes("Export")) return <Download className="h-3.5 w-3.5" />;
  if (action.includes("Copy") || action.includes("Duplicate"))
    return <Copy className="h-3.5 w-3.5" />;
  if (action.includes("Comment") || action.includes("Revision"))
    return <MessageSquare className="h-3.5 w-3.5" />;
  if (
    action.includes("Approve") ||
    action.includes("Approval") ||
    action.includes("Select")
  )
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (
    action.includes("Edit") ||
    action.includes("Swap") ||
    action.includes("Generate")
  )
    return <PenLine className="h-3.5 w-3.5" />;
  if (action.includes("Client") || action.includes("Admin"))
    return <Send className="h-3.5 w-3.5" />;
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
      <div className="mt-2 truncate text-sm font-bold text-white" title={value}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div
        className="mt-1 line-clamp-2 text-xs font-bold text-white"
        title={value}
      >
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
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function DisclosurePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
