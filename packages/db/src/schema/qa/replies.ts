// ─────────────────────────────────────────────────────────────────────────────
// qa_thread_replies — team/admin replies on a question thread
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, integer, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { qaReplyRoleEnum } from "./enums";
import { qaQuestions } from "./questions";

export const qaThreadReplies = pgTable(
  "qa_thread_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => qaQuestions.id, { onDelete: "cascade" }),
    parentReplyId: uuid("parent_reply_id"),
    authorAgentId: uuid("author_agent_id").notNull(),
    authorRole: qaReplyRoleEnum("author_role").notNull(),
    body: text("body").notNull(),
    upvoteCount: integer("upvote_count").notNull().default(0),
    isAdminOverride: boolean("is_admin_override").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    questionIdx: index("qa_thread_replies_question_idx").on(t.questionId),
  }),
);

export type QaThreadReply = typeof qaThreadReplies.$inferSelect;
export type NewQaThreadReply = typeof qaThreadReplies.$inferInsert;
