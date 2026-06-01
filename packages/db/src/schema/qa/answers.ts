// ─────────────────────────────────────────────────────────────────────────────
// qa_answers — structured answer payloads attached to questions
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";
import { qaAnswerSourceEnum } from "./enums";
import { qaQuestions } from "./questions";

export type WhatToSay = {
  sms?: string;
  email?: string;
  call?: string;
  dm?: string;
};

export const qaAnswers = pgTable(
  "qa_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => qaQuestions.id, { onDelete: "cascade" }),

    source: qaAnswerSourceEnum("source").notNull(),
    authorAgentId: uuid("author_agent_id"), // null for AI

    directAnswer: text("direct_answer").notNull(),
    whatToSay: jsonb("what_to_say").$type<WhatToSay>().notNull().default({}),
    whatToDoNext: text("what_to_do_next").notNull().default(""),
    whyThisWorks: text("why_this_works").notNull().default(""),
    relatedQuestionIds: uuid("related_question_ids").array().notNull().default([]),

    isOfficial: boolean("is_official").notNull().default(false),
    isBest: boolean("is_best").notNull().default(false),
    isLocked: boolean("is_locked").notNull().default(false),

    modelName: text("model_name"),
    modelTokensInput: integer("model_tokens_input"),
    modelTokensOutput: integer("model_tokens_output"),
    generationLatencyMs: integer("generation_latency_ms"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    questionIdx: index("qa_answers_question_idx").on(t.questionId),
  }),
);

export type QaAnswer = typeof qaAnswers.$inferSelect;
export type NewQaAnswer = typeof qaAnswers.$inferInsert;
