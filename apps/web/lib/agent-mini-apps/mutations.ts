import { createServiceClient } from "@/lib/supabase/service";
import { createExternalActionIntent } from "@/lib/agent-integrations/repository";
import { validateExternalActionIntent } from "@/lib/agent-integrations/rules";
import {
  canMutateMiniApp,
  mapMiniAppRow,
} from "./repository";
import {
  EXECUTION_PERMISSION_SCOPES,
  MINI_APP_EVENT_TYPES,
  MINI_APP_PRIORITIES,
  MINI_APP_RISK_LEVELS,
  MINI_APP_STATUSES,
  MINI_APP_TYPES,
  type AgentMiniApp,
  type ExecutionPermissionScope,
  type MiniAppAction,
  type MiniAppActionResult,
  type MiniAppEventType,
  type MiniAppPriority,
  type MiniAppRiskLevel,
  type MiniAppStatus,
  type MiniAppType,
} from "./types";
import type { AppRole } from "@/lib/auth/api-guards";
import {
  changedPayloadKeys,
  isFinalMiniAppStatus,
  redactUnsafeEventPayload,
  validateMiniAppTransition,
} from "./rules";

type Db = ReturnType<typeof createServiceClient>;
type JsonRecord = Record<string, unknown>;

export async function createMiniApp(input: {
  db: Db;
  actorUserId: string | null;
  body: JsonRecord;
}): Promise<MiniAppActionResult> {
  let row: JsonRecord;
  try {
    row = {
      tenant_id: stringValue(input.body.tenantId),
      mini_app_type: normalizeMiniAppType(input.body.miniAppType),
      title: requireString(input.body.title, "Mini app title is required."),
      description: stringValue(input.body.description) ?? "",
      source_agent: stringValue(input.body.sourceAgent) ?? "Orchestrator Agent",
      related_module: stringValue(input.body.relatedModule) ?? "ai_workforce",
      related_business_id: stringValue(input.body.relatedBusinessId),
      related_contact_id: stringValue(input.body.relatedContactId),
      related_campaign_id: stringValue(input.body.relatedCampaignId),
      related_client_id: stringValue(input.body.relatedClientId),
      status: normalizeStatus(input.body.status ?? "generated"),
      priority: normalizePriority(input.body.priority),
      confidence_score: boundedNumber(input.body.confidenceScore, 0, 100),
      risk_level: normalizeRisk(input.body.riskLevel),
      approval_required: input.body.approvalRequired !== false,
      estimated_revenue: money(input.body.estimatedRevenue),
      estimated_savings: money(input.body.estimatedSavings),
      estimated_cost: money(input.body.estimatedCost),
      recommended_action: stringValue(input.body.recommendedAction) ?? "",
      payload_json: asRecord(input.body.payloadJson),
      edited_payload_json: null,
      decision: null,
      decision_reason: null,
      assigned_user_id: stringValue(input.body.assignedUserId),
      due_at: stringValue(input.body.dueAt),
      created_by: input.actorUserId,
    };
  } catch (error) {
    return failure(errorMessage(error), 400);
  }

  const { data, error } = await input.db.from("agent_mini_apps").insert(row).select("*").single();
  if (error) return failure(errorMessage(error), 500);
  const app = mapMiniAppRow(data as JsonRecord);
  await createMiniAppEvent(input.db, {
    miniAppId: app.id,
    eventType: "created",
    previousStatus: null,
    newStatus: app.status,
    actorUserId: input.actorUserId,
    actorType: "user",
    summary: `Mini app "${app.title}" created.`,
    payload: { source: "api", miniAppType: app.miniAppType },
  });
  return { ok: true, id: app.id, status: app.status };
}

