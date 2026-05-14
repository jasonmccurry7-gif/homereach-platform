import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const candidateIntelSyncRuns = pgTable(
  "candidate_intel_sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceKey: text("source_key").notNull(),
    triggerType: text("trigger_type").notNull().default("manual"),
    status: text("status").notNull().default("queued"),
    stateScope: text("state_scope").array().notNull().default([]),
    cycle: integer("cycle"),
    cursorBefore: text("cursor_before"),
    cursorAfter: text("cursor_after"),
    requestedBy: uuid("requested_by"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsNormalized: integer("records_normalized").notNull().default(0),
    recordsInserted: integer("records_inserted").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    recordsMerged: integer("records_merged").notNull().default(0),
    recordsSkipped: integer("records_skipped").notNull().default(0),
    errors: jsonb("errors").$type<Array<Record<string, unknown>>>().notNull().default([]),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceIdx: index("candidate_intel_sync_runs_source_idx").on(t.sourceKey, t.startedAt),
    statusIdx: index("candidate_intel_sync_runs_status_idx").on(t.status),
  }),
);

export const candidateIntelProfiles = pgTable(
  "candidate_intel_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalCandidateName: text("canonical_candidate_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name"),
    party: text("party"),
    incumbentStatus: text("incumbent_status"),
    officeName: text("office_name"),
    officeLevel: text("office_level").notNull().default("other"),
    officeHierarchy: text("office_hierarchy").array().notNull().default([]),
    officeCode: text("office_code"),
    state: text("state"),
    jurisdictionName: text("jurisdiction_name"),
    jurisdictionType: text("jurisdiction_type"),
    districtType: text("district_type"),
    districtLabel: text("district_label"),
    districtGeoid: text("district_geoid"),
    electionName: text("election_name"),
    electionType: text("election_type"),
    electionDate: date("election_date"),
    electionYear: integer("election_year"),
    filingStatus: text("filing_status"),
    filingStatusUpdatedAt: timestamp("filing_status_updated_at", { withTimezone: true }),
    campaignWebsite: text("campaign_website"),
    campaignEmail: text("campaign_email"),
    campaignPhone: text("campaign_phone"),
    socialLinks: jsonb("social_links").$type<Record<string, unknown>>().notNull().default({}),
    mapLayerHint: jsonb("map_layer_hint").$type<Record<string, unknown>>().notNull().default({}),
    uspsRouteHint: jsonb("usps_route_hint").$type<Record<string, unknown>>().notNull().default({}),
    timelineHint: jsonb("timeline_hint").$type<Record<string, unknown>>().notNull().default({}),
    sourceConfidence: integer("source_confidence").notNull().default(50),
    dataConfidence: text("data_confidence").notNull().default("estimated"),
    sourceKeys: text("source_keys").array().notNull().default([]),
    matchedSourceRecordIds: uuid("matched_source_record_ids").array().notNull().default([]),
    dedupeKey: text("dedupe_key").notNull(),
    searchText: text("search_text").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dedupeKeyIdx: uniqueIndex("candidate_intel_profiles_dedupe_key_idx").on(t.dedupeKey),
    stateIdx: index("candidate_intel_profiles_state_idx").on(t.state),
    electionIdx: index("candidate_intel_profiles_election_idx").on(t.electionDate, t.electionYear),
    officeIdx: index("candidate_intel_profiles_office_idx").on(t.officeLevel, t.officeName),
    searchTsvIdx: index("candidate_intel_profiles_search_tsv_idx").using(
      "gin",
      sql`search_vector`,
    ),
  }),
);

export const candidateIntelSourceRecords = pgTable(
  "candidate_intel_source_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => candidateIntelProfiles.id, { onDelete: "set null" }),
    syncRunId: uuid("sync_run_id").references(() => candidateIntelSyncRuns.id, { onDelete: "set null" }),
    sourceKey: text("source_key").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceUrl: text("source_url"),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    recordHash: text("record_hash").notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull().default({}),
    normalizedName: text("normalized_name").notNull(),
    state: text("state"),
    officeName: text("office_name"),
    electionDate: date("election_date"),
    filingStatus: text("filing_status"),
    confidence: integer("confidence").notNull().default(50),
    matchStatus: text("match_status").notNull().default("unmatched"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceRecordIdx: uniqueIndex("candidate_intel_source_records_source_idx").on(t.sourceKey, t.sourceRecordId),
    profileIdx: index("candidate_intel_source_records_profile_idx").on(t.profileId),
    hashIdx: index("candidate_intel_source_records_hash_idx").on(t.recordHash),
  }),
);

export const candidateIntelMatchDecisions = pgTable(
  "candidate_intel_match_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => candidateIntelProfiles.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").references(() => candidateIntelSourceRecords.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    score: numeric("score", { precision: 6, scale: 3 }).notNull().default("0"),
    reasons: jsonb("reasons").$type<Array<Record<string, unknown>>>().notNull().default([]),
    decidedBy: uuid("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("candidate_intel_match_decisions_profile_idx").on(t.profileId, t.decidedAt),
  }),
);

export const candidateIntelElectionTimelines = pgTable(
  "candidate_intel_election_timelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    electionName: text("election_name").notNull(),
    electionType: text("election_type"),
    electionDate: date("election_date").notNull(),
    cycle: integer("cycle").notNull(),
    state: text("state"),
    jurisdictionName: text("jurisdiction_name"),
    jurisdictionType: text("jurisdiction_type"),
    officeLevel: text("office_level"),
    filingDeadline: date("filing_deadline"),
    registrationDeadline: date("registration_deadline"),
    absenteeStart: date("absentee_start"),
    absenteeDeadline: date("absentee_deadline"),
    earlyVoteStart: date("early_vote_start"),
    earlyVoteEnd: date("early_vote_end"),
    recommendedMailStart: date("recommended_mail_start"),
    recommendedMailEnd: date("recommended_mail_end"),
    sourceKey: text("source_key"),
    sourceUrl: text("source_url"),
    dataConfidence: text("data_confidence").notNull().default("estimated"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    lookupIdx: index("candidate_intel_election_timelines_lookup_idx").on(t.state, t.electionDate),
  }),
);

export const candidateIntelRefreshEvents = pgTable(
  "candidate_intel_refresh_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceRecordId: text("source_record_id"),
    status: text("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => ({
    statusIdx: index("candidate_intel_refresh_events_status_idx").on(t.status, t.receivedAt),
  }),
);

export const candidateIntelSearchCache = pgTable(
  "candidate_intel_search_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queryHash: text("query_hash").notNull(),
    query: text("query").notNull(),
    state: text("state"),
    resultIds: uuid("result_ids").array().notNull().default([]),
    response: jsonb("response").$type<Array<Record<string, unknown>>>().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    queryHashIdx: uniqueIndex("candidate_intel_search_cache_query_hash_idx").on(t.queryHash),
    expiresIdx: index("candidate_intel_search_cache_expires_idx").on(t.expiresAt),
  }),
);

export type CandidateIntelProfile = typeof candidateIntelProfiles.$inferSelect;
export type NewCandidateIntelProfile = typeof candidateIntelProfiles.$inferInsert;
export type CandidateIntelSourceRecord = typeof candidateIntelSourceRecords.$inferSelect;
export type NewCandidateIntelSourceRecord = typeof candidateIntelSourceRecords.$inferInsert;
