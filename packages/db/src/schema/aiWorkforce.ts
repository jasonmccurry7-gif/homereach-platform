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
import { relations } from "drizzle-orm";
import { aiOutputs } from "./aiAssets.js";
import { profiles } from "./users.js";

export const aiWorkforceTasks = pgTable(
  "ai_workforce_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: text("task_id").notNull(),
    workflowName: text("workflow_name").notNull(),
    requestor: text("requestor").notNull().default("HomeReach Admin"),
    assignedAgent: text("assigned_agent").notNull(),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("new"),
    inputPath: text("input_path"),
    inputData: jsonb("input_data").$type<Record<string, unknown>>().notNull().default({}),
    expectedOutput: text("expected_output").notNull().default(""),
    dependencies: text("dependencies").array().notNull().default([]),
    dueDate: timestamp("due_date", { withTimezone: true }),
    approvalRequired: boolean("approval_required").notNull().default(true),
    completionNotes: text("completion_notes"),
    errorNotes: text("error_notes"),
    relatedCampaign: text("related_campaign"),
    relatedClient: text("related_client"),
    relatedOpportunity: text("related_opportunity"),
    outputId: uuid("output_id").references(() => aiOutputs.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdIdx: uniqueIndex("ai_workforce_tasks_task_id_idx").on(t.taskId),
    statusIdx: index("ai_workforce_tasks_status_idx").on(t.status, t.priority, t.updatedAt),
    agentIdx: index("ai_workforce_tasks_agent_idx").on(t.assignedAgent, t.status, t.updatedAt),
    workflowIdx: index("ai_workforce_tasks_workflow_idx").on(t.workflowName, t.status),
  }),
);

export const aiWorkforceActivityLogs = pgTable(
  "ai_workforce_activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").references(() => aiWorkforceTasks.id, { onDelete: "set null" }),
    taskPublicId: text("task_public_id"),
    agentName: text("agent_name"),
    eventType: text("event_type").notNull().default("activity"),
    status: text("status").notNull().default("logged"),
    summary: text("summary").notNull().default(""),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    approvalStatus: text("approval_status").notNull().default("not_required"),
    relatedOutputId: uuid("related_output_id").references(() => aiOutputs.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index("ai_workforce_activity_logs_task_idx").on(t.taskId, t.createdAt),
    agentIdx: index("ai_workforce_activity_logs_agent_idx").on(t.agentName, t.createdAt),
  }),
);

export const aiWorkforceTasksRelations = relations(aiWorkforceTasks, ({ one, many }) => ({
  output: one(aiOutputs, {
    fields: [aiWorkforceTasks.outputId],
    references: [aiOutputs.id],
  }),
  owner: one(profiles, {
    fields: [aiWorkforceTasks.ownerUserId],
    references: [profiles.id],
  }),
  logs: many(aiWorkforceActivityLogs),
}));

export const aiWorkforceActivityLogsRelations = relations(aiWorkforceActivityLogs, ({ one }) => ({
  task: one(aiWorkforceTasks, {
    fields: [aiWorkforceActivityLogs.taskId],
    references: [aiWorkforceTasks.id],
  }),
  output: one(aiOutputs, {
    fields: [aiWorkforceActivityLogs.relatedOutputId],
    references: [aiOutputs.id],
  }),
  creator: one(profiles, {
    fields: [aiWorkforceActivityLogs.createdBy],
    references: [profiles.id],
  }),
}));

export type AiWorkforceTask = typeof aiWorkforceTasks.$inferSelect;
export type NewAiWorkforceTask = typeof aiWorkforceTasks.$inferInsert;
export type AiWorkforceActivityLog = typeof aiWorkforceActivityLogs.$inferSelect;
export type NewAiWorkforceActivityLog = typeof aiWorkforceActivityLogs.$inferInsert;
