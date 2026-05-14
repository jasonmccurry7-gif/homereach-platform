import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  date,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";

const geometry = customType<{ data: string | null; driverData: string | null }>({
  dataType() {
    return "extensions.geometry(Geometry, 4326)";
  },
});

export const mapDataConfidenceEnum = pgEnum("map_data_confidence_enum", [
  "exact",
  "estimated",
  "demo_sample",
  "user_provided",
  "public_aggregate",
  "paid_vendor_data",
  "unavailable",
]);

export const mapRequirementPriorityEnum = pgEnum("map_requirement_priority_enum", [
  "mvp",
  "phase_2",
  "phase_3",
]);

export const mapPlanStatusEnum = pgEnum("map_plan_status_enum", [
  "draft",
  "saved",
  "proposal_ready",
  "proposal_sent",
  "approved",
  "paid",
  "production",
  "archived",
]);

export const mapDataSources = pgTable(
  "map_data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceKey: text("source_key").notNull().unique(),
    sourceName: text("source_name").notNull(),
    category: text("category").notNull(),
    provider: text("provider"),
    sourceType: text("source_type").notNull(),
    expectedFormat: text("expected_format"),
    geographicCoverage: text("geographic_coverage"),
    updateFrequency: text("update_frequency"),
    licensingNotes: text("licensing_notes"),
    costEstimate: text("cost_estimate"),
    implementationDifficulty: text("implementation_difficulty"),
    priority: mapRequirementPriorityEnum("priority").notNull().default("mvp"),
    requiredForMvp: boolean("required_for_mvp").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
    homepageUrl: text("homepage_url"),
    termsUrl: text("terms_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("map_data_sources_category_idx").on(t.category),
    priorityIdx: index("map_data_sources_priority_idx").on(t.priority),
  }),
);

export const mapLayerSources = pgTable(
  "map_layer_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    layerKey: text("layer_key").notNull(),
    mapType: text("map_type").notNull(),
    sourceId: uuid("source_id").references(() => mapDataSources.id, { onDelete: "set null" }),
    sourceStatus: text("source_status").notNull().default("needed"),
    confidence: mapDataConfidenceEnum("confidence").notNull().default("unavailable"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    layerSourceIdx: uniqueIndex("map_layer_sources_layer_source_idx").on(t.layerKey, t.mapType, t.sourceId),
  }),
);

