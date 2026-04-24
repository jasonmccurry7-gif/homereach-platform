// ─────────────────────────────────────────────────────────────────────────────
// Political Command Center — campaign_candidates, political_campaigns,
// political_campaign_contacts
//
// Mirrors the SQL schema in supabase/migrations/059_political_core.sql.
//
// Gated at runtime by ENABLE_POLITICAL (see apps/web/lib/political/env.ts).
// Nothing in this module reads or writes political_* tables while the flag
// is off; the Drizzle definitions are tree-shaken out of runtime bundles
// if no code imports them.
//
// Non-political-persuasion compliance: no column on any of these tables
// stores voter ideology, party-segmentation scoring, voter-file joins, or
// persuasion attributes. `partyOptionalPublic` is present only to record
// a candidate's own publicly-declared party registration and is optional.
// ─────────────────────────────────────────────────────────────────────────────

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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profiles } from "./users";

// ── Enums (added in migration 060 for national-scale alignment) ─────────────
// geography_type narrows a geography_value to a granularity level, so a
// single (state, geography_type, geography_value) triple can describe
// "Ohio → county → Franklin" or "Texas → district → TX-12".

export const geographyTypeEnum = pgEnum("geography_type_enum", [
  "state",
  "county",
  "city",
  "district",
]);

export const districtTypeEnum = pgEnum("district_type_enum", [
  "federal",
  "state",
  "local",
]);

export const candidateStatusEnum = pgEnum("candidate_status_enum", [
  "active",
  "inactive",
  "won",
  "lost",
]);

export const campaignPipelineStatusEnum = pgEnum("campaign_pipeline_status_enum", [
  "prospect",
  "contacted",
  "proposal_sent",
  "won",
  "lost",
]);

// ── campaign_candidates ──────────────────────────────────────────────────────

export const campaignCandidates = pgTable(
  "campaign_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identity
    candidateName:          text("candidate_name").notNull(),
    officeSought:           text("office_sought"),
    // NEW (migration 060) — typed enum. Supersedes raceLevel; kept during
    // deprecation window.
    districtType:           districtTypeEnum("district_type"),
    // DEPRECATED (migration 060). Use districtType.
    raceLevel:              text("race_level").notNull(),
    electionYear:           integer("election_year"),
    electionDate:           date("election_date"),

    // Geography. NEW pair supports national scale without per-granularity
    // columns (migration 060). Old columns below are deprecated.
    state:                  text("state").notNull().default("OH"),
    geographyType:          geographyTypeEnum("geography_type"),
    geographyValue:         text("geography_value"),
    // DEPRECATED (migration 060). Use geographyType + geographyValue.
    district:               text("district"),
    county:                 text("county"),
    city:                   text("city"),

    // Optional publicly-declared party registration. Never inferred.
    partyOptionalPublic:    text("party_optional_public"),

    // Contact / public links
    campaignWebsite:        text("campaign_website"),
    campaignEmail:          text("campaign_email"),
    campaignPhone:          text("campaign_phone"),
    facebookUrl:            text("facebook_url"),
    messengerUrl:           text("messenger_url"),
    campaignManagerName:    text("campaign_manager_name"),
    campaignManagerEmail:   text("campaign_manager_email"),

    // Provenance
    sourceUrl:              text("source_url"),
    sourceType:             text("source_type"),
    dataVerifiedAt:         timestamp("data_verified_at", { withTimezone: true }),

    // Operational scoring only
    completenessScore:      integer("completeness_score"),
    priorityScore:          integer("priority_score"),

    // Pipeline state. NEW typed column from migration 060; old `status` text
    // column kept for deprecation window.
    candidateStatus:        candidateStatusEnum("candidate_status").notNull().default("active"),
    // DEPRECATED (migration 060). Use candidateStatus.
    status:                 text("status").notNull().default("new"),
    lastContactedAt:        timestamp("last_contacted_at",   { withTimezone: true }),
    nextFollowUpAt:         timestamp("next_follow_up_at",   { withTimezone: true }),
    notes:                  text("notes"),

    // Compliance
    doNotContact:           boolean("do_not_contact").notNull().default(false),
    doNotEmail:             boolean("do_not_email").notNull().default(false),
    doNotText:              boolean("do_not_text").notNull().default(false),

    createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // 059 indexes (retained)
    raceLevelIdx:   index("campaign_candidates_race_level_idx").on(t.raceLevel),
    stateIdx:       index("campaign_candidates_state_idx").on(t.state),
    countyIdx:      index("campaign_candidates_county_idx").on(t.county),
    cityIdx:        index("campaign_candidates_city_idx").on(t.city),
    statusIdx:      index("campaign_candidates_status_idx").on(t.status),
    electionIdx:    index("campaign_candidates_election_idx").on(t.electionDate),
    // 060 indexes (new)
    geoIdx:              index("campaign_candidates_geo_idx").on(t.state, t.geographyType, t.geographyValue),
    districtTypeIdx:     index("campaign_candidates_district_type_idx").on(t.districtType),
    candidateStatusIdx:  index("campaign_candidates_candidate_status_idx").on(t.candidateStatus),
  }),
);

