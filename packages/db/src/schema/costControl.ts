import {
  boolean,
  date,
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
import { businessMemoryProfiles } from "./businessMemory.js";

export const supplierCategories = pgTable(
  "supplier_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    status: text("status").notNull().default("active"),
    custom: boolean("custom").notNull().default(false),
    notes: text("notes"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientNameUnique: uniqueIndex("supplier_categories_client_name_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`lower(${table.normalizedName})`,
    ),
    profileIdx: index("supplier_categories_profile_idx").on(table.businessMemoryProfileId, table.status, table.updatedAt),
  }),
);

export const supplierDirectory = pgTable(
  "supplier_directory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    supplierName: text("supplier_name").notNull(),
    categoryId: uuid("category_id").references(() => supplierCategories.id, { onDelete: "set null" }),
    category: text("category"),
    spendCategory: text("spend_category"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    pricingNotes: text("pricing_notes"),
    reviewDate: date("review_date"),
    savingsFoundCents: integer("savings_found_cents").notNull().default(0),
    savingsAcceptedCents: integer("savings_accepted_cents").notNull().default(0),
    savingsRejectedCents: integer("savings_rejected_cents").notNull().default(0),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("supplier_directory_client_idx").on(table.clientId, table.status, table.updatedAt),
    emailIdx: index("supplier_directory_email_idx").on(sql`lower(${table.clientEmail})`, table.status, table.updatedAt),
    profileIdx: index("supplier_directory_profile_idx").on(table.businessMemoryProfileId, table.status, table.updatedAt),
    sourceUnique: uniqueIndex("supplier_directory_source_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`coalesce(${table.sourceTable}, '')`,
      sql`coalesce(${table.sourceId}, '')`,
      sql`lower(${table.supplierName})`,
    ),
  }),
);

export const costControlOpportunities = pgTable(
  "cost_control_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id").references(() => supplierDirectory.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => supplierCategories.id, { onDelete: "set null" }),
    opportunityType: text("opportunity_type").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("Other"),
    estimatedSavingsCents: integer("estimated_savings_cents").notNull().default(0),
    estimatedMonthlySavingsCents: integer("estimated_monthly_savings_cents").notNull().default(0),
    estimatedAnnualSavingsCents: integer("estimated_annual_savings_cents").notNull().default(0),
    actualSavingsCents: integer("actual_savings_cents").notNull().default(0),
    reason: text("reason").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    confidenceScore: integer("confidence_score").notNull().default(50),
    priorityScore: integer("priority_score").notNull().default(50),
    status: text("status").notNull().default("new_opportunity"),
    owner: text("owner"),
    nextAction: text("next_action"),
    notes: text("notes"),
    dateFound: timestamp("date_found", { withTimezone: true }).notNull().defaultNow(),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    implementedAt: timestamp("implemented_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("cost_control_opportunities_client_idx").on(table.clientId, table.status, table.priorityScore, table.updatedAt),
    emailIdx: index("cost_control_opportunities_email_idx").on(sql`lower(${table.clientEmail})`, table.status, table.priorityScore, table.updatedAt),
    queueIdx: index("cost_control_opportunities_queue_idx").on(table.status, table.priorityScore, table.estimatedAnnualSavingsCents, table.updatedAt),
    profileIdx: index("cost_control_opportunities_profile_idx").on(table.businessMemoryProfileId, table.status, table.updatedAt),
    sourceUnique: uniqueIndex("cost_control_opportunities_source_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`coalesce(${table.sourceTable}, '')`,
      sql`coalesce(${table.sourceId}, '')`,
      table.opportunityType,
    ),
  }),
);

export const supplierReviews = pgTable(
  "supplier_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id").references(() => supplierDirectory.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    reviewType: text("review_type").notNull().default("supplier_review"),
    status: text("status").notNull().default("pending"),
    owner: text("owner"),
    reviewDate: date("review_date").notNull().defaultNow(),
    findings: text("findings"),
    recommendedAction: text("recommended_action"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    supplierIdx: index("supplier_reviews_supplier_idx").on(table.supplierId, table.status, table.reviewDate),
    clientIdx: index("supplier_reviews_client_idx").on(table.clientId, table.status, table.reviewDate),
  }),
);

