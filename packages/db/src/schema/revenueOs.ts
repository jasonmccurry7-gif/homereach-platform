import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./users.js";

export const revenuePipelineItems = pgTable("revenue_pipeline_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceSystem: text("source_system").notNull(),
  sourceId: text("source_id").notNull(),
  businessLine: text("business_line").notNull().default("unknown"),
  primaryStage: text("primary_stage").notNull().default("New Lead"),
  leadName: text("lead_name"),
  organizationName: text("organization_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  city: text("city"),
  county: text("county"),
  state: text("state"),
  category: text("category"),
  campaignType: text("campaign_type"),
  assignedOwnerKey: text("assigned_owner_key"),
  estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
  engagementScore: integer("engagement_score").notNull().default(0),
  responseLikelihoodScore: integer("response_likelihood_score").notNull().default(0),
  urgencyScore: integer("urgency_score").notNull().default(0),
  conversionProbabilityScore: integer("conversion_probability_score").notNull().default(0),
  revenuePriorityScore: integer("revenue_priority_score").notNull().default(0),
  latestOutreachChannel: text("latest_outreach_channel"),
  latestOutreachAt: timestamp("latest_outreach_at", { withTimezone: true }),
  latestReplyAt: timestamp("latest_reply_at", { withTimezone: true }),
  nextAction: text("next_action"),
  nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true }),
  nextRecommendedChannel: text("next_recommended_channel"),
  status: text("status").notNull().default("active"),
  sourceUrl: text("source_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const revenuePipelineTasks = pgTable("revenue_pipeline_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  pipelineItemId: uuid("pipeline_item_id").references(() => revenuePipelineItems.id, {
    onDelete: "cascade",
  }),
  sourceSystem: text("source_system"),
  sourceId: text("source_id"),
  taskType: text("task_type").notNull().default("next_action"),
  channel: text("channel").notNull().default("manual"),
  title: text("title").notNull(),
  detail: text("detail"),
  assignedOwnerKey: text("assigned_owner_key"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  approvalRequired: boolean("approval_required").notNull().default(true),
  approvalQueueId: uuid("approval_queue_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: uuid("completed_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  dedupeKey: text("dedupe_key"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const revenueStrategyInsights = pgTable("revenue_strategy_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  insightDate: date("insight_date").notNull().defaultNow(),
  insightType: text("insight_type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  recommendation: text("recommendation").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().default({}),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull().default("0"),
  impact: text("impact").notNull().default("medium"),
  status: text("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RevenuePipelineItem = typeof revenuePipelineItems.$inferSelect;
export type NewRevenuePipelineItem = typeof revenuePipelineItems.$inferInsert;
export type RevenuePipelineTask = typeof revenuePipelineTasks.$inferSelect;
export type NewRevenuePipelineTask = typeof revenuePipelineTasks.$inferInsert;
export type RevenueStrategyInsight = typeof revenueStrategyInsights.$inferSelect;
export type NewRevenueStrategyInsight = typeof revenueStrategyInsights.$inferInsert;
