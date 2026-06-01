import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./users.js";
import { aiCooRecommendations } from "./aiCoo.js";

export const businessMemoryProfiles = pgTable(
  "business_memory_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    businessName: text("business_name").notNull(),
    industry: text("industry"),
    services: jsonb("services").$type<string[]>().notNull().default([]),
    businessSize: text("business_size"),
    serviceRadiusMiles: numeric("service_radius_miles", { precision: 8, scale: 2 }),
    website: text("website"),
    marketsServed: jsonb("markets_served").$type<string[]>().notNull().default([]),
    primaryGoals: jsonb("primary_goals").$type<string[]>().notNull().default([]),
    preferredCampaignTypes: jsonb("preferred_campaign_types").$type<string[]>().notNull().default([]),
    preferredCommunicationMethod: text("preferred_communication_method"),
    primaryCities: jsonb("primary_cities").$type<string[]>().notNull().default([]),
    primaryZipCodes: jsonb("primary_zip_codes").$type<string[]>().notNull().default([]),
    primaryCounties: jsonb("primary_counties").$type<string[]>().notNull().default([]),
    preferredOffers: jsonb("preferred_offers").$type<string[]>().notNull().default([]),
    preferredBudgets: jsonb("preferred_budgets").$type<Record<string, unknown>>().notNull().default({}),
    source: text("source").notNull().default("business_memory_mvp"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientUnique: uniqueIndex("business_memory_profiles_client_key").on(
      sql`coalesce(${table.clientId}::text, '')`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      sql`lower(${table.businessName})`,
    ),
    searchIdx: index("business_memory_profiles_search_idx").on(
      sql`lower(${table.businessName})`,
      sql`lower(coalesce(${table.clientEmail}, ''))`,
      table.updatedAt,
    ),
  }),
);

export const businessMemoryGeographies = pgTable(
  "business_memory_geographies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    geographyType: text("geography_type").notNull(),
    name: text("name").notNull(),
    value: text("value"),
    address: text("address"),
    radiusMiles: numeric("radius_miles", { precision: 8, scale: 2 }),
    performanceStatus: text("performance_status").notNull().default("unknown"),
    performanceScore: integer("performance_score").notNull().default(0),
    notes: text("notes"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_geographies_profile_idx").on(table.profileId, table.geographyType, table.performanceScore, table.updatedAt),
  }),
);

export const businessMemoryCampaigns = pgTable(
  "business_memory_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    campaignType: text("campaign_type").notNull(),
    campaignName: text("campaign_name").notNull(),
    launchDate: date("launch_date"),
    budgetCents: integer("budget_cents").notNull().default(0),
    status: text("status").notNull().default("unknown"),
    assetsUsed: jsonb("assets_used").$type<Record<string, unknown>[]>().notNull().default([]),
    targetGeography: text("target_geography"),
    directMailUsed: boolean("direct_mail_used").notNull().default(false),
    digitalUsed: boolean("digital_used").notNull().default(false),
    politicalUsed: boolean("political_used").notNull().default(false),
    reviewUsed: boolean("review_used").notNull().default(false),
    referralUsed: boolean("referral_used").notNull().default(false),
    performanceNotes: text("performance_notes"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_campaigns_profile_idx").on(table.profileId, table.campaignType, table.status, table.updatedAt),
  }),
);

export const businessMemoryCampaignResults = pgTable(
  "business_memory_campaign_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignMemoryId: uuid("campaign_memory_id").notNull().references(() => businessMemoryCampaigns.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    reportingPeriodStart: date("reporting_period_start"),
    reportingPeriodEnd: date("reporting_period_end"),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    calls: integer("calls").notNull().default(0),
    forms: integer("forms").notNull().default(0),
    qrScans: integer("qr_scans").notNull().default(0),
    spendCents: integer("spend_cents").notNull().default(0),
    costPerLeadCents: integer("cost_per_lead_cents").notNull().default(0),
    costPerClickCents: integer("cost_per_click_cents").notNull().default(0),
    clientFeedback: text("client_feedback"),
    internalNotes: text("internal_notes"),
    successRating: integer("success_rating").notNull().default(0),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_campaign_results_profile_idx").on(table.profileId, table.successRating, table.reportingPeriodEnd),
  }),
);

