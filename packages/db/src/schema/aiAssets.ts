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
import { relations } from "drizzle-orm";
import { profiles } from "./users.js";

export const aiBusinessContext = pgTable(
  "ai_business_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("HomeReach Master Business Context"),
    category: text("category").notNull().default("master"),
    companyOverview: text("company_overview").notNull().default(""),
    offers: text("offers").notNull().default(""),
    pricing: text("pricing").notNull().default(""),
    targetCustomers: text("target_customers").notNull().default(""),
    brandVoice: text("brand_voice").notNull().default(""),
    salesPositioning: text("sales_positioning").notNull().default(""),
    complianceRules: text("compliance_rules").notNull().default(""),
    politicalMailRules: text("political_mail_rules").notNull().default(""),
    procurementDashboardRules: text("procurement_dashboard_rules").notNull().default(""),
    sharedPostcardRules: text("shared_postcard_rules").notNull().default(""),
    targetedCampaignRules: text("targeted_campaign_rules").notNull().default(""),
    samGovRules: text("sam_gov_rules").notNull().default(""),
    humanApprovalRequirements: text("human_approval_requirements").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("ai_business_context_status_idx").on(t.status, t.updatedAt),
  }),
);

export const aiPromptSops = pgTable(
  "ai_prompt_sops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptName: text("prompt_name").notNull(),
    category: text("category").notNull(),
    purpose: text("purpose").notNull().default(""),
    requiredInputs: text("required_inputs").array().notNull().default([]),
    promptText: text("prompt_text").notNull().default(""),
    outputFormat: text("output_format").notNull().default(""),
    approvalRequirement: text("approval_requirement").notNull().default("Human approval required before customer-facing or high-stakes use."),
    tags: text("tags").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    relatedWorkflow: text("related_workflow"),
    relatedOffer: text("related_offer"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("ai_prompt_sops_category_idx").on(t.category, t.status),
    promptNameIdx: uniqueIndex("ai_prompt_sops_prompt_name_idx").on(t.promptName),
  }),
);

export const aiDataSources = pgTable(
  "ai_data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    content: text("content").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    relatedWorkflow: text("related_workflow"),
    relatedOffer: text("related_offer"),
    qualityRating: integer("quality_rating").notNull().default(3),
    status: text("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("ai_data_sources_category_idx").on(t.category, t.status),
  }),
);

export const aiAgentProfiles = pgTable(
  "ai_agent_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentName: text("agent_name").notNull(),
    mission: text("mission").notNull().default(""),
    allowedActions: text("allowed_actions").array().notNull().default([]),
    disallowedActions: text("disallowed_actions").array().notNull().default([]),
    requiredDataSources: text("required_data_sources").array().notNull().default([]),
    requiredPromptSops: text("required_prompt_sops").array().notNull().default([]),
    approvalRules: text("approval_rules").notNull().default(""),
    complianceRules: text("compliance_rules").notNull().default(""),
    escalationRules: text("escalation_rules").notNull().default(""),
    outputFormat: text("output_format").notNull().default(""),
    toneRules: text("tone_rules").notNull().default(""),
    successMetrics: text("success_metrics").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("ai_agent_profiles_status_idx").on(t.status, t.agentName),
  }),
);

export const aiPromptChains = pgTable(
  "ai_prompt_chains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chainName: text("chain_name").notNull(),
    category: text("category").notNull(),
    purpose: text("purpose").notNull().default(""),
    requiredInputs: text("required_inputs").array().notNull().default([]),
    sourceAssets: text("source_assets").array().notNull().default([]),
    approvalPoints: text("approval_points").array().notNull().default([]),
    runStatus: text("run_status").notNull().default("ready"),
    status: text("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("ai_prompt_chains_category_idx").on(t.category, t.status),
  }),
);

export const aiPromptChainSteps = pgTable(
  "ai_prompt_chain_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chainId: uuid("chain_id").notNull().references(() => aiPromptChains.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull().default(1),
    stepName: text("step_name").notNull(),
    requiredInputs: text("required_inputs").array().notNull().default([]),
    sourceAssets: text("source_assets").array().notNull().default([]),
    outputSummary: text("output_summary").notNull().default(""),
    approvalRequired: boolean("approval_required").notNull().default(true),
    runStatus: text("run_status").notNull().default("ready"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chainIdx: index("ai_prompt_chain_steps_chain_idx").on(t.chainId, t.stepOrder),
  }),
);

