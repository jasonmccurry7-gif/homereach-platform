import { createServiceClient } from "@/lib/supabase/service";
import { getUnifiedActionCenter, type UnifiedActionItem } from "./action-center";
import { evaluateAiActionPolicy } from "./ai-action-policy";

export type AutopilotRiskLevel = "critical" | "high" | "medium" | "low";
export type AutopilotApprovalStatus = "pending" | "approved" | "rejected" | "canceled" | "expired" | "executed";
export type AutopilotDecision = "approve" | "reject" | "comment";
export type AutopilotExecutorStatus =
  | "approval_only"
  | "not_connected"
  | "ready"
  | "blocked"
  | "executed"
  | "handoff_ready"
  | "handoff_queued"
  | "task_ready"
  | "task_created";

export interface AutopilotApprovalRequest {
  id: string;
  sourceKey: string;
  source: string;
  dashboard: string;
  route: string;
  title: string;
  requestedAction: string;
  expectedImpact: string;
  riskLevel: AutopilotRiskLevel;
  approvalStatus: AutopilotApprovalStatus;
  executionMode: "draft_only" | "human_approval" | "assisted_autopilot" | "full_autopilot";
  executorStatus: AutopilotExecutorStatus;
  guardrailSummary: string;
  cannotExecuteReason: string;
  requiresHumanApproval: boolean;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  decisionNote?: string | null;
  executionRunId?: string | null;
  internalTaskId?: string | null;
  internalTaskCreatedAt?: string | null;
}

export interface AutopilotControlSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  critical: number;
  high: number;
  approvalOnly: number;
}

export interface AutopilotControlCenter {
  generatedAt: string;
  summary: AutopilotControlSummary;
  requests: AutopilotApprovalRequest[];
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
}

export interface AutopilotInternalTask {
  executionRunId: string;
  requestId: string;
  sourceKey: string;
  taskId: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "snoozed" | "cancelled" | string;
  dueAt: string | null;
  createdAt: string | null;
  completedAt: string | null;
  dashboard: string;
  route: string;
  source: string;
  requestedAction: string;
  expectedImpact: string;
  guardrailSummary: string;
  taskCreatedAt: string | null;
}

export interface AutopilotTaskQueue {
  generatedAt: string;
  summary: {
    total: number;
    pending: number;
    done: number;
    overdue: number;
    dueSoon: number;
  };
  tasks: AutopilotInternalTask[];
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
}

function nowIso() {
  return new Date().toISOString();
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function summarize(requests: AutopilotApprovalRequest[]): AutopilotControlSummary {
  return {
    total: requests.length,
    pending: requests.filter((request) => request.approvalStatus === "pending").length,
    approved: requests.filter((request) => request.approvalStatus === "approved").length,
    rejected: requests.filter((request) => request.approvalStatus === "rejected").length,
    critical: requests.filter((request) => request.riskLevel === "critical").length,
    high: requests.filter((request) => request.riskLevel === "high").length,
    approvalOnly: requests.filter((request) => request.executorStatus === "approval_only").length,
  };
}

function summarizeTasks(tasks: AutopilotInternalTask[]): AutopilotTaskQueue["summary"] {
  const now = Date.now();
  const soon = now + 24 * 60 * 60 * 1000;
  return {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === "pending" || task.status === "in_progress").length,
    done: tasks.filter((task) => task.status === "done").length,
    overdue: tasks.filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt).getTime() < now).length,
    dueSoon: tasks.filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt).getTime() <= soon).length,
  };
}

function riskFromAction(item: UnifiedActionItem): AutopilotRiskLevel {
  return evaluateAiActionPolicy({
    source: item.source,
    dashboard: item.dashboard,
    urgency: item.urgency,
    requestedAction: item.recommendedAction,
  }).riskLevel;
}

function guardrailForAction(item: UnifiedActionItem) {
  return evaluateAiActionPolicy({
    source: item.source,
    dashboard: item.dashboard,
    urgency: item.urgency,
    requestedAction: item.recommendedAction,
  }).guardrailSummary;
}