export const businessMemoryOpportunities = pgTable(
  "business_memory_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    opportunityType: text("opportunity_type").notNull(),
    opportunityReason: text("opportunity_reason"),
    opportunityStatus: text("opportunity_status").notNull().default("new"),
    accepted: boolean("accepted").notNull().default(false),
    rejected: boolean("rejected").notNull().default(false),
    dismissed: boolean("dismissed").notNull().default(false),
    completed: boolean("completed").notNull().default(false),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    actualValueCents: integer("actual_value_cents").notNull().default(0),
    dateCreated: timestamp("date_created", { withTimezone: true }).notNull().defaultNow(),
    dateClosed: timestamp("date_closed", { withTimezone: true }),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_opportunities_profile_idx").on(table.profileId, table.opportunityType, table.opportunityStatus, table.dateCreated),
  }),
);

export const businessMemoryOffers = pgTable(
  "business_memory_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    offerText: text("offer_text").notNull(),
    offerType: text("offer_type"),
    campaignPerformance: text("campaign_performance"),
    acceptanceRate: numeric("acceptance_rate", { precision: 5, scale: 2 }),
    leadQualityNotes: text("lead_quality_notes"),
    revenueNotes: text("revenue_notes"),
    performanceStatus: text("performance_status").notNull().default("unknown"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_offers_profile_idx").on(table.profileId, table.performanceStatus, table.updatedAt),
  }),
);

export const businessMemorySuppliers = pgTable(
  "business_memory_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    supplierName: text("supplier_name").notNull(),
    category: text("category"),
    supplierHistory: jsonb("supplier_history").$type<Record<string, unknown>[]>().notNull().default([]),
    vendorNotes: text("vendor_notes"),
    pricingHistory: jsonb("pricing_history").$type<Record<string, unknown>[]>().notNull().default([]),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_suppliers_profile_idx").on(table.profileId, sql`lower(${table.supplierName})`, table.updatedAt),
  }),
);

export const businessMemorySavings = pgTable(
  "business_memory_savings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    opportunityName: text("opportunity_name").notNull(),
    category: text("category"),
    estimatedSavingsCents: integer("estimated_savings_cents").notNull().default(0),
    actualSavingsCents: integer("actual_savings_cents").notNull().default(0),
    accepted: boolean("accepted").notNull().default(false),
    rejected: boolean("rejected").notNull().default(false),
    recurringSavings: boolean("recurring_savings").notNull().default(false),
    oneTimeSavings: boolean("one_time_savings").notNull().default(false),
    status: text("status").notNull().default("new"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_savings_profile_idx").on(table.profileId, table.status, table.estimatedSavingsCents, table.updatedAt),
  }),
);

export const businessMemoryReputation = pgTable(
  "business_memory_reputation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    memoryType: text("memory_type").notNull(),
    reviewsRequested: integer("reviews_requested").notNull().default(0),
    reviewsReceived: integer("reviews_received").notNull().default(0),
    referralsGenerated: integer("referrals_generated").notNull().default(0),
    testimonial: text("testimonial"),
    clientFeedback: text("client_feedback"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_reputation_profile_idx").on(table.profileId, table.memoryType, table.updatedAt),
  }),
);

export const businessMemoryGrowth = pgTable(
  "business_memory_growth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    growthType: text("growth_type").notNull(),
    description: text("description").notNull(),
    newZipCodes: jsonb("new_zip_codes").$type<string[]>().notNull().default([]),
    newCities: jsonb("new_cities").$type<string[]>().notNull().default([]),
    newServices: jsonb("new_services").$type<string[]>().notNull().default([]),
    newCampaignTypes: jsonb("new_campaign_types").$type<string[]>().notNull().default([]),
    newMarkets: jsonb("new_markets").$type<string[]>().notNull().default([]),
    newPoliticalOpportunities: jsonb("new_political_opportunities").$type<string[]>().notNull().default([]),
    newRevenueStreams: jsonb("new_revenue_streams").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("new"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_growth_profile_idx").on(table.profileId, table.growthType, table.status, table.updatedAt),
  }),
);

export const businessMemoryAiCoo = pgTable(
  "business_memory_ai_coo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id").references(() => aiCooRecommendations.id, { onDelete: "set null" }),
    recommendationType: text("recommendation_type").notNull(),
    category: text("category"),
    status: text("status").notNull().default("new"),
    accepted: boolean("accepted").notNull().default(false),
    rejected: boolean("rejected").notNull().default(false),
    dismissed: boolean("dismissed").notNull().default(false),
    completed: boolean("completed").notNull().default(false),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    successRating: integer("success_rating").notNull().default(0),
    reason: text("reason"),
    sourceTable: text("source_table"),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_ai_coo_profile_idx").on(table.profileId, table.category, table.status, table.updatedAt),
  }),
);

export const businessMemoryTimeline = pgTable(
  "business_memory_timeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull().defaultNow(),
    relatedTable: text("related_table"),
    relatedId: text("related_id"),
    impactCents: integer("impact_cents").notNull().default(0),
    status: text("status"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("business_memory_timeline_profile_idx").on(table.profileId, table.eventDate, table.eventType),
  }),
);