export async function updateMiniApp(input: {
  db: Db;
  actorUserId: string | null;
  role: AppRole | null;
  miniAppId: string;
  body: JsonRecord;
}): Promise<MiniAppActionResult> {
  const current = await fetchMiniApp(input.db, input.miniAppId);
  if (!current) return failure("Mini app not found.", 404);
  if (!canMutateMiniApp(current, { userId: input.actorUserId, role: input.role }, "edit_payload")) {
    return failure("Forbidden.", 403);
  }
  if (isFinalMiniAppStatus(current.status)) {
    return failure("Final mini apps cannot be edited. Clone or create a new version instead.", 409);
  }

  const patch: JsonRecord = { updated_at: new Date().toISOString() };
  setIfPresent(patch, "title", stringValue(input.body.title));
  setIfPresent(patch, "description", stringValue(input.body.description));
  setIfPresent(patch, "source_agent", stringValue(input.body.sourceAgent));
  setIfPresent(patch, "related_module", stringValue(input.body.relatedModule));
  setIfPresent(patch, "priority", input.body.priority ? normalizePriority(input.body.priority) : null);
  setIfPresent(patch, "risk_level", input.body.riskLevel ? normalizeRisk(input.body.riskLevel) : null);
  setIfPresent(patch, "confidence_score", input.body.confidenceScore === undefined ? null : boundedNumber(input.body.confidenceScore, 0, 100));
  setIfPresent(patch, "estimated_revenue", input.body.estimatedRevenue === undefined ? null : money(input.body.estimatedRevenue));
  setIfPresent(patch, "estimated_savings", input.body.estimatedSavings === undefined ? null : money(input.body.estimatedSavings));
  setIfPresent(patch, "estimated_cost", input.body.estimatedCost === undefined ? null : money(input.body.estimatedCost));
  setIfPresent(patch, "recommended_action", stringValue(input.body.recommendedAction));
  setIfPresent(patch, "assigned_user_id", stringValue(input.body.assignedUserId));
  setIfPresent(patch, "due_at", stringValue(input.body.dueAt));

  const { data, error } = await input.db
    .from("agent_mini_apps")
    .update(patch)
    .eq("id", input.miniAppId)
    .select("*")
    .single();
  if (error) return failure(errorMessage(error), 500);

  const updated = mapMiniAppRow(data as JsonRecord);
  await createMiniAppEvent(input.db, {
    miniAppId: updated.id,
    eventType: "edited",
    previousStatus: current.status,
    newStatus: updated.status,
    actorUserId: input.actorUserId,
    actorType: "user",
    summary: `Mini app "${updated.title}" metadata updated.`,
    payload: { changedFields: Object.keys(patch).filter((key) => key !== "updated_at") },
  });
  return { ok: true, id: updated.id, status: updated.status };
}

export async function runMiniAppAction(input: {
  db: Db;
  actorUserId: string | null;
  role: AppRole | null;
  miniAppId: string;
  action: MiniAppAction;
  body: JsonRecord;
}): Promise<MiniAppActionResult> {
  const current = await fetchMiniApp(input.db, input.miniAppId);
  if (!current) return failure("Mini app not found.", 404);
  if (!canMutateMiniApp(current, { userId: input.actorUserId, role: input.role }, input.action)) {
    return failure("Forbidden.", 403);
  }

  if (isFinalMiniAppStatus(current.status) && !["manual_takeover_requested"].includes(input.action)) {
    return failure("Final mini apps cannot be edited without a new version or clone.", 409);
  }

  try {
    switch (input.action) {
      case "mark_needs_review":
        return updateStatus(input.db, current, "needs_review", "viewed", input.actorUserId, "Mini app moved into review.", input.body);
      case "approve":
        return updateStatus(input.db, current, "approved", "approved", input.actorUserId, stringValue(input.body.reason) ?? "Mini app approved for the next internal workflow step.", input.body);
      case "reject":
        return updateStatus(input.db, current, "rejected", "rejected", input.actorUserId, stringValue(input.body.reason) ?? "Mini app rejected.", input.body);
      case "archive":
        return archiveMiniApp(input.db, current, input.actorUserId, input.body);
      case "schedule":
        return scheduleMiniApp(input.db, current, input.actorUserId, input.body);
      case "assign":
        return assignMiniApp(input.db, current, input.actorUserId, input.body);
      case "mark_executed":
        return updateStatus(input.db, current, "executed", "executed", input.actorUserId, stringValue(input.body.reason) ?? "Mini app marked complete after approved/manual execution.", input.body);
      case "mark_failed":
        return updateStatus(input.db, current, "failed", "failed", input.actorUserId, stringValue(input.body.reason) ?? "Mini app marked failed.", input.body);
      case "edit_payload":
        return editPayload(input.db, current, input.actorUserId, input.body);
      case "send_to_execution_queue":
        return sendToExecutionQueue(input.db, current, input.actorUserId, input.body);
      case "manual_takeover_requested":
        await createMiniAppEvent(input.db, {
          miniAppId: current.id,
          eventType: "manual_takeover_requested",
          previousStatus: current.status,
          newStatus: current.status,
          actorUserId: input.actorUserId,
          actorType: "user",
          summary: stringValue(input.body.reason) ?? "Manual takeover requested.",
          payload: redactUnsafeEventPayload(input.body),
        });
        return { ok: true, id: current.id, status: current.status };
      default:
        return failure("Unknown mini app action.", 400);
    }
  } catch (error) {
    return failure(errorMessage(error), 500);
  }
}

