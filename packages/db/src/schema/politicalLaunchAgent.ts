import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { campaignCandidates, politicalCampaigns } from "./political";

export const politicalCandidateAgentStatusEnum = pgEnum(
  "political_candidate_agent_status_enum",
  [
    "idle",
    "researching",
    "research_complete",
    "planning",
    "plan_ready",
    "approved",
    "production_ready",
    "blocked",
    "error",
  ],
);

export const politicalLaunchPlanStatusEnum = pgEnum(
  "political_launch_plan_status_enum",
  [
    "draft",
    "needs_review",
    "approved",
    "proposal_ready",
    "production_ready",
    "archived",
  ],
);

export const politicalCandidateAgents = pgTable(
  "political_candidate_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => campaignCandidates.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => politicalCampaigns.id, {
      onDelete: "set null",
    }),
    agentName: text("agent_name").notNull().default("Candidate Campaign Launch Agent"),
    status: politicalCandidateAgentStatusEnum("status").notNull().default("idle"),
    currentTask: text("current_task"),
    lastAction: text("last_action"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    queueCount: integer("queue_count").notNull().default(0),
    complianceStatus: text("compliance_status").notNull().default("guardrails_active"),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    candidateIdx: index("political_candidate_agents_candidate_idx").on(t.candidateId),
    campaignIdx: index("political_candidate_agents_campaign_idx").on(t.campaignId),
    statusIdx: index("political_candidate_agents_status_idx").on(t.status),
  }),
);

export const politicalCandidateResearch = pgTable(
  "political_candidate_research",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => politicalCandidateAgents.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => campaignCandidates.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => politicalCampaigns.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("complete"),
    candidateSummary: text("candidate_summary").notNull().default(""),
    raceSummary: text("race_summary").notNull().default(""),
    researchJson: jsonb("research_json").$type<Record<string, unknown>>().notNull().default({}),
    missingData: jsonb("missing_data").$type<string[]>().notNull().default([]),
    dataSources: jsonb("data_sources").$type<Array<Record<string, unknown>>>().notNull().default([]),
    confidenceScore: integer("confidence_score").notNull().default(0),
    sourceFreshness: text("source_freshness").notNull().default("unknown"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index("political_candidate_research_agent_idx").on(t.agentId),
    candidateIdx: index("political_candidate_research_candidate_idx").on(t.candidateId),
    generatedAtIdx: index("political_candidate_research_generated_idx").on(t.generatedAt),
  }),
);

export const politicalDistrictIntelligence = pgTable(
  "political_district_intelligence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id").references(() => campaignCandidates.id, {
      onDelete: "cascade",
    }),
    campaignId: uuid("campaign_id").references(() => politicalCampaigns.id, {
      onDelete: "set null",
    }),
    state: text("state").notNull().default("OH"),
    geographyType: text("geography_type").notNull(),
    geographyValue: text("geography_value").notNull(),
    householdEstimate: integer("household_estimate"),
    routeOpportunitySummary: jsonb("route_opportunity_summary")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    publicElectionHistory: jsonb("public_election_history")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    sourceLabels: text("source_labels").array().notNull().default([]),
    dataConfidence: text("data_confidence").notNull().default("estimated"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    geoIdx: index("political_district_intelligence_geo_idx").on(
      t.state,
      t.geographyType,
      t.geographyValue,
    ),
    candidateIdx: index("political_district_intelligence_candidate_idx").on(t.candidateId),
  }),
);

