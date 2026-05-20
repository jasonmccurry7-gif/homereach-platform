import { createServiceClient } from "@/lib/supabase/service";

export type OperationalMemorySource =
  | "unified_action_events"
  | "ai_autopilot_approval_events"
  | "ai_autopilot_execution_runs"
  | "ai_operational_briefings"
  | "ci_outcome_events"
  | "agent_run_log";

export interface OperationalMemoryEvent {
  id: string;
  source: OperationalMemorySource;
  occurredAt: string;
  title: string;
  summary: string;
  route: string;
  actor: "admin" | "agent" | "system" | "unknown";
  severity: "info" | "success" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}

export interface OperationalMemory {
  generatedAt: string;
  summary: {
    total: number;
    approvals: number;
    tasks: number;
    learning: number;
    monitorEvents: number;
    failures: number;
  };
  events: OperationalMemoryEvent[];
  sourceHealth: Array<{ source: OperationalMemorySource | "supabase"; status: "ok" | "unavailable"; note?: string }>;
}

function nowIso() {
  return new Date().toISOString();
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function severityFromStatus(status?: string | null): OperationalMemoryEvent["severity"] {
  if (status === "failed" || status === "blocked" || status === "critical") return "critical";
  if (status === "warning" || status === "needs_review" || status === "pending") return "warning";
  if (status === "approved" || status === "completed" || status === "success" || status === "ok") return "success";
  return "info";
}

function summarize(events: OperationalMemoryEvent[]): OperationalMemory["summary"] {
  return {
    total: events.length,
    approvals: events.filter((event) => event.source === "ai_autopilot_approval_events").length,
    tasks: events.filter((event) => event.source === "ai_autopilot_execution_runs").length,
    learning: events.filter((event) => event.source === "ci_outcome_events").length,
    monitorEvents: events.filter((event) => event.source === "ai_operational_briefings").length,
    failures: events.filter((event) => event.severity === "critical").length,
  };
}

export async function getOperationalMemory(limit = 30): Promise<OperationalMemory> {
  const sourceHealth: OperationalMemory["sourceHealth"] = [];
  const events: OperationalMemoryEvent[] = [];

  if (!hasSupabaseEnv()) {
    sourceHealth.push({
      source: "supabase",
      status: "unavailable",
      note: "Supabase env is missing, so operational memory cannot be loaded.",
    });
    return { generatedAt: nowIso(), summary: summarize([]), events: [], sourceHealth };
  }

  const supabase = createServiceClient();

  async function readSource<T>(
    source: OperationalMemorySource,
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      const result = await fn();
      sourceHealth.push({ source, status: "ok" });
      return result;
    } catch (error) {
      sourceHealth.push({
        source,
        status: "unavailable",
        note: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
  }

  const [
    actionEvents,
    approvalEvents,
    executionRuns,
    briefings,
    learningEvents,
    agentRuns,
  ] = await Promise.all([
    readSource("unified_action_events", async () => {
      const { data, error } = await supabase
        .from("unified_action_events")
        .select("id,source_key,event_type,note,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ai_autopilot_approval_events", async () => {
      const { data, error } = await supabase
        .from("ai_autopilot_approval_events")
        .select("id,source_key,event_type,note,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ai_autopilot_execution_runs", async () => {
      const { data, error } = await supabase
        .from("ai_autopilot_execution_runs")
        .select("id,source_key,execution_type,execution_status,result_summary,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ai_operational_briefings", async () => {
      const { data, error } = await supabase
        .from("ai_operational_briefings")
        .select("id,briefing_type,status,headline,summary,created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ci_outcome_events", async () => {
      const { data, error } = await supabase
        .from("ci_outcome_events")
        .select("id,item_type,item_id,outcome,notes,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("agent_run_log", async () => {
      const { data, error } = await supabase
        .from("agent_run_log")
        .select("id,agent_name,status,actions_taken,error_message,run_at")
        .order("run_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
  ]);

  for (const row of actionEvents) {
    events.push({
      id: `action-event-${row.id}`,
      source: "unified_action_events",
      occurredAt: row.created_at,
      title: `Action Center ${row.event_type}`,
      summary: row.note || `Action ${row.source_key ?? "item"} was ${row.event_type}.`,
      route: "/admin/agents",
      actor: row.metadata?.actorId ? "admin" : "system",
      severity: severityFromStatus(row.event_type),
      metadata: asMetadata(row.metadata),
    });
  }

  for (const row of approvalEvents) {
    events.push({
      id: `approval-event-${row.id}`,
      source: "ai_autopilot_approval_events",
      occurredAt: row.created_at,
      title: `Autopilot gate ${row.event_type}`,
      summary: row.note || `Gate ${row.source_key ?? "request"} recorded ${row.event_type}.`,
      route: "/admin/agents",
      actor: row.metadata?.actorId ? "admin" : "system",
      severity: row.event_type === "rejected" || row.event_type === "execution_blocked" ? "warning" : "info",
      metadata: asMetadata(row.metadata),
    });
  }

  for (const row of executionRuns) {
    events.push({
      id: `execution-run-${row.id}`,
      source: "ai_autopilot_execution_runs",
      occurredAt: row.created_at,
      title: `Internal handoff ${row.execution_status}`,
      summary: row.result_summary || `${row.execution_type ?? "internal handoff"} for ${row.source_key ?? "approval gate"}.`,
      route: "/admin/agents",
      actor: "system",
      severity: severityFromStatus(row.execution_status),
      metadata: { sourceKey: row.source_key, updatedAt: row.updated_at },
    });
  }

  for (const row of briefings) {
    events.push({
      id: `briefing-${row.id}`,
      source: "ai_operational_briefings",
      occurredAt: row.created_at,
      title: row.headline || `${row.briefing_type} operational briefing`,
      summary: row.summary || "Operational briefing generated.",
      route: "/admin/agents",
      actor: "system",
      severity: severityFromStatus(row.status),
      metadata: { briefingType: row.briefing_type },
    });
  }

  for (const row of learningEvents) {
    events.push({
      id: `learning-outcome-${row.id}`,
      source: "ci_outcome_events",
      occurredAt: row.created_at,
      title: `Learning outcome: ${row.outcome}`,
      summary: row.notes || `${row.item_type ?? "item"} ${row.item_id ?? ""} was marked ${row.outcome}.`,
      route: "/admin/content-intel",
      actor: "agent",
      severity: row.outcome === "failed" ? "warning" : row.outcome === "win" ? "success" : "info",
      metadata: { itemType: row.item_type, itemId: row.item_id },
    });
  }

  for (const row of agentRuns) {
    events.push({
      id: `agent-run-${row.id}`,
      source: "agent_run_log",
      occurredAt: row.run_at,
      title: `${row.agent_name ?? "Agent"} run ${row.status}`,
      summary: row.error_message || `${row.actions_taken ?? 0} action${row.actions_taken === 1 ? "" : "s"} recorded.`,
      route: "/admin/agents",
      actor: "agent",
      severity: severityFromStatus(row.status),
      metadata: { actionsTaken: row.actions_taken },
    });
  }

  const sorted = events
    .filter((event) => Boolean(event.occurredAt))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit);

  return {
    generatedAt: nowIso(),
    summary: summarize(sorted),
    events: sorted,
    sourceHealth,
  };
}
