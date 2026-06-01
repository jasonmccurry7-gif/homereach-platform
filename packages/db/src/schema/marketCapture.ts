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
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads.js";
import { profiles } from "./users.js";

export const marketCaptureLeads = pgTable(
  "market_capture_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    website: text("website"),
    industry: text("industry").notNull(),
    monthlyAdBudget: integer("monthly_ad_budget").notNull().default(0),
    targetingObjective: text("targeting_objective").notNull(),
    targetingType: text("targeting_type").notNull(),
    targetArea: text("target_area").notNull(),
    preferredStartDate: date("preferred_start_date"),
    campaignOffer: text("campaign_offer"),
    postcardAddon: boolean("postcard_addon").notNull().default(false),
    landingPageNeeded: boolean("landing_page_needed").notNull().default(false),
    creativePackageNeeded: boolean("creative_package_needed").notNull().default(false),
    consentAcknowledged: boolean("consent_acknowledged").notNull().default(false),
    complianceAcknowledged: boolean("compliance_acknowledged").notNull().default(false),
    monthlyManagementFee: integer("monthly_management_fee").notNull().default(49900),
    paymentStatus: text("payment_status").notNull().default("payment_required"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeCustomerId: text("stripe_customer_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    owner: text("owner").notNull().default("jason"),
    status: text("status").notNull().default("active"),
    source: text("source").notNull().default("market_capture_intake"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("market_capture_leads_status_idx").on(t.status, t.paymentStatus, t.createdAt),
    emailIdx: index("market_capture_leads_email_idx").on(t.email, t.createdAt),
    ownerIdx: index("market_capture_leads_owner_idx").on(t.owner, t.createdAt),
  }),
);

export const marketCapturePipeline = pgTable(
  "market_capture_pipeline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureLeadId: uuid("market_capture_lead_id")
      .notNull()
      .references(() => marketCaptureLeads.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().default("intake_complete"),
    owner: text("owner").notNull().default("jason"),
    status: text("status").notNull().default("open"),
    estimatedMrrCents: integer("estimated_mrr_cents").notNull().default(49900),
    pipelineValueCents: integer("pipeline_value_cents").notNull().default(49900),
    nextAction: text("next_action").notNull().default("Review intake"),
    notes: text("notes"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("market_capture_pipeline_lead_idx").on(t.marketCaptureLeadId),
    stageIdx: index("market_capture_pipeline_stage_idx").on(t.stage, t.status, t.updatedAt),
    ownerIdx: index("market_capture_pipeline_owner_idx").on(t.owner, t.stage),
  }),
);

export const marketCaptureTasks = pgTable(
  "market_capture_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureLeadId: uuid("market_capture_lead_id")
      .notNull()
      .references(() => marketCaptureLeads.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id").references(() => marketCapturePipeline.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    owner: text("owner").notNull().default("jason"),
    status: text("status").notNull().default("open"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    taskOrder: integer("task_order").notNull().default(0),
    taskType: text("task_type").notNull().default("sales"),
    priority: text("priority").notNull().default("normal"),
    assignedRole: text("assigned_role"),
    completionHistory: jsonb("completion_history").$type<Record<string, unknown>[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("market_capture_tasks_lead_idx").on(t.marketCaptureLeadId, t.status, t.taskOrder),
    ownerIdx: index("market_capture_tasks_owner_idx").on(t.owner, t.status, t.dueDate),
    typeIdx: index("market_capture_tasks_type_idx").on(t.taskType, t.status, t.dueDate),
  }),
);

export const marketCaptureAssets = pgTable(
  "market_capture_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureLeadId: uuid("market_capture_lead_id")
      .notNull()
      .references(() => marketCaptureLeads.id, { onDelete: "cascade" }),
    assetType: text("asset_type").notNull(),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    status: text("status").notNull().default("uploaded"),
    approvalStatus: text("approval_status").notNull().default("awaiting_review"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    clientVisible: boolean("client_visible").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("market_capture_assets_lead_idx").on(t.marketCaptureLeadId, t.assetType, t.createdAt),
    approvalIdx: index("market_capture_assets_approval_idx").on(t.approvalStatus, t.status, t.createdAt),
  }),
);

export const marketCaptureNotes = pgTable(
  "market_capture_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureLeadId: uuid("market_capture_lead_id")
      .notNull()
      .references(() => marketCaptureLeads.id, { onDelete: "cascade" }),
    author: text("author").notNull().default("system"),
    noteType: text("note_type").notNull().default("activity"),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("market_capture_notes_lead_idx").on(t.marketCaptureLeadId, t.createdAt),
  }),
);

