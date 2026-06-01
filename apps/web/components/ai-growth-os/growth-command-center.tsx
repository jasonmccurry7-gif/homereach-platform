"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Megaphone,
  MessageSquareText,
  PenLine,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
import {
  buildGrowthOnboardingPlan,
  createGrowthContentDraft,
  getAiGrowthOsSnapshot,
  type GrowthAction,
  type GrowthContentDraft,
  type GrowthContentKind,
  type GrowthOnboardingInput,
} from "@/lib/ai-growth-os/sample-data";

const contentKindOptions: Array<{ label: string; kind: GrowthContentKind; icon: LucideIcon }> = [
  { label: "Generate Post", kind: "social_post", icon: PenLine },
  { label: "Google Post", kind: "google_post", icon: Globe2 },
  { label: "Review Request", kind: "review_request", icon: Star },
  { label: "Seasonal Campaign", kind: "seasonal_campaign", icon: Rocket },
  { label: "Community Post", kind: "community_post", icon: MessageSquareText },
  { label: "Targeted Mail", kind: "targeted_mail", icon: Megaphone },
];

const initialInput: GrowthOnboardingInput = {
  businessName: "",
  city: "",
  services: "",
  customers: "",
};

export function GrowthCommandCenter() {
  const snapshot = useMemo(() => getAiGrowthOsSnapshot(), []);
  const firstDraft = snapshot.contentDrafts[0] ?? createGrowthContentDraft("social_post", initialInput);
  const [input, setInput] = useState<GrowthOnboardingInput>(initialInput);
  const [selectedDraft, setSelectedDraft] = useState<GrowthContentDraft>(firstDraft);
  const [draftCopy, setDraftCopy] = useState(firstDraft.copy);
  const [reviewStatus, setReviewStatus] = useState("Draft only. Nothing has been sent, posted, scheduled, or published.");
  const [isQueueing, setIsQueueing] = useState(false);
  const [activePlan, setActivePlan] = useState(() => buildGrowthOnboardingPlan(initialInput));

  function updateInput(field: keyof GrowthOnboardingInput, value: string) {
    const next = { ...input, [field]: value };
    setInput(next);
    setActivePlan(buildGrowthOnboardingPlan(next));
  }

  function generateDraft(kind: GrowthContentKind) {
    const draft = createGrowthContentDraft(kind, input);
    setSelectedDraft(draft);
    setDraftCopy(draft.copy);
    setReviewStatus("New draft generated. Review, edit, and approve before any public use.");
  }

  async function queueDraftForReview(taskType = taskTypeForDraft(selectedDraft.kind)) {
    setIsQueueing(true);
    setReviewStatus("Sending this draft to the AI Workforce approval layer...");
    try {
      const response = await fetch("/api/ai-growth-os/agent-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          title: selectedDraft.title,
          content: draftCopy,
          businessName: input.businessName,
          city: input.city,
          services: input.services,
          customers: input.customers,
          channel: selectedDraft.channel,
          cta: selectedDraft.cta,
          reuseIdea: selectedDraft.reuseIdea,
          approvalNote: selectedDraft.approvalNote,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        taskId?: string;
        assignedAgent?: string;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "The AI Workforce queue could not accept this draft.");
      }

      setReviewStatus(
        `Queued for ${result.assignedAgent ?? "AI Workforce"} review as ${result.taskId}. No public action has happened.`,
      );
    } catch (error) {
      setReviewStatus(
        `${error instanceof Error ? error.message : "Queue failed."} Draft remains local and approval-required.`,
      );
    } finally {
      setIsQueueing(false);
    }
  }

  function prepareCanvaBrief() {
    void queueDraftForReview("canva_brief");
  }

  function scheduleLater() {
    setReviewStatus("Schedule request noted for review. No post has been scheduled or published.");
  }

  function saveWinningContent() {
    setReviewStatus("Saved as a reusable content idea in this session. Persisted winning-content storage needs live integration.");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{snapshot.positioning.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{snapshot.positioning.headline}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{snapshot.positioning.subheadline}</p>
            </div>
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Next best action</p>
              <p className="mt-2 text-lg font-black">Launch scan + assistant setup</p>
              <p className="mt-1 text-sm leading-6 text-cyan-50/85">
                Start with visibility and lead capture before adding content volume.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.metrics.map((metric) => (
            <MetricTile key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
          ))}
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">AI-first onboarding</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Tell us about the business.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The setup starts with plain language, then AI recommends the assistant, visibility, content, and campaign path.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Business name"
                placeholder="Summit Roofing"
                value={input.businessName}
                onChange={(value) => updateInput("businessName", value)}
              />
              <Field label="City served" placeholder="Akron" value={input.city} onChange={(value) => updateInput("city", value)} />
              <Field
                label="Services offered"
                placeholder="Roof repairs, replacements, inspections"
                value={input.services}
                onChange={(value) => updateInput("services", value)}
              />
              <Field
                label="Customers wanted"
                placeholder="Homeowners with storm damage"
                value={input.customers}
                onChange={(value) => updateInput("customers", value)}
              />
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <p className="text-sm font-black text-blue-950">{activePlan.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activePlan.recommendedSetup.map((item) => (
                    <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-100">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Action Center</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">What should happen next?</h2>
              </div>
              <ClipboardCheck className="h-6 w-6 text-blue-700" />
            </div>
            <div className="mt-4 grid gap-3">
              {activePlan.nextActions.map((action) => (
                <ActionRow key={action.title} action={action} onDraft={() => generateDraft("social_post")} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Fast actions</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {snapshot.quickActions.map((action) => (
                <ActionButton key={action.cta} action={action} onDraft={() => generateDraft(action.cta === "Generate Campaign" || action.cta === "Build Campaign" ? "targeted_mail" : "social_post")} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI Content Engine</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Generate useful local content fast.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Draft posts, Google updates, review requests, and campaign concepts. Nothing publishes automatically.
                </p>
              </div>
              <Wand2 className="h-6 w-6 text-blue-700" />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {contentKindOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => generateDraft(option.kind)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{selectedDraft.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{selectedDraft.channel}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Approval required</span>
              </div>
              <textarea
                value={draftCopy}
                onChange={(event) => setDraftCopy(event.target.value)}
                className="mt-4 min-h-40 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                aria-label="Generated content draft"
              />
              <div className="mt-3 rounded-lg border border-white bg-white p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">CTA</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{selectedDraft.cta}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Reuse idea</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{selectedDraft.reuseIdea}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-row lg:flex-wrap">
                <button
                  type="button"
                  onClick={() => void queueDraftForReview()}
                  disabled={isQueueing}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
                >
                  {isQueueing ? "Queueing..." : "Add to Review Queue"}
                </button>
                <button
                  type="button"
                  onClick={scheduleLater}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100"
                >
                  Schedule Later
                </button>
                <button
                  type="button"
                  onClick={prepareCanvaBrief}
                  disabled={isQueueing}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100"
                >
                  Export Canva Brief
                </button>
                <button
                  type="button"
                  onClick={saveWinningContent}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100"
                >
                  Reuse Winner
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold text-amber-800">{reviewStatus}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI agents</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Simple jobs, clear guardrails.</h2>
              </div>
              <Bot className="h-6 w-6 text-blue-700" />
            </div>
            <div className="mt-4 grid gap-3">
              {snapshot.agents.map((agent) => (
                <div key={agent.name} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-700" />
                    <p className="font-black text-slate-950">{agent.name}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{agent.role}</p>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Next move</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{agent.nextAction}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Connected ecosystem</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">One growth center, not more clutter.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                This page routes users into the existing HomeReach modules so the owner sees one simple system while
                protected execution stays inside the right dashboard.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.connectedModules.map((module) => (
                <Link
                  key={module.title}
                  href={module.href}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <p className="text-sm font-black text-slate-950">{module.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{module.body}</p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-blue-700">{module.cta}</span>
                    <ArrowRight className="h-4 w-4 text-blue-700" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Agent hardening</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">The agents are useful, but boxed in safely.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The Growth Center creates supervised work for the AI Workforce manifest. It does not become a hidden
                autopilot.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.agentControls.map((control) => (
                <div key={control.title} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">{control.title}</p>
                    <span className={controlStatusBadge(control.status)}>{control.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-blue-700">{control.owner}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{control.guardrail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-5">
          <div className="grid gap-5 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Human control</p>
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-emerald-950">AI prepares the work. People approve the action.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.approvalRules.map((rule) => (
                <div key={rule} className="flex gap-3 rounded-lg bg-white p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <p className="text-sm font-semibold leading-6 text-emerald-950">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function taskTypeForDraft(kind: GrowthContentKind) {
  if (kind === "google_post") return "google_post";
  if (kind === "review_request") return "review_request";
  if (kind === "targeted_mail" || kind === "seasonal_campaign") return "campaign_concept";
  return "content_draft";
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function MetricTile({ label, value, detail }: GrowthMetricProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-4 text-4xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

type GrowthMetricProps = {
  label: string;
  value: string;
  detail: string;
};

function ActionRow({ action, onDraft }: { action: GrowthAction; onDraft: () => void }) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-slate-950">{action.title}</p>
          <UrgencyBadge urgency={action.urgency} />
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{action.body}</p>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-blue-700">{action.impact}</p>
      </div>
      {action.href ? (
        <Link href={action.href} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700">
          {action.cta}
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Link>
      ) : (
        <button type="button" onClick={onDraft} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700">
          {action.cta}
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ActionButton({ action, onDraft }: { action: GrowthAction; onDraft: () => void }) {
  const body = (
    <>
      <span>{action.cta}</span>
      <ArrowRight className="h-4 w-4" />
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800">
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onDraft}
      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
    >
      {body}
    </button>
  );
}

function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" }) {
  const classes =
    urgency === "high"
      ? "bg-rose-100 text-rose-700"
      : urgency === "medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${classes}`}>
      {urgency}
    </span>
  );
}

function controlStatusBadge(status: "active" | "needs_integration" | "review_required") {
  if (status === "active") {
    return "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700";
  }
  if (status === "needs_integration") {
    return "rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700";
  }
  return "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700";
}