export const politicalMailLaunchPlans = pgTable(
  "political_mail_launch_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => politicalCandidateAgents.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => campaignCandidates.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => politicalCampaigns.id, {
      onDelete: "set null",
    }),
    status: politicalLaunchPlanStatusEnum("status").notNull().default("draft"),
    planName: text("plan_name").notNull().default("Multi-phase postcard launch plan"),
    planJson: jsonb("plan_json").$type<Record<string, unknown>>().notNull().default({}),
    candidateSummary: text("candidate_summary").notNull().default(""),
    recommendedStrategy: text("recommended_strategy").notNull().default(""),
    totalHouseholds: integer("total_households").notNull().default(0),
    totalEstimatedCostCents: bigint("total_estimated_cost_cents", {
      mode: "number",
    })
      .notNull()
      .default(0),
    confidenceScore: integer("confidence_score").notNull().default(0),
    complianceNotes: jsonb("compliance_notes").$type<string[]>().notNull().default([]),
    humanApprovedAt: timestamp("human_approved_at", { withTimezone: true }),
    humanApprovedBy: uuid("human_approved_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index("political_mail_launch_plans_agent_idx").on(t.agentId),
    candidateIdx: index("political_mail_launch_plans_candidate_idx").on(t.candidateId),
    statusIdx: index("political_mail_launch_plans_status_idx").on(t.status),
  }),
);

export const politicalMailLaunchPhases = pgTable(
  "political_mail_launch_phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => politicalMailLaunchPlans.id, { onDelete: "cascade" }),
    phaseNumber: integer("phase_number").notNull(),
    phaseKey: text("phase_key").notNull(),
    objective: text("objective").notNull(),
    recommendedSendDate: date("recommended_send_date"),
    deliveryWindowStart: date("delivery_window_start"),
    deliveryWindowEnd: date("delivery_window_end"),
    targetGeography: text("target_geography").notNull(),
    householdCount: integer("household_count").notNull().default(0),
    estimatedPrintCostCents: bigint("estimated_print_cost_cents", {
      mode: "number",
    })
      .notNull()
      .default(0),
    estimatedPostageCostCents: bigint("estimated_postage_cost_cents", {
      mode: "number",
    })
      .notNull()
      .default(0),
    totalEstimatedCostCents: bigint("total_estimated_cost_cents", {
      mode: "number",
    })
      .notNull()
      .default(0),
    messageTheme: text("message_theme").notNull(),
    creativeBrief: text("creative_brief").notNull(),
    qrRecommendation: text("qr_recommendation"),
    complianceNotes: text("compliance_notes").array().notNull().default([]),
    whyThisPhaseMatters: text("why_this_phase_matters").notNull(),
    sourceLabels: text("source_labels").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planIdx: index("political_mail_launch_phases_plan_idx").on(t.planId),
    phaseIdx: index("political_mail_launch_phases_phase_idx").on(t.planId, t.phaseNumber),
  }),
);

export const politicalMailPhaseGeographies = pgTable(
  "political_mail_phase_geographies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => politicalMailLaunchPhases.id, { onDelete: "cascade" }),
    geographyType: text("geography_type").notNull(),
    geographyKey: text("geography_key").notNull(),
    label: text("label").notNull(),
    householdCount: integer("household_count").notNull().default(0),
    routeCount: integer("route_count").notNull().default(0),
    estimatedCostCents: bigint("estimated_cost_cents", { mode: "number" })
      .notNull()
      .default(0),
    selectionReason: text("selection_reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phaseIdx: index("political_mail_phase_geographies_phase_idx").on(t.phaseId),
    geoIdx: index("political_mail_phase_geographies_geo_idx").on(
      t.geographyType,
      t.geographyKey,
    ),
  }),
);

export const politicalAgentActivityLog = pgTable(
  "political_agent_activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").references(() => politicalCandidateAgents.id, {
      onDelete: "cascade",
    }),
    candidateId: uuid("candidate_id").references(() => campaignCandidates.id, {
      onDelete: "cascade",
    }),
    campaignId: uuid("campaign_id").references(() => politicalCampaigns.id, {
      onDelete: "set null",
    }),
    activityType: text("activity_type").notNull(),
    status: text("status").notNull().default("complete"),
    message: text("message").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index("political_agent_activity_log_agent_idx").on(t.agentId),
    candidateIdx: index("political_agent_activity_log_candidate_idx").on(t.candidateId),
    typeIdx: index("political_agent_activity_log_type_idx").on(t.activityType),
  }),
);

