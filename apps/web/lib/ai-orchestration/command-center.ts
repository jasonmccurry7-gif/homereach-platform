import { getUnifiedActionCenter } from "./action-center";
import { getAgentMissionControl } from "./agent-mission-control";
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "./dashboard-agents";
import { getAiWorkforceSmokeReport } from "./ai-workforce-smoke";
import { getSourceFreshnessReport } from "./source-freshness";
import { getUserActionReadiness } from "./user-action-items";
import { getAiWorkforceFoundationState } from "./workforce-memory";

export interface AiCommandCenterState {
  generatedAt: string;
  status: "ok" | "warning" | "critical";
  headline: string;
  summary: {
    openActions: number;
    criticalActions: number;
    blockedActions: number;
    userActionsRequired: number;
    userActionsBlockingGoLive: number;
    dashboardAgentsReady: number;
    dashboardAgentsBlocked: number;
    sourceFreshnessIssues: number;
    persistentMemoryItems: number;
    persistentTasks: number;
    persistentIngestionItems: number;
    plannedWorkforceTasks: number;
    approvalLinkedWorkforceTasks: number;
    handoffReadyWorkforceTasks: number;
    linkedInternalTasks: number;
    completedInternalTasks: number;
    missionControlBlocked: number;
    smokeFailures: number;
  };
  topPriorities: Array<{
    title: string;
    route: string;
    owner: string;
    urgency: string;
    recommendedAction: string;
  }>;
  systemSignals: string[];
  safeNextSteps: string[];
}

function nowIso() {
  return new Date().toISOString();
}

function statusForState(summary: AiCommandCenterState["summary"]): AiCommandCenterState["status"] {
  if (summary.criticalActions > 0 || summary.userActionsBlockingGoLive > 0 || summary.smokeFailures > 0) return "critical";
  if (summary.blockedActions > 0 || summary.userActionsRequired > 0 || summary.sourceFreshnessIssues > 0) return "warning";
  return "ok";
}

function headlineForStatus(status: AiCommandCenterState["status"], summary: AiCommandCenterState["summary"]) {
  if (status === "critical") {
    return `${summary.criticalActions + summary.userActionsBlockingGoLive + summary.smokeFailures} critical AI Workforce item(s) need review before go-live expansion.`;
  }
  if (status === "warning") {
    return "AI Workforce OS is operating in supervised mode with setup and freshness items to review.";
  }
  return "AI Workforce OS foundation is calm and ready for supervised operation.";
}

export async function getAiCommandCenterState(limit = 8): Promise<AiCommandCenterState> {
  const dashboardAgents = getDashboardAgentMatrix();
  const [
    actionCenter,
    missionControl,
    sourceFreshness,
    smokeReport,
    workforceFoundation,
  ] = await Promise.all([
    getUnifiedActionCenter(24),
    getAgentMissionControl(),
    getSourceFreshnessReport(),
    getAiWorkforceSmokeReport(),
    getAiWorkforceFoundationState(6),
  ]);
  const userActions = getUserActionReadiness();
  const dashboardSummary = getDashboardAgentSummary(dashboardAgents);
  const sourceFreshnessIssues = sourceFreshness.items.filter((item) => item.status !== "fresh").length;
  const plannedWorkforceTasks = workforceFoundation.tasks.filter((task) => task.lastExecutionPlan).length;
  const approvalLinkedWorkforceTasks = workforceFoundation.tasks.filter((task) => task.approvalRequestId).length;
  const handoffReadyWorkforceTasks = workforceFoundation.tasks.filter((task) =>
    ["handoff_queued", "task_ready"].includes(task.executorStatus ?? "") && !task.internalTaskId
  ).length;
  const linkedInternalTasks = workforceFoundation.tasks.filter((task) => task.internalTaskId).length;
  const completedInternalTasks = workforceFoundation.tasks.filter((task) => task.internalTaskStatus === "done").length;

  const summary = {
    openActions: actionCenter.summary.total,
    criticalActions: actionCenter.summary.critical,
    blockedActions: actionCenter.summary.blocked,
    userActionsRequired: userActions.summary.total,
    userActionsBlockingGoLive: userActions.summary.blocksGoLive,
    dashboardAgentsReady: dashboardSummary.ready,
    dashboardAgentsBlocked: dashboardSummary.blocked,
    sourceFreshnessIssues,
    persistentMemoryItems: workforceFoundation.summary.activeMemory,
    persistentTasks: workforceFoundation.summary.openTasks,
    persistentIngestionItems: workforceFoundation.summary.ingestionQueued,
    plannedWorkforceTasks,
    approvalLinkedWorkforceTasks,
    handoffReadyWorkforceTasks,
    linkedInternalTasks,
    completedInternalTasks,
    missionControlBlocked: missionControl.summary.blocked,
    smokeFailures: smokeReport.summary.failed,
  };
  const status = statusForState(summary);

  const topPriorities = actionCenter.items.slice(0, limit).map((item) => ({
    title: item.title,
    route: item.route,
    owner: item.owner,
    urgency: item.urgency,
    recommendedAction: item.recommendedAction,
  }));

  const systemSignals = [
    `${dashboardSummary.ready}/${dashboardSummary.total} dashboard agents are ready.`,
    `${missionControl.summary.humanApproval} agents are in human-approval mode.`,
    `${sourceFreshness.summary.fresh}/${sourceFreshness.summary.total} data sources are fresh.`,
    `${workforceFoundation.summary.activeMemory} persistent memory item(s), ${workforceFoundation.summary.openTasks} durable task(s), and ${workforceFoundation.summary.ingestionQueued} ingestion item(s) are visible.`,
    `${plannedWorkforceTasks} task(s) have execution plans; ${approvalLinkedWorkforceTasks} are linked to human approval; ${handoffReadyWorkforceTasks} are ready for internal task creation.`,
    `${linkedInternalTasks} linked internal CRM task(s) exist; ${completedInternalTasks} are marked done.`,
    `${userActions.summary.blocksAutonomy} user-owned item(s) block expanded autonomy.`,
    `${smokeReport.summary.ok}/${smokeReport.summary.total} smoke checks are OK.`,
  ];

  const safeNextSteps = [
    userActions.items.find((item) => item.blocksGoLive)?.nextStep,
    actionCenter.items[0]?.recommendedAction,
    missionControl.agents.find((agent) => agent.needsJasonAction)?.nextSafeTask,
    "Keep all outbound, bid, payment, publishing, and production actions human-approved until go-live gates are cleared.",
  ].filter((step): step is string => Boolean(step));

  return {
    generatedAt: nowIso(),
    status,
    headline: headlineForStatus(status, summary),
    summary,
    topPriorities,
    systemSignals,
    safeNextSteps: Array.from(new Set(safeNextSteps)).slice(0, 6),
  };
}
