// ─────────────────────────────────────────────────────────────────────────────
// qa_knowledge_entries — auto-built Sales Bible
//
// Embedding and tsvector columns are declared in the SQL migration but omitted
// from the Drizzle schema (Drizzle does not yet natively express pgvector or
// generated columns cleanly). Query them via raw SQL in the retrieval service.
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, integer, timestamp, index,
} from "drizzle-orm/pg-core";
import { qaQuestions } from "./questions";
import { qaAnswers } from "./answers";

export const qaKnowledgeEntries = pgTable(
  "qa_knowledge_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceQuestionId: uuid("source_question_id")
      .notNull()
      .references(() => qaQuestions.id, { onDelete: "cascade" }),
    sourceAnswerId: uuid("source_answer_id")
      .notNull()
      .references(() => qaAnswers.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    body: text("body").notNull(),
    categoryTags: text("category_tags").array().notNull().default([]),
    cityScope: uuid("city_scope").array(),

    promotedByAdminId: uuid("promoted_by_admin_id").notNull(),

    usageCount: integer("usage_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usageIdx: index("qa_knowledge_usage_idx").on(t.usageCount),
  }),
);

export type QaKnowledgeEntry = typeof qaKnowledgeEntries.$inferSelect;
export type NewQaKnowledgeEntry = typeof qaKnowledgeEntries.$inferInsert;
