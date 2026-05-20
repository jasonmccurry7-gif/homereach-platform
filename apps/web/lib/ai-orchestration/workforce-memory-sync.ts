import { getAgentMissionControl } from "./agent-mission-control";
import { getUnifiedActionCenter } from "./action-center";
import { getSourceFreshnessReport } from "./source-freshness";
import { getUserActionReadiness } from "./user-action-items";
import {
  enqueueAiWorkforceIngestionSource,
  enqueueAiWorkforceTask,
  recordAiWorkforceEvent,
  upsertAiWorkforceMemoryItem,
} from "./workforce-memory";

export interface WorkforceSignalSyncResult {
  generatedAt: string;
  actorId?: string | null;
  mode: "admin_manual";
  summary: {
    memoryUpserts: number;
    eventsRecorded: number;
    tasksQueued: number;
    ingestionSourcesQueued: number;
    errors: number;
  };
  notes: string[];
  errors: Array<{ source: string; message: string }>;
}

function nowIso() {
  return new Date().toISOString();
}

function safeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").replace(/-+/g, "-").slice(0, 220);
}

function impactFromPriority(priority: string) {
  if (priority === "critical") return "critical" as const;
  if (priority === "high") return "high" as const;
  if (priority === "low") return "low" as const;
  return "medium" as const;
}

function severityFromPriority(priority: string) {
  if (priority === "critical") return "critical" as const;
  if (priority === "high") return "warning" as const;
  return "info" as const;
}

function sourceImpact(status: string) {
  if (status === "unavailable" || status === "stale") return "high" as const;
  if (status === "missing" || status === "aging") return "medium" as const;
  return "low" as const;
}

async function capture(
  result: WorkforceSignalSyncResult,
  source: string,
  fn: () => Promise<"memory" | "event" | "task" | "ingestion">,
) {
  try {
    const type = await fn();
    if (type === "memory") result.summary.memoryUpserts += 1;
    if (type === "event") result.summary.eventsRecorded += 1;
    if (type === "task") result.summary.tasksQueued += 1;
    if (type === "ingestion") result.summary.ingestionSourcesQueued += 1;
  } catch (error) {
    result.summary.errors += 1;
    result.errors.push({ source, message: error instanceof Error ? error.message : String(error) });
  }
}

