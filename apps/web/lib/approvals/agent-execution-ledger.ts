import "server-only";

import type {
  AgentExecutionStatus,
  AgentExecutionTask,
} from "@/lib/agent-execution/types";
import {
  syncApprovalLedgerPayload,
  type ApprovalLedgerPayload,
} from "./ledger";

type AgentExecutionLedgerOptions = {
  actorId?: string | null;
  actorLabel?: string | null;
  eventType?: string;
  eventNotes?: string;
  eventMetadata?: Record<string, unknown>;
};

function approvalState(status: AgentExecutionStatus): ApprovalLedgerPayload["approval_state"] {
  if (status === "pending_approval") return "needs_review";
  if (status === "approved" || status === "dry_run_ready") return "approved";
  if (status === "failed" || status === "manual_takeover_required" || status === "manual_takeover_needed") return "blocked";
  if (status === "rejected" || status === "cancelled") return "rejected";
  if (status === "completed" || status === "executed_manually") return "completed";
  if (status === "queued") return "approved";
  return "needs_review";
}

function lane(task: AgentExecutionTask): ApprovalLedgerPayload["lane"] {
  if (
    task.status === "failed" ||
    task.status === "manual_takeover_required" ||
    task.status === "manual_takeover_needed"
  ) {
    return "blocked";
  }
  if (
    task.status === "completed" ||
    task.status === "executed_manually" ||
    task.status === "rejected" ||
    task.status === "cancelled"
  ) {
    return "learning";
  }
  return "needs_approval";
}

function priority(task: AgentExecutionTask): ApprovalLedgerPayload["priority"] {
  if (
    task.status === "failed" ||
    task.status === "manual_takeover_required" ||
    task.status === "manual_takeover_needed"
  ) {
    return "critical";
  }
  if (task.sensitiveActionFlags.length > 0 || task.permissionScope.includes("approval")) {
    return "high";
  }
  return "normal";
}

function nextAction(task: AgentExecutionTask) {
  if (task.status === "pending_approval") {
    return "Review the execution task scope, dry-run checklist, and sensitive-action flags before approving any browser or operator handoff.";
  }
  if (task.status === "approved" || task.status === "dry_run_ready" || task.status === "queued") {
    return "Keep execution in dry-run, draft-only, or manual-takeover mode until the operator confirms the next step.";
  }
  if (task.status === "manual_takeover_required" || task.status === "manual_takeover_needed") {
    return "An operator needs to take over manually; do not let the task proceed autonomously.";
  }
  if (task.status === "failed") {
    return "Resolve the failure reason and approval scope before retrying the execution task.";
  }
  if (task.status === "completed" || task.status === "executed_manually") {
    return "Capture the outcome and keep any external actions manually governed.";
  }
  if (task.status === "rejected" || task.status === "cancelled") {
    return "Keep the rejected or cancelled task closed unless it is intentionally re-queued with a new approval decision.";
  }
  return "Review the task state and preserve approval gating before any execution proceeds.";
}

export async function syncAgentExecutionLedger(
  task: AgentExecutionTask,
  options: AgentExecutionLedgerOptions = {},
) {
  const payload: ApprovalLedgerPayload = {
    source_key: `agent_execution_queue:${task.id}:agent_execution_task`,
    source_system: "agent_execution",
    source_table: "agent_execution_queue",
    source_id: task.id,
    source_href: "/admin/agent-execution",
    domain: "operations",
    approval_kind: "agent_execution_task",
    title: `${task.targetSystem} ${task.taskType.replaceAll("_", " ")}`,
    detail: `${task.sourceAgent} / ${task.miniAppId} / ${task.permissionScope}${task.targetUrl ? ` / ${task.targetUrl}` : ""}`,
    source_status: task.status,
    approval_state: approvalState(task.status),
    lane: lane(task),
    priority: priority(task),
    approval_required: task.humanApprovalRequired,
    human_approval_required: task.humanApprovalRequired,
    sensitive_action: task.sensitiveActionFlags.length > 0,
    requested_by: task.createdBy ?? null,
    decided_by: task.approvedBy ?? null,
    decided_at: task.approvedAt ?? null,
    related_entity_type: "mini_app",
    related_entity_id: task.miniAppId,
    next_action: nextAction(task),
    guardrail:
      "Agent Execution prepares dry runs, approval checkpoints, screenshots, and audit logs only. It must not directly automate sensitive external actions without manual governance.",
    compliance_notes: task.failureReason,
    action_target: {
      kind: "link_only",
      id: task.id,
      status: task.status,
    },
    evidence: {
      task_id: task.taskId,
      mini_app_id: task.miniAppId,
      source_agent: task.sourceAgent,
      task_type: task.taskType,
      target_system: task.targetSystem,
      target_url: task.targetUrl,
      permission_scope: task.permissionScope,
      dry_run_enabled: task.dryRunEnabled,
      manual_takeover_required: task.manualTakeoverRequired,
      retry_allowed: task.retryAllowed,
      sensitive_action_flags: task.sensitiveActionFlags,
    },
    metadata: {
      source_label: "Agent Execution",
      synced_from: "agent_execution_workflow",
    },
    source_created_at: task.createdAt,
    source_updated_at: task.updatedAt,
    updated_at: new Date().toISOString(),
  };

  return syncApprovalLedgerPayload(payload, {
    actorId: options.actorId ?? null,
    actorLabel: options.actorLabel ?? "agent_execution_workflow",
    eventType: options.eventType ?? "agent_execution_task_synced",
    eventNotes: options.eventNotes,
    eventMetadata: {
      mini_app_id: task.miniAppId,
      target_system: task.targetSystem,
      permission_scope: task.permissionScope,
      status: task.status,
      ...(options.eventMetadata ?? {}),
    },
    syncSource: "agent_execution_workflow",
  });
}
