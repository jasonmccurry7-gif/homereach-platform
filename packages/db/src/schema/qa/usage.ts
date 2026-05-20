// ─────────────────────────────────────────────────────────────────────────────
// qa_usage_logs — event-level log powering V3 performance feedback
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, jsonb, timestamp, index,
} from "drizzle-orm/pg-core";
import { qaUsageEventEnum } from "./enums";

export const qaUsageLogs = pgTable(
  "qa_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: qaUsageEventEnum("event_type").notNull(),

    questionId: uuid("question_id"),
    answerId: uuid("answer_id"),
    replyId: uuid("reply_id"),
    scriptId: uuid("script_id"),

    agentId: uuid("agent_id").notNull(),
    leadId: uuid("lead_id"),

    metadata: jsonb("metadata").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index("qa_usage_logs_agent_idx").on(t.agentId, t.createdAt),
    eventIdx: index("qa_usage_logs_event_type_idx").on(t.eventType, t.createdAt),
  }),
);

export type QaUsageLog = typeof qaUsageLogs.$inferSelect;
export type NewQaUsageLog = typeof qaUsageLogs.$inferInsert;
