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
import { businesses } from "./businesses.js";
import { profiles } from "./users.js";
import { salesLeads } from "./sales.js";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const stormEvents = pgTable(
  "storm_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    severityScore: integer("severity_score").notNull().default(0),
    severityLevel: text("severity_level").notNull().default("Low"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    geographyType: text("geography_type").notNull().default("alert_polygon"),
    impactedPolygonGeojson: jsonb("impacted_polygon_geojson").$type<Record<string, unknown>>().notNull().default({}),
    impactedCounties: text("impacted_counties").array().notNull().default([]),
    impactedCities: text("impacted_cities").array().notNull().default([]),
    impactedZipCodes: text("impacted_zip_codes").array().notNull().default([]),
    impactedState: text("impacted_state"),
    estimatedHouseholds: integer("estimated_households").notNull().default(0),
    estimatedHomeowners: integer("estimated_homeowners").notNull().default(0),
    recommendedIndustries: text("recommended_industries").array().notNull().default([]),
    recommendedCampaigns: jsonb("recommended_campaigns").$type<Record<string, unknown>[]>().notNull().default([]),
    status: text("status").notNull().default("detected"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    sourcePayload: jsonb("source_payload").$type<Record<string, unknown>>().notNull().default({}),
    scoringFactors: jsonb("scoring_factors").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdIdx: uniqueIndex("storm_events_event_id_uidx").on(t.eventId),
    statusIdx: index("storm_events_status_idx").on(t.status, t.severityScore, t.detectedAt),
    typeStateIdx: index("storm_events_type_state_idx").on(t.eventType, t.impactedState, t.detectedAt),
  }),
);

export const stormEventGeographies = pgTable(
  "storm_event_geographies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    geographyType: text("geography_type").notNull().default("area"),
    label: text("label").notNull(),
    state: text("state"),
    county: text("county"),
    city: text("city"),
    zipCode: text("zip_code"),
    centroidLat: numeric("centroid_lat", { precision: 10, scale: 7 }),
    centroidLng: numeric("centroid_lng", { precision: 10, scale: 7 }),
    polygonGeojson: jsonb("polygon_geojson").$type<Record<string, unknown>>().notNull().default({}),
    estimatedHouseholds: integer("estimated_households").notNull().default(0),
    estimatedHomeowners: integer("estimated_homeowners").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_event_geographies_event_idx").on(t.stormEventId, t.geographyType),
  }),
);

export const stormEventZipCodes = pgTable(
  "storm_event_zip_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    zipCode: text("zip_code").notNull(),
    state: text("state"),
    city: text("city"),
    county: text("county"),
    estimatedHouseholds: integer("estimated_households").notNull().default(0),
    estimatedHomeowners: integer("estimated_homeowners").notNull().default(0),
    medianHomeValueCents: integer("median_home_value_cents"),
    damageLikelihoodScore: integer("damage_likelihood_score").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventZipIdx: uniqueIndex("storm_event_zip_codes_event_zip_uidx").on(t.stormEventId, t.zipCode),
    eventIdx: index("storm_event_zip_codes_event_idx").on(t.stormEventId, t.damageLikelihoodScore),
  }),
);

export const stormEventIndustryMatches = pgTable(
  "storm_event_industry_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    industry: text("industry").notNull(),
    matchScore: integer("match_score").notNull().default(50),
    reason: text("reason").notNull().default(""),
    adminOverride: boolean("admin_override").notNull().default(false),
    status: text("status").notNull().default("recommended"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIndustryIdx: uniqueIndex("storm_event_industry_matches_event_industry_uidx").on(t.stormEventId, t.industry),
    eventIdx: index("storm_industry_matches_event_idx").on(t.stormEventId, t.matchScore),
  }),
);