export const marketCaptureDrafts = pgTable(
  "market_capture_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureLeadId: uuid("market_capture_lead_id")
      .notNull()
      .references(() => marketCaptureLeads.id, { onDelete: "cascade" }),
    draftType: text("draft_type").notNull(),
    label: text("label").notNull(),
    content: text("content").notNull(),
    createdBy: text("created_by").notNull().default("sales_draft_generator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("market_capture_drafts_lead_idx").on(t.marketCaptureLeadId, t.draftType, t.createdAt),
  }),
);

export const marketCaptureCampaigns = pgTable(
  "market_capture_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureLeadId: uuid("market_capture_lead_id")
      .notNull()
      .references(() => marketCaptureLeads.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id").references(() => marketCapturePipeline.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    campaignName: text("campaign_name").notNull(),
    campaignStatus: text("campaign_status").notNull().default("campaign_setup"),
    launchStatus: text("launch_status").notNull().default("not_started"),
    directMailStatus: text("direct_mail_status").notNull().default("not_requested"),
    creativeStatus: text("creative_status").notNull().default("missing"),
    approvalStatus: text("approval_status").notNull().default("awaiting_approval"),
    reportingStatus: text("reporting_status").notNull().default("not_started"),
    targetGeography: text("target_geography"),
    radiusMiles: numeric("radius_miles", { precision: 6, scale: 2 }),
    monthlyAdBudget: integer("monthly_ad_budget").notNull().default(0),
    monthlyManagementFee: integer("monthly_management_fee").notNull().default(49900),
    paymentStatus: text("payment_status").notNull().default("payment_required"),
    landingPageUrl: text("landing_page_url"),
    trackingUrl: text("tracking_url"),
    owner: text("owner").notNull().default("jason"),
    reviewer: text("reviewer"),
    designer: text("designer"),
    accountManager: text("account_manager"),
    nextBestAction: text("next_best_action").notNull().default("Review intake and validate target area"),
    notes: text("notes"),
    directMailRequested: boolean("direct_mail_requested").notNull().default(false),
    directMailQuantity: integer("direct_mail_quantity"),
    directMailEstimatedCostCents: integer("direct_mail_estimated_cost_cents"),
    directMailNotes: text("direct_mail_notes"),
    launchDate: date("launch_date"),
    reportDueAt: timestamp("report_due_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index("market_capture_campaigns_lead_idx").on(t.marketCaptureLeadId),
    statusIdx: index("market_capture_campaigns_status_idx").on(t.campaignStatus, t.launchStatus, t.updatedAt),
    ownerIdx: index("market_capture_campaigns_owner_idx").on(t.owner, t.campaignStatus, t.updatedAt),
    directMailIdx: index("market_capture_campaigns_direct_mail_idx").on(t.directMailStatus, t.directMailRequested),
  }),
);

export const marketCaptureCampaignLocations = pgTable(
  "market_capture_campaign_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    locationType: text("location_type").notNull().default("custom_area"),
    name: text("name").notNull(),
    address: text("address"),
    radiusMiles: numeric("radius_miles", { precision: 6, scale: 2 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("market_capture_locations_campaign_idx").on(t.campaignId, t.locationType),
  }),
);

export const marketCaptureChecklists = pgTable(
  "market_capture_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    owner: text("owner").notNull().default("jason"),
    status: text("status").notNull().default("open"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    completionHistory: jsonb("completion_history").$type<Record<string, unknown>[]>().notNull().default([]),
    itemOrder: integer("item_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("market_capture_checklists_campaign_idx").on(t.campaignId, t.status, t.itemOrder),
  }),
);

