import { listFecCandidates } from "../../fec/client";
import {
  confidenceFromSource,
  deriveDataConfidence,
  electionYearFrom,
  inferOfficeHierarchy,
  normalizeParty,
} from "../normalization";
import type { CandidateIntelProviderResult, NormalizedCandidateIntelRecord, OfficeLevel } from "../types";

function officeLevelFromFecOffice(office: string | null | undefined): OfficeLevel {
  if (office === "P" || office === "S" || office === "H") return "federal";
  return "other";
}

function officeNameFromFecOffice(office: string | null | undefined, fallback?: string | null): string | null {
  if (office === "P") return "President of the United States";
  if (office === "S") return "US Senator";
  if (office === "H") return "US Representative";
  return fallback ?? null;
}

function districtLabel(state: string | null, office: string | null | undefined, district: string | null | undefined): string | null {
  if (office === "S" && state) return state;
  if (office === "H" && state && district) return `${state}-${String(district).padStart(2, "0")}`;
  if (office === "P") return "United States";
  return state ?? null;
}

export async function fetchFecCandidateIntel(args: {
  state?: string;
  cycle: number;
  maxRecords?: number;
}): Promise<CandidateIntelProviderResult> {
  const sourceKey = "fec_candidates_v1";
  const records = await listFecCandidates(
    {
      cycle: args.cycle,
      state: args.state,
      candidate_status: "C",
    },
    {
      maxRecords: args.maxRecords ?? 750,
    },
  );

  const normalized: NormalizedCandidateIntelRecord[] = records.map((candidate) => {
    const state = candidate.state?.toUpperCase() ?? args.state?.toUpperCase() ?? null;
    const officeName = officeNameFromFecOffice(candidate.office, candidate.office_full);
    const officeLevel = officeLevelFromFecOffice(candidate.office);
    const label = districtLabel(state, candidate.office, candidate.district);
    const electionYear = electionYearFrom(null, args.cycle);
    const filingStatus = candidate.candidate_status === "C" ? "filed" : candidate.candidate_status?.toLowerCase() ?? null;
    const completeness = [
      candidate.name,
      officeName,
      state,
      label,
      electionYear,
      candidate.party_full ?? candidate.party,
    ].filter(Boolean).length * 8;

    return {
      sourceKey,
      sourceRecordId: candidate.candidate_id,
      sourceUrl: `https://api.open.fec.gov/v1/candidate/${candidate.candidate_id}/`,
      rawPayload: candidate,
      candidateName: candidate.name,
      party: normalizeParty(candidate.party_full ?? candidate.party),
      incumbentStatus: candidate.incumbent_challenge_full ?? null,
      officeName,
      officeLevel,
      officeHierarchy: inferOfficeHierarchy(officeName, officeLevel),
      officeCode: candidate.office ?? null,
      state,
      jurisdictionName: label,
      jurisdictionType: candidate.office === "H" ? "congressional_district" : candidate.office === "S" ? "state" : "country",
      districtType: candidate.office === "H" ? "congressional" : candidate.office === "S" ? "statewide" : "national",
      districtLabel: label,
      electionYear,
      filingStatus,
      mapLayerHint: {
        preferredLayer: candidate.office === "H" ? "congressional_district" : "state",
        state,
        district: candidate.district ?? null,
      },
      uspsRouteHint: {
        matchBy: candidate.office === "H" ? "district_overlap" : "statewide_or_selected_area",
      },
      dataConfidence: deriveDataConfidence(sourceKey, false),
      confidence: confidenceFromSource(sourceKey, completeness),
    };
  });

  return { sourceKey, records: normalized };
}
