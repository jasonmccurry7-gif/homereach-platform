import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPoliticalCronSecret, isPoliticalEnabled } from "@/lib/political/env";
import {
  confidenceFromSource,
  deriveDataConfidence,
  electionYearFrom,
  inferOfficeHierarchy,
  inferOfficeLevel,
  isoDate,
  normalizeFilingStatus,
  normalizeParty,
} from "@/lib/political/candidate-intelligence/normalization";
import {
  recordCandidateIntelRefreshEvent,
  upsertCandidateIntelRecord,
} from "@/lib/political/candidate-intelligence/repository";
import type { NormalizedCandidateIntelRecord } from "@/lib/political/candidate-intelligence/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CANDIDATE_INTEL_WEBHOOK_SECRET || getPoliticalCronSecret();
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}` || req.headers.get("x-candidate-intel-secret") === expected;
}

function field(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
}

function normalizeWebhookRecord(sourceKey: string, row: Record<string, unknown>): NormalizedCandidateIntelRecord | null {
  const candidateName = field(row, ["candidate_name", "candidateName", "name", "full_name", "fullName"]);
  if (!candidateName) return null;

  const officeName = field(row, ["office", "office_sought", "officeSought", "office_name", "officeName", "contest"]);
  const officeLevel = inferOfficeLevel(officeName);
  const electionDate = isoDate(row.election_date ?? row.electionDate ?? row.date);
  const state = field(row, ["state", "state_code", "stateCode"])?.toUpperCase() ?? null;
  const districtLabel = field(row, ["district", "district_name", "districtName", "jurisdiction", "county", "city"]);
  const sourceRecordId =
    field(row, ["id", "source_record_id", "sourceRecordId", "filing_id", "candidate_id", "candidateId"]) ??
    `${candidateName}-${officeName ?? ""}-${districtLabel ?? ""}-${electionDate ?? ""}`;

  return {
    sourceKey,
    sourceRecordId,
    sourceUrl: field(row, ["source_url", "sourceUrl", "url"]),
    rawPayload: row,
    candidateName,
    party: normalizeParty(row.party ?? row.party_name ?? row.partyName),
    officeName,
    officeLevel,
    officeHierarchy: inferOfficeHierarchy(officeName, officeLevel),
    state,
    jurisdictionName: districtLabel,
    jurisdictionType: field(row, ["jurisdiction_type", "jurisdictionType", "geography_type", "geographyType"]) ?? "district",
    districtType: field(row, ["district_type", "districtType"]),
    districtLabel,
    electionName: field(row, ["election", "election_name", "electionName"]),
    electionType: field(row, ["election_type", "electionType"]),
    electionDate,
    electionYear: electionYearFrom(electionDate, Number(row.election_year ?? row.year) || null),
    filingStatus: normalizeFilingStatus(row.filing_status ?? row.status),
    campaignWebsite: field(row, ["website", "campaign_website", "campaignWebsite"]),
    campaignEmail: field(row, ["email", "campaign_email", "campaignEmail"]),
    campaignPhone: field(row, ["phone", "campaign_phone", "campaignPhone"]),
    mapLayerHint: { preferredLayer: districtLabel ? "district" : "state", state, district: districtLabel },
    uspsRouteHint: { matchBy: "political_geography_overlap" },
    dataConfidence: deriveDataConfidence(sourceKey, Boolean(electionDate)),
    confidence: confidenceFromSource(sourceKey, [candidateName, officeName, state, districtLabel, electionDate].filter(Boolean).length * 10),
  };
}

export async function POST(req: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json({ ok: false, error: "Political Command Center is disabled." }, { status: 404 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Candidate intelligence webhook secret required." }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const sourceKey = String(payload.sourceKey ?? payload.source_key ?? "manual_candidate_webhook");
  const eventType = String(payload.eventType ?? payload.event_type ?? "candidate_refresh");
  const rows = Array.isArray(payload.records)
    ? payload.records
    : Array.isArray(payload.candidates)
      ? payload.candidates
      : [payload.record ?? payload.candidate ?? payload];

  const supabase = createServiceClient();
  let inserted = 0;
  let updated = 0;
  let merged = 0;
  let skipped = 0;
  let invalid = 0;

  await recordCandidateIntelRefreshEvent(supabase, {
    sourceKey,
    eventType,
    sourceRecordId: String(payload.sourceRecordId ?? payload.source_record_id ?? ""),
    payload,
  });

  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const normalized = normalizeWebhookRecord(sourceKey, row);
    if (!normalized) {
      invalid += 1;
      continue;
    }
    const result = await upsertCandidateIntelRecord(supabase, normalized, null);
    if (result.inserted) inserted += 1;
    if (result.updated) updated += 1;
    if (result.merged) merged += 1;
    if (result.skipped) skipped += 1;
  }

  return NextResponse.json({
    ok: true,
    sourceKey,
    eventType,
    inserted,
    updated,
    merged,
    skipped,
    invalid,
  });
}
