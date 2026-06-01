import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./users.js";

export const opportunityCategories = pgTable(
  "opportunity_categories",
  {
    category: text("category").primaryKey(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull().default(100),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sortIdx: index("opportunity_categories_sort_idx").on(table.active, table.sortOrder),
  }),
);

export const aiCooRecommendations = pgTable(
  "ai_coo_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    clientName: text("client_name"),
    businessName: text("business_name"),
    category: text("category")
      .notNull()
      .references(() => opportunityCategories.category),
    opportunityType: text("opportunity_type").notNull(),
    title: text("title").notNull(),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    estimatedSavingsCents: integer("estimated_savings_cents").notNull().default(0),
    estimatedImpactLabel: text("estimated_impact_label"),
    whyItMatters: text("why_it_matters").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    priorityScore: integer("priority_score").notNull().default(50),
    valueScore: integer("value_score").notNull().default(50),
    confidenceScore: integer("confidence_score").notNull().default(50),
    urgencyScore: integer("urgency_score").notNull().default(50),
    confidenceLevel: text("confidence_level").notNull().default("medium"),
    riskLevel: text("risk_level"),
    status: text("status").notNull().default("new"),
    source: text("source").notNull().default("ai_coo_mvp"),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    owner: text("owner").notNull().default("ai_coo"),
    actionLabels: jsonb("action_labels").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    dismissalReason: text("dismissal_reason"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("ai_coo_recommendation_engine"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("ai_coo_recommendations_client_idx").on(table.clientId, table.status, table.priorityScore, table.createdAt),
    emailIdx: index("ai_coo_recommendations_email_idx").on(sql`lower(${table.clientEmail})`, table.status, table.priorityScore, table.createdAt),
    queueIdx: index("ai_coo_recommendations_admin_queue_idx").on(table.status, table.category, table.priorityScore, table.createdAt),
    relatedIdx: index("ai_coo_recommendations_related_idx").on(table.relatedEntityType, table.relatedEntityId),
  }),
);

export const aiCooActions = pgTable(
  "ai_coo_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => aiCooRecommendations.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    label: text("label").notNull(),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    status: text("status").notNull().default("recorded"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    noAutonomousAction: boolean("no_autonomous_action").notNull().default(true),
    relatedTaskId: uuid("related_task_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recommendationIdx: index("ai_coo_actions_recommendation_idx").on(table.recommendationId, table.createdAt),
    statusIdx: index("ai_coo_actions_status_idx").on(table.status, table.actionType, table.createdAt),
  }),
);

export const aiCooDrafts = pgTable(
  "ai_coo_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => aiCooRecommendations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    draftType: text("draft_type").notNull(),
    label: text("label").notNull(),
    content: text("content").notNull(),
    approvalStatus: text("approval_status").notNull().default("draft"),
    copyCount: integer("copy_count").notNull().default(0),
    lastCopiedAt: timestamp("last_copied_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("ai_coo_draft_generator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recommendationIdx: index("ai_coo_drafts_recommendation_idx").on(table.recommendationId, table.draftType, table.createdAt),
    clientIdx: index("ai_coo_drafts_client_idx").on(table.clientId, table.draftType, table.createdAt),
  }),
);

export const aiCooScores = pgTable(
  "ai_coo_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    scoreType: text("score_type").notNull().default("scoreboard"),
    score: integer("score").notNull().default(0),
    color: text("color").notNull().default("yellow"),
    recommendedNextAction: text("recommended_next_action").notNull().default("Review today's top recommendation"),
    components: jsonb("components").$type<Record<string, unknown>>().notNull().default({}),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientScoreUnique: uniqueIndex("ai_coo_scores_client_score_type_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      table.scoreType,
    ),
  }),
);

export const clientSuccessScores = pgTable(
  "client_success_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    score: integer("score").notNull().default(0),
    color: text("color").notNull().default("yellow"),
    campaignActivityScore: integer("campaign_activity_score").notNull().default(0),
    opportunityAcceptanceScore: integer("opportunity_acceptance_score").notNull().default(0),
    taskCompletionScore: integer("task_completion_score").notNull().default(0),
    reportingComplianceScore: integer("reporting_compliance_score").notNull().default(0),
    recommendedNextAction: text("recommended_next_action").notNull().default("Review today's top recommendation"),
    components: jsonb("components").$type<Record<string, unknown>>().notNull().default({}),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientUnique: uniqueIndex("client_success_scores_client_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
    ),
  }),
);

export const recommendationHistory = pgTable(
  "recommendation_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => aiCooRecommendations.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    action: text("action").notNull(),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recommendationIdx: index("recommendation_history_recommendation_idx").on(table.recommendationId, table.createdAt),
  }),
);

export type OpportunityCategory = typeof opportunityCategories.$inferSelect;
export type NewOpportunityCategory = typeof opportunityCategories.$inferInsert;
export type AiCooRecommendation = typeof aiCooRecommendations.$inferSelect;
export type NewAiCooRecommendation = typeof aiCooRecommendations.$inferInsert;
export type AiCooAction = typeof aiCooActions.$inferSelect;
export type NewAiCooAction = typeof aiCooActions.$inferInsert;
export type AiCooDraft = typeof aiCooDrafts.$inferSelect;
export type NewAiCooDraft = typeof aiCooDrafts.$inferInsert;
export type AiCooScore = typeof aiCooScores.$inferSelect;
export type NewAiCooScore = typeof aiCooScores.$inferInsert;
export type ClientSuccessScore = typeof clientSuccessScores.$inferSelect;
export type NewClientSuccessScore = typeof clientSuccessScores.$inferInsert;
export type RecommendationHistory = typeof recommendationHistory.$inferSelect;
export type NewRecommendationHistory = typeof recommendationHistory.$inferInsert;