export const savingsTracker = pgTable(
  "savings_tracker",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id").references(() => costControlOpportunities.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => supplierDirectory.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    estimatedSavingsCents: integer("estimated_savings_cents").notNull().default(0),
    actualSavingsCents: integer("actual_savings_cents").notNull().default(0),
    monthlySavingsCents: integer("monthly_savings_cents").notNull().default(0),
    annualSavingsCents: integer("annual_savings_cents").notNull().default(0),
    savingsSource: text("savings_source").notNull().default("cost_control_engine"),
    dateFound: date("date_found").notNull().defaultNow(),
    dateApproved: date("date_approved"),
    dateImplemented: date("date_implemented"),
    status: text("status").notNull().default("estimated"),
    notes: text("notes"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("savings_tracker_client_idx").on(table.clientId, table.status, table.annualSavingsCents, table.updatedAt),
    profileIdx: index("savings_tracker_profile_idx").on(table.businessMemoryProfileId, table.status, table.updatedAt),
    sourceUnique: uniqueIndex("savings_tracker_source_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`coalesce(${table.sourceTable}, '')`,
      sql`coalesce(${table.sourceId}, '')`,
    ),
  }),
);

export const costControlScores = pgTable(
  "cost_control_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    score: integer("score").notNull().default(0),
    color: text("color").notNull().default("yellow"),
    categoriesMonitoredScore: integer("categories_monitored_score").notNull().default(0),
    opportunitiesReviewedScore: integer("opportunities_reviewed_score").notNull().default(0),
    opportunitiesImplementedScore: integer("opportunities_implemented_score").notNull().default(0),
    supplierReviewsScore: integer("supplier_reviews_score").notNull().default(0),
    dataCompletenessScore: integer("data_completeness_score").notNull().default(0),
    currentStatus: text("current_status").notNull().default("needs_data"),
    recommendedAction: text("recommended_action").notNull().default("Review the top savings opportunity."),
    nextOpportunityId: uuid("next_opportunity_id").references(() => costControlOpportunities.id, { onDelete: "set null" }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientUnique: uniqueIndex("cost_control_scores_client_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
    ),
  }),
);

export const costControlReports = pgTable(
  "cost_control_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    reportingPeriodStart: date("reporting_period_start").notNull(),
    reportingPeriodEnd: date("reporting_period_end").notNull(),
    estimatedSavingsCents: integer("estimated_savings_cents").notNull().default(0),
    actualSavingsCents: integer("actual_savings_cents").notNull().default(0),
    topCategories: jsonb("top_categories").$type<Record<string, unknown>[]>().notNull().default([]),
    topOpportunities: jsonb("top_opportunities").$type<Record<string, unknown>[]>().notNull().default([]),
    implementedOpportunities: jsonb("implemented_opportunities").$type<Record<string, unknown>[]>().notNull().default([]),
    rejectedOpportunities: jsonb("rejected_opportunities").$type<Record<string, unknown>[]>().notNull().default([]),
    recommendations: text("recommendations"),
    createdBy: text("created_by").notNull().default("cost_control_engine"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("cost_control_reports_client_idx").on(table.clientId, table.reportingPeriodEnd),
    periodUnique: uniqueIndex("cost_control_reports_period_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      table.reportingPeriodStart,
      table.reportingPeriodEnd,
    ),
  }),
);

export const costControlDrafts = pgTable(
  "cost_control_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id").references(() => costControlOpportunities.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    draftType: text("draft_type").notNull(),
    label: text("label").notNull(),
    content: text("content").notNull(),
    approvalStatus: text("approval_status").notNull().default("draft"),
    copyCount: integer("copy_count").notNull().default(0),
    lastCopiedAt: timestamp("last_copied_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("cost_control_draft_generator"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    opportunityIdx: index("cost_control_drafts_opportunity_idx").on(table.opportunityId, table.draftType, table.createdAt),
    clientIdx: index("cost_control_drafts_client_idx").on(table.clientId, table.draftType, table.createdAt),
    typeUnique: uniqueIndex("cost_control_drafts_type_key").on(table.opportunityId, table.draftType),
  }),
);

export type SupplierCategory = typeof supplierCategories.$inferSelect;
export type NewSupplierCategory = typeof supplierCategories.$inferInsert;
export type SupplierDirectoryEntry = typeof supplierDirectory.$inferSelect;
export type NewSupplierDirectoryEntry = typeof supplierDirectory.$inferInsert;
export type CostControlOpportunity = typeof costControlOpportunities.$inferSelect;
export type NewCostControlOpportunity = typeof costControlOpportunities.$inferInsert;
export type SupplierReview = typeof supplierReviews.$inferSelect;
export type NewSupplierReview = typeof supplierReviews.$inferInsert;
export type SavingsTrackerEntry = typeof savingsTracker.$inferSelect;
export type NewSavingsTrackerEntry = typeof savingsTracker.$inferInsert;
export type CostControlScore = typeof costControlScores.$inferSelect;
export type NewCostControlScore = typeof costControlScores.$inferInsert;
export type CostControlReport = typeof costControlReports.$inferSelect;
export type NewCostControlReport = typeof costControlReports.$inferInsert;
export type CostControlDraft = typeof costControlDrafts.$inferSelect;
export type NewCostControlDraft = typeof costControlDrafts.$inferInsert;
