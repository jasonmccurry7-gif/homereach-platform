import { getUnifiedActionCenter, type UnifiedActionCenter } from "./action-center";
import { getAgentMissionControl, type AgentMissionControl } from "./agent-mission-control";
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "./dashboard-agents";
import { getAiWorkforceSmokeReport, type AiWorkforceSmokeReport } from "./ai-workforce-smoke";
import { getSourceFreshnessReport, type SourceFreshnessReport } from "./source-freshness";
import { getUserActionReadiness } from "./user-action-items";
import { getAiWorkforceFoundationState, type WorkforceFoundationState, type WorkforceTaskQueueItem } from "./workforce-memory";

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
    source: "action_center" | "ai_workforce";
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

function priorityForWorkforceTask(task: WorkforceTaskQueueItem): AiCommandCenterState["topPriorities"][number] | null {
  if (task.status === "done" || task.status === "rejected" || task.status === "archived") return null;

  const base = {
    title: task.title,
    route: task.route ?? "/admin/agents",
    owner: task.agentId,
    urgency: task.priority,
    source: "ai_workforce" as const,
  };

  if (task.status === "blocked") {
    return {
      ...base,
      urgency: task.priority === "low" ? "medium" : task.priority,
      recommendedAction: "Review why this AI Workforce task is blocked before expanding autonomy.",
    };
  }

  if (!task.lastExecutionPlan) {
    return {
      ...base,
      recommendedAction: "Create a Plan Only execution playbook before approval or handoff.",
    };
  }

  if (!task.approvalRequestId) {
    return {
      ...base,
      recommendedAction: "Send the reviewed plan to the existing human approval queue.",
    };
  }

  if (task.approvalStatus !== "approved") {
    return {
      ...base,
      recommendedAction: "Approve, reject, or comment on the linked Autopilot approval request.",
    };
  }

  if (!task.lastDryRunPreview) {
    return {
      ...base,
      recommendedAction: "Run a dry-run preview before queuing any safe internal handoff.",
    };
  }

  if (!["handoff_queued", "task_ready", "task_created"].includes(task.executorStatus ?? "")) {
    return {
      ...base,
      recommendedAction: "Queue a safe internal handoff. This still does not touch external workflows.",
    };
  }

  if (["handoff_queued", "task_ready"].includes(task.executorStatus ?? "") && !task.internalTaskId) {
    return {
      ...base,
      recommendedAction: "Create an internal CRM task so a human owns the operational follow-up.",
    };
  }

  if (task.internalTaskId && !["done", "cancelled", "canceled"].includes(task.internalTaskStatus ?? "")) {
    return {
      ...base,
      recommendedAction: "Complete the linked internal task only after human follow-up is finished.",
    };
  }

  return null;
}

export async function getAiCommandCenterState(
  limit = 8,
  options: {
    actionCenter?: UnifiedActionCenter;
    missionControl?: AgentMissionControl;
    sourceFreshness?: SourceFreshnessReport;
    smokeReport?: AiWorkforceSmokeReport;
    workforceFoundation?: WorkforceFoundationState;
  } = {}
): Promise<AiCommandCenterState> {
  const dashboardAgents = getDashboardAgentMatrix();
  const [
    actionCenter,
    missionControl,
    sourceFreshness,
    smokeReport,
    workforceFoundation,
  ] = await Promise.all([
    options.actionCenter ?? getUnifiedActionCenter(24),
    options.missionControl ?? getAgentMissionControl(),
    options.sourceFreshness ?? getSourceFreshnessReport(),
    options.smokeReport ?? getAiWorkforceSmokeReport({ actionCenter: options.actionCenter }),
    options.workforceFoundation ?? getAiWorkforceFoundationState(12),
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

  const workforcePriorities = workforceFoundation.tasks
    .map(priorityForWorkforceTask)
    .filter((item): item is AiCommandCenterState["topPriorities"][number] => Boolean(item));

  const actionPriorities = actionCenter.items.slice(0, limit).map((item) => ({
    title: item.title,
    route: item.route,
    owner: item.owner,
    urgency: item.urgency,
    recommendedAction: item.recommendedAction,
    source: "action_center" as const,
  }));

  const topPriorities = [...workforcePriorities, ...actionPriorities].slice(0, limit);

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
