"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  DollarSign,
  ExternalLink,
  Filter,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  AdminRevenueOpsSnapshot,
  LeadSourcePerformance,
  RevenueOpsApproval,
  RevenueOpsLeadSignal,
  RevenueRiskSignal,
} from "@/lib/admin/revenue-ops-snapshot";
import type { FoundationControlTowerData, FoundationStatus } from "@/lib/control-tower/foundation";
import type {
  HomeReachOSData,
  OSStatus,
} from "@/lib/homereach-os/types";

type Props = {
  osData: HomeReachOSData;
  controlData: FoundationControlTowerData;
  revenueOps: AdminRevenueOpsSnapshot;
};

type UiStatus = "Healthy" | "Warning" | "Broken" | "Needs Review";
type Priority = "P0" | "P1" | "P2" | "P3";
type ActionState = "Completed" | "Pending" | "Failed" | "Review" | "Scheduled";

type FilterKey =
  | "today"
  | "week"
  | "needs_action"
  | "failed"
  | "waiting_approval"
  | "ai_completed"
  | "human_required"
  | "revenue"
  | "political"
  | "procurement"
  | "shared"
  | "targeted"
  | "system_health"
  | "replies";

type QuickAction = {
  label: string;
  href: string;
};

type DailyAction = {
  id: string;
  title: string;
  value: string;
  status: ActionState;
  priority: Priority;
  source: string;
  owner: string;
  timestamp: string;
  nextStep: string;
  category: string;
  tags: FilterKey[];
  actions: QuickAction[];
};

type SnapshotMetric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  status: UiStatus;
};

type CommandRailItem = {
  label: string;
  value: string;
  detail: string;
  action: string;
  href: string;
  icon: LucideIcon;
  status: UiStatus;
};

type OperatorShortcut = {
  label: string;
  href: string;
  detail: string;
  icon: LucideIcon;
  status: UiStatus;
};

type ExecutiveBrief = {
  happenedToday: string;
  needsAttention: string;
  moneyToday: string;
  systemPosture: string;
  sourceWarnings: string[];
};

type ReadinessLevel = "Ready" | "Review First" | "Paused" | "Blocked";

type OperatingReadiness = {
  level: ReadinessLevel;
  headline: string;
  detail: string;
  guardrail: string;
  items: Array<{
    label: string;
    value: string;
    detail: string;
    status: UiStatus;
    href: string;
  }>;
};

type HealthPanel = {
  name: string;
  status: UiStatus;
  issue: string;
  action: string;
  href?: string;
  source: string;
};

type AgentWorkload = {
  name: string;
  area: string;
  completed: number;
  running: number;
  waiting: number;
  blocked: number;
  revenueImpact: string;
  leadImpact: string;
  errors: number;
  nextAction: string;
  status: UiStatus;
  href: string;
};

type MessageMetric = {
  label: string;
  tracked: string;
  delivered: string;
  failed: string;
  opened: string;
  clicked: string;
  replied: string;
  converted: string;
  note: string;
  status: UiStatus;
  href: string;
};

type ReplyItem = {
  id: string;
  contact: string;
  business: string;
  channel: string;
  preview: string;
  stage: string;
  urgency: string;
  aiResponse: string;
  actions: QuickAction[];
};

type SocialDraft = {
  id: string;
  title: string;
  audience: string;
  platform: string;
  goal: string;
  copy: string;
  status: "Ready for review" | "Needs edit" | "Approved" | "Template";
  href: string;
};

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "needs_action", label: "Needs action" },
  { key: "failed", label: "Failed" },
  { key: "waiting_approval", label: "Waiting approval" },
  { key: "ai_completed", label: "AI completed" },
  { key: "human_required", label: "Human required" },
  { key: "revenue", label: "Revenue opportunity" },
  { key: "political", label: "Political" },
  { key: "procurement", label: "Procurement" },
  { key: "shared", label: "Shared postcard" },
  { key: "targeted", label: "Targeted campaign" },
  { key: "system_health", label: "System health" },
  { key: "replies", label: "Replies" },
];