// ── political_campaigns ──────────────────────────────────────────────────────

export const politicalCampaigns = pgTable(
  "political_campaigns",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),
    candidateId:            uuid("candidate_id").notNull().references(() => campaignCandidates.id, { onDelete: "cascade" }),

    campaignName:           text("campaign_name").notNull(),
    office:                 text("office"),

    // NEW (migration 060) — typed enum, supersedes raceType.
    districtType:           districtTypeEnum("district_type"),
    // DEPRECATED (migration 060). Use districtType.
    raceType:               text("race_type"),

    // Target geography for this specific engagement. NEW pair from 060.
    geographyType:          geographyTypeEnum("geography_type"),
    geographyValue:         text("geography_value"),
    // DEPRECATED (migration 060). Use geographyType + geographyValue.
    county:                 text("county"),
    city:                   text("city"),
    district:               text("district"),

    // NEW typed pipeline status (migration 060). Old `stage` text column
    // kept for the deprecation window.
    pipelineStatus:         campaignPipelineStatusEnum("pipeline_status").notNull().default("prospect"),
    // DEPRECATED (migration 060). Use pipelineStatus.
    stage:                  text("stage").notNull().default("new"),

    // NEW money column (migration 060). Same units (cents) as the old
    // column, renamed per spec. `mode: "number"` keeps TS ergonomic; values
    // stay under 2^53.
    budgetEstimateCents:    bigint("budget_estimate_cents", { mode: "number" }),
    // DEPRECATED (migration 060). Use budgetEstimateCents.
    estimatedDealValueCents: bigint("estimated_deal_value_cents", { mode: "number" }),

    ownerId:                uuid("owner_id").references(() => profiles.id, { onDelete: "set null" }),

    electionDate:           date("election_date"),

    createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // 059 indexes (retained)
    candidateIdx:   index("political_campaigns_candidate_idx").on(t.candidateId),
    ownerIdx:       index("political_campaigns_owner_idx").on(t.ownerId),
    stageIdx:       index("political_campaigns_stage_idx").on(t.stage),
    raceIdx:        index("political_campaigns_race_idx").on(t.raceType),
    electionIdx:    index("political_campaigns_election_idx").on(t.electionDate),
    // 060 indexes (new)
    geoIdx:              index("political_campaigns_geo_idx").on(t.geographyType, t.geographyValue),
    districtTypeIdx:     index("political_campaigns_district_type_idx").on(t.districtType),
    pipelineStatusIdx:   index("political_campaigns_pipeline_status_idx").on(t.pipelineStatus),
    budgetIdx:           index("political_campaigns_budget_idx").on(t.budgetEstimateCents),
  }),
);

// ── political_campaign_contacts ──────────────────────────────────────────────

export const politicalCampaignContacts = pgTable(
  "political_campaign_contacts",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),

    campaignCandidateId:    uuid("campaign_candidate_id").notNull().references(() => campaignCandidates.id, { onDelete: "cascade" }),
    // Optional — contact can exist at the candidate level without being
    // tied to a specific engagement yet.
    campaignId:             uuid("campaign_id").references(() => politicalCampaigns.id, { onDelete: "set null" }),

    name:                   text("name").notNull(),
    role:                   text("role"),
    email:                  text("email"),
    phone:                  text("phone"),

    isPrimary:              boolean("is_primary").notNull().default(false),
    preferredContactMethod: text("preferred_contact_method"),

    doNotContact:           boolean("do_not_contact").notNull().default(false),
    doNotEmail:             boolean("do_not_email").notNull().default(false),
    doNotText:              boolean("do_not_text").notNull().default(false),

    createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    candidateIdx:   index("political_campaign_contacts_candidate_idx").on(t.campaignCandidateId),
    campaignIdx:    index("political_campaign_contacts_campaign_idx").on(t.campaignId),
    // Matches the partial unique index defined in the migration.
    onePrimaryIdx:  uniqueIndex("political_campaign_contacts_one_primary_idx").on(t.campaignCandidateId),
  }),
);

// ── Relations ────────────────────────────────────────────────────────────────

