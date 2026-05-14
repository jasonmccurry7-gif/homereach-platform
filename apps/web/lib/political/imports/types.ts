// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the political CSV importers.
//
// These are the wire types the Server Actions return and the client UI
// renders. Keep them serializable (no Date objects, no functions, no Maps).
// ─────────────────────────────────────────────────────────────────────────────

export type ImportKind = "routes" | "organizations";

/** Severity of a per-row preview verdict. */
export type RowVerdict =
  | "valid"        // Passes validation; no existing match → will INSERT
  | "duplicate"    // Passes validation; existing match found → will be SKIPPED
  | "invalid";     // Fails validation; will be REJECTED

export interface PreviewRow {
  /** 1-based row number from the CSV (excluding header). */
  lineNumber: number;
  verdict: RowVerdict;
  /** Human-readable reason (always present for invalid + duplicate). */
  reason?: string;
  /** Parsed + normalized payload that would land in the DB. */
  parsed?: Record<string, unknown>;
  /** Raw CSV row as parsed (header → value), for diagnostics. */
  raw: Record<string, string>;
}

export interface ImportPreview {
  kind: ImportKind;
  /** Provenance label captured from the upload form. */
  source: string;
  /** Original filename from the upload. */
  originalFilename: string | null;
  /** sha256 of the file contents. */
  fileSha256: string;
  /** Headers as parsed (lowercased, trimmed). */
  headers: string[];
  /** Header validation summary. */
  headerCheck: HeaderCheck;
  /** Per-row preview verdicts, capped to PREVIEW_ROW_CAP. */
  rows: PreviewRow[];
  /** Counts across the FULL parsed file (not capped). */
  totals: {
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
  };
  /**
   * If the file had previously been uploaded (matching sha256), this is the
   * existing import_id and its status. Lets the UI warn before re-import.
   */
  priorUpload?: {
    importId: string;
    status: string;
    uploadedAt: string;
  };
}

export interface HeaderCheck {
  ok: boolean;
  missingRequired: string[];
  unknown: string[];
}

export interface CommitResult {
  ok: boolean;
  importId?: string;
  inserted: number;
  skipped: number;
  rejected: number;
  error?: string;
}

export interface RollbackResult {
  ok: boolean;
  importId: string;
  rowsRemoved: number;
  error?: string;
}

export interface ImportLogRow {
  id: string;
  kind: ImportKind;
  source: string;
  originalFilename: string | null;
  uploadedAt: string;
  rowCountTotal: number;
  rowCountAccepted: number;
  rowCountRejected: number;
  rowCountDuplicate: number;
  status: "previewed" | "committed" | "rolled_back" | "failed";
  committedAt: string | null;
  rollbackAt: string | null;
  rowsCurrentlyAttached: number;
}

/** Hard cap on the row count returned from preview. Avoids huge payloads. */
export const PREVIEW_ROW_CAP = 200;

/** Hard cap on rows we will commit in a single import call. */
export const COMMIT_ROW_CAP = 50_000;