const priorityRank: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function AdminCommandCenterDataError({ errors }: { errors: string[] }) {
  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 rounded-lg border border-rose-300/25 bg-rose-300/10 p-5 shadow-2xl shadow-black/20">
        <div className="flex items-start gap-3">
          <span className="rounded-md border border-rose-300/30 bg-rose-300/15 p-2 text-rose-100">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">Command Center data unavailable</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              The admin view could not build a complete operating snapshot.
            </h1>
            <p className="mt-2 text-sm leading-6 text-rose-50/85">
              No outbound, payment, campaign, or approval action was attempted. Review the loader errors, then reopen the command center after the source is healthy.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-slate-950/45 p-4">
          <p className="text-sm font-semibold text-white">Loader checks</p>
          <ul className="mt-3 grid gap-2 text-sm leading-5 text-rose-50/85">
            {(errors.length > 0 ? errors : ["Unknown command center loader failure"]).map((error) => (
              <li key={error} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
                {error}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
            Retry command center
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link href="/admin/control-center" className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/15 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20">
            Open Control Tower
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

export function AdminCommandCenter({ osData, controlData, revenueOps }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("today");
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);

  const lastChecked = formatDateTime(controlData.generatedAt || osData.generatedAt);
  const smsLive = controlData.controls.smsLive;

  const snapshot = useMemo(
    () => buildSnapshot(osData),
    [osData],
  );
  const actions = useMemo(
    () => buildDailyActions(osData, controlData, smsLive).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]),
    [osData, controlData, smsLive],
  );
  const health = useMemo(
    () => buildHealthPanels(osData, controlData),
    [osData, controlData],
  );
  const agents = useMemo(
    () => buildAgentWorkload(osData, controlData),
    [osData, controlData],
  );
  const messages = useMemo(
    () => buildMessageMetrics(osData, controlData, smsLive),
    [osData, controlData, smsLive],
  );
  const replies = useMemo(
    () => buildReplyInbox(osData, smsLive),
    [osData, smsLive],
  );
  const drafts = useMemo(
    () => buildSocialDrafts(osData),
    [osData],
  );
  const brief = useMemo(
    () => buildExecutiveBrief(osData, controlData, actions, health),
    [osData, controlData, actions, health],
  );
  const sourceWarnings = useMemo(
    () => combineSourceWarnings(brief.sourceWarnings, revenueOps.sourceErrors),
    [brief.sourceWarnings, revenueOps.sourceErrors],
  );
  const readiness = useMemo(
    () => buildOperatingReadiness(osData, controlData, revenueOps, actions, health, sourceWarnings),
    [osData, controlData, revenueOps, actions, health, sourceWarnings],
  );

  const actionQueue = actions.filter((action) => action.status !== "Completed" || action.priority === "P0");
  const filteredActions = activeFilter === "today"
    ? actionQueue
    : actions.filter((action) => action.tags.includes(activeFilter));

  const systemIssues = health.filter((item) => item.status !== "Healthy").length;
  const completedToday = actions.filter((action) => action.status === "Completed").length;
  const urgentActions = actionQueue.filter((action) => action.priority === "P0" || action.priority === "P1").length;
  const approvalsWaiting = totalMetricValues(controlData.approvalQueue);
  const aiWorkWaiting = agents.reduce((total, agent) => total + agent.waiting + agent.blocked + agent.errors, 0);
  const systemStatus: UiStatus = health.some((item) => item.status === "Broken")
    ? "Broken"
    : systemIssues > 0
      ? "Warning"
      : "Healthy";
  const aiWorkStatus: UiStatus = agents.some((agent) => agent.status === "Broken" || agent.blocked > 0 || agent.errors > 0)
    ? "Broken"
    : aiWorkWaiting > 0
      ? "Warning"
      : "Healthy";
  const triageItems: CommandRailItem[] = [
    {
      label: "Owner actions",
      value: String(urgentActions),
      detail: `${actionQueue.length} open item${actionQueue.length === 1 ? "" : "s"} after completed work is filtered out.`,
      action: "Work queue",
      href: "/admin#daily-action-center",
      icon: CheckCircle2,
      status: urgentActions > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Reply inbox",
      value: String(osData.communications.pendingReplies),
      detail: `${osData.communications.unreadTexts} texts, ${osData.communications.unreadEmails} emails, ${osData.communications.unreadDms} DMs unread.`,
      action: "Open inbox",
      href: "/admin/inbox",
      icon: Inbox,
      status: osData.communications.pendingReplies > 0 ? "Warning" : "Healthy",
    },
    {
      label: "AI approvals",
      value: String(approvalsWaiting),
      detail: `${aiWorkWaiting} AI workload item${aiWorkWaiting === 1 ? "" : "s"} waiting, blocked, or in error state.`,
      action: "Review AI",
      href: "/admin/agents",
      icon: Bot,
      status: aiWorkStatus,
    },
    {
      label: "System health",
      value: String(systemIssues),
      detail: `${sourceWarnings.length} source warning${sourceWarnings.length === 1 ? "" : "s"} in the current snapshot.`,
      action: "Open controls",
      href: "/admin/control-center",
      icon: ShieldCheck,
      status: systemStatus,
    },
  ];
  const operatorShortcuts: OperatorShortcut[] = [
    {
      label: "Reply now",
      href: "/admin/inbox",
      detail: `${osData.communications.pendingReplies} pending repl${osData.communications.pendingReplies === 1 ? "y" : "ies"} across text, email, and DM.`,
      icon: MessageSquare,
      status: osData.communications.pendingReplies > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Review approvals",
      href: "/admin/revenue-operations",
      detail: `${approvalsWaiting} draft or AI approval item${approvalsWaiting === 1 ? "" : "s"} waiting behind the human gate.`,
      icon: ShieldCheck,
      status: approvalsWaiting > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Recover payments",
      href: "/admin/orders",
      detail: `${osData.revenue.failedPayments} failed payment${osData.revenue.failedPayments === 1 ? "" : "s"} and ${osData.revenue.pendingInvoices} pending invoice${osData.revenue.pendingInvoices === 1 ? "" : "s"}.`,
      icon: DollarSign,
      status: osData.revenue.failedPayments > 0 ? "Broken" : osData.revenue.pendingInvoices > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Generate proposal",
      href: "/admin/political/proposals",
      detail: `${osData.revenue.pendingProposals} proposal${osData.revenue.pendingProposals === 1 ? "" : "s"} pending review or follow-up.`,
      icon: Send,
      status: osData.revenue.pendingProposals > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Sales queue",
      href: "/admin/sales-engine",
      detail: `${revenueOps.counts.hotLeads} hot lead${revenueOps.counts.hotLeads === 1 ? "" : "s"} and ${revenueOps.counts.followUpsDue} follow-up${revenueOps.counts.followUpsDue === 1 ? "" : "s"} due.`,
      icon: Phone,
      status: revenueOps.counts.hotLeads + revenueOps.counts.followUpsDue > 0 ? "Warning" : "Healthy",
    },
  ];

  async function copyDraft(draft: SocialDraft) {
    try {
      await navigator.clipboard.writeText(draft.copy);
      setCopiedDraftId(draft.id);
      window.setTimeout(() => setCopiedDraftId(null), 1800);
    } catch {
      setCopiedDraftId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[linear-gradient(135deg,#07111f_0%,#0e2342_55%,#102f37_100%)]">
        <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-7 px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <Activity className="h-3.5 w-3.5" />
                Admin Command Center
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                Today at HomeReach
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                One operating view for revenue, replies, AI work, campaigns, health checks, and owner decisions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/os"
                className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Legacy OS view
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin/control-center"
                className="inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/15 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20"
              >
                Control Tower
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {snapshot.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>

          <OperatingReadinessPanel
            readiness={readiness}
            generatedAt={{
              os: osData.generatedAt,
              control: controlData.generatedAt,
              revenue: revenueOps.generatedAt,
            }}
          />
          <OperatorShortcutRail items={operatorShortcuts} />
          <ExecutiveBriefPanel brief={brief} />
          <CommandRail items={triageItems} />
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[1540px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <RevenueOpsRadar snapshot={revenueOps} />

        <div id="daily-action-center" className="flex scroll-mt-6 flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Daily Action Center</h2>
              <p className="text-sm text-slate-400">
                Priority-sorted unfinished work. {completedToday} completed item{completedToday === 1 ? "" : "s"} are recorded in today&apos;s activity.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Clock3 className="h-4 w-4 text-cyan-200" />
              Last checked {lastChecked}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  activeFilter === filter.key
                    ? "border-cyan-300 bg-cyan-300 text-slate-950"
                    : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredActions.length > 0 ? (
          <div className="grid gap-3">
            {filteredActions.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={activeFilter === "today" ? "No unfinished daily actions" : "No actions match this filter"}
            detail={activeFilter === "today"
              ? "Today is clear based on the current HomeReach OS and Control Tower snapshot. Completed work still feeds the metrics above."
              : "Nothing is waiting here right now. The command center will surface new work as data arrives."}
          />
        )}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            <SectionHeader
              icon={ShieldCheck}
              title="System Health"
              detail={`${systemIssues} item${systemIssues === 1 ? "" : "s"} need review. Simple labels are mapped from the existing Control Tower.`}
              actionHref="/admin/control-center"
              actionLabel="Open controls"
            />
            {sourceWarnings.length > 0 ? (
              <SourceWarningPanel warnings={sourceWarnings} />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {health.map((item) => (
                <HealthCard key={`${item.source}-${item.name}`} item={item} />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={Bot}
              title="AI Agent Workload"
              detail="What each agent is doing today, what is blocked, and where owner approval is needed."
              actionHref="/admin/agents"
              actionLabel="View agents"
            />
            <div className="grid gap-3">
              {agents.map((agent) => (
                <AgentCard key={agent.name} agent={agent} />
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <SectionHeader
            icon={Send}
            title="Automated Message Tracking"
            detail="Today by channel or workflow. Tracked volume is not the same as approved outbound activity."
            actionHref="/admin/revenue-operations"
            actionLabel="Open messaging"
          />
          <div className="mt-4 grid gap-3 md:hidden">
            {messages.map((row) => (
              <MessageMetricCard key={row.label} row={row} />
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Channel/workflow</th>
                  <th className="px-3 py-2">Tracked</th>
                  <th className="px-3 py-2">Delivery/source</th>
                  <th className="px-3 py-2">Failures</th>
                  <th className="px-3 py-2">Opens</th>
                  <th className="px-3 py-2">Clicks</th>
                  <th className="px-3 py-2">Replied</th>
                  <th className="px-3 py-2">Revenue/wins</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((row) => (
                  <tr key={row.label} className="rounded-md bg-slate-950/50">
                    <td className="rounded-l-md px-3 py-3 font-semibold text-white">
                      <Link className="inline-flex items-center gap-2 hover:text-cyan-200" href={row.href}>
                        {row.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <p className="mt-1 max-w-[240px] text-xs font-normal leading-5 text-slate-500">{row.note}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-200">{row.tracked}</td>
                    <td className="px-3 py-3 text-slate-200">{row.delivered}</td>
                    <td className="px-3 py-3 text-slate-200">{row.failed}</td>
                    <td className="px-3 py-3 text-slate-200">{row.opened}</td>
                    <td className="px-3 py-3 text-slate-200">{row.clicked}</td>
                    <td className="px-3 py-3 text-slate-200">{row.replied}</td>
                    <td className="px-3 py-3 text-slate-200">{row.converted}</td>
                    <td className="rounded-r-md px-3 py-3"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-4">
            <SectionHeader
              icon={Inbox}
              title="Unified Reply Inbox"
              detail="Customer and campaign replies across SMS, email, political, procurement, targeted, shared, and web channels."
              actionHref="/admin/inbox"
              actionLabel="Open inbox"
            />
            <div className="grid gap-3">
              {replies.length > 0 ? replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              )) : (
                <EmptyState
                  title="No open replies"
                  detail="Replies will appear here with AI suggested responses and quick owner controls."
                />
              )}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={Sparkles}
              title="Social Media Draft Center"
              detail="Drafts for local visibility, political outreach, procurement, shared postcard, targeted campaign, and DM workflows."
              actionHref="/admin/content-intel"
              actionLabel="Open content"
            />
            <div className="grid gap-3">
              {drafts.map((draft) => (
                <SocialDraftCard
                  key={draft.id}
                  draft={draft}
                  copied={copiedDraftId === draft.id}
                  onCopy={() => copyDraft(draft)}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function RevenueOpsRadar({ snapshot }: { snapshot: AdminRevenueOpsSnapshot }) {
  const topSource = snapshot.sourcePerformance[0];
  const metricCards = [
    {
      label: "Hot leads",
      value: snapshot.counts.hotLeads,
      detail: "High-intent or buying-signal opportunities ready for owner review.",
      href: "/admin/sales-engine",
      icon: DollarSign,
      status: snapshot.counts.hotLeads > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Stale opportunities",
      value: snapshot.counts.staleOpportunities,
      detail: "Interested, replied, or payment-stage leads getting colder.",
      href: "/admin/sales-engine",
      icon: AlertTriangle,
      status: snapshot.counts.staleOpportunities > 0 ? "Broken" : "Healthy",
    },
    {
      label: "Follow-ups due",
      value: snapshot.counts.followUpsDue,
      detail: "Touches that should be approved, revised, or assigned today.",
      href: "/admin/sales-engine",
      icon: Clock3,
      status: snapshot.counts.followUpsDue > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Draft approvals",
      value: snapshot.counts.draftApprovals,
      detail: "Revenue message and AI output drafts blocked by approval gates.",
      href: "/admin/revenue-operations",
      icon: ShieldCheck,
      status: snapshot.counts.draftApprovals > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Top source",
      value: topSource ? `${topSource.replyRate}%` : "0%",
      detail: topSource ? `${topSource.source}: ${topSource.hotLeads} hot / ${topSource.leads} recent.` : "No recent lead-source activity loaded.",
      href: "/admin/sales-dashboard",
      icon: Activity,
      status: topSource?.tone === "good" ? "Healthy" : topSource?.tone === "watch" ? "Warning" : "Needs Review",
    },
  ] satisfies Array<{
    label: string;
    value: string | number;
    detail: string;
    href: string;
    icon: LucideIcon;
    status: UiStatus;
  }>;

  return (
    <section id="revenue-ops-radar" className="scroll-mt-6 rounded-lg border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(15,23,42,0.74)_45%,rgba(16,185,129,0.08))] p-4 shadow-2xl shadow-black/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
            <DollarSign className="h-3.5 w-3.5" />
            Revenue Ops Radar
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">What should make money next</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Read-only view of hot leads, stale opportunities, follow-ups, approval gates, source performance, and revenue risk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/sales-engine" className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
            Sales engine
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/admin/revenue-operations" className="inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15">
            Revenue ops
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((metric) => (
          <RevenueRadarMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_0.85fr]">
        <RevenueSignalPanel
          title="Hot Leads"
          detail="Highest intent first. No outreach is sent from this panel."
          items={snapshot.hotLeads.slice(0, 5)}
          emptyTitle="No hot leads loaded"
          emptyDetail="High-intent leads will appear here as score, reply, and buying-signal data lands."
        />
        <div className="grid gap-4">
          <RevenueSignalPanel
            title="Stale Opportunities"
            detail="Deals most likely to lose momentum."
            items={snapshot.staleOpportunities.slice(0, 3)}
            emptyTitle="No stale opportunities"
            emptyDetail="Nothing is currently aging past the risk window."
            compact
          />
          <RevenueSignalPanel
            title="Follow-Ups Due"
            detail="Draft, revise, or assign before sending."
            items={snapshot.followUpsDue.slice(0, 3)}
            emptyTitle="No follow-ups due"
            emptyDetail="The follow-up queue is clear in this snapshot."
            compact
          />
        </div>
        <div className="grid gap-4">
          <DraftApprovalPanel approvals={snapshot.draftApprovals.slice(0, 4)} />
          <RevenueRiskPanel risks={snapshot.revenueRisks.slice(0, 3)} />
        </div>
      </div>

      <div className="mt-4">
        <LeadSourcePerformancePanel sources={snapshot.sourcePerformance} />
      </div>

      {snapshot.sourceErrors.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Revenue Ops snapshot is using the safest available partial data. {snapshot.sourceErrors.length} source check{snapshot.sourceErrors.length === 1 ? "" : "s"} need review.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RevenueRadarMetricCard({ metric }: { metric: { label: string; value: string | number; detail: string; href: string; icon: LucideIcon; status: UiStatus } }) {
  const Icon = metric.icon;
  return (
    <Link href={metric.href} className="rounded-lg border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/40 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
        </div>
        <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-slate-300">{metric.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusBadge status={metric.status} />
        <ArrowUpRight className="h-3.5 w-3.5 text-cyan-100" />
      </div>
    </Link>
  );
}

function RevenueSignalPanel({
  title,
  detail,
  items,
  emptyTitle,
  emptyDetail,
  compact = false,
}: {
  title: string;
  detail: string;
  items: RevenueOpsLeadSignal[];
  emptyTitle: string;
  emptyDetail: string;
  compact?: boolean;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">{detail}</p>
        </div>
        <StatusBadge status={items.length > 0 ? "Warning" : "Healthy"} />
      </div>
      <div className="mt-4 grid gap-2">
        {items.length > 0 ? items.map((lead) => (
          <RevenueLeadSignalRow key={`${title}-${lead.id}`} lead={lead} compact={compact} />
        )) : (
          <EmptyState title={emptyTitle} detail={emptyDetail} />
        )}
      </div>
    </section>
  );
}

function RevenueLeadSignalRow({ lead, compact }: { lead: RevenueOpsLeadSignal; compact?: boolean }) {
  return (
    <Link href={lead.href} className="rounded-md border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{lead.businessName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {lead.city} / {lead.category} / {lead.source}
          </p>
        </div>
        <StatusBadge status={toneToStatus(lead.tone)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-white/10 px-2 py-0.5">Score {lead.score}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5">{lead.status}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5">{lead.lastActivity}</span>
        {!compact ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-emerald-100">{lead.estimatedValue} est.</span> : null}
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-300">{lead.reason}</p>
      {!compact ? (
        <p className="mt-2 text-xs leading-5 text-cyan-100">Next: {lead.nextAction}</p>
      ) : null}
    </Link>
  );
}

function DraftApprovalPanel({ approvals }: { approvals: RevenueOpsApproval[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Draft Approvals</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">Nothing sends or publishes until these are reviewed.</p>
        </div>
        <StatusBadge status={approvals.length > 0 ? "Warning" : "Healthy"} />
      </div>
      <div className="mt-4 grid gap-2">
        {approvals.length > 0 ? approvals.map((approval) => (
          <Link key={approval.id} href={approval.href} className="rounded-md border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.07]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{approval.title}</p>
                <p className="mt-1 text-xs text-slate-500">{approval.source} / {formatDateTime(approval.createdAt)}</p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-100">
                {approval.status}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{approval.preview}</p>
          </Link>
        )) : (
          <EmptyState title="No draft approvals" detail="Approval queues are clear in this snapshot." />
        )}
      </div>
    </section>
  );
}

function RevenueRiskPanel({ risks }: { risks: RevenueRiskSignal[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Revenue Risk</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">Estimated impact is directional, not a guarantee.</p>
        </div>
        <StatusBadge status={risks.some((risk) => risk.severity === "high") ? "Broken" : risks.some((risk) => risk.severity === "medium") ? "Warning" : "Healthy"} />
      </div>
      <div className="mt-4 grid gap-2">
        {risks.length > 0 ? risks.map((risk) => (
          <Link key={risk.id} href={risk.href} className="rounded-md border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.07]">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-white">{risk.title}</p>
              <StatusBadge status={riskSeverityStatus(risk.severity)} />
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-300">{risk.detail}</p>
            <div className="mt-3 rounded-md border border-white/10 bg-slate-950/50 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Owner action</p>
              <p className="mt-1 text-xs leading-5 text-slate-200">{risk.ownerAction}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-100">Impact: {risk.estimatedImpact}</p>
            </div>
          </Link>
        )) : (
          <EmptyState title="No revenue risks loaded" detail="The risk panel will populate after lead, follow-up, approval, and source checks return." />
        )}
      </div>
    </section>
  );
}

function LeadSourcePerformancePanel({ sources }: { sources: LeadSourcePerformance[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Lead Source Performance</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">Last 30 days by source, with hot leads, replies, wins, and estimated open value.</p>
        </div>
        <Link href="/admin/sales-dashboard" className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
          Sales intelligence
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        {sources.length > 0 ? (
          <>
            <div className="grid gap-3 md:hidden">
              {sources.map((source) => (
                <LeadSourceCard key={source.source} source={source} />
              ))}
            </div>
            <table className="hidden w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm md:table">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Hot</th>
                  <th className="px-3 py-2">Replies</th>
                  <th className="px-3 py-2">Wins</th>
                  <th className="px-3 py-2">Reply rate</th>
                  <th className="px-3 py-2">Open value</th>
                  <th className="px-3 py-2">Next action</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.source} className="bg-white/[0.04]">
                    <td className="rounded-l-md px-3 py-3 font-semibold text-white">{source.source}</td>
                    <td className="px-3 py-3 text-slate-200">{source.leads}</td>
                    <td className="px-3 py-3 text-slate-200">{source.hotLeads}</td>
                    <td className="px-3 py-3 text-slate-200">{source.replies}</td>
                    <td className="px-3 py-3 text-slate-200">{source.wins}</td>
                    <td className="px-3 py-3"><StatusBadge status={toneToStatus(source.tone)} /></td>
                    <td className="px-3 py-3 text-emerald-100">{formatCents(source.estimatedOpenValueCents)}</td>
                    <td className="rounded-r-md px-3 py-3 text-xs leading-5 text-slate-300">{source.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <EmptyState title="No lead source performance loaded" detail="Recent sales lead source data will appear here when available." />
        )}
      </div>
    </section>
  );
}

function LeadSourceCard({ source }: { source: LeadSourcePerformance }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-white">{source.source}</h4>
          <p className="mt-1 text-sm leading-5 text-slate-400">{source.nextAction}</p>
        </div>
        <StatusBadge status={toneToStatus(source.tone)} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
        <StatPill label="Leads" value={String(source.leads)} />
        <StatPill label="Hot" value={String(source.hotLeads)} />
        <StatPill label="Replies" value={String(source.replies)} />
        <StatPill label="Wins" value={String(source.wins)} />
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-white/10 px-2 py-0.5">{source.replyRate}% reply rate</span>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-emerald-100">
          {formatCents(source.estimatedOpenValueCents)} open value
        </span>
      </div>
    </article>
  );
}

function MetricCard({ metric }: { metric: SnapshotMetric }) {
  const Icon = metric.icon;

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
        </div>
        <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-300">{metric.detail}</p>
      <div className="mt-4">
        <StatusBadge status={metric.status} />
      </div>
    </article>
  );
}

function OperatingReadinessPanel({
  readiness,
  generatedAt,
}: {
  readiness: OperatingReadiness;
  generatedAt: { os: string; control: string; revenue: string };
}) {
  const styles: Record<ReadinessLevel, string> = {
    Ready: "border-emerald-300/25 bg-emerald-300/10",
    "Review First": "border-amber-300/25 bg-amber-300/10",
    Paused: "border-cyan-300/25 bg-cyan-300/10",
    Blocked: "border-rose-300/25 bg-rose-300/10",
  };

  return (
    <section className={`rounded-lg border p-4 ${styles[readiness.level]}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <ReadinessBadge level={readiness.level} />
            <span className="rounded-full border border-white/10 bg-slate-950/35 px-2.5 py-1 text-xs font-semibold text-slate-200">
              Approval gates remain active
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">{readiness.headline}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-200">{readiness.detail}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{readiness.guardrail}</p>
        </div>
        <div className="grid shrink-0 grid-cols-1 gap-2 text-xs text-slate-300 sm:grid-cols-3 xl:min-w-[460px]">
          <FreshnessPill label="OS" value={formatDateTime(generatedAt.os)} />
          <FreshnessPill label="Controls" value={formatDateTime(generatedAt.control)} />
          <FreshnessPill label="Revenue" value={formatDateTime(generatedAt.revenue)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readiness.items.map((item) => (
          <Link key={item.label} href={item.href} className="border-l border-white/15 pl-3 transition hover:border-cyan-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-300">{item.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FreshnessPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/35 px-3 py-2">
      <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ReadinessBadge({ level }: { level: ReadinessLevel }) {
  const classes: Record<ReadinessLevel, string> = {
    Ready: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    "Review First": "border-amber-300/25 bg-amber-300/10 text-amber-100",
    Paused: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    Blocked: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[level]}`}>
      {level === "Ready" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : level === "Blocked" ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {level}
    </span>
  );
}

function ExecutiveBriefPanel({ brief }: { brief: ExecutiveBrief }) {
  const items = [
    { label: "What happened today", value: brief.happenedToday },
    { label: "Needs attention", value: brief.needsAttention },
    { label: "Makes money today", value: brief.moneyToday },
    { label: "System posture", value: brief.systemPosture },
  ];

  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <div className="grid gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="border-l border-cyan-300/25 pl-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">{item.label}</p>
            <p className="mt-2 text-sm leading-5 text-slate-200">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommandRail({ items }: { items: CommandRailItem[] }) {
  const cardStyles: Record<UiStatus, string> = {
    Healthy: "border-emerald-300/20 bg-emerald-300/10",
    Warning: "border-amber-300/25 bg-amber-300/10",
    Broken: "border-rose-300/25 bg-rose-300/10",
    "Needs Review": "border-slate-300/20 bg-white/[0.05]",
  };

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`rounded-lg border p-4 transition hover:border-cyan-200/60 ${cardStyles[item.status]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-300">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
              </div>
              <span className="rounded-md border border-white/10 bg-slate-950/45 p-2 text-cyan-100">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 min-h-10 text-sm leading-5 text-slate-300">{item.detail}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <StatusBadge status={item.status} />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-100">
                {item.action}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function OperatorShortcutRail({ items }: { items: OperatorShortcut[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Operator shortcuts</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Fastest safe next actions</h2>
        </div>
        <p className="text-sm leading-5 text-slate-400">
          Links only. Sends, charges, pricing, and campaign changes still require approval.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
                  <Icon className="h-4 w-4" />
                </span>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-3 font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ActionRow({ action }: { action: DailyAction }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.07]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={action.priority} />
            <ActionStateBadge status={action.status} />
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300">{action.source}</span>
            <span className="text-xs text-slate-500">{action.timestamp}</span>
          </div>
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{action.title}</h3>
              <p className="mt-1 text-sm leading-5 text-slate-300">{action.nextStep}</p>
            </div>
            <div className="shrink-0 rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Today</p>
              <p className="text-lg font-semibold text-cyan-100">{action.value}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span>Owner: {action.owner}</span>
            <span>Category: {action.category}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          {action.actions.map((quickAction) => (
            <QuickActionButton key={`${action.id}-${quickAction.label}`} action={quickAction} />
          ))}
        </div>
      </div>
    </article>
  );
}

function HealthCard({ item }: { item: HealthPanel }) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{item.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{item.source}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-300">{item.issue}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-400">{item.action}</p>
        {item.href ? (
          <Link href={item.href} className="shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
            Review
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function SourceWarningPanel({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
        <div>
          <p className="text-sm font-semibold text-amber-50">Some source checks need review</p>
          <p className="mt-1 text-sm leading-5 text-amber-100/80">
            The dashboard is still showing the safest available snapshot, but these loaders reported issues:
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
            {warnings.slice(0, 4).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentWorkload }) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{agent.name}</h3>
          <p className="text-sm text-slate-400">{agent.area}</p>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <StatPill label="Done" value={String(agent.completed)} />
        <StatPill label="Running" value={String(agent.running)} />
        <StatPill label="Approval" value={String(agent.waiting)} />
        <StatPill label="Blocked" value={String(agent.blocked)} />
      </dl>
      <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <p>Revenue: {agent.revenueImpact}</p>
        <p>Lead impact: {agent.leadImpact}</p>
        <p>Errors: {agent.errors}</p>
        <p>Next: {agent.nextAction}</p>
      </div>
      <Link href={agent.href} className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
        Open agent
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function ReplyCard({ reply }: { reply: ReplyItem }) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{reply.contact}</h3>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300">{reply.channel}</span>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-100">{reply.urgency}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{reply.business} - {reply.stage}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reply.actions.map((action) => (
            <QuickActionButton key={`${reply.id}-${action.label}`} action={action} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-300">{reply.preview}</p>
      <div className="mt-3 rounded-md border border-cyan-300/15 bg-cyan-300/10 p-3 text-sm text-cyan-50">
        AI suggestion: {reply.aiResponse}
      </div>
    </article>
  );
}

function MessageMetricCard({ row }: { row: MessageMetric }) {
  return (
    <Link href={row.href} className="rounded-lg border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{row.label}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">{row.note}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <StatPill label="Tracked" value={row.tracked} />
        <StatPill label="Failures" value={row.failed} />
        <StatPill label="Replies" value={row.replied} />
        <StatPill label="Revenue/wins" value={row.converted} />
      </dl>
      <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-400">
        <p>Delivery/source: {row.delivered}</p>
        <p>Opens: {row.opened} / Clicks: {row.clicked}</p>
      </div>
    </Link>
  );
}

function SocialDraftCard({
  draft,
  copied,
  onCopy,
}: {
  draft: SocialDraft;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">{draft.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{draft.platform} - {draft.audience}</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
          {draft.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">Goal: {draft.goal}</p>
      <p className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-5 text-slate-200">{draft.copy}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={draft.href} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
          Edit
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link href={draft.href} className="inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15">
          Open approval gate
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
        <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
          <ShieldCheck className="h-3.5 w-3.5" />
          Approval required before posting or template changes
        </div>
      </div>
    </article>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-400">{detail}</p>
        </div>
      </div>
      <Link href={actionHref} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">
        {actionLabel}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  return (
    <Link
      href={action.href}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-50"
    >
      {buttonIconFor(action.label)}
      {action.label}
    </Link>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: UiStatus }) {
  const classes: Record<UiStatus, string> = {
    Healthy: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    Warning: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    Broken: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    "Needs Review": "border-slate-300/20 bg-slate-300/10 text-slate-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>
      {statusIcon(status)}
      {status}
    </span>
  );
}

function ActionStateBadge({ status }: { status: ActionState }) {
  const classes: Record<ActionState, string> = {
    Completed: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    Pending: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    Failed: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    Review: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    Scheduled: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  };

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const classes: Record<Priority, string> = {
    P0: "border-rose-300/30 bg-rose-300/10 text-rose-100",
    P1: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    P2: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
    P3: "border-white/10 bg-white/[0.04] text-slate-300",
  };

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[priority]}`}>{priority}</span>;
}

function toneToStatus(tone: RevenueOpsLeadSignal["tone"] | LeadSourcePerformance["tone"]): UiStatus {
  if (tone === "good") return "Healthy";
  if (tone === "watch") return "Warning";
  if (tone === "danger") return "Broken";
  return "Needs Review";
}

function riskSeverityStatus(severity: RevenueRiskSignal["severity"]): UiStatus {
  if (severity === "high") return "Broken";
  if (severity === "medium") return "Warning";
  return "Needs Review";
}

function formatCents(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function combineSourceWarnings(...groups: Array<Array<string | undefined> | undefined>): string[] {
  const seen = new Set<string>();
  const warnings: string[] = [];

  for (const group of groups) {
    for (const warning of group ?? []) {
      const clean = warning?.trim();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      warnings.push(clean);
    }
  }

  return warnings;
}

function buildOperatingReadiness(
  osData: HomeReachOSData,
  controlData: FoundationControlTowerData,
  revenueOps: AdminRevenueOpsSnapshot,
  actions: DailyAction[],
  health: HealthPanel[],
  sourceWarnings: string[],
): OperatingReadiness {
  const openActions = actions.filter((action) => action.status !== "Completed");
  const p0Actions = openActions.filter((action) => action.priority === "P0");
  const urgentActions = openActions.filter((action) => action.priority === "P0" || action.priority === "P1");
  const brokenHealth = health.filter((item) => item.status === "Broken");
  const approvalCount = Math.max(totalMetricValues(controlData.approvalQueue), revenueOps.counts.draftApprovals);
  const replyCount = osData.communications.pendingReplies;
  const controls = controlData.controls;
  const pausedChannels = [
    controls.emailPaused ? "email" : null,
    controls.smsPaused ? "SMS" : null,
    controls.facebookPaused ? "Facebook" : null,
  ].filter((item): item is string => Boolean(item));

  const outboundValue = controls.allPaused
    ? "All paused"
    : pausedChannels.length > 0
      ? `${pausedChannels.join(", ")} paused`
      : controls.manualApprovalMode || controls.testMode
        ? "Review mode"
        : "Live controls";

  const level: ReadinessLevel = controls.allPaused
    ? "Paused"
    : p0Actions.length > 0 || brokenHealth.length > 0
      ? "Blocked"
      : urgentActions.length > 0 || approvalCount > 0 || replyCount > 0 || sourceWarnings.length > 0
        ? "Review First"
        : "Ready";

  const headline = level === "Ready"
    ? "The command center is clear for the next normal operating pass."
    : level === "Paused"
      ? "Growth motion is intentionally paused until controls are reviewed."
      : level === "Blocked"
        ? "Resolve critical blockers before scaling outbound or revenue work."
        : "Review the owner queue before increasing activity.";

  const detail = level === "Ready"
    ? "No critical blockers, source warnings, pending replies, or draft approval backlogs are visible in this snapshot."
    : level === "Paused"
      ? "The system is still readable, but paused controls should be treated as a deliberate stop sign for sends, posts, and automation."
      : level === "Blocked"
        ? `${p0Actions.length} P0 action${p0Actions.length === 1 ? "" : "s"} and ${brokenHealth.length} broken health item${brokenHealth.length === 1 ? "" : "s"} need attention.`
        : `${urgentActions.length} urgent owner item${urgentActions.length === 1 ? "" : "s"}, ${approvalCount} approval item${approvalCount === 1 ? "" : "s"}, and ${replyCount} pending repl${replyCount === 1 ? "y" : "ies"} are visible.`;

  return {
    level,
    headline,
    detail,
    guardrail: "This dashboard is read-only for sensitive actions: it can guide review, but it does not approve sending, publishing, charging, pricing changes, or campaign changes.",
    items: [
      {
        label: "Owner queue",
        value: `${urgentActions.length} urgent / ${openActions.length} open`,
        detail: p0Actions.length > 0 ? "Critical owner action is blocking daily readiness." : "Work queue excludes completed activity by default.",
        status: p0Actions.length > 0 ? "Broken" : urgentActions.length > 0 ? "Warning" : "Healthy",
        href: "/admin#daily-action-center",
      },
      {
        label: "Approvals",
        value: approvalCount > 0 ? `${approvalCount} waiting` : "Clear",
        detail: "Drafts, AI outputs, campaign work, and outbound messages remain approval-gated.",
        status: approvalCount > 0 ? "Warning" : "Healthy",
        href: "/admin/ai-assets",
      },
      {
        label: "Source confidence",
        value: sourceWarnings.length > 0 ? `${sourceWarnings.length} warning${sourceWarnings.length === 1 ? "" : "s"}` : "No warnings",
        detail: sourceWarnings.length > 0 ? "Counts may be partial. Review source warnings before making decisions." : "Primary OS, Control Tower, and revenue snapshots loaded.",
        status: sourceWarnings.length > 0 ? "Warning" : "Healthy",
        href: "/admin/control-center",
      },
      {
        label: "Outbound controls",
        value: outboundValue,
        detail: controls.smsLive ? "SMS live flag is enabled; approvals still apply before outbound use." : "SMS is not live or is awaiting review in this snapshot.",
        status: controls.allPaused ? "Warning" : pausedChannels.length > 0 || !controls.smsLive ? "Needs Review" : "Healthy",
        href: "/admin/control-center",
      },
    ],
  };
}

function buildExecutiveBrief(
  osData: HomeReachOSData,
  controlData: FoundationControlTowerData,
  actions: DailyAction[],
  health: HealthPanel[],
): ExecutiveBrief {
  const messagesSent = osData.performance.textsSent + osData.performance.emailsSent + osData.performance.dmsSent;
  const unfinished = actions.filter((action) => action.status !== "Completed");
  const urgent = unfinished.filter((action) => action.priority === "P0" || action.priority === "P1");
  const topAction = urgent[0] ?? unfinished[0] ?? null;
  const healthIssues = health.filter((item) => item.status !== "Healthy");
  const sourceWarnings = Object.entries(controlData.sourceErrors ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`);

  return {
    happenedToday: `${messagesSent} messages tracked, ${osData.ai.actions} AI actions completed, ${osData.leadIntelligence.newLeads} new leads, and ${osData.performance.dealsClosed} closed deal${osData.performance.dealsClosed === 1 ? "" : "s"}.`,
    needsAttention: topAction
      ? `${urgent.length} urgent item${urgent.length === 1 ? "" : "s"}. Start with ${topAction.title.toLowerCase()}: ${topAction.nextStep}`
      : "No unfinished owner actions are currently flagged in the command center.",
    moneyToday: `${osData.revenue.revenueToday} collected today, ${osData.revenue.projectedRevenue} projected pipeline, ${osData.revenue.pendingInvoices} invoice${osData.revenue.pendingInvoices === 1 ? "" : "s"} pending.`,
    systemPosture: healthIssues.length > 0
      ? `${healthIssues.length} system item${healthIssues.length === 1 ? "" : "s"} need review before scaling outbound.`
      : "Core systems report healthy in the current snapshot.",
    sourceWarnings,
  };
}

function buildSnapshot(osData: HomeReachOSData): SnapshotMetric[] {
  const replies = osData.communications.pendingReplies;
  const messagesSent = osData.performance.textsSent + osData.performance.emailsSent + osData.performance.dmsSent;
  const highestOpportunity = osData.leadIntelligence.opportunities[0] ?? null;

  return [
    {
      label: "Revenue today",
      value: osData.revenue.revenueToday,
      detail: `${osData.revenue.projectedRevenue} projected pipeline.`,
      icon: DollarSign,
      status: osData.revenue.failedPayments > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Needs attention",
      value: String(replies),
      detail: `${osData.communications.unreadTexts} texts, ${osData.communications.unreadEmails} emails, ${osData.communications.unreadDms} DMs unread.`,
      icon: Inbox,
      status: replies > 0 ? "Warning" : "Healthy",
    },
    {
      label: "Messages sent",
      value: String(messagesSent),
      detail: `${osData.performance.emailsSent} email, ${osData.performance.textsSent} SMS, ${osData.performance.dmsSent} DMs tracked.`,
      icon: Send,
      status: messagesSent > 0 ? "Healthy" : "Needs Review",
    },
    {
      label: "AI tasks completed",
      value: String(osData.ai.actions),
      detail: `${osData.ai.drafts} drafts and ${osData.performance.aiActions} AI actions tracked.`,
      icon: Bot,
      status: mapStatus(osData.ai.automationStatus),
    },
    {
      label: "Highest-value opportunity",
      value: highestOpportunity?.value ?? osData.revenue.stripePipeline,
      detail: highestOpportunity ? `${highestOpportunity.name}: ${highestOpportunity.nextAction}` : "Review today's revenue pipeline.",
      icon: Sparkles,
      status: highestOpportunity ? "Warning" : "Needs Review",
    },
  ];
}

function buildDailyActions(osData: HomeReachOSData, controlData: FoundationControlTowerData, smsLive: boolean): DailyAction[] {
  const now = formatDateTime(osData.generatedAt || controlData.generatedAt);
  const messagesSent = osData.performance.textsSent + osData.performance.emailsSent + osData.performance.dmsSent;
  const approvals = totalMetricValues(controlData.approvalQueue);
  const failedCommunications = metricValue(controlData.communicationHealth, "Failed communications") +
    metricValue(controlData.communicationHealth, "Email terminal events") +
    metricValue(controlData.communicationHealth, "Twilio failures") +
    metricValue(controlData.communicationHealth, "Automation failures");

  const baseActions: DailyAction[] = [
    {
      id: "outreach-sent",
      title: "Outbound activity tracked",
      value: String(messagesSent),
      status: messagesSent > 0 ? "Completed" : "Scheduled",
      priority: messagesSent > 0 ? "P3" : "P2",
      source: "Automated messages",
      owner: "Outreach Agent",
      timestamp: now,
      nextStep: messagesSent > 0 ? "Review replies and conversion signals from today's tracked messages." : "No outbound provider volume tracked yet. Review queued drafts before any send.",
      category: "Communications",
      tags: ["today", "ai_completed"],
      actions: [
        { label: "View messages", href: "/admin/revenue-operations" },
        { label: "Draft follow-up", href: "/admin/revenue-operations" },
        { label: "Escalate to owner", href: "/admin/control-center" },
      ],
    },
    {
      id: "follow-ups-due",
      title: "Follow-ups due today",
      value: String(osData.communications.missedFollowUps),
      status: osData.communications.missedFollowUps > 0 ? "Pending" : "Completed",
      priority: osData.communications.missedFollowUps > 0 ? "P1" : "P3",
      source: "Follow-Up Agent",
      owner: "Follow-Up Agent",
      timestamp: now,
      nextStep: osData.communications.missedFollowUps > 0 ? "Clear missed follow-ups before new outreach goes out." : "No missed follow-ups currently flagged.",
      category: "Revenue",
      tags: ["today", "needs_action", "revenue", "human_required"],
      actions: [
        { label: "Draft follow-up", href: "/admin/revenue-operations" },
        { label: "Open email thread", href: "/admin/inbox" },
        { label: "Open queue", href: "/admin/revenue-operations" },
      ],
    },
    {
      id: "new-leads",
      title: "New leads created",
      value: String(osData.leadIntelligence.newLeads),
      status: osData.leadIntelligence.newLeads > 0 ? "Pending" : "Completed",
      priority: osData.leadIntelligence.hotLeads > 0 ? "P1" : "P2",
      source: "Lead intelligence",
      owner: "Revenue Agent",
      timestamp: now,
      nextStep: `${osData.leadIntelligence.hotLeads} hot leads should be reviewed for same-day follow-up.`,
      category: "Revenue",
      tags: ["today", "revenue", "needs_action"],
      actions: [
        { label: "View customer", href: "/admin/leads" },
        { label: "Assign to AI agent", href: "/admin/agents" },
        { label: "Review payment link", href: "/admin/orders" },
      ],
    },
    {
      id: "customers-needing-response",
      title: "Customers needing response",
      value: String(osData.communications.pendingReplies),
      status: osData.communications.pendingReplies > 0 ? "Review" : "Completed",
      priority: osData.communications.pendingReplies > 0 ? "P1" : "P3",
      source: "Unified inbox",
      owner: "Reply Agent",
      timestamp: now,
      nextStep: osData.communications.pendingReplies > 0 ? "Respond to active replies before they go cold." : "No customer replies are currently waiting.",
      category: "Replies",
      tags: ["today", "needs_action", "replies", "human_required"],
      actions: [
        { label: smsLive ? "Open SMS thread" : "Open inbox", href: "/admin/inbox" },
        { label: "Open email thread", href: "/admin/inbox" },
        { label: "Open caller", href: "/admin/agent-view" },
        { label: "Escalate to owner", href: "/admin/control-center" },
      ],
    },
    {
      id: "intake-started",
      title: "Intake forms started",
      value: String(osData.communications.intakeSubmissions),
      status: osData.communications.intakeSubmissions > 0 ? "Pending" : "Completed",
      priority: osData.communications.intakeSubmissions > 0 ? "P2" : "P3",
      source: "Intake system",
      owner: "Intake QA Agent",
      timestamp: now,
      nextStep: "Confirm every intake has an owner, product path, and next step.",
      category: "Intake",
      tags: ["today", "needs_action", "human_required"],
      actions: [
        { label: "View customer", href: "/admin/intake" },
        { label: "Resend intake form", href: "/admin/intake" },
        { label: "Open intake queue", href: "/admin/intake" },
      ],
    },
    {
      id: "intake-abandoned",
      title: "Intake forms abandoned",
      value: String(osData.communications.websiteInquiries),
      status: osData.communications.websiteInquiries > 0 ? "Review" : "Completed",
      priority: osData.communications.websiteInquiries > 0 ? "P2" : "P3",
      source: "Website inquiries",
      owner: "Intake QA Agent",
      timestamp: now,
      nextStep: "Review incomplete inquiries and resend the right intake link where appropriate.",
      category: "Intake",
      tags: ["today", "needs_action", "human_required"],
      actions: [
        { label: "Resend intake form", href: "/admin/intake" },
        { label: "Open email thread", href: "/admin/inbox" },
        { label: "Assign to AI agent", href: "/admin/agents" },
      ],
    },
    {
      id: "payments-completed",
      title: "Payments completed",
      value: osData.revenue.revenueToday,
      status: "Completed",
      priority: "P3",
      source: "Stripe",
      owner: "Revenue Audit Agent",
      timestamp: now,
      nextStep: "Confirm paid records are tied to the right customer, product, and fulfillment status.",
      category: "Revenue",
      tags: ["today", "revenue", "ai_completed"],
      actions: [
        { label: "View customer", href: "/admin/orders" },
        { label: "View campaign", href: "/admin/campaigns" },
      ],
    },
    {
      id: "payments-failed",
      title: "Payments failed",
      value: String(osData.revenue.failedPayments),
      status: osData.revenue.failedPayments > 0 ? "Failed" : "Completed",
      priority: osData.revenue.failedPayments > 0 ? "P0" : "P3",
      source: "Stripe",
      owner: "Revenue Audit Agent",
      timestamp: now,
      nextStep: osData.revenue.failedPayments > 0 ? "Recover failed payments and confirm no order is stuck without payment." : "No failed payments currently reported.",
      category: "Revenue",
      tags: ["today", "failed", "revenue", "human_required"],
      actions: [
        { label: "Review payment link", href: "/admin/orders" },
        { label: "Open email thread", href: "/admin/inbox" },
        { label: "Escalate to owner", href: "/admin/control-center" },
      ],
    },
    {
      id: "campaigns-approval",
      title: "Campaigns needing approval",
      value: String(osData.operations.designApprovals + osData.revenue.pendingProposals),
      status: osData.operations.designApprovals + osData.revenue.pendingProposals > 0 ? "Review" : "Completed",
      priority: osData.operations.designApprovals + osData.revenue.pendingProposals > 0 ? "P1" : "P3",
      source: "Campaign operations",
      owner: "Design Agent",
      timestamp: now,
      nextStep: "Review the highest-value designs and proposals so fulfillment can keep moving after approval.",
      category: "Campaigns",
      tags: ["today", "waiting_approval", "human_required", "shared", "targeted"],
      actions: [
        { label: "Review draft", href: "/admin/ad-designer" },
        { label: "Edit message", href: "/admin/revenue-operations" },
        { label: "View campaign", href: "/admin/campaigns" },
      ],
    },
    {
      id: "print-design",
      title: "Print/design tasks pending",
      value: String(osData.operations.printJobs + osData.operations.designApprovals),
      status: osData.operations.printJobs + osData.operations.designApprovals > 0 ? "Pending" : "Completed",
      priority: osData.operations.printJobs + osData.operations.designApprovals > 0 ? "P2" : "P3",
      source: "Fulfillment",
      owner: "Design Agent",
      timestamp: now,
      nextStep: "Check print jobs, design approvals, BMEU drops, and delivery windows.",
      category: "Operations",
      tags: ["today", "needs_action", "shared", "targeted"],
      actions: [
        { label: "View campaign", href: "/admin/campaigns" },
        { label: "Review draft", href: "/admin/ad-designer" },
        { label: "Escalate to owner", href: "/admin/control-center" },
      ],
    },
    {
      id: "ai-completed",
      title: "AI agent tasks completed",
      value: String(osData.ai.actions),
      status: "Completed",
      priority: "P3",
      source: "AI agents",
      owner: "AI workforce",
      timestamp: now,
      nextStep: "Review completed AI actions for revenue impact, approvals, and blocked work.",
      category: "AI",
      tags: ["today", "ai_completed"],
      actions: [
        { label: "Assign to AI agent", href: "/admin/agents" },
        { label: "View messages", href: "/admin/revenue-operations" },
      ],
    },
    {
      id: "ai-blocked",
      title: "AI agent tasks blocked",
      value: String(approvals),
      status: approvals > 0 ? "Review" : "Completed",
      priority: approvals > 0 ? "P1" : "P3",
      source: "AI approval queue",
      owner: "Owner",
      timestamp: now,
      nextStep: approvals > 0 ? "Review AI drafts, political handoffs, and message approvals before anything sends." : "No AI approval backlog currently reported.",
      category: "AI",
      tags: ["today", "waiting_approval", "human_required"],
      actions: [
        { label: "Review approvals", href: "/admin/revenue-operations" },
        { label: "Open AI suggestions", href: "/admin/revenue-operations" },
        { label: "Edit message", href: "/admin/revenue-operations" },
      ],
    },
    {
      id: "manual-owner-actions",
      title: "Manual owner actions required",
      value: String(approvals + osData.communications.pendingReplies + osData.revenue.failedPayments),
      status: approvals + osData.communications.pendingReplies + osData.revenue.failedPayments > 0 ? "Review" : "Completed",
      priority: approvals + osData.communications.pendingReplies + osData.revenue.failedPayments > 0 ? "P1" : "P3",
      source: "Owner control",
      owner: "Jason",
      timestamp: now,
      nextStep: "Handle high-risk approvals, replies, failed payments, and escalation items first.",
      category: "Executive",
      tags: ["today", "human_required", "needs_action"],
      actions: [
        { label: "Escalate to owner", href: "/admin/control-center" },
        { label: "View customer", href: "/admin/crm" },
        { label: "Open control log", href: "/admin/control-center" },
      ],
    },
  ];

  if (failedCommunications > 0) {
    baseActions.unshift({
      id: "failed-communications",
      title: "Failed communications detected",
      value: String(failedCommunications),
      status: "Failed",
      priority: "P0",
      source: "Messaging health",
      owner: "Revenue Audit Agent",
      timestamp: now,
      nextStep: "Review provider events, suppressions, and failed automations before increasing outbound volume.",
      category: "Communications",
      tags: ["today", "failed", "system_health", "human_required"],
      actions: [
        { label: "View messages", href: "/admin/email-infrastructure" },
        { label: "Escalate to owner", href: "/admin/control-center" },
      ],
    });
  }

  return baseActions;
}

function buildHealthPanels(osData: HomeReachOSData, controlData: FoundationControlTowerData): HealthPanel[] {
  const findHealth = (name: string) => controlData.systemHealth.find((item) => item.name.toLowerCase().includes(name.toLowerCase()));
  const findProduct = (name: string) => osData.productOps.find((item) => item.name.toLowerCase().includes(name.toLowerCase()));
  const hasSourceErrors = Object.keys(controlData.sourceErrors ?? {}).length > 0;

  const fromFoundation = (displayName: string, search: string): HealthPanel => {
    const item = findHealth(search);
    return {
      name: displayName,
      status: mapStatus(item?.status ?? "idle"),
      issue: item?.detail ?? "No direct health check is currently reporting for this module.",
      action: item?.action ?? "Add direct instrumentation if this becomes operationally critical.",
      href: item?.href,
      source: "Control Tower",
    };
  };

  const fromProduct = (displayName: string, search: string): HealthPanel => {
    const product = findProduct(search);
    return {
      name: displayName,
      status: mapStatus(product?.status ?? "idle"),
      issue: product?.description ?? "Product module is available, but detailed status needs direct instrumentation.",
      action: product?.actions?.[0]?.label ?? "Review product operations.",
      href: product?.href,
      source: "HomeReach OS",
    };
  };

  return [
    fromFoundation("Website status", "Vercel"),
    fromFoundation("Stripe status", "Stripe"),
    fromFoundation("SMS status", "Twilio"),
    fromFoundation("Email status", "Postmark"),
    {
      name: "Intake form status",
      status: hasSourceErrors && controlData.sourceErrors.intake_open ? "Warning" : "Healthy",
      issue: controlData.sourceErrors.intake_open ?? `${osData.communications.intakeSubmissions} intake submissions tracked in the current OS snapshot.`,
      action: "Review intake submissions and abandonment visibility.",
      href: "/admin/intake",
      source: "HomeReach OS",
    },
    fromFoundation("Database status", "Supabase"),
    {
      name: "AI agent status",
      status: mapStatus(osData.ai.automationStatus),
      issue: `${osData.ai.actions} AI actions, ${osData.ai.drafts} drafts, and ${osData.ai.agents.length} active agent records.`,
      action: "Keep high-risk AI actions in review/approval mode.",
      href: "/admin/agents",
      source: "HomeReach OS",
    },
    {
      name: "Automation/webhook status",
      status: worseStatus(mapStatus(findHealth("Webhook")?.status ?? "online"), mapStatus(findHealth("Automation")?.status ?? "online")),
      issue: `${findHealth("Webhook")?.detail ?? "Webhook health not directly reported."} ${findHealth("Automation")?.detail ?? ""}`.trim(),
      action: "Review webhook and automation failures before scaling outbound.",
      href: "/admin/control-center",
      source: "Control Tower",
    },
    {
      name: "Social draft engine status",
      status: osData.ai.drafts > 0 ? "Warning" : "Healthy",
      issue: `${osData.ai.drafts} drafts are currently tracked for review or publishing workflows.`,
      action: "Review drafts before posting or exporting.",
      href: "/admin/content-intel",
      source: "Content intelligence",
    },
    fromProduct("Political dashboard status", "political"),
    fromProduct("Procurement dashboard status", "procurement"),
    fromProduct("Shared postcard system status", "shared"),
    fromProduct("Targeted campaign system status", "targeted"),
  ];
}

function buildAgentWorkload(osData: HomeReachOSData, controlData: FoundationControlTowerData): AgentWorkload[] {
  const baseAgents = [
    { name: "Outreach Agent", area: "Communications", href: "/admin/revenue-operations", impact: osData.revenue.projectedRevenue },
    { name: "Reply Agent", area: "Unified inbox", href: "/admin/inbox", impact: `${osData.communications.pendingReplies} replies` },
    { name: "Political Campaign Agent", area: "Political", href: "/admin/political/outreach-strategy", impact: `${osData.leadIntelligence.politicalOpportunities} opportunities` },
    { name: "Procurement Agent", area: "Procurement", href: "/admin/procurement", impact: `${metricValue(controlData.businessHealth, "Procurement actions")} actions` },
    { name: "Shared Postcard Agent", area: "Shared postcards", href: "/admin/spots", impact: `${osData.operations.activeCampaigns} campaigns` },
    { name: "Targeted Campaign Agent", area: "Targeted campaigns", href: "/admin/targeted-campaigns", impact: `${osData.leadIntelligence.routeOpportunities} route opportunities` },
    { name: "Design Agent", area: "Creative and print", href: "/admin/ad-designer", impact: `${osData.operations.designApprovals} approvals` },
    { name: "Revenue Audit Agent", area: "Payments and revenue", href: "/admin/revenue-operations", impact: osData.revenue.stripePipeline },
    { name: "Intake QA Agent", area: "Intake quality", href: "/admin/intake", impact: `${osData.communications.intakeSubmissions} intakes` },
    { name: "Social Media Draft Agent", area: "Content intelligence", href: "/admin/content-intel", impact: `${osData.ai.drafts} drafts` },
    { name: "Follow-Up Agent", area: "Follow-up engine", href: "/admin/revenue-operations", impact: `${osData.communications.missedFollowUps} due` },
  ];

  const approvals = totalMetricValues(controlData.approvalQueue);

  const statusRank: Record<UiStatus, number> = {
    Broken: 0,
    Warning: 1,
    "Needs Review": 2,
    Healthy: 3,
  };

  return baseAgents.map((agent, index) => {
    const matchingOsAgent = osData.ai.agents.find((item) => agent.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0] ?? "")) ?? osData.ai.agents[index % Math.max(osData.ai.agents.length, 1)];
    const matchingSpecialized = osData.specializedAgents.find((item) => agent.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0] ?? ""));
    const status = mapStatus(matchingSpecialized?.status ?? matchingOsAgent?.status ?? osData.ai.automationStatus);
    const waiting = matchingSpecialized?.approvalRequired ? 1 : Math.min(approvals, index % 3 === 0 ? approvals : 0);
    const blocked = status === "Broken" ? 1 : waiting > 0 && agent.name.includes("Political") ? 1 : 0;

    return {
      name: agent.name,
      area: agent.area,
      completed: Math.max(0, Math.floor(osData.ai.actions / baseAgents.length) + (index < osData.ai.actions % baseAgents.length ? 1 : 0)),
      running: matchingOsAgent?.queueCount ? Math.min(matchingOsAgent.queueCount, 4) : status === "Healthy" ? 1 : 0,
      waiting,
      blocked,
      revenueImpact: matchingSpecialized?.revenueImpact ?? agent.impact,
      leadImpact: agent.impact,
      errors: status === "Broken" ? 1 : 0,
      nextAction: matchingSpecialized?.nextAction ?? matchingOsAgent?.currentTask ?? "Review recommendations and approvals.",
      status,
      href: matchingSpecialized?.href ?? agent.href,
    };
  }).sort((a, b) =>
    b.blocked - a.blocked ||
    b.waiting - a.waiting ||
    b.errors - a.errors ||
    statusRank[a.status] - statusRank[b.status] ||
    a.name.localeCompare(b.name),
  );
}

function buildMessageMetrics(osData: HomeReachOSData, controlData: FoundationControlTowerData, smsLive: boolean): MessageMetric[] {
  const failedComms = metricValue(controlData.communicationHealth, "Failed communications");
  const emailFailures = metricValue(controlData.communicationHealth, "Email terminal events");
  const twilioFailures = metricValue(controlData.communicationHealth, "Twilio failures");
  const replies = osData.communications.pendingReplies;
  const conversions = osData.performance.dealsClosed;

  const provider = "Provider events";
  const unavailable = "Not tracked";

  return [
    {
      label: "SMS activity",
      tracked: String(osData.performance.textsSent),
      delivered: smsLive ? provider : "Twilio pending",
      failed: String(twilioFailures),
      opened: "Not tracked",
      clicked: provider,
      replied: String(osData.communications.unreadTexts),
      converted: String(conversions),
      note: "Provider-backed SMS volume when live. Replies still require human-approved handling.",
      status: smsLive ? (twilioFailures > 0 ? "Broken" : "Healthy") : "Needs Review",
      href: "/admin/revenue-operations",
    },
    {
      label: "Email activity",
      tracked: String(osData.performance.emailsSent),
      delivered: provider,
      failed: String(emailFailures),
      opened: provider,
      clicked: provider,
      replied: String(osData.communications.unreadEmails),
      converted: String(conversions),
      note: "Email counts are tracked from available infrastructure and event records.",
      status: emailFailures > 0 ? "Broken" : "Healthy",
      href: "/admin/email-infrastructure",
    },
    {
      label: "Facebook DM workload",
      tracked: String(osData.performance.dmsSent),
      delivered: "Manual / approval gated",
      failed: "0",
      opened: unavailable,
      clicked: unavailable,
      replied: String(osData.communications.unreadDms),
      converted: String(conversions),
      note: "Draft or tracked DM work only. Nothing is sent from this command center.",
      status: "Needs Review",
      href: "/admin/facebook",
    },
    {
      label: "Facebook group draft queue",
      tracked: String(osData.ai.drafts),
      delivered: "Approval first",
      failed: "0",
      opened: unavailable,
      clicked: unavailable,
      replied: "0",
      converted: "0",
      note: "Draft count for review. Posting requires owner approval outside this panel.",
      status: osData.ai.drafts > 0 ? "Warning" : "Healthy",
      href: "/admin/content-intel",
    },
    {
      label: "Follow-up workload",
      tracked: String(osData.performance.aiActions),
      delivered: provider,
      failed: String(failedComms),
      opened: provider,
      clicked: provider,
      replied: String(replies),
      converted: String(conversions),
      note: "AI and workflow activity that may include drafts, recommendations, and sent events.",
      status: failedComms > 0 ? "Warning" : "Healthy",
      href: "/admin/revenue-operations",
    },
    {
      label: "Payment recovery workload",
      tracked: String(osData.revenue.pendingInvoices),
      delivered: "Approval first",
      failed: String(osData.revenue.failedPayments),
      opened: "Provider if sent",
      clicked: "Provider if sent",
      replied: "0",
      converted: osData.revenue.revenueToday,
      note: "Pending invoices and failed payments are recovery work, not automatic charges.",
      status: osData.revenue.failedPayments > 0 ? "Broken" : "Healthy",
      href: "/admin/orders",
    },
    {
      label: "Intake reminder workload",
      tracked: String(osData.communications.websiteInquiries),
      delivered: "Provider if sent",
      failed: "0",
      opened: "Provider if sent",
      clicked: "Provider if sent",
      replied: String(osData.communications.intakeSubmissions),
      converted: String(osData.leadIntelligence.newLeads),
      note: "Incomplete inquiry volume that may need a reviewed reminder or intake link.",
      status: "Healthy",
      href: "/admin/intake",
    },
    {
      label: "Political outreach workload",
      tracked: String(osData.leadIntelligence.politicalOpportunities),
      delivered: "Approval first",
      failed: "0",
      opened: "Provider if sent",
      clicked: "Provider if sent",
      replied: String(osData.communications.campaignReplies),
      converted: String(osData.performance.proposalsSent),
      note: "Campaign work is planning and draft support only until human approval.",
      status: "Needs Review",
      href: "/admin/political/outreach-strategy",
    },
    {
      label: "Procurement outreach workload",
      tracked: String(metricValue(controlData.businessHealth, "Procurement actions")),
      delivered: "Approval first",
      failed: "0",
      opened: "Not applicable",
      clicked: "Not applicable",
      replied: "0",
      converted: String(osData.leadIntelligence.businessOpportunities),
      note: "Recommendations may identify savings, but cannot place orders or commit spend.",
      status: "Healthy",
      href: "/admin/procurement",
    },
    {
      label: "Targeted campaign workload",
      tracked: String(osData.leadIntelligence.routeOpportunities),
      delivered: "Approval first",
      failed: "0",
      opened: "Provider if sent",
      clicked: "Provider if sent",
      replied: "0",
      converted: String(osData.performance.proposalsSent),
      note: "Route opportunities and campaign planning require approval before activation.",
      status: "Healthy",
      href: "/admin/targeted-campaigns",
    },
    {
      label: "Shared postcard workload",
      tracked: String(osData.operations.activeCampaigns),
      delivered: "Campaign queue",
      failed: "0",
      opened: "Not applicable",
      clicked: "Not applicable",
      replied: "0",
      converted: String(osData.performance.dealsClosed),
      note: "Campaign queue visibility, not a print-ready or fulfillment approval.",
      status: "Healthy",
      href: "/admin/spots",
    },
  ];
}

function buildReplyInbox(osData: HomeReachOSData, smsLive: boolean): ReplyItem[] {
  return osData.communications.conversations.map((conversation) => ({
    id: conversation.id,
    contact: conversation.name,
    business: businessLabelFor(conversation.channel),
    channel: channelLabel(conversation.channel),
    preview: conversation.summary,
    stage: conversation.unread ? "Needs response" : "Monitoring",
    urgency: conversation.urgency >= 8 ? "High" : conversation.urgency >= 5 ? "Medium" : "Normal",
    aiResponse: conversation.nextAction,
    actions: [
      { label: smsLive ? "Open SMS thread" : "Open inbox", href: "/admin/inbox" },
      { label: "Open email thread", href: "/admin/inbox" },
      { label: "Assign to AI agent", href: "/admin/agents" },
      { label: "Open sales engine", href: "/admin/sales-engine" },
      { label: "Open thread", href: "/admin/inbox" },
      { label: "Escalate", href: "/admin/control-center" },
    ],
  }));
}

function buildSocialDrafts(osData: HomeReachOSData): SocialDraft[] {
  const topOpportunity = osData.leadIntelligence.opportunities[0];
  const topAction = osData.nextBestActions[0];

  return [
    {
      id: "facebook-group-local",
      title: "Facebook group post draft",
      audience: "Local business owners",
      platform: "Facebook Groups",
      goal: "Generate low-friction campaign inquiries",
      copy: "Local business owners: if you want more neighborhood visibility without managing another ad dashboard, HomeReach can build a simple postcard and follow-up plan around the routes that matter most. I can put together a quick local plan if you want to see what it would look like.",
      status: "Ready for review",
      href: "/admin/facebook",
    },
    {
      id: "business-owner-post",
      title: "Business owner post",
      audience: "Roofers, HVAC, lawn care, restaurants, and service businesses",
      platform: "Business page",
      goal: "Position HomeReach as done-for-you local growth",
      copy: "Most local businesses do not need more complicated software. They need more visibility, better follow-up, and a simple plan that keeps their name in front of the right neighborhoods. HomeReach handles the pieces that make that happen.",
      status: "Template",
      href: "/admin/content-intel",
    },
    {
      id: "local-city-post",
      title: "Local city post",
      audience: "Ohio city prospects",
      platform: "City/local pages",
      goal: "Support geographic SEO and social proof",
      copy: "We are building practical local visibility plans for Ohio businesses that want to own their neighborhood routes, stay remembered, and turn local attention into real leads.",
      status: "Ready for review",
      href: "/admin/growth-engine",
    },
    {
      id: "political-outreach-post",
      title: "Political outreach post",
      audience: "Campaign managers and local candidates",
      platform: "Political outreach",
      goal: "Drive campaign strategy conversations",
      copy: "Campaigns win when voters understand the message before Election Day. HomeReach helps campaigns plan targeted mail, coverage maps, rollout timing, and professional postcard concepts with clear execution visibility.",
      status: "Needs edit",
      href: "/admin/political/outreach-strategy",
    },
    {
      id: "procurement-dashboard-post",
      title: "Procurement dashboard post",
      audience: "Restaurants, contractors, and operators",
      platform: "LinkedIn or Facebook",
      goal: "Open procurement savings conversations",
      copy: "A lot of small businesses are leaking money through supplier pricing, delivery fees, invoice mismatches, and reorder timing. HomeReach helps surface those savings in plain language so owners can act quickly.",
      status: "Ready for review",
      href: "/admin/procurement",
    },
    {
      id: "shared-postcard-post",
      title: "Shared postcard post",
      audience: "Local advertisers",
      platform: "Facebook and email",
      goal: "Sell shared campaign spots",
      copy: "Shared postcard campaigns give local businesses a premium neighborhood presence without carrying the full cost alone. Pick your category, reserve your spot, and show up in front of the homes that matter.",
      status: "Ready for review",
      href: "/admin/spots",
    },
    {
      id: "targeted-campaign-post",
      title: "Targeted campaign post",
      audience: "Businesses needing specific neighborhoods",
      platform: "Business page and DM",
      goal: "Drive custom campaign proposals",
      copy: "Need to reach specific streets, ZIP codes, routes, or neighborhoods? HomeReach builds targeted campaign plans with map-backed coverage, clear pricing, and a simple proposal path.",
      status: "Template",
      href: "/admin/targeted-campaigns",
    },
    {
      id: "dm-draft",
      title: "DM draft",
      audience: topOpportunity?.name ?? "High-value local prospect",
      platform: "Facebook DM or LinkedIn",
      goal: topAction?.outcome ?? "Start a qualified conversation",
      copy: topOpportunity
        ? `Hi ${topOpportunity.name}, I noticed an opportunity to improve local visibility around ${topOpportunity.location}. HomeReach can put together a simple campaign plan with neighborhood coverage, postcard options, and follow-up recommendations. Want me to send a quick outline?`
        : "Hi, I wanted to reach out because HomeReach helps local businesses stay visible with simple, done-for-you postcard and follow-up campaigns. Want me to send a quick local plan?",
      status: "Ready for review",
      href: "/admin/revenue-operations",
    },
  ];
}

function buttonIconFor(label: string) {
  const lowered = label.toLowerCase();
  if (lowered.includes("sms") || lowered.includes("text") || lowered.includes("dm")) return <MessageSquare className="h-3.5 w-3.5" />;
  if (lowered.includes("email")) return <Mail className="h-3.5 w-3.5" />;
  if (lowered.includes("call")) return <Phone className="h-3.5 w-3.5" />;
  if (lowered.includes("approve") || lowered.includes("complete")) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (lowered.includes("reject") || lowered.includes("failed")) return <XCircle className="h-3.5 w-3.5" />;
  if (lowered.includes("payment")) return <DollarSign className="h-3.5 w-3.5" />;
  if (lowered.includes("agent")) return <Bot className="h-3.5 w-3.5" />;
  return <ArrowUpRight className="h-3.5 w-3.5" />;
}

function statusIcon(status: UiStatus) {
  if (status === "Healthy") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "Broken") return <XCircle className="h-3.5 w-3.5" />;
  if (status === "Warning") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}

function mapStatus(status: OSStatus | FoundationStatus): UiStatus {
  if (status === "online") return "Healthy";
  if (status === "watch") return "Warning";
  if (status === "critical") return "Broken";
  return "Needs Review";
}

function worseStatus(a: UiStatus, b: UiStatus): UiStatus {
  const rank: Record<UiStatus, number> = {
    Broken: 0,
    Warning: 1,
    "Needs Review": 2,
    Healthy: 3,
  };
  return rank[a] <= rank[b] ? a : b;
}

function metricValue(metrics: Array<{ label: string; value: string }>, label: string): number {
  const metric = metrics.find((item) => item.label.toLowerCase().includes(label.toLowerCase()));
  return numberFromString(metric?.value);
}

function totalMetricValues(metrics: Array<{ value: string }>): number {
  return metrics.reduce((sum, metric) => sum + numberFromString(metric.value), 0);
}

function numberFromString(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    sms: "SMS",
    email: "Email",
    dm: "DM",
    web: "Website",
    intake: "Intake",
  };
  return labels[channel] ?? channel;
}

function businessLabelFor(channel: string): string {
  if (channel === "sms") return "SMS reply";
  if (channel === "email") return "Email reply";
  if (channel === "dm") return "Social DM";
  if (channel === "intake") return "Intake form";
  return "Website inquiry";
}
