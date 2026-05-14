// ─────────────────────────────────────────────────────────────────────────────
// Shared preview / commit / rollback orchestrators.
//
// Inputs are the parsed CSV text + metadata. Outputs match the wire types
// in `./types.ts`. All Supabase access goes through the service-role client
// (callers are admin-gated by the layout + middleware + an explicit check
// in the server action).
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCsv, sha256Hex } from "./csv";
import type {
  ImportPreview,
  PreviewRow,
  CommitResult,
  RollbackResult,
  HeaderCheck,
  ImportLogRow,
  ImportKind,
} from "./types";
import { PREVIEW_ROW_CAP, COMMIT_ROW_CAP } from "./types";
import type { ImporterSpec } from "./spec";

// ─────────────────────────────────────────────────────────────────────────────
// Header validation — delegates to the spec because each spec owns its
// alias map.
// ─────────────────────────────────────────────────────────────────────────────

function checkHeaders<T>(
  headers: string[],
  spec: ImporterSpec<T>,
): HeaderCheck {
  const { missing, unknown } = spec.verifyHeader(headers);
  return { ok: missing.length === 0, missingRequired: missing, unknown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview
// ─────────────────────────────────────────────────────────────────────────────

export async function runPreview<T>(args: {
  supabase: SupabaseClient;
  spec: ImporterSpec<T>;
  csvText: string;
  source: string;
  originalFilename: string | null;
}): Promise<ImportPreview> {
  const { supabase, spec, csvText, source, originalFilename } = args;

  const fileSha256 = await sha256Hex(csvText);
  const parsed = parseCsv(csvText);
  const headerCheck = checkHeaders(parsed.headers, spec);

  // Fetch existing keys BEFORE iterating rows so duplicate detection is
  // correct on the first row.
  let existing = new Set<string>();
  if (headerCheck.ok) {
    existing = await spec.loadExistingKeys(supabase);
  }

  const seenInBatch = new Set<string>();
  const rows: PreviewRow[] = [];
  let totalValid = 0;
  let totalDup = 0;
  let totalInvalid = 0;

  for (let i = 0; i < parsed.rows.length; i++) {
    const raw = parsed.rows[i];
    if (!raw) continue;
    const lineNumber = i + 1;

    if (!headerCheck.ok) {
      // Don't bother validating rows when the header is broken
      if (rows.length < PREVIEW_ROW_CAP) {
        rows.push({
          lineNumber,
          verdict: "invalid",
          reason: "Skipped: required column(s) missing from header",
          raw,
        });
      }
      totalInvalid++;
      continue;
    }

    const result = spec.parseRow(raw);
    if (!result.ok) {
      totalInvalid++;
      if (rows.length < PREVIEW_ROW_CAP) {
        rows.push({ lineNumber, verdict: "invalid", reason: result.reason, raw });
      }
      continue;
    }

    const key = spec.dedupKey(result.payload);
    if (existing.has(key) || seenInBatch.has(key)) {
      totalDup++;
      const reason = existing.has(key)
        ? "Duplicate of existing row in database"
        : "Duplicate within this CSV (earlier row wins)";
      if (rows.length < PREVIEW_ROW_CAP) {
        rows.push({
          lineNumber,
          verdict: "duplicate",
          reason,
          parsed: result.payload as Record<string, unknown>,
          raw,
        });
      }
      continue;
    }

    seenInBatch.add(key);
    totalValid++;
    if (rows.length < PREVIEW_ROW_CAP) {
      rows.push({
        lineNumber,
        verdict: "valid",
        parsed: result.payload as Record<string, unknown>,
        raw,
      });
    }
  }

  // Prior-upload check
  let priorUpload: ImportPreview["priorUpload"];
  const { data: prior } = await supabase
    .from("political_imports")
    .select("id, status, uploaded_at")
    .eq("kind", spec.kind)
    .eq("file_sha256", fileSha256)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prior) {
    priorUpload = {
      importId: prior.id,
      status: prior.status,
      uploadedAt: prior.uploaded_at,
    };
  }

  return {
    kind: spec.kind,
    source,
    originalFilename,
    fileSha256,
    headers: parsed.headers,
    headerCheck,
    rows,
    totals: {
      total: parsed.rows.length,
      valid: totalValid,
      duplicate: totalDup,
      invalid: totalInvalid,
    },
    priorUpload,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commit
// ─────────────────────────────────────────────────────────────────────────────

export async function runCommit<T>(args: {
  supabase: SupabaseClient;
  spec: ImporterSpec<T>;
  csvText: string;
  source: string;
  originalFilename: string | null;
  uploadedBy: string | null;
}): Promise<CommitResult> {
  const { supabase, spec, csvText, source, originalFilename, uploadedBy } = args;

  // Re-run preview to get the validated payloads (cheap; same parse).
  const preview = await runPreview({ supabase, spec, csvText, source, originalFilename });

  if (!preview.headerCheck.ok) {
    return {
      ok: false,
      inserted: 0,
      skipped: 0,
      rejected: preview.totals.total,
      error: `Header missing required column(s): ${preview.headerCheck.missingRequired.join(", ")}`,
    };
  }

  if (preview.totals.valid > COMMIT_ROW_CAP) {
    return {
      ok: false,
      inserted: 0,
      skipped: 0,
      rejected: 0,
      error: `Refusing to commit ${preview.totals.valid} rows in a single import (cap: ${COMMIT_ROW_CAP}). Split the file.`,
    };
  }

  // Re-parse the FULL file to recover all valid payloads (preview.rows is
  // capped at PREVIEW_ROW_CAP). The CSV is in memory; parsing twice is
  // O(2n) and still cheap relative to the network roundtrip.
  const parsed = parseCsv(csvText);
  const existing = await spec.loadExistingKeys(supabase);
  const seenInBatch = new Set<string>();
  const validPayloads: T[] = [];
  const sampleRejections: { row: number; reason: string; raw: Record<string, string> }[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const raw = parsed.rows[i];
    if (!raw) continue;
    const result = spec.parseRow(raw);
    if (!result.ok) {
      if (sampleRejections.length < 50) {
        sampleRejections.push({ row: i + 1, reason: result.reason, raw });
      }
      continue;
    }
    const key = spec.dedupKey(result.payload);
    if (existing.has(key) || seenInBatch.has(key)) continue;
    seenInBatch.add(key);
    validPayloads.push(result.payload);
  }

  // Create the import audit row first so we have an importId to tag rows.
  const fileSha256 = preview.fileSha256;

  const { data: importRow, error: importErr } = await supabase
    .from("political_imports")
    .insert({
      kind: spec.kind,
      source,
      original_filename: originalFilename,
      file_sha256: fileSha256,
      uploaded_by: uploadedBy,
      row_count_total: preview.totals.total,
      row_count_accepted: preview.totals.valid,
      row_count_rejected: preview.totals.invalid,
      row_count_duplicate: preview.totals.duplicate,
      sample_rejections: sampleRejections,
      status: "previewed",
    })
    .select("id")
    .single();

  if (importErr || !importRow) {
    return {
      ok: false,
      inserted: 0,
      skipped: preview.totals.duplicate,
      rejected: preview.totals.invalid,
      error: `Failed to create import audit row: ${importErr?.message ?? "unknown"}`,
    };
  }

  const importId = importRow.id as string;

  // Insert the validated payloads
  let inserted = 0;
  try {
    inserted = await spec.insertBatch(supabase, validPayloads, importId);
  } catch (err) {
    // Mark the audit row failed so the operator can see what happened.
    await supabase
      .from("political_imports")
      .update({
        status: "failed",
        notes: err instanceof Error ? err.message : "Unknown insert error",
      })
      .eq("id", importId);

    // Best-effort cleanup of any rows that landed before the failure.
    await supabase
      .from(spec.kind === "routes" ? "political_routes" : "political_organizations")
      .delete()
      .eq("import_id", importId);

    return {
      ok: false,
      importId,
      inserted: 0,
      skipped: preview.totals.duplicate,
      rejected: preview.totals.invalid,
      error: err instanceof Error ? err.message : "Unknown insert error",
    };
  }

  // Mark the audit row committed
  await supabase
    .from("political_imports")
    .update({
      status: "committed",
      committed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  return {
    ok: true,
    importId,
    inserted,
    skipped: preview.totals.duplicate,
    rejected: preview.totals.invalid,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rollback
// ─────────────────────────────────────────────────────────────────────────────

export async function runRollback(args: {
  supabase: SupabaseClient;
  importId: string;
  rolledBackBy: string | null;
}): Promise<RollbackResult> {
  const { supabase, importId, rolledBackBy } = args;

  // Look up the audit row to know which table to wipe from
  const { data: importRow, error: lookupErr } = await supabase
    .from("political_imports")
    .select("id, kind, status")
    .eq("id", importId)
    .single();

  if (lookupErr || !importRow) {
    return {
      ok: false,
      importId,
      rowsRemoved: 0,
      error: `Import not found: ${lookupErr?.message ?? "no row"}`,
    };
  }

  if (importRow.status === "rolled_back") {
    return {
      ok: false,
      importId,
      rowsRemoved: 0,
      error: "This import has already been rolled back.",
    };
  }

  // Dispatch by kind: live-table imports use `import_id`; staging-table
  // ingestions use `import_batch_id`.
  const STAGING_KINDS = new Set([
    "fec_candidates", "fec_committees",
    "oh_sos_candidates", "oh_sos_committees",
    "boe_candidates",
  ]);

  let table: string;
  let filterColumn: "import_id" | "import_batch_id";
  switch (importRow.kind) {
    case "routes":
      table = "political_routes";
      filterColumn = "import_id";
      break;
    case "organizations":
      table = "political_organizations";
      filterColumn = "import_id";
      break;
    case "fec_candidates":
    case "oh_sos_candidates":
    case "boe_candidates":
      table = "staging_candidates";
      filterColumn = "import_batch_id";
      break;
    case "fec_committees":
    case "oh_sos_committees":
      table = "staging_organizations";
      filterColumn = "import_batch_id";
      break;
    default:
      return {
        ok: false,
        importId,
        rowsRemoved: 0,
        error: `No rollback handler registered for kind '${importRow.kind}'.`,
      };
  }

  // For LIVE organizations: a rollback that would orphan a real campaign is
  // dangerous. The political_campaigns.organization_id FK is ON DELETE
  // SET NULL, so deletion would silently disconnect campaigns. Block the
  // rollback if any org row in this batch is currently referenced.
  if (importRow.kind === "organizations") {
    const { data: orgIds } = await supabase
      .from("political_organizations")
      .select("id")
      .eq("import_id", importId);

    if (orgIds && orgIds.length > 0) {
      const ids = orgIds.map((r) => r.id);
      const { count } = await supabase
        .from("political_campaigns")
        .select("id", { count: "exact", head: true })
        .in("organization_id", ids);

      if ((count ?? 0) > 0) {
        return {
          ok: false,
          importId,
          rowsRemoved: 0,
          error: `Refusing to roll back: ${count} political_campaign rows still reference organizations from this import. Reassign or delete those campaigns first.`,
        };
      }
    }
  }

  // For STAGING kinds: refuse to roll back if any row in this batch has
  // already been promoted to live (review_status = 'promoted'). Operator
  // would lose the live link silently.
  if (STAGING_KINDS.has(importRow.kind)) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(filterColumn, importId)
      .eq("review_status", "promoted");
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        importId,
        rowsRemoved: 0,
        error: `Refusing to roll back: ${count} row(s) in this batch have already been promoted to the live tables. Roll back the promotion first (Phase 1B).`,
      };
    }
  }

  const { data: deleted, error: delErr } = await supabase
    .from(table)
    .delete()
    .eq(filterColumn, importId)
    .select("id");

  if (delErr) {
    return {
      ok: false,
      importId,
      rowsRemoved: 0,
      error: `Delete failed: ${delErr.message}`,
    };
  }

  await supabase
    .from("political_imports")
    .update({
      status: "rolled_back",
      rollback_at: new Date().toISOString(),
      rollback_by: rolledBackBy,
    })
    .eq("id", importId);

  return {
    ok: true,
    importId,
    rowsRemoved: deleted?.length ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log fetch
// ─────────────────────────────────────────────────────────────────────────────

export async function listImports(args: {
  supabase: SupabaseClient;
  kind?: ImportKind;
  limit?: number;
}): Promise<ImportLogRow[]> {
  const { supabase, kind, limit = 100 } = args;

  let q = supabase
    .from("political_import_summary")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (kind) q = q.eq("kind", kind);

  const { data, error } = await q;
  if (error) throw new Error(`listImports: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    source: r.source,
    originalFilename: r.original_filename,
    uploadedAt: r.uploaded_at,
    rowCountTotal: r.row_count_total,
    rowCountAccepted: r.row_count_accepted,
    rowCountRejected: r.row_count_rejected,
    rowCountDuplicate: r.row_count_duplicate,
    status: r.status,
    committedAt: r.committed_at,
    rollbackAt: r.rollback_at,
    rowsCurrentlyAttached: r.rows_currently_attached,
  }));
}