export const mapSourceRequirements = pgTable("map_source_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementKey: text("requirement_key").notNull().unique(),
  requirementName: text("requirement_name").notNull(),
  category: text("category").notNull(),
  priority: mapRequirementPriorityEnum("priority").notNull().default("mvp"),
  status: text("status").notNull().default("needed"),
  candidateSources: jsonb("candidate_sources").notNull().$type<unknown[]>().default([]),
  requiredFor: text("required_for").array().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const politicalMapLayers = pgTable("political_map_layers", {
  id: uuid("id").primaryKey().defaultRandom(),
  layerKey: text("layer_key").notNull().unique(),
  label: text("label").notNull(),
  groupName: text("group_name").notNull(),
  geographyType: text("geography_type"),
  defaultEnabled: boolean("default_enabled").notNull().default(false),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  sourceId: uuid("source_id").references(() => mapDataSources.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  complianceNotes: text("compliance_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uspsMapLayers = pgTable("usps_map_layers", {
  id: uuid("id").primaryKey().defaultRandom(),
  layerKey: text("layer_key").notNull().unique(),
  label: text("label").notNull(),
  groupName: text("group_name").notNull(),
  geographyType: text("geography_type"),
  defaultEnabled: boolean("default_enabled").notNull().default(false),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  sourceId: uuid("source_id").references(() => mapDataSources.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  logisticsNotes: text("logistics_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const politicalGeographies = pgTable(
  "political_geographies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    geographyKey: text("geography_key").notNull().unique(),
    state: text("state").notNull(),
    geographyType: text("geography_type").notNull(),
    name: text("name").notNull(),
    geoid: text("geoid"),
    parentGeographyKey: text("parent_geography_key"),
    geom: geometry("geom"),
    boundaryGeojson: jsonb("boundary_geojson"),
    centroidGeojson: jsonb("centroid_geojson"),
    aggregateMetrics: jsonb("aggregate_metrics").notNull().$type<Record<string, unknown>>().default({}),
    partyAdvantage: text("party_advantage"),
    advantageIntensity: text("advantage_intensity"),
    dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
    sourceId: uuid("source_id").references(() => mapDataSources.id, { onDelete: "set null" }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stateTypeIdx: index("political_geographies_state_type_idx").on(t.state, t.geographyType),
    geoidIdx: index("political_geographies_geoid_idx").on(t.geoid),
  }),
);

export const uspsGeographies = pgTable(
  "usps_geographies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    geographyKey: text("geography_key").notNull().unique(),
    state: text("state").notNull(),
    zip5: text("zip5"),
    zip4: text("zip4"),
    carrierRouteId: text("carrier_route_id"),
    routeType: text("route_type"),
    name: text("name"),
    geom: geometry("geom"),
    boundaryGeojson: jsonb("boundary_geojson"),
    centroidGeojson: jsonb("centroid_geojson"),
    residentialCount: integer("residential_count"),
    businessCount: integer("business_count"),
    poBoxCount: integer("po_box_count"),
    vacantCount: integer("vacant_count"),
    nonDeliverableCount: integer("non_deliverable_count"),
    totalDeliveryPoints: integer("total_delivery_points"),
    eddmEligible: boolean("eddm_eligible"),
    saturationEligible: boolean("saturation_eligible"),
    dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
    sourceId: uuid("source_id").references(() => mapDataSources.id, { onDelete: "set null" }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stateZipIdx: index("usps_geographies_state_zip_idx").on(t.state, t.zip5),
    routeIdx: index("usps_geographies_route_idx").on(t.carrierRouteId),
  }),
);

export const mapSelectionSessions = pgTable("map_selection_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicSessionId: text("public_session_id"),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  campaignId: uuid("campaign_id"),
  outreachLeadId: uuid("outreach_lead_id"),
  state: text("state"),
  status: text("status").notNull().default("active"),
  selectedLayers: jsonb("selected_layers").notNull().$type<Record<string, unknown>>().default({}),
  planningObject: jsonb("planning_object").notNull().$type<Record<string, unknown>>().default({}),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMapPlans = pgTable(
  "campaign_map_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id"),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => mapSelectionSessions.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id"),
    planName: text("plan_name").notNull().default("Campaign Map Plan"),
    campaignName: text("campaign_name"),
    candidateName: text("candidate_name"),
    officeSought: text("office_sought"),
    electionDate: date("election_date"),
    state: text("state"),
    selectedMapType: text("selected_map_type"),
    selectedLayers: jsonb("selected_layers").notNull().$type<Record<string, unknown>>().default({}),
    selectedPolygons: jsonb("selected_polygons").notNull().$type<unknown[]>().default([]),
    totalHouseholds: integer("total_households").notNull().default(0),
    totalDeliveryPoints: integer("total_delivery_points").notNull().default(0),
    totalEstimatedPostcards: integer("total_estimated_postcards").notNull().default(0),
    estimatedPrintCostCents: bigint("estimated_print_cost_cents", { mode: "number" }).notNull().default(0),
    estimatedPostageCents: bigint("estimated_postage_cents", { mode: "number" }).notNull().default(0),
    estimatedTotalCostCents: bigint("estimated_total_cost_cents", { mode: "number" }).notNull().default(0),
    estimatedGrossMarginCents: bigint("estimated_gross_margin_cents", { mode: "number" }).notNull().default(0),
    selectedNumberOfDrops: integer("selected_number_of_drops").notNull().default(1),
    selectedSchedule: jsonb("selected_schedule").notNull().$type<unknown[]>().default([]),
    proposalStatus: text("proposal_status"),
    paymentStatus: text("payment_status"),
    dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
    sourceLabels: text("source_labels").array().notNull().default([]),
    campaignHealthScore: integer("campaign_health_score").notNull().default(0),
    campaignHealthTone: text("campaign_health_tone"),
    aiRecommendations: jsonb("ai_recommendations").notNull().$type<unknown[]>().default([]),
    operationalAlerts: jsonb("operational_alerts").notNull().$type<unknown[]>().default([]),
    timelineSnapshot: jsonb("timeline_snapshot").notNull().$type<unknown[]>().default([]),
    status: mapPlanStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    campaignIdx: index("campaign_map_plans_campaign_idx").on(t.campaignId),
    statusIdx: index("campaign_map_plans_status_idx").on(t.status),
  }),
);

export const campaignSelectedGeographies = pgTable("campaign_selected_geographies", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  politicalGeographyId: uuid("political_geography_id").references(() => politicalGeographies.id, { onDelete: "set null" }),
  geographyKey: text("geography_key").notNull(),
  geographyType: text("geography_type").notNull(),
  label: text("label").notNull(),
  overlapPercentage: numeric("overlap_percentage", { precision: 6, scale: 3 }),
  householdCount: integer("household_count"),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  sourceLabel: text("source_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignSelectedUspsRoutes = pgTable("campaign_selected_usps_routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  uspsGeographyId: uuid("usps_geography_id").references(() => uspsGeographies.id, { onDelete: "set null" }),
  routeKey: text("route_key").notNull(),
  zip5: text("zip5"),
  carrierRouteId: text("carrier_route_id"),
  label: text("label").notNull(),
  overlapPercentage: numeric("overlap_percentage", { precision: 6, scale: 3 }),
  deliverableAddressCount: integer("deliverable_address_count"),
  residentialCount: integer("residential_count"),
  businessCount: integer("business_count"),
  estimatedPostageCents: bigint("estimated_postage_cents", { mode: "number" }),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  sourceLabel: text("source_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignCostEstimates = pgTable("campaign_cost_estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  estimateType: text("estimate_type").notNull().default("planner"),
  households: integer("households").notNull().default(0),
  deliveryPoints: integer("delivery_points").notNull().default(0),
  printQuantity: integer("print_quantity").notNull().default(0),
  printCostCents: bigint("print_cost_cents", { mode: "number" }).notNull().default(0),
  postageCents: bigint("postage_cents", { mode: "number" }).notNull().default(0),
  serviceCostCents: bigint("service_cost_cents", { mode: "number" }).notNull().default(0),
  totalPriceCents: bigint("total_price_cents", { mode: "number" }).notNull().default(0),
  grossMarginCents: bigint("gross_margin_cents", { mode: "number" }).notNull().default(0),
  costInputs: jsonb("cost_inputs").notNull().$type<Record<string, unknown>>().default({}),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignOverlapCalculations = pgTable("campaign_overlap_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  politicalGeographyId: uuid("political_geography_id").references(() => politicalGeographies.id, { onDelete: "set null" }),
  uspsGeographyId: uuid("usps_geography_id").references(() => uspsGeographies.id, { onDelete: "set null" }),
  politicalGeographyKey: text("political_geography_key"),
  uspsGeographyKey: text("usps_geography_key"),
  overlapPercentage: numeric("overlap_percentage", { precision: 6, scale: 3 }),
  overlapMethod: text("overlap_method").notNull().default("unknown"),
  householdCount: integer("household_count"),
  deliveryPointCount: integer("delivery_point_count"),
  calculationSnapshot: jsonb("calculation_snapshot").notNull().$type<Record<string, unknown>>().default({}),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMapExports = pgTable("campaign_map_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  exportType: text("export_type").notNull(),
  status: text("status").notNull().default("queued"),
  storagePath: text("storage_path"),
  publicUrl: text("public_url"),
  errorMessage: text("error_message"),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMapEvents = pgTable("campaign_map_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => mapSelectionSessions.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  eventPayload: jsonb("event_payload").notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMapAuditLog = pgTable("campaign_map_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => mapSelectionSessions.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignDataQualityFlags = pgTable("campaign_data_quality_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").references(() => campaignMapPlans.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => mapSelectionSessions.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").references(() => mapDataSources.id, { onDelete: "set null" }),
  flagKey: text("flag_key").notNull(),
  severity: text("severity").notNull(),
  dataConfidence: mapDataConfidenceEnum("data_confidence").notNull().default("unavailable"),
  message: text("message").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignMapApiRequirements = pgTable("campaign_map_api_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementKey: text("requirement_key").notNull().unique(),
  sourceName: text("source_name").notNull(),
  dataProvided: text("data_provided").notNull(),
  acquisitionType: text("acquisition_type").notNull(),
  expectedFormat: text("expected_format"),
  geographicCoverage: text("geographic_coverage"),
  updateFrequency: text("update_frequency"),
  licensingNotes: text("licensing_notes"),
  costEstimate: text("cost_estimate"),
  implementationDifficulty: text("implementation_difficulty"),
  priority: mapRequirementPriorityEnum("priority").notNull().default("mvp"),
  requiredForMvp: boolean("required_for_mvp").notNull().default(false),
  status: text("status").notNull().default("needed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CampaignMapPlan = typeof campaignMapPlans.$inferSelect;
export type CampaignMapPlanInsert = typeof campaignMapPlans.$inferInsert;
export type PoliticalGeography = typeof politicalGeographies.$inferSelect;
export type UspsGeography = typeof uspsGeographies.$inferSelect;
