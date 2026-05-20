import { getAgentMissionControl } from "./agent-mission-control";

export interface AgentPermissionRow {
  agentId: string;
  agentName: string;
  dashboard: string;
  route: string;
  mode: string;
  canReadData: boolean;
  canDraft: boolean;
  canCreateActionItem: boolean;
  canRequestApproval: boolean;
  canRunScheduledMonitor: boolean;
  canQueueInternalHandoff: boolean;
  canSendExternalMessage: boolean;
  canChangePaymentOrPricing: boolean;
  canPlaceOrderOrBid: boolean;
  canPublishOrDeploy: boolean;
  humanApprovalRequired: boolean;
  permissionSummary: string;
}

export interface AgentPermissionMatrix {
  generatedAt: string;
  summary: {
    total: number;
    readEnabled: number;
    draftEnabled: number;
    approvalEnabled: number;
    monitorEnabled: number;
    internalHandoffEnabled: number;
    externalExecutionEnabled: number;
  };
  agents: AgentPermissionRow[];
}

function nowIso() {
  return new Date().toISOString();
}

function summarize(rows: AgentPermissionRow[]): AgentPermissionMatrix["summary"] {
  return {
    total: rows.length,
    readEnabled: rows.filter((row) => row.canReadData).length,
    draftEnabled: rows.filter((row) => row.canDraft).length,
    approvalEnabled: rows.filter((row) => row.canRequestApproval).length,
    monitorEnabled: rows.filter((row) => row.canRunScheduledMonitor).length,
    internalHandoffEnabled: rows.filter((row) => row.canQueueInternalHandoff).length,
    externalExecutionEnabled: rows.filter((row) =>
      row.canSendExternalMessage || row.canChangePaymentOrPricing || row.canPlaceOrderOrBid || row.canPublishOrDeploy
    ).length,
  };
}

export async function getAgentPermissionMatrix(): Promise<AgentPermissionMatrix> {
  const missionControl = await getAgentMissionControl();
  const rows = missionControl.agents.map((agent) => {
    const blocked = agent.mode === "blocked";
    const canMonitor = agent.mode === "scheduled_monitor" || agent.mode === "assisted_ready";
    const canQueueInternalHandoff = agent.mode === "assisted_ready" && agent.risk === "low";
    const canDraft = !blocked;
    const canRequestApproval = !blocked && agent.mode !== "manual";

    return {
      agentId: agent.agentId,
      agentName: agent.name,
      dashboard: agent.dashboard,
      route: agent.route,
      mode: agent.mode,
      canReadData: true,
      canDraft,
      canCreateActionItem: !blocked,
      canRequestApproval,
      canRunScheduledMonitor: canMonitor,
      canQueueInternalHandoff,
      canSendExternalMessage: false,
      canChangePaymentOrPricing: false,
      canPlaceOrderOrBid: false,
      canPublishOrDeploy: false,
      humanApprovalRequired: true,
      permissionSummary: blocked
        ? "Setup is blocked. Agent can only expose readiness gaps."
        : canQueueInternalHandoff
          ? "Agent can prepare low-risk internal handoffs only. External execution remains disabled."
          : "Agent can read, draft, recommend, and request approval. Execution stays human-owned.",
    };
  });

  return {
    generatedAt: nowIso(),
    summary: summarize(rows),
    agents: rows,
  };
}
