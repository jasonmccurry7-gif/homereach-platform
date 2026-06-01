"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Filter,
  Layers3,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { AiOutput } from "@/lib/ai-assets/types";
import type { AiWorkforceCommandCenterData, WorkforceTask, WorkforceTaskStatus } from "@/lib/ai-workforce/types";
import { DataModeBanner, type DataMode } from "@/components/admin/data-mode-banner";
import { MiniAppExecutionButtons } from "@/components/agent-execution/mini-app-execution-buttons";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "tasks" | "agents" | "miniapps" | "outputs" | "chains" | "logs" | "audit";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Task Manifest" },
  { key: "agents", label: "Agent Workload" },
  { key: "miniapps", label: "Mini Apps" },
  { key: "outputs", label: "Approvals" },
  { key: "chains", label: "Prompt Chains" },
  { key: "logs", label: "Activity Log" },
  { key: "audit", label: "Audit" },
];

const WORKFLOWS = [
  "Daily Action Plan Chain",
  "Prospecting Chain",
  "Shared Postcard Chain",
  "Targeted Campaign Chain",
  "Outreach Chain",
  "Follow-Up Chain",
  "Political Campaign Chain",
  "Procurement/Supplyfy Chain",
  "Route Density Chain",
  "SAM.gov Chain",
  "Creative/Reels Chain",
  "QA Chain",
  "Revenue Integrity Chain",
  "SEO Authority Chain",
];

const AGENTS = [
  "Orchestrator Agent",
  "Prospecting Agent",
  "Research Agent",
  "Outreach Agent",
  "Follow-Up Agent",
  "Content Strategy Agent",
  "Creative Copy Agent",
  "Creative/Reels Agent",
  "Data / Revenue Agent",
  "Daily Action Plan Agent",
  "Political Campaign Agent",
  "Procurement Agent",
  "Procurement/Supplyfy Agent",
  "SAM.gov Contract Agent",
  "Design Brief Agent",
  "QA / System Health Agent",
  "Revenue Integrity Agent",
  "Technical SEO Agent",
  "Local SEO Authority Agent",
  "Content / Topic Cluster Agent",
  "Conversion SEO Agent",
  "SEO QA Agent",
];

const STATUS_LABELS: Record<WorkforceTaskStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In progress",
  blocked: "Blocked",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  needs_revision: "Needs revision",
  completed: "Completed",
  failed: "Failed",
};

const APPROVAL_PENDING_STATUSES = new Set(["draft", "needs_review", "revision_needed"]);
const SAVINGS_REVIEW_FILTER = "savings_reviews";

const DAILY_ACTION_TARGETS = [
  { label: "Targeted mail prospects", count: 5, agent: "Prospecting Agent", workflow: "Targeted Campaign Chain" },
  { label: "Supplyfy prospects", count: 5, agent: "Procurement/Supplyfy Agent", workflow: "Procurement/Supplyfy Chain" },
  { label: "Political prospects", count: 5, agent: "Political Campaign Agent", workflow: "Political Campaign Chain" },
  { label: "Follow-ups due", count: 5, agent: "Follow-Up Agent", workflow: "Follow-Up Chain" },
  { label: "Facebook authority posts", count: 1, agent: "Creative/Reels Agent", workflow: "Creative/Reels Chain" },
  { label: "Group posts", count: 1, agent: "Outreach Agent", workflow: "Outreach Chain" },
] as const;

const MINI_APP_BLUEPRINTS = [
  {
    id: "email-approval",
    title: "Email approval mini app",
    agent: "Outreach Agent",
    workflow: "Follow-Up Chain",
    purpose: "Approve, edit, archive, or queue one-to-one email drafts without sending automatically.",
    output: "Draft email, subject, risk notes, approval status, CRM next action.",
    risk: "Outbound communication",
  },
  {
    id: "sms-approval",
    title: "SMS approval mini app",
    agent: "Follow-Up Agent",
    workflow: "Follow-Up Chain",
    purpose: "Review follow-up text drafts with opt-out and opt-in constraints before any manual send.",
    output: "SMS draft, consent caveat, follow-up date, status update.",
    risk: "SMS compliance",
  },
  {
    id: "political-plan",
    title: "Political plan mini app",
    agent: "Political Campaign Agent",
    workflow: "Political Campaign Chain",
    purpose: "Review candidate profile, geography, geofence-first strategy, postcard support, costs, timeline, and package options.",
    output: "Approval-ready political plan with compliance notes and proposal export fields.",
    risk: "Political/compliance",
  },
  {
    id: "supplyfy-approval-cart",
    title: "Supplyfy approval-cart mini app",
    agent: "Procurement/Supplyfy Agent",
    workflow: "Procurement/Supplyfy Chain",
    purpose: "Compare supplier pricing, show estimated savings, recommend reorder, and prepare checkout handoff without committing spend.",
    output: "Supplier comparison, reorder recommendation, savings assumptions, owner approval checklist.",
    risk: "Procurement/spend",
  },
  {
    id: "route-density-review",
    title: "Route density mini app",
    agent: "Prospecting Agent",
    workflow: "Route Density Chain",
    purpose: "Review target route, map needs, cost assumptions, estimated lead opportunity, and next outreach draft.",
    output: "Route brief, cost notes, visual placeholder, follow-up draft, CRM task.",
    risk: "Revenue estimate",
  },
  {
    id: "sam-gov-bid-review",
    title: "SAM.gov bid review mini app",
    agent: "SAM.gov Contract Agent",
    workflow: "SAM.gov Chain",
    purpose: "Review opportunity, subcontractor match, bid/no-bid recommendation, missing requirements, and approval gates.",
    output: "Opportunity summary, fit score, risk list, bid/no-bid recommendation, owner decision.",
    risk: "GovCon/compliance",
  },
] as const;

