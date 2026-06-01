import { createServiceClient } from "@/lib/supabase/service";
import {
  AGENT_PERMISSION_SCOPES,
  detectSensitiveActionFlags,
  normalizeAgentPermissionScope,
  validateExternalActionIntent,
  type AgentPermissionScope,
} from "./rules";

type Db = ReturnType<typeof createServiceClient>;
type JsonRecord = Record<string, unknown>;

const MIGRATION_HINT =
  "Apply supabase/migrations/20260601170624_agent_connector_policy_layer.sql to persist integration connections, tool permissions, external action intents, and execution attempts.";

export type IntegrationConnection = {
  id: string;
  tenantId: string | null;
  systemName: string;
  provider: string;
  connectionType: string;
  status: string;
  accountLabel: string | null;
  externalAccountId: string | null;
  allowedScopesJson: unknown[];
  blockedScopesJson: unknown[];
  credentialReference: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type AgentToolPermission = {
  id: string;
  tenantId: string | null;
  agentKey: string;
  toolKey: string;
  targetSystem: string;
  permissionScope: AgentPermissionScope;
  requiresHumanApproval: boolean;
  maxEstimatedCost: number;
  allowedActionsJson: unknown[];
  blockedActionsJson: unknown[];
  riskLevel: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalActionIntent = {
  id: string;
  miniAppId: string | null;
  executionQueueId: string | null;
  tenantId: string | null;
  intentType: string;
  targetSystem: string;
  targetIdentifier: string | null;
  permissionScope: AgentPermissionScope;
  approvalEventId: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionAttempt = {
  id: string;
  executionQueueId: string;
  attemptNumber: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  actorType: string;
  toolKey: string | null;
  idempotencyKey: string | null;
  requestSummary: string | null;
  responseSummary: string | null;
  screenshotBeforeUrl: string | null;
  screenshotAfterUrl: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type AgentIntegrationPolicyData = {
  schemaReady: boolean;
  migrationHint: string | null;
  warnings: string[];
  summary: {
    connections: number;
    activeConnections: number;
    toolPermissions: number;
    highRiskPermissions: number;
    openIntents: number;
    runningAttempts: number;
  };
  permissionScopes: AgentPermissionScope[];
  connections: IntegrationConnection[];
  toolPermissions: AgentToolPermission[];
  intents: ExternalActionIntent[];
  attempts: AgentExecutionAttempt[];
};

export async function loadAgentIntegrationPolicyData(): Promise<AgentIntegrationPolicyData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallbackData(["Supabase service credentials are unavailable."]);
  }

  const db = createServiceClient();
  const [connectionsResult, permissionsResult, intentsResult, attemptsResult] = await Promise.all([
    safeList(db, "integration_connections", "updated_at"),
    safeList(db, "agent_tool_permissions", "updated_at"),
    safeList(db, "external_action_intents", "updated_at"),
    safeList(db, "agent_execution_attempts", "created_at"),
  ]);

  const warnings = [connectionsResult, permissionsResult, intentsResult, attemptsResult]
    .flatMap((result) => (result.error ? [result.error.message] : []))
    .filter(Boolean);

  if (warnings.length > 0) return fallbackData(warnings);

  const connections = (connectionsResult.data ?? []).map(mapConnection);
  const toolPermissions = (permissionsResult.data ?? []).map(mapToolPermission);
  const intents = (intentsResult.data ?? []).map(mapIntent);
  const attempts = (attemptsResult.data ?? []).map(mapAttempt);

  return {
    schemaReady: true,
    migrationHint: null,
    warnings: [],
    summary: buildSummary(connections, toolPermissions, intents, attempts),
    permissionScopes: [...AGENT_PERMISSION_SCOPES],
    connections,
    toolPermissions,
    intents,
    attempts,
  };
}

export async function createExternalActionIntent(input: {
  db: Db;
  miniAppId: string | null;
  executionQueueId: string | null;
  tenantId?: string | null;
  intentType: string;
  targetSystem: string;
  targetIdentifier?: string | null;
  permissionScope: unknown;
  approvedPayloadJson: JsonRecord;
  approvalEventId?: string | null;
  createdBy?: string | null;
}) {
  const validation = validateExternalActionIntent({
    intentType: input.intentType,
    targetSystem: input.targetSystem,
    permissionScope: input.permissionScope,
    approvalEventId: input.approvalEventId,
    payload: input.approvedPayloadJson,
  });
  if (!validation.ok) {
    return { ok: false as const, error: validation.error, status: 409 };
  }

  const { value } = validation;
  const { data, error } = await input.db
    .from("external_action_intents")
    .insert({
      mini_app_id: input.miniAppId,
      execution_queue_id: input.executionQueueId,
      tenant_id: input.tenantId ?? null,
      intent_type: value.intentType,
      target_system: value.targetSystem,
      target_identifier: input.targetIdentifier ?? null,
      permission_scope: value.permissionScope,
      approved_payload_json: value.payload,
      approval_event_id: value.approvalEventId,
      status: "queued",
      provider_result_json: {
        createdFrom: "agent_mini_apps",
        externalExecutionStarted: false,
        sensitiveFlags: value.sensitiveFlags,
      },
      created_by: input.createdBy ?? null,
    })
    .select("id,status")
    .single();

  if (error) {
    return {
      ok: false as const,
      error: errorMessage(error),
      status: isMissingSchemaError(error) ? 503 : 500,
    };
  }

  return { ok: true as const, id: String(data.id), status: String(data.status) };
}

export async function recordAgentExecutionAttempt(input: {
  db: Db;
  executionQueueId: string;
  attemptNumber: number;
  status?: string;
  actorType?: string;
  toolKey?: string | null;
  idempotencyKey?: string | null;
  requestSummary?: string | null;
  logJson?: JsonRecord[];
}) {
  const { data, error } = await input.db
    .from("agent_execution_attempts")
    .insert({
      execution_queue_id: input.executionQueueId,
      attempt_number: Math.max(1, input.attemptNumber),
      status: input.status ?? "queued",
      actor_type: input.actorType ?? "worker",
      tool_key: input.toolKey ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      request_summary: input.requestSummary ?? null,
      log_json: input.logJson ?? [],
    })
    .select("id,status")
    .single();

  if (error) {
    return {
      ok: false as const,
      error: errorMessage(error),
      status: isMissingSchemaError(error) ? 503 : 500,
    };
  }

  return { ok: true as const, id: String(data.id), status: String(data.status) };
}

export function intentSensitiveFlags(input: {
  intentType: string;
  targetSystem: string;
  targetIdentifier?: string | null;
  permissionScope: unknown;
}) {
  return detectSensitiveActionFlags({
    intentType: input.intentType,
    targetSystem: input.targetSystem,
    targetIdentifier: input.targetIdentifier,
    permissionScope: normalizeAgentPermissionScope(input.permissionScope),
  });
}

function fallbackData(warnings: string[]): AgentIntegrationPolicyData {
  return {
    schemaReady: false,
    migrationHint: MIGRATION_HINT,
    warnings,
    summary: {
      connections: 0,
      activeConnections: 0,
      toolPermissions: 0,
      highRiskPermissions: 0,
      openIntents: 0,
      runningAttempts: 0,
    },
    permissionScopes: [...AGENT_PERMISSION_SCOPES],
    connections: [],
    toolPermissions: [],
    intents: [],
    attempts: [],
  };
}

async function safeList(
  db: Db,
  table: string,
  orderColumn: string,
): Promise<{ data: JsonRecord[] | null; error: { message: string } | null }> {
  const { data, error } = await db.from(table).select("*").order(orderColumn, { ascending: false }).limit(250);
  return {
    data: (data ?? null) as JsonRecord[] | null,
    error: error ? { message: errorMessage(error) } : null,
  };
}

function buildSummary(
  connections: IntegrationConnection[],
  toolPermissions: AgentToolPermission[],
  intents: ExternalActionIntent[],
  attempts: AgentExecutionAttempt[],
) {
  return {
    connections: connections.length,
    activeConnections: connections.filter((connection) => connection.status === "active").length,
    toolPermissions: toolPermissions.length,
    highRiskPermissions: toolPermissions.filter((permission) => permission.riskLevel === "high" || permission.riskLevel === "critical").length,
    openIntents: intents.filter((intent) => !["completed", "failed", "cancelled", "archived"].includes(intent.status)).length,
    runningAttempts: attempts.filter((attempt) => attempt.status === "running").length,
  };
}

function mapConnection(row: JsonRecord): IntegrationConnection {
  return {
    id: String(row.id),
    tenantId: nullableString(row.tenant_id),
    systemName: String(row.system_name ?? ""),
    provider: String(row.provider ?? ""),
    connectionType: String(row.connection_type ?? "manual_browser"),
    status: String(row.status ?? "not_configured"),
    accountLabel: nullableString(row.account_label),
    externalAccountId: nullableString(row.external_account_id),
    allowedScopesJson: asArray(row.allowed_scopes_json),
    blockedScopesJson: asArray(row.blocked_scopes_json),
    credentialReference: nullableString(row.credential_reference),
    lastVerifiedAt: nullableString(row.last_verified_at),
    lastError: nullableString(row.last_error),
    createdBy: nullableString(row.created_by),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    archivedAt: nullableString(row.archived_at),
  };
}

function mapToolPermission(row: JsonRecord): AgentToolPermission {
  return {
    id: String(row.id),
    tenantId: nullableString(row.tenant_id),
    agentKey: String(row.agent_key ?? ""),
    toolKey: String(row.tool_key ?? ""),
    targetSystem: String(row.target_system ?? ""),
    permissionScope: normalizeAgentPermissionScope(row.permission_scope),
    requiresHumanApproval: Boolean(row.requires_human_approval ?? true),
    maxEstimatedCost: Number(row.max_estimated_cost ?? 0),
    allowedActionsJson: asArray(row.allowed_actions_json),
    blockedActionsJson: asArray(row.blocked_actions_json),
    riskLevel: String(row.risk_level ?? "medium"),
    active: Boolean(row.active ?? true),
    createdBy: nullableString(row.created_by),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapIntent(row: JsonRecord): ExternalActionIntent {
  return {
    id: String(row.id),
    miniAppId: nullableString(row.mini_app_id),
    executionQueueId: nullableString(row.execution_queue_id),
    tenantId: nullableString(row.tenant_id),
    intentType: String(row.intent_type ?? ""),
    targetSystem: String(row.target_system ?? ""),
    targetIdentifier: nullableString(row.target_identifier),
    permissionScope: normalizeAgentPermissionScope(row.permission_scope),
    approvalEventId: nullableString(row.approval_event_id),
    status: String(row.status ?? "approved"),
    createdBy: nullableString(row.created_by),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function mapAttempt(row: JsonRecord): AgentExecutionAttempt {
  return {
    id: String(row.id),
    executionQueueId: String(row.execution_queue_id ?? ""),
    attemptNumber: Number(row.attempt_number ?? 1),
    status: String(row.status ?? "queued"),
    startedAt: nullableString(row.started_at),
    completedAt: nullableString(row.completed_at),
    actorType: String(row.actor_type ?? "worker"),
    toolKey: nullableString(row.tool_key),
    idempotencyKey: nullableString(row.idempotency_key),
    requestSummary: nullableString(row.request_summary),
    responseSummary: nullableString(row.response_summary),
    screenshotBeforeUrl: nullableString(row.screenshot_before_url),
    screenshotAfterUrl: nullableString(row.screenshot_after_url),
    failureReason: nullableString(row.failure_reason),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isMissingSchemaError(error: unknown) {
  return /does not exist|Could not find|relation|schema cache/i.test(errorMessage(error));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as JsonRecord;
    return [record.message, record.details, record.hint, record.code ? `code ${String(record.code)}` : null]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ");
  }
  return "Agent integration policy request failed.";
}