export async function createManualMiniAppEvent(input: {
  db: Db;
  actorUserId: string | null;
  role: AppRole | null;
  miniAppId: string;
  body: JsonRecord;
}): Promise<MiniAppActionResult> {
  const current = await fetchMiniApp(input.db, input.miniAppId);
  if (!current) return failure("Mini app not found.", 404);
  if (!canMutateMiniApp(current, { userId: input.actorUserId, role: input.role }, "manual_takeover_requested")) {
    return failure("Forbidden.", 403);
  }

  const eventType = normalizeEventType(input.body.eventType);
  await createMiniAppEvent(input.db, {
    miniAppId: current.id,
    eventType,
    previousStatus: current.status,
    newStatus: current.status,
    actorUserId: input.actorUserId,
    actorType: "user",
    summary: stringValue(input.body.eventSummary) ?? `${eventType.replace(/_/g, " ")} logged.`,
    payload: redactUnsafeEventPayload(input.body.eventPayloadJson),
  });
  return { ok: true, id: current.id, status: current.status };
}

export async function fetchMiniApp(db: Db, id: string): Promise<AgentMiniApp | null> {
  const { data, error } = await db.from("agent_mini_apps").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapMiniAppRow(data as JsonRecord);
}

async function updateStatus(
  db: Db,
  current: AgentMiniApp,
  nextStatus: MiniAppStatus,
  eventType: MiniAppEventType,
  actorUserId: string | null,
  summary: string,
  body: JsonRecord,
): Promise<MiniAppActionResult> {
  const transitionError = validateMiniAppTransition(current.status, nextStatus);
  if (transitionError) return failure(transitionError, 409);

  const now = new Date().toISOString();
  const patch: JsonRecord = {
    status: nextStatus,
    decision: nextStatus === "approved" || nextStatus === "rejected" ? nextStatus : current.decision,
    decision_reason: stringValue(body.reason) ?? current.decisionReason,
    updated_at: now,
  };
  if (nextStatus === "archived") patch.archived_at = now;

  const { data, error } = await db.from("agent_mini_apps").update(patch).eq("id", current.id).select("*").single();
  if (error) return failure(errorMessage(error), 500);
  const updated = mapMiniAppRow(data as JsonRecord);
  await createMiniAppEvent(db, {
    miniAppId: updated.id,
    eventType,
    previousStatus: current.status,
    newStatus: updated.status,
    actorUserId,
    actorType: "user",
    summary,
    payload: redactUnsafeEventPayload(body),
  });
  return { ok: true, id: updated.id, status: updated.status };
}