export const campaignCandidatesRelations = relations(campaignCandidates, ({ many }) => ({
  campaigns: many(politicalCampaigns),
  contacts:  many(politicalCampaignContacts),
}));

export const politicalCampaignsRelations = relations(politicalCampaigns, ({ one, many }) => ({
  candidate: one(campaignCandidates, {
    fields:     [politicalCampaigns.candidateId],
    references: [campaignCandidates.id],
  }),
  owner: one(profiles, {
    fields:     [politicalCampaigns.ownerId],
    references: [profiles.id],
  }),
  contacts: many(politicalCampaignContacts),
}));

export const politicalCampaignContactsRelations = relations(politicalCampaignContacts, ({ one }) => ({
  candidate: one(campaignCandidates, {
    fields:     [politicalCampaignContacts.campaignCandidateId],
    references: [campaignCandidates.id],
  }),
  campaign: one(politicalCampaigns, {
    fields:     [politicalCampaignContacts.campaignId],
    references: [politicalCampaigns.id],
  }),
}));

// ── Phase 4: Enums for proposals + orders (migration 061) ───────────────────

export const politicalProposalStatusEnum = pgEnum("political_proposal_status_enum", [
  "draft",
  "sent",
  "viewed",
  "approved",
  "declined",
  "expired",
]);

export const politicalOrderPaymentStatusEnum = pgEnum(
  "political_order_payment_status_enum",
  ["pending", "deposit_paid", "paid", "failed", "refunded", "canceled"],
);

export const politicalOrderFulfillmentStatusEnum = pgEnum(
  "political_order_fulfillment_status_enum",
  ["pending", "production", "mailed", "delivered", "completed", "canceled"],
);

export const politicalOrderPaymentModeEnum = pgEnum(
  "political_order_payment_mode_enum",
  ["deposit", "full"],
);

// ── Phase 4: political_proposals ────────────────────────────────────────────

export const politicalProposals = pgTable(
  "political_proposals",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),

    campaignId:             uuid("campaign_id").notNull().references(() => politicalCampaigns.id, { onDelete: "cascade" }),
    candidateId:            uuid("candidate_id").notNull().references(() => campaignCandidates.id, { onDelete: "cascade" }),

    status:                 politicalProposalStatusEnum("status").notNull().default("draft"),
    sentAt:                 timestamp("sent_at",     { withTimezone: true }),
    viewedAt:               timestamp("viewed_at",   { withTimezone: true }),
    approvedAt:             timestamp("approved_at", { withTimezone: true }),
    declinedAt:             timestamp("declined_at", { withTimezone: true }),
    expiresAt:              timestamp("expires_at",  { withTimezone: true }),

    publicToken:            text("public_token"),

    createdBy:              uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),

    // Full quote snapshot as jsonb. Shape matches PoliticalQuoteResult from
    // apps/web/lib/political/quote.ts. Denormalized hot fields below avoid
    // jsonb deserialization for dashboard queries.
    pricingSnapshot:        jsonb("pricing_snapshot").notNull().$type<Record<string, unknown>>().default({}),

    households:             bigint("households",              { mode: "number" }).notNull().default(0),
    drops:                  integer("drops").notNull().default(0),
    totalPieces:            bigint("total_pieces",            { mode: "number" }).notNull().default(0),
    totalInvestmentCents:   bigint("total_investment_cents",  { mode: "number" }).notNull().default(0),
    // Internal only — never surfaced to the public page.
    internalCostCents:      bigint("internal_cost_cents",     { mode: "number" }).notNull().default(0),
    internalMarginCents:    bigint("internal_margin_cents",   { mode: "number" }).notNull().default(0),

    deliveryWindowText:     text("delivery_window_text"),

    resendCount:            integer("resend_count").notNull().default(0),
    lastResentAt:           timestamp("last_resent_at", { withTimezone: true }),

    createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    publicTokenIdx:   uniqueIndex("political_proposals_public_token_idx").on(t.publicToken),
    campaignIdx:      index("political_proposals_campaign_idx").on(t.campaignId),
    candidateIdx:     index("political_proposals_candidate_idx").on(t.candidateId),
    statusIdx:        index("political_proposals_status_idx").on(t.status),
    createdByIdx:     index("political_proposals_created_by_idx").on(t.createdBy),
    sentAtIdx:        index("political_proposals_sent_at_idx").on(t.sentAt),
    expiresAtIdx:     index("political_proposals_expires_at_idx").on(t.expiresAt),
  }),
);

// ── Phase 4: political_orders ───────────────────────────────────────────────

