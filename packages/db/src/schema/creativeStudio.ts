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
import { businesses } from "./businesses.js";
import { marketingCampaigns } from "./marketing.js";
import { campaignCandidates } from "./political.js";

export const creativeBrandKits = pgTable(
  "creative_brand_kits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerType: text("owner_type").notNull().default("homereach"),
    logoUrl: text("logo_url"),
    colors: text("colors").array().notNull().default([]),
    tone: text("tone").notNull().default(""),
    fonts: text("fonts").array().notNull().default([]),
    ctaLanguage: text("cta_language").array().notNull().default([]),
    offerLanguage: text("offer_language").notNull().default(""),
    forbiddenClaims: text("forbidden_claims").array().notNull().default([]),
    requiredDisclaimerLanguage: text("required_disclaimer_language").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex("creative_brand_kits_name_idx").on(t.name),
    statusIdx: index("creative_brand_kits_status_idx").on(t.status, t.ownerType),
  }),
);

export const creativePromptTemplates = pgTable(
  "creative_prompt_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: text("template_key").notNull(),
    name: text("name").notNull(),
    offerKey: text("offer_key").notNull(),
    assetType: text("asset_type").notNull(),
    platform: text("platform").notNull().default("any"),
    promptText: text("prompt_text").notNull().default(""),
    scriptSeed: text("script_seed").notNull().default(""),
    storyboardSeed: jsonb("storyboard_seed").$type<Record<string, unknown>[]>().notNull().default([]),
    complianceNotes: text("compliance_notes").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    templateKeyIdx: uniqueIndex("creative_prompt_templates_key_idx").on(t.templateKey),
    offerIdx: index("creative_prompt_templates_offer_idx").on(t.offerKey, t.assetType, t.status),
  }),
);

export const creativeAssets = pgTable(
  "creative_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    candidateId: uuid("candidate_id").references(() => campaignCandidates.id, { onDelete: "set null" }),
    offerKey: text("offer_key").notNull(),
    assetType: text("asset_type").notNull(),
    platform: text("platform").notNull(),
    brandVoice: text("brand_voice").notNull().default("homereach_executive"),
    brandKitId: uuid("brand_kit_id").references(() => creativeBrandKits.id, { onDelete: "set null" }),
    promptTemplateId: uuid("prompt_template_id").references(() => creativePromptTemplates.id, { onDelete: "set null" }),
    providerKey: text("provider_key").notNull().default("mock"),
    providerJobId: text("provider_job_id"),
    providerStatus: text("provider_status").notNull().default("mock_ready"),
    promptUsed: text("prompt_used").notNull().default(""),
    scriptUsed: text("script_used").notNull().default(""),
    storyboard: jsonb("storyboard").$type<Record<string, unknown>[]>().notNull().default([]),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags").array().notNull().default([]),
    fileUrl: text("file_url"),
    thumbnailUrl: text("thumbnail_url"),
    status: text("status").notNull().default("awaiting_review"),
    approvalStatus: text("approval_status").notNull().default("needs_review"),
    complianceReviewStatus: text("compliance_review_status").notNull().default("needs_review"),
    qualityScore: integer("quality_score").notNull().default(0),
    bestUseCase: text("best_use_case").notNull().default(""),
    strengths: text("strengths").array().notNull().default([]),
    weaknesses: text("weaknesses").array().notNull().default([]),
    recommendedImprovement: text("recommended_improvement").notNull().default(""),
    approvalRecommendation: text("approval_recommendation").notNull().default("revise"),
    notes: text("notes"),
    winningLabel: text("winning_label").notNull().default("untested"),
    winningAsset: boolean("winning_asset").notNull().default(false),
    savedToCampaign: boolean("saved_to_campaign").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    approvedBy: uuid("approved_by").references(() => profiles.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reviewIdx: index("creative_assets_review_idx").on(t.status, t.approvalStatus, t.createdAt),
    entityIdx: index("creative_assets_entity_idx").on(t.businessId, t.campaignId, t.candidateId),
    winnerIdx: index("creative_assets_winner_idx").on(t.winningAsset, t.offerKey),
  }),
);

