// ─────────────────────────────────────────────────────────────────────────────
// qa_questions — top-level question records (threads)
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, integer, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import {
  qaVisibilityEnum, qaStatusEnum,
} from "./enums";

export const qaQuestions = pgTable(
  "qa_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // FK: agent_identities(id)
    askedByAgentId: uuid("asked_by_agent_id").notNull(),

    questionText: text("question_text").notNull(),
    categoryTags: text("category_tags").array().notNull().default([]),

    visibility: qaVisibilityEnum("visibility").notNull().default("team"),

    // Optional lead / geography context
    leadId: uuid("lead_id"),
    cityId: uuid("city_id"),
    categoryId: uuid("category_id"),
    lastInteractionId: uuid("last_interaction_id"),

    status: qaStatusEnum("status").notNull().default("open"),
    isPinned: boolean("is_pinned").notNull().default(false),
    upvoteCount: integer("upvote_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    askedByIdx: index("qa_questions_asked_by_idx").on(t.askedByAgentId),
    statusIdx: index("qa_questions_status_idx").on(t.status),
  }),
);

export type QaQuestion = typeof qaQuestions.$inferSelect;
export type NewQaQuestion = typeof qaQuestions.$inferInsert;
