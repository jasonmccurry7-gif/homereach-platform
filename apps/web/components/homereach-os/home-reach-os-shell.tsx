"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  Globe2,
  Inbox,
  Layers3,
  LineChart,
  Mail,
  Map,
  MapPin,
  MessageSquare,
  MousePointer2,
  Network,
  Package,
  Phone,
  Radar,
  ReceiptText,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Truck,
  type LucideIcon,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  HomeReachOSData,
  HomeReachOSMode,
  OSAgent,
  OSActivity,
  OSMetric,
  OSNextBestAction,
  OSOpportunity,
  OSPipelineStage,
  OSStatus,
} from "@/lib/homereach-os/types";

const statusStyles: Record<OSStatus, { dot: string; text: string; ring: string; label: string }> = {
  online: {
    dot: "bg-emerald-400 shadow-emerald-400/70",
    text: "text-emerald-300",
    ring: "border-emerald-400/25 bg-emerald-400/10",
    label: "Online",
  },
  watch: {
    dot: "bg-amber-300 shadow-amber-300/70",
    text: "text-amber-200",
    ring: "border-amber-300/25 bg-amber-300/10",
    label: "Watch",
  },
  critical: {
    dot: "bg-rose-400 shadow-rose-400/70",
    text: "text-rose-200",
    ring: "border-rose-400/30 bg-rose-400/10",
    label: "Critical",
  },
  idle: {
    dot: "bg-slate-400 shadow-slate-400/50",
    text: "text-slate-300",
    ring: "border-slate-500/25 bg-slate-500/10",
    label: "Idle",
  },
};

const segmentStyles = {
  business: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  political: "border-violet-300/25 bg-violet-400/10 text-violet-100",
  route: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
};

type PipelineCard = OSOpportunity & { stage: string };