function canQueueSafeInternalHandoff(row: {
  risk_level: AutopilotRiskLevel;
  source: string;
  dashboard: string;
}) {
  return evaluateAiActionPolicy({
    source: row.source,
    dashboard: row.dashboard,
    urgency: row.risk_level,
  }).canQueueInternalHandoff;
}

function safeHandoffBlockedReason(row: {
  risk_level: AutopilotRiskLevel;
  source: string;
  dashboard: string;
}) {
  return evaluateAiActionPolicy({
    source: row.source,
    dashboard: row.dashboard,
    urgency: row.risk_level,
  }).cannotExecuteReason;
}

function toRequest(row: Record<string, any>): AutopilotApprovalRequest {
  return {
    id: row.id,
    sourceKey: row.source_key,
    source: row.source,
    dashboard: row.dashboard,
    route: row.route,
    title: row.title,
    requestedAction: row.requested_action,
    expectedImpact: row.expected_impact,
    riskLevel: row.risk_level,
    approvalStatus: row.approval_status,
    executionMode: row.execution_mode,
    executorStatus: row.executor_status,
    guardrailSummary: row.guardrail_summary,
    cannotExecuteReason: row.cannot_execute_reason,
    requiresHumanApproval: row.requires_human_approval,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    decisionNote: row.decision_note,
    executionRunId: row.execution_run_id ?? null,
    internalTaskId: row.internal_task_id ?? null,
    internalTaskCreatedAt: row.internal_task_created_at ?? null,
  };
}

export async function getAutopilotControlCenter(limit = 12): Promise<AutopilotControlCenter> {
  const actionCenter = await getUnifiedActionCenter(24);
  const sourceHealth: AutopilotControlCenter["sourceHealth"] = [
    ...actionCenter.sourceHealth,
  ];
  const eligibleActions = actionCenter.items
    .filter((item) => item.requiresHumanApproval)
    .slice(0, 18);

  if (!hasSupabaseEnv()) {
    const generated = eligibleActions.slice(0, limit).map((item) => ({
      id: `generated-${item.id}`,
      sourceKey: item.id,
      source: item.source,
      dashboard: item.dashboard,
      route: item.route,
      title: item.title,
      requestedAction: item.recommendedAction,
      expectedImpact: item.impact,
      riskLevel: riskFromAction(item),
      approvalStatus: "pending" as const,
      executionMode: "human_approval" as const,
      executorStatus: "approval_only" as const,
      guardrailSummary: guardrailForAction(item),
      cannotExecuteReason: "Supabase is not configured, so this request is generated only.",
      requiresHumanApproval: true,
    }));
    sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "unavailable", note: "Supabase env is missing." });
    return { generatedAt: nowIso(), summary: summarize(generated), requests: generated, sourceHealth };
  }

  const supabase = createServiceClient();

  try {
    const rows = eligibleActions.map((item) => ({
      source_key: item.id,
      source: item.source,
      dashboard: item.dashboard,
      route: item.route,
      title: item.title,
      requested_action: item.recommendedAction,
      expected_impact: item.impact,
      risk_level: riskFromAction(item),
      execution_mode: "human_approval",
      guardrail_summary: guardrailForAction(item),
      requires_human_approval: true,
      last_seen_at: nowIso(),
      source_snapshot: {
        source: item.source,
        dashboard: item.dashboard,
        urgency: item.urgency,
        status: item.status,
        generatedAt: actionCenter.generatedAt,
      },
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ai_autopilot_approval_requests")
        .upsert(rows, { onConflict: "source_key" });
      if (upsertError) throw upsertError;
    }

    const sourceKeys = eligibleActions.map((item) => item.id);
    if (sourceKeys.length === 0) {
      sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "ok" });
      return { generatedAt: nowIso(), summary: summarize([]), requests: [], sourceHealth };
    }

    const { data, error } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("*")
      .in("source_key", sourceKeys)
      .in("approval_status", ["pending", "approved", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "ok" });
    let requests = (data ?? []).map(toRequest);

    if (requests.length > 0) {
      const requestIds = requests.map((request) => request.id);
      const { data: runRows, error: runError } = await supabase
        .from("ai_autopilot_execution_runs")
        .select("id,request_id,internal_task_id,internal_task_created_at,execution_status")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });

      if (runError) {
        sourceHealth.push({
          source: "ai_autopilot_execution_runs",
          status: "unavailable",
          note: runError.message,
        });
      } else {
        sourceHealth.push({ source: "ai_autopilot_execution_runs", status: "ok" });
        const latestRunByRequest = new Map<string, Record<string, any>>();
        for (const run of runRows ?? []) {
          if (!latestRunByRequest.has(run.request_id)) latestRunByRequest.set(run.request_id, run);
        }
        requests = requests.map((request) => {
          const run = latestRunByRequest.get(request.id);
          if (!run) return request;
          return {
            ...request,
            executionRunId: run.id,
            internalTaskId: run.internal_task_id ?? null,
            internalTaskCreatedAt: run.internal_task_created_at ?? null,
            executorStatus: run.internal_task_id
              ? "task_created"
              : request.executorStatus === "handoff_queued"
                ? "task_ready"
                : request.executorStatus,
          };
        });
      }
    }

    return { generatedAt: nowIso(), summary: summarize(requests), requests, sourceHealth };
  } catch (error) {
    sourceHealth.push({
      source: "ai_autopilot_approval_requests",
      status: "unavailable",
      note: error instanceof Error ? error.message : String(error),
    });
    return { generatedAt: nowIso(), summary: summarize([]), requests: [], sourceHealth };
  }
}

