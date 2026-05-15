"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  DollarSign,
  Eye,
  FileText,
  Image,
  Loader2,
  Mail,
  MapPinned,
  MessageSquare,
  PenLine,
  Repeat2,
  Route,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import {
  AMY_ACTON_ADMIN_COMMAND_ITEMS,
  AMY_ACTON_ADVANCED_WORKFLOWS,
  AMY_ACTON_CAMPAIGN_STRATEGIES,
  AMY_ACTON_COMPLIANCE_GUARDRAILS,
  AMY_ACTON_INTELLIGENCE_SIGNALS,
  AMY_ACTON_INTELLIGENCE_SOURCES,
  getActonCommandMetrics,
  getActonEstimatedReach,
  type ActonPhase,
  type ActonPostcardConcept,
  type ActonStrategy,
} from "@/lib/political/amy-acton-command";

type PreviewSide = "front" | "back";
type EditMode = "design" | "copy" | "cta" | null;

interface RevisionEvent {
  id: string;
  conceptId: string;
  type: "comment" | "revision" | "save" | "approval" | "variant" | "duplicate" | "selection";
  text: string;
}

interface ConceptEdit {
  headline?: string;
  subheadline?: string;
  cta?: string;
  visualDirection?: string;
  status?: string;
  variantCount?: number;
}

const DEFAULT_STRATEGY = AMY_ACTON_CAMPAIGN_STRATEGIES[0] as ActonStrategy;
const DEFAULT_PHASE = DEFAULT_STRATEGY.phases[0] as ActonPhase;

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US");

function moneyFromCents(cents: number) {
  return MONEY.format(cents / 100);
}

function number(value: number) {
  return INTEGER.format(value);
}

function buildRevision(concept: ActonPostcardConcept, comment: string): ConceptEdit {
  const lower = comment.toLowerCase();

  if (lower.includes("working") || lower.includes("famil")) {
    return {
      headline: "A governor for Ohio working families.",
      subheadline: "Practical leadership for health care, household costs, and communities that work hard.",
      cta: "See Amy's plan for families",
      visualDirection:
        "Use a warmer kitchen-table image direction with parent, worker, and neighborhood cues kept broad and non-targeted.",
      status: "AI revision drafted from comment: working-family emphasis.",
    };
  }

  if (lower.includes("health") || lower.includes("care") || lower.includes("doctor")) {
    return {
      headline: "A doctor ready to lead Ohio.",
      subheadline: "Amy Acton brings steady public-service experience to health care and family affordability.",
      cta: "Read Amy's health care priorities",
      visualDirection:
        "Use a clean doctor/public-service visual system with Ohio community imagery and source-tagged proof points.",
      status: "AI revision drafted from comment: health care emphasis.",
    };
  }

  if (lower.includes("urgent") || lower.includes("deadline") || lower.includes("vote")) {
    return {
      headline: "Ohio's choice is almost here.",
      subheadline: "Know the dates, compare the records, and make your plan before Election Day.",
      cta: "Check official voting dates",
      visualDirection:
        "Use a high-contrast deadline treatment with a calendar panel, election date, and official source label.",
      status: "AI revision drafted from comment: urgency and election timing.",
    };
  }

  return {
    headline: `${concept.headline} Ready for campaign review.`,
    subheadline: `${concept.subheadline} Revised for clearer tone and cleaner mailbox scanning.`,
    cta: concept.cta,
    visualDirection: `${concept.visualDirection} Tighten copy hierarchy and keep all public claims source-labeled.`,
    status: "AI revision drafted from staff comment.",
  };
}

