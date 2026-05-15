"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  DollarSign,
  Eye,
  FileText,
  Image,
  Layers3,
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
  Star,
  Timer,
  Users,
} from "lucide-react";
import {
  AMY_ACTON_ADMIN_COMMAND_ITEMS,
  AMY_ACTON_ADVANCED_WORKFLOWS,
  AMY_ACTON_CAMPAIGN_STRATEGIES,
  AMY_ACTON_COMPLIANCE_GUARDRAILS,
  AMY_ACTON_CREATIVE_RESEARCH_PATTERNS,
  AMY_ACTON_INTELLIGENCE_SIGNALS,
  AMY_ACTON_INTELLIGENCE_SOURCES,
  AMY_ACTON_LIVING_PROFILE,
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
  type:
    | "comment"
    | "revision"
    | "save"
    | "approval"
    | "variant"
    | "duplicate"
    | "selection"
    | "export"
    | "workflow";
  text: string;
}

interface ConceptEdit {
  headline?: string;
  subheadline?: string;
  frontBodyCopy?: string;
  backBodyCopy?: string;
  cta?: string;
  suggestedImagery?: string;
  visualDirection?: string;
  colorStyleDirection?: string;
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
      frontBodyCopy:
        "Amy Acton knows families are carrying too much right now. Her campaign is focused on care, costs, and the everyday dignity of work.",
      backBodyCopy:
        "This revision keeps the message broad and campaign-provided: practical leadership, family budgets, health care access, and official voting information. It does not select routes by inferred household traits.",
      cta: "See Amy's plan for families",
      suggestedImagery: "Campaign-approved Ohio kitchen-table, workplace, or neighborhood image with warm natural light.",
      visualDirection:
        "Use a warmer kitchen-table image direction with parent, worker, and neighborhood cues kept broad and non-targeted.",
      colorStyleDirection: "Warm white base, navy type, campaign blue CTA, and restrained red deadline accent.",
      status: "AI revision drafted from comment: working-family emphasis.",
    };
  }

  if (lower.includes("health") || lower.includes("care") || lower.includes("doctor")) {
    return {
      headline: "A doctor ready to lead Ohio.",
      subheadline: "Amy Acton brings steady public-service experience to health care and family affordability.",
      frontBodyCopy:
        "Ohio families deserve a governor who understands care, prevention, and the pressure people feel when the system is too hard to navigate.",
      backBodyCopy:
        "Use sourced biography and campaign-approved health care priorities. Keep claims clear, plain, and ready for compliance review.",
      cta: "Read Amy's health care priorities",
      suggestedImagery: "Campaign-approved portrait with clinic, community health, or Ohio family visual context.",
      visualDirection:
        "Use a clean doctor/public-service visual system with Ohio community imagery and source-tagged proof points.",
      colorStyleDirection: "Clinical white, trustworthy blue, calm slate, and high-contrast accessibility treatment.",
      status: "AI revision drafted from comment: health care emphasis.",
    };
  }

  if (lower.includes("urgent") || lower.includes("deadline") || lower.includes("vote")) {
    return {
      headline: "Ohio's choice is almost here.",
      subheadline: "Know the dates, compare the records, and make your plan before Election Day.",
      frontBodyCopy:
        "The voting window is moving fast. This postcard makes the election date, stakes, and official information easy to find.",
      backBodyCopy:
        "Use official dates, campaign-approved contrast, QR code, and disclaimer. No claim should ship without source and legal review.",
      cta: "Check official voting dates",
      suggestedImagery: "Bold calendar, ballot-window timeline, or source-labeled comparison panel.",
      visualDirection:
        "Use a high-contrast deadline treatment with a calendar panel, election date, and official source label.",
      colorStyleDirection: "Dark navy base, white date card, red urgency accent, and blue CTA.",
      status: "AI revision drafted from comment: urgency and election timing.",
    };
  }

  return {
    headline: `${concept.headline} Ready for campaign review.`,
    subheadline: `${concept.subheadline} Revised for clearer tone and cleaner mailbox scanning.`,
    frontBodyCopy: concept.frontBodyCopy,
    backBodyCopy: `${concept.backBodyCopy} Staff requested a clearer revision; final copy still requires campaign approval.`,
    cta: concept.cta,
    suggestedImagery: concept.suggestedImagery,
    visualDirection: `${concept.visualDirection} Tighten copy hierarchy and keep all public claims source-labeled.`,
    colorStyleDirection: concept.colorStyleDirection,
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
  const [favoriteConcepts, setFavoriteConcepts] = useState<Record<string, boolean>>({});
  const [reviewSelectedConcepts, setReviewSelectedConcepts] = useState<Record<string, boolean>>({});
  const [duplicatedConcepts, setDuplicatedConcepts] = useState<Record<string, ActonPostcardConcept[]>>({});
  const [flipbookOpen, setFlipbookOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [flipbookIndex, setFlipbookIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("All");
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
    const merged = [...activePhase.postcardConcepts, ...extras];
    if (categoryFilter === "All") return merged;
    return merged.filter((concept) => concept.category === categoryFilter);
  }, [activePhase.id, activePhase.postcardConcepts, categoryFilter, duplicatedConcepts]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];
  const editedSelectedConcept = selectedConcept ? applyConceptEdit(selectedConcept, conceptEdits[selectedConcept.id]) : null;
  const flipbookConcept = concepts[flipbookIndex] ?? concepts[0] ?? activePhase.postcardConcepts[0];
  const selectedReviewConcepts = useMemo(
    () =>
      Object.keys(reviewSelectedConcepts)
        .filter((id) => reviewSelectedConcepts[id])
        .map((id) => findConceptById(id, duplicatedConcepts))
        .filter((concept): concept is ActonPostcardConcept => Boolean(concept))
        .map((concept) => applyConceptEdit(concept, conceptEdits[concept.id])),
    [conceptEdits, duplicatedConcepts, reviewSelectedConcepts],
  );

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
    setFlipbookIndex(0);
    setCategoryFilter("All");
    setStatusMessage(`${nextStrategy.campaignName} loaded. Review phases, concepts, and readiness gates before proposal.`);
  }

  function selectPhase(phaseId: string) {
    const nextPhase = activeStrategy.phases.find((phase) => phase.id === phaseId);
    if (!nextPhase) return;
    setActivePhaseId(phaseId);
    setSelectedConceptId(nextPhase.postcardConcepts[0]?.id ?? "");
    setCommentTarget(nextPhase.postcardConcepts[0]?.id ?? "");
    setFlipbookIndex(0);
    setCategoryFilter("All");
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
      setReviewSelectedConcepts((current) => ({ ...current, [concept.id]: true }));
      addLog({
        conceptId: concept.id,
        type: "selection",
        text: `${concept.category} selected for the ${activePhase.name} phase.`,
      });
      setStatusMessage("Design selected. Leave a comment or request an AI revision before approval.");
      return;
    }

    if (action === "Favorite Design") {
      setFavoriteConcepts((current) => ({ ...current, [concept.id]: !current[concept.id] }));
      setStatusMessage(`${concept.category} favorite state updated.`);
      return;
    }

    if (action === "Compare Designs") {
      setReviewSelectedConcepts((current) => ({ ...current, [concept.id]: true }));
      setCompareOpen(true);
      setStatusMessage("Compare view opened with selected designs. Add more designs with Select Design or Compare Designs.");
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

  function handleCommandAction(action: string) {
    if (action === "Generate Strategy") {
      setAgentState("working");
      window.setTimeout(() => {
        addLog({
          conceptId: "strategy",
          type: "workflow",
          text: `${activeStrategy.campaignName} regenerated from source-backed strategy model.`,
        });
        setAgentState("ready");
        setStatusMessage("Strategy refreshed. No campaign record, quote, or checkout was changed.");
      }, 320);
      return;
    }

    if (action === "Generate Phase Plan") {
      addLog({
        conceptId: activePhase.id,
        type: "workflow",
        text: `${activePhase.name} phase plan regenerated with ${number(activePhase.mailQuantity)} draft pieces.`,
      });
      setStatusMessage("Phase plan regenerated in draft mode. Route counts still require verification.");
      return;
    }

    if (action === "Generate Postcards") {
      addLog({
        conceptId: activePhase.id,
        type: "variant",
        text: `Postcard set refreshed for ${activePhase.name}: ${activePhase.postcardConcepts.length} required concepts loaded.`,
      });
      setStatusMessage("Postcard concepts refreshed from the creative research layer.");
      return;
    }

    if (action === "Open Flipbook") {
      setFlipbookOpen(true);
      setFlipbookIndex(0);
      setStatusMessage("Flipbook opened for fast front/back creative review.");
      return;
    }

    if (action === "Compare Designs") {
      setCompareOpen(true);
      setStatusMessage("Compare view opened. Select at least two designs for a stronger comparison.");
      return;
    }

    if (action === "Export Proposal") {
      exportSelectedDesigns("proposal");
      return;
    }

    if (action === "Export Creative Brief") {
      exportSelectedDesigns("creative-brief");
      return;
    }

    if (action === "Add to Campaign Plan") {
      addLog({
        conceptId: "campaign-plan",
        type: "workflow",
        text: `${selectedReviewConcepts.length || 1} design concept(s) staged for the campaign plan draft.`,
      });
      setStatusMessage("Selected designs staged for the campaign plan draft. This does not create checkout or production.");
      return;
    }

    if (action === "Send to Admin Review" || action === "Send to Client Review") {
      const destination = action === "Send to Admin Review" ? "admin review" : "client review";
      addLog({
        conceptId: destination,
        type: "workflow",
        text: `Selected Acton package queued for ${destination}. Human approval and quote lock remain required.`,
      });
      setStatusMessage(`Queued for ${destination}. Export remains draft-only until source, route, quote, and approval gates pass.`);
    }
  }

  function exportSelectedDesigns(kind: "proposal" | "creative-brief") {
    const exportConcepts = selectedReviewConcepts.length > 0
      ? selectedReviewConcepts
      : editedSelectedConcept
        ? [editedSelectedConcept]
        : [];
    if (exportConcepts.length === 0) {
      setStatusMessage("Select at least one design before exporting.");
      return;
    }

    const filename = `amy-acton-${kind}-${Date.now()}.txt`;
    const body = buildExportBody(kind, activeStrategy, activePhase, exportConcepts);
    downloadTextFile(filename, body);
    addLog({
      conceptId: kind,
      type: "export",
      text: `${kind === "proposal" ? "Proposal" : "Creative brief"} export generated for ${exportConcepts.length} design(s).`,
    });
    setStatusMessage(`${kind === "proposal" ? "Proposal" : "Creative brief"} export generated as a draft review file.`);
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

          <section className="mt-6">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
              Living profile
            </div>
            <div className="mt-4 space-y-3">
              {AMY_ACTON_LIVING_PROFILE.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-black text-white">{item.label}</div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-slate-300">
                      {item.confidence}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.value}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.sourceLabels.map((label) => (
                      <span key={label} className="rounded bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-100">
                        {label}
                      </span>
                    ))}
                  </div>
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

          <section className="mt-6 rounded-lg border border-amber-300/20 bg-amber-950/20 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-amber-50">
              <Layers3 className="h-4 w-4" />
              Creative research layer
            </div>
            <div className="mt-3 space-y-3">
              {AMY_ACTON_CREATIVE_RESEARCH_PATTERNS.map((pattern) => (
                <div key={pattern.category} className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                    {pattern.category}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-amber-50/75">{pattern.insight}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{pattern.application}</p>
                </div>
              ))}
            </div>
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

          <section className="mt-5 rounded-lg border border-white/10 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Hardened action bar
                </p>
                <h4 className="mt-1 text-lg font-black text-white">Generate, review, export, and route to approval</h4>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  These are draft workflow actions. They do not alter payment, checkout, production, route inventory, or campaign records without human review.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200">
                {selectedReviewConcepts.length} selected / {Object.values(approvedConcepts).filter(Boolean).length} approved
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {[
                "Generate Strategy",
                "Generate Phase Plan",
                "Generate Postcards",
                "Open Flipbook",
                "Compare Designs",
                "Export Proposal",
                "Export Creative Brief",
                "Add to Campaign Plan",
                "Send to Admin Review",
                "Send to Client Review",
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleCommandAction(action)}
                  disabled={agentState === "working"}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-300/30 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {commandIcon(action)}
                  {action}
                </button>
              ))}
            </div>
          </section>

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
                <StrategyDetail title="Persuasion goals" items={activeStrategy.persuasionGoals} />
                <StrategyDetail title="Turnout goals" items={activeStrategy.turnoutGoals} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <SmallInfo label="Audience context" value={activeStrategy.audienceContext} />
                <SmallInfo label="Timing cadence" value={activeStrategy.timingCadence} />
                <SmallInfo label="Rollout strategy" value={activeStrategy.statewideRolloutStrategy} />
                <SmallInfo label="Aggregate trends" value={activeStrategy.aggregateAudienceTrends.join(" ")} />
                <SmallInfo label="Mail assumptions" value={activeStrategy.mailQuantityAssumptions} />
                <SmallInfo label="Expected outcome" value={activeStrategy.expectedOutcome} />
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

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
              <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Scenario and phase filters
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AMY_ACTON_CAMPAIGN_STRATEGIES.map((strategy) => (
                    <button
                      key={`scenario-${strategy.id}`}
                      type="button"
                      onClick={() => selectStrategy(strategy.id)}
                      className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                        activeStrategy.id === strategy.id
                          ? "border-blue-300/50 bg-blue-500/20 text-white"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {strategy.campaignName}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeStrategy.phases.map((phase) => (
                    <button
                      key={`phase-filter-${phase.id}`}
                      type="button"
                      onClick={() => selectPhase(phase.id)}
                      className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                        activePhase.id === phase.id
                          ? "border-amber-300/50 bg-amber-500/15 text-white"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {phase.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Category filter
                </label>
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setFlipbookIndex(0);
                  }}
                  className="mt-3 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {["All", "Emotional / Human", "Policy / Issue Focused", "Testimonial / Social Proof", "Contrast / Urgency"].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setFlipbookOpen((current) => !current)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-500"
                >
                  <Layers3 className="h-4 w-4" />
                  {flipbookOpen ? "Close Flipbook" : "Open Flipbook"}
                </button>
              </div>
            </div>

            {flipbookOpen && flipbookConcept && (
              <FlipbookReview
                concept={applyConceptEdit(flipbookConcept, conceptEdits[flipbookConcept.id])}
                currentIndex={flipbookIndex}
                total={concepts.length}
                previewSide={previewSides[flipbookConcept.id] ?? "front"}
                selected={Boolean(reviewSelectedConcepts[flipbookConcept.id])}
                favorite={Boolean(favoriteConcepts[flipbookConcept.id])}
                approved={Boolean(approvedConcepts[flipbookConcept.id])}
                onPrev={() => setFlipbookIndex((current) => (current <= 0 ? Math.max(0, concepts.length - 1) : current - 1))}
                onNext={() => setFlipbookIndex((current) => (current >= concepts.length - 1 ? 0 : current + 1))}
                onAction={(action) => handleAction(action, flipbookConcept)}
              />
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {concepts.map((concept) => (
                <CreativeConceptCard
                  key={concept.id}
                  concept={applyConceptEdit(concept, conceptEdits[concept.id])}
                  selected={selectedConceptId === concept.id}
                  reviewSelected={Boolean(reviewSelectedConcepts[concept.id])}
                  favorite={Boolean(favoriteConcepts[concept.id])}
                  approved={Boolean(approvedConcepts[concept.id])}
                  previewSide={previewSides[concept.id] ?? "front"}
                  variantCount={conceptEdits[concept.id]?.variantCount ?? 0}
                  onAction={(action) => handleAction(action, concept)}
                />
              ))}
            </div>

            {compareOpen && (
              <section className="mt-5 rounded-lg border border-amber-300/20 bg-amber-950/20 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                      Compare selected designs
                    </div>
                    <h4 className="mt-1 text-lg font-black text-white">
                      {selectedReviewConcepts.length || 0} design(s) selected for review
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompareOpen(false)}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                  >
                    Close Compare
                  </button>
                </div>
                {selectedReviewConcepts.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-amber-50/80">
                    Select or compare designs from the concept cards to populate this review table.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {selectedReviewConcepts.map((concept) => (
                      <div key={`compare-${concept.id}`} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
                          {concept.category}
                        </div>
                        <div className="mt-2 text-base font-black text-white">{concept.headline}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-300">{concept.subheadline}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <SmallInfo label="Audience fit" value={concept.audienceFit} />
                          <SmallInfo label="Geographic fit" value={concept.geographicFit} />
                          <SmallInfo label="CTA" value={concept.cta} />
                          <SmallInfo label="Compliance" value={concept.complianceDisclaimer} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

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
                        <EditField
                          label="Front body copy"
                          value={editedSelectedConcept.frontBodyCopy}
                          onChange={(value) =>
                            setConceptEdits((current) => ({
                              ...current,
                              [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], frontBodyCopy: value },
                            }))
                          }
                        />
                        <EditField
                          label="Back body copy"
                          value={editedSelectedConcept.backBodyCopy}
                          onChange={(value) =>
                            setConceptEdits((current) => ({
                              ...current,
                              [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], backBodyCopy: value },
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
                      <>
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
                        <EditField
                          label="Suggested imagery"
                          value={editedSelectedConcept.suggestedImagery}
                          onChange={(value) =>
                            setConceptEdits((current) => ({
                              ...current,
                              [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], suggestedImagery: value },
                            }))
                          }
                        />
                        <EditField
                          label="Color/style direction"
                          value={editedSelectedConcept.colorStyleDirection}
                          onChange={(value) =>
                            setConceptEdits((current) => ({
                              ...current,
                              [editedSelectedConcept.id]: { ...current[editedSelectedConcept.id], colorStyleDirection: value },
                            }))
                          }
                        />
                      </>
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
    frontBodyCopy: edit.frontBodyCopy ?? concept.frontBodyCopy,
    backBodyCopy: edit.backBodyCopy ?? concept.backBodyCopy,
    cta: edit.cta ?? concept.cta,
    suggestedImagery: edit.suggestedImagery ?? concept.suggestedImagery,
    visualDirection: edit.visualDirection ?? concept.visualDirection,
    colorStyleDirection: edit.colorStyleDirection ?? concept.colorStyleDirection,
  };
}

function findConceptById(
  id: string,
  duplicatedConcepts: Record<string, ActonPostcardConcept[]>,
): ActonPostcardConcept | null {
  const baseConcepts = AMY_ACTON_CAMPAIGN_STRATEGIES.flatMap((strategy) =>
    strategy.phases.flatMap((phase) => phase.postcardConcepts),
  );
  const duplicates = Object.values(duplicatedConcepts).flat();
  return [...baseConcepts, ...duplicates].find((concept) => concept.id === id) ?? null;
}

function buildExportBody(
  kind: "proposal" | "creative-brief",
  strategy: ActonStrategy,
  phase: ActonPhase,
  concepts: ActonPostcardConcept[],
) {
  const title = kind === "proposal" ? "Amy Acton Draft Proposal Review" : "Amy Acton Creative Brief Review";
  return [
    title,
    "",
    `Strategy: ${strategy.campaignName}`,
    `Theme: ${strategy.theme}`,
    `Phase: ${phase.name}`,
    `Mail quantity assumption: ${number(phase.mailQuantity)}`,
    `Timing: ${phase.timingRecommendation}`,
    `Target geography: ${phase.targetGeography}`,
    "",
    "Compliance note:",
    "Draft review only. Human approval, source verification, USPS route counts, price lock, legal disclaimer, and campaign approval are required before proposal, checkout, print, or production.",
    "",
    ...concepts.flatMap((concept, index) => [
      `Design ${index + 1}: ${concept.category}`,
      `Headline: ${concept.headline}`,
      `Subheadline: ${concept.subheadline}`,
      `Front copy: ${concept.frontBodyCopy}`,
      `Back copy: ${concept.backBodyCopy}`,
      `CTA: ${concept.cta}`,
      `Suggested imagery: ${concept.suggestedImagery}`,
      `Visual direction: ${concept.visualDirection}`,
      `Color/style: ${concept.colorStyleDirection}`,
      `Audience fit: ${concept.audienceFit}`,
      `Geographic fit: ${concept.geographicFit}`,
      `Internal notes: ${concept.internalStrategyNotes}`,
      `Disclaimer placeholder: ${concept.complianceDisclaimer}`,
      "",
    ]),
  ].join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function commandIcon(action: string) {
  if (action.includes("Generate")) return <Sparkles className="h-3.5 w-3.5" />;
  if (action.includes("Flipbook") || action.includes("Compare")) return <Layers3 className="h-3.5 w-3.5" />;
  if (action.includes("Export")) return <Download className="h-3.5 w-3.5" />;
  if (action.includes("Campaign")) return <MapPinned className="h-3.5 w-3.5" />;
  if (action.includes("Admin") || action.includes("Client")) return <Send className="h-3.5 w-3.5" />;
  return <Route className="h-3.5 w-3.5" />;
}

function FlipbookReview({
  concept,
  currentIndex,
  total,
  previewSide,
  selected,
  favorite,
  approved,
  onPrev,
  onNext,
  onAction,
}: {
  concept: ActonPostcardConcept;
  currentIndex: number;
  total: number;
  previewSide: PreviewSide;
  selected: boolean;
  favorite: boolean;
  approved: boolean;
  onPrev: () => void;
  onNext: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <section className="mt-4 rounded-lg border border-blue-300/20 bg-slate-950 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
            Flipbook review
          </div>
          <h4 className="mt-1 text-xl font-black text-white">{concept.headline}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {currentIndex + 1} of {total} / {concept.category}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected && <StatusPill icon={CheckCircle2} label="Selected" tone="blue" />}
          {favorite && <StatusPill icon={Star} label="Favorite" tone="amber" />}
          {approved && <StatusPill icon={ShieldCheck} label="Approved" tone="emerald" />}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[42px_1fr_42px] lg:items-center">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/10"
          aria-label="Previous postcard concept"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(37,99,235,0.28),rgba(239,68,68,0.16)),radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_38%)] p-4">
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="aspect-[9/6] rounded-lg border border-white/20 bg-white p-5 text-slate-950 shadow-2xl">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    {previewSide === "front" ? "Front preview" : "Back preview"}
                  </div>
                  <h5 className="mt-4 text-3xl font-black leading-tight">
                    {previewSide === "front" ? concept.headline : concept.cta}
                  </h5>
                  <p className="mt-3 text-base font-semibold leading-6 text-slate-700">
                    {previewSide === "front" ? concept.frontBodyCopy : concept.backBodyCopy}
                  </p>
                </div>
                <div className="mt-5 rounded-md bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white">
                  {previewSide === "front" ? concept.subheadline : concept.complianceDisclaimer}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <SmallInfo label="Suggested imagery" value={concept.suggestedImagery} />
              <SmallInfo label="Visual direction" value={concept.visualDirection} />
              <SmallInfo label="Color/style" value={concept.colorStyleDirection} />
              <SmallInfo label="Internal strategy notes" value={concept.internalStrategyNotes} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/10"
          aria-label="Next postcard concept"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          "Preview Front",
          "Preview Back",
          "Favorite Design",
          "Select Design",
          "Compare Designs",
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
        ].map((action) => (
          <button
            key={`flipbook-${action}`}
            type="button"
            onClick={() => onAction(action)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
          >
            {buttonIcon(action)}
            {action}
          </button>
        ))}
      </div>
    </section>
  );
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
  reviewSelected,
  favorite,
  approved,
  previewSide,
  variantCount,
  onAction,
}: {
  concept: ActonPostcardConcept;
  selected: boolean;
  reviewSelected: boolean;
  favorite: boolean;
  approved: boolean;
  previewSide: PreviewSide;
  variantCount: number;
  onAction: (action: string) => void;
}) {
  const buttonLabels = [
    "Favorite Design",
    "Preview Front",
    "Preview Back",
    "Select Design",
    "Compare Designs",
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
          {reviewSelected && (
            <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[10px] font-black uppercase text-blue-100">
              selected
            </span>
          )}
          {favorite && (
            <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-black uppercase text-amber-100">
              favorite
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
          <ConceptLine icon={Image} label="Suggested imagery" value={concept.suggestedImagery} />
          <ConceptLine icon={Layers3} label="Color/style" value={concept.colorStyleDirection} />
          <ConceptLine icon={Users} label="Audience fit" value={concept.audienceFit} />
          <ConceptLine icon={MapPinned} label="Geographic fit" value={concept.geographicFit} />
          <ConceptLine icon={Sparkles} label="Emotional strategy" value={concept.emotionalStrategy} />
          <ConceptLine icon={Send} label="CTA" value={concept.cta} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Front copy
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-300">{concept.frontBodyCopy}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Back copy
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-300">{concept.backBodyCopy}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <ConceptLine icon={PenLine} label="Persuasion intent" value={concept.persuasionIntent} />
        <ConceptLine icon={Timer} label="Turnout intent" value={concept.turnoutIntent} />
        <ConceptLine icon={ShieldCheck} label="Disclaimer placeholder" value={concept.complianceDisclaimer} />
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
  if (label.includes("Favorite")) return <Star className="h-3.5 w-3.5" />;
  if (label.includes("Preview")) return <Eye className="h-3.5 w-3.5" />;
  if (label.includes("Select") || label.includes("Approve")) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (label.includes("Compare")) return <Layers3 className="h-3.5 w-3.5" />;
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