export const stormBusinessProspects = pgTable(
  "storm_business_prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    sourceBusinessId: uuid("source_business_id").references(() => businesses.id, { onDelete: "set null" }),
    sourceSalesLeadId: uuid("source_sales_lead_id").references(() => salesLeads.id, { onDelete: "set null" }),
    sourceOutreachProspectId: uuid("source_outreach_prospect_id"),
    businessName: text("business_name").notNull(),
    ownerName: text("owner_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    city: text("city"),
    state: text("state"),
    category: text("category").notNull(),
    source: text("source").notNull().default("homereach_existing_records"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    distanceToEvent: numeric("distance_to_event", { precision: 8, scale: 2 }),
    priorContactStatus: text("prior_contact_status"),
    crmStatus: text("crm_status").notNull().default("new"),
    suppressionStatus: text("suppression_status").notNull().default("unchecked"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_business_prospects_event_idx").on(t.stormEventId, t.category, t.confidenceScore),
    statusIdx: index("storm_business_prospects_status_idx").on(t.crmStatus, t.suppressionStatus, t.updatedAt),
  }),
);

export const stormMarketingPackages = pgTable(
  "storm_marketing_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    industry: text("industry").notNull(),
    packageName: text("package_name").notNull(),
    packageType: text("package_type").notNull(),
    status: text("status").notNull().default("draft"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    clientApprovalStatus: text("client_approval_status").notNull().default("not_sent"),
    eventSummary: text("event_summary").notNull().default(""),
    impactedAreaMap: jsonb("impacted_area_map").$type<Record<string, unknown>>().notNull().default({}),
    estimatedHouseholds: integer("estimated_households").notNull().default(0),
    recommendedGeofenceRadiusMiles: numeric("recommended_geofence_radius_miles", { precision: 6, scale: 2 }).notNull().default("5"),
    recommendedPostcardQuantity: integer("recommended_postcard_quantity").notNull().default(0),
    suggestedTimeline: text("suggested_timeline").notNull().default(""),
    suggestedBudgetCents: integer("suggested_budget_cents").notNull().default(0),
    estimatedPriceToClientCents: integer("estimated_price_to_client_cents").notNull().default(0),
    revenueEstimateCents: integer("revenue_estimate_cents").notNull().default(0),
    emailDraft: text("email_draft").notNull().default(""),
    smsDraft: text("sms_draft").notNull().default(""),
    landingPageCopy: text("landing_page_copy").notNull().default(""),
    postcardCopy: text("postcard_copy").notNull().default(""),
    adCopy: text("ad_copy").notNull().default(""),
    proposalToken: text("proposal_token").notNull(),
    proposalSentAt: timestamp("proposal_sent_at", { withTimezone: true }),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_marketing_packages_event_idx").on(t.stormEventId, t.packageType, t.status, t.updatedAt),
    tokenIdx: uniqueIndex("storm_marketing_packages_token_uidx").on(t.proposalToken),
  }),
);

export const stormOutreachCampaigns = pgTable(
  "storm_outreach_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    marketingPackageId: uuid("marketing_package_id").references(() => stormMarketingPackages.id, { onDelete: "set null" }),
    industry: text("industry").notNull(),
    senderKey: text("sender_key").notNull().default("jason"),
    campaignName: text("campaign_name").notNull(),
    status: text("status").notNull().default("draft"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    subjectBase: text("subject_base").notNull().default(""),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_outreach_campaigns_event_idx").on(t.stormEventId, t.status, t.updatedAt),
  }),
);

export const stormOutreachMessages = pgTable(
  "storm_outreach_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outreachCampaignId: uuid("outreach_campaign_id").notNull().references(() => stormOutreachCampaigns.id, { onDelete: "cascade" }),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    prospectId: uuid("prospect_id").references(() => stormBusinessProspects.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("email"),
    senderKey: text("sender_key").notNull().default("jason"),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    subject: text("subject"),
    body: text("body").notNull().default(""),
    variantKey: text("variant_key").notNull().default("a"),
    status: text("status").notNull().default("draft"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    suppressionStatus: text("suppression_status").notNull().default("unchecked"),
    providerMessageId: text("provider_message_id"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    campaignIdx: index("storm_outreach_messages_campaign_idx").on(t.outreachCampaignId, t.status, t.updatedAt),
  }),
);

export const stormGeofenceCampaigns = pgTable(
  "storm_geofence_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    marketingPackageId: uuid("marketing_package_id").references(() => stormMarketingPackages.id, { onDelete: "set null" }),
    clientBusinessName: text("client_business_name"),
    industry: text("industry").notNull(),
    status: text("status").notNull().default("draft"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    polygonGeojson: jsonb("polygon_geojson").$type<Record<string, unknown>>().notNull().default({}),
    selectedZipCodes: text("selected_zip_codes").array().notNull().default([]),
    radiusMiles: numeric("radius_miles", { precision: 6, scale: 2 }).notNull().default("5"),
    excludedAreasGeojson: jsonb("excluded_areas_geojson").$type<Record<string, unknown>[]>().notNull().default([]),
    estimatedAudienceSize: integer("estimated_audience_size").notNull().default(0),
    exportGeojson: jsonb("export_geojson").$type<Record<string, unknown>>().notNull().default({}),
    exportZipCsv: text("export_zip_csv").notNull().default(""),
    campaignBrief: text("campaign_brief").notNull().default(""),
    externalPlatformStatus: text("external_platform_status").notNull().default("not_started"),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_geofence_campaigns_event_idx").on(t.stormEventId, t.status, t.updatedAt),
  }),
);