export function HomeReachOSShell({
  data,
  mode = "command",
}: {
  data: HomeReachOSData;
  mode?: HomeReachOSMode;
}) {
  const [activeView, setActiveView] = useState<"command" | "communications" | "intelligence" | "operations" | "automation">(
    mode === "sales" ? "intelligence" : "command",
  );
  const [selectedOpportunity, setSelectedOpportunity] = useState<OSOpportunity | null>(data.leadIntelligence.opportunities[0] ?? null);
  const [pipelineCards, setPipelineCards] = useState<PipelineCard[]>(() =>
    data.leadIntelligence.opportunities.slice(0, 8).map((opportunity, index) => ({
      ...opportunity,
      stage: data.pipeline[Math.min(index % Math.max(data.pipeline.length - 1, 1), data.pipeline.length - 1)]?.name ?? "New",
    })),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const headlineMetrics = useMemo<OSMetric[]>(
    () => [
      {
        label: "Revenue today",
        value: data.revenue.revenueToday,
        detail: "Paid orders, closed deals, political payments",
        status: "online",
        trend: "Live",
      },
      {
        label: "MRR",
        value: data.revenue.mrr,
        detail: `${data.revenue.arr} ARR run-rate`,
        status: "online",
        trend: "Recurring",
      },
      {
        label: "Pipeline",
        value: data.revenue.projectedRevenue,
        detail: `${data.revenue.closeProbability}% blended close probability`,
        status: data.revenue.failedPayments > 0 ? "watch" : "online",
        trend: "Projected",
      },
      {
        label: "Operational alerts",
        value: String(data.operations.operationalAlerts),
        detail: "Payments, approvals, providers, production",
        status: data.operations.operationalAlerts > 0 ? "critical" : "online",
        trend: data.operations.operationalAlerts > 0 ? "Needs review" : "Clear",
      },
    ],
    [data],
  );

  function movePipelineCard(stage: string) {
    if (!draggingId) return;
    setPipelineCards((cards) =>
      cards.map((card) => (card.id === draggingId ? { ...card, stage } : card)),
    );
    setDraggingId(null);
  }

  return (
    <div className="-m-6 min-h-screen bg-[#07111f] text-white lg:-m-8">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.34),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(8,20,40,0.92)_42%,rgba(15,23,42,0.98))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />

        <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <TopBar data={data} mode={mode} />
          <CommandTabs activeView={activeView} onChange={setActiveView} />
          <RevenuePathControl data={data} />

          {activeView === "command" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <div className="space-y-5">
                <HeroCommand metrics={headlineMetrics} data={data} />
                <NextBestActionCenter actions={data.nextBestActions} />
                <EcosystemOrchestrationPanel data={data} />
                <OneClickActions />
                <OperationalGrid data={data} onSelectOpportunity={setSelectedOpportunity} />
                <ProductOperations data={data} />
              </div>
              <div className="space-y-5">
                <LiveActivity feed={data.activityFeed} notifications={data.notifications} />
                <AIWorkforce agents={data.ai.agents} />
                <Customer360 opportunity={selectedOpportunity} data={data} />
              </div>
            </div>
          )}

          {activeView === "communications" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <UnifiedComms data={data} />
              <AISuggestionPanel data={data} />
            </div>
          )}

          {activeView === "intelligence" && (
            <div className="space-y-5">
              <IntelligenceEngines data={data} onSelectOpportunity={setSelectedOpportunity} />
              <SalesPipeline
                stages={data.pipeline}
                cards={pipelineCards}
                draggingId={draggingId}
                onDragStart={setDraggingId}
                onDrop={movePipelineCard}
                onSelect={setSelectedOpportunity}
              />
              <PerformancePanel data={data} />
            </div>
          )}

          {activeView === "operations" && (
            <div className="space-y-5">
              <MapOperations data={data} />
              <ProductOperations data={data} />
              <RoleViews data={data} />
            </div>
          )}

          {activeView === "automation" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <AutomationCenter data={data} />
              <AuditPanel data={data} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({ data, mode }: { data: HomeReachOSData; mode: HomeReachOSMode }) {
  return (
    <header className="flex flex-col gap-4 rounded-none border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-950 shadow-[0_0_34px_rgba(59,130,246,0.28)]">
          HR
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-normal text-white sm:text-3xl">HomeReach OS</h1>
            <StatusPill status={data.ai.automationStatus} label="Live operations" />
            {mode === "sales" && <StatusPill status="online" label="Sales focus" />}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            Operating system for geographic marketing, campaign execution, sales intelligence, communications, and revenue operations.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <LinkButton href="/admin/inbox" icon={Inbox} label={`${data.communications.pendingReplies} replies`} />
        <LinkButton href="/admin/sales-dashboard" icon={LineChart} label="Sales" />
        <LinkButton href="/admin/political" icon={LandmarkIcon} label="Political" />
        <LinkButton href="/operations-copilot" icon={ClipboardCheck} label="Purchasing" />
      </div>
    </header>
  );
}

function CommandTabs({
  activeView,
  onChange,
}: {
  activeView: string;
  onChange: (view: "command" | "communications" | "intelligence" | "operations" | "automation") => void;
}) {
  const tabs = [
    { id: "command", label: "Command", icon: Radar },
    { id: "communications", label: "Comms", icon: MessageSquare },
    { id: "intelligence", label: "Intelligence", icon: Target },
    { id: "operations", label: "Operations", icon: Map },
    { id: "automation", label: "Automation", icon: Activity },
  ] as const;

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.06] p-1 backdrop-blur-xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition",
              active ? "bg-white text-slate-950 shadow-lg" : "text-slate-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function RevenuePathControl({ data }: { data: HomeReachOSData }) {
  const queues = [
    {
      label: "Pending payments",
      value: data.revenue.pendingInvoices + data.revenue.failedPayments,
      detail: data.revenue.failedPayments > 0 ? `${data.revenue.failedPayments} failed` : "ready to close",
      href: "/admin/orders",
      status: data.revenue.failedPayments > 0 ? "critical" : data.revenue.pendingInvoices > 0 ? "watch" : "online",
      icon: CreditCard,
    },
    {
      label: "Proposals",
      value: data.revenue.pendingProposals,
      detail: "draft, sent, viewed",
      href: "/admin/political/proposals",
      status: data.revenue.pendingProposals > 0 ? "watch" : "online",
      icon: FileText,
    },
    {
      label: "Hot leads",
      value: data.leadIntelligence.hotLeads,
      detail: `${data.leadIntelligence.staleLeads} stale follow-ups`,
      href: "/admin/leads",
      status: data.leadIntelligence.staleLeads > 0 ? "critical" : data.leadIntelligence.hotLeads > 0 ? "watch" : "online",
      icon: Target,
    },
    {
      label: "Replies",
      value: data.communications.pendingReplies,
      detail: `${data.communications.unreadTexts} texts · ${data.communications.unreadEmails} emails`,
      href: "/admin/inbox",
      status: data.communications.pendingReplies > 0 ? "watch" : "online",
      icon: Inbox,
    },
    {
      label: "Ops alerts",
      value: data.operations.operationalAlerts,
      detail: "payments, design, provider, queues",
      href: "/admin/operator",
      status: data.operations.operationalAlerts > 0 ? "critical" : "online",
      icon: AlertTriangle,
    },
  ] satisfies Array<{
    label: string;
    value: number;
    detail: string;
    href: string;
    status: OSStatus;
    icon: LucideIcon;
  }>;

  return (
    <section className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-3 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Revenue Path Control
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Close the money path first: replies, proposals, payments, and ops blockers all route to live admin surfaces.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {queues.map((queue) => {
            const Icon = queue.icon;
            const style = statusStyles[queue.status];
            return (
              <Link
                key={queue.label}
                href={queue.href}
                className={cn(
                  "rounded-lg border bg-slate-950/70 p-3 transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950",
                  style.ring,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-[0.12em]">{queue.label}</span>
                  </div>
                  <span className={cn("h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]", style.dot)} />
                </div>
                <div className="mt-2 text-2xl font-black">{queue.value.toLocaleString()}</div>
                <div className="mt-1 text-xs opacity-75">{queue.detail}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HeroCommand({ metrics, data }: { metrics: OSMetric[]; data: HomeReachOSData }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)]">
      <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-blue-950/30 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Global Command Center</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              Live operational intelligence across every HomeReach product.
            </h2>
          </div>
          <div className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-right">
            <p className="text-xs text-sky-100">Updated</p>
            <p className="mt-1 text-sm font-semibold text-white">{new Date(data.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => (
            <MetricCard key={item.label} metric={item} />
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <CommandSignal icon={CreditCard} label="Pending invoices" value={data.revenue.pendingInvoices} status={data.revenue.pendingInvoices > 0 ? "watch" : "online"} />
          <CommandSignal icon={FileText} label="Pending proposals" value={data.revenue.pendingProposals} status={data.revenue.pendingProposals > 0 ? "watch" : "online"} />
          <CommandSignal icon={AlertTriangle} label="Failed payments" value={data.revenue.failedPayments} status={data.revenue.failedPayments > 0 ? "critical" : "online"} />
          <CommandSignal icon={Gauge} label="Stripe pipeline" value={data.revenue.stripePipeline} status="online" />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Today</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Operational Pulse</h3>
          </div>
          <StatusDot status={data.operations.operationalAlerts > 0 ? "watch" : "online"} />
        </div>
        <div className="mt-5 space-y-3">
          <PulseRow label="Active campaigns" value={data.operations.activeCampaigns} icon={Send} />
          <PulseRow label="Print jobs" value={data.operations.printJobs} icon={Truck} />
          <PulseRow label="Design approvals" value={data.operations.designApprovals} icon={ClipboardCheck} />
          <PulseRow label="Unread communications" value={data.communications.pendingReplies} icon={Inbox} />
          <PulseRow label="AI actions queued" value={data.ai.actions} icon={Bot} />
        </div>
      </div>
    </section>
  );
}

function EcosystemOrchestrationPanel({ data }: { data: HomeReachOSData }) {
  const politicalAgent = data.ai.agents.find((agent) => agent.name === "Candidate Launch Agent");
  const inventoryAgent = data.ai.agents.find((agent) => agent.name === "Inventory Intelligence Agent");
  const complianceAgent = data.ai.agents.find((agent) => agent.name === "Compliance Agent");

  const systems = [
    {
      label: "Unified messaging",
      href: "/admin/revenue-operations",
      icon: MessageSquare,
      status: data.communications.pendingReplies > 0 ? "watch" as OSStatus : "online" as OSStatus,
      metric: `${data.communications.pendingReplies} pending`,
      detail: "Revenue message threads bridge SMS, email, Facebook, political replies, and sales follow-up into one timeline.",
    },
    {
      label: "Political agents",
      href: "/admin/political/candidate-agent",
      icon: LandmarkIcon,
      status: politicalAgent?.status ?? "idle" as OSStatus,
      metric: `${politicalAgent?.queueCount ?? data.leadIntelligence.politicalOpportunities} queued`,
      detail: "Candidate research, launch plans, postcard creative, map plans, and proposals stay tied to existing political records.",
    },
    {
      label: "Procurement intelligence",
      href: "/admin/procurement",
      icon: Package,
      status: inventoryAgent?.status ?? "online" as OSStatus,
      metric: `${inventoryAgent?.queueCount ?? 0} approvals`,
      detail: "Operations Copilot remains the source for supplier prices, inventory risk, savings cards, and smart-buy approvals.",
    },
    {
      label: "Growth and creative",
      href: "/admin/growth-engine",
      icon: Sparkles,
      status: data.ai.drafts > 0 ? "watch" as OSStatus : "online" as OSStatus,
      metric: `${data.ai.drafts} drafts`,
      detail: "Growth Engine, SEO, content intelligence, and Canva design requests should feed one review queue before publishing.",
    },
    {
      label: "Revenue integrity",
      href: "/admin/orders",
      icon: ShieldCheck,
      status: data.revenue.failedPayments > 0 ? "critical" as OSStatus : "online" as OSStatus,
      metric: `${data.revenue.failedPayments} blockers`,
      detail: "Stripe, proposals, orders, subscriptions, and payment recovery are monitored before fulfillment or production handoff.",
    },
  ];

  return (
    <section className="rounded-lg border border-blue-300/15 bg-blue-400/[0.06] p-4 shadow-xl shadow-blue-950/20 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            AI Orchestration Layer
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">One command surface, existing systems underneath.</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
            This panel is the consolidation path: no duplicate dashboards, no duplicate communication engine, and no replacement of protected revenue flows.
            Each card links to the current source workspace while HomeReach OS acts as the executive action layer.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-white">Mode:</span> read-only orchestration
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
        {systems.map((system) => {
          const Icon = system.icon;
          const style = statusStyles[system.status];
          return (
            <Link
              key={system.label}
              href={system.href}
              className={cn(
                "rounded-lg border bg-slate-950/70 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950",
                style.ring,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-[0.12em]">{system.label}</span>
                </div>
                <span className={cn("h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]", style.dot)} />
              </div>
              <p className="mt-3 text-2xl font-black">{system.metric}</p>
              <p className="mt-2 text-xs leading-5 opacity-75">{system.detail}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Next safe build</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Add shared memory and action adapters after migration status is confirmed. Until then, this layer reads only from existing records.
          </p>
        </div>
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Owner action needed</p>
          <p className="mt-2 text-sm leading-6 text-amber-50">
            Verify migrations 085-093, provider env vars, Twilio A2P, and political outreach approvals before enabling higher automation.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Safety posture</p>
          <p className="mt-2 text-sm leading-6 text-emerald-50">
            {complianceAgent?.lastAction ?? "Compliance checks remain active."} SerpAPI remains paused unless manually re-enabled.
          </p>
        </div>
      </div>
    </section>
  );
}

function NextBestActionCenter({ actions }: { actions: OSNextBestAction[] }) {
  const primary = actions[0];
  const secondary = actions.slice(1, 4);

  if (!primary) {
    return (
      <section className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-200" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Action Center</p>
            <h2 className="mt-1 text-xl font-semibold text-white">No urgent actions right now.</h2>
            <p className="mt-1 text-sm text-emerald-50/80">HomeReach OS will surface the next decision when something needs attention.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.08] p-4 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="flex-1 rounded-lg border border-sky-300/20 bg-sky-400/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Next Best Action</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">{primary.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{primary.outcome}</p>
            </div>
            <Link
              href={primary.href}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-100"
            >
              {primary.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ActionSignal label="Confidence" value={`${primary.confidence}%`} status={primary.status} />
            <ActionSignal label="Urgency" value={`${primary.urgency}/100`} status={primary.status} />
            <ActionSignal label="Risk" value={primary.risk} status={primary.risk === "High" ? "critical" : primary.risk === "Medium" ? "watch" : "online"} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <ActionExplanation title="Why it matters" body={primary.reason} />
            <ActionExplanation title="Expected impact" body={primary.impact} />
            <ActionExplanation title="If ignored" body={primary.ifIgnored} tone="warning" />
          </div>
        </div>

        <div className="w-full space-y-3 xl:w-[360px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">After that</p>
            <p className="mt-1 text-sm text-slate-300">Only the next few decisions, ranked by urgency and impact.</p>
          </div>
          {secondary.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-lg border border-white/10 bg-slate-950/55 p-3 transition hover:border-sky-300/40 hover:bg-sky-300/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.outcome}</p>
                </div>
                <StatusDot status={item.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5">{item.confidence}% confidence</span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5">{item.impact}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function OneClickActions() {
  const actions = [
    { label: "Send email", href: "/admin/inbox", icon: Mail },
    { label: "Send text", href: "/admin/inbox", icon: MessageSquare },
    { label: "Generate proposal", href: "/admin/political/proposals", icon: FileText },
    { label: "Stripe invoice", href: "https://dashboard.stripe.com/invoices", icon: CreditCard, external: true },
    { label: "Route plan", href: "/admin/political/maps", icon: Route },
    { label: "Follow-up", href: "/admin/sales-engine", icon: CalendarClock },
    { label: "Clone campaign", href: "/admin/campaigns", icon: Copy },
    { label: "Proof send", href: "/admin/targeted-campaigns", icon: Send },
    { label: "Open map", href: "/admin/political/maps", icon: MapPin },
    { label: "Assign task", href: "/admin/agents", icon: Users },
  ];

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <LinkButton
            key={action.label}
            href={action.href}
            icon={action.icon}
            label={action.label}
            external={action.external}
            className="justify-center border-white/10 bg-white/[0.07] py-3 hover:bg-white hover:text-slate-950"
          />
        ))}
      </div>
    </section>
  );
}

function OperationalGrid({
  data,
  onSelectOpportunity,
}: {
  data: HomeReachOSData;
  onSelectOpportunity: (opportunity: OSOpportunity) => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <Panel title="Lead Intelligence" icon={Target} action={{ href: "/admin/leads", label: "Open leads" }}>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="New" value={data.leadIntelligence.newLeads} />
          <MiniStat label="Hot" value={data.leadIntelligence.hotLeads} status="watch" />
          <MiniStat label="Stale" value={data.leadIntelligence.staleLeads} status={data.leadIntelligence.staleLeads > 0 ? "critical" : "online"} />
          <MiniStat label="AI ranked" value={data.leadIntelligence.aiRanked} />
        </div>
        <div className="mt-4 space-y-2">
          {data.leadIntelligence.opportunities.slice(0, 4).map((opportunity) => (
            <button
              key={opportunity.id}
              onClick={() => onSelectOpportunity(opportunity)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] p-3 text-left transition hover:border-sky-300/40 hover:bg-sky-300/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{opportunity.name}</p>
                  <p className="truncate text-xs text-slate-400">{opportunity.location}</p>
                </div>
                <ScoreRing score={opportunity.score} />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Operations" icon={Truck} action={{ href: "/admin/targeted-campaigns", label: "Open ops" }}>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Campaigns" value={data.operations.activeCampaigns} />
          <MiniStat label="Print jobs" value={data.operations.printJobs} />
          <MiniStat label="BMEU drops" value={data.operations.bmeuDrops} />
          <MiniStat label="Delivery windows" value={data.operations.deliveryWindows} />
        </div>
        <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
          <div className="flex items-center gap-2 text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">{data.operations.operationalAlerts} operational alerts</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-100/80">
            Design approvals, provider exceptions, payment integrity, and production queues are surfaced for same-day triage.
          </p>
        </div>
      </Panel>

      <Panel title="Communications" icon={Inbox} action={{ href: "/admin/inbox", label: "Open inbox" }}>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Texts" value={data.communications.unreadTexts} status={data.communications.unreadTexts > 0 ? "watch" : "online"} />
          <MiniStat label="Emails" value={data.communications.unreadEmails} status={data.communications.unreadEmails > 0 ? "watch" : "online"} />
          <MiniStat label="DMs" value={data.communications.unreadDms} />
          <MiniStat label="Intake" value={data.communications.intakeSubmissions} />
        </div>
        <div className="mt-4 space-y-2">
          {data.communications.conversations.slice(0, 3).map((thread) => (
            <div key={thread.id} className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">{thread.name}</p>
                <span className="text-xs text-slate-400">{thread.age}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{thread.summary}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ActionSignal({ label, value, status }: { label: string; value: string; status: OSStatus }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <StatusDot status={status} />
      </div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function ActionExplanation({
  title,
  body,
  tone = "default",
}: {
  title: string;
  body: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      tone === "warning"
        ? "border-amber-300/20 bg-amber-300/10"
        : "border-white/10 bg-white/[0.05]",
    )}>
      <p className={cn(
        "text-xs font-semibold uppercase tracking-[0.14em]",
        tone === "warning" ? "text-amber-100" : "text-slate-400",
      )}>{title}</p>
      <p className={cn(
        "mt-2 text-sm leading-6",
        tone === "warning" ? "text-amber-50" : "text-slate-200",
      )}>{body}</p>
    </div>
  );
}

function UnifiedComms({ data }: { data: HomeReachOSData }) {
  const [selectedId, setSelectedId] = useState(data.communications.conversations[0]?.id ?? "");
  const active = data.communications.conversations.find((thread) => thread.id === selectedId) ?? data.communications.conversations[0];

  return (
    <section className="grid min-h-[680px] overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] backdrop-blur-xl lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Universal Inbox</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Threads by customer and campaign</h2>
            </div>
            <StatusPill status={data.communications.pendingReplies > 0 ? "watch" : "online"} label={`${data.communications.pendingReplies} pending`} />
          </div>
        </div>
        <div className="max-h-[620px] overflow-y-auto">
          {data.communications.conversations.length === 0 ? (
            <EmptyState icon={Inbox} title="No live threads" detail="Conversations will appear from sales replies, SMS, email, web inquiries, intake, and campaign replies." />
          ) : (
            data.communications.conversations.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedId(thread.id)}
                className={cn(
                  "w-full border-b border-white/10 p-4 text-left transition hover:bg-white/[0.08]",
                  active?.id === thread.id && "bg-sky-400/10",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ChannelIcon channel={thread.channel} />
                    <p className="truncate text-sm font-semibold text-white">{thread.name}</p>
                  </div>
                  <span className="text-xs text-slate-400">{thread.age}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{thread.summary}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Urgency {thread.urgency}</span>
                  {thread.unread && <StatusPill status="watch" label="Unread" />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-[620px] flex-col">
        {active ? (
          <>
            <div className="border-b border-white/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-white">{active.name}</h3>
                    <StatusPill status={active.unread ? "watch" : "online"} label={active.channel.toUpperCase()} />
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{active.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <LinkButton href="/admin/inbox" icon={Send} label="Reply" />
                  <LinkButton href="/admin/crm" icon={Users} label="Assign" />
                  <LinkButton href="/admin/sales-engine" icon={CalendarClock} label="Follow-up" />
                  <LinkButton href="/admin/political/proposals" icon={FileText} label="Proposal" />
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-4 bg-slate-950/30 p-5">
              <MessageBubble inbound body={active.summary} label="Customer" />
              <MessageBubble body="AI draft: I can help lock this in today. I recommend a short reply that confirms the product, timeline, and the next action." label="HomeReach OS" />
              <div className="grid gap-3 md:grid-cols-3">
                <InsightChip icon={Sparkles} label="Urgency score" value={`${active.urgency}/100`} />
                <InsightChip icon={Target} label="Next step" value={active.nextAction} />
                <InsightChip icon={ShieldCheck} label="Tone" value="Direct, helpful, confident" />
              </div>
            </div>
            <div className="border-t border-white/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <textarea
                  className="min-h-24 flex-1 rounded-lg border border-white/10 bg-white text-sm text-slate-950 outline-none ring-sky-300/40 transition placeholder:text-slate-500 focus:ring-4"
                  defaultValue="Thanks for reaching out. I can send the next step now and keep the timing tight."
                  aria-label="AI-assisted reply draft"
                />
                <div className="grid gap-2 sm:grid-cols-2 lg:w-56 lg:grid-cols-1">
                  <LinkButton href="/admin/inbox" icon={Send} label="Send from inbox" className="justify-center bg-sky-500 text-white hover:bg-sky-400" />
                  <button className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-slate-950">
                    <RefreshCw className="h-4 w-4" />
                    Rewrite tone
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={Inbox} title="No conversation selected" detail="Inbound texts, emails, DMs, website inquiries, intake submissions, and campaign replies appear here." />
        )}
      </div>
    </section>
  );
}

function AISuggestionPanel({ data }: { data: HomeReachOSData }) {
  return (
    <aside className="space-y-5">
      <Panel title="AI Communication Assist" icon={Bot}>
        <div className="space-y-3">
          <AssistRow label="Suggested replies" value={data.ai.drafts} detail="Ready for sales and political follow-up" />
          <AssistRow label="Objection handling" value={data.leadIntelligence.staleLeads} detail="Price, timing, and exclusivity recovery" />
          <AssistRow label="Follow-up reminders" value={data.communications.missedFollowUps} detail="Missed or stale opportunities" />
          <AssistRow label="DM drafts" value={data.communications.unreadDms} detail="Facebook and Instagram handoffs" />
        </div>
      </Panel>
      <Panel title="Conversation Actions" icon={MousePointer2}>
        <div className="grid gap-2">
          <LinkButton href="/admin/inbox" icon={Mail} label="Email directly" />
          <LinkButton href="/admin/inbox" icon={MessageSquare} label="Text directly" />
          <LinkButton href="/admin/crm" icon={Users} label="Create follow-up" />
          <LinkButton href="/admin/political/proposals" icon={ReceiptText} label="Generate proposal" />
        </div>
      </Panel>
    </aside>
  );
}

function IntelligenceEngines({
  data,
  onSelectOpportunity,
}: {
  data: HomeReachOSData;
  onSelectOpportunity: (opportunity: OSOpportunity) => void;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <Panel title="Business Lead Intelligence Engine" icon={Building2} action={{ href: "/admin/leads", label: "Lead table" }}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Business ops" value={data.leadIntelligence.businessOpportunities} />
          <MiniStat label="Hot leads" value={data.leadIntelligence.hotLeads} status="watch" />
          <MiniStat label="AI ranked" value={data.leadIntelligence.aiRanked} />
          <MiniStat label="Route fit" value={data.leadIntelligence.routeOpportunities} />
        </div>
        <OpportunityList
          opportunities={data.leadIntelligence.opportunities.filter((opportunity) => opportunity.segment !== "political")}
          onSelect={onSelectOpportunity}
        />
      </Panel>

      <Panel title="Political Intelligence Engine" icon={LandmarkIcon} action={{ href: "/admin/political/intelligence", label: "Political intel" }}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Campaign ops" value={data.leadIntelligence.politicalOpportunities} />
          <MiniStat label="Filings" value={data.ai.newCandidateFilings} status={data.ai.newCandidateFilings > 0 ? "watch" : "online"} />
          <MiniStat label="Proposals" value={data.revenue.pendingProposals} />
          <MiniStat label="Map plans" value={data.maps.reduce((sum, layer) => sum + (layer.name.includes("USPS") || layer.name.includes("Political") ? layer.count : 0), 0)} />
        </div>
        <OpportunityList
          opportunities={data.leadIntelligence.opportunities.filter((opportunity) => opportunity.segment === "political")}
          onSelect={onSelectOpportunity}
        />
      </Panel>
    </section>
  );
}

function SalesPipeline({
  stages,
  cards,
  draggingId,
  onDragStart,
  onDrop,
  onSelect,
}: {
  stages: OSPipelineStage[];
  cards: PipelineCard[];
  draggingId: string | null;
  onDragStart: (id: string | null) => void;
  onDrop: (stage: string) => void;
  onSelect: (opportunity: OSOpportunity) => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Sales Pipeline</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Drag opportunities through revenue stages</h2>
        </div>
        <StatusPill status={draggingId ? "watch" : "online"} label={draggingId ? "Moving card" : "Pipeline live"} />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-5">
        {stages.map((stage) => (
          <div
            key={stage.name}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(stage.name)}
            className="min-h-64 rounded-lg border border-white/10 bg-slate-950/50 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{stage.name}</p>
                <p className="text-xs text-slate-400">{stage.value} at {stage.probability}%</p>
              </div>
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-slate-200">{stage.count}</span>
            </div>
            <div className="space-y-2">
              {cards.filter((card) => card.stage === stage.name).map((card) => (
                <button
                  key={card.id}
                  draggable
                  onDragStart={() => onDragStart(card.id)}
                  onDragEnd={() => onDragStart(null)}
                  onClick={() => onSelect(card)}
                  className="w-full cursor-grab rounded-lg border border-white/10 bg-white p-3 text-left text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-sky-950/20 active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{card.name}</p>
                      <p className="truncate text-xs text-slate-500">{card.product}</p>
                    </div>
                    <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-bold text-white">{card.score}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-600">{card.value}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductOperations({ data }: { data: HomeReachOSData }) {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {data.productOps.map((product) => (
        <div key={product.name} className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <StatusPill status={product.status} label={statusStyles[product.status].label} />
              <h3 className="mt-3 text-lg font-semibold text-white">{product.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{product.description}</p>
            </div>
            <Link href={product.href} className="rounded-md border border-white/10 bg-white/[0.06] p-2 text-slate-200 transition hover:bg-white hover:text-slate-950">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {product.metrics.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-400">{item.label}</p>
                  <p className="truncate text-sm text-slate-200">{item.detail}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {product.actions.map((action) => (
              <LinkButton key={action.href + action.label} href={action.href} icon={ArrowRight} label={action.label} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function MapOperations({ data }: { data: HomeReachOSData }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#081522] shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Live Map Operations</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Synchronized geographic intelligence</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["USPS", "Districts", "ZIPs", "Heatmap"].map((label) => (
              <button key={label} className="rounded-md border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white hover:text-slate-950">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-[520px] overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />
          <div className="absolute left-[8%] top-[15%] h-52 w-52 rounded-full border border-sky-300/40 bg-sky-300/10 blur-[1px]" />
          <div className="absolute right-[12%] top-[18%] h-64 w-64 rotate-12 rounded-[22px] border border-violet-300/30 bg-violet-300/10" />
          <div className="absolute bottom-[12%] left-[28%] h-56 w-72 -rotate-6 rounded-[18px] border border-emerald-300/30 bg-emerald-300/10" />
          <div className="absolute inset-8 rounded-lg border border-white/10" />
          <div className="absolute left-[18%] top-[34%] h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_24px_rgba(125,211,252,0.9)]" />
          <div className="absolute right-[26%] top-[38%] h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.85)]" />
          <div className="absolute bottom-[28%] left-[48%] h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(110,231,183,0.85)]" />
          <div className="absolute left-[18%] top-[34%] h-px w-[31%] rotate-[13deg] bg-gradient-to-r from-sky-300 to-amber-300" />
          <div className="absolute right-[27%] top-[40%] h-px w-[27%] rotate-[142deg] bg-gradient-to-r from-amber-300 to-emerald-300" />
          <div className="absolute bottom-6 left-6 right-6 grid gap-2 sm:grid-cols-4">
            {data.maps.map((layer) => (
              <div key={layer.name} className="rounded-lg border border-white/10 bg-slate-950/75 p-3 backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">{layer.name}</p>
                  <StatusDot status={layer.status} />
                </div>
                <p className="mt-2 text-lg font-semibold text-white">{layer.count}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{layer.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Panel title="Map Intelligence" icon={Layers3}>
        <div className="space-y-3">
          {data.maps.map((layer) => (
            <div key={layer.name} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{layer.name}</p>
                  <p className="text-xs text-slate-400">{layer.type}</p>
                </div>
                <StatusPill status={layer.status} label={String(layer.count)} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">{layer.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function AIWorkforce({ agents }: { agents: OSAgent[] }) {
  return (
    <Panel title="AI Agent Workforce" icon={Bot} action={{ href: "/admin/agents", label: "Agent console" }}>
      <div className="grid gap-3">
        {agents.slice(0, 6).map((agent) => (
          <div key={agent.name} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusDot status={agent.status} />
                  <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{agent.currentTask}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{agent.confidence}%</p>
                <p className="text-xs text-slate-500">confidence</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
              <span className="truncate">{agent.lastAction}</span>
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-slate-200">{agent.queueCount} queued</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PerformancePanel({ data }: { data: HomeReachOSData }) {
  const items = [
    { label: "Texts sent", value: data.performance.textsSent, icon: MessageSquare },
    { label: "Emails sent", value: data.performance.emailsSent, icon: Mail },
    { label: "DMs sent", value: data.performance.dmsSent, icon: Send },
    { label: "Calls made", value: data.performance.callsMade, icon: Phone },
    { label: "Meetings booked", value: data.performance.meetingsBooked, icon: CalendarClock },
    { label: "Proposals sent", value: data.performance.proposalsSent, icon: FileText },
    { label: "Deals closed", value: data.performance.dealsClosed, icon: CheckCircle2 },
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Performance Tracking" icon={BarChart3}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                <Icon className="h-5 w-5 text-sky-200" />
                <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-xs text-slate-400">{item.label}</p>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Revenue by Product" icon={CircleDollarSign}>
        <div className="space-y-3">
          {data.performance.revenueByProduct.map((metricItem) => (
            <MetricRow key={metricItem.label} metric={metricItem} />
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <MiniStat label="Human actions" value={data.performance.humanActions} />
            <MiniStat label="AI actions" value={data.performance.aiActions} />
          </div>
        </div>
      </Panel>
    </section>
  );
}

function AutomationCenter({ data }: { data: HomeReachOSData }) {
  return (
    <section className="space-y-5">
      <Panel title="Automation Center" icon={Activity}>
        <div className="grid gap-3 md:grid-cols-2">
          {data.automation.map((monitor) => (
            <Link key={monitor.name} href={monitor.href} className="rounded-lg border border-white/10 bg-white/[0.05] p-4 transition hover:border-sky-300/40 hover:bg-sky-300/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot status={monitor.status} />
                  <p className="font-semibold text-white">{monitor.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{monitor.detail}</p>
            </Link>
          ))}
        </div>
      </Panel>
      <RoleViews data={data} />
    </section>
  );
}

function RoleViews({ data }: { data: HomeReachOSData }) {
  return (
    <Panel title="Role-Based Dashboards" icon={Users}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.roleViews.map((view) => (
          <Link key={view.role} href={view.href} className="rounded-lg border border-white/10 bg-white/[0.05] p-4 transition hover:border-sky-300/40 hover:bg-sky-300/10">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">{view.role}</p>
              <StatusDot status={view.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{view.focus}</p>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function Customer360({ opportunity, data }: { opportunity: OSOpportunity | null; data: HomeReachOSData }) {
  const title = opportunity?.name ?? "Customer 360";
  return (
    <Panel title="Customer 360" icon={Network} action={{ href: "/admin/crm", label: "Open CRM" }}>
      <div className="rounded-lg border border-white/10 bg-white p-4 text-slate-950">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{opportunity?.location ?? "Select a customer, campaign, or opportunity"}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <CustomerPoint label="Products" value={opportunity?.product ?? "All offers"} />
          <CustomerPoint label="Invoices" value={String(data.revenue.pendingInvoices)} />
          <CustomerPoint label="Comms" value={String(data.communications.pendingReplies)} />
          <CustomerPoint label="Maps" value={String(data.maps.length)} />
          <CustomerPoint label="Campaigns" value={String(data.operations.activeCampaigns)} />
          <CustomerPoint label="Proposals" value={String(data.revenue.pendingProposals)} />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { label: "AI recommendation", value: opportunity?.nextAction ?? "Prioritize the highest value thread and generate the next action." },
          { label: "Payment status", value: data.revenue.failedPayments > 0 ? "Review payment risk before scaling fulfillment." : "Payment risk clear." },
          { label: "Route note", value: "Map overlays and route counts should be checked before proof or proposal send." },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{item.value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LiveActivity({ feed, notifications }: { feed: OSActivity[]; notifications: OSActivity[] }) {
  return (
    <Panel title="Live Activity Feed" icon={Zap}>
      <div className="space-y-2">
        {[...notifications.slice(0, 3), ...feed.slice(0, 5)].slice(0, 8).map((item) => (
          <div key={item.id} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-3">
            <StatusDot status={item.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                <span className="shrink-0 text-xs text-slate-500">{item.time}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AuditPanel({ data }: { data: HomeReachOSData }) {
  return (
    <Panel title="Protected Flow Audit" icon={ShieldCheck}>
      <div className="space-y-2">
        {data.audit.map((item) => (
          <div key={item} className="flex gap-3 rounded-lg border border-emerald-300/15 bg-emerald-300/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-sm leading-6 text-emerald-50">{item}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function OpportunityList({
  opportunities,
  onSelect,
}: {
  opportunities: OSOpportunity[];
  onSelect: (opportunity: OSOpportunity) => void;
}) {
  if (opportunities.length === 0) {
    return <EmptyState icon={Target} title="No ranked opportunities" detail="Scores appear as leads, route campaigns, and political records are ingested." />;
  }

  return (
    <div className="mt-4 space-y-2">
      {opportunities.slice(0, 6).map((opportunity) => (
        <button
          key={opportunity.id}
          onClick={() => onSelect(opportunity)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.05] p-3 text-left transition hover:border-sky-300/40 hover:bg-sky-300/10"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{opportunity.name}</p>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", segmentStyles[opportunity.segment])}>
                  {opportunity.segment}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-400">{opportunity.location}</p>
              <p className="mt-2 text-xs text-slate-300">{opportunity.nextAction}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-sm font-semibold text-white">{opportunity.value}</p>
              <ScoreRing score={opportunity.score} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-300/20 bg-sky-300/10 text-sky-100">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="truncate text-base font-semibold text-white">{title}</h2>
        </div>
        {action && (
          <Link href={action.href} className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white hover:text-slate-950">
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ metric }: { metric: OSMetric }) {
  return (
    <div className={cn("rounded-lg border p-4", statusStyles[metric.status].ring)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{metric.label}</p>
        <StatusDot status={metric.status} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
      <p className="mt-2 min-h-10 text-xs leading-5 text-slate-300">{metric.detail}</p>
      {metric.trend && <p className={cn("mt-2 text-xs font-semibold", statusStyles[metric.status].text)}>{metric.trend}</p>}
    </div>
  );
}

function MetricRow({ metric }: { metric: OSMetric }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{metric.label}</p>
          <p className="truncate text-xs text-slate-400">{metric.detail}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-white">{metric.value}</p>
      </div>
    </div>
  );
}

function CommandSignal({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  status: OSStatus;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 text-sky-200" />
        <StatusDot status={status} />
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, status = "online" }: { label: string; value: string | number; status?: OSStatus }) {
  return (
    <div className={cn("rounded-lg border p-3", statusStyles[status].ring)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-slate-300">{label}</p>
        <StatusDot status={status} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function PulseRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const status: OSStatus = value > 0 ? "online" : "idle";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-sky-200" />
        <p className="truncate text-sm text-slate-200">{label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-sm font-semibold text-white">{value}</p>
        <StatusDot status={status} />
      </div>
    </div>
  );
}

function LinkButton({
  href,
  icon: Icon,
  label,
  external,
  className,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  external?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </>
  );
  const classes = cn(
    "flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white hover:text-slate-950",
    className,
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

function StatusDot({ status }: { status: OSStatus }) {
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_currentColor]", statusStyles[status].dot)} />;
}

function StatusPill({ status, label }: { status: OSStatus; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusStyles[status].ring, statusStyles[status].text)}>
      <StatusDot status={status} />
      {label}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score));
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{
        background: `conic-gradient(#38bdf8 ${normalized * 3.6}deg, rgba(255,255,255,0.14) 0deg)`,
      }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950">{normalized}</span>
    </span>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const Icon =
    channel === "sms" ? MessageSquare :
    channel === "email" ? Mail :
    channel === "dm" ? Send :
    channel === "web" ? Globe2 :
    Inbox;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.07] text-sky-100">
      <Icon className="h-4 w-4" />
    </span>
  );
}

function MessageBubble({ body, label, inbound = false }: { body: string; label: string; inbound?: boolean }) {
  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[720px] rounded-lg px-4 py-3", inbound ? "bg-white text-slate-950" : "bg-sky-500 text-white")}>
        <p className={cn("mb-1 text-xs font-semibold", inbound ? "text-slate-500" : "text-sky-100")}>{label}</p>
        <p className="text-sm leading-6">{body}</p>
      </div>
    </div>
  );
}

function InsightChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <Icon className="h-4 w-4 text-sky-200" />
      <p className="mt-2 text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function AssistRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white">{value}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function CustomerPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
      <Icon className="h-8 w-8 text-slate-500" />
      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function LandmarkIcon({ className }: { className?: string }) {
  return <Building2 className={className} />;
}
