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
import { leads } from "./leads.js";
import { digitalTargetingCampaigns } from "./digitalTargeting.js";
import { marketCaptureCampaigns } from "./marketCapture.js";
import { profiles } from "./users.js";

export const campaignDrafts = pgTable(
  "campaign_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    platform: text("platform").notNull(),
    draftType: text("draft_type").notNull(),
    name: text("name").notNull(),
    objective: text("objective"),
    status: text("status").notNull().default("draft_created"),
    summary: text("summary"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("ad_tech_integration_layer"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_drafts_campaign_idx").on(table.marketCaptureCampaignId, table.platform, table.status, table.updatedAt),
    clientIdx: index("campaign_drafts_client_idx").on(table.clientId, table.status, table.updatedAt),
  }),
);

export const campaignGeocodes = pgTable(
  "campaign_geocodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    locationId: uuid("location_id"),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    locationType: text("location_type").notNull().default("custom_area"),
    inputAddress: text("input_address"),
    normalizedAddress: text("normalized_address"),
    placeId: text("place_id"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    radiusMiles: numeric("radius_miles", { precision: 6, scale: 2 }),
    validationStatus: text("validation_status").notNull().default("warning"),
    validationMessage: text("validation_message"),
    provider: text("provider").notNull().default("manual_validation"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by").notNull().default("ad_tech_integration_layer"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_geocodes_campaign_idx").on(table.marketCaptureCampaignId, table.validationStatus, table.updatedAt),
  }),
);

export const campaignTargetValidation = pgTable(
  "campaign_target_validation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    geocodeId: uuid("geocode_id").references(() => campaignGeocodes.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    targetLabel: text("target_label").notNull(),
    targetType: text("target_type").notNull().default("custom_area"),
    status: text("status").notNull().default("warning"),
    addressExists: boolean("address_exists").notNull().default(false),
    zipExists: boolean("zip_exists").notNull().default(false),
    geographyValid: boolean("geography_valid").notNull().default(false),
    radiusReasonable: boolean("radius_reasonable").notNull().default(true),
    duplicateLocation: boolean("duplicate_location").notNull().default(false),
    linkedToCampaign: boolean("linked_to_campaign").notNull().default(true),
    warnings: text("warnings").array().notNull().default([]),
    errors: text("errors").array().notNull().default([]),
    recommendedAction: text("recommended_action"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_target_validation_campaign_idx").on(table.marketCaptureCampaignId, table.status, table.updatedAt),
  }),
);

export const campaignLaunchPackages = pgTable(
  "campaign_launch_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    packageName: text("package_name").notNull(),
    packageStatus: text("package_status").notNull().default("draft_created"),
    campaignSummary: text("campaign_summary").notNull(),
    targetAreas: jsonb("target_areas").$type<Record<string, unknown>[]>().notNull().default([]),
    budgetSummary: jsonb("budget_summary").$type<Record<string, unknown>>().notNull().default({}),
    creativeSummary: jsonb("creative_summary").$type<Record<string, unknown>>().notNull().default({}),
    trackingUrls: jsonb("tracking_urls").$type<Record<string, unknown>[]>().notNull().default([]),
    landingPageUrl: text("landing_page_url"),
    launchChecklist: jsonb("launch_checklist").$type<Record<string, unknown>[]>().notNull().default([]),
    missingItems: text("missing_items").array().notNull().default([]),
    readinessScore: integer("readiness_score").notNull().default(0),
    readyStatus: text("ready_status").notNull().default("not_ready"),
    recommendedNextAction: text("recommended_next_action"),
    clientApprovalStatus: text("client_approval_status").notNull().default("awaiting_approval"),
    adminApprovalStatus: text("admin_approval_status").notNull().default("needs_review"),
    approvedForLaunchBy: text("approved_for_launch_by"),
    approvedForLaunchAt: timestamp("approved_for_launch_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_launch_packages_campaign_idx").on(table.marketCaptureCampaignId, table.packageStatus, table.readinessScore, table.updatedAt),
  }),
);

