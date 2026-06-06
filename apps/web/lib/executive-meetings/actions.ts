import "server-only";

import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { createServiceClient } from "@/lib/supabase/service";
import {
  EXECUTIVE_DOMAINS,
  type ExecutiveActionResult,
  type ExecutiveApprovalStatus,
  type ExecutivePermissionLevel,
} from "./types";

type Db = ReturnType<typeof createServiceClient>;
type JsonRecord = Record<string, unknown>;

const PERMISSIONS: ExecutivePermissionLevel[] = [
  "analysis_only",
  "recommend_only",
  "draft_only",
  "approval_required",
  "admin_review_required",
];
const APPROVAL_STATUSES: ExecutiveApprovalStatus[] = ["pending", "approved", "rejected", "edited", "archived"];
const FINAL_APPROVAL_STATUSES = new Set<ExecutiveApprovalStatus>(["approved", "rejected", "archived"]);

export async function updateExecutiveAgent(input: {
  db: Db;
  actorUserId: string | null;
  body: JsonRecord;
}): Promise<ExecutiveActionResult> {
  const agentId = requiredString(input.body.agentId, "Agent id is required.");
  const patch: JsonRecord = { updated_at: new Date().toISOString() };
  if (input.body.name !== undefined) patch.name = boundedString(input.body.name, "Agent name is required.", 120);
  if (input.body.mission !== undefined) patch.mission = boundedString(input.body.mission, "Mission is required.", 1000);
  if (input.body.systemPrompt !== undefined) patch.system_prompt = boundedString(input.body.systemPrompt, "System prompt is required.", 12000);
  if (input.body.permissionsLevel !== undefined) patch.permissions_level = permission(input.body.permissionsLevel);
  if (input.body.assignedDomains !== undefined) patch.assigned_domains = domains(input.body.assignedDomains);
  if (input.body.enabled !== undefined) patch.enabled = Boolean(input.body.enabled);

  const { data, error } = await input.db.from("executive_agents").update(patch).eq("id", agentId).select("id, role").single();
  if (error) return failure(error.message, 500);

  await audit({
    actorUserId: input.actorUserId,
    actionType: "executive_agent_updated",
    entityType: "executive_agent",
    entityId: String(data.id),
    message: `${String(data.role ?? "Executive agent")} updated.`,
    metadata: { changedFields: Object.keys(patch).filter((key) => key !== "updated_at") },
  });
  return { ok: true, id: String(data.id) };
}

export async function toggleExecutiveAgent(input: {
  db: Db;
  actorUserId: string | null;
  body: JsonRecord;
}): Promise<ExecutiveActionResult> {
  const agentId = requiredString(input.body.agentId, "Agent id is required.");
  const enabled = Boolean(input.body.enabled);
  const { data, error } = await input.db
    .from("executive_agents")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", agentId)
    .select("id, role")
    .single();
  if (error) return failure(error.message, 500);

  await audit({
    actorUserId: input.actorUserId,
    actionType: enabled ? "executive_agent_enabled" : "executive_agent_disabled",
    entityType: "executive_agent",
    entityId: String(data.id),
    message: `${String(data.role ?? "Executive agent")} ${enabled ? "enabled" : "disabled"}.`,
    metadata: { enabled },
  });
  return { ok: true, id: String(data.id) };
}

