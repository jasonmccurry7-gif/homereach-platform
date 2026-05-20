import {
  recordAiWorkforceEvent,
  upsertAiWorkforceMemoryItem,
  type RecordWorkforceEventInput,
  type UpsertWorkforceMemoryInput,
} from "./workforce-memory";

type HumanEventResult = { ok: true; persisted: boolean; error?: string };

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function safeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").replace(/-+/g, "-").slice(0, 220);
}

async function bestEffortMemoryWrite(
  source: string,
  writes: Array<() => Promise<unknown>>,
): Promise<HumanEventResult> {
  if (!hasSupabaseEnv()) return { ok: true, persisted: false };

  try {
    await Promise.all(writes.map((write) => write()));
    return { ok: true, persisted: true };
  } catch (error) {
    console.warn(`[ai-workforce] skipped human memory write from ${source}:`, error);
    return {
      ok: true,
      persisted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function eventWrite(input: RecordWorkforceEventInput) {
  return () => recordAiWorkforceEvent(input);
}

function memoryWrite(input: UpsertWorkforceMemoryInput) {
  return () => upsertAiWorkforceMemoryItem(input);
}

export async function rememberActionCenterMutation(input: {
  sourceKey: string;
  operation: "resolve" | "snooze" | "dismiss" | "reopen" | "comment";
  actorId?: string | null;
  note?: string | null;
  priorState?: string | null;
  nextState?: string | null;
  snoozeHours?: number | null;
}) {
  const baseKey = safeKey(`action-center:${input.sourceKey}:${input.operation}`);
  const eventType =
    input.operation === "resolve" || input.operation === "dismiss"
      ? "resolved"
      : input.operation === "reopen"
        ? "queued"
        : "commented";

  return bestEffortMemoryWrite("action_center_mutation", [
    eventWrite({
      eventType,
      actorType: "admin",
      actorId: input.actorId ?? null,
      dashboard: "Unified Action Center",
      title: `Action ${input.operation} recorded`,
      summary: `Human ${input.operation} decision recorded for ${input.sourceKey}.`,
      route: "/admin/agents",
      severity: input.operation === "reopen" ? "warning" : "info",
      source: "unified_action_events",
      sourceId: input.sourceKey,
      metadata: {
        operation: input.operation,
        priorState: input.priorState ?? null,
        nextState: input.nextState ?? null,
        snoozeHours: input.snoozeHours ?? null,
        note: input.note ?? null,
        externalWorkflowTouched: false,
      },
    }),
    memoryWrite({
      memoryKey: `memory:${baseKey}`,
      agentId: "executive-os-agent",
      dashboard: "Unified Action Center",
      memoryType: "decision",
      title: `Human action: ${input.operation}`,
      summary: input.note
        ? `Human ${input.operation} decision: ${input.note}`
        : `Human ${input.operation} decision recorded for ${input.sourceKey}.`,
      source: "unified_action_events",
      sourceId: input.sourceKey,
      route: "/admin/agents",
      confidence: 0.98,
      impactLevel: input.operation === "reopen" ? "high" : "medium",
      metadata: {
        operation: input.operation,
        priorState: input.priorState ?? null,
        nextState: input.nextState ?? null,
        snoozeHours: input.snoozeHours ?? null,
      },
    }),
  ]);
}

export async function rememberAutopilotWorkflowEvent(input: {
  sourceKey: string;
  requestId?: string | null;
  eventType: string;
  actorId?: string | null;
  note?: string | null;
  dashboard?: string | null;
  route?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const normalizedEvent =
    input.eventType === "approved"
      ? "approved"
      : input.eventType === "rejected"
        ? "rejected"
        : input.eventType.includes("blocked")
          ? "blocked"
          : input.eventType.includes("queued") || input.eventType.includes("created")
            ? "queued"
            : input.eventType.includes("completed")
              ? "executed_elsewhere"
              : "commented";

  const baseKey = safeKey(`autopilot:${input.sourceKey}:${input.eventType}`);
  const isDecision = normalizedEvent === "approved" || normalizedEvent === "rejected";

  return bestEffortMemoryWrite("autopilot_workflow_event", [
    eventWrite({
      eventType: normalizedEvent,
      actorType: "admin",
      actorId: input.actorId ?? null,
      dashboard: input.dashboard ?? "AI Autopilot",
      title: input.title ?? `Autopilot ${input.eventType}`,
      summary: input.note
        ? `Human-supervised autopilot event recorded: ${input.note}`
        : `Human-supervised autopilot event recorded for ${input.sourceKey}.`,
      route: input.route ?? "/admin/agents",
      severity: normalizedEvent === "blocked" || normalizedEvent === "rejected" ? "warning" : "info",
      source: "ai_autopilot_approval_events",
      sourceId: input.requestId ?? input.sourceKey,
      metadata: {
        eventType: input.eventType,
        sourceKey: input.sourceKey,
        requestId: input.requestId ?? null,
        externalWorkflowTouched: false,
        ...(input.metadata ?? {}),
      },
    }),
    memoryWrite({
      memoryKey: `memory:${baseKey}`,
      agentId: "qa-hardening-agent",
      dashboard: input.dashboard ?? "AI Autopilot",
      memoryType: isDecision ? "decision" : "summary",
      title: input.title ?? `Autopilot ${input.eventType}`,
      summary: input.note
        ? `Autopilot ${input.eventType}: ${input.note}`
        : `Autopilot ${input.eventType} recorded for ${input.sourceKey}.`,
      source: "ai_autopilot_approval_events",
      sourceId: input.requestId ?? input.sourceKey,
      route: input.route ?? "/admin/agents",
      confidence: 0.97,
      impactLevel: normalizedEvent === "blocked" || normalizedEvent === "rejected" ? "high" : "medium",
      metadata: {
        eventType: input.eventType,
        sourceKey: input.sourceKey,
        requestId: input.requestId ?? null,
        ...(input.metadata ?? {}),
      },
    }),
  ]);
}

export async function rememberLearningFeedback(input: {
  itemType: string;
  itemId: string;
  outcome: string;
  actorId?: string | null;
  notes?: string | null;
}) {
  const baseKey = safeKey(`learning-feedback:${input.itemType}:${input.itemId}:${input.outcome}`);
  const eventType =
    input.outcome === "win"
      ? "approved"
      : input.outcome === "failed"
        ? "rejected"
        : "commented";

  return bestEffortMemoryWrite("learning_feedback", [
    eventWrite({
      eventType,
      actorType: "admin",
      actorId: input.actorId ?? null,
      dashboard: "Learning Engine",
      title: `Learning feedback: ${input.outcome}`,
      summary: input.notes
        ? `Human feedback for ${input.itemType}: ${input.notes}`
        : `Human feedback marked ${input.itemType} ${input.itemId} as ${input.outcome}.`,
      route: "/admin/content-intelligence",
      severity: input.outcome === "failed" ? "warning" : "info",
      source: "ci_outcome_events",
      sourceId: input.itemId,
      metadata: {
        itemType: input.itemType,
        outcome: input.outcome,
      },
    }),
    memoryWrite({
      memoryKey: `memory:${baseKey}`,
      agentId: "ai-automation-research-agent",
      dashboard: "Learning Engine",
      memoryType: "decision",
      title: `Learning outcome: ${input.outcome}`,
      summary: input.notes
        ? `Human feedback captured for ${input.itemType}: ${input.notes}`
        : `Human feedback captured for ${input.itemType} ${input.itemId}: ${input.outcome}.`,
      source: "ci_outcome_events",
      sourceId: input.itemId,
      route: "/admin/content-intelligence",
      confidence: 0.96,
      impactLevel: input.outcome === "win" || input.outcome === "failed" ? "high" : "medium",
      metadata: {
        itemType: input.itemType,
        outcome: input.outcome,
      },
    }),
  ]);
}

export async function rememberGovContractAuditEvent(input: {
  opportunityId?: string | null;
  eventType: string;
  actorId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const baseKey = safeKey(`gov-contract:${input.opportunityId ?? "general"}:${input.eventType}`);
  const normalizedEvent =
    input.eventType.includes("approval")
      ? "approved"
      : input.eventType.includes("no_bid") || input.eventType.includes("blocked")
        ? "blocked"
        : input.eventType.includes("status") || input.eventType.includes("review")
          ? "observed"
          : "commented";

  return bestEffortMemoryWrite("gov_contract_audit_event", [
    eventWrite({
      eventType: normalizedEvent,
      actorType: input.actorId ? "admin" : "system",
      actorId: input.actorId ?? null,
      dashboard: "Gov Contracts",
      title: `Gov Contracts: ${input.eventType}`,
      summary: input.summary,
      route: input.opportunityId ? `/admin/gov-contracts/${input.opportunityId}` : "/admin/gov-contracts",
      severity: normalizedEvent === "blocked" ? "warning" : "info",
      source: "gov_contract_audit_logs",
      sourceId: input.opportunityId ?? null,
      metadata: {
        eventType: input.eventType,
        ...(input.metadata ?? {}),
      },
    }),
    memoryWrite({
      memoryKey: `memory:${baseKey}`,
      agentId: "government-contract-intelligence-agent",
      dashboard: "Gov Contracts",
      memoryType: normalizedEvent === "blocked" || normalizedEvent === "approved" ? "decision" : "summary",
      title: `Gov Contracts ${input.eventType}`,
      summary: input.summary,
      source: "gov_contract_audit_logs",
      sourceId: input.opportunityId ?? null,
      route: input.opportunityId ? `/admin/gov-contracts/${input.opportunityId}` : "/admin/gov-contracts",
      confidence: 0.95,
      impactLevel: normalizedEvent === "blocked" || normalizedEvent === "approved" ? "high" : "medium",
      metadata: {
        eventType: input.eventType,
        ...(input.metadata ?? {}),
      },
    }),
  ]);
}
