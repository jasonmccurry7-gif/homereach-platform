import { getAgentMissionControl } from "./agent-mission-control";

export type AgentWorkOrderPriority = "critical" | "high" | "medium" | "low";
export type AgentWorkOrderStatus = "blocked" | "ready_for_review" | "ready_to_plan";

export interface AgentWorkOrder {
  id: string;
  agentId: string;
  agentName: string;
  dashboard: string;
  route: string;
  title: string;
  objective: string;
  priority: AgentWorkOrderPriority;
  status: AgentWorkOrderStatus;
  humanGate: string;
  acceptanceCriteria: string[];
  nextStep: string;
  safeToAutomate: boolean;
}

export interface AgentWorkOrderQueue {
  generatedAt: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    blocked: number;
    readyForReview: number;
    safeToAutomate: number;
  };
  workOrders: AgentWorkOrder[];
}

function nowIso() {
  return new Date().toISOString();
}

function priorityFromRisk(risk: string, needsJasonAction: boolean): AgentWorkOrderPriority {
  if (needsJasonAction || risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

function statusFromMode(mode: string): AgentWorkOrderStatus {
  if (mode === "blocked") return "blocked";
  if (mode === "manual" || mode === "draft_only" || mode === "human_approval") return "ready_for_review";
  return "ready_to_plan";
}

function summarize(workOrders: AgentWorkOrder[]): AgentWorkOrderQueue["summary"] {
  return {
    total: workOrders.length,
    critical: workOrders.filter((order) => order.priority === "critical").length,
    high: workOrders.filter((order) => order.priority === "high").length,
    blocked: workOrders.filter((order) => order.status === "blocked").length,
    readyForReview: workOrders.filter((order) => order.status === "ready_for_review").length,
    safeToAutomate: workOrders.filter((order) => order.safeToAutomate).length,
  };
}

export async function getAgentWorkOrderQueue(limit = 18): Promise<AgentWorkOrderQueue> {
  const missionControl = await getAgentMissionControl();

  const workOrders = missionControl.agents.map((agent) => {
    const status = statusFromMode(agent.mode);
    const safeToAutomate = agent.mode === "scheduled_monitor" || agent.mode === "assisted_ready";
    const priority = agent.mode === "blocked"
      ? "critical"
      : priorityFromRisk(agent.risk, agent.needsJasonAction);

    return {
      id: `work-order-${agent.agentId}`,
      agentId: agent.agentId,
      agentName: agent.name,
      dashboard: agent.dashboard,
      route: agent.route,
      title: `${agent.name}: ${agent.nextSafeTask}`,
      objective: agent.mission,
      priority,
      status,
      humanGate: agent.humanGate,
      acceptanceCriteria: [
        "Existing dashboard behavior remains unchanged.",
        "No duplicate workflow, route, database table, or AI system is created.",
        "No outbound send, bid, order, payment, publish, or deployment occurs without approval.",
        "Result is visible in the Action Center, admin dashboard, or relevant operational page.",
      ],
      nextStep: agent.nextSafeTask,
      safeToAutomate,
    };
  });

  const sorted = workOrders.sort((a, b) => {
    const weight = { critical: 4, high: 3, medium: 2, low: 1 };
    const priorityDelta = weight[b.priority] - weight[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return Number(a.safeToAutomate) - Number(b.safeToAutomate);
  });

  return {
    generatedAt: nowIso(),
    summary: summarize(sorted),
    workOrders: sorted.slice(0, limit),
  };
}