export const campaignApprovals = pgTable(
  "campaign_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    launchPackageId: uuid("launch_package_id").references(() => campaignLaunchPackages.id, { onDelete: "cascade" }),
    campaignDraftId: uuid("campaign_draft_id").references(() => campaignDrafts.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    approvalType: text("approval_type").notNull(),
    status: text("status").notNull().default("awaiting_approval"),
    requestedBy: text("requested_by").notNull().default("ad_tech_integration_layer"),
    approverUserId: uuid("approver_user_id").references(() => profiles.id, { onDelete: "set null" }),
    approverName: text("approver_name"),
    approverEmail: text("approver_email"),
    notes: text("notes"),
    revisionNotes: text("revision_notes"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_approvals_campaign_idx").on(table.marketCaptureCampaignId, table.approvalType, table.status, table.updatedAt),
  }),
);

export const campaignLaunchHistory = pgTable(
  "campaign_launch_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    launchPackageId: uuid("launch_package_id").references(() => campaignLaunchPackages.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    eventType: text("event_type").notNull().default("manual_launch_note"),
    platform: text("platform").notNull().default("manual"),
    status: text("status").notNull().default("recorded"),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    summary: text("summary").notNull(),
    budgetSnapshot: jsonb("budget_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    creativeSnapshot: jsonb("creative_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    targetAreaSnapshot: jsonb("target_area_snapshot").$type<Record<string, unknown>[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_launch_history_campaign_idx").on(table.marketCaptureCampaignId, table.createdAt),
  }),
);

export const campaignReportingImports = pgTable(
  "campaign_reporting_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    source: text("source").notNull().default("manual"),
    platform: text("platform").notNull().default("manual"),
    reportingPeriodStart: date("reporting_period_start"),
    reportingPeriodEnd: date("reporting_period_end"),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    ctr: numeric("ctr", { precision: 8, scale: 4 }).notNull().default("0"),
    spend: integer("spend").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    calls: integer("calls").notNull().default(0),
    forms: integer("forms").notNull().default(0),
    landingPageVisits: integer("landing_page_visits").notNull().default(0),
    qrScans: integer("qr_scans").notNull().default(0),
    costPerClick: integer("cost_per_click").notNull().default(0),
    costPerLead: integer("cost_per_lead").notNull().default(0),
    campaignNotes: text("campaign_notes"),
    recommendations: text("recommendations"),
    importStatus: text("import_status").notNull().default("manual_entry"),
    importedBy: text("imported_by").notNull().default("admin"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_reporting_imports_campaign_idx").on(table.marketCaptureCampaignId, table.reportingPeriodEnd, table.platform),
  }),
);

export const campaignAttribution = pgTable(
  "campaign_attribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketCaptureCampaignId: uuid("market_capture_campaign_id").references(() => marketCaptureCampaigns.id, { onDelete: "cascade" }),
    digitalTargetingCampaignId: uuid("digital_targeting_campaign_id").references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
    reportingImportId: uuid("reporting_import_id").references(() => campaignReportingImports.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
    clientEmail: text("client_email"),
    source: text("source").notNull().default("manual"),
    medium: text("medium"),
    landingPageUrl: text("landing_page_url"),
    qrScanId: text("qr_scan_id"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    callReference: text("call_reference"),
    formReference: text("form_reference"),
    conversionType: text("conversion_type"),
    conversionNotes: text("conversion_notes"),
    confidence: text("confidence").notNull().default("observed"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    campaignIdx: index("campaign_attribution_campaign_idx").on(table.marketCaptureCampaignId, table.source, table.createdAt),
  }),
);

export const integrationHealth = pgTable(
  "integration_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationKey: text("integration_key").notNull(),
    integrationName: text("integration_name").notNull(),
    status: text("status").notNull().default("not_configured"),
    apiKeyStatus: text("api_key_status").notNull().default("missing"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    warnings: text("warnings").array().notNull().default([]),
    errors: text("errors").array().notNull().default([]),
    featureFlagStatus: jsonb("feature_flag_status").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyUnique: uniqueIndex("integration_health_integration_key_key").on(table.integrationKey),
    statusIdx: index("integration_health_status_idx").on(table.status, table.updatedAt),
  }),
);

export type CampaignDraft = typeof campaignDrafts.$inferSelect;
export type CampaignLaunchPackage = typeof campaignLaunchPackages.$inferSelect;
export type CampaignApproval = typeof campaignApprovals.$inferSelect;
export type CampaignReportingImport = typeof campaignReportingImports.$inferSelect;
export type CampaignAttribution = typeof campaignAttribution.$inferSelect;
export type IntegrationHealth = typeof integrationHealth.$inferSelect;