export const stormPostcardCampaigns = pgTable(
  "storm_postcard_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    marketingPackageId: uuid("marketing_package_id").references(() => stormMarketingPackages.id, { onDelete: "set null" }),
    clientBusinessName: text("client_business_name"),
    industry: text("industry").notNull(),
    offer: text("offer"),
    cta: text("cta"),
    qrCodeUrl: text("qr_code_url"),
    landingPageUrl: text("landing_page_url"),
    headline: text("headline").notNull().default(""),
    body: text("body").notNull().default(""),
    imageDirection: text("image_direction").notNull().default(""),
    mailQuantity: integer("mail_quantity").notNull().default(0),
    estimatedPrintPostageCostCents: integer("estimated_print_postage_cost_cents").notNull().default(0),
    estimatedPriceToClientCents: integer("estimated_price_to_client_cents").notNull().default(0),
    campaignTimeline: text("campaign_timeline").notNull().default(""),
    status: text("status").notNull().default("draft"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_postcard_campaigns_event_idx").on(t.stormEventId, t.status, t.updatedAt),
  }),
);

export const stormAgentImprovements = pgTable(
  "storm_agent_improvements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").references(() => stormEvents.id, { onDelete: "set null" }),
    recommendationType: text("recommendation_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    source: text("source").notNull().default("stormreach_strategist"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    recommendedBy: text("recommended_by").notNull().default("StormReach Strategist"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    statusIdx: index("storm_agent_improvements_status_idx").on(t.status, t.priority, t.createdAt),
  }),
);

export const stormSystemMetrics = pgTable(
  "storm_system_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    metricDate: date("metric_date").notNull().defaultNow(),
    period: text("period").notNull().default("daily"),
    eventsDetected: integer("events_detected").notNull().default(0),
    highValueEvents: integer("high_value_events").notNull().default(0),
    prospectsGenerated: integer("prospects_generated").notNull().default(0),
    emailsDrafted: integer("emails_drafted").notNull().default(0),
    emailsApproved: integer("emails_approved").notNull().default(0),
    emailsSent: integer("emails_sent").notNull().default(0),
    opens: integer("opens").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    bookedCalls: integer("booked_calls").notNull().default(0),
    campaignsSold: integer("campaigns_sold").notNull().default(0),
    geofenceCampaignsLaunched: integer("geofence_campaigns_launched").notNull().default(0),
    postcardsSold: integer("postcards_sold").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt,
    updatedAt,
  },
  (t) => ({
    datePeriodIdx: uniqueIndex("storm_system_metrics_date_period_uidx").on(t.metricDate, t.period),
  }),
);

export const stormSuppressionMatches = pgTable(
  "storm_suppression_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").references(() => stormEvents.id, { onDelete: "cascade" }),
    prospectId: uuid("prospect_id").references(() => stormBusinessProspects.id, { onDelete: "cascade" }),
    outreachMessageId: uuid("outreach_message_id").references(() => stormOutreachMessages.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("email"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    suppressionSource: text("suppression_source").notNull().default("outreach_suppression_list"),
    reason: text("reason").notNull().default(""),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt,
  },
  (t) => ({
    eventIdx: index("storm_suppression_matches_event_idx").on(t.stormEventId, t.active, t.createdAt),
  }),
);

export const stormProviderRuns = pgTable(
  "storm_provider_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerKey: text("provider_key").notNull(),
    runType: text("run_type").notNull().default("ingest"),
    status: text("status").notNull().default("started"),
    eventsSeen: integer("events_seen").notNull().default(0),
    eventsUpserted: integer("events_upserted").notNull().default(0),
    errors: text("errors").array().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    providerIdx: index("storm_provider_runs_provider_idx").on(t.providerKey, t.status, t.startedAt),
  }),
);

