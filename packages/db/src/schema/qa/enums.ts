// ─────────────────────────────────────────────────────────────────────────────
// Q&A shared enums — Drizzle pgEnum wrappers matching 048_qa_tables.sql
// ─────────────────────────────────────────────────────────────────────────────

import { pgEnum } from "drizzle-orm/pg-core";

export const qaVisibilityEnum = pgEnum("qa_visibility", [
  "private",
  "team",
  "public",
]);

export const qaStatusEnum = pgEnum("qa_status", [
  "open",
  "answered",
  "resolved",
  "archived",
]);

export const qaAnswerSourceEnum = pgEnum("qa_answer_source", [
  "ai",
  "team",
  "admin",
]);

export const qaReplyRoleEnum = pgEnum("qa_reply_role", [
  "agent",
  "admin",
]);

export const qaChannelEnum = pgEnum("qa_channel", [
  "sms",
  "email",
  "call",
  "dm",
]);

export const qaUsageEventEnum = pgEnum("qa_usage_event", [
  "question_asked",
  "answer_generated",
  "answer_generation_failed",
  "reply_added",
  "script_copied",
  "attached_to_lead",
  "marked_best",
  "marked_official",
  "knowledge_searched",
  "dedupe_checked",
]);
