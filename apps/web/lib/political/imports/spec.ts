// ─────────────────────────────────────────────────────────────────────────────
// Importer spec interface — one ImporterSpec per kind.
//
// The shared preview/commit/rollback orchestrators in `./pipeline.ts` are
// table-agnostic: they call into the spec for parsing, dedup, and insert.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportKind } from "./types";

export interface ParseOk<TPayload> {
  ok: true;
  payload: TPayload;
}

export interface ParseErr {
  ok: false;
  reason: string;
}

export type ParseResult<TPayload> = ParseOk<TPayload> | ParseErr;

export interface ImporterSpec<TPayload> {
  kind: ImportKind;

  /** Columns that must appear in the CSV header (canonical names, lowercased). */
  requiredColumns: readonly string[];

  /** Columns we recognize but don't require. Anything else is "unknown". */
  optionalColumns: readonly string[];

  /**
   * Validate the parsed CSV header. The spec knows its own aliases, so it
   * can correctly accept e.g. `usps_state` as a satisfying header for the
   * canonical `state` requirement.
   */
  verifyHeader(headers: string[]): { missing: string[]; unknown: string[] };

  /**
   * Parse + validate one CSV row into the normalized DB payload, OR return
   * a human-readable rejection reason. Pure: must NOT touch the network.
   */
  parseRow(raw: Record<string, string>): ParseResult<TPayload>;

  /**
   * Dedup key for a parsed payload. Must match the value returned by
   * `existingKey` for an equivalent already-stored row. Lowercased.
   */
  dedupKey(payload: TPayload): string;

  /**
   * Load the set of dedup keys for rows already present in the database.
   * Called once at preview/commit time.
   */
  loadExistingKeys(supabase: SupabaseClient): Promise<Set<string>>;

  /**
   * Insert a batch of validated payloads, tagging each with `import_id`.
   * Returns the number of rows actually inserted (may be less than the
   * input if the DB-level unique index rejected late dupes).
   *
   * Implementations should chunk to avoid hitting PostgREST payload limits.
   */
  insertBatch(
    supabase: SupabaseClient,
    payloads: TPayload[],
    importId: string,
  ): Promise<number>;
}
