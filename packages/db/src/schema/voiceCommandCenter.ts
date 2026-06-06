import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aiOutputs } from "./aiAssets.js";
import { aiWorkforceTasks } from "./aiWorkforce.js";
import { approvalLedger } from "./approvalLedger.js";
import { profiles } from "./users.js";

export const actionQueue = pgTable(
  "action_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionType: text("action_type").notNull(),
    channel: text("channel").notNull().default("internal"),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    businessName: text("business_name"),
    campaignId: uuid("campaign_id"),
    city: text("city"),
    vertical: text("vertical"),
    subject: text("subject"),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("draft"),
    riskLevel: text("risk_level").notNull().default("medium"),
    createdByAgent: text("created_by_agent"),
    approvedBy: uuid("approved_by").references(() => profiles.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    sourceSystem: text("source_system"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    sourceKey: text("source_key"),
    approvalLedgerId: uuid("approval_ledger_id").references(() => approvalLedger.id, { onDelete: "set null" }),
    aiWorkforceTaskId: uuid("ai_workforce_task_id").references(() => aiWorkforceTasks.id, { onDelete: "set null" }),
    aiOutputId: uuid("ai_output_id").references(() => aiOutputs.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("action_queue_status_idx").on(t.status, t.riskLevel, t.updatedAt),
    channelIdx: index("action_queue_channel_idx").on(t.channel, t.status, t.updatedAt),
    approvalLedgerIdx: index("action_queue_approval_ledger_idx").on(t.approvalLedgerId),
    sourceKeyIdx: uniqueIndex("action_queue_source_key_uidx").on(t.sourceKey),
  }),
);

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    transcript: text("transcript").notNull().default(""),
    summary: text("summary").notNull().default(""),
    modelUsed: text("model_used").notNull().default("not_started"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("voice_sessions_user_idx").on(t.userId, t.startedAt),
    statusIdx: index("voice_sessions_status_idx").on(t.status, t.startedAt),
  }),
);

export const voiceApprovals = pgTable(
  "voice_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voiceSessionId: uuid("voice_session_id").references(() => voiceSessions.id, { onDelete: "set null" }),
    actionQueueIds: uuid("action_queue_ids").array().notNull().default([]),
    approvalPhrase: text("approval_phrase").notNull(),
    approvalType: text("approval_type").notNull(),
    transcriptSnippet: text("transcript_snippet").notNull().default(""),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }).notNull().default("0"),
    executed: boolean("executed").notNull().default(false),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("voice_approvals_session_idx").on(t.voiceSessionId, t.createdAt),
  }),
);

export const agentBriefings = pgTable(
  "agent_briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    briefingType: text("briefing_type").notNull(),
    agentName: text("agent_name").notNull(),
    agentRole: text("agent_role").notNull(),
    summary: text("summary").notNull().default(""),
    recommendations: jsonb("recommendations").$type<Record<string, unknown>[]>().notNull().default([]),
    proposedActions: jsonb("proposed_actions").$type<Record<string, unknown>[]>().notNull().default([]),
    sourceSnapshot: jsonb("source_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    latestIdx: index("agent_briefings_latest_idx").on(t.briefingType, t.createdAt),
    agentIdx: index("agent_briefings_agent_idx").on(t.agentName, t.createdAt),
  }),
);

export const communicationAuditLog = pgTable(
  "communication_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionQueueId: uuid("action_queue_id").references(() => actionQueue.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    actorType: text("actor_type").notNull().default("system"),
    actorName: text("actor_name"),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actionIdx: index("communication_audit_action_idx").on(t.actionQueueId, t.createdAt),
    eventIdx: index("communication_audit_event_idx").on(t.eventType, t.createdAt),
  }),
);

export type ActionQueue = typeof actionQueue.$inferSelect;
export type NewActionQueue = typeof actionQueue.$inferInsert;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type NewVoiceSession = typeof voiceSessions.$inferInsert;
export type VoiceApproval = typeof voiceApprovals.$inferSelect;
export type NewVoiceApproval = typeof voiceApprovals.$inferInsert;
export type AgentBriefing = typeof agentBriefings.$inferSelect;
export type NewAgentBriefing = typeof agentBriefings.$inferInsert;
export type CommunicationAuditLog = typeof communicationAuditLog.$inferSelect;
export type NewCommunicationAuditLog = typeof communicationAuditLog.$inferInsert;