export const politicalOrders = pgTable(
  "political_orders",
  {
    id:                       uuid("id").primaryKey().defaultRandom(),

    proposalId:               uuid("proposal_id").notNull().references(() => politicalProposals.id, { onDelete: "restrict" }),
    campaignId:               uuid("campaign_id").notNull().references(() => politicalCampaigns.id, { onDelete: "cascade" }),

    totalCents:               bigint("total_cents",       { mode: "number" }).notNull(),
    amountPaidCents:          bigint("amount_paid_cents", { mode: "number" }).notNull().default(0),
    paymentMode:              politicalOrderPaymentModeEnum("payment_mode"),
    paymentStatus:            politicalOrderPaymentStatusEnum("payment_status").notNull().default("pending"),

    stripeCheckoutSessionId:  text("stripe_checkout_session_id"),
    stripePaymentIntentId:    text("stripe_payment_intent_id"),
    stripeCustomerId:         text("stripe_customer_id"),

    fulfillmentStatus:        politicalOrderFulfillmentStatusEnum("fulfillment_status").notNull().default("pending"),

    approvedAt:               timestamp("approved_at",            { withTimezone: true }),
    paidAt:                   timestamp("paid_at",                { withTimezone: true }),
    fulfillmentStartedAt:     timestamp("fulfillment_started_at", { withTimezone: true }),
    completedAt:              timestamp("completed_at",           { withTimezone: true }),
    canceledAt:               timestamp("canceled_at",            { withTimezone: true }),

    notes:                    text("notes"),

    createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    paymentIntentIdx:  uniqueIndex("political_orders_payment_intent_idx").on(t.stripePaymentIntentId),
    checkoutSessionIdx: uniqueIndex("political_orders_checkout_session_idx").on(t.stripeCheckoutSessionId),
    proposalIdx:       index("political_orders_proposal_idx").on(t.proposalId),
    campaignIdx:       index("political_orders_campaign_idx").on(t.campaignId),
    paymentStatusIdx:  index("political_orders_payment_idx").on(t.paymentStatus),
    fulfillmentIdx:    index("political_orders_fulfillment_idx").on(t.fulfillmentStatus),
  }),
);

// ── Phase 5: Contract enum + table (migration 062) ──────────────────────────

export const politicalContractStatusEnum = pgEnum(
  "political_contract_status_enum",
  ["pending", "signed", "canceled", "expired"],
);

export const politicalContracts = pgTable(
  "political_contracts",
  {
    id:            uuid("id").primaryKey().defaultRandom(),

    proposalId:    uuid("proposal_id").notNull().references(() => politicalProposals.id, { onDelete: "cascade" }),
    campaignId:    uuid("campaign_id").notNull().references(() => politicalCampaigns.id, { onDelete: "cascade" }),
    orderId:       uuid("order_id").references(() => politicalOrders.id, { onDelete: "set null" }),

    status:        politicalContractStatusEnum("status").notNull().default("pending"),

    publicToken:   text("public_token"),

    // Verbatim plain-text snapshot — integrity evidence. Never edited post-sign.
    termsText:     text("terms_text").notNull(),

    signerName:    text("signer_name"),
    signerEmail:   text("signer_email"),
    signerIp:      text("signer_ip"),
    signedAt:      timestamp("signed_at", { withTimezone: true }),

    version:       integer("version").notNull().default(1),
    expiresAt:     timestamp("expires_at", { withTimezone: true }),

    sentAt:        timestamp("sent_at",   { withTimezone: true }),
    viewedAt:      timestamp("viewed_at", { withTimezone: true }),

    createdBy:     uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),

    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    publicTokenIdx:       uniqueIndex("political_contracts_public_token_idx").on(t.publicToken),
    proposalIdx:          index("political_contracts_proposal_idx").on(t.proposalId),
    campaignIdx:          index("political_contracts_campaign_idx").on(t.campaignId),
    orderIdx:             index("political_contracts_order_idx").on(t.orderId),
    statusIdx:            index("political_contracts_status_idx").on(t.status),
    signedAtIdx:          index("political_contracts_signed_at_idx").on(t.signedAt),
  }),
);

// ── Phase 6: Script library (migration 063) ─────────────────────────────────

export const politicalScriptChannelEnum = pgEnum(
  "political_script_channel_enum",
  ["call", "sms", "email", "facebook_dm"],
);

