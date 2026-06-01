import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agentExecutionQueue } from "./agentExecution.js";
import { agentMiniAppEvents, agentMiniApps } from "./agentMiniApps.js";
import { profiles } from "./users.js";

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id"),
    systemName: text("system_name").notNull(),
    provider: text("provider").notNull(),
    connectionType: text("connection_type").notNull().default("manual_browser"),
    status: text("status").notNull().default("not_configured"),
    accountLabel: text("account_label"),
    externalAccountId: text("external_account_id"),
    allowedScopesJson: jsonb("allowed_scopes_json").$type<unknown[]>().notNull().default([]),
    blockedScopesJson: jsonb("blocked_scopes_json").$type<unknown[]>().notNull().default([]),
    credentialReference: text("credential_reference"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("integration_connections_status_idx").on(t.status, t.systemName, t.updatedAt),
    tenantIdx: index("integration_connections_tenant_idx").on(t.tenantId, t.status, t.updatedAt),
  }),
);

export const agentToolPermissions = pgTable(
  "agent_tool_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id"),
    agentKey: text("agent_key").notNull(),
    toolKey: text("tool_key").notNull(),
    targetSystem: text("target_system").notNull(),
    permissionScope: text("permission_scope").notNull().default("read_only"),
    requiresHumanApproval: boolean("requires_human_approval").notNull().default(true),
    maxEstimatedCost: numeric("max_estimated_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    allowedActionsJson: jsonb("allowed_actions_json").$type<unknown[]>().notNull().default([]),
    blockedActionsJson: jsonb("blocked_actions_json").$type<unknown[]>().notNull().default([]),
    riskLevel: text("risk_level").notNull().default("medium"),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("agent_tool_permissions_active_idx").on(t.active, t.permissionScope, t.riskLevel, t.updatedAt),
    targetIdx: index("agent_tool_permissions_target_idx").on(t.targetSystem, t.permissionScope, t.active),
  }),
);

export const externalActionIntents = pgTable(
  "external_action_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    miniAppId: uuid("mini_app_id").references(() => agentMiniApps.id, { onDelete: "set null" }),
    executionQueueId: uuid("execution_queue_id").references(() => agentExecutionQueue.id, { onDelete: "set null" }),
    tenantId: uuid("tenant_id"),
    intentType: text("intent_type").notNull(),
    targetSystem: text("target_system").notNull(),
    targetIdentifier: text("target_identifier"),
    permissionScope: text("permission_scope").notNull().default("read_only"),
    approvedPayloadJson: jsonb("approved_payload_json").$type<Record<string, unknown>>().notNull().default({}),
    approvalEventId: uuid("approval_event_id").references(() => agentMiniAppEvents.id, { onDelete: "set null" }),
    status: text("status").notNull().default("approved"),
    providerResultJson: jsonb("provider_result_json").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    miniAppIdx: index("external_action_intents_mini_app_idx").on(t.miniAppId, t.status, t.createdAt),
    queueIdx: index("external_action_intents_queue_idx").on(t.executionQueueId, t.status, t.createdAt),
    targetIdx: index("external_action_intents_target_idx").on(t.targetSystem, t.permissionScope, t.status, t.updatedAt),
  }),
);

export const agentExecutionAttempts = pgTable(
  "agent_execution_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionQueueId: uuid("execution_queue_id").notNull().references(() => agentExecutionQueue.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: text("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    actorType: text("actor_type").notNull().default("worker"),
    toolKey: text("tool_key"),
    idempotencyKey: text("idempotency_key"),
    requestSummary: text("request_summary"),
    responseSummary: text("response_summary"),
    screenshotBeforeUrl: text("screenshot_before_url"),
    screenshotAfterUrl: text("screenshot_after_url"),
    logJson: jsonb("log_json").$type<Record<string, unknown>[]>().notNull().default([]),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    attemptNumberIdx: uniqueIndex("agent_execution_attempts_attempt_number_idx").on(t.executionQueueId, t.attemptNumber),
    statusIdx: index("agent_execution_attempts_status_idx").on(t.status, t.createdAt),
  }),
);

export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type NewIntegrationConnection = typeof integrationConnections.$inferInsert;
export type AgentToolPermission = typeof agentToolPermissions.$inferSelect;
export type NewAgentToolPermission = typeof agentToolPermissions.$inferInsert;
export type ExternalActionIntent = typeof externalActionIntents.$inferSelect;
export type NewExternalActionIntent = typeof externalActionIntents.$inferInsert;
export type AgentExecutionAttempt = typeof agentExecutionAttempts.$inferSelect;
export type NewAgentExecutionAttempt = typeof agentExecutionAttempts.$inferInsert;
