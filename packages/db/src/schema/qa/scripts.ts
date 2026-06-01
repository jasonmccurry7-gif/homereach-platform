// ─────────────────────────────────────────────────────────────────────────────
// qa_scripts_generated — rendered channel-specific scripts
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { qaChannelEnum } from "./enums";
import { qaAnswers } from "./answers";

export const qaScriptsGenerated = pgTable(
  "qa_scripts_generated",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    answerId: uuid("answer_id")
      .notNull()
      .references(() => qaAnswers.id, { onDelete: "cascade" }),
    channel: qaChannelEnum("channel").notNull(),
    content: text("content").notNull(),
    copiedByAgentId: uuid("copied_by_agent_id"),
    attachedToLeadId: uuid("attached_to_lead_id"),
    usedInSendId: uuid("used_in_send_id"), // reserved for V2
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    answerIdx: index("qa_scripts_answer_idx").on(t.answerId),
  }),
);

export type QaScriptGenerated = typeof qaScriptsGenerated.$inferSelect;
export type NewQaScriptGenerated = typeof qaScriptsGenerated.$inferInsert;
