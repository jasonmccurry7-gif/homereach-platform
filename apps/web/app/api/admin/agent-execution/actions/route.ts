import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { buildDryRunChecklist, isSensitiveScope, PERMISSION_SCOPES } from "@/lib/agent-execution/repository";
import type {
  AgentDryRunChecklistItem,
  AgentExecutionStatus,
  AgentExecutionTask,
  AgentPermissionScope,
} from "@/lib/agent-execution/types";
import { syncAgentExecutionLedger } from "@/lib/approvals/agent-execution-ledger";
import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_STATUSES = new Set<AgentExecutionStatus>([
  "pending_approval",
  "queued",
  "approved",
  "dry_run_ready",
  "completed",
  "failed",
  "paused",
  "rejected",
  "cancelled",
  "manual_takeover_required",
  "manual_takeover_needed",
  "executed_manually",
]);

const SENSITIVE_ACTION_TERMS = [
  "send",
  "sms",
  "post",
  "order",
  "purchase",
  "spend",
  "submit",
  "bid",
  "contract",
  "settings",
  "delete",
  "export",
];

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase service credentials are not configured." }, { status: 503 });
  }

  const db = createServiceClient();
  const body = (await request.json().catch(() => ({}))) as JsonRecord;
  const action = String(body.action ?? "");
  const userId = guard.user?.id ?? null;

  try {
    switch (action) {
      case "queue_from_mini_app": {
        const mode = String(body.mode ?? "send_to_execution_queue");
        const miniAppId = requireString(body.miniAppId, "Mini app id is required.");
        const sourceAgent = stringValue(body.sourceAgent) ?? "Orchestrator Agent";
        const targetSystem = stringValue(body.targetSystem) ?? "HomeReach Admin";
        const targetUrl = stringValue(body.targetUrl);
        const taskType = stringValue(body.taskType) ?? "browser_readiness";
        const notes = stringValue(body.notes);
        const taskId = stringValue(body.taskId) ?? nextTaskId(miniAppId);
        const modeConfig = modeToTaskConfig(mode);
        const permissionScope = normalizePermissionScope(body.permissionScope ?? modeConfig.permissionScope);
        const sensitiveActionFlags = sensitiveFlags({
          permissionScope,
          targetSystem,
          taskType,
          notes,
        });
        const now = new Date().toISOString();
        const row = {
          task_id: taskId,
          mini_app_id: miniAppId,
          source_agent: sourceAgent,
          task_type: taskType,
          target_system: targetSystem,
          target_url: targetUrl,
          permission_scope: permissionScope,
          status: modeConfig.status,
          human_approval_required: true,
          approved_by: modeConfig.approved ? userId : null,
          approved_at: modeConfig.approved ? now : null,
          execution_completed_at: modeConfig.status === "executed_manually" ? now : null,
          screenshot_before_url: null,
          screenshot_after_url: null,
          execution_log: [
            {
              at: now,
              actor: "HomeReach Admin",
              event: mode,
              note:
                notes ??
                "Queued by mini app. This records readiness only and does not control the browser or external system.",
            },
          ],
          failure_reason: null,
          retry_allowed: false,
          manual_takeover_required: modeConfig.manualTakeover,
          dry_run_enabled: true,
          dry_run_checklist: buildDryRunChecklist(targetSystem, permissionScope),
          sensitive_action_flags: sensitiveActionFlags,
          created_by: userId,
        };

        const { data, error } = await db
          .from("agent_execution_queue")
          .insert(row)
          .select("id,task_id,mini_app_id,permission_scope,status")
          .single();
        if (error) throw error;

        await audit(db, {
          executionTaskId: String(data.id),
          taskPublicId: String(data.task_id),
          miniAppId,
          actorUserId: userId,
          eventType: "execution_task_created",
          whatChanged: {
            mode,
            status: data.status,
            permissionScope: data.permission_scope,
            targetSystem,
            targetUrl,
            dryRun: true,
          },
          allowedScope: permissionScope,
          attemptedAction: "queue readiness task",
          result: "queued",
          notes:
            "No browser/computer-use execution occurred. Task is approval-gated and dry-run enabled.",
        });

        const taskResult = await db
          .from("agent_execution_queue")
          .select("*")
          .eq("id", data.id)
          .single();
        if (taskResult.error) throw taskResult.error;

        const task = mapAgentExecutionTask(taskResult.data);
        const ledgerResult = await syncAgentExecutionLedger(task, {
          actorId: userId,
          actorLabel: "agent_execution_queue",
          eventType: "agent_execution_task_created",
        });
        if (!ledgerResult.ok) {
          console.warn("[approval-ledger] agent execution create sync skipped:", ledgerResult.error);
        }

        return NextResponse.json({ ok: true, id: data.id, taskId: data.task_id });
      }

      case "update_execution_task": {
        const id = requireUuid(body.id, "Execution task id is required.");
        const status = normalizeExecutionStatus(body.status);
        const permissionScope = body.permissionScope ? normalizePermissionScope(body.permissionScope) : null;
        const notes = stringValue(body.notes) ?? `Marked ${status} from Agent Execution Readiness.`;
        const { data: existing, error: existingError } = await db
          .from("agent_execution_queue")
          .select("*")
          .eq("id", id)
          .single();
        if (existingError) throw existingError;

        if (status === "running") {
          return NextResponse.json(
            {
              error:
                "Direct browser/computer-use execution is not enabled in HomeReach. Use dry-run, approval, or manual takeover states.",
            },
            { status: 409 },
          );
        }

        const scope = permissionScope ?? normalizePermissionScope(existing.permission_scope);
        const now = new Date().toISOString();
        const patch: JsonRecord = {
          status,
          permission_scope: scope,
          human_approval_required: true,
          manual_takeover_required: status === "manual_takeover_required" || Boolean(existing.manual_takeover_required),
          updated_at: now,
          execution_log: [
            ...asExecutionLog(existing.execution_log),
            {
              at: now,
              actor: "HomeReach Admin",
              event: "status_updated",
              note: notes,
            },
          ],
          dry_run_checklist: buildDryRunChecklist(String(existing.target_system ?? "HomeReach Admin"), scope),
          sensitive_action_flags: sensitiveFlags({
            permissionScope: scope,
            targetSystem: String(existing.target_system ?? ""),
            taskType: String(existing.task_type ?? ""),
            notes,
          }),
        };
        if (status === "approved" || status === "dry_run_ready" || status === "executed_manually") {
          patch.approved_by = userId;
          patch.approved_at = existing.approved_at ?? now;
        }
        if (status === "executed_manually" || status === "completed") {
          patch.execution_completed_at = now;
        }
        if (status === "failed") {
          patch.failure_reason = notes;
        }

        const { data, error } = await db
          .from("agent_execution_queue")
          .update(patch)
          .eq("id", id)
          .select("id,task_id,mini_app_id,permission_scope,status")
          .single();
        if (error) throw error;

        await audit(db, {
          executionTaskId: String(data.id),
          taskPublicId: String(data.task_id),
          miniAppId: String(data.mini_app_id),
          actorUserId: userId,
          eventType: "execution_task_updated",
          whatChanged: { status, permissionScope: scope },
          allowedScope: scope,
          attemptedAction: "update readiness task state",
          result: "updated",
          notes,
        });

        const taskResult = await db
          .from("agent_execution_queue")
          .select("*")
          .eq("id", data.id)
          .single();
        if (taskResult.error) throw taskResult.error;

        const task = mapAgentExecutionTask(taskResult.data);
        const ledgerResult = await syncAgentExecutionLedger(task, {
          actorId: userId,
          actorLabel: "agent_execution_update",
          eventType: "agent_execution_task_updated",
        });
        if (!ledgerResult.ok) {
          console.warn("[approval-ledger] agent execution update sync skipped:", ledgerResult.error);
        }

        return NextResponse.json({ ok: true });
      }

      case "upsert_session_registry": {
        const systemName = requireString(body.systemName, "System name is required.");
        const row = {
          system_name: systemName,
          login_url: stringValue(body.loginUrl),
          purpose: stringValue(body.purpose) ?? "Documented external system for future browser/computer-use readiness.",
          account_owner: stringValue(body.accountOwner) ?? "HomeReach Admin",
          allowed_actions: asStringArray(body.allowedActions),
          blocked_actions: asStringArray(body.blockedActions),
          requires_mfa: body.requiresMfa !== false,
          notes: stringValue(body.notes),
          preferred_browser_profile:
            stringValue(body.preferredBrowserProfile) ??
            "Dedicated HomeReach Windows user + dedicated Chrome profile",
          active_session_status: normalizeSessionStatus(body.activeSessionStatus),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await db
          .from("agent_browser_session_registry")
          .upsert(row, { onConflict: "system_name" })
          .select("id,system_name,active_session_status")
          .single();
        if (error) throw error;

        await audit(db, {
          miniAppId: "browser-session-registry",
          actorUserId: userId,
          eventType: "browser_session_registry_upserted",
          whatChanged: {
            systemName: data.system_name,
            status: data.active_session_status,
            storesSecrets: false,
          },
          allowedScope: "read_only",
          attemptedAction: "document external system access policy",
          result: "updated",
          notes: "Registry update only. No credentials, secrets, MFA data, or session tokens were stored.",
        });

        return NextResponse.json({ ok: true, id: data.id });
      }

      default:
        return NextResponse.json({ error: "Unknown Agent Execution action." }, { status: 400 });
    }
  } catch (error) {
    const message = errorMessage(error);
    if (/does not exist|Could not find|relation|schema cache/i.test(message)) {
      return NextResponse.json({ error: message, migration: "Run the Agent Execution Readiness migration." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function modeToTaskConfig(mode: string): {
  status: AgentExecutionStatus;
  permissionScope: AgentPermissionScope;
  approved: boolean;
  manualTakeover: boolean;
} {
  if (mode === "approve_browser_agent") {
    return { status: "approved", permissionScope: "prepare_only", approved: true, manualTakeover: false };
  }
  if (mode === "approve_draft_only") {
    return { status: "approved", permissionScope: "draft_only", approved: true, manualTakeover: false };
  }
  if (mode === "require_manual_takeover") {
    return { status: "manual_takeover_required", permissionScope: "read_only", approved: false, manualTakeover: true };
  }
  if (mode === "mark_executed_manually") {
    return { status: "executed_manually", permissionScope: "read_only", approved: true, manualTakeover: true };
  }
  return { status: "pending_approval", permissionScope: "read_only", approved: false, manualTakeover: false };
}

async function audit(
  db: ReturnType<typeof createServiceClient>,
  input: {
    executionTaskId?: string | null;
    taskPublicId?: string | null;
    miniAppId?: string | null;
    actorUserId?: string | null;
    eventType: string;
    whatChanged: JsonRecord;
    allowedScope: AgentPermissionScope;
    attemptedAction?: string | null;
    result: string;
    notes?: string | null;
  },
) {
  await db.from("agent_execution_audit_log").insert({
    execution_task_id: input.executionTaskId ?? null,
    task_public_id: input.taskPublicId ?? null,
    mini_app_id: input.miniAppId ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_label: "HomeReach Admin",
    event_type: input.eventType,
    what_changed: input.whatChanged,
    allowed_scope: input.allowedScope,
    attempted_action: input.attemptedAction ?? null,
    result: input.result,
    notes: input.notes ?? null,
  });
}

function nextTaskId(miniAppId: string) {
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `AER-${miniAppId.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${suffix}`;
}

function sensitiveFlags(input: {
  permissionScope: AgentPermissionScope;
  targetSystem: string;
  taskType: string;
  notes?: string | null;
}) {
  const flags = new Set<string>();
  if (isSensitiveScope(input.permissionScope)) flags.add(input.permissionScope);
  const haystack = `${input.targetSystem} ${input.taskType} ${input.notes ?? ""}`.toLowerCase();
  SENSITIVE_ACTION_TERMS.forEach((term) => {
    if (haystack.includes(term)) flags.add(term);
  });
  return Array.from(flags);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requireString(value: unknown, message: string): string {
  const result = stringValue(value);
  if (!result) throw new Error(message);
  return result;
}

function requireUuid(value: unknown, message: string): string {
  const id = requireString(value, message);
  if (!UUID_PATTERN.test(id)) {
    throw new Error("This execution task is not a persisted database row. Apply the migration and refresh.");
  }
  return id;
}

function normalizePermissionScope(value: unknown): AgentPermissionScope {
  const scope = String(value ?? "read_only");
  return PERMISSION_SCOPES.includes(scope as AgentPermissionScope) ? (scope as AgentPermissionScope) : "read_only";
}

function normalizeExecutionStatus(value: unknown): AgentExecutionStatus {
  const status = String(value ?? "pending_approval") as AgentExecutionStatus;
  if (!SAFE_STATUSES.has(status)) throw new Error(`Unsafe or invalid execution status: ${status}`);
  return status;
}

function normalizeSessionStatus(value: unknown) {
  const status = String(value ?? "manual_login_required");
  if (
    status === "not_configured" ||
    status === "manual_login_required" ||
    status === "active" ||
    status === "expired" ||
    status === "blocked" ||
    status === "do_not_automate"
  ) {
    return status;
  }
  return "manual_login_required";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function asExecutionLog(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item));
}

function mapAgentExecutionTask(row: JsonRecord): AgentExecutionTask {
  const dryRunChecklist: AgentDryRunChecklistItem[] = Array.isArray(row.dry_run_checklist)
    ? row.dry_run_checklist
        .filter((item) => item !== null && typeof item === "object" && !Array.isArray(item))
        .map((item) => {
          const record = item as JsonRecord;
          const rawStatus = String(record.status ?? "pending");
          const status: AgentDryRunChecklistItem["status"] =
            rawStatus === "ready" ? "ready" : rawStatus === "blocked" ? "blocked" : "pending";
          return {
            label: String(record.label ?? "Checklist item"),
            status,
            detail: String(record.detail ?? ""),
          };
        })
    : [];

  return {
    id: String(row.id),
    taskId: String(row.task_id ?? ""),
    miniAppId: String(row.mini_app_id ?? ""),
    sourceAgent: String(row.source_agent ?? ""),
    taskType: String(row.task_type ?? ""),
    targetSystem: String(row.target_system ?? ""),
    targetUrl: stringValue(row.target_url),
    permissionScope: normalizePermissionScope(row.permission_scope),
    status: normalizeExecutionStatus(row.status),
    humanApprovalRequired: Boolean(row.human_approval_required ?? true),
    approvedBy: stringValue(row.approved_by),
    approvedAt: stringValue(row.approved_at),
    executionStartedAt: stringValue(row.execution_started_at),
    executionCompletedAt: stringValue(row.execution_completed_at),
    screenshotBeforeUrl: stringValue(row.screenshot_before_url),
    screenshotAfterUrl: stringValue(row.screenshot_after_url),
    executionLog: asExecutionLog(row.execution_log).map((item) => ({
      at: String((item as JsonRecord).at ?? new Date().toISOString()),
      actor: String((item as JsonRecord).actor ?? "HomeReach Admin"),
      event: String((item as JsonRecord).event ?? "activity"),
      note: String((item as JsonRecord).note ?? ""),
    })),
    failureReason: stringValue(row.failure_reason),
    retryAllowed: Boolean(row.retry_allowed ?? false),
    manualTakeoverRequired: Boolean(row.manual_takeover_required ?? false),
    dryRunEnabled: Boolean(row.dry_run_enabled ?? true),
    dryRunChecklist,
    sensitiveActionFlags: asStringArray(row.sensitive_action_flags),
    createdBy: stringValue(row.created_by),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as JsonRecord;
    const parts = [
      stringValue(record.message),
      stringValue(record.details),
      stringValue(record.hint),
      stringValue(record.code) ? `code ${String(record.code)}` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  return "Agent Execution action failed.";
}