export const marketCaptureApprovals = pgTable(
  "market_capture_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    approvalType: text("approval_type").notNull().default("creative"),
    status: text("status").notNull().default("awaiting_approval"),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    contentSummary: text("content_summary"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    notes: text("notes"),
    revisionNotes: text("revision_notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("market_capture_approvals_campaign_idx").on(t.campaignId, t.status, t.requestedAt),
  }),
);

export const marketCaptureReports = pgTable(
  "market_capture_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    reportingPeriodStart: date("reporting_period_start"),
    reportingPeriodEnd: date("reporting_period_end"),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    ctr: numeric("ctr", { precision: 8, scale: 4 }).notNull().default("0"),
    spend: integer("spend").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    calls: integer("calls").notNull().default(0),
    landingPageVisits: integer("landing_page_visits").notNull().default(0),
    qrScans: integer("qr_scans").notNull().default(0),
    directMailQuantity: integer("direct_mail_quantity").notNull().default(0),
    notes: text("notes"),
    recommendations: text("recommendations"),
    createdBy: text("created_by").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("market_capture_reports_campaign_idx").on(t.campaignId, t.reportingPeriodEnd),
  }),
);

export const marketCaptureLaunchReadiness = pgTable(
  "market_capture_launch_readiness",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    readinessScore: integer("readiness_score").notNull().default(0),
    paymentReady: boolean("payment_ready").notNull().default(false),
    targetAreaReady: boolean("target_area_ready").notNull().default(false),
    assetsReady: boolean("assets_ready").notNull().default(false),
    creativeReady: boolean("creative_ready").notNull().default(false),
    approvalReady: boolean("approval_ready").notNull().default(false),
    trackingReady: boolean("tracking_ready").notNull().default(false),
    checklistReady: boolean("checklist_ready").notNull().default(false),
    missingItems: jsonb("missing_items").$type<string[]>().notNull().default([]),
    recommendedNextAction: text("recommended_next_action").notNull().default("Review intake and validate target area"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("market_capture_readiness_campaign_idx").on(t.campaignId, t.readinessScore),
  }),
);

export type MarketCaptureLead = typeof marketCaptureLeads.$inferSelect;
export type NewMarketCaptureLead = typeof marketCaptureLeads.$inferInsert;
export type MarketCapturePipeline = typeof marketCapturePipeline.$inferSelect;
export type NewMarketCapturePipeline = typeof marketCapturePipeline.$inferInsert;
export type MarketCaptureTask = typeof marketCaptureTasks.$inferSelect;
export type NewMarketCaptureTask = typeof marketCaptureTasks.$inferInsert;
export type MarketCaptureAsset = typeof marketCaptureAssets.$inferSelect;
export type NewMarketCaptureAsset = typeof marketCaptureAssets.$inferInsert;
export type MarketCaptureNote = typeof marketCaptureNotes.$inferSelect;
export type NewMarketCaptureNote = typeof marketCaptureNotes.$inferInsert;
export type MarketCaptureDraft = typeof marketCaptureDrafts.$inferSelect;
export type NewMarketCaptureDraft = typeof marketCaptureDrafts.$inferInsert;
export type MarketCaptureCampaign = typeof marketCaptureCampaigns.$inferSelect;
export type NewMarketCaptureCampaign = typeof marketCaptureCampaigns.$inferInsert;
export type MarketCaptureCampaignLocation = typeof marketCaptureCampaignLocations.$inferSelect;
export type NewMarketCaptureCampaignLocation = typeof marketCaptureCampaignLocations.$inferInsert;
export type MarketCaptureChecklist = typeof marketCaptureChecklists.$inferSelect;
export type NewMarketCaptureChecklist = typeof marketCaptureChecklists.$inferInsert;
export type MarketCaptureApproval = typeof marketCaptureApprovals.$inferSelect;
export type NewMarketCaptureApproval = typeof marketCaptureApprovals.$inferInsert;
export type MarketCaptureReport = typeof marketCaptureReports.$inferSelect;
export type NewMarketCaptureReport = typeof marketCaptureReports.$inferInsert;
export type MarketCaptureLaunchReadiness = typeof marketCaptureLaunchReadiness.$inferSelect;
export type NewMarketCaptureLaunchReadiness = typeof marketCaptureLaunchReadiness.$inferInsert;
