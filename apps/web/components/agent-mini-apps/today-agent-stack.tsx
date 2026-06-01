"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ShieldAlert,
  TimerReset,
  Wrench,
} from "lucide-react";
import { MiniAppCard } from "./mini-app-card";
import type {
  AgentMiniApp,
  AgentMiniAppEvent,
  AgentMiniAppsData,
  MiniAppPriority,
  MiniAppRiskLevel,
  MiniAppStatus,
  MiniAppType,
} from "@/lib/agent-mini-apps/types";
import { cn } from "@/lib/utils";

type Filters = {
  miniAppType: string;
  status: string;
  priority: string;
  riskLevel: string;
  sourceAgent: string;
  assignedUser: string;
  dueDate: string;
  relatedModule: string;
};

const EMPTY_FILTERS: Filters = {
  miniAppType: "all",
  status: "all",
  priority: "all",
  riskLevel: "all",
  sourceAgent: "all",
  assignedUser: "all",
  dueDate: "all",
  relatedModule: "all",
};

const SECTION_ORDER = ["urgent", "needs_review", "scheduled", "completed", "failed"] as const;

export function TodayAgentStack({ data }: { data: AgentMiniAppsData }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const eventsByMiniApp = useMemo(() => {
    const map = new Map<string, AgentMiniAppEvent[]>();
    data.events.forEach((event) => {
      const events = map.get(event.miniAppId) ?? [];
      events.push(event);
      map.set(event.miniAppId, events);
    });
    return map;
  }, [data.events]);

  const options = useMemo(() => buildFilterOptions(data.miniApps), [data.miniApps]);

  const visibleMiniApps = useMemo(() => {
    return data.miniApps.filter((app) => matchesFilters(app, query, filters));
  }, [data.miniApps, filters, query]);

  const sections = useMemo(() => {
    const grouped: Record<(typeof SECTION_ORDER)[number], AgentMiniApp[]> = {
      urgent: [],
      needs_review: [],
      scheduled: [],
      completed: [],
      failed: [],
    };

    visibleMiniApps.forEach((app) => {
      if (app.status === "failed") grouped.failed.push(app);
      else if (app.status === "executed") grouped.completed.push(app);
      else if (app.status === "scheduled" || app.status === "sent_to_execution_queue") grouped.scheduled.push(app);
      else if (app.priority === "urgent" || Math.max(app.estimatedRevenue, app.estimatedSavings) >= 10000) grouped.urgent.push(app);
      else grouped.needs_review.push(app);
    });

    return grouped;
  }, [visibleMiniApps]);

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34%),linear-gradient(135deg,#07111f,#0c1728_54%,#121826)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-50">
                <Wrench className="h-3.5 w-3.5" />
                Agent Mini Apps
              </p>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Today&apos;s Agent Stack</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                One decision surface for agent-generated approvals, revenue opportunities, savings reviews, campaign plans, website builds, and future execution queue handoffs.
              </p>
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs font-semibold leading-5 text-amber-50 lg:max-w-md">
              Human approval remains required before sending, posting, buying, submitting bids, changing account settings, deleting records, exporting sensitive data, charging customers, or changing pricing.
            </div>
          </div>

          {!data.schemaReady || data.warnings.length > 0 ? (
            <div className="mt-5 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-50">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">{data.schemaReady ? "Mini Apps loaded with warnings" : "Mini Apps are in seed fallback mode"}</p>
                  {data.migrationHint ? <p className="mt-1 text-amber-50/80">{data.migrationHint}</p> : null}
                  {data.warnings.map((warning) => (
                    <p key={warning} className="mt-1 text-xs text-amber-50/75">{warning}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Pending approvals" value={data.summary.pendingApprovals} tone="amber" icon={ShieldAlert} />
            <Kpi label="Urgent items" value={data.summary.urgentItems} tone="rose" icon={TimerReset} />
            <Kpi label="Revenue awaiting approval" value={formatMoney(data.summary.estimatedRevenueAwaitingApproval)} tone="emerald" icon={Banknote} />
            <Kpi label="Savings awaiting approval" value={formatMoney(data.summary.estimatedSavingsAwaitingApproval)} tone="teal" icon={Banknote} />
            <Kpi label="Overdue tasks" value={data.summary.overdueTasks} tone="rose" icon={Clock} />
            <Kpi label="Completed today" value={data.summary.completedToday} tone="emerald" icon={CheckCircle2} />
            <Kpi label="Failed tasks" value={data.summary.failedTasks} tone="rose" icon={AlertTriangle} />
            <Kpi label="Manual takeover needed" value={data.summary.manualTakeoverNeeded} tone="amber" icon={Wrench} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, business, contact, campaign, recommended action..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <FilterSelect label="Type" value={filters.miniAppType} options={options.types} onChange={(value) => setFilters((current) => ({ ...current, miniAppType: value }))} />
              <FilterSelect label="Status" value={filters.status} options={options.statuses} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
              <FilterSelect label="Priority" value={filters.priority} options={options.priorities} onChange={(value) => setFilters((current) => ({ ...current, priority: value }))} />
              <FilterSelect label="Risk" value={filters.riskLevel} options={options.risks} onChange={(value) => setFilters((current) => ({ ...current, riskLevel: value }))} />
              <FilterSelect label="Agent" value={filters.sourceAgent} options={options.agents} onChange={(value) => setFilters((current) => ({ ...current, sourceAgent: value }))} />
              <FilterSelect label="Assigned" value={filters.assignedUser} options={options.assignedUsers} onChange={(value) => setFilters((current) => ({ ...current, assignedUser: value }))} />
              <FilterSelect label="Due" value={filters.dueDate} options={["today", "overdue", "future", "none"]} onChange={(value) => setFilters((current) => ({ ...current, dueDate: value }))} />
              <FilterSelect label="Module" value={filters.relatedModule} options={options.modules} onChange={(value) => setFilters((current) => ({ ...current, relatedModule: value }))} />
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilters(EMPTY_FILTERS);
                }}
                className="min-h-10 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {visibleMiniApps.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-10 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-200" />
            <p className="mt-3 text-lg font-black">No mini apps match this stack.</p>
            <p className="mt-2 text-sm text-slate-500">Clear filters or wait for agents to generate new approval-ready work.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <StackSection
              title="Urgent / High Value"
              description="Highest priority, highest money impact, or risk-sensitive decisions."
              miniApps={sections.urgent}
              eventsByMiniApp={eventsByMiniApp}
            />
            <StackSection
              title="Needs Review"
              description="Agent-created work waiting for approve, edit, reject, archive, or assignment."
              miniApps={sections.needs_review}
              eventsByMiniApp={eventsByMiniApp}
            />
            <StackSection
              title="Scheduled"
              description="Approved items scheduled or moved into the future execution queue."
              miniApps={sections.scheduled}
              eventsByMiniApp={eventsByMiniApp}
            />
            <StackSection
              title="Recently Completed"
              description="Items completed today or already executed manually."
              miniApps={sections.completed}
              eventsByMiniApp={eventsByMiniApp}
            />
            <StackSection
              title="Failed / Manual Takeover Needed"
              description="Failures and items that need a human to step in."
              miniApps={sections.failed}
              eventsByMiniApp={eventsByMiniApp}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function StackSection({
  description,
  eventsByMiniApp,
  miniApps,
  title,
}: {
  description: string;
  eventsByMiniApp: Map<string, AgentMiniAppEvent[]>;
  miniApps: AgentMiniApp[];
  title: string;
}) {
  if (miniApps.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-black text-slate-300">
          {miniApps.length} item{miniApps.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {miniApps.map((app) => (
          <MiniAppCard key={app.id} miniApp={app} events={eventsByMiniApp.get(app.id) ?? []} />
        ))}
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof ShieldAlert;
  label: string;
  tone: "amber" | "rose" | "emerald" | "teal";
  value: number | string;
}) {
  const styles = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    teal: "border-teal-300/20 bg-teal-300/10 text-teal-100",
  };
  return (
    <div className={cn("rounded-lg border p-3", styles[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-black">{value}</p>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] opacity-75">{label}</p>
        </div>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-slate-950/60 px-2">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-36 bg-transparent text-xs font-bold text-white outline-none"
      >
        <option className="bg-slate-950" value="all">All</option>
        {options.map((option) => (
          <option key={option} className="bg-slate-950" value={option}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildFilterOptions(miniApps: AgentMiniApp[]) {
  return {
    types: unique(miniApps.map((app) => app.miniAppType)),
    statuses: unique(miniApps.map((app) => app.status)),
    priorities: unique(miniApps.map((app) => app.priority)),
    risks: unique(miniApps.map((app) => app.riskLevel)),
    agents: unique(miniApps.map((app) => app.sourceAgent)),
    assignedUsers: unique(miniApps.map((app) => app.assignedUserId ?? "unassigned")),
    modules: unique(miniApps.map((app) => app.relatedModule)),
  };
}

function matchesFilters(app: AgentMiniApp, query: string, filters: Filters) {
  if (filters.status === "all" && (app.status === "archived" || app.status === "rejected")) {
    return false;
  }

  const payload = app.editedPayloadJson ?? app.payloadJson;
  const haystack = [
    app.title,
    app.description,
    app.sourceAgent,
    app.relatedModule,
    app.recommendedAction,
    payload.business_name,
    payload.recipient_name,
    payload.campaign_name,
    payload.candidate_name,
    payload.opportunity_title,
    payload.owner_name,
    payload.related_entity,
  ].join(" ").toLowerCase();

  const today = new Date().toISOString().slice(0, 10);
  const dueKey = app.dueAt ? app.dueAt.slice(0, 10) : null;
  const overdue = app.dueAt ? new Date(app.dueAt) < new Date() : false;
  const future = app.dueAt ? new Date(app.dueAt) >= new Date() : false;

  return (
    (!query || haystack.includes(query.toLowerCase())) &&
    (filters.miniAppType === "all" || app.miniAppType === filters.miniAppType as MiniAppType) &&
    (filters.status === "all" || app.status === filters.status as MiniAppStatus) &&
    (filters.priority === "all" || app.priority === filters.priority as MiniAppPriority) &&
    (filters.riskLevel === "all" || app.riskLevel === filters.riskLevel as MiniAppRiskLevel) &&
    (filters.sourceAgent === "all" || app.sourceAgent === filters.sourceAgent) &&
    (filters.assignedUser === "all" || (app.assignedUserId ?? "unassigned") === filters.assignedUser) &&
    (filters.relatedModule === "all" || app.relatedModule === filters.relatedModule) &&
    (filters.dueDate === "all" ||
      (filters.dueDate === "today" && dueKey === today) ||
      (filters.dueDate === "overdue" && overdue) ||
      (filters.dueDate === "future" && future) ||
      (filters.dueDate === "none" && !app.dueAt))
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function labelFor(value: string) {
  return value.replace(/_/g, " ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
