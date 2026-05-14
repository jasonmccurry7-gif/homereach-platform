// ─────────────────────────────────────────────────────────────────────────────
// FEC ingestion orchestrator.
//
// Fetches FEC candidates or committees, writes them to the staging tables
// with full provenance, and creates a `political_imports` audit row that
// the existing rollback machinery understands.
//
// IDEMPOTENT: a partial unique index on (source_id, source_record_id) makes
// re-runs safe — duplicates are skipped at the DB level.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listFecCandidates, listFecCommittees,
  type FecClientOptions,
} from "./client";
import {
  normalizeFecCandidate, normalizeFecCommittee,
} from "./normalize";

export type FecIngestionKind = "candidates" | "committees";

export interface FecIngestionArgs {
  kind: FecIngestionKind;
  cycle: number;
  state?: string;                  // 2-letter, optional
  uploadedBy: string | null;
  /** Hard cap to avoid runaway pulls during dev. */
  maxRecords?: number;
  apiKey?: string;
}

export interface FecIngestionResult {
  ok: boolean;
  importId?: string;
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  durationMs: number;
  error?: string;
  isDemoKey?: boolean;
}

const SOURCE_KEYS = {
  candidates: "fec_candidates_v1",
  committees: "fec_committees_v1",
} as const;

export async function runFecIngestion(
  supabase: SupabaseClient,
  args: FecIngestionArgs,
): Promise<FecIngestionResult> {
  const startedAt = Date.now();

  // 1. Resolve the data source row
  const { data: src, error: srcErr } = await supabase
    .from("political_data_sources")
    .select("id, source_key, license_notes, enabled")
    .eq("source_key", SOURCE_KEYS[args.kind])
    .single();

  if (srcErr || !src) {
    return {
      ok: false, fetched: 0, inserted: 0, skipped: 0, failed: 0,
      durationMs: Date.now() - startedAt,
      error: `Data source ${SOURCE_KEYS[args.kind]} not registered. Run migration 071.`,
    };
  }

  if (!src.enabled) {
    return {
      ok: false, fetched: 0, inserted: 0, skipped: 0, failed: 0,
      durationMs: Date.now() - startedAt,
      error: `Data source ${src.source_key} is disabled. Enable it in /admin/political/data-sources before running.`,
    };
  }

  // 2. Create a political_imports audit row up front so every staging row
  //    can carry import_batch_id from the start. Migration 071 extended the
  //    kind check constraint to support staging-specific values so the
  //    rollback path can dispatch to the right table.
  const sourceLabel = `${src.source_key}_${args.cycle}${args.state ? `_${args.state}` : ""}`;
  const importKind: "fec_candidates" | "fec_committees" =
    args.kind === "candidates" ? "fec_candidates" : "fec_committees";

  const { data: importRow, error: impErr } = await supabase
    .from("political_imports")
    .insert({
      kind: importKind,
      source: sourceLabel,
      original_filename: null,
      file_sha256: null,
      uploaded_by: args.uploadedBy,
      row_count_total: 0,
      row_count_accepted: 0,
      row_count_rejected: 0,
      row_count_duplicate: 0,
      status: "previewed",
      notes: `FEC ${args.kind} ingestion · cycle ${args.cycle}${args.state ? ` · state ${args.state}` : ""}`,
    })
    .select("id")
    .single();

  if (impErr || !importRow) {
    return {
      ok: false, fetched: 0, inserted: 0, skipped: 0, failed: 0,
      durationMs: Date.now() - startedAt,
      error: `Failed to create audit row: ${impErr?.message ?? "unknown"}`,
    };
  }
  const importId = importRow.id as string;

  // 3. Fetch + normalize + insert
  const clientOpts: FecClientOptions = {
    apiKey: args.apiKey,
    maxRecords: args.maxRecords ?? 5000,
  };
  const isDemoKey =
    !args.apiKey && (process.env.FEC_API_KEY === undefined || process.env.FEC_API_KEY === "");

  let fetched = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    if (args.kind === "candidates") {
      const records = await listFecCandidates(
        { cycle: args.cycle, state: args.state, candidate_status: "C" },
        clientOpts,
      );
      fetched = records.length;

      const chunkSize = 200;
      for (let i = 0; i < records.length; i += chunkSize) {
        const slice = records.slice(i, i + chunkSize).map((c) => {
          const n = normalizeFecCandidate(c, args.cycle);
          return {
            import_batch_id: importId,
            source_id: src.id,
            source_type: "fec_api",
            source_url: `https://api.open.fec.gov/v1/candidate/${c.candidate_id}/`,
            source_record_id: n.source_record_id,
            source_license_notes: src.license_notes,
            raw_payload: n.raw_payload,
            candidate_name: n.candidate_name,
            party_optional: n.party_optional,
            incumbent_optional: n.incumbent_optional,
            office_text: n.office_text,
            jurisdiction_text: n.jurisdiction_text,
            district: n.district,
            state: n.state,
            cycle: n.cycle,
            dedupe_hash: n.dedupe_hash,
            data_confidence_score: n.data_confidence_score,
            // Defaults: validation_status = 'valid', review_status = 'pending'
          };
        });

        const { data, error } = await supabase
          .from("staging_candidates")
          .upsert(slice, {
            onConflict: "source_id,source_record_id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (error) {
          failed += slice.length;
          errors.push(`chunk[${i}]: ${error.message}`);
        } else {
          inserted += data?.length ?? 0;
          skipped += slice.length - (data?.length ?? 0);
        }
      }
    } else {
      const records = await listFecCommittees(
        { cycle: args.cycle, state: args.state },
        clientOpts,
      );
      fetched = records.length;

      const chunkSize = 200;
      for (let i = 0; i < records.length; i += chunkSize) {
        const slice = records.slice(i, i + chunkSize).map((c) => {
          const n = normalizeFecCommittee(c);
          return {
            import_batch_id: importId,
            source_id: src.id,
            source_type: "fec_api",
            source_url: `https://api.open.fec.gov/v1/committee/${c.committee_id}/`,
            source_record_id: n.source_record_id,
            source_license_notes: src.license_notes,
            raw_payload: n.raw_payload,
            legal_name: n.legal_name,
            display_name: n.display_name,
            org_type: n.org_type,
            state: n.state,
            primary_contact_name: n.primary_contact_name,
            primary_contact_email: n.primary_contact_email,
            address: n.address,
            linked_candidate_source_id: n.linked_candidate_source_id,
            dedupe_hash: n.dedupe_hash,
            data_confidence_score: n.data_confidence_score,
          };
        });

        const { data, error } = await supabase
          .from("staging_organizations")
          .upsert(slice, {
            onConflict: "source_id,source_record_id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (error) {
          failed += slice.length;
          errors.push(`chunk[${i}]: ${error.message}`);
        } else {
          inserted += data?.length ?? 0;
          skipped += slice.length - (data?.length ?? 0);
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "unknown error");
  }

  const durationMs = Date.now() - startedAt;
  const ok = errors.length === 0;

  // 4. Update audit row + data source last-run fields
  await supabase
    .from("political_imports")
    .update({
      status: ok ? "committed" : "failed",
      committed_at: ok ? new Date().toISOString() : null,
      row_count_total: fetched,
      row_count_accepted: inserted,
      row_count_duplicate: skipped,
      row_count_rejected: failed,
      sample_rejections: errors.slice(0, 20).map((e, i) => ({
        row: i + 1,
        reason: e,
        raw: null,
      })),
    })
    .eq("id", importId);

  await supabase
    .from("political_data_sources")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: ok ? "ok" : (inserted > 0 ? "partial" : "failed"),
      last_run_summary: {
        fetched, inserted, skipped, failed, durationMs,
        cycle: args.cycle, state: args.state ?? null,
        importId,
        errors: errors.slice(0, 5),
      },
    })
    .eq("id", src.id);

  return {
    ok,
    importId,
    fetched, inserted, skipped, failed,
    durationMs,
    error: errors.length > 0 ? errors.slice(0, 3).join("; ") : undefined,
    isDemoKey,
  };
}
