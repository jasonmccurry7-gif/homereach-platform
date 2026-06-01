import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  mergeStrategySelectionCandidates,
  strategyCandidateFromPublicRecord,
  STRATEGY_SELECTION_CANDIDATES,
  type PublicCampaignCandidateRecord,
  type StrategySelectionCandidate,
} from "@/lib/political/campaign-strategy-selection";

type PublicCandidateDbRow = {
  id: string;
  candidate_name: string;
  office_sought: string | null;
  state: string | null;
  geography_type: string | null;
  geography_value: string | null;
  district_type: string | null;
  candidate_status: string | null;
  election_date: string | null;
  election_year: number | null;
  party_optional_public: string | null;
  source_url: string | null;
  source_type: string | null;
  data_verified_at: string | null;
  priority_score: number | null;
};

const PUBLIC_CANDIDATE_COLUMNS = [
  "id",
  "candidate_name",
  "office_sought",
  "state",
  "geography_type",
  "geography_value",
  "district_type",
  "candidate_status",
  "election_date",
  "election_year",
  "party_optional_public",
  "source_url",
  "source_type",
  "data_verified_at",
  "priority_score",
].join(", ");

function canReadPublicCandidates() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function rowToPublicCandidateRecord(
  row: PublicCandidateDbRow,
): PublicCampaignCandidateRecord {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    officeSought: row.office_sought,
    state: row.state,
    geographyType: row.geography_type,
    geographyValue: row.geography_value,
    districtType: row.district_type,
    candidateStatus: row.candidate_status,
    electionDate: row.election_date,
    electionYear: row.election_year,
    partyOptionalPublic: row.party_optional_public,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    dataVerifiedAt: row.data_verified_at,
    priorityScore: row.priority_score,
  };
}

function hasPublicPlannerProof(row: PublicCandidateDbRow) {
  const sourceUrl = row.source_url?.trim() ?? "";
  return (
    Boolean(row.candidate_name?.trim()) &&
    /^https?:\/\//i.test(sourceUrl) &&
    Boolean(row.data_verified_at)
  );
}

export async function loadPublicPoliticalCandidatesForPlanner(
  limit = 600,
): Promise<StrategySelectionCandidate[]> {
  if (!canReadPublicCandidates()) {
    return STRATEGY_SELECTION_CANDIDATES;
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("campaign_candidates")
      .select(PUBLIC_CANDIDATE_COLUMNS)
      .eq("candidate_status", "active")
      .not("source_url", "is", null)
      .not("data_verified_at", "is", null)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const dbCandidates = ((data ?? []) as unknown as PublicCandidateDbRow[])
      .filter(hasPublicPlannerProof)
      .map(rowToPublicCandidateRecord)
      .map(strategyCandidateFromPublicRecord);

    return mergeStrategySelectionCandidates([
      ...dbCandidates,
      ...STRATEGY_SELECTION_CANDIDATES,
    ]);
  } catch (error) {
    console.error("loadPublicPoliticalCandidatesForPlanner failed", error);
    return STRATEGY_SELECTION_CANDIDATES;
  }
}
