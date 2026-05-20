import type { DashboardAgentRuntime } from "./dashboard-agents";
import { getDashboardAgentMatrix } from "./dashboard-agents";
import type { SourceFreshnessItem } from "./source-freshness";
import { getSourceFreshnessReport } from "./source-freshness";

export type AgentMissionMode =
  | "blocked"
  | "manual"
  | "draft_only"
  | "human_approval"
  | "scheduled_monitor"
  | "assisted_ready";

export type AgentMissionRisk = "low" | "medium" | "high";

export interface AgentMissionCard {
  agentId: string;
  name: string;
  dashboard: string;
  route: string;
  mission: string;
  mode: AgentMissionMode;
  risk: AgentMissionRisk;
  readinessScore: number;
  blockers: string[];
  sourceWarnings: SourceFreshnessItem[];
  allowedActions: string[];
  prohibitedActions: string[];
  nextSafeTask: string;
  humanGate: string;
  needsJasonAction: boolean;
}

export interface AgentMissionControl {
  generatedAt: string;
  summary: {
    total: number;
    blocked: number;
    draftOnly: number;
    humanApproval: number;
    scheduledMonitor: number;
    assistedReady: number;
    needsJasonAction: number;
  };
  agents: AgentMissionCard[];
}

function nowIso() {
  return new Date().toISOString();
}

function sourceKeysForAgent(agent: DashboardAgentRuntime) {
  const id = agent.id;
  const keys = new Set<string>();

  if (id.includes("political")) keys.add("candidate_intelligence");
  if (id.includes("learning") || id.includes("growth") || id.includes("seo")) keys.add("learning_engine_ingestion");
  if (id.includes("gov-contracts")) keys.add("gov_contract_sync");
  if (id.includes("outreach") || id.includes("sales") || id.includes("customer-success")) keys.add("messaging_webhooks");
  if (id.includes("procurement")) keys.add("procurement_sequence");

  return keys;
}

function missionMode(agent: DashboardAgentRuntime, sourceWarnings: SourceFreshnessItem[]): AgentMissionMode {
  if (agent.status === "blocked") return "blocked";
  if (sourceWarnings.some((source) => source.status === "unavailable" || source.status === "stale")) return "draft_only";

  if (agent.currentAutonomy === "manual") return "manual";
  if (agent.currentAutonomy === "advisory") return "draft_only";
  if (agent.currentAutonomy === "human_approval") return "human_approval";
  if (agent.currentAutonomy === "scheduled_monitor") return "scheduled_monitor";
  return "assisted_ready";
}

function riskForMode(mode: AgentMissionMode, blockers: string[], sourceWarnings: SourceFreshnessItem[]): AgentMissionRisk {
  if (mode === "blocked" || blockers.length > 0) return "high";
  if (sourceWarnings.some((source) => source.status === "stale" || source.status === "unavailable")) return "high";
  if (sourceWarnings.some((source) => source.status === "aging" || source.status === "missing")) return "medium";
  if (mode === "manual" || mode === "draft_only" || mode === "human_approval") return "medium";
  return "low";
}

function allowedActionsForMode(mode: AgentMissionMode) {
  if (mode === "blocked") {
    return ["Show readiness gaps", "Create admin tasks", "Draft setup notes"];
  }
  if (mode === "manual") {
    return ["Summarize records", "Recommend next steps", "Create human-owned tasks"];
  }
  if (mode === "draft_only") {
    return ["Draft recommendations", "Generate review-ready copy", "Create Action Center items", "Request human approval"];
  }
  if (mode === "human_approval") {
    return ["Queue approval requests", "Draft replies/proposals", "Suggest next-best actions", "Log approved decisions"];
  }
  if (mode === "scheduled_monitor") {
    return ["Run scheduled checks", "Surface stale sources", "Create alerts", "Escalate failures"];
  }
  return ["Run low-risk approved workflows", "Escalate exceptions", "Log all actions", "Pause on confidence or compliance risk"];
}

function prohibitedActionsForMode(mode: AgentMissionMode) {
  const shared = [
    "No autonomous payments, bids, orders, or production launches",
    "No uncontrolled SMS/email sends",
    "No public publishing without approval",
  ];

  if (mode === "assisted_ready") {
    return [...shared, "No high-risk action outside approved guardrails"];
  }

  return [...shared, "No execution until a human approves the handoff"];
}

function humanGateForMode(mode: AgentMissionMode) {
  if (mode === "blocked") return "Admin must complete setup before this agent can operate.";
  if (mode === "manual") return "Human owns execution; AI can only summarize and recommend.";
  if (mode === "draft_only") return "Human must review before anything is queued or sent.";
  if (mode === "human_approval") return "Human approval is required before execution.";
  if (mode === "scheduled_monitor") return "Agent may monitor and alert; humans approve changes.";
  return "Agent may execute only pre-approved low-risk workflows and must escalate exceptions.";
}

function summarize(agents: AgentMissionCard[]): AgentMissionControl["summary"] {
  return {
    total: agents.length,
    blocked: agents.filter((agent) => agent.mode === "blocked").length,
    draftOnly: agents.filter((agent) => agent.mode === "draft_only").length,
    humanApproval: agents.filter((agent) => agent.mode === "human_approval").length,
    scheduledMonitor: agents.filter((agent) => agent.mode === "scheduled_monitor").length,
    assistedReady: agents.filter((agent) => agent.mode === "assisted_ready").length,
    needsJasonAction: agents.filter((agent) => agent.needsJasonAction).length,
  };
}

export async function getAgentMissionControl(): Promise<AgentMissionControl> {
  const agents = getDashboardAgentMatrix();
  const freshness = await getSourceFreshnessReport();
  const freshnessByKey = new Map(freshness.items.map((item) => [item.key, item]));

  const cards = agents.map((agent) => {
    const sourceWarnings = Array.from(sourceKeysForAgent(agent))
      .map((key) => freshnessByKey.get(key))
      .filter((item): item is SourceFreshnessItem => Boolean(item))
      .filter((item) => item.status !== "fresh");
    const blockers = [
      ...agent.missingRequiredEnv.map((key) => `Missing required env: ${key}`),
      ...(agent.manualBlockers ?? []),
    ];
    const mode = missionMode(agent, sourceWarnings);
    const firstSourceWarning = sourceWarnings.find((source) => source.status !== "aging");
    const nextSafeTask = blockers[0]
      ?? firstSourceWarning?.nextStep
      ?? agent.nextActions[0]
      ?? agent.phaseNext;

    return {
      agentId: agent.id,
      name: agent.name,
      dashboard: agent.dashboard,
      route: agent.route,
      mission: agent.mission,
      mode,
      risk: riskForMode(mode, blockers, sourceWarnings),
      readinessScore: agent.readinessScore,
      blockers,
      sourceWarnings,
      allowedActions: allowedActionsForMode(mode),
      prohibitedActions: prohibitedActionsForMode(mode),
      nextSafeTask,
      humanGate: humanGateForMode(mode),
      needsJasonAction: blockers.length > 0 || sourceWarnings.some((source) => source.status === "stale" || source.status === "unavailable"),
    };
  });

  return {
    generatedAt: nowIso(),
    summary: summarize(cards),
    agents: cards,
  };
}
