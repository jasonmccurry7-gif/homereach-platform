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
import { businessMemoryProfiles } from "./businessMemory.js";
import { profiles } from "./users.js";

export const reputationOpportunities = pgTable(
  "reputation_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    opportunityGroup: text("opportunity_group").notNull(),
    opportunityType: text("opportunity_type").notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    estimatedImpactLabel: text("estimated_impact_label"),
    potentialValueCents: integer("potential_value_cents").notNull().default(0),
    priorityScore: integer("priority_score").notNull().default(50),
    confidenceScore: integer("confidence_score").notNull().default(50),
    status: text("status").notNull().default("new_opportunity"),
    owner: text("owner"),
    nextAction: text("next_action"),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("reputation_opportunities_client_idx").on(table.clientId, table.status, table.priorityScore, table.updatedAt),
    emailIdx: index("reputation_opportunities_email_idx").on(sql`lower(${table.clientEmail})`, table.status, table.priorityScore, table.updatedAt),
    queueIdx: index("reputation_opportunities_queue_idx").on(table.opportunityGroup, table.status, table.priorityScore, table.updatedAt),
    profileIdx: index("reputation_opportunities_profile_idx").on(table.businessMemoryProfileId, table.status, table.updatedAt),
    sourceUnique: uniqueIndex("reputation_opportunities_source_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`coalesce(${table.sourceTable}, '')`,
      sql`coalesce(${table.sourceId}, '')`,
      table.opportunityType,
    ),
  }),
);

export const reviewCampaigns = pgTable(
  "review_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => reputationOpportunities.id, { onDelete: "set null" }),
    campaignType: text("campaign_type").notNull(),
    campaignName: text("campaign_name").notNull(),
    status: text("status").notNull().default("draft"),
    owner: text("owner"),
    notes: text("notes"),
    tracking: jsonb("tracking").$type<Record<string, unknown>>().notNull().default({}),
    draftSummary: text("draft_summary"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("review_campaigns_client_idx").on(table.clientId, table.status, table.updatedAt),
    opportunityUnique: uniqueIndex("review_campaigns_opportunity_type_key").on(table.opportunityId, table.campaignType),
  }),
);

export const referralCampaigns = pgTable(
  "referral_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => reputationOpportunities.id, { onDelete: "set null" }),
    campaignType: text("campaign_type").notNull(),
    campaignName: text("campaign_name").notNull(),
    status: text("status").notNull().default("draft"),
    owner: text("owner"),
    notes: text("notes"),
    tracking: jsonb("tracking").$type<Record<string, unknown>>().notNull().default({}),
    draftSummary: text("draft_summary"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("referral_campaigns_client_idx").on(table.clientId, table.status, table.updatedAt),
    opportunityUnique: uniqueIndex("referral_campaigns_opportunity_type_key").on(table.opportunityId, table.campaignType),
  }),
);

export const testimonialLibrary = pgTable(
  "testimonial_library",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    businessName: text("business_name"),
    testimonialDate: date("testimonial_date"),
    campaignSource: text("campaign_source"),
    testimonialText: text("testimonial_text"),
    status: text("status").notNull().default("pending"),
    approved: boolean("approved").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("testimonial_library_client_idx").on(table.clientId, table.status, table.updatedAt),
    profileIdx: index("testimonial_library_profile_idx").on(table.businessMemoryProfileId, table.status, table.updatedAt),
    sourceUnique: uniqueIndex("testimonial_library_source_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`coalesce(${table.sourceTable}, '')`,
      sql`coalesce(${table.sourceId}, '')`,
    ),
  }),
);

export const reviewRequests = pgTable(
  "review_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => reputationOpportunities.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => reviewCampaigns.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    requestChannel: text("request_channel").notNull().default("manual"),
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    notes: text("notes"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("review_requests_client_idx").on(table.clientId, table.status, table.updatedAt),
    campaignIdx: index("review_requests_campaign_idx").on(table.campaignId, table.status, table.updatedAt),
  }),
);

export const referralRequests = pgTable(
  "referral_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => reputationOpportunities.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => referralCampaigns.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    requestChannel: text("request_channel").notNull().default("manual"),
    potentialValueCents: integer("potential_value_cents").notNull().default(0),
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    notes: text("notes"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("referral_requests_client_idx").on(table.clientId, table.status, table.updatedAt),
    campaignIdx: index("referral_requests_campaign_idx").on(table.campaignId, table.status, table.updatedAt),
  }),
);