export async function getAutopilotTaskQueue(limit = 12): Promise<AutopilotTaskQueue> {
  const sourceHealth: AutopilotTaskQueue["sourceHealth"] = [];

  if (!hasSupabaseEnv()) {
    sourceHealth.push({
      source: "ai_autopilot_execution_runs",
      status: "unavailable",
      note: "Supabase env is missing.",
    });
    return { generatedAt: nowIso(), summary: summarizeTasks([]), tasks: [], sourceHealth };
  }

  const supabase = createServiceClient();

  try {
    const { data: runs, error: runsError } = await supabase
      .from("ai_autopilot_execution_runs")
      .select("id,request_id,source_key,created_at,internal_task_id,internal_task_created_at,result_summary")
      .not("internal_task_id", "is", null)
      .order("internal_task_created_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (runsError) throw runsError;
    sourceHealth.push({ source: "ai_autopilot_execution_runs", status: "ok" });

    if (!runs || runs.length === 0) {
      return { generatedAt: nowIso(), summary: summarizeTasks([]), tasks: [], sourceHealth };
    }

    const taskIds = runs.map((run) => run.internal_task_id).filter(Boolean);
    const requestIds = runs.map((run) => run.request_id).filter(Boolean);

    const [tasksResult, requestsResult] = await Promise.all([
      supabase
        .from("crm_tasks")
        .select("id,title,description,status,due_at,created_at,completed_at")
        .in("id", taskIds),
      supabase
        .from("ai_autopilot_approval_requests")
        .select("id,source_key,source,dashboard,route,title,requested_action,expected_impact,guardrail_summary")
        .in("id", requestIds),
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (requestsResult.error) throw requestsResult.error;
    sourceHealth.push({ source: "crm_tasks", status: "ok" });
    sourceHealth.push({ source: "ai_autopilot_approval_requests", status: "ok" });

    const tasksById = new Map((tasksResult.data ?? []).map((task) => [task.id, task]));
    const requestsById = new Map((requestsResult.data ?? []).map((request) => [request.id, request]));

    const tasks: AutopilotInternalTask[] = runs
      .map((run) => {
        const task = tasksById.get(run.internal_task_id);
        const request = requestsById.get(run.request_id);
        if (!task || !request) return null;

        return {
          executionRunId: run.id,
          requestId: run.request_id,
          sourceKey: run.source_key,
          taskId: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          dueAt: task.due_at,
          createdAt: task.created_at,
          completedAt: task.completed_at,
          dashboard: request.dashboard,
          route: request.route,
          source: request.source,
          requestedAction: request.requested_action,
          expectedImpact: request.expected_impact,
          guardrailSummary: request.guardrail_summary,
          taskCreatedAt: run.internal_task_created_at,
        } satisfies AutopilotInternalTask;
      })
      .filter((task): task is AutopilotInternalTask => Boolean(task));

    return { generatedAt: nowIso(), summary: summarizeTasks(tasks), tasks, sourceHealth };
  } catch (error) {
    sourceHealth.push({
      source: "autopilot_task_queue",
      status: "unavailable",
      note: error instanceof Error ? error.message : String(error),
    });
    return { generatedAt: nowIso(), summary: summarizeTasks([]), tasks: [], sourceHealth };
  }
}

export async function decideAutopilotApproval(input: {
  requestId: string;
  decision: AutopilotDecision;
  actorId?: string | null;
  note?: string | null;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured for autopilot approvals." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, error: "requestId is required." };

  const supabase = createServiceClient();
  const note = input.note?.trim() || null;
  const now = nowIso();

  try {
    const { data: existing, error: existingError } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("id,source_key,approval_status,risk_level,source,dashboard")
      .eq("id", requestId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) return { ok: false, error: "Approval request not found." };

    const update: Record<string, any> = { updated_at: now };
    let eventType: "approved" | "rejected" | "commented" = "commented";

    if (input.decision === "approve") {
      const canQueueHandoff = canQueueSafeInternalHandoff(existing);
      update.approval_status = "approved";
      update.approved_at = now;
      update.approved_by = input.actorId ?? null;
      update.rejected_at = null;
      update.rejected_by = null;
      update.decision_note = note;
      update.executor_status = canQueueHandoff ? "handoff_ready" : "approval_only";
      update.cannot_execute_reason = safeHandoffBlockedReason(existing);
      eventType = "approved";
    } else if (input.decision === "reject") {
      update.approval_status = "rejected";
      update.rejected_at = now;
      update.rejected_by = input.actorId ?? null;
      update.decision_note = note;
      update.executor_status = "blocked";
      update.cannot_execute_reason = "Rejected by a human reviewer. Reopen or re-approve before any handoff.";
      eventType = "rejected";
    }

    const { error: updateError } = await supabase
      .from("ai_autopilot_approval_requests")
      .update(update)
      .eq("id", requestId);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("ai_autopilot_approval_events").insert({
      request_id: existing.id,
      source_key: existing.source_key,
      event_type: eventType,
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        priorStatus: existing.approval_status,
        decision: input.decision,
        executionEnabled: false,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      requestId,
      decision: input.decision,
      executionEnabled: false,
      executorStatus: update.executor_status ?? null,
      cannotExecuteReason: update.cannot_execute_reason ?? null,
      message: "Decision recorded. No live execution was triggered.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function queueAutopilotInternalHandoff(input: {
  requestId: string;
  actorId?: string | null;
  note?: string | null;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured for autopilot handoffs." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, error: "requestId is required." };

  const supabase = createServiceClient();
  const note = input.note?.trim() || null;
  const now = nowIso();

  try {
    const { data: request, error: requestError } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("id,source_key,source,dashboard,route,title,requested_action,expected_impact,risk_level,approval_status,executor_status,guardrail_summary,cannot_execute_reason,source_snapshot")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) return { ok: false, error: "Approval request not found." };
    if (request.approval_status !== "approved") {
      return { ok: false, error: "Only approved gates can be queued for internal handoff." };
    }

    if (!canQueueSafeInternalHandoff(request)) {
      const blockedReason = safeHandoffBlockedReason(request);
      await supabase
        .from("ai_autopilot_approval_requests")
        .update({
          updated_at: now,
          executor_status: "blocked",
          cannot_execute_reason: blockedReason,
        })
        .eq("id", requestId);

      await supabase.from("ai_autopilot_approval_events").insert({
        request_id: request.id,
        source_key: request.source_key,
        event_type: "execution_blocked",
        actor_id: input.actorId ?? null,
        note,
        metadata: {
          reason: blockedReason,
          executionEnabled: false,
        },
      });

      return { ok: false, error: blockedReason };
    }

    const payload = {
      source: request.source,
      dashboard: request.dashboard,
      route: request.route,
      title: request.title,
      requestedAction: request.requested_action,
      expectedImpact: request.expected_impact,
      note,
      sourceSnapshot: request.source_snapshot ?? {},
    };

    const { data: run, error: runError } = await supabase
      .from("ai_autopilot_execution_runs")
      .insert({
        request_id: request.id,
        source_key: request.source_key,
        queued_by: input.actorId ?? null,
        execution_type: "internal_handoff",
        execution_status: "queued",
        executor_key: "safe_internal_handoff_v1",
        action_summary: request.requested_action,
        guardrail_summary:
          "Internal handoff only. No external provider, customer-facing action, payment, procurement order, bid submission, or political outreach was executed.",
        preview_payload: payload,
        metadata: {
          approvalStatus: request.approval_status,
          priorExecutorStatus: request.executor_status,
          queuedFrom: "admin_autopilot_panel",
        },
      })
      .select("id,execution_status")
      .single();

    if (runError) {
      if (runError.code === "23505") {
        return { ok: false, error: "This gate already has an open internal handoff queued." };
      }
      throw runError;
    }

    const { error: updateError } = await supabase
      .from("ai_autopilot_approval_requests")
      .update({
        updated_at: now,
        executor_status: "handoff_queued",
        executor_key: "safe_internal_handoff_v1",
        cannot_execute_reason:
          "Safe internal handoff queued. A human still completes any external workflow from the source dashboard.",
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("ai_autopilot_approval_events").insert({
      request_id: request.id,
      source_key: request.source_key,
      event_type: "execution_queued",
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        executionRunId: run.id,
        executionStatus: run.execution_status,
        executionEnabled: false,
        externalWorkflowTouched: false,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      requestId,
      executionRunId: run.id,
      executorStatus: "handoff_queued" as const,
      executionStatus: run.execution_status,
      executionEnabled: false,
      message: "Safe internal handoff queued. No external workflow was executed.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createAutopilotInternalTask(input: {
  requestId: string;
  actorId?: string | null;
  note?: string | null;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured for autopilot task creation." };
  }

  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, error: "requestId is required." };

  const supabase = createServiceClient();
  const note = input.note?.trim() || null;
  const now = nowIso();

  try {
    const { data: request, error: requestError } = await supabase
      .from("ai_autopilot_approval_requests")
      .select("id,source_key,source,dashboard,route,title,requested_action,expected_impact,risk_level,approval_status,executor_status,guardrail_summary,cannot_execute_reason")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) return { ok: false, error: "Approval request not found." };
    if (request.approval_status !== "approved") {
      return { ok: false, error: "Only approved gates can create internal tasks." };
    }
    if (!["handoff_queued", "task_ready", "task_created"].includes(request.executor_status)) {
      return { ok: false, error: "Queue a safe internal handoff before creating a task." };
    }

    const { data: run, error: runError } = await supabase
      .from("ai_autopilot_execution_runs")
      .select("id,request_id,source_key,internal_task_id,preview_payload,execution_status")
      .eq("request_id", request.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) throw runError;
    if (!run) return { ok: false, error: "No internal handoff run exists yet. Queue handoff first." };
    if (run.internal_task_id) {
      return {
        ok: true,
        requestId,
        internalTaskId: run.internal_task_id,
        executorStatus: "task_created" as const,
        executionEnabled: false,
        message: "Internal task already exists. No external workflow was executed.",
      };
    }

    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const description = [
      `AI-approved internal handoff from ${request.dashboard}.`,
      "",
      `Recommended action: ${request.requested_action}`,
      `Expected impact: ${request.expected_impact}`,
      `Open workflow: ${request.route}`,
      "",
      `Guardrail: ${request.guardrail_summary}`,
      "Safety: This task does not send outreach, place orders, submit bids, change pricing, create checkout, or contact customers.",
      note ? `\nDecision note: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: task, error: taskError } = await supabase
      .from("crm_tasks")
      .insert({
        agent_id: input.actorId ?? null,
        type: "other",
        status: "pending",
        title: `AI handoff: ${request.title}`.slice(0, 240),
        description,
        due_at: dueAt,
      })
      .select("id")
      .single();

    if (taskError) throw taskError;

    const { error: runUpdateError } = await supabase
      .from("ai_autopilot_execution_runs")
      .update({
        updated_at: now,
        completed_at: now,
        completed_by: input.actorId ?? null,
        execution_status: "completed",
        internal_task_id: task.id,
        internal_task_created_at: now,
        result_summary: "Created an internal CRM task for human follow-up. No external workflow was executed.",
      })
      .eq("id", run.id);

    if (runUpdateError) throw runUpdateError;

    const { error: requestUpdateError } = await supabase
      .from("ai_autopilot_approval_requests")
      .update({
        updated_at: now,
        executor_status: "task_created",
        cannot_execute_reason:
          "Internal CRM task created. A human still completes any external workflow from the source dashboard.",
      })
      .eq("id", request.id);

    if (requestUpdateError) throw requestUpdateError;

    const { error: eventError } = await supabase.from("ai_autopilot_approval_events").insert({
      request_id: request.id,
      source_key: request.source_key,
      event_type: "internal_task_created",
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        executionRunId: run.id,
        internalTaskId: task.id,
        dueAt,
        executionEnabled: false,
        externalWorkflowTouched: false,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      requestId,
      executionRunId: run.id,
      internalTaskId: task.id,
      executorStatus: "task_created" as const,
      dueAt,
      executionEnabled: false,
      message: "Internal CRM task created. No external workflow was executed.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function completeAutopilotInternalTask(input: {
  taskId: string;
  actorId?: string | null;
  note?: string | null;
}) {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "Supabase is not configured for autopilot task completion." };
  }

  const taskId = input.taskId?.trim();
  if (!taskId) return { ok: false, error: "taskId is required." };

  const supabase = createServiceClient();
  const now = nowIso();
  const note = input.note?.trim() || null;

  try {
    const { data: run, error: runError } = await supabase
      .from("ai_autopilot_execution_runs")
      .select("id,request_id,source_key,internal_task_id,metadata")
      .eq("internal_task_id", taskId)
      .maybeSingle();

    if (runError) throw runError;
    if (!run) return { ok: false, error: "Autopilot task link not found." };

    const { error: taskError } = await supabase
      .from("crm_tasks")
      .update({
        status: "done",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", taskId);

    if (taskError) throw taskError;

    const { error: runUpdateError } = await supabase
      .from("ai_autopilot_execution_runs")
      .update({
        updated_at: now,
        result_summary: "Internal CRM task marked done by admin. No external workflow was executed.",
        metadata: {
          ...((run.metadata && typeof run.metadata === "object" && !Array.isArray(run.metadata)) ? run.metadata : {}),
          internalTaskCompletedAt: now,
          internalTaskCompletedBy: input.actorId ?? null,
        },
      })
      .eq("id", run.id);

    if (runUpdateError) throw runUpdateError;

    const { error: eventError } = await supabase.from("ai_autopilot_approval_events").insert({
      request_id: run.request_id,
      source_key: run.source_key,
      event_type: "execution_completed",
      actor_id: input.actorId ?? null,
      note,
      metadata: {
        executionRunId: run.id,
        internalTaskId: taskId,
        internalTaskCompleted: true,
        executionEnabled: false,
        externalWorkflowTouched: false,
      },
    });

    if (eventError) throw eventError;

    return {
      ok: true,
      taskId,
      executionRunId: run.id,
      status: "done",
      executionEnabled: false,
      message: "Internal task marked done. No external workflow was executed.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
