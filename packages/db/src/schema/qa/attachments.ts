// ─────────────────────────────────────────────────────────────────────────────
// qa_lead_attachments — scripts/answers attached to a lead's history
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { qaQuestions } from "./questions";
import { qaAnswers } from "./answers";
import { qaScriptsGenerated } from "./scripts";

export const qaLeadAttachments = pgTable(
  "qa_lead_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => qaQuestions.id, { onDelete: "cascade" }),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => qaAnswers.id, { onDelete: "cascade" }),
    scriptId: uuid("script_id").references(() => qaScriptsGenerated.id, {
      onDelete: "set null",
    }),
    attachedByAgentId: uuid("attached_by_agent_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("qa_lead_attachments_lead_idx").on(t.leadId),
  }),
);

export type QaLeadAttachment = typeof qaLeadAttachments.$inferSelect;
export type NewQaLeadAttachment = typeof qaLeadAttachments.$inferInsert;
