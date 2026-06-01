"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Database,
  Download,
  FileText,
  Layers3,
  Library,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataModeBanner, type DataMode } from "@/components/admin/data-mode-banner";
import type {
  AiAgentProfile,
  AiAssetsCommandCenterData,
  AiBusinessContext,
  AiDataSource,
  AiOutput,
  AiPromptChain,
  AiPromptSop,
  AiVerificationCheck,
} from "@/lib/ai-assets/types";

type TabId = "overview" | "context" | "sops" | "sources" | "agents" | "chains" | "verification" | "review";

const tabs: Array<{ id: TabId; label: string; icon: typeof Sparkles }> = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "context", label: "Business Context", icon: FileText },
  { id: "sops", label: "Prompt SOPs", icon: Library },
  { id: "sources", label: "Data Sources", icon: Database },
  { id: "agents", label: "Agent Instructions", icon: Bot },
  { id: "chains", label: "Prompt Chains", icon: Workflow },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "review", label: "Daily Review", icon: ListChecks },
];

const APPROVAL_PENDING_STATUSES = new Set(["draft", "needs_review", "revision_needed"]);

export function AiAssetsCommandCenter({ data }: { data: AiAssetsCommandCenterData }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...data.promptSops.map((item) => item.category),
          ...data.dataSources.map((item) => item.category),
          ...data.promptChains.map((item) => item.category),
        ]),
      ).sort(),
    [data.dataSources, data.promptChains, data.promptSops],
  );

  const filteredSops = filterItems(data.promptSops, query, category, (item) => [
    item.promptName,
    item.category,
    item.purpose,
    item.promptText,
  ]);
  const filteredSources = filterItems(data.dataSources, query, category, (item) => [
    item.title,
    item.category,
    item.description,
    item.content,
  ]);
  const filteredAgents = filterItems(data.agentProfiles, query, "all", (item) => [
    item.agentName,
    item.mission,
    item.approvalRules,
    item.complianceRules,
  ]);
  const filteredChains = filterItems(data.promptChains, query, category, (item) => [
    item.chainName,
    item.category,
    item.purpose,
    ...item.steps.map((step) => step.stepName),
  ]);

  const awaitingApproval = data.outputs.filter((output) => APPROVAL_PENDING_STATUSES.has(output.approvalStatus)).length;
  const approvedToday = data.outputs.filter((output) => output.approvalStatus === "approved").length;
  const activeAgents = data.agentProfiles.filter((agent) => agent.status === "active").length;
  const activeSources = data.dataSources.filter((source) => source.status === "active").length;
  const readiness = getAssetsReadiness(data);
  const dataMode = getAiAssetsDataMode(data);

  return (
    <div className="mx-auto max-w-7xl space-y-6 text-slate-950">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_36%),linear-gradient(135deg,#07111f,#0f172a)] p-5 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">AI Assets Command Center</p>
              <h1 className="mt-3 text-3xl font-black tracking-normal md:text-5xl">
                The source of truth for HomeReach AI work.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-200 md:text-base md:leading-7">
                Store business context, reusable prompt SOPs, winning examples, agent instructions, prompt chains,
                and approval rules so every AI output is grounded, human, useful, and verified.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[460px]">
              <MetricCard label="Prompt SOPs" value={data.promptSops.length} detail="Reusable workflows" />
              <MetricCard label="Sources" value={activeSources} detail="Active reference assets" />
              <MetricCard label="Agents" value={activeAgents} detail="Instruction profiles" />
              <MetricCard
                label="AI Readiness"
                value={readiness.score}
                detail={readiness.label}
                tone={readiness.score >= 90 ? "blue" : "amber"}
              />
              <MetricCard label="Needs Review" value={awaitingApproval} detail="Human approval queue" tone="amber" />
            </div>
          </div>
        </div>
      </section>

      <DataModeBanner
        mode={dataMode.mode}
        title={dataMode.title}
        detail={dataMode.detail}
        items={dataMode.items}
      />

      {!data.schemaReady || data.warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black">Persistence needs review</p>
              <p className="mt-1">{data.migrationHint ?? "One or more AI Assets tables returned warnings."}</p>
              {data.warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {data.warnings.slice(0, 4).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <span className="font-black">AI Assets tables are online and persistence is active.</span>
          </div>
        </section>
      )}

      <AssetsReadinessPanel readiness={readiness} setActiveTab={setActiveTab} />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition",
                  activeTab === tab.id
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_220px] lg:w-[520px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prompts, assets, agents..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === "overview" ? (
        <OverviewTab
          approvedToday={approvedToday}
          awaitingApproval={awaitingApproval}
          data={data}
          setActiveTab={setActiveTab}
        />
      ) : null}
      {activeTab === "context" ? <BusinessContextTab context={data.businessContext} /> : null}
      {activeTab === "sops" ? <SopsTab sops={filteredSops} /> : null}
      {activeTab === "sources" ? <DataSourcesTab sources={filteredSources} /> : null}
      {activeTab === "agents" ? <AgentsTab agents={filteredAgents} /> : null}
      {activeTab === "chains" ? <ChainsTab chains={filteredChains} /> : null}
      {activeTab === "verification" ? <VerificationTab checks={data.verificationChecks} outputs={data.outputs} /> : null}
      {activeTab === "review" ? <DailyReviewTab checks={data.verificationChecks} outputs={data.outputs} /> : null}
    </div>
  );
}