export const creativeAssetReviews = pgTable(
  "creative_asset_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").notNull().references(() => creativeAssets.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id").references(() => profiles.id, { onDelete: "set null" }),
    reviewStatus: text("review_status").notNull().default("needs_review"),
    qualityScore: integer("quality_score").notNull().default(0),
    checklist: jsonb("checklist").$type<Record<string, unknown>>().notNull().default({}),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assetIdx: index("creative_asset_reviews_asset_idx").on(t.assetId, t.createdAt),
  }),
);

export const creativeGenerationLogs = pgTable(
  "creative_generation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").references(() => creativeAssets.id, { onDelete: "set null" }),
    providerKey: text("provider_key").notNull().default("mock"),
    actionType: text("action_type").notNull().default("generate"),
    requestPayload: jsonb("request_payload").$type<Record<string, unknown>>().notNull().default({}),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("logged"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assetIdx: index("creative_generation_logs_asset_idx").on(t.assetId, t.createdAt),
    providerIdx: index("creative_generation_logs_provider_idx").on(t.providerKey, t.status, t.createdAt),
  }),
);

export const creativeAutomationRules = pgTable(
  "creative_automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleKey: text("rule_key").notNull(),
    name: text("name").notNull(),
    cadence: text("cadence").notNull().default("manual"),
    assetType: text("asset_type").notNull(),
    platform: text("platform").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    approvalRequired: boolean("approval_required").notNull().default(true),
    status: text("status").notNull().default("future_ready"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ruleKeyIdx: uniqueIndex("creative_automation_rules_key_idx").on(t.ruleKey),
    statusIdx: index("creative_automation_rules_status_idx").on(t.enabled, t.status),
  }),
);

export const creativeBrandKitsRelations = relations(creativeBrandKits, ({ many }) => ({
  assets: many(creativeAssets),
}));

export const creativePromptTemplatesRelations = relations(creativePromptTemplates, ({ many }) => ({
  assets: many(creativeAssets),
}));

export const creativeAssetsRelations = relations(creativeAssets, ({ one, many }) => ({
  business: one(businesses, {
    fields: [creativeAssets.businessId],
    references: [businesses.id],
  }),
  campaign: one(marketingCampaigns, {
    fields: [creativeAssets.campaignId],
    references: [marketingCampaigns.id],
  }),
  candidate: one(campaignCandidates, {
    fields: [creativeAssets.candidateId],
    references: [campaignCandidates.id],
  }),
  brandKit: one(creativeBrandKits, {
    fields: [creativeAssets.brandKitId],
    references: [creativeBrandKits.id],
  }),
  promptTemplate: one(creativePromptTemplates, {
    fields: [creativeAssets.promptTemplateId],
    references: [creativePromptTemplates.id],
  }),
  reviews: many(creativeAssetReviews),
  generationLogs: many(creativeGenerationLogs),
}));

export const creativeAssetReviewsRelations = relations(creativeAssetReviews, ({ one }) => ({
  asset: one(creativeAssets, {
    fields: [creativeAssetReviews.assetId],
    references: [creativeAssets.id],
  }),
  reviewer: one(profiles, {
    fields: [creativeAssetReviews.reviewerUserId],
    references: [profiles.id],
  }),
}));

export const creativeGenerationLogsRelations = relations(creativeGenerationLogs, ({ one }) => ({
  asset: one(creativeAssets, {
    fields: [creativeGenerationLogs.assetId],
    references: [creativeAssets.id],
  }),
  creator: one(profiles, {
    fields: [creativeGenerationLogs.createdBy],
    references: [profiles.id],
  }),
}));

export type CreativeBrandKit = typeof creativeBrandKits.$inferSelect;
export type NewCreativeBrandKit = typeof creativeBrandKits.$inferInsert;
export type CreativePromptTemplate = typeof creativePromptTemplates.$inferSelect;
export type NewCreativePromptTemplate = typeof creativePromptTemplates.$inferInsert;
export type CreativeAsset = typeof creativeAssets.$inferSelect;
export type NewCreativeAsset = typeof creativeAssets.$inferInsert;
export type CreativeAssetReview = typeof creativeAssetReviews.$inferSelect;
export type NewCreativeAssetReview = typeof creativeAssetReviews.$inferInsert;
export type CreativeGenerationLog = typeof creativeGenerationLogs.$inferSelect;
export type NewCreativeGenerationLog = typeof creativeGenerationLogs.$inferInsert;
export type CreativeAutomationRule = typeof creativeAutomationRules.$inferSelect;
export type NewCreativeAutomationRule = typeof creativeAutomationRules.$inferInsert;

