import type { SupabaseClient } from "@supabase/supabase-js";
import { CANDIDATE_INTEL_SOURCES } from "./sources";
import type { CandidateIntelProviderResult, CandidateIntelSyncOptions, CandidateIntelSyncSummary } from "./types";
import { fetchFecCandidateIntel } from "./providers/fec";
import { fetchGoogleCivicIntel } from "./providers/google-civic";
import { fetchDemocracyWorksIntel } from "./providers/democracy-works";
import { fetchBallotpediaIntel } from "./providers/ballotpedia";
import { fetchConfiguredFeedIntel } from "./providers/configured-feed";
import { fetchSerpapiCandidateIntel } from "./providers/serpapi";
import {
  createCandidateIntelSyncRun,
  finishCandidateIntelSyncRun,
  upsertCandidateIntelRecord,
  upsertElectionTimeline,
} from "./repository";

function currentCycle(): number {
  const now = new Date();
  return now.getUTCMonth() >= 10 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

async function fetchSource(sourceKey: string, opts: CandidateIntelSyncOptions): Promise<CandidateIntelProviderResult> {
  const cycle = opts.cycle ?? currentCycle();
  switch (sourceKey) {
    case "fec_candidates_v1":
      return fetchFecCandidateIntel({ state: opts.state, cycle, maxRecords: opts.maxRecords });
    case "google_civic_elections_v1":
      return fetchGoogleCivicIntel({ state: opts.state });
    case "democracy_works_elections_v2":
      return fetchDemocracyWorksIntel({ state: opts.state, maxRecords: opts.maxRecords });
    case "ballotpedia_data_api_v1":
      return fetchBallotpediaIntel({ state: opts.state, maxRecords: opts.maxRecords });
    case "state_sos_candidate_filings":
    case "state_boe_candidate_filings":
    case "municipal_election_filings":
      return fetchConfiguredFeedIntel({ sourceKey, state: opts.state, maxRecords: opts.maxRecords });
    case "serpapi_candidate_search_v1":
      return fetchSerpapiCandidateIntel({
        query: opts.query,
        candidateName: opts.candidateName,
        officeName: opts.officeName,
        state: opts.state,
        cycle,
        maxRecords: opts.maxRecords,
      });
    default:
      return {
        sourceKey,
        skipped: true,
        reason: `No provider registered for ${sourceKey}.`,
        records: [],
      };
  }
}

function defaultSourceKeys(): string[] {
  return CANDIDATE_INTEL_SOURCES
    .map((source) => source.key)
    .filter((key) => key !== "serpapi_candidate_search_v1" || process.env.ENABLE_CANDIDATE_SERPAPI_DEFAULT_SYNC === "true");
}

export async function runCandidateIntelligenceSync(
  supabase: SupabaseClient,
  opts: CandidateIntelSyncOptions = {},
): Promise<CandidateIntelSyncSummary> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const sourceKeys = opts.sourceKeys?.length ? opts.sourceKeys : defaultSourceKeys();
  const summary: CandidateIntelSyncSummary = {
    ok: true,
    startedAt,
    completedAt: startedAt,
    durationMs: 0,
    sources: [],
    totals: {
      seen: 0,
      inserted: 0,
      updated: 0,
      merged: 0,
      skipped: 0,
      timelines: 0,
    },
    warnings: [],
    errors: [],
  };

  for (const sourceKey of sourceKeys) {
    const runStarted = Date.now();
    let syncRunId: string | null = null;
    let seen = 0;
    let inserted = 0;
    let updated = 0;
    let merged = 0;
    let skipped = 0;
    let timelines = 0;
    const errors: string[] = [];

    try {
      syncRunId = await createCandidateIntelSyncRun(supabase, {
        sourceKey,
        triggerType: opts.triggerType ?? "manual",
        state: opts.state,
        cycle: opts.cycle,
        requestedBy: opts.requestedBy ?? null,
      });

      const result = await fetchSource(sourceKey, opts);
      if (result.warnings?.length) summary.warnings.push(...result.warnings.map((warning) => `${sourceKey}: ${warning}`));

      if (result.skipped) {
        skipped += 1;
        await finishCandidateIntelSyncRun(supabase, syncRunId, {
          status: "skipped",
          startedAt: runStarted,
          seen,
          inserted,
          updated,
          merged,
          skipped,
          normalized: 0,
          errors,
          summary: { reason: result.reason },
        });
        summary.sources.push({
          sourceKey,
          status: "skipped",
          seen,
          inserted,
          updated,
          merged,
          skipped,
          timelines,
          reason: result.reason,
        });
        continue;
      }

      seen = result.records.length;
      for (const record of result.records) {
        const write = await upsertCandidateIntelRecord(supabase, record, syncRunId);
        if (write.inserted) inserted += 1;
        if (write.updated) updated += 1;
        if (write.merged) merged += 1;
        if (write.skipped) skipped += 1;
      }

      for (const timeline of result.timelines ?? []) {
        await upsertElectionTimeline(supabase, timeline);
        timelines += 1;
      }

      await finishCandidateIntelSyncRun(supabase, syncRunId, {
        status: errors.length ? "partial" : "completed",
        startedAt: runStarted,
        seen,
        inserted,
        updated,
        merged,
        skipped,
        normalized: result.records.length,
        errors,
        summary: { timelines },
      });

      summary.sources.push({
        sourceKey,
        status: errors.length ? "partial" : "completed",
        seen,
        inserted,
        updated,
        merged,
        skipped,
        timelines,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown candidate intelligence sync error";
      errors.push(message);
      summary.errors.push(`${sourceKey}: ${message}`);
      summary.ok = false;

      await finishCandidateIntelSyncRun(supabase, syncRunId, {
        status: "failed",
        startedAt: runStarted,
        seen,
        inserted,
        updated,
        merged,
        skipped,
        normalized: seen,
        errors,
      }).catch(() => undefined);

      summary.sources.push({
        sourceKey,
        status: "failed",
        seen,
        inserted,
        updated,
        merged,
        skipped,
        timelines,
        error: message,
      });
    }

    summary.totals.seen += seen;
    summary.totals.inserted += inserted;
    summary.totals.updated += updated;
    summary.totals.merged += merged;
    summary.totals.skipped += skipped;
    summary.totals.timelines += timelines;
  }

  summary.completedAt = new Date().toISOString();
  summary.durationMs = Date.now() - started;
  return summary;
}