function getAiAssetsDataMode(data: AiAssetsCommandCenterData): {
  mode: DataMode;
  title: string;
  detail: string;
  items: string[];
} {
  const seedCounts = [
    ["Business context", data.businessContext.id],
    ...data.promptSops.map((item) => ["Prompt SOP", item.id] as const),
    ...data.dataSources.map((item) => ["Data source", item.id] as const),
    ...data.agentProfiles.map((item) => ["Agent profile", item.id] as const),
    ...data.promptChains.map((item) => ["Prompt chain", item.id] as const),
    ...data.verificationChecks.map((item) => ["Verification check", item.id] as const),
  ].filter(([, id]) => /^seed-|^virtual-/.test(String(id)));

  if (!data.schemaReady) {
    return {
      mode: "fallback",
      title: "AI Assets is using seed fallback data.",
      detail: "This page is operationally useful for governance, but the records shown are not fully persisted live assets until the AI Assets migration and credentials are active.",
      items: [
        `${seedCounts.length} seed or virtual assets visible`,
        data.migrationHint ?? "Apply the AI Assets migration before treating this as live source-of-truth data.",
      ],
    };
  }

  if (seedCounts.length > 0 || data.warnings.length > 0) {
    return {
      mode: "mixed",
      title: "AI Assets has live persistence with seeded gaps.",
      detail: "Supabase tables are reachable, but empty asset categories are being filled with safe seed records so operators can see the intended governance model.",
      items: [
        `${seedCounts.length} seed or virtual records filling missing categories`,
        `${data.warnings.length} warning${data.warnings.length === 1 ? "" : "s"} reported`,
      ],
    };
  }

  return {
    mode: "live",
    title: "AI Assets is backed by live persisted records.",
    detail: "Business context, SOPs, source examples, agent profiles, prompt chains, verification checks, outputs, and reviews are loading from the configured database.",
    items: [],
  };
}