export const stormAuditLogs = pgTable(
  "storm_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").references(() => stormEvents.id, { onDelete: "set null" }),
    relatedTable: text("related_table"),
    relatedId: text("related_id"),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    status: text("status").notNull().default("logged"),
    summary: text("summary").notNull().default(""),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    approvalStatus: text("approval_status").notNull().default("not_required"),
    createdAt,
  },
  (t) => ({
    eventIdx: index("storm_audit_logs_event_idx").on(t.stormEventId, t.createdAt),
  }),
);

export const stormGeneratedAssets = pgTable(
  "storm_generated_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    marketingPackageId: uuid("marketing_package_id").references(() => stormMarketingPackages.id, { onDelete: "set null" }),
    assetType: text("asset_type").notNull(),
    title: text("title").notNull(),
    format: text("format").notNull().default("svg"),
    status: text("status").notNull().default("generated"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    storageBucket: text("storage_bucket"),
    storagePath: text("storage_path"),
    publicUrl: text("public_url"),
    contentText: text("content_text").notNull().default(""),
    assetPayload: jsonb("asset_payload").$type<Record<string, unknown>>().notNull().default({}),
    sourceData: jsonb("source_data").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    generatedBy: text("generated_by").notNull().default("StormReach Agent"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_generated_assets_event_status_idx").on(t.stormEventId, t.status, t.createdAt),
    typeIdx: index("storm_generated_assets_type_idx").on(t.assetType, t.approvalStatus, t.createdAt),
  }),
);

export const stormAgentRuns = pgTable(
  "storm_agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runKey: text("run_key").notNull(),
    runType: text("run_type").notNull().default("autopilot_4h"),
    agentName: text("agent_name").notNull().default("StormReach Agent"),
    status: text("status").notNull().default("started"),
    state: text("state"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    eventsSeen: integer("events_seen").notNull().default(0),
    eventsUpserted: integer("events_upserted").notNull().default(0),
    eventsQualified: integer("events_qualified").notNull().default(0),
    prospectsCreated: integer("prospects_created").notNull().default(0),
    outreachDraftsCreated: integer("outreach_drafts_created").notNull().default(0),
    assetsCreated: integer("assets_created").notNull().default(0),
    campaignsCreated: integer("campaigns_created").notNull().default(0),
    errors: text("errors").array().notNull().default([]),
    summary: text("summary").notNull().default(""),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt,
  },
  (t) => ({
    runKeyIdx: uniqueIndex("storm_agent_runs_run_key_uidx").on(t.runKey),
    typeStatusIdx: index("storm_agent_runs_type_status_idx").on(t.runType, t.status, t.startedAt),
    stateIdx: index("storm_agent_runs_state_idx").on(t.state, t.startedAt),
  }),
);

export const stormCampaigns = pgTable(
  "storm_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stormEventId: uuid("storm_event_id").notNull().references(() => stormEvents.id, { onDelete: "cascade" }),
    marketingPackageId: uuid("marketing_package_id").references(() => stormMarketingPackages.id, { onDelete: "set null" }),
    campaignName: text("campaign_name").notNull(),
    campaignType: text("campaign_type").notNull().default("storm_autopilot"),
    status: text("status").notNull().default("draft"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    opportunityLevel: text("opportunity_level").notNull().default("Watch"),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    recommendedMailQuantity: integer("recommended_mail_quantity").notNull().default(0),
    geofenceRadiusMiles: numeric("geofence_radius_miles", { precision: 6, scale: 2 }).notNull().default("25"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    eventIdx: index("storm_campaigns_event_idx").on(t.stormEventId, t.campaignType, t.status),
    statusIdx: index("storm_campaigns_status_idx").on(t.status, t.approvalStatus, t.createdAt),
    levelIdx: index("storm_campaigns_level_idx").on(t.opportunityLevel, t.createdAt),
  }),
);

export type StormEvent = typeof stormEvents.$inferSelect;
export type NewStormEvent = typeof stormEvents.$inferInsert;
export type StormBusinessProspect = typeof stormBusinessProspects.$inferSelect;
export type StormMarketingPackage = typeof stormMarketingPackages.$inferSelect;
export type StormOutreachMessage = typeof stormOutreachMessages.$inferSelect;
export type StormAgentImprovement = typeof stormAgentImprovements.$inferSelect;
export type StormGeneratedAsset = typeof stormGeneratedAssets.$inferSelect;
export type StormAgentRun = typeof stormAgentRuns.$inferSelect;
export type StormCampaign = typeof stormCampaigns.$inferSelect;