export async function updateExecutiveApproval(input: {
  db: Db;
  actorUserId: string | null;
  body: JsonRecord;
}): Promise<ExecutiveActionResult> {
  const approvalId = requiredString(input.body.approvalId, "Approval id is required.");
  const nextStatus = approvalStatus(input.body.approvalStatus);
  const { data: current, error: currentError } = await input.db
    .from("executive_action_approvals")
    .select("id, pending_action, approval_status, meeting_id, audit_payload_json")
    .eq("id", approvalId)
    .maybeSingle();
  if (currentError) return failure(currentError.message, 500);
  if (!current) return failure("Executive approval was not found.", 404);

  const previousStatus = approvalStatus(current.approval_status);
  if (!isAllowedApprovalTransition(previousStatus, nextStatus)) {
    return failure(`Cannot move executive approval from ${previousStatus} to ${nextStatus}.`, 409);
  }

  const editedAction =
    input.body.editedAction !== undefined ? nullableString(input.body.editedAction) : null;
  const decisionReason =
    input.body.decisionReason !== undefined ? nullableString(input.body.decisionReason) : null;

  if (nextStatus === "edited" && !editedAction) {
    return failure("Edited approval text is required before marking this action edited.", 400);
  }
  if (nextStatus === "rejected" && !decisionReason) {
    return failure("A rejection note is required for executive approval decisions.", 400);
  }

  const patch: JsonRecord = {
    approval_status: nextStatus,
    updated_at: new Date().toISOString(),
    audit_payload_json: {
      ...asRecord(current.audit_payload_json),
      lastDecision: {
        previousStatus,
        newStatus: nextStatus,
        decidedBy: input.actorUserId,
        decidedAt: new Date().toISOString(),
        externalActionAuthorized: false,
      },
    },
  };
  if (nextStatus !== "pending") {
    patch.decided_by = input.actorUserId;
    patch.decided_at = new Date().toISOString();
  }
  if (input.body.editedAction !== undefined) patch.edited_action = editedAction;
  if (input.body.decisionReason !== undefined) patch.decision_reason = decisionReason;

  const { data, error } = await input.db
    .from("executive_action_approvals")
    .update(patch)
    .eq("id", approvalId)
    .eq("approval_status", previousStatus)
    .select("id, pending_action, meeting_id")
    .single();
  if (error) return failure(error.message, 500);

  await audit({
    actorUserId: input.actorUserId,
    actionType: "executive_action_approval_decided",
    entityType: "executive_action_approval",
    entityId: String(data.id),
    message: `Executive action "${String(data.pending_action ?? "approval")}" marked ${nextStatus}.`,
    metadata: {
      previousStatus,
      approvalStatus: nextStatus,
      meetingId: data.meeting_id,
      externalActionAuthorized: false,
    },
  });
  return { ok: true, id: String(data.id), meetingId: nullableString(data.meeting_id) };
}

export async function updateExecutiveSettings(input: {
  db: Db;
  actorUserId: string | null;
  body: JsonRecord;
}): Promise<ExecutiveActionResult> {
  const settingsKey = nullableString(input.body.settingsKey) ?? "default";
  const { data: current, error: currentError } = await input.db
    .from("executive_meeting_settings")
    .select("id, provider_plan_json, email_summary_enabled, sms_summary_enabled")
    .eq("settings_key", settingsKey)
    .maybeSingle();
  if (currentError) return failure(currentError.message, 500);
  if (!current) return failure("Executive meeting settings were not found.", 404);

  const patch: JsonRecord = { updated_at: new Date().toISOString() };
  if (input.body.autoGenerateEnabled !== undefined) patch.auto_generate_enabled = Boolean(input.body.autoGenerateEnabled);
  if (input.body.notificationBadgeEnabled !== undefined) patch.notification_badge_enabled = Boolean(input.body.notificationBadgeEnabled);
  if (input.body.emailSummaryEnabled !== undefined) patch.email_summary_enabled = Boolean(input.body.emailSummaryEnabled);
  if (input.body.smsSummaryEnabled !== undefined) patch.sms_summary_enabled = Boolean(input.body.smsSummaryEnabled);
  if (input.body.voiceModeEnabled !== undefined) patch.voice_mode_enabled = Boolean(input.body.voiceModeEnabled);
  if (input.body.timezone !== undefined) patch.timezone = timezone(input.body.timezone);
  if (input.body.morningTime !== undefined) patch.morning_time = normalizeTime(input.body.morningTime);
  if (input.body.afternoonTime !== undefined) patch.afternoon_time = normalizeTime(input.body.afternoonTime);

  const nextEmailSummary =
    patch.email_summary_enabled !== undefined ? Boolean(patch.email_summary_enabled) : Boolean(current.email_summary_enabled);
  const nextSmsSummary =
    patch.sms_summary_enabled !== undefined ? Boolean(patch.sms_summary_enabled) : Boolean(current.sms_summary_enabled);
  if ((nextEmailSummary || nextSmsSummary) && !externalSummariesAreAllowed(current.provider_plan_json)) {
    return failure("Email and SMS summaries remain disabled until provider delivery is explicitly enabled by environment and provider plan.", 403);
  }

  const { data, error } = await input.db
    .from("executive_meeting_settings")
    .update(patch)
    .eq("settings_key", settingsKey)
    .select("id")
    .single();
  if (error) return failure(error.message, 500);

  await audit({
    actorUserId: input.actorUserId,
    actionType: "executive_meeting_settings_updated",
    entityType: "executive_meeting_settings",
    entityId: String(data.id),
    message: "Executive meeting settings updated.",
    metadata: {
      changedFields: Object.keys(patch).filter((key) => key !== "updated_at"),
      externalSummariesAllowed: externalSummariesAreAllowed(current.provider_plan_json),
    },
  });
  return { ok: true, id: String(data.id) };
}

