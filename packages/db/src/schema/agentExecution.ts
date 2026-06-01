import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./users.js";

export const agentExecutionQueue = pgTable(
  "agent_execution_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id"),
    taskId: text("task_id").notNull(),
    miniAppId: text("mini_app_id").notNull(),
    sourceAgent: text("source_agent").notNull(),
    taskType: text("task_type").notNull(),
    targetSystem: text("target_system").notNull(),
    targetUrl: text("target_url"),
    permissionScope: text("permission_scope").notNull().default("read_only"),
    status: text("status").notNull().default("pending_approval"),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    approvedBy: uuid("approved_by").references(() => profiles.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executionStartedAt: timestamp("execution_started_at", { withTimezone: true }),
    executionCompletedAt: timestamp("execution_completed_at", { withTimezone: true }),
    screenshotBeforeUrl: text("screenshot_before_url"),
    screenshotAfterUrl: text("screenshot_after_url"),
    executionLog: jsonb("execution_log").$type<Record<string, unknown>[]>().notNull().default([]),
    executionLogJson: jsonb("execution_log_json").$type<Record<string, unknown>[]>().notNull().default([]),
    failureReason: text("failure_reason"),
    retryAllowed: boolean("retry_allowed").notNull().default(false),
    manualTakeoverRequired: boolean("manual_takeover_required").notNull().default(false),
    dryRunEnabled: boolean("dry_run_enabled").notNull().default(true),
    dryRunChecklist: jsonb("dry_run_checklist").$type<Record<string, unknown>[]>().notNull().default([]),
    sensitiveActionFlags: text("sensitive_action_flags").array().notNull().default([]),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdIdx: uniqueIndex("agent_execution_queue_task_id_idx").on(t.taskId),
    statusIdx: index("agent_execution_queue_status_idx").on(t.status, t.permissionScope, t.updatedAt),
    miniAppIdx: index("agent_execution_queue_mini_app_idx").on(t.miniAppId, t.status, t.updatedAt),
    targetSystemIdx: index("agent_execution_queue_target_system_idx").on(t.targetSystem, t.status, t.updatedAt),
  }),
);

export const agentBrowserSessionRegistry = pgTable(
  "agent_browser_session_registry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemName: text("system_name").notNull().unique(),
    loginUrl: text("login_url"),
    purpose: text("purpose").notNull().default(""),
    accountOwner: text("account_owner").notNull().default("HomeReach Admin"),
    allowedActions: text("allowed_actions").array().notNull().default([]),
    blockedActions: text("blocked_actions").array().notNull().default([]),
    allowedActionsJson: jsonb("allowed_actions_json").$type<unknown[]>().notNull().default([]),
    blockedActionsJson: jsonb("blocked_actions_json").$type<unknown[]>().notNull().default([]),
    requiresMfa: boolean("requires_mfa").notNull().default(true),
    notes: text("notes"),
    preferredBrowserProfile: text("preferred_browser_profile")
      .notNull()
      .default("Dedicated HomeReach Windows user + dedicated Chrome profile"),
    activeSessionStatus: text("active_session_status").notNull().default("not_configured"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("agent_browser_session_registry_status_idx").on(t.activeSessionStatus, t.updatedAt),
  }),
);

export const agentExecutionAuditLog = pgTable(
  "agent_execution_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionTaskId: uuid("execution_task_id").references(() => agentExecutionQueue.id, { onDelete: "set null" }),
    taskPublicId: text("task_public_id"),
    miniAppId: text("mini_app_id"),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull().default("HomeReach Admin"),
    eventType: text("event_type").notNull(),
    whatChanged: jsonb("what_changed").$type<Record<string, unknown>>().notNull().default({}),
    allowedScope: text("allowed_scope").notNull().default("read_only"),
    attemptedAction: text("attempted_action"),
    result: text("result").notNull().default("logged"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index("agent_execution_audit_task_idx").on(t.executionTaskId, t.createdAt),
    publicTaskIdx: index("agent_execution_audit_public_task_idx").on(t.taskPublicId, t.createdAt),
    eventIdx: index("agent_execution_audit_event_idx").on(t.eventType, t.createdAt),
  }),
);

export type AgentExecutionTask = typeof agentExecutionQueue.$inferSelect;
export type NewAgentExecutionTask = typeof agentExecutionQueue.$inferInsert;
export type AgentBrowserSessionRegistry = typeof agentBrowserSessionRegistry.$inferSelect;
export type NewAgentBrowserSessionRegistry = typeof agentBrowserSessionRegistry.$inferInsert;
export type AgentExecutionAuditLog = typeof agentExecutionAuditLog.$inferSelect;
export type NewAgentExecutionAuditLog = typeof agentExecutionAuditLog.$inferInsert;
