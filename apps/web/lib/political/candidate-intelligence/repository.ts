import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCandidateDedupeKey,
  buildSearchText,
  normalizeCandidateName,
  sha256Json,
} from "./normalization";
import { scoreCandidateMatch, scoreSearchResult, type CandidateMatchCandidate } from "./fuzzy";
import type {
  CandidateSuggestion,
  NormalizedCandidateIntelRecord,
  NormalizedElectionTimeline,
} from "./types";

interface UpsertCandidateResult {
  inserted: boolean;
  updated: boolean;
  merged: boolean;
  skipped: boolean;
}

function unique<T>(items: Array<T | null | undefined>): T[] {
  return Array.from(new Set(items.filter((item): item is T => item !== null && item !== undefined)));
}

function toProfilePayload(record: NormalizedCandidateIntelRecord, sourceRecordId?: string | null) {
  const normalizedName = normalizeCandidateName(record.candidateName);
  const dedupeKey = buildCandidateDedupeKey(record);
  const searchText = buildSearchText(record);
  return {
    canonical_candidate_name: record.candidateName,
    normalized_name: normalizedName,
    display_name: record.displayName ?? record.candidateName,
    party: record.party ?? null,
    incumbent_status: record.incumbentStatus ?? null,
    office_name: record.officeName ?? null,
    office_level: record.officeLevel,
    office_hierarchy: record.officeHierarchy ?? [],
    office_code: record.officeCode ?? null,
    state: record.state ?? null,
    jurisdiction_name: record.jurisdictionName ?? null,
    jurisdiction_type: record.jurisdictionType ?? null,
    district_type: record.districtType ?? null,
    district_label: record.districtLabel ?? null,
    district_geoid: record.districtGeoid ?? null,
    election_name: record.electionName ?? null,
    election_type: record.electionType ?? null,
    election_date: record.electionDate ?? null,
    election_year: record.electionYear ?? null,
    filing_status: record.filingStatus ?? null,
    filing_status_updated_at: record.filingStatus ? new Date().toISOString() : null,
    campaign_website: record.campaignWebsite ?? null,
    campaign_email: record.campaignEmail ?? null,
    campaign_phone: record.campaignPhone ?? null,
    social_links: record.socialLinks ?? {},
    map_layer_hint: record.mapLayerHint ?? {},
    usps_route_hint: record.uspsRouteHint ?? {},
    timeline_hint: record.timelineHint ?? {},
    source_confidence: record.confidence,
    data_confidence: record.dataConfidence,
    source_keys: [record.sourceKey],
    matched_source_record_ids: sourceRecordId ? [sourceRecordId] : [],
    dedupe_key: dedupeKey,
    search_text: searchText,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function findCandidateProfile(
  supabase: SupabaseClient,
  record: NormalizedCandidateIntelRecord,
): Promise<{ profileId: string | null; score: number; reasons: unknown[]; merged: boolean }> {
  const dedupeKey = buildCandidateDedupeKey(record);
  const exact = await supabase
    .from("candidate_intel_profiles")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (exact.error) throw exact.error;
  if (exact.data?.id) return { profileId: exact.data.id as string, score: 1, reasons: [{ code: "dedupe_key", detail: "Exact normalized identity match" }], merged: false };

  let query = supabase
    .from("candidate_intel_profiles")
    .select("id, normalized_name, canonical_candidate_name, office_name, state, district_label, election_year")
    .limit(80);

  if (record.state) query = query.eq("state", record.state);
  if (record.officeName) query = query.eq("office_name", record.officeName);

  const candidates = await query;
  if (candidates.error) throw candidates.error;

  let best: { row: CandidateMatchCandidate; score: number; reasons: unknown[] } | null = null;
  for (const row of (candidates.data ?? []) as CandidateMatchCandidate[]) {
    const match = scoreCandidateMatch(record, row);
    if (!best || match.score > best.score) {
      best = { row, score: match.score, reasons: match.reasons };
    }
  }

  if (best && best.score >= 0.92) {
    return { profileId: best.row.id, score: best.score, reasons: best.reasons, merged: true };
  }

  return { profileId: null, score: best?.score ?? 0, reasons: best?.reasons ?? [], merged: false };
}

async function mergeIntoProfile(
  supabase: SupabaseClient,
  profileId: string,
  record: NormalizedCandidateIntelRecord,
  sourceRecordUuid: string,
): Promise<void> {
  const existing = await supabase
    .from("candidate_intel_profiles")
    .select("source_keys, matched_source_record_ids, source_confidence")
    .eq("id", profileId)
    .single();
  if (existing.error) throw existing.error;

  const sourceKeys = unique([...(existing.data?.source_keys ?? []), record.sourceKey]);
  const matchedIds = unique([...(existing.data?.matched_source_record_ids ?? []), sourceRecordUuid]);
  const confidence = Math.max(Number(existing.data?.source_confidence ?? 0), record.confidence);

  const payload = toProfilePayload(record, sourceRecordUuid);
  await supabase
    .from("candidate_intel_profiles")
    .update({
      ...payload,
      source_keys: sourceKeys,
      matched_source_record_ids: matchedIds,
      source_confidence: confidence,
    })
    .eq("id", profileId);
}

export async function upsertCandidateIntelRecord(
  supabase: SupabaseClient,
  record: NormalizedCandidateIntelRecord,
  syncRunId?: string | null,
): Promise<UpsertCandidateResult> {
  const recordHash = sha256Json(record.rawPayload);
  const prior = await supabase
    .from("candidate_intel_source_records")
    .select("id, record_hash, profile_id")
    .eq("source_key", record.sourceKey)
    .eq("source_record_id", record.sourceRecordId)
    .maybeSingle();
  if (prior.error) throw prior.error;

  const normalizedPayload = toProfilePayload(record);
  const source = await supabase
    .from("candidate_intel_source_records")
    .upsert(
      {
        profile_id: prior.data?.profile_id ?? null,
        sync_run_id: syncRunId ?? null,
        source_key: record.sourceKey,
        source_record_id: record.sourceRecordId,
        source_url: record.sourceUrl ?? null,
        source_retrieved_at: record.sourceRetrievedAt ?? new Date().toISOString(),
        record_hash: recordHash,
        raw_payload: record.rawPayload,
        normalized_payload: normalizedPayload,
        normalized_name: normalizeCandidateName(record.candidateName),
        state: record.state ?? null,
        office_name: record.officeName ?? null,
        election_date: record.electionDate ?? null,
        filing_status: record.filingStatus ?? null,
        confidence: record.confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_key,source_record_id" },
    )
    .select("id")
    .single();
  if (source.error || !source.data) throw source.error ?? new Error("Failed to upsert candidate source record.");

  const sourceUuid = source.data.id as string;
  const match = await findCandidateProfile(supabase, record);
  let profileId = match.profileId;

  if (!profileId) {
    const created = await supabase
      .from("candidate_intel_profiles")
      .insert(toProfilePayload(record, sourceUuid))
      .select("id")
      .single();
    if (created.error || !created.data) throw created.error ?? new Error("Failed to create candidate profile.");
    profileId = created.data.id as string;
  } else {
    await mergeIntoProfile(supabase, profileId, record, sourceUuid);
  }

  await supabase
    .from("candidate_intel_source_records")
    .update({
      profile_id: profileId,
      match_status: match.profileId ? "auto_matched" : "unmatched",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourceUuid);

  await supabase.from("candidate_intel_match_decisions").insert({
    profile_id: profileId,
    source_record_id: sourceUuid,
    decision: match.profileId ? "auto_merge" : "new_profile",
    score: match.profileId ? String(match.score) : "0",
    reasons: match.reasons,
  });

  return {
    inserted: !prior.data,
    updated: Boolean(prior.data && prior.data.record_hash !== recordHash),
    merged: Boolean(match.merged),
    skipped: Boolean(prior.data && prior.data.record_hash === recordHash),
  };
}

export async function upsertElectionTimeline(
  supabase: SupabaseClient,
  timeline: NormalizedElectionTimeline,
): Promise<void> {
  const mailEnd = timeline.recommendedMailEnd;
  const electionDate = new Date(`${timeline.electionDate}T00:00:00Z`);
  const recommendedMailEnd =
    mailEnd ??
    (Number.isNaN(electionDate.getTime())
      ? null
      : new Date(electionDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const recommendedMailStart =
    timeline.recommendedMailStart ??
    (Number.isNaN(electionDate.getTime())
      ? null
      : new Date(electionDate.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const { error } = await supabase.from("candidate_intel_election_timelines").upsert(
    {
      election_name: timeline.electionName,
      election_type: timeline.electionType ?? "other",
      election_date: timeline.electionDate,
      cycle: timeline.cycle,
      state: timeline.state ?? null,
      jurisdiction_name: timeline.jurisdictionName ?? null,
      jurisdiction_type: timeline.jurisdictionType ?? null,
      office_level: timeline.officeLevel ?? null,
      filing_deadline: timeline.filingDeadline ?? null,
      registration_deadline: timeline.registrationDeadline ?? null,
      absentee_start: timeline.absenteeStart ?? null,
      absentee_deadline: timeline.absenteeDeadline ?? null,
      early_vote_start: timeline.earlyVoteStart ?? null,
      early_vote_end: timeline.earlyVoteEnd ?? null,
      recommended_mail_start: recommendedMailStart,
      recommended_mail_end: recommendedMailEnd,
      source_key: timeline.sourceKey,
      source_url: timeline.sourceUrl ?? null,
      data_confidence: timeline.dataConfidence,
      raw_payload: timeline.rawPayload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "state,jurisdiction_name,election_date,election_type" },
  );
  if (error) throw error;
}

export async function createCandidateIntelSyncRun(
  supabase: SupabaseClient,
  args: { sourceKey: string; triggerType: string; state?: string; cycle?: number; requestedBy?: string | null },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("candidate_intel_sync_runs")
    .insert({
      source_key: args.sourceKey,
      trigger_type: args.triggerType,
      status: "running",
      state_scope: args.state ? [args.state.toUpperCase()] : [],
      cycle: args.cycle ?? null,
      requested_by: args.requestedBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function finishCandidateIntelSyncRun(
  supabase: SupabaseClient,
  id: string | null,
  args: {
    status: "completed" | "partial" | "failed" | "skipped";
    startedAt: number;
    seen: number;
    inserted: number;
    updated: number;
    merged: number;
    skipped: number;
    normalized: number;
    errors: string[];
    summary?: Record<string, unknown>;
  },
): Promise<void> {
  if (!id) return;
  await supabase
    .from("candidate_intel_sync_runs")
    .update({
      status: args.status,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - args.startedAt,
      records_seen: args.seen,
      records_normalized: args.normalized,
      records_inserted: args.inserted,
      records_updated: args.updated,
      records_merged: args.merged,
      records_skipped: args.skipped,
      errors: args.errors.map((message) => ({ message })),
      summary: args.summary ?? {},
    })
    .eq("id", id);
}

export async function recordCandidateIntelRefreshEvent(
  supabase: SupabaseClient,
  args: { sourceKey: string; eventType: string; sourceRecordId?: string | null; payload: Record<string, unknown> },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("candidate_intel_refresh_events")
    .insert({
      source_key: args.sourceKey,
      event_type: args.eventType,
      source_record_id: args.sourceRecordId ?? null,
      payload: args.payload,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function searchCandidateSuggestions(
  supabase: SupabaseClient,
  args: { query: string; state?: string; limit?: number },
): Promise<CandidateSuggestion[]> {
  const q = args.query.trim();
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(args.limit ?? 8, 1), 20);

  let query = supabase
    .from("candidate_intel_suggestions")
    .select("*")
    .ilike("search_text", `%${q}%`)
    .limit(60);

  if (args.state) query = query.eq("state", args.state.toUpperCase());
  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const score = scoreSearchResult(
        q,
        String(row.search_text ?? ""),
        String(row.canonical_candidate_name ?? row.display_name ?? ""),
      );
      return {
        id: String(row.id),
        candidateName: String(row.canonical_candidate_name ?? ""),
        displayName: row.display_name as string | null,
        party: row.party as string | null,
        officeName: row.office_name as string | null,
        officeLevel: row.office_level as string | null,
        state: row.state as string | null,
        jurisdictionName: row.jurisdiction_name as string | null,
        jurisdictionType: row.jurisdiction_type as string | null,
        districtType: row.district_type as string | null,
        districtLabel: row.district_label as string | null,
        electionName: row.election_name as string | null,
        electionType: row.election_type as string | null,
        electionDate: row.election_date as string | null,
        electionYear: row.election_year as number | null,
        filingStatus: row.filing_status as string | null,
        campaignWebsite: row.campaign_website as string | null,
        campaignEmail: row.campaign_email as string | null,
        campaignPhone: row.campaign_phone as string | null,
        mapLayerHint: (row.map_layer_hint ?? {}) as Record<string, unknown>,
        uspsRouteHint: (row.usps_route_hint ?? {}) as Record<string, unknown>,
        timelineHint: (row.timeline_hint ?? {}) as Record<string, unknown>,
        sourceConfidence: Number(row.source_confidence ?? 0),
        dataConfidence: (row.data_confidence ?? "estimated") as CandidateSuggestion["dataConfidence"],
        sourceKeys: (row.source_keys ?? []) as string[],
        score,
      } satisfies CandidateSuggestion;
    })
    .filter((item) => item.score >= 0.25)
    .sort((a, b) => b.score - a.score || b.sourceConfidence - a.sourceConfidence)
    .slice(0, limit);
}