export const reputationScores = pgTable(
  "reputation_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    score: integer("score").notNull().default(0),
    color: text("color").notNull().default("yellow"),
    reviewActivityScore: integer("review_activity_score").notNull().default(0),
    referralActivityScore: integer("referral_activity_score").notNull().default(0),
    testimonialActivityScore: integer("testimonial_activity_score").notNull().default(0),
    followUpActivityScore: integer("follow_up_activity_score").notNull().default(0),
    campaignActivityScore: integer("campaign_activity_score").notNull().default(0),
    currentStatus: text("current_status").notNull().default("needs_data"),
    recommendedAction: text("recommended_action").notNull().default("Review the top reputation opportunity."),
    topOpportunityId: uuid("top_opportunity_id").references(() => reputationOpportunities.id, { onDelete: "set null" }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientUnique: uniqueIndex("reputation_scores_client_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
    ),
  }),
);

export const reputationReports = pgTable(
  "reputation_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    reportingPeriodStart: date("reporting_period_start").notNull(),
    reportingPeriodEnd: date("reporting_period_end").notNull(),
    reviewOpportunities: integer("review_opportunities").notNull().default(0),
    reviewRequestsSent: integer("review_requests_sent").notNull().default(0),
    referralOpportunities: integer("referral_opportunities").notNull().default(0),
    referralRequestsSent: integer("referral_requests_sent").notNull().default(0),
    testimonialsCaptured: integer("testimonials_captured").notNull().default(0),
    campaignActivity: jsonb("campaign_activity").$type<Record<string, unknown>>().notNull().default({}),
    recommendations: text("recommendations"),
    createdBy: text("created_by").notNull().default("reputation_engine"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("reputation_reports_client_idx").on(table.clientId, table.reportingPeriodEnd),
    periodUnique: uniqueIndex("reputation_reports_period_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      table.reportingPeriodStart,
      table.reportingPeriodEnd,
    ),
  }),
);

export const reputationDrafts = pgTable(
  "reputation_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id").references(() => reputationOpportunities.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessMemoryProfileId: uuid("business_memory_profile_id").references(() => businessMemoryProfiles.id, { onDelete: "set null" }),
    draftType: text("draft_type").notNull(),
    label: text("label").notNull(),
    content: text("content").notNull(),
    approvalStatus: text("approval_status").notNull().default("draft"),
    copyCount: integer("copy_count").notNull().default(0),
    lastCopiedAt: timestamp("last_copied_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("reputation_draft_generator"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    opportunityIdx: index("reputation_drafts_opportunity_idx").on(table.opportunityId, table.draftType, table.createdAt),
    clientIdx: index("reputation_drafts_client_idx").on(table.clientId, table.draftType, table.createdAt),
    typeUnique: uniqueIndex("reputation_drafts_type_key").on(table.opportunityId, table.draftType),
  }),
);

export type ReputationOpportunity = typeof reputationOpportunities.$inferSelect;
export type NewReputationOpportunity = typeof reputationOpportunities.$inferInsert;
export type ReviewCampaign = typeof reviewCampaigns.$inferSelect;
export type NewReviewCampaign = typeof reviewCampaigns.$inferInsert;
export type ReferralCampaign = typeof referralCampaigns.$inferSelect;
export type NewReferralCampaign = typeof referralCampaigns.$inferInsert;
export type TestimonialLibraryEntry = typeof testimonialLibrary.$inferSelect;
export type NewTestimonialLibraryEntry = typeof testimonialLibrary.$inferInsert;
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type NewReviewRequest = typeof reviewRequests.$inferInsert;
export type ReferralRequest = typeof referralRequests.$inferSelect;
export type NewReferralRequest = typeof referralRequests.$inferInsert;
export type ReputationScore = typeof reputationScores.$inferSelect;
export type NewReputationScore = typeof reputationScores.$inferInsert;
export type ReputationReport = typeof reputationReports.$inferSelect;
export type NewReputationReport = typeof reputationReports.$inferInsert;
export type ReputationDraft = typeof reputationDrafts.$inferSelect;
export type NewReputationDraft = typeof reputationDrafts.$inferInsert;
