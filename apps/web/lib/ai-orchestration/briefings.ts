import { createServiceClient } from "@/lib/supabase/service";
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "./dashboard-agents";
import { getUnifiedActionCenter, type UnifiedActionCenter, type UnifiedActionItem } from "./action-center";

export type OperationalBriefingType = "morning" | "evening" | "manual" | "cron";
export type MonitorStatus = "ok" | "warning" | "critical" | "failed";

export interface DashboardMonitor {
  key: string;
  label: string;
  status: MonitorStatus;
  summary: string;
  recommendedAction: string;
}

export interface DashboardMonitorRun {
  id: string;
  createdAt: string;
  runKey: string;
  runType: OperationalBriefingType;
  triggeredBy: "admin" | "cron" | "system";
  status: MonitorStatus;
  summary: string;
  monitors: DashboardMonitor[];
  actionTotal: number;
  criticalActions: number;
  highActions: number;
  blockedActions: number;
  sourceUnavailableCount: number;
  dashboardAgentsReady: number;
  dashboardAgentsBlocked: number;
}

export interface OperationalBriefing {
  id: string;
  createdAt: string;
  briefingType: OperationalBriefingType;
  status: MonitorStatus;
  headline: string;
  summary: string;
  topActions: Array<{
    id: string;
    title: string;
    dashboard: string;
    urgency: UnifiedActionItem["urgency"];
    route: string;
    recommendedAction: string;
  }>;
  risks: string[];
  wins: string[];
  nextActions: string[];
  actionSummary: UnifiedActionCenter["summary"];
  sourceHealth: UnifiedActionCenter["sourceHealth"];
  deliveryStatus: "dashboard_only" | "queued" | "sent" | "failed" | "suppressed";
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function nowIso() {
  return new Date().toISOString();
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monitorStatusRank(status: MonitorStatus) {
  if (status === "critical") return 4;
  if (status === "failed") return 3;
  if (status === "warning") return 2;
  return 1;
}

function overallStatus(monitors: DashboardMonitor[]): MonitorStatus {
  return monitors.reduce<MonitorStatus>((current, monitor) => {
    return monitorStatusRank(monitor.status) > monitorStatusRank(current) ? monitor.status : current;
  }, "ok");
}

function toMonitorRun(row: Record<string, any>): DashboardMonitorRun {
  return {
    id: row.id,
    createdAt: row.created_at,
    runKey: row.run_key,
    runType: row.run_type,
    triggeredBy: row.triggered_by,
    status: row.status,
    summary: row.summary,
    monitors: row.monitors ?? [],
    actionTotal: row.action_total ?? 0,
    criticalActions: row.critical_actions ?? 0,
    highActions: row.high_actions ?? 0,
    blockedActions: row.blocked_actions ?? 0,
    sourceUnavailableCount: row.source_unavailable_count ?? 0,
    dashboardAgentsReady: row.dashboard_agents_ready ?? 0,
    dashboardAgentsBlocked: row.dashboard_agents_blocked ?? 0,
  };
}

function toBriefing(row: Record<string, any>): OperationalBriefing {
  return {
    id: row.id,
    createdAt: row.created_at,
    briefingType: row.briefing_type,
    status: row.status,
    headline: row.headline,
    summary: row.summary,
    topActions: row.top_actions ?? [],
    risks: row.risks ?? [],
    wins: row.wins ?? [],
    nextActions: row.next_actions ?? [],
    actionSummary: row.action_summary ?? {
      total: 0,
      critical: 0,
      high: 0,
      needsReview: 0,
      blocked: 0,
      humanApprovalRequired: 0,
    },
    sourceHealth: row.source_health ?? [],
    deliveryStatus: row.delivery_status ?? "dashboard_only",
  };
}

function buildMonitors(actionCenter: UnifiedActionCenter): DashboardMonitor[] {
  const dashboardAgents = getDashboardAgentMatrix();
  const dashboardAgentSummary = getDashboardAgentSummary(dashboardAgents);
  const unavailableSources = actionCenter.sourceHealth.filter((source) => source.status === "unavailable");
  const criticalActions = actionCenter.items.filter((item) => item.urgency === "critical");
  const blockedActions = actionCenter.items.filter((item) => item.status === "blocked");
  const politicalReplies = actionCenter.items.filter((item) => item.source === "revenue_message_threads");
  const govDeadlines = actionCenter.items.filter((item) => item.source === "gov_contract_opportunities");

  return [
    {
      key: "action_center",
      label: "Unified Action Center",
      status: criticalActions.length > 0 ? "critical" : actionCenter.summary.high > 0 ? "warning" : "ok",
      summary: `${actionCenter.summary.total} open actions, ${actionCenter.summary.critical} critical, ${actionCenter.summary.high} high.`,
      recommendedAction:
        criticalActions[0]?.recommendedAction ??
        actionCenter.items[0]?.recommendedAction ??
        "No immediate cross-dashboard action is required.",
    },
    {
      key: "source_health",
      label: "Source Health",
      status: unavailableSources.length > 0 ? "warning" : "ok",
      summary: `${actionCenter.sourceHealth.length - unavailableSources.length}/${actionCenter.sourceHealth.length} Action Center sources online.`,
      recommendedAction:
        unavailableSources.length > 0
          ? `Review unavailable source: ${unavailableSources[0]?.source ?? "unknown source"}.`
          : "Keep monitoring source availability.",
    },
    {
      key: "agent_readiness",
      label: "Dashboard Agent Readiness",
      status: dashboardAgentSummary.blocked > 0 ? "warning" : "ok",
      summary: `${dashboardAgentSummary.ready}/${dashboardAgentSummary.total} dashboard agents ready; ${dashboardAgentSummary.blocked} blocked.`,
      recommendedAction:
        dashboardAgentSummary.blocked > 0
          ? "Open the agent readiness matrix and clear the highest-impact blocker."
          : "Continue toward human-approved autonomy for ready agents.",
    },
    {
      key: "political_handoff",
      label: "Political Reply Handoff",
      status: politicalReplies.length > 0 ? "critical" : "ok",
      summary: `${politicalReplies.length} political reply or handoff item${politicalReplies.length === 1 ? "" : "s"} in the queue.`,
      recommendedAction:
        politicalReplies.length > 0
          ? "Open the political conversation and handle it manually before automation continues."
          : "No political handoff is waiting.",
    },
    {
      key: "gov_contract_deadlines",
      label: "Gov Contract Deadlines",
      status: govDeadlines.some((item) => item.urgency === "critical") ? "critical" : govDeadlines.length > 0 ? "warning" : "ok",
      summary: `${govDeadlines.length} government contract deadline item${govDeadlines.length === 1 ? "" : "s"} in the queue.`,
      recommendedAction:
        govDeadlines.length > 0
          ? "Open the strongest-fit opportunity and confirm go/no-go."
          : "No urgent Gov Contracts deadline is waiting.",
    },
  ];
}

function buildBriefingText(type: OperationalBriefingType, actionCenter: UnifiedActionCenter, monitors: DashboardMonitor[]) {
  const critical = actionCenter.summary.critical;
  const high = actionCenter.summary.high;
  const unavailable = actionCenter.sourceHealth.filter((source) => source.status === "unavailable").length;
  const label = type === "evening" ? "Evening" : type === "morning" ? "Morning" : "Manual";

  const headline =
    critical > 0
      ? `${label} briefing: ${critical} critical action${critical === 1 ? "" : "s"} need attention`
      : high > 0
        ? `${label} briefing: ${high} high-priority action${high === 1 ? "" : "s"} queued`
        : `${label} briefing: HomeReach systems are calm`;

  const summary = [
    `${actionCenter.summary.total} open cross-dashboard actions are visible.`,
    `${actionCenter.summary.humanApprovalRequired} require human approval.`,
    unavailable > 0
      ? `${unavailable} source${unavailable === 1 ? "" : "s"} need configuration or data review.`
      : "All Action Center sources checked by this run are online.",
    `Overall monitor status: ${overallStatus(monitors)}.`,
  ].join(" ");

  return { headline, summary };
}

export async function getRecentOperationalBriefings(limit = 4): Promise<OperationalBriefing[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_operational_briefings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map(toBriefing);
}

export async function getRecentDashboardMonitorRuns(limit = 8): Promise<DashboardMonitorRun[]> {
  if (!hasSupabaseEnv()) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_dashboard_monitor_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map(toMonitorRun);
}

export async function runOperationalBriefing(options: {
  type?: OperationalBriefingType;
  triggeredBy?: "admin" | "cron" | "system";
} = {}) {
  const type = options.type ?? "manual";
  const triggeredBy = options.triggeredBy ?? "admin";
  const generatedAt = nowIso();
  const actionCenter = await getUnifiedActionCenter(24);
  const monitors = buildMonitors(actionCenter);
  const status = overallStatus(monitors);
  const dashboardAgents = getDashboardAgentMatrix();
  const dashboardAgentSummary = getDashboardAgentSummary(dashboardAgents);
  const unavailableSources = actionCenter.sourceHealth.filter((source) => source.status === "unavailable");
  const runKey = `${dateKey()}-${type}-${triggeredBy}`;
  const { headline, summary } = buildBriefingText(type, actionCenter, monitors);
  const topActions = actionCenter.items.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    dashboard: item.dashboard,
    urgency: item.urgency,
    route: item.route,
    recommendedAction: item.recommendedAction,
  }));
  const risks = monitors
    .filter((monitor) => monitor.status === "critical" || monitor.status === "warning")
    .map((monitor) => `${monitor.label}: ${monitor.summary}`);
  const wins = monitors
    .filter((monitor) => monitor.status === "ok")
    .slice(0, 3)
    .map((monitor) => `${monitor.label}: ${monitor.summary}`);
  const nextActions = topActions.length > 0
    ? topActions.slice(0, 4).map((item) => item.recommendedAction)
    : ["No immediate action. Keep systems monitored."];

  const generated = {
    id: `generated-${runKey}`,
    createdAt: generatedAt,
    briefingType: type,
    status,
    headline,
    summary,
    topActions,
    risks,
    wins,
    nextActions,
    actionSummary: actionCenter.summary,
    sourceHealth: actionCenter.sourceHealth,
    deliveryStatus: "dashboard_only" as const,
  };

  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      briefing: generated,
      monitorRun: null,
      error: "Supabase is not configured, so the briefing was generated but not persisted.",
    };
  }

  const supabase = createServiceClient();

  const { data: monitorRun, error: monitorError } = await supabase
    .from("ai_dashboard_monitor_runs")
    .upsert(
      {
        run_key: runKey,
        run_type: type,
        triggered_by: triggeredBy,
        status,
        action_total: actionCenter.summary.total,
        critical_actions: actionCenter.summary.critical,
        high_actions: actionCenter.summary.high,
        blocked_actions: actionCenter.summary.blocked,
        source_unavailable_count: unavailableSources.length,
        dashboard_agents_ready: dashboardAgentSummary.ready,
        dashboard_agents_blocked: dashboardAgentSummary.blocked,
        summary,
        monitors,
        source_health: actionCenter.sourceHealth,
        metadata: {
          generatedAt,
          dashboardAgentSummary,
        },
      },
      { onConflict: "run_key" }
    )
    .select("*")
    .single();

  if (monitorError) {
    return { ok: false, briefing: generated, monitorRun: null, error: monitorError.message };
  }

  const { data: briefing, error: briefingError } = await supabase
    .from("ai_operational_briefings")
    .insert({
      briefing_type: type,
      status,
      headline,
      summary,
      top_actions: topActions,
      risks,
      wins,
      next_actions: nextActions,
      action_summary: actionCenter.summary,
      source_health: actionCenter.sourceHealth,
      monitor_run_id: monitorRun.id,
      delivery_status: "dashboard_only",
      metadata: {
        generatedAt,
        triggeredBy,
        dashboardAgentSummary,
      },
    })
    .select("*")
    .single();

  if (briefingError) {
    return {
      ok: false,
      briefing: generated,
      monitorRun: toMonitorRun(monitorRun),
      error: briefingError.message,
    };
  }

  return {
    ok: true,
    briefing: toBriefing(briefing),
    monitorRun: toMonitorRun(monitorRun),
  };
}

export function inferBriefingTypeForEasternTime(): OperationalBriefingType {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "8");
  return hour >= 15 ? "evening" : "morning";
}