function OverviewTab({
  approvedToday,
  awaitingApproval,
  data,
  setActiveTab,
}: {
  approvedToday: number;
  awaitingApproval: number;
  data: AiAssetsCommandCenterData;
  setActiveTab: (tab: TabId) => void;
}) {
  const readiness = getAssetsReadiness(data);
  return (
    <div className="space-y-5">
      <DailyAssetsActionCenter readiness={readiness} setActiveTab={setActiveTab} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Today's AI Review" icon={<ListChecks className="h-5 w-5" />} action={{ label: "Open review", onClick: () => setActiveTab("review") }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="Outputs created" value={data.outputs.length} />
          <MiniStat label="Awaiting approval" value={awaitingApproval} tone="amber" />
          <MiniStat label="Approved" value={approvedToday} tone="green" />
        </div>
        <div className="mt-4 space-y-3">
          {data.outputs.slice(0, 4).map((output) => (
            <OutputRow key={output.id} output={output} compact />
          ))}
        </div>
      </Panel>

      <Panel title="System Audit" icon={<ShieldCheck className="h-5 w-5" />}>
        <div className="space-y-3">
          {data.auditFindings.map((finding) => (
            <div key={finding} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {finding}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Reused Existing Systems" icon={<Layers3 className="h-5 w-5" />}>
        <div className="grid gap-3 md:grid-cols-2">
          {data.reusedSystems.map((system) => (
            <div key={system} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {system}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Quality Rule" icon={<Sparkles className="h-5 w-5" />}>
        <ol className="grid gap-3 text-sm text-slate-700">
          {[
            "Start with HomeReach business context.",
            "Use the correct reusable SOP prompt.",
            "Reference relevant data sources and winning examples.",
            "Collect clear required inputs.",
            "Run the verification checklist.",
            "Hold human approval when risk is high.",
          ].map((item, index) => (
            <li key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                {index + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
    </div>
  );
}

type AssetsReadiness = {
  score: number;
  label: string;
  blockers: string[];
  actions: Array<{ label: string; detail: string; tab: TabId }>;
};

function getAssetsReadiness(data: AiAssetsCommandCenterData): AssetsReadiness {
  const blockers: string[] = [];
  const actions: AssetsReadiness["actions"] = [];
  let score = 100;
  const needsApproval = data.outputs.filter((output) =>
    APPROVAL_PENDING_STATUSES.has(output.approvalStatus),
  ).length;
  const unverifiedOutputs = data.outputs.filter((output) => output.verificationStatus !== "verified").length;

  if (!data.schemaReady) {
    score -= 18;
    blockers.push("Persistence is using seed/fallback data.");
    actions.push({ label: "Apply AI Assets migration", detail: "Enable durable context, SOP, source, and review records.", tab: "overview" });
  }
  if (data.warnings.length > 0) {
    score -= Math.min(12, data.warnings.length * 4);
    blockers.push("One or more data reads returned warnings.");
  }
  if (!data.businessContext.companyOverview || !data.businessContext.humanApprovalRequirements) {
    score -= 12;
    blockers.push("Master business context or approval rules are incomplete.");
    actions.push({ label: "Update business context", detail: "Make the AI source of truth specific before scaling output.", tab: "context" });
  }
  if (data.promptSops.length < 8) {
    score -= 10;
    blockers.push("Prompt SOP coverage is still thin.");
    actions.push({ label: "Add winning SOPs", detail: "Save the prompts that repeatedly produce usable outputs.", tab: "sops" });
  }
  if (data.dataSources.filter((source) => source.status === "active").length < 8) {
    score -= 8;
    blockers.push("Reference assets need more real examples.");
    actions.push({ label: "Add best examples", detail: "Load winning DMs, emails, SMS, pitches, screenshots, and proposals.", tab: "sources" });
  }
  if (data.agentProfiles.filter((agent) => agent.status === "active").length < 8) {
    score -= 8;
    blockers.push("Some agent instruction profiles are missing or inactive.");
    actions.push({ label: "Review agent instructions", detail: "Confirm each agent has allowed actions, disallowed actions, and escalation rules.", tab: "agents" });
  }
  if (data.verificationChecks.length < 8) {
    score -= 12;
    blockers.push("Verification checklist coverage is incomplete.");
    actions.push({ label: "Review verification rules", detail: "Protect pricing, political, compliance, ROI, and public claims.", tab: "verification" });
  }
  if (needsApproval > 0) {
    score -= Math.min(10, needsApproval * 2);
    actions.unshift({ label: `Review ${needsApproval} AI output${needsApproval === 1 ? "" : "s"}`, detail: "Approve, reject, revise, or save the best output before it is used.", tab: "review" });
  }
  if (unverifiedOutputs > 0) {
    score -= Math.min(8, unverifiedOutputs * 2);
    blockers.push("Some outputs still need verification.");
  }

  const normalizedScore = Math.max(52, Math.min(100, Math.round(score)));
  const label =
    normalizedScore >= 92
      ? "Production ready"
      : normalizedScore >= 82
        ? "Ready with review gates"
        : "Needs owner review";

  return {
    score: normalizedScore,
    label,
    blockers: blockers.slice(0, 4),
    actions: actions.length
      ? actions.slice(0, 4)
      : [{ label: "Capture a winning output", detail: "Save the next approved draft as an SOP and data source.", tab: "review" }],
  };
}

function AssetsReadinessPanel({
  readiness,
  setActiveTab,
}: {
  readiness: AssetsReadiness;
  setActiveTab: (tab: TabId) => void;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[280px_1fr]">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Production readiness</p>
        <div className="mt-3 flex items-end gap-2">
          <p className="text-4xl font-black text-slate-950">{readiness.score}</p>
          <p className="pb-1 text-sm font-black text-slate-500">/100</p>
        </div>
        <p className="mt-2 text-sm font-black text-slate-700">{readiness.label}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={cn("h-full rounded-full", readiness.score >= 90 ? "bg-emerald-500" : readiness.score >= 80 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${readiness.score}%` }} />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Do today</p>
          <div className="mt-3 grid gap-2">
            {readiness.actions.map((action) => (
              <button
                key={`${action.label}-${action.tab}`}
                type="button"
                onClick={() => setActiveTab(action.tab)}
                className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
              >
                <p className="text-sm font-black text-slate-950">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{action.detail}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Approval lock</p>
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
            AI can draft, summarize, recommend, and organize. Human approval is still required before public copy,
            outbound messages, pricing, payments, political content, SAM.gov submissions, or procurement commitments.
          </div>
          {readiness.blockers.length > 0 ? (
            <div className="mt-3 space-y-2">
              {readiness.blockers.map((blocker) => (
                <p key={blocker} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-900">
                  {blocker}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DailyAssetsActionCenter({
  readiness,
  setActiveTab,
}: {
  readiness: AssetsReadiness;
  setActiveTab: (tab: TabId) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Daily AI asset control</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Keep the AI workforce sharp, safe, and useful.</h2>
        </div>
        <Badge tone={readiness.score >= 90 ? "green" : "amber"}>{readiness.label}</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readiness.actions.map((action) => (
          <button
            key={`daily-${action.label}-${action.tab}`}
            type="button"
            onClick={() => setActiveTab(action.tab)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-400 hover:bg-white"
          >
            <p className="text-sm font-black text-slate-950">{action.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function BusinessContextTab({ context }: { context: AiBusinessContext }) {
  const sections = [
    ["Company overview", context.companyOverview],
    ["Offers", context.offers],
    ["Pricing", context.pricing],
    ["Target customers", context.targetCustomers],
    ["Brand voice", context.brandVoice],
    ["Sales positioning", context.salesPositioning],
    ["Compliance rules", context.complianceRules],
    ["Political mail rules", context.politicalMailRules],
    ["Procurement dashboard rules", context.procurementDashboardRules],
    ["Shared postcard rules", context.sharedPostcardRules],
    ["Targeted campaign rules", context.targetedCampaignRules],
    ["SAM.gov rules", context.samGovRules],
    ["Human approval requirements", context.humanApprovalRequirements],
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <Panel title="Master Business Context" icon={<FileText className="h-5 w-5" />}>
        <div className="grid gap-3 md:grid-cols-2">
          {sections.map(([label, value]) => (
            <article key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-black text-slate-950">{label}</h3>
                <CopyButton value={`${label}\n\n${value}`} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
            </article>
          ))}
        </div>
      </Panel>
      <BusinessContextForm context={context} />
    </div>
  );
}

function SopsTab({ sops }: { sops: AiPromptSop[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="SOP / Prompt Repository" icon={<Library className="h-5 w-5" />}>
        <div className="grid gap-3">
          {sops.length === 0 ? (
            <LightEmptyState title="No SOPs match this view" body="Clear the filter or save a proven prompt SOP so the agents have a repeatable playbook." />
          ) : null}
          {sops.map((sop) => (
            <article key={sop.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{sop.category}</Badge>
                    <Badge tone={sop.status === "active" ? "green" : "neutral"}>{sop.status}</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-black text-slate-950">{sop.promptName}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{sop.purpose}</p>
                </div>
                <CardActions title={sop.promptName} content={sop.promptText} exportData={sop} />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <InfoBlock label="Required inputs" value={sop.requiredInputs.join(", ") || "Context, offer, workflow"} />
                <InfoBlock label="Output format" value={sop.outputFormat} />
                <InfoBlock label="Approval" value={sop.approvalRequirement} />
              </div>
              <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                {sop.promptText}
              </pre>
            </article>
          ))}
        </div>
      </Panel>
      <PromptSopForm />
    </div>
  );
}

function DataSourcesTab({ sources }: { sources: AiDataSource[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="Data Sources" icon={<Database className="h-5 w-5" />}>
        <div className="grid gap-3 md:grid-cols-2">
          {sources.length === 0 ? (
            <LightEmptyState title="No sources match this view" body="Add winning examples, customer replies, screenshots, or pitch language for the agents to pattern match." />
          ) : null}
          {sources.map((source) => (
            <article key={source.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{source.category}</Badge>
                    <Badge tone="green">{source.qualityRating}/5 quality</Badge>
                  </div>
                  <h3 className="mt-3 font-black text-slate-950">{source.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{source.description}</p>
                </div>
                <CardActions title={source.title} content={source.content} exportData={source} />
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{source.content}</p>
              <TagList tags={source.tags} />
            </article>
          ))}
        </div>
      </Panel>
      <DataSourceForm />
    </div>
  );
}

function AgentsTab({ agents }: { agents: AiAgentProfile[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="AI Agent Instruction Layer" icon={<Bot className="h-5 w-5" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          {agents.length === 0 ? (
            <LightEmptyState title="No agent profiles match this view" body="Create or reactivate an agent profile before assigning high-value AI workflows." />
          ) : null}
          {agents.map((agent) => (
            <article key={agent.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="blue">{agent.status}</Badge>
                  <h3 className="mt-3 text-lg font-black text-slate-950">{agent.agentName}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{agent.mission}</p>
                </div>
                <CardActions title={agent.agentName} content={agent.mission} exportData={agent} />
              </div>
              <div className="mt-4 grid gap-3">
                <InfoBlock label="Allowed" value={agent.allowedActions.join(", ")} />
                <InfoBlock label="Disallowed" value={agent.disallowedActions.join(", ")} tone="red" />
                <InfoBlock label="Approval rules" value={agent.approvalRules} />
                <InfoBlock label="Tone" value={agent.toneRules} />
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <AgentProfileForm />
    </div>
  );
}

function ChainsTab({ chains }: { chains: AiPromptChain[] }) {
  return (
    <Panel title="Prompt Chain Builder" icon={<Workflow className="h-5 w-5" />}>
      <div className="grid gap-4">
        {chains.length === 0 ? (
          <LightEmptyState title="No prompt chains match this view" body="Clear the search or build the next repeatable workflow chain for offers, political, procurement, SAM.gov, or shared postcards." />
        ) : null}
        {chains.map((chain) => (
          <article key={chain.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{chain.category}</Badge>
                  <Badge tone={chain.runStatus === "blocked" ? "red" : chain.runStatus === "waiting_approval" ? "amber" : "green"}>
                    {chain.runStatus.replaceAll("_", " ")}
                  </Badge>
                </div>
                <h3 className="mt-3 text-xl font-black text-slate-950">{chain.chainName}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{chain.purpose}</p>
              </div>
              <CardActions title={chain.chainName} content={chain.steps.map((step) => `${step.stepOrder}. ${step.stepName}: ${step.outputSummary}`).join("\n")} exportData={chain} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {chain.steps.map((step) => (
                <div key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                      {step.stepOrder}
                    </span>
                    <Badge tone={step.approvalRequired ? "amber" : "neutral"}>
                      {step.approvalRequired ? "approval" : "draft"}
                    </Badge>
                  </div>
                  <h4 className="mt-3 font-black text-slate-950">{step.stepName}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.outputSummary}</p>
                  <TagList tags={step.requiredInputs} />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function VerificationTab({ checks, outputs }: { checks: AiVerificationCheck[]; outputs: AiOutput[] }) {
  const outputChecks = checks.filter((check) => check.outputId);
  const globalChecks = checks.filter((check) => !check.outputId);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Mandatory Verification Checklist" icon={<ShieldCheck className="h-5 w-5" />}>
        <div className="grid gap-3">
          {globalChecks.map((check) => (
            <VerificationCheckRow key={check.id} check={check} />
          ))}
        </div>
      </Panel>
      <Panel title="Output Verification Status" icon={<ListChecks className="h-5 w-5" />}>
        <div className="space-y-3">
          {outputs.map((output) => {
            const related = outputChecks.filter((check) => check.outputId === output.id);
            return (
              <article key={output.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-black text-slate-950">{output.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{output.agentName ?? "HomeReach AI"} / {output.workflow ?? "General"}</p>
                  </div>
                  <Badge tone={output.verificationStatus === "verified" ? "green" : "amber"}>{output.verificationStatus}</Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {(related.length ? related : globalChecks.slice(0, 4)).map((check) => (
                    <VerificationCheckRow key={`${output.id}-${check.id}`} check={check} compact />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function DailyReviewTab({ checks, outputs }: { checks: AiVerificationCheck[]; outputs: AiOutput[] }) {
  const sortedOutputs = [...outputs].sort((a, b) => {
    const aPending = APPROVAL_PENDING_STATUSES.has(a.approvalStatus) ? 0 : 1;
    const bPending = APPROVAL_PENDING_STATUSES.has(b.approvalStatus) ? 0 : 1;
    return aPending - bPending || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="Daily AI Output Review" icon={<ListChecks className="h-5 w-5" />}>
        <div className="grid gap-3">
          <ApprovalLockNote>
            Approval updates the reusable AI artifact record only. Public copy, outbound messages, political creative,
            SAM.gov submissions, pricing, payments, campaign changes, and procurement commitments still require the proper owner approval step.
          </ApprovalLockNote>
          {outputs.length === 0 ? (
            <LightEmptyState title="No outputs to review" body="When agents create drafts, this becomes the owner approval queue before anything is used publicly or sent outbound." />
          ) : null}
          {sortedOutputs.map((output) => {
            const outputChecks = checks.filter((check) => check.outputId === output.id);
            return <OutputRow key={output.id} output={output} verificationChecks={outputChecks} />;
          })}
        </div>
      </Panel>
      <AiOutputForm />
    </div>
  );
}

function OutputRow({
  compact = false,
  output,
  verificationChecks = [],
}: {
  compact?: boolean;
  output: AiOutput;
  verificationChecks?: AiVerificationCheck[];
}) {
  const requiredChecks = verificationChecks.filter((check) => check.required);
  const verifiedCount = requiredChecks.filter((check) => check.status === "verified").length;
  const expectedCount = requiredChecks.length || 12;
  const ready = output.verificationStatus === "verified" || (requiredChecks.length > 0 && verifiedCount === requiredChecks.length);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={output.approvalStatus === "approved" ? "green" : output.approvalStatus === "rejected" ? "red" : "amber"}>
              {output.approvalStatus.replaceAll("_", " ")}
            </Badge>
            <Badge tone={output.verificationStatus === "verified" ? "green" : "neutral"}>{output.verificationStatus}</Badge>
            {output.winningOutput ? <Badge tone="blue">winning</Badge> : null}
          </div>
          <h3 className="mt-3 font-black text-slate-950">{output.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {output.agentName ?? "HomeReach AI"} / {output.workflow ?? "General"} / {output.outputType}
          </p>
        </div>
        <CardActions title={output.title} content={output.content} exportData={output} />
      </div>
      {!compact ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{output.content}</p> : null}
      {!compact ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">
                Artifact verification
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-950">
                Approving records the required artifact checks for this reusable AI output only. Sending, publishing, pricing, payments, political creative, SAM.gov, campaign changes, and procurement spend remain separately gated.
              </p>
            </div>
            <Badge tone={ready ? "green" : "amber"}>
              {ready ? "verified" : `${verifiedCount}/${expectedCount} verified`}
            </Badge>
          </div>
          {requiredChecks.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {requiredChecks.slice(0, 6).map((check) => (
                <span
                  key={check.id}
                  className={cn(
                    "rounded-full border px-2 py-1 text-[10px] font-black",
                    check.status === "verified"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-white text-amber-800",
                  )}
                >
                  {check.label}
                </span>
              ))}
              {requiredChecks.length > 6 ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-500">
                  +{requiredChecks.length - 6} more
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!compact ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ApiActionButton action={{ action: "approve_output_artifact", id: output.id, reviewNotes: "Owner approved the artifact record only. Separate workflow approval is required before outbound, public, financial, purchasing, political, or SAM.gov use." }} label={output.approvalStatus === "approved" ? "Approved" : "Approve artifact"} />
          <ApiActionButton action={{ action: "update_output_status", id: output.id, status: "revision_needed", reviewNotes: "Needs revision from AI Assets Command Center." }} label="Request Revision" variant="secondary" />
          <ApiActionButton action={{ action: "update_output_status", id: output.id, status: "rejected", reviewNotes: "Rejected from AI Assets Command Center." }} label="Reject artifact" variant="danger" />
          <ApiActionButton action={{ action: "mark_winning_output", id: output.id }} label="Mark Winning" variant="secondary" />
          <ApiActionButton action={{ action: "save_output_as_sop", id: output.id }} label="Save as SOP" variant="secondary" />
          <ApiActionButton action={{ action: "add_output_to_data_sources", id: output.id }} label="Save Source" variant="secondary" />
        </div>
      ) : null}
    </article>
  );
}

function ApprovalLockNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <p className="font-black">Human approval lock</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function BusinessContextForm({ context }: { context: AiBusinessContext }) {
  const fields = [
    ["companyOverview", "Company overview"],
    ["offers", "Offers"],
    ["pricing", "Pricing"],
    ["targetCustomers", "Target customers"],
    ["brandVoice", "Brand voice"],
    ["salesPositioning", "Sales positioning"],
    ["complianceRules", "Compliance rules"],
    ["politicalMailRules", "Political mail rules"],
    ["procurementDashboardRules", "Procurement dashboard rules"],
    ["sharedPostcardRules", "Shared postcard rules"],
    ["targetedCampaignRules", "Targeted campaign rules"],
    ["samGovRules", "SAM.gov rules"],
    ["humanApprovalRequirements", "Human approval requirements"],
  ] as const;
  const [form, setForm] = useState<Record<string, string>>({
    id: context.id,
    title: context.title,
    category: context.category,
    tags: context.tags.join(", "),
    notes: context.notes ?? "",
    companyOverview: context.companyOverview,
    offers: context.offers,
    pricing: context.pricing,
    targetCustomers: context.targetCustomers,
    brandVoice: context.brandVoice,
    salesPositioning: context.salesPositioning,
    complianceRules: context.complianceRules,
    politicalMailRules: context.politicalMailRules,
    procurementDashboardRules: context.procurementDashboardRules,
    sharedPostcardRules: context.sharedPostcardRules,
    targetedCampaignRules: context.targetedCampaignRules,
    samGovRules: context.samGovRules,
    humanApprovalRequirements: context.humanApprovalRequirements,
  });

  return (
    <Panel title="Update Context" icon={<RefreshCcw className="h-5 w-5" />}>
      <AssetForm
        buttonLabel="Save business context"
        payload={{ action: "save_business_context", ...form }}
        onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
      >
        <TextInput label="Title" name="title" value={form.title ?? ""} />
        <TextInput label="Tags" name="tags" value={form.tags ?? ""} />
        {fields.map(([name, label]) => (
          <TextAreaInput key={name} label={label} name={name} value={form[name] ?? ""} rows={3} />
        ))}
      </AssetForm>
    </Panel>
  );
}

function PromptSopForm() {
  const [form, setForm] = useState({
    promptName: "",
    category: "Email outreach",
    purpose: "",
    requiredInputs: "",
    promptText: "",
    outputFormat: "",
    approvalRequirement: "Human approval required before customer-facing, public, political, financial, procurement, legal, SAM.gov, or outbound use.",
    tags: "",
  });
  return (
    <Panel title="Add Prompt SOP" icon={<Plus className="h-5 w-5" />}>
      <AssetForm
        buttonLabel="Save SOP"
        payload={{ action: "create_prompt_sop", ...form }}
        onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
      >
        <TextInput label="Prompt name" name="promptName" value={form.promptName} />
        <TextInput label="Category" name="category" value={form.category} />
        <TextAreaInput label="Purpose" name="purpose" value={form.purpose} />
        <TextInput label="Required inputs" name="requiredInputs" value={form.requiredInputs} placeholder="city, offer, CTA" />
        <TextAreaInput label="Prompt text" name="promptText" value={form.promptText} rows={6} />
        <TextAreaInput label="Output format" name="outputFormat" value={form.outputFormat} />
        <TextAreaInput label="Approval requirement" name="approvalRequirement" value={form.approvalRequirement} />
        <TextInput label="Tags" name="tags" value={form.tags} />
      </AssetForm>
    </Panel>
  );
}

function DataSourceForm() {
  const [form, setForm] = useState({
    title: "",
    category: "Prior winning prompts",
    description: "",
    content: "",
    tags: "",
    relatedWorkflow: "",
    relatedOffer: "",
    qualityRating: "4",
  });
  return (
    <Panel title="Add Data Source" icon={<Plus className="h-5 w-5" />}>
      <AssetForm
        buttonLabel="Save source"
        payload={{ action: "create_data_source", ...form }}
        onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
      >
        <TextInput label="Title" name="title" value={form.title} />
        <TextInput label="Category" name="category" value={form.category} />
        <TextAreaInput label="Description" name="description" value={form.description} />
        <TextAreaInput label="File/text content" name="content" value={form.content} rows={6} />
        <TextInput label="Tags" name="tags" value={form.tags} />
        <TextInput label="Related workflow" name="relatedWorkflow" value={form.relatedWorkflow} />
        <TextInput label="Related offer" name="relatedOffer" value={form.relatedOffer} />
        <TextInput label="Quality rating" name="qualityRating" value={form.qualityRating} />
      </AssetForm>
    </Panel>
  );
}

function AgentProfileForm() {
  const [form, setForm] = useState({
    agentName: "",
    mission: "",
    allowedActions: "",
    disallowedActions: "",
    requiredDataSources: "HomeReach Master Business Context",
    requiredPromptSops: "",
    approvalRules: "Human approval required before customer-facing, public, political, financial, procurement, legal, SAM.gov, or outbound use.",
    complianceRules: "",
    escalationRules: "",
    outputFormat: "",
    toneRules: "Premium, clear, human, concise.",
    successMetrics: "",
  });
  return (
    <Panel title="Add Agent Profile" icon={<Plus className="h-5 w-5" />}>
      <AssetForm
        buttonLabel="Save agent"
        payload={{ action: "create_agent_profile", ...form }}
        onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
      >
        <TextInput label="Agent name" name="agentName" value={form.agentName} />
        <TextAreaInput label="Mission" name="mission" value={form.mission} />
        <TextInput label="Allowed actions" name="allowedActions" value={form.allowedActions} />
        <TextInput label="Disallowed actions" name="disallowedActions" value={form.disallowedActions} />
        <TextInput label="Required data sources" name="requiredDataSources" value={form.requiredDataSources} />
        <TextInput label="Required SOPs" name="requiredPromptSops" value={form.requiredPromptSops} />
        <TextAreaInput label="Approval rules" name="approvalRules" value={form.approvalRules} />
        <TextAreaInput label="Compliance rules" name="complianceRules" value={form.complianceRules} />
        <TextAreaInput label="Escalation rules" name="escalationRules" value={form.escalationRules} />
        <TextAreaInput label="Output format" name="outputFormat" value={form.outputFormat} />
        <TextAreaInput label="Tone rules" name="toneRules" value={form.toneRules} />
        <TextInput label="Success metrics" name="successMetrics" value={form.successMetrics} />
      </AssetForm>
    </Panel>
  );
}

function AiOutputForm() {
  const [form, setForm] = useState({
    title: "",
    agentName: "Outreach Agent",
    workflow: "Shared Postcard Chain",
    outputType: "draft",
    content: "",
    dataSources: "",
    promptSopName: "",
    chainName: "",
    notes: "",
  });
  return (
    <Panel title="Add AI Output" icon={<Plus className="h-5 w-5" />}>
      <AssetForm
        buttonLabel="Queue for review"
        payload={{ action: "create_ai_output", ...form }}
        onFieldChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
      >
        <TextInput label="Title" name="title" value={form.title} />
        <TextInput label="Agent" name="agentName" value={form.agentName} />
        <TextInput label="Workflow" name="workflow" value={form.workflow} />
        <TextInput label="Output type" name="outputType" value={form.outputType} />
        <TextAreaInput label="Output content" name="content" value={form.content} rows={7} />
        <TextInput label="Data sources referenced" name="dataSources" value={form.dataSources} />
        <TextInput label="Prompt SOP" name="promptSopName" value={form.promptSopName} />
        <TextInput label="Chain" name="chainName" value={form.chainName} />
        <TextAreaInput label="Notes" name="notes" value={form.notes} />
      </AssetForm>
    </Panel>
  );
}

function AssetForm({
  buttonLabel,
  children,
  onFieldChange,
  payload,
}: {
  buttonLabel: string;
  children: React.ReactNode;
  onFieldChange: (name: string, value: string) => void;
  payload: Record<string, unknown>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setMessage(null);
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/ai-assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(body.error ?? "Action failed."));
        return;
      }
      setMessage(String(body.message ?? "Saved."));
      startTransition(() => router.refresh());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3" onChange={(event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        onFieldChange(target.name, target.value);
      }
    }}>
      {children}
      <button
        type="button"
        onClick={submit}
        disabled={isSubmitting || isPending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {isSubmitting || isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        {isSubmitting || isPending ? "Saving..." : buttonLabel}
      </button>
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
    </div>
  );
}

function TextInput({
  label,
  name,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function TextAreaInput({
  label,
  name,
  rows = 3,
  value,
}: {
  label: string;
  name: string;
  rows?: number;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <textarea
        name={name}
        defaultValue={value}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function VerificationCheckRow({ check, compact = false }: { check: AiVerificationCheck; compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3", compact && "py-2")}>
      <div>
        <p className="text-sm font-black text-slate-950">{check.label}</p>
        {!compact ? <p className="mt-1 text-xs text-slate-500">{check.category} / {check.required ? "Required" : "Optional"}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={check.status === "verified" ? "green" : check.status === "failed" ? "red" : "amber"}>{check.status.replaceAll("_", " ")}</Badge>
        {check.outputId ? <ApiActionButton compact action={{ action: "update_verification_check", id: check.id, status: "verified" }} label="Verify" variant="secondary" /> : null}
      </div>
    </div>
  );
}

function ApiActionButton({
  action,
  compact = false,
  label,
  variant = "primary",
}: {
  action: Record<string, unknown>;
  compact?: boolean;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/ai-assets/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(body.error ?? "Action failed."));
        return;
      }
      setMessage(String(body.message ?? "Saved."));
      startTransition(() => router.refresh());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const className =
    variant === "danger"
      ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
      : variant === "secondary"
        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        : "border-slate-950 bg-slate-950 text-white hover:bg-slate-800";

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={isSubmitting || isPending}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition disabled:opacity-60",
          compact ? "min-h-8" : "min-h-10",
          className,
        )}
      >
        {isSubmitting || isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting || isPending ? "Working" : label}
      </button>
      {message ? <span className="text-xs font-semibold text-emerald-700">{message}</span> : null}
      {error ? <span className="text-xs font-semibold text-red-700">{error}</span> : null}
    </span>
  );
}

function CardActions({
  content,
  exportData,
  title,
}: {
  content: string;
  exportData: unknown;
  title: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <CopyButton value={content} />
      <ExportButton data={exportData} filename={`${slugify(title)}.json`} />
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
    >
      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
      {copied ? "Copied" : "Copy text"}
    </button>
  );
}

function ExportButton({ data, filename }: { data: unknown; filename: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      Export JSON
    </button>
  );
}

function Panel({
  action,
  children,
  icon,
  title,
}: {
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">{icon}</span>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
        </div>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  detail,
  label,
  tone = "blue",
  value,
}: {
  detail: string;
  label: string;
  tone?: "blue" | "amber";
  value: number;
}) {
  return (
    <div className={cn("rounded-lg border p-4", tone === "amber" ? "border-amber-300/30 bg-amber-300/10" : "border-sky-300/25 bg-sky-300/10")}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-300">{detail}</p>
    </div>
  );
}

function MiniStat({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "amber" | "green"; value: number }) {
  return (
    <div className={cn("rounded-lg border p-4", tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "green" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function LightEmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <Sparkles className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
      <p className="mt-2 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function InfoBlock({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "red"; value: string }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "red" ? "border-red-100 bg-red-50" : "border-slate-200 bg-slate-50")}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value || "Not set"}</p>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  const classes = {
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  }[tone];

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em]", classes)}>
      {children}
    </span>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tags.slice(0, 6).map((tag) => (
        <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
          {tag}
        </span>
      ))}
    </div>
  );
}

function filterItems<T>(
  items: T[],
  query: string,
  category: string,
  getSearchFields: (item: T) => string[],
): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    const itemCategory = "category" in (item as object) ? String((item as { category?: unknown }).category ?? "") : "";
    const categoryMatch = category === "all" || itemCategory === category;
    if (!categoryMatch) return false;
    if (!q) return true;
    return getSearchFields(item).join(" ").toLowerCase().includes(q);
  });
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-asset";
}