export function AiWorkforceCommandCenter({ data }: { data: AiWorkforceCommandCenterData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const readiness = getWorkforceReadiness(data);
  const openSavingsReviewTasks = useMemo(() => {
    return data.tasks.filter(
      (task) => isSavingsReviewTask(task) && !["completed", "rejected"].includes(task.status),
    );
  }, [data.tasks]);

  const visibleTasks = useMemo(() => {
    return data.tasks.filter((task) => {
      const haystack = `${task.taskId} ${task.workflowName} ${task.assignedAgent} ${task.status} ${task.priority} ${task.expectedOutput} ${task.relatedClient ?? ""} ${task.relatedOpportunity ?? ""} ${JSON.stringify(task.inputData ?? {})}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === SAVINGS_REVIEW_FILTER && isSavingsReviewTask(task)) ||
        (filter === "needs_action" && ["blocked", "failed", "awaiting_approval", "needs_revision"].includes(task.status)) ||
        (filter === "human_required" && task.approvalRequired) ||
        task.status === filter ||
        task.priority === filter ||
        task.workflowName.toLowerCase().includes(filter);
      return matchesSearch && matchesFilter;
    });
  }, [data.tasks, filter, query]);

  const outputsAwaiting = data.outputs.filter((output) => APPROVAL_PENDING_STATUSES.has(output.approvalStatus));
  const ownerBrief = buildOwnerBrief(data, readiness, outputsAwaiting);
  const dataMode = getWorkforceDataMode(data);

  function openReadinessAction(action: WorkforceReadiness["actions"][number]) {
    setActiveTab(action.tab);
    if (action.filter) setFilter(action.filter);
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_34%),linear-gradient(135deg,#07111f,#0d1727_55%,#111827)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-sky-100">
              <Bot className="h-3.5 w-3.5" />
              AI Workforce Command Center
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              HomeReach AI-operated business command center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Coordinates agents, task manifests, approval queues, prompt chains, AI Assets, QA, revenue integrity,
              political mail, procurement, SAM.gov, outreach, and reporting in one approval-gated operating layer.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
            <Metric label="Active agents" value={data.summary.activeAgents} tone="sky" />
            <Metric label="In progress" value={data.summary.tasksInProgress} tone="emerald" />
            <Metric label="Needs approval" value={data.summary.awaitingApproval} tone="amber" />
            <Metric label="New reviews" value={openSavingsReviewTasks.length} tone={openSavingsReviewTasks.length ? "emerald" : "slate"} />
            <Metric label="Governed readiness" value={`${readiness.score}%`} tone={readiness.score >= 90 ? "emerald" : "amber"} />
            <Metric label="System alerts" value={data.summary.systemHealthAlerts} tone={data.summary.systemHealthAlerts ? "rose" : "slate"} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4">
          <DataModeBanner
            mode={dataMode.mode}
            title={dataMode.title}
            detail={dataMode.detail}
            items={dataMode.items}
          />
        </div>

        {!data.schemaReady && (
          <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">AI Workforce persistence is using fallback data.</p>
                <p className="mt-1 text-amber-100/80">{data.migrationHint}</p>
                {data.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-xs text-amber-100/70">{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <WorkforceReadinessPanel readiness={readiness} onActionSelect={openReadinessAction} />
        <WorkforceSourceOfTruthPanel data={data} />

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition",
                  activeTab === tab.key
                    ? "bg-white text-slate-950"
                    : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
              <Filter className="h-4 w-4" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="bg-transparent text-sm font-semibold outline-none"
              >
                <option className="bg-slate-950" value="all">All</option>
                <option className="bg-slate-950" value="needs_action">Needs action</option>
                <option className="bg-slate-950" value="human_required">Human required</option>
                <option className="bg-slate-950" value="awaiting_approval">Needs approval</option>
                <option className="bg-slate-950" value="blocked">Blocked</option>
                <option className="bg-slate-950" value="critical">Critical</option>
                <option className="bg-slate-950" value="political">Political</option>
                <option className="bg-slate-950" value="procurement">Procurement</option>
                <option className="bg-slate-950" value={SAVINGS_REVIEW_FILTER}>Savings reviews</option>
                <option className="bg-slate-950" value="sam.gov">SAM.gov</option>
                <option className="bg-slate-950" value="seo">SEO</option>
              </select>
            </label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks, agents, workflows..."
              className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 sm:w-72"
            />
          </div>
        </div>

        <section className="mb-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Owner handoff</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              Copy or export the current workforce state for review. This does not send, publish, submit, charge, change pricing, or commit spend.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton payload={ownerBrief} />
            <ExportButton
              filename="ai-workforce-owner-brief.json"
              payload={{ readiness, summary: data.summary, tasks: visibleTasks, outputsAwaiting }}
            />
          </div>
        </section>

        {activeTab === "overview" && (
          <div className="space-y-5">
            <DailyWorkforceActionCenter readiness={readiness} onActionSelect={openReadinessAction} />
            <DailyExecutionPlanPanel />
            <MiniAppFrameworkPanel compact />
            <SavingsReviewLane
              tasks={openSavingsReviewTasks}
              onViewAll={() => {
                setActiveTab("tasks");
                setFilter(SAVINGS_REVIEW_FILTER);
              }}
            />
            <QuickActions />
            <SummaryGrid data={data} />
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <Panel title="Today's AI task manifest" icon={ListChecks}>
                <TaskList tasks={visibleTasks.slice(0, 6)} compact />
              </Panel>
              <Panel title="Outputs awaiting approval" icon={ShieldCheck}>
                <OutputList outputs={outputsAwaiting.slice(0, 5)} />
              </Panel>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Create task" icon={Plus}>
              <TaskForm />
            </Panel>
            <Panel title="Central task manifest" icon={ListChecks}>
              <TaskList tasks={visibleTasks} />
            </Panel>
          </div>
        )}

        {activeTab === "agents" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.agents.length === 0 ? <EmptyState label="No agent profiles are visible yet. Add active profiles in AI Assets before assigning autonomous work." /> : null}
            {data.agents.map((agent) => {
              const tasks = data.tasks.filter((task) => task.assignedAgent === agent.agentName);
              const legacy = data.legacyAgents.find((item) => item.name === agent.agentName || item.role === agent.agentName);
              return (
                <AgentCard key={agent.id} agentName={agent.agentName} mission={agent.mission} tasks={tasks} active={agent.status === "active" || Boolean(legacy?.isActive)} />
              );
            })}
          </div>
        )}

        {activeTab === "miniapps" && (
          <div className="space-y-5">
            <MiniAppFrameworkPanel />
            <Panel title="Mini-app operating rules" icon={ShieldCheck}>
              <div className="grid gap-3 md:grid-cols-3">
                <InfoCard
                  label="Approval first"
                  detail="Every mini app creates review tasks or outputs. It does not send, publish, submit, buy, charge, change pricing, or change active campaigns."
                />
                <InfoCard
                  label="System of record"
                  detail="Use ai_workforce_tasks for task ownership, ai_outputs for generated artifacts, ai_output_reviews for approvals, and ai_workforce_activity_logs for the ledger."
                />
                <InfoCard
                  label="Fallback path"
                  detail="If an integration is unavailable, the mini app should offer copy/export/manual handoff instead of blocking the owner."
                />
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "outputs" && (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Create approval-gated output" icon={FileText}>
              <OutputForm tasks={data.tasks} />
            </Panel>
            <Panel title="Output review queue" icon={ShieldCheck}>
              <OutputList outputs={data.outputs} />
            </Panel>
          </div>
        )}

        {activeTab === "chains" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.promptChains.length === 0 ? <EmptyState label="No prompt chains are connected yet. Build chains in AI Assets before running repeatable workflows." /> : null}
            {data.promptChains.map((chain) => (
              <Panel key={chain.id} title={chain.chainName} icon={Workflow}>
                <p className="text-sm text-slate-300">{chain.purpose}</p>
                <div className="mt-4 space-y-2">
                  {chain.steps.map((step) => (
                    <div key={step.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">{step.stepOrder}. {step.stepName}</p>
                        <StatusBadge status={step.approvalRequired ? "awaiting_approval" : "assigned"} label={step.approvalRequired ? "Approval point" : "Internal"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{step.outputSummary}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        )}

        {activeTab === "logs" && (
          <Panel title="Daily AI activity log" icon={ClipboardCheck}>
            <div className="space-y-3">
              {data.logs.length === 0 ? <EmptyState label="No AI activity has been logged yet. Agent runs and approvals should appear here before scale." /> : null}
              {data.logs.map((log) => (
                <div key={log.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{log.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">{log.agentName ?? "System"} / {log.eventType} / {formatDate(log.createdAt)}</p>
                    </div>
                    <StatusBadge status={log.status === "failed" ? "failed" : log.approvalStatus === "needs_review" ? "awaiting_approval" : "completed"} label={log.approvalStatus} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {activeTab === "audit" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <InfoList title="What exists" items={data.auditSummary} />
            <InfoList title="Reused systems" items={data.reusedSystems} />
            <InfoList title="Do not touch" items={data.doNotTouch} />
          </div>
        )}
      </section>
    </main>
  );
}

function getWorkforceDataMode(data: AiWorkforceCommandCenterData): {
  mode: DataMode;
  title: string;
  detail: string;
  items: string[];
} {
  const seedTasks = data.tasks.filter((task) => task.id.startsWith("seed-")).length;
  const seedLogs = data.logs.filter((log) => log.id.startsWith("seed-")).length;
  const virtualAgents = data.agents.filter((agent) => agent.id.startsWith("virtual-")).length;

  if (!data.schemaReady) {
    return {
      mode: "fallback",
      title: "AI Workforce is using seed task and activity data.",
      detail: "Agent definitions remain governed by AGENTS.md and AI Assets, but task manifest and activity ledger persistence are not fully live in this runtime.",
      items: [
        `${seedTasks} seed task${seedTasks === 1 ? "" : "s"}`,
        `${seedLogs} seed log${seedLogs === 1 ? "" : "s"}`,
        data.migrationHint ?? "Apply the AI Workforce migration before treating this as the live task ledger.",
      ],
    };
  }

  if (seedTasks > 0 || seedLogs > 0 || virtualAgents > 0 || data.warnings.length > 0) {
    return {
      mode: "mixed",
      title: "AI Workforce is live with governance fill-ins.",
      detail: "The task manifest is loading from Supabase, while virtual AGENTS.md profiles or seed rows are filling missing operating roles.",
      items: [
        `${virtualAgents} virtual AGENTS.md profile${virtualAgents === 1 ? "" : "s"}`,
        `${data.warnings.length} warning${data.warnings.length === 1 ? "" : "s"}`,
      ],
    };
  }

  return {
    mode: "live",
    title: "AI Workforce task and activity data is live.",
    detail: "Agent tasks, activity logs, legacy telemetry, outputs, prompt chains, and approvals are loading from persisted sources.",
    items: [],
  };
}

type WorkforceReadiness = {
  score: number;
  label: string;
  blockers: string[];
  actions: Array<{ label: string; detail: string; tab: TabKey; filter?: string }>;
};

function getWorkforceReadiness(data: AiWorkforceCommandCenterData): WorkforceReadiness {
  const blockers: string[] = [];
  const actions: WorkforceReadiness["actions"] = [];
  let score = 100;
  const blockedTasks = data.tasks.filter((task) => ["blocked", "failed"].includes(task.status)).length;
  const revisionTasks = data.tasks.filter((task) => task.status === "needs_revision").length;
  const approvalTasks = data.tasks.filter((task) => task.status === "awaiting_approval").length;
  const savingsReviewTasks = data.tasks.filter(
    (task) => isSavingsReviewTask(task) && !["completed", "rejected"].includes(task.status),
  ).length;
  const unapprovedOutputs = data.outputs.filter((output) =>
    APPROVAL_PENDING_STATUSES.has(output.approvalStatus),
  ).length;

  if (!data.schemaReady) {
    score -= 18;
    blockers.push("Task manifest persistence is not confirmed.");
    actions.push({ label: "Apply workforce migration", detail: "Make tasks, logs, and approvals durable before scaling agent work.", tab: "audit" });
  }
  if (data.warnings.length > 0) {
    score -= Math.min(12, data.warnings.length * 4);
    blockers.push("Repository returned warnings while loading workforce data.");
  }
  if (blockedTasks > 0) {
    score -= Math.min(18, blockedTasks * 6);
    blockers.push(`${blockedTasks} task${blockedTasks === 1 ? "" : "s"} blocked or failed.`);
    actions.unshift({ label: `Clear ${blockedTasks} blocked task${blockedTasks === 1 ? "" : "s"}`, detail: "Review error notes and move only safe work forward.", tab: "tasks", filter: "needs_action" });
  }
  if (approvalTasks + unapprovedOutputs > 0) {
    score -= Math.min(14, (approvalTasks + unapprovedOutputs) * 2);
    actions.unshift({ label: `Review ${approvalTasks + unapprovedOutputs} approval item${approvalTasks + unapprovedOutputs === 1 ? "" : "s"}`, detail: "Approve, reject, or revise before anything becomes public, outbound, political, financial, or legal.", tab: "outputs" });
  }
  if (savingsReviewTasks > 0) {
    actions.unshift({
      label: `Work ${savingsReviewTasks} savings review${savingsReviewTasks === 1 ? "" : "s"}`,
      detail:
        "Qualify the intake, prepare a source-backed review agenda, and keep outreach approval-gated.",
      tab: "tasks",
      filter: SAVINGS_REVIEW_FILTER,
    });
  }
  if (revisionTasks > 0) {
    score -= Math.min(8, revisionTasks * 2);
    blockers.push(`${revisionTasks} task${revisionTasks === 1 ? "" : "s"} need revision.`);
  }
  if (data.agents.filter((agent) => agent.status === "active").length < 10) {
    score -= 8;
    blockers.push("Some required AGENTS.md profiles are not active in AI Assets.");
    actions.push({ label: "Review agent profiles", detail: "Confirm missions, allowed actions, disallowed actions, and escalation rules.", tab: "agents" });
  }
  if (data.promptChains.length < 6) {
    score -= 8;
    blockers.push("Prompt-chain coverage is incomplete.");
    actions.push({ label: "Inspect prompt chains", detail: "Confirm shared postcard, targeted, political, procurement, SAM.gov, QA, and revenue chains.", tab: "chains" });
  }
  if (data.logs.length === 0) {
    score -= 6;
    blockers.push("No workforce activity log entries are visible.");
    actions.push({ label: "Check activity log", detail: "Agent work should leave a clear ledger of what happened and why.", tab: "logs" });
  }

  const normalizedScore = Math.max(55, Math.min(100, Math.round(score)));
  const label =
    normalizedScore >= 92
      ? "Governed workflow ready"
      : normalizedScore >= 82
        ? "Operational with owner review"
        : "Needs hardening before scale";

  return {
    score: normalizedScore,
    label,
    blockers: blockers.slice(0, 4),
    actions: actions.length
      ? actions.slice(0, 4)
      : [{ label: "Create today's highest-value task", detail: "Assign QA, revenue integrity, outreach draft, or procurement review work.", tab: "tasks" }],
  };
}

function buildOwnerBrief(
  data: AiWorkforceCommandCenterData,
  readiness: WorkforceReadiness,
  outputsAwaiting: AiOutput[],
) {
  const lines = [
    "HomeReach AI Workforce Owner Brief",
    "",
    `Readiness: ${readiness.score}/100 - ${readiness.label}`,
    `Active agents: ${data.summary.activeAgents}`,
    `Tasks in progress: ${data.summary.tasksInProgress}`,
    `Open savings reviews: ${data.tasks.filter((task) => isSavingsReviewTask(task) && !["completed", "rejected"].includes(task.status)).length}`,
    `Approval items: ${data.summary.awaitingApproval}`,
    `System alerts: ${data.summary.systemHealthAlerts}`,
    "",
    "Approval lock:",
    "AI can draft, analyze, summarize, and prepare work. Human approval is required before sending, publishing, submitting, charging, changing pricing, changing campaigns, or committing spend.",
  ];

  if (readiness.blockers.length > 0) {
    lines.push("", "Blockers:");
    readiness.blockers.forEach((blocker) => lines.push(`- ${blocker}`));
  }

  if (readiness.actions.length > 0) {
    lines.push("", "Next actions:");
    readiness.actions.forEach((action) => lines.push(`- ${action.label}: ${action.detail}`));
  }

  if (outputsAwaiting.length > 0) {
    lines.push("", "Outputs awaiting owner review:");
    outputsAwaiting.slice(0, 8).forEach((output) => {
      lines.push(`- ${output.title} (${output.approvalStatus.replace(/_/g, " ")})`);
    });
  }

  const savingsReviewTasks = data.tasks.filter(
    (task) => isSavingsReviewTask(task) && !["completed", "rejected"].includes(task.status),
  );
  if (savingsReviewTasks.length > 0) {
    lines.push("", "Open procurement savings reviews:");
    savingsReviewTasks.slice(0, 8).forEach((task) => {
      const intake = getProcurementIntake(task);
      lines.push(
        `- ${task.relatedClient ?? task.taskId}: ${intake.businessType ?? "business type unknown"}, ${intake.monthlySupplySpend ?? "spend unknown"}, ${intake.biggestProcurementPain ?? "priority unknown"}`,
      );
    });
  }

  return lines.join("\n");
}

function WorkforceReadinessPanel({
  onActionSelect,
  readiness,
}: {
  onActionSelect: (action: WorkforceReadiness["actions"][number]) => void;
  readiness: WorkforceReadiness;
}) {
  return (
    <section className="mb-4 grid gap-4 rounded-xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20 lg:grid-cols-[280px_1fr]">
      <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Workforce readiness</p>
        <div className="mt-3 flex items-end gap-2">
          <p className="text-4xl font-black text-white">{readiness.score}</p>
          <p className="pb-1 text-sm font-black text-slate-500">/100</p>
        </div>
        <p className="mt-2 text-sm font-black text-slate-300">{readiness.label}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full rounded-full", readiness.score >= 90 ? "bg-emerald-400" : readiness.score >= 80 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${readiness.score}%` }} />
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
                onClick={() => onActionSelect(action)}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-sky-300/35 hover:bg-sky-300/10"
              >
                <p className="text-sm font-black text-white">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{action.detail}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Human approval lock</p>
          <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm leading-6 text-emerald-50">
            Agents may draft, analyze, summarize, and prepare work. They do not send, publish, submit, charge, change
            pricing, change campaigns, or commit spend without explicit owner approval.
          </div>
          {readiness.blockers.length > 0 ? (
            <div className="mt-3 space-y-2">
              {readiness.blockers.map((blocker) => (
                <p key={blocker} className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 text-xs font-semibold text-amber-100">
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

function DailyWorkforceActionCenter({
  onActionSelect,
  readiness,
}: {
  onActionSelect: (action: WorkforceReadiness["actions"][number]) => void;
  readiness: WorkforceReadiness;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0b1424] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Daily AI action center</p>
          <h2 className="mt-1 text-xl font-black text-white">What should the AI workforce help with next?</h2>
        </div>
        <StatusBadge status={readiness.score >= 90 ? "completed" : "awaiting_approval"} label={readiness.label} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readiness.actions.map((action) => (
          <button
            key={`daily-${action.label}-${action.tab}`}
            type="button"
            onClick={() => onActionSelect(action)}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            <p className="text-sm font-black text-white">{action.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{action.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function DailyExecutionPlanPanel() {
  const planPayload = {
    date: new Date().toISOString().slice(0, 10),
    targets: DAILY_ACTION_TARGETS,
    requiredDrafts: ["email", "sms", "facebook_dm", "facebook_post", "group_post"],
    approvalGate: "Human review required before every outbound, public, financial, procurement, political, or GovCon action.",
    revenueEstimate: "Directional only. Estimate should be updated from actual CRM, proposal, and payment data before use.",
  };

  return (
    <section className="rounded-xl border border-white/10 bg-[#0b1424] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Daily action center upgrade</p>
          <h2 className="mt-1 text-xl font-black text-white">Build today&apos;s owner action plan.</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Phase 1 creates the supervised task plan only: prospects, drafts, follow-ups, social prompts, completion tracking, and an exportable brief.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ApiButton
            label="Create daily plan task"
            icon={ListChecks}
            action={{
              action: "create_task",
              taskId: `WF-DAILY-${new Date().toISOString().slice(0, 10)}`,
              workflowName: "Daily Action Plan Chain",
              assignedAgent: "Daily Action Plan Agent",
              priority: "critical",
              expectedOutput:
                "Daily command brief with 5 targeted mail prospects, 5 Supplyfy prospects, 5 political prospects, recommended posts, email/SMS/DM drafts, follow-ups, checkboxes, revenue estimate, and Excel/export handoff. Do not send automatically.",
              inputPath: "ai-workforce/revenue-integrity",
              inputData: planPayload,
              dependencies: ["AI Assets SOPs", "Daily Outreach", "Revenue Operations", "CRM/revenue records"],
              approvalRequired: true,
            }}
          />
          <CopyButton payload={planPayload} />
          <ExportButton filename="daily-action-plan-blueprint.json" payload={planPayload} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {DAILY_ACTION_TARGETS.map((target) => (
          <div key={target.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <p className="text-2xl font-black text-white">{target.count}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{target.label}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{target.agent}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniAppFrameworkPanel({ compact = false }: { compact?: boolean }) {
  const blueprints = compact ? MINI_APP_BLUEPRINTS.slice(0, 3) : MINI_APP_BLUEPRINTS;

  return (
    <Panel title={compact ? "Mini-app approval foundation" : "Agent-native mini apps"} icon={Workflow}>
      <div className="space-y-4">
        <ApprovalLockNote compact>
          Mini apps are review workflows. They can create tasks, drafts, notes, exports, and approval records. They cannot perform irreversible external actions.
        </ApprovalLockNote>
        <div className="grid gap-3 lg:grid-cols-2">
          {blueprints.map((app) => {
            const payload = {
              miniAppId: app.id,
              purpose: app.purpose,
              output: app.output,
              risk: app.risk,
              approvalGate: "Human approval required before external action.",
            };
            return (
              <div key={app.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">{app.title}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{app.workflow} / {app.agent}</p>
                  </div>
                  <StatusBadge status="awaiting_approval" label={app.risk} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{app.purpose}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Output: {app.output}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ApiButton
                    small
                    label="Create review task"
                    icon={Plus}
                    action={{
                      action: "create_task",
                      workflowName: app.workflow,
                      assignedAgent: app.agent,
                      priority: app.risk.includes("compliance") || app.risk.includes("Political") ? "critical" : "high",
                      expectedOutput: `${app.title}: ${app.output}. Keep as approval-gated mini-app review. No external action.`,
                      inputPath: `ai-workforce/mini-apps/${app.id}`,
                      inputData: payload,
                      dependencies: ["AI Assets SOPs", "human approval gate", "audit ledger"],
                      approvalRequired: true,
                    }}
                  />
                  <ApiButton
                    small
                    label="Queue draft"
                    icon={FileText}
                    variant="secondary"
                    action={{
                      action: "create_output",
                      agentName: app.agent,
                      workflow: app.workflow,
                      title: `${app.title} draft`,
                      content: `${app.purpose}\n\nRequired output:\n${app.output}\n\nApproval gate:\nHuman review required before any send, publish, submit, checkout, pricing, campaign, or spend action.`,
                      outputType: "mini_app_blueprint",
                    }}
                  />
                  <CopyButton payload={payload} small />
                  <ExportButton filename={`${app.id}-mini-app.json`} payload={payload} small />
                </div>
                <MiniAppExecutionButtons
                  miniAppId={app.id}
                  miniAppTitle={app.title}
                  sourceAgent={app.agent}
                  taskType={`mini_app_${app.id}`}
                  targetSystem={targetSystemForMiniApp(app.id)}
                  targetUrl={targetUrlForMiniApp(app.id)}
                />
              </div>
            );
          })}
        </div>
        {compact ? (
          <p className="text-xs leading-5 text-slate-500">
            Open the Mini Apps tab for all approval workflow blueprints.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function targetSystemForMiniApp(miniAppId: string) {
  if (miniAppId === "email-approval") return "Gmail";
  if (miniAppId === "sms-approval") return "Twilio";
  if (miniAppId === "political-plan") return "HomeReach Admin";
  if (miniAppId === "supplyfy-approval-cart") return "supplier websites";
  if (miniAppId === "sam-gov-bid-review") return "SAM.gov";
  return "HomeReach Admin";
}

function targetUrlForMiniApp(miniAppId: string) {
  if (miniAppId === "email-approval") return "/admin/revenue-operations";
  if (miniAppId === "sms-approval") return "/admin/revenue-operations";
  if (miniAppId === "political-plan") return "/admin/political";
  if (miniAppId === "supplyfy-approval-cart") return "/admin/procurement";
  if (miniAppId === "sam-gov-bid-review") return "/admin/gov-contracts";
  if (miniAppId === "route-density-review") return "/admin/targeted-campaigns";
  return "/admin/agents";
}

function WorkforceSourceOfTruthPanel({ data }: { data: AiWorkforceCommandCenterData }) {
  const rows = [
    {
      label: "AI Assets",
      href: "/admin/ai-assets",
      status: data.dataSources.length > 0 && data.promptSops.length > 0 ? "completed" : "awaiting_approval",
      value: `${data.dataSources.length} sources`,
      detail: "Business context, SOPs, source examples, prompt chains, verification checks, outputs, and reviews stay in AI Assets.",
    },
    {
      label: "Task manifest",
      href: "/admin/agents",
      status: data.schemaReady ? "completed" : "awaiting_approval",
      value: `${data.tasks.length} tasks`,
      detail: data.schemaReady
        ? "ai_workforce_tasks is the durable task manifest for agent assignments and owner-visible next actions."
        : "Using safe fallback tasks until the AI Workforce migration is available in this environment.",
    },
    {
      label: "Activity ledger",
      href: "/admin/agents",
      status: data.logs.length > 0 ? "completed" : data.schemaReady ? "awaiting_approval" : "blocked",
      value: `${data.logs.length} logs`,
      detail: "ai_workforce_activity_logs should record agent work, blocked states, approvals, and final handoffs before scale.",
    },
    {
      label: "Output reviews",
      href: "/admin/agents",
      status: data.outputs.length > 0 ? "completed" : "awaiting_approval",
      value: `${data.outputs.length} artifacts`,
      detail: "ai_outputs and ai_output_reviews remain the reusable approval layer. Approval here is still not permission to send or publish.",
    },
  ];

  return (
    <section className="mb-4 rounded-xl border border-white/10 bg-[#0b1424] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">System of record</p>
          <h2 className="mt-1 text-xl font-black text-white">One workforce layer, existing records underneath.</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            This page coordinates agent work. It does not replace AI Assets, campaign records, communications, procurement,
            political tools, SAM.gov workflows, Stripe, or protected admin modules.
          </p>
        </div>
        <StatusBadge
          status={data.schemaReady && data.warnings.length === 0 ? "completed" : data.schemaReady ? "awaiting_approval" : "blocked"}
          label={data.schemaReady ? "Persistent data" : "Fallback data"}
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <Link key={row.label} href={row.href} className="rounded-lg border border-white/10 bg-white/[0.035] p-4 transition hover:border-sky-300/35 hover:bg-sky-300/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-white">{row.label}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{row.value}</p>
              </div>
              <StatusBadge status={row.status} label={row.status === "completed" ? "Connected" : row.status === "blocked" ? "Blocked" : "Needs setup"} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{row.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SummaryGrid({ data }: { data: AiWorkforceCommandCenterData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Outreach drafts ready" value={data.summary.outreachDraftsReady} tone="sky" />
      <Metric label="Political plans" value={data.summary.politicalPlansReady} tone="amber" />
      <Metric label="Procurement analyses" value={data.summary.procurementAnalysesReady} tone="emerald" />
      <Metric label="SAM.gov reviews" value={data.summary.samReviewsReady} tone="rose" />
      <Metric label="QA issues" value={data.summary.qaIssues} tone={data.summary.qaIssues ? "rose" : "slate"} />
      <Metric label="Revenue opportunities" value={data.summary.revenueOpportunities} tone="emerald" />
      <Metric label="Completed today" value={data.summary.completedToday} tone="sky" />
      <Metric label="Prompt chains" value={data.promptChains.length} tone="slate" />
    </div>
  );
}

function QuickActions() {
  const presets = [
    { label: "Run QA review", workflowName: "QA Chain", assignedAgent: "QA / System Health Agent", expectedOutput: "Route/form/CTA/payment/mobile issue report. No destructive changes.", priority: "high" },
    { label: "Draft follow-up", workflowName: "Revenue Integrity Chain", assignedAgent: "Revenue Integrity Agent", expectedOutput: "Approval-gated recovery follow-up draft and next action. Do not send.", priority: "high" },
    { label: "Draft proposal", workflowName: "Targeted Campaign Chain", assignedAgent: "Creative Copy Agent", expectedOutput: "Proposal draft with pricing and approval checklist. Do not publish or send.", priority: "high" },
    { label: "Draft campaign plan", workflowName: "Political Campaign Chain", assignedAgent: "Political Campaign Agent", expectedOutput: "Neutral campaign mail plan with compliance notes. Approval required before political use.", priority: "critical" },
    { label: "Audit SEO path", workflowName: "SEO Authority Chain", assignedAgent: "Technical SEO Agent", expectedOutput: "Review-ready SEO audit with route evidence, connector caveats, source support, and approval status. Do not publish changes.", priority: "high" },
  ];
  return (
    <section className="rounded-xl border border-white/10 bg-[#0b1424] p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-black text-white">Safe quick starts</p>
        <p className="text-xs font-semibold text-slate-500">Creates draft/review tasks only. Nothing sends, posts, submits, or charges.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {presets.map((preset) => (
          <ApiButton
            key={preset.label}
            label={preset.label}
            icon={Play}
            action={{
              action: "create_task",
              workflowName: preset.workflowName,
              assignedAgent: preset.assignedAgent,
              expectedOutput: preset.expectedOutput,
              priority: preset.priority,
              approvalRequired: true,
              inputPath: `ai-workforce/${preset.workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            }}
          />
        ))}
      </div>
    </section>
  );
}

function TaskForm() {
  const [workflowName, setWorkflowName] = useState<string>(WORKFLOWS[0] ?? "Shared Postcard Chain");
  const [assignedAgent, setAssignedAgent] = useState<string>(AGENTS[0] ?? "Orchestrator Agent");
  const [priority, setPriority] = useState("high");
  const [expectedOutput, setExpectedOutput] = useState("");
  return (
    <div className="space-y-3">
      <ApprovalLockNote compact>
        New tasks are created as draft/review work. They do not trigger outreach, publishing, pricing changes, purchases, payments, or bid submission.
      </ApprovalLockNote>
      <Select label="Workflow" value={workflowName} setValue={setWorkflowName} options={WORKFLOWS} />
      <Select label="Assigned agent" value={assignedAgent} setValue={setAssignedAgent} options={AGENTS} />
      <Select label="Priority" value={priority} setValue={setPriority} options={["low", "medium", "high", "critical"]} />
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Expected output</span>
        <textarea
          value={expectedOutput}
          onChange={(event) => setExpectedOutput(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none placeholder:text-slate-500"
          placeholder="Describe what this agent should produce..."
        />
      </label>
      <ApiButton
        label="Create task"
        icon={Plus}
        action={{
          action: "create_task",
          workflowName,
          assignedAgent,
          priority,
          expectedOutput: expectedOutput || "Approval-gated AI workforce output.",
          inputPath: `ai-workforce/${workflowName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          approvalRequired: true,
        }}
      />
    </div>
  );
}

function OutputForm({ tasks }: { tasks: WorkforceTask[] }) {
  const [taskId, setTaskId] = useState(tasks[0]?.taskId ?? "");
  const [agentName, setAgentName] = useState<string>(AGENTS[0] ?? "Orchestrator Agent");
  const [workflow, setWorkflow] = useState<string>(WORKFLOWS[0] ?? "Shared Postcard Chain");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <div className="space-y-3">
      <ApprovalLockNote compact>
        Queueing an output creates a review artifact only. Owner approval is still required before any public, outbound, financial, legal, political, procurement, or SAM.gov use.
      </ApprovalLockNote>
      <Select label="Task" value={taskId} setValue={setTaskId} options={tasks.map((task) => task.taskId)} />
      <Select label="Agent" value={agentName} setValue={setAgentName} options={AGENTS} />
      <Select label="Workflow" value={workflow} setValue={setWorkflow} options={WORKFLOWS} />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
        placeholder="Output title"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="min-h-36 w-full rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none placeholder:text-slate-500"
        placeholder="Paste or draft the output to queue for review..."
      />
      <ApiButton
        label="Queue output for approval"
        icon={ShieldCheck}
        action={{ action: "create_output", taskId, agentName, workflow, title, content, outputType: "draft" }}
        disabled={!title || !content}
      />
    </div>
  );
}

function SavingsReviewLane({
  onViewAll,
  tasks,
}: {
  onViewAll: () => void;
  tasks: WorkforceTask[];
}) {
  const topTasks = tasks.slice(0, 4);

  return (
    <Panel title="New procurement savings reviews" icon={BadgeDollarSign}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-50">
              {tasks.length} open review{tasks.length === 1 ? "" : "s"} from public intake
            </p>
            <p className="mt-1 text-sm leading-6 text-emerald-50/80">
              These are approval-gated Procurement Agent tasks. Prepare the review, source the assumptions,
              and get owner approval before any outreach or savings claim.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-emerald-200/30 bg-emerald-300/15 px-3 py-2 text-sm font-black text-emerald-50 transition hover:bg-emerald-300/25"
          >
            View lane
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {topTasks.length === 0 ? (
          <EmptyState label="No open savings-review requests are waiting right now." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {topTasks.map((task) => {
              const intake = getProcurementIntake(task);
              return (
                <div key={task.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-white">{task.relatedClient ?? task.taskId}</p>
                    <StatusBadge status={task.status} label={STATUS_LABELS[task.status]} />
                    <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] font-black uppercase text-emerald-100">
                      {task.priority}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniStat label="Type" value={intake.businessType ?? "Unknown"} />
                    <MiniStat label="Spend" value={intake.monthlySupplySpend ?? "Unknown"} />
                    <MiniStat label="Priority" value={intake.biggestProcurementPain ?? "Unknown"} />
                    <MiniStat label="Due" value={task.dueDate ? formatShortDate(task.dueDate) : "ASAP"} />
                  </div>
                  {intake.primarySuppliers ? (
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      <span className="font-black text-slate-300">Suppliers:</span> {intake.primarySuppliers}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Approval required before contact, vendor recommendations, savings estimates, or spend commitments.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

function TaskList({ tasks, compact = false }: { tasks: WorkforceTask[]; compact?: boolean }) {
  if (tasks.length === 0) {
    return <EmptyState label="No tasks match this view." />;
  }
  return (
    <div className="space-y-3">
      {!compact ? (
        <ApprovalLockNote>
          Task status changes update the AI Workforce manifest and activity ledger only. They are not permission to send, publish, submit, charge, change pricing, change campaigns, or commit spend.
        </ApprovalLockNote>
      ) : null}
      {tasks.map((task) => (
        <div key={task.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-white">{task.taskId}</p>
                <StatusBadge status={task.status} label={STATUS_LABELS[task.status]} />
                <span className={cn("rounded-full px-2 py-1 text-[11px] font-black uppercase", task.priority === "critical" ? "bg-rose-400/15 text-rose-100" : task.priority === "high" ? "bg-amber-400/15 text-amber-100" : "bg-slate-400/15 text-slate-200")}>
                  {task.priority}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-200">{task.workflowName} / {task.assignedAgent}</p>
              {isSavingsReviewTask(task) ? (
                <ProcurementTaskSummary task={task} />
              ) : null}
              <p className="mt-1 text-sm text-slate-400">{task.expectedOutput}</p>
              {!compact && task.dependencies.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {task.dependencies.map((dependency) => (
                    <span key={dependency} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400">{dependency}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <ApiButton small label="Start task" action={{ action: "update_task_status", id: task.id, status: "in_progress", notes: "Started from AI Workforce Command Center." }} />
              <ApiButton small label="Approve task" action={{ action: "update_task_status", id: task.id, status: "approved", notes: "Approved for internal workflow progress only. Separate high-risk actions still require owner approval." }} />
              <ApiButton small label="Revise task" variant="secondary" action={{ action: "update_task_status", id: task.id, status: "needs_revision", notes: "Needs revision from AI Workforce Command Center." }} />
              <ApiButton small label="Complete task" variant="success" action={{ action: "update_task_status", id: task.id, status: "completed", notes: "Completed in the AI Workforce manifest. No outbound, public, financial, purchasing, or bid submission action was performed here." }} />
              <CopyButton payload={task} small />
              <ExportButton filename={`${task.taskId}.json`} payload={task} small />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProcurementTaskSummary({ task }: { task: WorkforceTask }) {
  const intake = getProcurementIntake(task);
  const rows = [
    ["Business", intake.businessType],
    ["Spend", intake.monthlySupplySpend],
    ["Priority", intake.biggestProcurementPain],
    ["Suppliers", intake.primarySuppliers],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-emerald-300/15 bg-emerald-300/10 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
        Savings review intake
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map(([label, value]) => (
          <span key={label} className="rounded-full border border-emerald-200/15 px-2 py-1 text-[11px] text-emerald-50/85">
            <span className="font-black text-emerald-50">{label}:</span> {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function OutputList({ outputs }: { outputs: AiOutput[] }) {
  if (outputs.length === 0) {
    return <EmptyState label="No AI outputs are waiting here yet." />;
  }
  return (
    <div className="space-y-3">
      <ApprovalLockNote>
        Approval marks the artifact reviewed inside AI Assets. Separate workflow approval is still required before sending, publishing, submitting, charging, changing pricing, changing campaigns, or committing spend.
      </ApprovalLockNote>
      {outputs.map((output) => (
        <div key={output.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-white">{output.title}</p>
                <StatusBadge status={output.approvalStatus === "approved" ? "approved" : output.approvalStatus === "rejected" ? "rejected" : output.approvalStatus === "revision_needed" ? "needs_revision" : "awaiting_approval"} label={output.approvalStatus.replace(/_/g, " ")} />
                {output.winningOutput && <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] font-black uppercase text-emerald-100">Winning</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{output.agentName ?? "AI Workforce"} / {output.workflow ?? "AI Workforce"} / {formatDate(output.createdAt)}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{output.content}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
              <ApiButton small label="Approve artifact" variant="success" action={{ action: "approve_output_artifact", id: output.id, reviewNotes: "Owner approved the artifact for review state only. Separate workflow approval is required before outbound, public, financial, purchasing, political, or SAM.gov use." }} />
              <ApiButton small label="Reject artifact" variant="danger" action={{ action: "update_output_status", id: output.id, status: "rejected", reviewNotes: "Rejected from AI Workforce Command Center." }} />
              <ApiButton small label="Request revision" variant="secondary" action={{ action: "update_output_status", id: output.id, status: "revision_needed", reviewNotes: "Revision requested from AI Workforce Command Center." }} />
              <ApiButton small label="Mark winning" action={{ action: "mark_winning_output", id: output.id }} />
              <ApiButton small label="Save as SOP" action={{ action: "save_output_as_sop", id: output.id }} />
              <ApiButton small label="Save source" action={{ action: "add_output_to_data_sources", id: output.id }} />
              <CopyButton payload={output.content} small />
              <ExportButton filename={`${slugify(output.title)}.json`} payload={output} small />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agentName, mission, tasks, active }: { agentName: string; mission: string; tasks: WorkforceTask[]; active: boolean }) {
  const waiting = tasks.filter((task) => task.status === "awaiting_approval").length;
  const blocked = tasks.filter((task) => task.status === "blocked" || task.status === "failed").length;
  return (
    <Panel title={agentName} icon={Bot}>
      <p className="text-sm leading-6 text-slate-300">{mission}</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniStat label="Active" value={active ? "Yes" : "No"} />
        <MiniStat label="Tasks" value={tasks.length} />
        <MiniStat label="Approval" value={waiting} />
        <MiniStat label="Blocked" value={blocked} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={active ? "completed" : "blocked"} label={active ? "Active profile" : "Needs review"} />
        <ApiButton small label="Assign task" action={{ action: "create_task", assignedAgent: agentName, workflowName: "Manual AI Workforce Task", expectedOutput: `${agentName} assigned follow-up task.`, priority: "medium", approvalRequired: true }} />
      </div>
    </Panel>
  );
}

function ApprovalLockNote({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-50",
        compact ? "p-3 text-xs leading-5" : "p-4 text-sm leading-6",
      )}
    >
      <p className="font-black">Human approval lock</p>
      <p className="mt-1 text-amber-50/85">{children}</p>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel title={title} icon={Layers3}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: JSX.Element | JSX.Element[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0b1424] p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-sky-300/10 p-2 text-sky-100">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-black text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "sky" | "emerald" | "amber" | "rose" | "slate" }) {
  const colors = {
    sky: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-100",
  };
  return (
    <div className={cn("rounded-lg border p-3", colors[tone])}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-2">
      <p className="text-sm font-black text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
    </div>
  );
}

function InfoCard({ detail, label }: { detail: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="text-sm font-black text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color =
    status === "approved" || status === "completed"
      ? "bg-emerald-400/15 text-emerald-100"
      : status === "rejected" || status === "failed" || status === "blocked"
        ? "bg-rose-400/15 text-rose-100"
        : status === "needs_revision" || status === "awaiting_approval"
          ? "bg-amber-400/15 text-amber-100"
          : "bg-slate-400/15 text-slate-200";
  return <span className={cn("rounded-full px-2 py-1 text-[11px] font-black uppercase", color)}>{label}</span>;
}

function Select({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
      >
        {options.length === 0 ? <option value="">No tasks available</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ApiButton({
  action,
  disabled = false,
  icon: Icon = RefreshCw,
  label,
  small = false,
  variant = "primary",
}: {
  action: Record<string, unknown>;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  small?: boolean;
  variant?: "primary" | "secondary" | "success" | "danger";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/ai-workforce/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(String(body.error ?? "Action failed"));
        return;
      }
      setMessage("Saved to ledger");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }
  const styles = {
    primary: "border-sky-300/30 bg-sky-400/15 text-sky-100 hover:bg-sky-300/25",
    secondary: "border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10",
    success: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-300/25",
    danger: "border-rose-300/30 bg-rose-400/15 text-rose-100 hover:bg-rose-300/25",
  };
  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || isSubmitting || isPending}
        onClick={run}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md border font-black transition disabled:cursor-not-allowed disabled:opacity-50",
          small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
          styles[variant],
        )}
      >
        <Icon className={cn(small ? "h-3.5 w-3.5" : "h-4 w-4", (isSubmitting || isPending) && "animate-spin")} />
        {isSubmitting || isPending ? "Working" : label}
      </button>
      {message && <span className="text-[10px] text-slate-500">{message}</span>}
    </div>
  );
}

function CopyButton({ payload, small = false }: { payload: unknown; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn("inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] font-black text-slate-200 transition hover:bg-white/10", small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm")}
    >
      <Copy className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {copied ? "Copied" : typeof payload === "string" ? "Copy text" : "Copy JSON"}
    </button>
  );
}

function ExportButton({ filename, payload, small = false }: { filename: string; payload: unknown; small?: boolean }) {
  function run() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={run}
      className={cn("inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] font-black text-slate-200 transition hover:bg-white/10", small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm")}
    >
      <Download className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
      Export JSON
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
      <Sparkles className="mx-auto mb-2 h-5 w-5" />
      {label}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function getProcurementIntake(task: WorkforceTask) {
  const inputData = readRecord(task.inputData);
  const intake = readRecord(inputData.procurementIntake);
  return {
    businessType: readString(intake.businessType),
    monthlySupplySpend: readString(intake.monthlySupplySpend),
    biggestProcurementPain: readString(intake.biggestProcurementPain),
    primarySuppliers: readString(intake.primarySuppliers),
  };
}

function isSavingsReviewTask(task: WorkforceTask) {
  const inputData = readRecord(task.inputData);
  return (
    task.relatedOpportunity === "procurement-savings-review" ||
    task.taskId.startsWith("WF-PROC-WAITLIST-") ||
    inputData.productIntent === "procurement-savings-review"
  );
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-output";
}