export async function syncAiWorkforceSignals(actorId?: string | null): Promise<WorkforceSignalSyncResult> {
  const result: WorkforceSignalSyncResult = {
    generatedAt: nowIso(),
    actorId,
    mode: "admin_manual",
    summary: {
      memoryUpserts: 0,
      eventsRecorded: 0,
      tasksQueued: 0,
      ingestionSourcesQueued: 0,
      errors: 0,
    },
    notes: [
      "Manual sync only. No outreach, publishing, payments, orders, bids, or production actions were executed.",
      "Records created here are context and review queues for future supervised agents.",
    ],
    errors: [],
  };

  const [userActions, sourceFreshness, missionControl, actionCenter] = await Promise.all([
    Promise.resolve(getUserActionReadiness()),
    getSourceFreshnessReport(),
    getAgentMissionControl(),
    getUnifiedActionCenter(18),
  ]);

  for (const action of userActions.items.slice(0, 18)) {
    const baseKey = safeKey(`user-action:${action.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        dashboard: action.relatedSystem ?? "HomeReach Setup",
        memoryType: action.category === "credential" || action.category === "env" ? "credential_gap" : "constraint",
        title: action.title,
        summary: action.detail,
        source: "user_action_readiness",
        sourceId: action.id,
        route: action.relatedRoute ?? "/admin/agents",
        confidence: 0.96,
        impactLevel: impactFromPriority(action.priority),
        metadata: {
          owner: action.owner,
          priority: action.priority,
          blocksGoLive: action.blocksGoLive,
          blocksAutonomy: action.blocksAutonomy,
          nextStep: action.nextStep,
        },
      });
      return "memory";
    });

    await capture(result, `${baseKey}:task`, async () => {
      await enqueueAiWorkforceTask({
        taskKey: `task:${baseKey}`,
        agentId: "executive-os-agent",
        dashboard: action.relatedSystem ?? "AI Workforce OS",
        title: action.title,
        description: action.detail,
        recommendedAction: action.nextStep,
        route: action.relatedRoute ?? "/admin/agents",
        priority: action.priority,
        status: action.blocksGoLive || action.blocksAutonomy ? "blocked" : "queued",
        requiresHumanApproval: true,
        metadata: {
          source: "user_action_readiness",
          owner: action.owner,
          category: action.category,
        },
      });
      return "task";
    });
  }

  for (const source of sourceFreshness.items.filter((item) => item.status !== "fresh")) {
    const baseKey = safeKey(`source-freshness:${source.key}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: "operations-monitoring-agent",
        dashboard: source.label,
        memoryType: "source_note",
        title: `${source.label} is ${source.status}`,
        summary: source.summary,
        source: "source_freshness",
        sourceId: source.key,
        route: "/admin/agents",
        confidence: source.status === "unavailable" ? 0.9 : 0.78,
        impactLevel: sourceImpact(source.status),
        metadata: {
          sourceTable: source.sourceTable,
          ageHours: source.ageHours,
          staleAfterHours: source.staleAfterHours,
          nextStep: source.nextStep,
        },
      });
      return "memory";
    });

    await capture(result, `${baseKey}:task`, async () => {
      await enqueueAiWorkforceTask({
        taskKey: `task:${baseKey}`,
        agentId: "operations-monitoring-agent",
        dashboard: source.label,
        title: `${source.label}: ${source.status}`,
        description: source.summary,
        recommendedAction: source.nextStep,
        route: "/admin/agents",
        priority: source.status === "unavailable" || source.status === "stale" ? "high" : "medium",
        status: source.status === "unavailable" || source.status === "stale" ? "blocked" : "queued",
        requiresHumanApproval: true,
        metadata: {
          source: "source_freshness",
          sourceTable: source.sourceTable,
        },
      });
      return "task";
    });
  }

  for (const agent of missionControl.agents.filter((item) => item.needsJasonAction || item.risk === "high").slice(0, 12)) {
    const baseKey = safeKey(`agent-mission:${agent.agentId}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: agent.agentId,
        dashboard: agent.dashboard,
        memoryType: agent.mode === "blocked" ? "risk" : "constraint",
        title: `${agent.name} requires supervised operation`,
        summary: agent.nextSafeTask,
        source: "agent_mission_control",
        sourceId: agent.agentId,
        route: agent.route,
        confidence: 0.86,
        impactLevel: agent.risk === "high" ? "high" : "medium",
        metadata: {
          mode: agent.mode,
          risk: agent.risk,
          readinessScore: agent.readinessScore,
          humanGate: agent.humanGate,
          blockers: agent.blockers,
        },
      });
      return "memory";
    });
  }

  for (const action of actionCenter.items.filter((item) => item.urgency === "critical" || item.urgency === "high").slice(0, 10)) {
    const baseKey = safeKey(`action-center:${action.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        dashboard: action.dashboard,
        memoryType: action.status === "blocked" ? "risk" : "opportunity",
        title: action.title,
        summary: action.reason,
        source: "unified_action_center",
        sourceId: action.id,
        route: action.route,
        confidence: 0.82,
        impactLevel: action.urgency,
        metadata: {
          owner: action.owner,
          status: action.status,
          recommendedAction: action.recommendedAction,
          impact: action.impact,
          requiresHumanApproval: action.requiresHumanApproval,
        },
      });
      return "memory";
    });
  }

  const learningFreshness = sourceFreshness.items.find((item) => item.key === "learning_engine_ingestion");
  if (learningFreshness && learningFreshness.status !== "fresh") {
    await capture(result, "learning-engine-manual-ingestion-source", async () => {
      await enqueueAiWorkforceIngestionSource({
        sourceKey: "learning-engine:admin-review-source-gap",
        sourceType: "manual",
        title: "Learning Engine needs a reviewed source ingestion run",
        dashboard: "Learning Engine",
        priority: learningFreshness.status === "unavailable" || learningFreshness.status === "stale" ? "high" : "medium",
        status: "queued",
        reviewRequired: true,
        assignedAgentId: "learning-engine-agent",
        nextStep: learningFreshness.nextStep,
        metadata: {
          source: "source_freshness",
          sourceStatus: learningFreshness.status,
          sourceTable: learningFreshness.sourceTable,
        },
      });
      return "ingestion";
    });
  }

  await capture(result, "workforce-signal-sync-event", async () => {
    await recordAiWorkforceEvent({
      eventKey: `workforce-signal-sync:${new Date().toISOString().slice(0, 13)}`,
      eventType: result.summary.errors > 0 ? "failed" : "synced",
      agentId: "executive-os-agent",
      dashboard: "AI Workforce OS",
      actorType: actorId ? "admin" : "system",
      actorId,
      title: "AI Workforce signal sync completed",
      summary: `${result.summary.memoryUpserts} memory item(s), ${result.summary.tasksQueued} task(s), and ${result.summary.ingestionSourcesQueued} ingestion source(s) were updated.`,
      route: "/admin/agents",
      severity: result.summary.errors > 0 ? "warning" : "success",
      source: "workforce_signal_sync",
      metadata: {
        summary: result.summary,
        notes: result.notes,
      },
    });
    return "event";
  });

  return result;
}