export function AmyActonCampaignCommandCenter({ compact = false }: { compact?: boolean }) {
  const metrics = useMemo(() => getActonCommandMetrics(), []);
  const [activeStrategyId, setActiveStrategyId] = useState(DEFAULT_STRATEGY.id);
  const activeStrategy = useMemo<ActonStrategy>(
    () =>
      AMY_ACTON_CAMPAIGN_STRATEGIES.find((strategy) => strategy.id === activeStrategyId) ??
      DEFAULT_STRATEGY,
    [activeStrategyId],
  );
  const [activePhaseId, setActivePhaseId] = useState(DEFAULT_PHASE.id);
  const activePhase =
    activeStrategy.phases.find((phase) => phase.id === activePhaseId) ??
    activeStrategy.phases[0] ??
    DEFAULT_PHASE;
  const [selectedConceptId, setSelectedConceptId] = useState(DEFAULT_PHASE.postcardConcepts[0]?.id ?? "");
  const [previewSides, setPreviewSides] = useState<Record<string, PreviewSide>>({});
  const [commentTarget, setCommentTarget] = useState<string>(activePhase.postcardConcepts[0]?.id ?? "");
  const [commentText, setCommentText] = useState("");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editConceptId, setEditConceptId] = useState("");
  const [conceptEdits, setConceptEdits] = useState<Record<string, ConceptEdit>>({});
  const [approvedConcepts, setApprovedConcepts] = useState<Record<string, boolean>>({});
  const [duplicatedConcepts, setDuplicatedConcepts] = useState<Record<string, ActonPostcardConcept[]>>({});
  const [activityLog, setActivityLog] = useState<RevisionEvent[]>([
    {
      id: "initial",
      conceptId: "system",
      type: "revision",
      text: "Acton agent loaded 4 statewide strategies, phase plans, and postcard concept packs in draft mode.",
    },
  ]);
  const [agentState, setAgentState] = useState<"ready" | "working">("ready");
  const [statusMessage, setStatusMessage] = useState(
    "Ready. Creative, proposal, and checkout stay human-review locked until USPS counts and quote data are verified.",
  );

  const concepts = useMemo(() => {
    const extras = duplicatedConcepts[activePhase.id] ?? [];
    return [...activePhase.postcardConcepts, ...extras];
  }, [activePhase.id, activePhase.postcardConcepts, duplicatedConcepts]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];
  const editedSelectedConcept = selectedConcept ? applyConceptEdit(selectedConcept, conceptEdits[selectedConcept.id]) : null;

  function addLog(event: Omit<RevisionEvent, "id">) {
    setActivityLog((current) => [
      { ...event, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` },
      ...current.slice(0, 13),
    ]);
  }

  function selectStrategy(strategyId: string) {
    const nextStrategy = AMY_ACTON_CAMPAIGN_STRATEGIES.find((strategy) => strategy.id === strategyId);
    if (!nextStrategy) return;
    setActiveStrategyId(strategyId);
    setActivePhaseId(nextStrategy.phases[0]?.id ?? "");
    setSelectedConceptId(nextStrategy.phases[0]?.postcardConcepts[0]?.id ?? "");
    setCommentTarget(nextStrategy.phases[0]?.postcardConcepts[0]?.id ?? "");
    setStatusMessage(`${nextStrategy.campaignName} loaded. Review phases, concepts, and readiness gates before proposal.`);
  }

  function selectPhase(phaseId: string) {
    const nextPhase = activeStrategy.phases.find((phase) => phase.id === phaseId);
    if (!nextPhase) return;
    setActivePhaseId(phaseId);
    setSelectedConceptId(nextPhase.postcardConcepts[0]?.id ?? "");
    setCommentTarget(nextPhase.postcardConcepts[0]?.id ?? "");
    setStatusMessage(`${nextPhase.name} phase loaded with ${nextPhase.postcardConcepts.length} required concept options.`);
  }

  function handleAction(action: string, concept: ActonPostcardConcept) {
    if (action === "Preview Front" || action === "Preview Back") {
      const side = action === "Preview Front" ? "front" : "back";
      setPreviewSides((current) => ({ ...current, [concept.id]: side }));
      setSelectedConceptId(concept.id);
      setStatusMessage(`${side === "front" ? "Front" : "Back"} preview opened for ${concept.category}.`);
      return;
    }

    if (action === "Select Design") {
      setSelectedConceptId(concept.id);
      setCommentTarget(concept.id);
      addLog({
        conceptId: concept.id,
        type: "selection",
        text: `${concept.category} selected for the ${activePhase.name} phase.`,
      });
      setStatusMessage("Design selected. Leave a comment or request an AI revision before approval.");
      return;
    }

    if (action === "Edit Design" || action === "Edit Copy" || action === "Edit CTA") {
      setSelectedConceptId(concept.id);
      setEditConceptId(concept.id);
      setEditMode(action === "Edit Design" ? "design" : action === "Edit Copy" ? "copy" : "cta");
      setStatusMessage(`${action} mode opened for ${concept.category}.`);
      return;
    }

    if (action === "Swap Image") {
      setConceptEdits((current) => ({
        ...current,
        [concept.id]: {
          ...current[concept.id],
          visualDirection:
            "Alternate image requested: use a verified Ohio community scene with clean campaign colors and no synthetic impersonation.",
          status: "Image direction swap requested.",
        },
      }));
      addLog({
        conceptId: concept.id,
        type: "revision",
        text: `Image direction swap requested for ${concept.category}.`,
      });
      setStatusMessage("Image direction swapped into review mode.");
      return;
    }

    if (action === "Generate Variants") {
      const currentVariantCount = conceptEdits[concept.id]?.variantCount ?? 0;
      setConceptEdits((current) => ({
        ...current,
        [concept.id]: {
          ...current[concept.id],
          variantCount: currentVariantCount + 3,
          status: "Three AI variants queued for human review.",
        },
      }));
      addLog({
        conceptId: concept.id,
        type: "variant",
        text: `Generated 3 draft variants for ${concept.category}.`,
      });
      setStatusMessage("Three AI variants queued. Human approval is still required.");
      return;
    }

    if (action === "Leave Comment") {
      setSelectedConceptId(concept.id);
      setCommentTarget(concept.id);
      setStatusMessage("Comment target set. Add a note in the staff comment box.");
      return;
    }

    if (action === "Request AI Revision") {
      setAgentState("working");
      setSelectedConceptId(concept.id);
      window.setTimeout(() => {
        const comment = commentTarget === concept.id && commentText.trim() ? commentText.trim() : "Make this clearer and more campaign-ready.";
        const revision = buildRevision(concept, comment);
        setConceptEdits((current) => ({
          ...current,
          [concept.id]: {
            ...current[concept.id],
            ...revision,
          },
        }));
        addLog({
          conceptId: concept.id,
          type: "comment",
          text: `Staff comment: ${comment}`,
        });
        addLog({
          conceptId: concept.id,
          type: "revision",
          text: revision.status ?? "AI revision drafted from staff comment.",
        });
        setCommentText("");
        setAgentState("ready");
        setStatusMessage("AI revision drafted. Review copy, sources, and compliance before approval.");
      }, 420);
      return;
    }

    if (action === "Save Draft") {
      setConceptEdits((current) => ({
        ...current,
        [concept.id]: { ...current[concept.id], status: "Draft saved locally for operator review." },
      }));
      addLog({
        conceptId: concept.id,
        type: "save",
        text: `${concept.category} saved as a draft concept.`,
      });
      setStatusMessage("Draft saved. This does not send a proposal or create checkout.");
      return;
    }

    if (action === "Approve Design") {
      setApprovedConcepts((current) => ({ ...current, [concept.id]: true }));
      addLog({
        conceptId: concept.id,
        type: "approval",
        text: `${concept.category} marked approved for design review. Final campaign approval is still required.`,
      });
      setStatusMessage("Design approved for internal review. Final send still requires human approval and quote lock.");
      return;
    }

    if (action === "Duplicate Design") {
      const duplicate: ActonPostcardConcept = {
        ...applyConceptEdit(concept, conceptEdits[concept.id]),
        id: `${concept.id}-copy-${Date.now()}`,
        headline: `${applyConceptEdit(concept, conceptEdits[concept.id]).headline} (Variant)`,
      };
      setDuplicatedConcepts((current) => ({
        ...current,
        [activePhase.id]: [...(current[activePhase.id] ?? []), duplicate],
      }));
      addLog({
        conceptId: concept.id,
        type: "duplicate",
        text: `${concept.category} duplicated for an alternate creative path.`,
      });
      setSelectedConceptId(duplicate.id);
      setStatusMessage("Design duplicated as a new editable concept variant.");
    }
  }

  function submitManualEdit() {
    if (!editedSelectedConcept || !editConceptId || !editMode) return;
    addLog({
      conceptId: editConceptId,
      type: "revision",
      text: `${editMode === "cta" ? "CTA" : editMode === "copy" ? "Copy" : "Design"} edits saved for ${editedSelectedConcept.category}.`,
    });
    setEditMode(null);
    setStatusMessage("Manual edit saved locally. Human approval and compliance review remain required.");
  }

  if (compact) {
    return (
      <section className="rounded-lg border border-blue-300/20 bg-blue-950/25 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Amy Acton AI Campaign Agent
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">Statewide campaign command layer ready</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Four strategy paths, {metrics.activePhases} mail phases, and {metrics.creativeConcepts} postcard concepts are loaded in draft mode. Checkout stays locked until USPS route counts, pricing, and human approval are verified.
            </p>
          </div>
          <a
            href="/political/candidate-agent"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
          >
            <Bot className="h-4 w-4" />
            Open Acton Agent
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-blue-300/15 bg-slate-950 shadow-2xl shadow-blue-950/20">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(2,6,23,1))] p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">
              Amy Acton for Governor
            </p>
            <h2 className="mt-3 max-w-4xl text-3xl font-black text-white sm:text-4xl">
              AI statewide postcard command center
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">
              A candidate-specific planning layer for statewide mail strategy, phase sequencing, creative review, and production readiness. This workspace is draft-only until source, route, quote, and human-approval gates pass.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusPill icon={Bot} label="Agent online" tone="blue" />
              <StatusPill icon={ShieldCheck} label="Compliance lock active" tone="emerald" />
              <StatusPill icon={AlertTriangle} label="USPS quote not locked" tone="amber" />
              <StatusPill icon={ClipboardCheck} label="Human approval required" tone="red" />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Command metrics
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <CommandMetric icon={FileText} label="Strategies" value={`${metrics.strategies}`} />
              <CommandMetric icon={Timer} label="Phases" value={`${metrics.activePhases}`} />
              <CommandMetric icon={Mail} label="Concepts" value={`${metrics.creativeConcepts}`} />
              <CommandMetric icon={DollarSign} label="Modeled piece" value={moneyFromCents(metrics.averagePricePerPieceCents)} />
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-950 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Estimated draft volume</div>
              <div className="mt-1 text-xl font-black text-white">{number(metrics.totalRecommendedPieces)}</div>
              <div className="text-xs text-slate-400">pieces across all strategy options, not a saved order</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[330px_1fr]">
        <aside className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r">
          <section>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
              Candidate intelligence
            </div>
            <div className="mt-4 space-y-3">
              {AMY_ACTON_INTELLIGENCE_SIGNALS.map((signal) => (
                <div key={signal.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        {signal.label}
                      </div>
                      <div className="mt-1 text-sm font-black text-white">{signal.value}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                        signal.status === "ready"
                          ? "bg-emerald-500/15 text-emerald-100"
                          : signal.status === "review"
                            ? "bg-amber-500/15 text-amber-100"
                            : "bg-red-500/15 text-red-100"
                      }`}
                    >
                      {signal.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{signal.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-emerald-300/20 bg-emerald-950/20 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-50">
              <ShieldCheck className="h-4 w-4" />
              Compliance guardrails
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-emerald-50/80">
              {AMY_ACTON_COMPLIANCE_GUARDRAILS.map((guardrail) => (
                <li key={guardrail} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" />
                  <span>{guardrail}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                Four statewide campaign options
              </p>
              <h3 className="mt-1 text-2xl font-black text-white">{activeStrategy.campaignName}</h3>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{activeStrategy.strategyOverview}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Active strategy
              </div>
              <div className="mt-1 text-sm font-bold text-white">{activeStrategy.theme}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {AMY_ACTON_CAMPAIGN_STRATEGIES.map((strategy) => (
              <button
                key={strategy.id}
                type="button"
                onClick={() => selectStrategy(strategy.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  activeStrategy.id === strategy.id
                    ? "border-blue-300/50 bg-blue-500/15 shadow-lg shadow-blue-950/30"
                    : "border-white/10 bg-white/[0.04] hover:border-blue-300/30 hover:bg-blue-500/10"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
                  {strategy.theme}
                </div>
                <div className="mt-2 text-sm font-black text-white">{strategy.campaignName}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{strategy.phases.length} mail phases</div>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <StrategyDetail title="Message hierarchy" items={activeStrategy.messagingHierarchy} />
                <StrategyDetail title="Issue hierarchy" items={activeStrategy.issueHierarchy} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <SmallInfo label="Audience context" value={activeStrategy.audienceContext} />
                <SmallInfo label="Timing cadence" value={activeStrategy.timingCadence} />
                <SmallInfo label="Rollout strategy" value={activeStrategy.statewideRolloutStrategy} />
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-slate-950 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Geographic plan
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeStrategy.targetGeographies.map((geography) => (
                  <span key={geography} className="rounded-md border border-blue-300/15 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-50">
                    {geography}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                Recommendations are aggregate public-geography planning layers. Final route inventory must come from USPS EDDM/BMEU or licensed carrier-route data before quote or checkout.
              </p>
            </section>
          </div>

          <section className="mt-5 rounded-lg border border-white/10 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                  Phase timeline
                </p>
                <h3 className="mt-1 text-xl font-black text-white">{activePhase.name}</h3>
              </div>
              <div className="text-sm font-bold text-slate-300">
                {number(activePhase.mailQuantity)} pieces / {number(getActonEstimatedReach(activePhase.mailQuantity))} modeled aggregate reach
              </div>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeStrategy.phases.map((phase, index) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => selectPhase(phase.id)}
                  className={`min-w-[220px] rounded-lg border p-3 text-left transition ${
                    activePhase.id === phase.id
                      ? "border-amber-200/50 bg-amber-500/10"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Wave {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-black text-white">{phase.name}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{phase.timingRecommendation}</div>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SmallInfo label="Objective" value={activePhase.objective} />
              <SmallInfo label="Target geography" value={activePhase.targetGeography} />
              <SmallInfo label="Tone" value={activePhase.emotionalTone} />
              <SmallInfo label="Expected outcome" value={activePhase.expectedOutcome} />
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-blue-300/15 bg-blue-950/15 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                  Postcard creative engine
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  {activePhase.name}: minimum 4 concept options
                </h3>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  Every concept supports preview, selection, editing, comments, AI revision, draft save, approval, and duplication. Actions are local draft actions and do not send mail, proposals, or checkout.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Agent status</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-black text-white">
                  {agentState === "working" ? <Loader2 className="h-4 w-4 animate-spin text-blue-200" /> : <Bot className="h-4 w-4 text-blue-200" />}
                  {agentState === "working" ? "Drafting revision" : "Ready for comments"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950 p-3 text-sm leading-6 text-slate-300">
              {statusMessage}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {concepts.map((concept) => (
                <CreativeConceptCard
                  key={concept.id}
                  concept={applyConceptEdit(concept, conceptEdits[concept.id])}
                  selected={selectedConceptId === concept.id}
                  approved={Boolean(approvedConcepts[concept.id])}
                  previewSide={previewSides[concept.id] ?? "front"}
                  variantCount={conceptEdits[concept.id]?.variantCount ?? 0}
                  onAction={(action) => handleAction(action, concept)}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
              <section className="rounded-lg border border-white/10 bg-slate-950 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <MessageSquare className="h-4 w-4 text-blue-200" />
                  Staff comments and AI revisions
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]">
                  <select
                    value={commentTarget}
                    onChange={(event) => {
                      setCommentTarget(event.target.value);
                      setSelectedConceptId(event.target.value);
                    }}
                    className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    {concepts.map((concept) => (
                      <option key={concept.id} value={concept.id}>
                        {concept.category}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder='Example: "Make this more focused on working families."'
                    className="min-h-[92px] rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm leading-6 text-white placeholder:text-slate-500 focus:border-blue-300 focus:outline-none"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const concept = concepts.find((item) => item.id === commentTarget);
                      if (concept) handleAction("Request AI Revision", concept);
                    }}
                    disabled={agentState === "working"}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                  >
                    {agentState === "working" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Request AI Revision
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!commentText.trim()) {
                        setStatusMessage("Add a comment before saving a staff note.");
                        return;
                      }
                      addLog({
                        conceptId: commentTarget,
                        type: "comment",
                        text: `Staff comment: ${commentText.trim()}`,
                      });
                      setCommentText("");
                      setStatusMessage("Comment saved to the local revision log.");
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                  >
                    <Save className="h-4 w-4" />
                    Save Comment
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-slate-950 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-white">
                  <PenLine className="h-4 w-4 text-amber-200" />
                  Manual edit panel
                </div>
                {editedSelectedConcept && editMode ? (
                  <div className="mt-3 space-y-3">
                    {(editMode === "copy" || editMode === "design") && (
                      <>
                        <EditField
                          label="Headline"
                          value={editedSelectedConcept.headline}
                          onChange={(value) =>
                            setConceptEdits((current) => ({
                              ...current,
                              [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], headline: value },
                            }))
                          }
                        />
                        <EditField
                          label="Subheadline"
                          value={editedSelectedConcept.subheadline}
                          onChange={(value) =>
                            setConceptEdits((current) => ({
                              ...current,
                              [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], subheadline: value },
                            }))
                          }
                        />
                      </>
                    )}
                    {editMode === "cta" && (
                      <EditField
                        label="CTA"
                        value={editedSelectedConcept.cta}
                        onChange={(value) =>
                          setConceptEdits((current) => ({
                            ...current,
                            [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], cta: value },
                          }))
                        }
                      />
                    )}
                    {editMode === "design" && (
                      <EditField
                        label="Visual direction"
                        value={editedSelectedConcept.visualDirection}
                        onChange={(value) =>
                          setConceptEdits((current) => ({
                            ...current,
                            [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], visualDirection: value },
                          }))
                        }
                      />
                    )}
                    <button
                      type="button"
                      onClick={submitManualEdit}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500"
                    >
                      <Save className="h-4 w-4" />
                      Save Edits
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Use Edit Design, Edit Copy, or Edit CTA on a postcard concept to open editable fields here.
                  </p>
                )}
              </section>
            </div>
          </section>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                Advanced AI workflows
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {AMY_ACTON_ADVANCED_WORKFLOWS.map((workflow) => (
                  <div key={workflow.label} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{workflow.label}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{workflow.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addLog({
                            conceptId: "workflow",
                            type: "revision",
                            text: `${workflow.label} queued for human-reviewed campaign brief.`,
                          });
                          setStatusMessage(`${workflow.label} queued as a campaign-reviewed workflow.`);
                        }}
                        className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-slate-200 transition hover:bg-white/10"
                      >
                        Queue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-slate-950 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Admin command center
              </div>
              <div className="mt-4 space-y-3">
                {AMY_ACTON_ADMIN_COMMAND_ITEMS.map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black text-white">{item.label}</div>
                      <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase text-amber-100">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-lg border border-white/10 bg-slate-950 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <Bot className="h-4 w-4 text-blue-200" />
              AI activity log
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {activityLog.map((event) => (
                <div key={event.id} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">
                  <span className="font-black uppercase text-blue-200">{event.type}</span>: {event.text}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Sources used
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {AMY_ACTON_INTELLIGENCE_SOURCES.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/30 hover:text-white"
                >
                  {source.label}
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {source.freshness}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function applyConceptEdit(concept: ActonPostcardConcept, edit?: ConceptEdit): ActonPostcardConcept {
  if (!edit) return concept;

  return {
    ...concept,
    headline: edit.headline ?? concept.headline,
    subheadline: edit.subheadline ?? concept.subheadline,
    cta: edit.cta ?? concept.cta,
    visualDirection: edit.visualDirection ?? concept.visualDirection,
  };
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Bot;
  label: string;
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-300/25 bg-blue-500/10 text-blue-50"
      : tone === "emerald"
        ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-50"
        : tone === "amber"
          ? "border-amber-300/25 bg-amber-500/10 text-amber-50"
          : "border-red-300/25 bg-red-500/10 text-red-50";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${toneClass}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function CommandMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function StrategyDetail({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-200" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{value}</div>
    </div>
  );
}

function CreativeConceptCard({
  concept,
  selected,
  approved,
  previewSide,
  variantCount,
  onAction,
}: {
  concept: ActonPostcardConcept;
  selected: boolean;
  approved: boolean;
  previewSide: PreviewSide;
  variantCount: number;
  onAction: (action: string) => void;
}) {
  const buttonLabels = [
    "Preview Front",
    "Preview Back",
    "Select Design",
    "Edit Design",
    "Edit Copy",
    "Edit CTA",
    "Swap Image",
    "Generate Variants",
    "Leave Comment",
    "Request AI Revision",
    "Save Draft",
    "Approve Design",
    "Duplicate Design",
  ];

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        selected ? "border-blue-300/50 bg-blue-500/10" : "border-white/10 bg-slate-950"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
            {concept.category}
          </div>
          <h4 className="mt-2 text-lg font-black text-white">{concept.headline}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">{concept.subheadline}</p>
        </div>
        <div className="flex flex-col gap-2 text-right">
          {approved && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">
              approved
            </span>
          )}
          {variantCount > 0 && (
            <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[10px] font-black uppercase text-blue-100">
              {variantCount} variants
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[240px_1fr]">
        <div className="aspect-[6/4] rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(59,130,246,0.35),rgba(239,68,68,0.18)),radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_35%)] p-4">
          <div className="flex h-full flex-col justify-between rounded-md border border-white/20 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white">
                {previewSide}
              </span>
              {previewSide === "front" ? <Image className="h-4 w-4 text-white" /> : <Mail className="h-4 w-4 text-white" />}
            </div>
            <div>
              <div className="text-base font-black leading-tight text-white">
                {previewSide === "front" ? concept.headline : concept.cta}
              </div>
              <div className="mt-2 text-[11px] leading-4 text-slate-200">
                {previewSide === "front" ? concept.frontPreview : concept.backPreview}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <ConceptLine icon={Eye} label="Visual direction" value={concept.visualDirection} />
          <ConceptLine icon={Users} label="Audience fit" value={concept.audienceFit} />
          <ConceptLine icon={Sparkles} label="Emotional strategy" value={concept.emotionalStrategy} />
          <ConceptLine icon={Send} label="CTA" value={concept.cta} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {buttonLabels.map((label) => (
          <button
            key={`${concept.id}-${label}`}
            type="button"
            onClick={() => onAction(label)}
            className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold transition ${
              label === "Approve Design"
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/20"
                : label === "Request AI Revision"
                  ? "border-blue-300/20 bg-blue-500/10 text-blue-50 hover:bg-blue-500/20"
                  : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10"
            }`}
          >
            {buttonIcon(label)}
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}

function buttonIcon(label: string) {
  if (label.includes("Preview")) return <Eye className="h-3.5 w-3.5" />;
  if (label.includes("Select") || label.includes("Approve")) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (label.includes("Edit")) return <PenLine className="h-3.5 w-3.5" />;
  if (label.includes("Swap")) return <Image className="h-3.5 w-3.5" />;
  if (label.includes("Variant") || label.includes("Revision")) return <Repeat2 className="h-3.5 w-3.5" />;
  if (label.includes("Comment")) return <MessageSquare className="h-3.5 w-3.5" />;
  if (label.includes("Save")) return <Save className="h-3.5 w-3.5" />;
  if (label.includes("Duplicate")) return <Copy className="h-3.5 w-3.5" />;
  return <Route className="h-3.5 w-3.5" />;
}

function ConceptLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-200" />
        {label}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-300">{value}</div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[72px] w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm leading-6 text-white focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}
