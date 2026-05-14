import {
  confidenceFromSource,
  deriveDataConfidence,
  electionYearFrom,
  inferOfficeHierarchy,
  inferOfficeLevel,
  isoDate,
  normalizeFilingStatus,
  normalizeParty,
} from "../normalization";
import type { CandidateIntelProviderResult, NormalizedCandidateIntelRecord } from "../types";

function candidatesFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["candidates", "data", "results", "rows"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function stringField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
}

export async function fetchBallotpediaIntel(args: {
  state?: string;
  maxRecords?: number;
}): Promise<CandidateIntelProviderResult> {
  const sourceKey = "ballotpedia_data_api_v1";
  const key = process.env.BALLOTPEDIA_API_KEY;
  const endpoint = process.env.BALLOTPEDIA_CANDIDATES_ENDPOINT;
  if (!key || !endpoint) {
    return {
      sourceKey,
      skipped: true,
      reason: "BALLOTPEDIA_API_KEY and BALLOTPEDIA_CANDIDATES_ENDPOINT are required for candidate ingestion.",
      records: [],
    };
  }

  const url = new URL(endpoint.startsWith("http") ? endpoint : `https://api4.ballotpedia.org/data/${endpoint.replace(/^\//, "")}`);
  if (args.state) url.searchParams.set("state", args.state.toUpperCase());
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": key,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ballotpedia candidate endpoint returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const records: NormalizedCandidateIntelRecord[] = candidatesFromPayload(payload)
    .slice(0, args.maxRecords ?? 500)
    .flatMap((item) => {
      const row = item as Record<string, unknown>;
      const candidateName = stringField(row, ["candidate_name", "candidateName", "name", "full_name"]);
      if (!candidateName) return [];

      const officeName = stringField(row, ["office", "office_name", "officeName", "race"]);
      const officeLevel = inferOfficeLevel(officeName);
      const electionDate = isoDate(row.election_date ?? row.electionDate);
      const state = stringField(row, ["state", "state_code", "stateCode"])?.toUpperCase() ?? args.state?.toUpperCase() ?? null;
      const districtLabel = stringField(row, ["district", "district_name", "districtName", "jurisdiction"]);
      const sourceRecordId = stringField(row, ["id", "candidate_id", "candidateId", "slug"]) ?? `${candidateName}-${officeName ?? ""}-${state ?? ""}`;

      return [{
        sourceKey,
        sourceRecordId,
        sourceUrl: stringField(row, ["url", "source_url", "sourceUrl", "profile_url"]),
        rawPayload: row,
        candidateName,
        party: normalizeParty(row.party ?? row.party_name ?? row.partyName),
        officeName,
        officeLevel,
        officeHierarchy: inferOfficeHierarchy(officeName, officeLevel),
        state,
        jurisdictionName: districtLabel,
        jurisdictionType: districtLabel ? "district" : null,
        districtLabel,
        electionName: stringField(row, ["election", "election_name", "electionName"]),
        electionType: stringField(row, ["election_type", "electionType"]),
        electionDate,
        electionYear: electionYearFrom(electionDate, Number(row.election_year ?? row.year) || null),
        filingStatus: normalizeFilingStatus(row.filing_status ?? row.status),
        campaignWebsite: stringField(row, ["website", "campaign_website", "campaignWebsite"]),
        socialLinks: {
          ballotpedia: stringField(row, ["url", "profile_url"]),
        },
        mapLayerHint: {
          preferredLayer: districtLabel ? "district" : "state",
          state,
          district: districtLabel,
        },
        uspsRouteHint: { matchBy: "district_overlap" },
        dataConfidence: deriveDataConfidence(sourceKey, Boolean(electionDate)),
        confidence: confidenceFromSource(sourceKey, [candidateName, officeName, state, districtLabel, electionDate].filter(Boolean).length * 9),
      }];
    });

  return { sourceKey, records };
}
