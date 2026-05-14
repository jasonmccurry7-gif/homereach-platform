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

interface FeedConfig {
  sourceKey: string;
  label?: string;
  url: string;
  state?: string;
  headers?: Record<string, string>;
  rootKey?: string;
}

function envForSource(sourceKey: string): string | null {
  if (sourceKey === "state_sos_candidate_filings") return process.env.STATE_SOS_FEED_CONFIG_JSON ?? null;
  if (sourceKey === "state_boe_candidate_filings") return process.env.STATE_BOE_FEED_CONFIG_JSON ?? null;
  if (sourceKey === "municipal_election_filings") return process.env.MUNICIPAL_ELECTION_FEED_CONFIG_JSON ?? null;
  return null;
}

function parseConfigs(sourceKey: string): FeedConfig[] {
  const raw = envForSource(sourceKey);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as FeedConfig | FeedConfig[];
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((item) => item.sourceKey === sourceKey && item.url);
}

function rowsFromPayload(payload: unknown, rootKey?: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  if (rootKey && Array.isArray(obj[rootKey])) return obj[rootKey] as unknown[];
  for (const key of ["candidates", "filings", "results", "rows", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function field(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
}

export async function fetchConfiguredFeedIntel(args: {
  sourceKey: string;
  state?: string;
  maxRecords?: number;
}): Promise<CandidateIntelProviderResult> {
  const configs = parseConfigs(args.sourceKey).filter((config) => {
    if (!args.state || !config.state) return true;
    return config.state.toUpperCase() === args.state.toUpperCase();
  });

  if (configs.length === 0) {
    return {
      sourceKey: args.sourceKey,
      skipped: true,
      reason: `${args.sourceKey} has no configured JSON feed. Add the matching *_FEED_CONFIG_JSON env var or use the existing CSV import workbench.`,
      records: [],
    };
  }

  const records: NormalizedCandidateIntelRecord[] = [];
  const warnings: string[] = [];

  for (const config of configs) {
    const response = await fetch(config.url, {
      headers: {
        accept: "application/json",
        ...(config.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      warnings.push(`${config.label ?? config.url} returned ${response.status}`);
      continue;
    }

    const payload = await response.json();
    for (const item of rowsFromPayload(payload, config.rootKey).slice(0, args.maxRecords ?? 500)) {
      const row = item as Record<string, unknown>;
      const candidateName = field(row, ["candidate_name", "candidateName", "name", "full_name", "fullName"]);
      if (!candidateName) continue;

      const officeName = field(row, ["office", "office_sought", "officeSought", "office_name", "officeName", "contest"]);
      const officeLevel = inferOfficeLevel(officeName);
      const electionDate = isoDate(row.election_date ?? row.electionDate ?? row.date);
      const state = field(row, ["state", "state_code", "stateCode"])?.toUpperCase() ?? config.state?.toUpperCase() ?? args.state?.toUpperCase() ?? null;
      const jurisdictionName = field(row, ["jurisdiction", "district", "county", "city", "municipality"]);
      const sourceRecordId =
        field(row, ["id", "filing_id", "filingId", "candidate_id", "candidateId"]) ??
        `${candidateName}-${officeName ?? ""}-${jurisdictionName ?? ""}-${electionDate ?? ""}`;

      records.push({
        sourceKey: args.sourceKey,
        sourceRecordId,
        sourceUrl: field(row, ["source_url", "sourceUrl", "url"]) ?? config.url,
        rawPayload: row,
        candidateName,
        party: normalizeParty(row.party ?? row.party_name ?? row.partyName),
        officeName,
        officeLevel,
        officeHierarchy: inferOfficeHierarchy(officeName, officeLevel),
        state,
        jurisdictionName,
        jurisdictionType: field(row, ["jurisdiction_type", "jurisdictionType", "geography_type", "geographyType"]) ?? "district",
        districtType: field(row, ["district_type", "districtType"]),
        districtLabel: jurisdictionName,
        electionName: field(row, ["election", "election_name", "electionName"]),
        electionType: field(row, ["election_type", "electionType"]),
        electionDate,
        electionYear: electionYearFrom(electionDate, Number(row.election_year ?? row.year) || null),
        filingStatus: normalizeFilingStatus(row.filing_status ?? row.status),
        campaignWebsite: field(row, ["website", "campaign_website", "campaignWebsite"]),
        campaignEmail: field(row, ["email", "campaign_email", "campaignEmail"]),
        campaignPhone: field(row, ["phone", "campaign_phone", "campaignPhone"]),
        mapLayerHint: {
          preferredLayer: jurisdictionName ? "district" : "state",
          state,
          district: jurisdictionName,
        },
        uspsRouteHint: { matchBy: "political_geography_overlap" },
        dataConfidence: deriveDataConfidence(args.sourceKey, Boolean(electionDate)),
        confidence: confidenceFromSource(args.sourceKey, [candidateName, officeName, state, jurisdictionName, electionDate].filter(Boolean).length * 10),
      });
    }
  }

  return { sourceKey: args.sourceKey, records, warnings };
}