export const politicalScripts = pgTable(
  "political_scripts",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    slug:       text("slug").notNull().unique(),
    channel:    politicalScriptChannelEnum("channel").notNull(),
    category:   text("category").notNull(),
    name:       text("name").notNull(),
    subject:    text("subject"),
    body:       text("body").notNull(),
    state:      text("state"),
    sortOrder:  integer("sort_order").notNull().default(0),
    active:     boolean("active").notNull().default(true),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    channelIdx:  index("political_scripts_channel_idx").on(t.channel),
    categoryIdx: index("political_scripts_category_idx").on(t.category),
    activeIdx:   index("political_scripts_active_idx").on(t.active),
    stateIdx:    index("political_scripts_state_idx").on(t.state),
  }),
);

// ── Phase 7: Priority run audit (migration 064) ─────────────────────────────

export const politicalPriorityRuns = pgTable(
  "political_priority_runs",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    ranByUserId:         uuid("ran_by_user_id").references(() => profiles.id, { onDelete: "set null" }),
    source:              text("source").notNull().default("manual"),
    startedAt:           timestamp("started_at",   { withTimezone: true }).notNull().defaultNow(),
    completedAt:         timestamp("completed_at", { withTimezone: true }),
    candidatesScanned:   integer("candidates_scanned").notNull().default(0),
    candidatesUpdated:   integer("candidates_updated").notNull().default(0),
    status:              text("status").notNull().default("running"),
    summary:             jsonb("summary").notNull().$type<Record<string, unknown>>().default({}),
    createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    startedAtIdx: index("political_priority_runs_started_at_idx").on(t.startedAt),
    sourceIdx:    index("political_priority_runs_source_idx").on(t.source),
    statusIdx:    index("political_priority_runs_status_idx").on(t.status),
    ranByIdx:     index("political_priority_runs_ran_by_idx").on(t.ranByUserId),
  }),
);

// ── Phase 4: Relations ──────────────────────────────────────────────────────

export const politicalProposalsRelations = relations(politicalProposals, ({ one, many }) => ({
  campaign:  one(politicalCampaigns,  { fields: [politicalProposals.campaignId],  references: [politicalCampaigns.id]  }),
  candidate: one(campaignCandidates,  { fields: [politicalProposals.candidateId], references: [campaignCandidates.id] }),
  createdBy: one(profiles,            { fields: [politicalProposals.createdBy],   references: [profiles.id]           }),
  orders:    many(politicalOrders),
}));

export const politicalOrdersRelations = relations(politicalOrders, ({ one, many }) => ({
  proposal:  one(politicalProposals, { fields: [politicalOrders.proposalId], references: [politicalProposals.id] }),
  campaign:  one(politicalCampaigns, { fields: [politicalOrders.campaignId], references: [politicalCampaigns.id] }),
  contracts: many(politicalContracts),
}));

export const politicalContractsRelations = relations(politicalContracts, ({ one }) => ({
  proposal:  one(politicalProposals, { fields: [politicalContracts.proposalId], references: [politicalProposals.id] }),
  campaign:  one(politicalCampaigns, { fields: [politicalContracts.campaignId], references: [politicalCampaigns.id] }),
  order:     one(politicalOrders,    { fields: [politicalContracts.orderId],    references: [politicalOrders.id] }),
  createdBy: one(profiles,           { fields: [politicalContracts.createdBy],  references: [profiles.id] }),
}));

// ── Types ────────────────────────────────────────────────────────────────────

export type CampaignCandidate         = typeof campaignCandidates.$inferSelect;
export type CampaignCandidateInsert   = typeof campaignCandidates.$inferInsert;
export type PoliticalCampaign         = typeof politicalCampaigns.$inferSelect;
export type PoliticalCampaignInsert   = typeof politicalCampaigns.$inferInsert;
export type PoliticalCampaignContact        = typeof politicalCampaignContacts.$inferSelect;
export type PoliticalCampaignContactInsert  = typeof politicalCampaignContacts.$inferInsert;

// Phase 4 types
export type PoliticalProposal         = typeof politicalProposals.$inferSelect;
export type PoliticalProposalInsert   = typeof politicalProposals.$inferInsert;
export type PoliticalOrder            = typeof politicalOrders.$inferSelect;
export type PoliticalOrderInsert      = typeof politicalOrders.$inferInsert;

// Phase 5 types
export type PoliticalContract         = typeof politicalContracts.$inferSelect;
export type PoliticalContractInsert   = typeof politicalContracts.$inferInsert;

// Phase 6 types
export type PoliticalScript           = typeof politicalScripts.$inferSelect;
export type PoliticalScriptInsert     = typeof politicalScripts.$inferInsert;

// Phase 7 types
export type PoliticalPriorityRun       = typeof politicalPriorityRuns.$inferSelect;
export type PoliticalPriorityRunInsert = typeof politicalPriorityRuns.$inferInsert;