export const businessMemoryInsights = pgTable(
  "business_memory_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    insightType: text("insight_type").notNull(),
    title: text("title").notNull(),
    valueText: text("value_text"),
    valueCents: integer("value_cents").notNull().default(0),
    confidenceScore: integer("confidence_score").notNull().default(0),
    supportingData: jsonb("supporting_data").$type<Record<string, unknown>>().notNull().default({}),
    recommendedAction: text("recommended_action"),
    status: text("status").notNull().default("active"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeUnique: uniqueIndex("business_memory_insights_type_key").on(table.profileId, table.insightType),
    profileIdx: index("business_memory_insights_profile_idx").on(table.profileId, table.status, table.confidenceScore, table.generatedAt),
  }),
);

export const businessMemoryScores = pgTable(
  "business_memory_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => businessMemoryProfiles.id, { onDelete: "cascade" }),
    memoryCompletenessScore: integer("memory_completeness_score").notNull().default(0),
    businessProfileScore: integer("business_profile_score").notNull().default(0),
    campaignHistoryScore: integer("campaign_history_score").notNull().default(0),
    opportunityHistoryScore: integer("opportunity_history_score").notNull().default(0),
    geographyDataScore: integer("geography_data_score").notNull().default(0),
    supplierDataScore: integer("supplier_data_score").notNull().default(0),
    reputationDataScore: integer("reputation_data_score").notNull().default(0),
    recommendationDataScore: integer("recommendation_data_score").notNull().default(0),
    missingAreas: jsonb("missing_areas").$type<string[]>().notNull().default([]),
    recommendedDataToCollect: jsonb("recommended_data_to_collect").$type<string[]>().notNull().default([]),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileUnique: uniqueIndex("business_memory_scores_profile_key").on(table.profileId),
  }),
);

export type BusinessMemoryProfile = typeof businessMemoryProfiles.$inferSelect;
export type NewBusinessMemoryProfile = typeof businessMemoryProfiles.$inferInsert;
export type BusinessMemoryGeography = typeof businessMemoryGeographies.$inferSelect;
export type NewBusinessMemoryGeography = typeof businessMemoryGeographies.$inferInsert;
export type BusinessMemoryCampaign = typeof businessMemoryCampaigns.$inferSelect;
export type NewBusinessMemoryCampaign = typeof businessMemoryCampaigns.$inferInsert;
export type BusinessMemoryCampaignResult = typeof businessMemoryCampaignResults.$inferSelect;
export type NewBusinessMemoryCampaignResult = typeof businessMemoryCampaignResults.$inferInsert;
export type BusinessMemoryOpportunity = typeof businessMemoryOpportunities.$inferSelect;
export type NewBusinessMemoryOpportunity = typeof businessMemoryOpportunities.$inferInsert;
export type BusinessMemoryOffer = typeof businessMemoryOffers.$inferSelect;
export type NewBusinessMemoryOffer = typeof businessMemoryOffers.$inferInsert;
export type BusinessMemorySupplier = typeof businessMemorySuppliers.$inferSelect;
export type NewBusinessMemorySupplier = typeof businessMemorySuppliers.$inferInsert;
export type BusinessMemorySaving = typeof businessMemorySavings.$inferSelect;
export type NewBusinessMemorySaving = typeof businessMemorySavings.$inferInsert;
export type BusinessMemoryReputation = typeof businessMemoryReputation.$inferSelect;
export type NewBusinessMemoryReputation = typeof businessMemoryReputation.$inferInsert;
export type BusinessMemoryGrowth = typeof businessMemoryGrowth.$inferSelect;
export type NewBusinessMemoryGrowth = typeof businessMemoryGrowth.$inferInsert;
export type BusinessMemoryAiCoo = typeof businessMemoryAiCoo.$inferSelect;
export type NewBusinessMemoryAiCoo = typeof businessMemoryAiCoo.$inferInsert;
export type BusinessMemoryTimelineEvent = typeof businessMemoryTimeline.$inferSelect;
export type NewBusinessMemoryTimelineEvent = typeof businessMemoryTimeline.$inferInsert;
export type BusinessMemoryInsight = typeof businessMemoryInsights.$inferSelect;
export type NewBusinessMemoryInsight = typeof businessMemoryInsights.$inferInsert;
export type BusinessMemoryScore = typeof businessMemoryScores.$inferSelect;
export type NewBusinessMemoryScore = typeof businessMemoryScores.$inferInsert;
