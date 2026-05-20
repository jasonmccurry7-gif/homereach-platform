export type AiActionUrgency = "critical" | "high" | "medium" | "low";
export type AiActionRiskLevel = "critical" | "high" | "medium" | "low";
export type AiActionExecutionMode = "draft_only" | "human_approval" | "assisted_autopilot" | "full_autopilot";

export interface AiActionPolicyInput {
  source: string;
  dashboard: string;
  urgency?: AiActionUrgency;
  requestedAction?: string;
}

export interface AiActionPolicyDecision {
  riskLevel: AiActionRiskLevel;
  executionMode: AiActionExecutionMode;
  requiresHumanApproval: boolean;
  guardrailSummary: string;
  canQueueInternalHandoff: boolean;
  cannotExecuteReason: string;
  prohibitedActions: string[];
}

const HIGH_RISK_SOURCES = new Set([
  "gov_contract_opportunities",
  "gov_contract_bid_rooms",
  "revenue_message_approval_queue",
  "revenue_ai_suggestions",
  "revenue_webhook_events",
]);

const BLOCKED_HANDOFF_SOURCES = new Set([
  "revenue_message_threads",
  "revenue_message_approval_queue",
  "revenue_ai_suggestions",
]);

function dashboardIncludes(input: AiActionPolicyInput, value: string) {
  return input.dashboard.toLowerCase().includes(value);
}

function isLearning(input: AiActionPolicyInput) {
  return input.source.startsWith("ci_") || dashboardIncludes(input, "learning");
}

function isPolitical(input: AiActionPolicyInput) {
  return dashboardIncludes(input, "political") || input.source === "revenue_message_threads";
}

function isGov(input: AiActionPolicyInput) {
  return dashboardIncludes(input, "gov");
}

function isMessaging(input: AiActionPolicyInput) {
  return input.source === "revenue_message_approval_queue" || input.source === "revenue_ai_suggestions";
}

function riskLevel(input: AiActionPolicyInput): AiActionRiskLevel {
  if (input.urgency === "critical") return "critical";
  if (input.source === "revenue_message_threads") return "critical";
  if (HIGH_RISK_SOURCES.has(input.source)) return "high";
  if (input.urgency === "high") return "high";
  if (input.urgency === "low") return "low";
  return "medium";
}

function guardrailSummary(input: AiActionPolicyInput) {
  if (isLearning(input)) {
    return "Learning Engine approvals may create internal implementation tasks only. They do not publish content, deploy code, send outreach, change pricing, bill customers, place orders, or alter production without a separate human-reviewed workflow.";
  }
  if (isPolitical(input)) {
    return "Political actions remain human-approved. A reply or approval gate never authorizes autonomous persuasion, proposal, checkout, production, or outreach.";
  }
  if (isGov(input)) {
    return "Gov Contracts actions require explicit human approval. No bid submission, pricing, certification claim, subcontractor commitment, or award acceptance is automated.";
  }
  if (isMessaging(input)) {
    return "Messaging actions require human review, suppression checks, quiet-hour controls, and provider readiness before any outbound send.";
  }
  if (dashboardIncludes(input, "procurement")) {
    return "Procurement actions may recommend savings or smart buys, but no supplier order is placed without owner approval and a connected safe ordering workflow.";
  }
  if (dashboardIncludes(input, "sales")) {
    return "Sales actions can approve next-step intent only. Payment links, proposals, and outreach still use existing protected workflows.";
  }
  return "Approval captures operator intent only. Execution stays in the existing dashboard until a safe executor is connected.";
}

function prohibitedActions(input: AiActionPolicyInput) {
  const shared = [
    "No autonomous payments, orders, bids, publishing, deployments, or production launches.",
    "No uncontrolled SMS, email, or political outreach.",
    "No bypassing existing auth, approval, Stripe, route, or dashboard workflows.",
  ];

  if (isGov(input)) {
    return [
      ...shared,
      "No bid submission, pricing finalization, certification claim, subcontractor commitment, or award acceptance.",
    ];
  }

  if (isPolitical(input)) {
    return [
      ...shared,
      "No autonomous political persuasion conversation after a response; notify Jason and pause automation.",
    ];
  }

  if (isMessaging(input)) {
    return [
      ...shared,
      "No outbound send until suppression, opt-out, quiet-hour, provider readiness, and human approval checks pass.",
    ];
  }

  if (isLearning(input)) {
    return [
      ...shared,
      "No production implementation from an ingested idea without review, planning, testing, and approval.",
    ];
  }

  return shared;
}

function handoffDecision(input: AiActionPolicyInput, risk: AiActionRiskLevel) {
  if (risk === "critical" || risk === "high") {
    return {
      canQueueInternalHandoff: false,
      cannotExecuteReason: "High-risk gates require a workflow-specific executor, rollback plan, and second approval before any handoff can be queued.",
    };
  }
  if (isPolitical(input)) {
    return {
      canQueueInternalHandoff: false,
      cannotExecuteReason: "Political workflows remain manual after approval. The agent may draft support, but it cannot queue political outreach execution.",
    };
  }
  if (isGov(input)) {
    return {
      canQueueInternalHandoff: false,
      cannotExecuteReason: "Gov Contracts workflows remain manual after approval. No bid, pricing, certification, or subcontractor action can be queued here.",
    };
  }
  if (BLOCKED_HANDOFF_SOURCES.has(input.source)) {
    return {
      canQueueInternalHandoff: false,
      cannotExecuteReason: "Messaging workflows require provider, suppression, quiet-hour, and template checks before any execution handoff.",
    };
  }
  return {
    canQueueInternalHandoff: true,
    cannotExecuteReason: "Ready for a safe internal handoff. This creates an admin work record only and does not touch external systems.",
  };
}

export function evaluateAiActionPolicy(input: AiActionPolicyInput): AiActionPolicyDecision {
  const risk = riskLevel(input);
  const handoff = handoffDecision(input, risk);
  return {
    riskLevel: risk,
    executionMode: "human_approval",
    requiresHumanApproval: true,
    guardrailSummary: guardrailSummary(input),
    canQueueInternalHandoff: handoff.canQueueInternalHandoff,
    cannotExecuteReason: handoff.cannotExecuteReason,
    prohibitedActions: prohibitedActions(input),
  };
}