async function archiveMiniApp(
  db: Db,
  current: AgentMiniApp,
  actorUserId: string | null,
  body: JsonRecord,
): Promise<MiniAppActionResult> {
  if (isFinalMiniAppStatus(current.status)) return failure("Final mini apps are already closed.", 409);
  return updateStatus(
    db,
    current,
    "archived",
    "archived",
    actorUserId,
    stringValue(body.reason) ?? "Mini app archived.",
    body,
  );
}

async function scheduleMiniApp(
  db: Db,
  current: AgentMiniApp,
  actorUserId: string | null,
  body: JsonRecord,
): Promise<MiniAppActionResult> {
  const scheduledFor = stringValue(body.dueAt) ?? stringValue(body.scheduledFor);
  if (!scheduledFor) return failure("A dueAt or scheduledFor timestamp is required.", 400);
  const transitionError = validateMiniAppTransition(current.status, "scheduled");
  if (transitionError) return failure(transitionError, 409);

  const { data, error } = await db
    .from("agent_mini_apps")
    .update({
      status: "scheduled",
      due_at: scheduledFor,
      decision: "scheduled",
      decision_reason: stringValue(body.reason) ?? "Mini app scheduled after approval.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) return failure(errorMessage(error), 500);
  const updated = mapMiniAppRow(data as JsonRecord);
  await createMiniAppEvent(db, {
    miniAppId: updated.id,
    eventType: "scheduled",
    previousStatus: current.status,
    newStatus: updated.status,
    actorUserId,
    actorType: "user",
    summary: `Mini app scheduled for ${scheduledFor}.`,
    payload: { scheduledFor, reason: stringValue(body.reason) },
  });
  return { ok: true, id: updated.id, status: updated.status };
}

async function assignMiniApp(
  db: Db,
  current: AgentMiniApp,
  actorUserId: string | null,
  body: JsonRecord,
): Promise<MiniAppActionResult> {
  const assignedUserId = requireString(body.assignedUserId, "assignedUserId is required.");
  const { data, error } = await db
    .from("agent_mini_apps")
    .update({ assigned_user_id: assignedUserId, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) return failure(errorMessage(error), 500);
  const updated = mapMiniAppRow(data as JsonRecord);
  await createMiniAppEvent(db, {
    miniAppId: updated.id,
    eventType: "assigned",
    previousStatus: current.status,
    newStatus: updated.status,
    actorUserId,
    actorType: "user",
    summary: "Mini app assignment changed.",
    payload: { previousAssignedUserId: current.assignedUserId, assignedUserId },
  });
  return { ok: true, id: updated.id, status: updated.status };
}

async function editPayload(
  db: Db,
  current: AgentMiniApp,
  actorUserId: string | null,
  body: JsonRecord,
): Promise<MiniAppActionResult> {
  const editedPayload = asRecord(body.editedPayloadJson ?? body.payloadJson);
  if (Object.keys(editedPayload).length === 0) return failure("editedPayloadJson is required.", 400);
  const nextStatus = current.status === "edited" ? "edited" : "edited";
  const transitionError = current.status === "edited" ? null : validateMiniAppTransition(current.status, nextStatus);
  if (transitionError) return failure(transitionError, 409);

  const { data, error } = await db
    .from("agent_mini_apps")
    .update({ status: nextStatus, edited_payload_json: editedPayload, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) return failure(errorMessage(error), 500);
  const updated = mapMiniAppRow(data as JsonRecord);
  await createMiniAppEvent(db, {
    miniAppId: updated.id,
    eventType: "edited",
    previousStatus: current.status,
    newStatus: updated.status,
    actorUserId,
    actorType: "user",
    summary: "Edited payload saved. Original payload remains preserved.",
    payload: {
      changedKeys: changedPayloadKeys(current.editedPayloadJson ?? current.payloadJson, editedPayload),
      preservesOriginalPayload: true,
    },
  });
  return { ok: true, id: updated.id, status: updated.status };
}

async function sendToExecutionQueue(
  db: Db,
  current: AgentMiniApp,
  actorUserId: string | null,
  body: JsonRecord,
): Promise<MiniAppActionResult> {
  const transitionError = validateMiniAppTransition(current.status, "sent_to_execution_queue");
  if (transitionError) return failure(transitionError, 409);

  const permissionScope = normalizePermissionScope(body.permissionScope);
  const targetSystem = stringValue(body.targetSystem) ?? defaultTargetSystem(current);
  const targetUrl = stringValue(body.targetUrl) ?? defaultTargetUrl(current);
  const taskType = stringValue(body.taskType) ?? `${current.miniAppType}_execution_review`;
  const approvedPayloadJson = current.editedPayloadJson ?? current.payloadJson;
  const approvalEventId = await fetchLatestMiniAppEventId(db, current.id, "approved");
  const intentPreflight = validateExternalActionIntent({
    intentType: taskType,
    targetSystem,
    permissionScope,
    approvalEventId,
    payload: approvedPayloadJson,
  });
  if (!intentPreflight.ok) return failure(intentPreflight.error, 409);

  const now = new Date().toISOString();
  const taskId = `AMQ-${current.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
  const executionLog = [
    {
      at: now,
      actor: "HomeReach Admin",
      event: "sent_to_execution_queue",
      note: "Queued from Agent Mini Apps. This does not execute browser/computer-use automation.",
    },
  ];

  const { data: queueRow, error: queueError } = await db
    .from("agent_execution_queue")
    .insert({
      mini_app_id: current.id,
      task_id: taskId,
      source_agent: current.sourceAgent,
      task_type: taskType,
      target_system: targetSystem,
      target_url: targetUrl,
      permission_scope: permissionScope,
      status: "queued",
      human_approval_required: true,
      approved_by: null,
      approved_at: null,
      execution_log: executionLog,
      execution_log_json: executionLog,
      retry_allowed: false,
      manual_takeover_required: false,
      created_by: actorUserId,
    })
    .select("id,task_id")
    .single();
  if (queueError) return failure(errorMessage(queueError), 500);

  const statusResult = await updateStatus(
    db,
    current,
    "sent_to_execution_queue",
    "sent_to_execution_queue",
    actorUserId,
    `Mini app sent to execution queue as ${taskId}.`,
    { ...body, targetSystem, targetUrl, permissionScope, taskId },
  );
  if (!statusResult.ok) return statusResult;

  const externalIntentResult = await createExternalActionIntent({
    db,
    miniAppId: current.id,
    executionQueueId: String(queueRow.id),
    tenantId: current.tenantId,
    intentType: taskType,
    targetSystem,
    targetIdentifier: targetUrl,
    permissionScope,
    approvedPayloadJson,
    approvalEventId,
    createdBy: actorUserId,
  });

  const { error: auditError } = await db.from("agent_execution_audit_log").insert({
    execution_task_id: queueRow.id,
    task_public_id: queueRow.task_id,
    mini_app_id: current.id,
    actor_user_id: actorUserId,
    actor_label: "HomeReach Admin",
    event_type: "sent_to_execution_queue",
    what_changed: {
      miniAppId: current.id,
      targetSystem,
      targetUrl,
      permissionScope,
      humanApprovalRequired: true,
      storesSecrets: false,
      externalActionIntentId: externalIntentResult.ok ? externalIntentResult.id : null,
      externalActionIntentWarning: externalIntentResult.ok ? null : externalIntentResult.error,
    },
    allowed_scope: permissionScope,
    attempted_action: "queue future browser/computer-use task",
    result: "queued",
    notes: "Queue write only. No external system was opened, sent, submitted, purchased, changed, or charged.",
  });
  if (auditError) return failure(errorMessage(auditError), 500);

  return { ok: true, id: current.id, taskId: String(queueRow.task_id), status: "sent_to_execution_queue" };
}

async function fetchLatestMiniAppEventId(db: Db, miniAppId: string, eventType: MiniAppEventType) {
  const { data, error } = await db
    .from("agent_mini_app_events")
    .select("id")
    .eq("mini_app_id", miniAppId)
    .eq("event_type", eventType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function createMiniAppEvent(
  db: Db,
  input: {
    miniAppId: string;
    eventType: MiniAppEventType;
    previousStatus: MiniAppStatus | null;
    newStatus: MiniAppStatus | null;
    actorUserId: string | null;
    actorType: "user" | "agent" | "system";
    summary: string;
    payload?: JsonRecord;
  },
) {
  const { error } = await db.from("agent_mini_app_events").insert({
    mini_app_id: input.miniAppId,
    event_type: input.eventType,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    actor_user_id: input.actorUserId,
    actor_type: input.actorType,
    event_summary: input.summary,
    event_payload_json: input.payload ?? {},
  });
  if (error) throw new Error(errorMessage(error));
}

function defaultTargetSystem(app: AgentMiniApp) {
  if (app.miniAppType === "samgov_bid") return "SAM.gov";
  if (app.miniAppType === "procurement_savings") return "supplier websites";
  if (app.miniAppType === "outreach_approval") {
    const channel = String((app.editedPayloadJson ?? app.payloadJson).channel ?? "").toLowerCase();
    if (channel === "email") return "Gmail";
    if (channel.includes("dm")) return "Facebook";
    if (channel === "sms") return "Twilio";
  }
  return "HomeReach Admin";
}

function defaultTargetUrl(app: AgentMiniApp) {
  const routeMap: Record<MiniAppType, string> = {
    outreach_approval: "/admin/outreach-command",
    political_plan: "/admin/political",
    route_density: "/admin/targeted-campaigns",
    procurement_savings: "/admin/procurement",
    samgov_bid: "/admin/gov-contracts",
    website_build: "/admin/websites",
    generic_task: "/admin/agents",
  };
  return routeMap[app.miniAppType];
}

function normalizeMiniAppType(value: unknown): MiniAppType {
  const text = String(value ?? "generic_task");
  return MINI_APP_TYPES.includes(text as MiniAppType) ? (text as MiniAppType) : "generic_task";
}

function normalizeStatus(value: unknown): MiniAppStatus {
  const text = String(value ?? "generated");
  if (!MINI_APP_STATUSES.includes(text as MiniAppStatus)) throw new Error(`Invalid mini app status: ${text}`);
  return text as MiniAppStatus;
}

function normalizePriority(value: unknown): MiniAppPriority {
  const text = String(value ?? "normal");
  return MINI_APP_PRIORITIES.includes(text as MiniAppPriority) ? (text as MiniAppPriority) : "normal";
}

function normalizeRisk(value: unknown): MiniAppRiskLevel {
  const text = String(value ?? "medium");
  return MINI_APP_RISK_LEVELS.includes(text as MiniAppRiskLevel) ? (text as MiniAppRiskLevel) : "medium";
}

function normalizeEventType(value: unknown): MiniAppEventType {
  const text = String(value ?? "manual_takeover_requested");
  return MINI_APP_EVENT_TYPES.includes(text as MiniAppEventType) ? (text as MiniAppEventType) : "manual_takeover_requested";
}

function normalizePermissionScope(value: unknown): ExecutionPermissionScope {
  const text = String(value ?? "read_only");
  return EXECUTION_PERMISSION_SCOPES.includes(text as ExecutionPermissionScope) ? (text as ExecutionPermissionScope) : "read_only";
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requireString(value: unknown, message: string): string {
  const text = stringValue(value);
  if (!text) throw new Error(message);
  return text;
}

function setIfPresent(target: JsonRecord, key: string, value: unknown) {
  if (value !== null && value !== undefined) target[key] = value;
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedNumber(value: unknown, min: number, max: number) {
  const parsed = money(value);
  return Math.min(max, Math.max(min, parsed));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function failure(error: string, status: number): MiniAppActionResult {
  return { ok: false, error, status };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as JsonRecord;
    return [record.message, record.details, record.hint, record.code ? `code ${String(record.code)}` : null]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ");
  }
  return "Agent Mini App mutation failed.";
}