export const politicalPlanApprovals = pgTable(
  "political_plan_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => politicalMailLaunchPlans.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => campaignCandidates.id, { onDelete: "cascade" }),
    approvedBy: uuid("approved_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    approvalStatus: text("approval_status").notNull().default("approved"),
    notes: text("notes"),
    complianceChecklist: jsonb("compliance_checklist")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planIdx: index("political_plan_approvals_plan_idx").on(t.planId),
    candidateIdx: index("political_plan_approvals_candidate_idx").on(t.candidateId),
  }),
);

export const politicalCandidateAgentsRelations = relations(
  politicalCandidateAgents,
  ({ one, many }) => ({
    candidate: one(campaignCandidates, {
      fields: [politicalCandidateAgents.candidateId],
      references: [campaignCandidates.id],
    }),
    campaign: one(politicalCampaigns, {
      fields: [politicalCandidateAgents.campaignId],
      references: [politicalCampaigns.id],
    }),
    research: many(politicalCandidateResearch),
    plans: many(politicalMailLaunchPlans),
    activity: many(politicalAgentActivityLog),
  }),
);

export const politicalMailLaunchPlansRelations = relations(
  politicalMailLaunchPlans,
  ({ one, many }) => ({
    agent: one(politicalCandidateAgents, {
      fields: [politicalMailLaunchPlans.agentId],
      references: [politicalCandidateAgents.id],
    }),
    candidate: one(campaignCandidates, {
      fields: [politicalMailLaunchPlans.candidateId],
      references: [campaignCandidates.id],
    }),
    phases: many(politicalMailLaunchPhases),
    approvals: many(politicalPlanApprovals),
  }),
);

export const politicalMailLaunchPhasesRelations = relations(
  politicalMailLaunchPhases,
  ({ one, many }) => ({
    plan: one(politicalMailLaunchPlans, {
      fields: [politicalMailLaunchPhases.planId],
      references: [politicalMailLaunchPlans.id],
    }),
    geographies: many(politicalMailPhaseGeographies),
  }),
);

export type PoliticalCandidateAgent = typeof politicalCandidateAgents.$inferSelect;
export type PoliticalCandidateAgentInsert = typeof politicalCandidateAgents.$inferInsert;
export type PoliticalCandidateResearch = typeof politicalCandidateResearch.$inferSelect;
export type PoliticalCandidateResearchInsert = typeof politicalCandidateResearch.$inferInsert;
export type PoliticalDistrictIntelligence = typeof politicalDistrictIntelligence.$inferSelect;
export type PoliticalDistrictIntelligenceInsert = typeof politicalDistrictIntelligence.$inferInsert;
export type PoliticalMailLaunchPlan = typeof politicalMailLaunchPlans.$inferSelect;
export type PoliticalMailLaunchPlanInsert = typeof politicalMailLaunchPlans.$inferInsert;
export type PoliticalMailLaunchPhase = typeof politicalMailLaunchPhases.$inferSelect;
export type PoliticalMailLaunchPhaseInsert = typeof politicalMailLaunchPhases.$inferInsert;
export type PoliticalMailPhaseGeography = typeof politicalMailPhaseGeographies.$inferSelect;
export type PoliticalMailPhaseGeographyInsert = typeof politicalMailPhaseGeographies.$inferInsert;
export type PoliticalAgentActivityLog = typeof politicalAgentActivityLog.$inferSelect;
export type PoliticalAgentActivityLogInsert = typeof politicalAgentActivityLog.$inferInsert;
export type PoliticalPlanApproval = typeof politicalPlanApprovals.$inferSelect;
export type PoliticalPlanApprovalInsert = typeof politicalPlanApprovals.$inferInsert;
