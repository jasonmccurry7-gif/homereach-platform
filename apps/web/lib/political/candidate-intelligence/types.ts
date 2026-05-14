export type DataConfidence =
  | "exact"
  | "estimated"
  | "demo"
  | "user_provided"
  | "public_aggregate"
  | "paid_vendor"
  | "unavailable";

export type OfficeLevel =
  | "federal"
  | "state"
  | "county"
  | "municipal"
  | "city"
  | "township"
  | "school_board"
  | "judicial"
  | "party"
  | "ballot_measure"
  | "other";

export interface NormalizedCandidateIntelRecord {
  sourceKey: string;
  sourceRecordId: string;
  sourceUrl?: string | null;
  sourceRetrievedAt?: string | null;
  rawPayload: Record<string, unknown>;

  candidateName: string;
  displayName?: string | null;
  party?: string | null;
  incumbentStatus?: string | null;

  officeName?: string | null;
  officeLevel: OfficeLevel;
  officeHierarchy?: string[];
  officeCode?: string | null;

  state?: string | null;
  jurisdictionName?: string | null;
  jurisdictionType?: string | null;
  districtType?: string | null;
  districtLabel?: string | null;
  districtGeoid?: string | null;

  electionName?: string | null;
  electionType?: string | null;
  electionDate?: string | null;
  electionYear?: number | null;
  filingStatus?: string | null;

  campaignWebsite?: string | null;
  campaignEmail?: string | null;
  campaignPhone?: string | null;
  socialLinks?: Record<string, unknown>;

  mapLayerHint?: Record<string, unknown>;
  uspsRouteHint?: Record<string, unknown>;
  timelineHint?: Record<string, unknown>;

  dataConfidence: DataConfidence;
  confidence: number;
}

export interface NormalizedElectionTimeline {
  sourceKey: string;
  sourceUrl?: string | null;
  rawPayload: Record<string, unknown>;
  electionName: string;
  electionType?: string | null;
  electionDate: string;
  cycle: number;
  state?: string | null;
  jurisdictionName?: string | null;
  jurisdictionType?: string | null;
  officeLevel?: string | null;
  filingDeadline?: string | null;
  registrationDeadline?: string | null;
  absenteeStart?: string | null;
  absenteeDeadline?: string | null;
  earlyVoteStart?: string | null;
  earlyVoteEnd?: string | null;
  recommendedMailStart?: string | null;
  recommendedMailEnd?: string | null;
  dataConfidence: DataConfidence;
}

export interface CandidateIntelProviderResult {
  sourceKey: string;
  skipped?: boolean;
  reason?: string;
  records: NormalizedCandidateIntelRecord[];
  timelines?: NormalizedElectionTimeline[];
  warnings?: string[];
}

export interface CandidateIntelSyncOptions {
  sourceKeys?: string[];
  state?: string;
  cycle?: number;
  maxRecords?: number;
  query?: string;
  candidateName?: string;
  officeName?: string;
  triggerType?: "manual" | "nightly" | "webhook" | "intake" | "backfill";
  requestedBy?: string | null;
}

export interface CandidateIntelSyncSummary {
  ok: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sources: Array<{
    sourceKey: string;
    status: "completed" | "partial" | "failed" | "skipped";
    seen: number;
    inserted: number;
    updated: number;
    merged: number;
    skipped: number;
    timelines: number;
    error?: string;
    reason?: string;
  }>;
  totals: {
    seen: number;
    inserted: number;
    updated: number;
    merged: number;
    skipped: number;
    timelines: number;
  };
  warnings: string[];
  errors: string[];
}

export interface CandidateSuggestion {
  id: string;
  candidateName: string;
  displayName?: string | null;
  party?: string | null;
  officeName?: string | null;
  officeLevel?: string | null;
  state?: string | null;
  jurisdictionName?: string | null;
  jurisdictionType?: string | null;
  districtType?: string | null;
  districtLabel?: string | null;
  electionName?: string | null;
  electionType?: string | null;
  electionDate?: string | null;
  electionYear?: number | null;
  filingStatus?: string | null;
  campaignWebsite?: string | null;
  campaignEmail?: string | null;
  campaignPhone?: string | null;
  mapLayerHint: Record<string, unknown>;
  uspsRouteHint: Record<string, unknown>;
  timelineHint: Record<string, unknown>;
  sourceConfidence: number;
  dataConfidence: DataConfidence;
  sourceKeys: string[];
  score: number;
}