export const aiOutputs = pgTable(
  "ai_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    agentName: text("agent_name"),
    workflow: text("workflow"),
    outputType: text("output_type").notNull().default("draft"),
    content: text("content").notNull().default(""),
    dataSources: text("data_sources").array().notNull().default([]),
    promptSopName: text("prompt_sop_name"),
    chainName: text("chain_name"),
    promptSopId: uuid("prompt_sop_id").references(() => aiPromptSops.id, { onDelete: "set null" }),
    agentProfileId: uuid("agent_profile_id").references(() => aiAgentProfiles.id, { onDelete: "set null" }),
    chainId: uuid("chain_id").references(() => aiPromptChains.id, { onDelete: "set null" }),
    chainStepId: uuid("chain_step_id").references(() => aiPromptChainSteps.id, { onDelete: "set null" }),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    verificationStatus: text("verification_status").notNull().default("pending"),
    winningOutput: boolean("winning_output").notNull().default(false),
    status: text("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "set null" }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reviewIdx: index("ai_outputs_review_idx").on(t.approvalStatus, t.createdAt),
    agentIdx: index("ai_outputs_agent_idx").on(t.agentName, t.createdAt),
  }),
);

export const aiVerificationChecks = pgTable(
  "ai_verification_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outputId: uuid("output_id").references(() => aiOutputs.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    category: text("category").notNull().default("general"),
    status: text("status").notNull().default("not_started"),
    required: boolean("required").notNull().default(true),
    completedBy: uuid("completed_by").references(() => profiles.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outputIdx: index("ai_verification_checks_output_idx").on(t.outputId, t.required),
  }),
);

export const aiOutputReviews = pgTable(
  "ai_output_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outputId: uuid("output_id").references(() => aiOutputs.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id").references(() => profiles.id, { onDelete: "set null" }),
    reviewStatus: text("review_status").notNull().default("needs_review"),
    reviewNotes: text("review_notes"),
    checklist: jsonb("checklist").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outputIdx: index("ai_output_reviews_output_idx").on(t.outputId, t.createdAt),
  }),
);

export const aiPromptChainsRelations = relations(aiPromptChains, ({ many }) => ({
  steps: many(aiPromptChainSteps),
  outputs: many(aiOutputs),
}));

export const aiPromptChainStepsRelations = relations(aiPromptChainSteps, ({ one, many }) => ({
  chain: one(aiPromptChains, {
    fields: [aiPromptChainSteps.chainId],
    references: [aiPromptChains.id],
  }),
  outputs: many(aiOutputs),
}));

export const aiOutputsRelations = relations(aiOutputs, ({ one, many }) => ({
  promptSop: one(aiPromptSops, {
    fields: [aiOutputs.promptSopId],
    references: [aiPromptSops.id],
  }),
  agentProfile: one(aiAgentProfiles, {
    fields: [aiOutputs.agentProfileId],
    references: [aiAgentProfiles.id],
  }),
  chain: one(aiPromptChains, {
    fields: [aiOutputs.chainId],
    references: [aiPromptChains.id],
  }),
  chainStep: one(aiPromptChainSteps, {
    fields: [aiOutputs.chainStepId],
    references: [aiPromptChainSteps.id],
  }),
  verificationChecks: many(aiVerificationChecks),
  reviews: many(aiOutputReviews),
}));

export const aiVerificationChecksRelations = relations(aiVerificationChecks, ({ one }) => ({
  output: one(aiOutputs, {
    fields: [aiVerificationChecks.outputId],
    references: [aiOutputs.id],
  }),
}));

export const aiOutputReviewsRelations = relations(aiOutputReviews, ({ one }) => ({
  output: one(aiOutputs, {
    fields: [aiOutputReviews.outputId],
    references: [aiOutputs.id],
  }),
}));

export type AiBusinessContext = typeof aiBusinessContext.$inferSelect;
export type AiPromptSop = typeof aiPromptSops.$inferSelect;
export type AiDataSource = typeof aiDataSources.$inferSelect;
export type AiAgentProfile = typeof aiAgentProfiles.$inferSelect;
export type AiPromptChain = typeof aiPromptChains.$inferSelect;
export type AiPromptChainStep = typeof aiPromptChainSteps.$inferSelect;
export type AiOutput = typeof aiOutputs.$inferSelect;
export type AiVerificationCheck = typeof aiVerificationChecks.$inferSelect;
export type AiOutputReview = typeof aiOutputReviews.$inferSelect;
