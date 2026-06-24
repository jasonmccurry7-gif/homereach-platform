// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Drizzle Schema Index
// All tables and relations exported from a single entry point.
// Import from "@homereach/db" in applications.
// ─────────────────────────────────────────────────────────────────────────────

// Users & Auth
export * from "./users.js";

// Geography
export * from "./cities.js";

// Catalog
export * from "./products.js";

// Core entities
export * from "./businesses.js";

// Transactions
export * from "./orders.js";

// Outreach engine
export * from "./outreach.js";

// Waitlist, nonprofit, sponsorship
export * from "./misc.js";

// Marketing campaigns + metrics (Phase 3)
export {
  campaignMetrics,
  campaignMetricsRelations,
  marketingCampaigns,
  marketingCampaignsRelations,
  campaignStatusEnum as marketingCampaignStatusEnum,
} from "./marketing.js";

// Pricing engine
export {
  billingIntervalEnum,
  discountRuleTypeEnum,
  discountRules,
  pricingProductTypeEnum,
  pricingProfiles,
  pricingProfilesRelations,
  spotTypeEnum as pricingSpotTypeEnum,
} from "./pricing.js";
export type {
  DiscountRule,
  NewDiscountRule,
  NewPricingProfile,
  PricingProfile,
} from "./pricing.js";

// Spot inventory
export {
  spotAssignmentStatusEnum,
  spotAssignments,
  spotAssignmentsRelations,
  spotTypeEnum,
} from "./spots.js";

// Intake forms
export * from "./intake.js";

// Targeted route leads + campaigns
export * from "./leads.js";

// Targeted route campaigns
export * from "./targeted.js";

// Political campaign map planning
export * from "./political.js";
export * from "./politicalMap.js";
export * from "./politicalIntelligence.js";
export * from "./politicalLaunchAgent.js";

// Conversation log
export * from "./conversations.js";

// Sales execution
export * from "./sales.js";

// Executive Revenue Operating System
export * from "./revenueOs.js";

// Growth tracking
export * from "./growth.js";

// Food Service Growth OS
export * from "./fsgos.js";

// AI Operations Copilot
export * from "./opcopilot.js";

// AI conversational intake
export * from "./aiIntake.js";

// AI Assets Command Center
export * from "./aiAssets.js";

// AI Workforce Operating System
export * from "./aiWorkforce.js";

// Agent Execution Readiness
export * from "./agentExecution.js";

// Agent connector policy layer
export * from "./agentIntegrations.js";

// Agent-Native Mini Apps
export * from "./agentMiniApps.js";

// Canonical approval spine
export * from "./approvalLedger.js";

// AI Creative Production Studio
export * from "./creativeStudio.js";

// Neighborhood Digital Targeting
export * from "./digitalTargeting.js";

// Market Capture Sales Engine
export * from "./marketCapture.js";

// AI COO Recommendation Engine
export * from "./aiCoo.js";

// Business Memory
export * from "./businessMemory.js";

// Cost Control Engine
export * from "./costControl.js";

// Reputation Engine
export * from "./reputation.js";

// Website Management
export * from "./websiteManagement.js";

// Growth Intelligence Engine
export * from "./growthIntelligence.js";

// Ad-Tech Integration Layer
export * from "./adTech.js";

// Provider observability
export * from "./twilioObservability.js";
export * from "./emailObservability.js";

// StormReach Severe Weather Opportunity Engine
export * from "./stormReach.js";