function requiredString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(message);
  return value.trim();
}

function boundedString(value: unknown, message: string, maxLength: number) {
  const text = requiredString(value, message);
  if (text.length > maxLength) throw new Error(`${message.replace(/\.$/, "")} must be ${maxLength} characters or fewer.`);
  return text;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function permission(value: unknown): ExecutivePermissionLevel {
  if (typeof value === "string" && PERMISSIONS.includes(value as ExecutivePermissionLevel)) {
    return value as ExecutivePermissionLevel;
  }
  throw new Error("Invalid permissions level.");
}

function approvalStatus(value: unknown): ExecutiveApprovalStatus {
  if (typeof value === "string" && APPROVAL_STATUSES.includes(value as ExecutiveApprovalStatus)) {
    return value as ExecutiveApprovalStatus;
  }
  throw new Error("Invalid approval status.");
}

function domains(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Assigned domains must be an array.");
  const allowed = new Set<string>(EXECUTIVE_DOMAINS);
  const invalid = value.filter((item) => typeof item !== "string" || !allowed.has(item));
  if (invalid.length > 0) throw new Error("Assigned domains include an unsupported executive domain.");
  return value.filter((item): item is string => typeof item === "string" && allowed.has(item));
}

function normalizeTime(value: unknown) {
  const raw = requiredString(value, "Meeting time is required.");
  const match = raw.match(/^(\d{2}):(\d{2})(:\d{2})?$/);
  if (!match) throw new Error("Meeting time must be HH:mm.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    throw new Error("Meeting time must be a valid 24-hour HH:mm value.");
  }
  return raw.length === 5 ? `${raw}:00` : raw;
}

function timezone(value: unknown) {
  const zone = requiredString(value, "Timezone is required.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
  } catch {
    throw new Error("Timezone must be a valid IANA timezone.");
  }
  return zone;
}

function isAllowedApprovalTransition(previous: ExecutiveApprovalStatus, next: ExecutiveApprovalStatus) {
  if (previous === next) return true;
  if (FINAL_APPROVAL_STATUSES.has(previous)) return false;
  if (previous === "pending") return ["approved", "rejected", "edited", "archived"].includes(next);
  if (previous === "edited") return ["approved", "rejected", "archived"].includes(next);
  return false;
}

function externalSummariesAreAllowed(providerPlan: unknown) {
  const plan = asRecord(providerPlan);
  return process.env.EXECUTIVE_MEETINGS_ALLOW_EXTERNAL_SUMMARIES === "1" && plan.externalSendsEnabled === true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function failure(error: string, status: number): ExecutiveActionResult {
  return { ok: false, error, status };
}

async function audit(input: {
  actorUserId: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await logPlatformAuditEvent({
    actorType: "human",
    actorId: input.actorUserId,
    module: "executive_meetings",
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    resultStatus: "success",
    approvalState: "needs_review",
    severity: "info",
    message: input.message,
    metadata: input.metadata ?? {},
  });
}
