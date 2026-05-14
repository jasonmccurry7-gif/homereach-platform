"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ImportWorkbench — shared client component for routes + organizations CSV
// imports.
//
// Workflow:
//   1. Operator uploads a CSV file (kept in-memory only)
//   2. Operator picks a 'source' label (provenance) from a curated list
//   3. Click "Preview" → calls previewImportAction, shows per-row table
//   4. Operator reviews valid / duplicate / invalid counts and sample rows
//   5. Click "Commit import" → calls commitImportAction
//   6. UI shows the new importId + counts; links to the audit log
//
// No data leaves the operator's browser until they click Preview, and even
// then the file goes via Server Action (not a third-party).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  previewImportAction,
  commitImportAction,
} from "../actions";
import type { ImportPreview, ImportKind, PreviewRow } from "@/lib/political/imports/types";

interface SourceOption {
  readonly value: string;
  readonly label: string;
  readonly hint: string;
}

interface Props {
  kind: ImportKind;
  /** Curated list of approved provenance labels for this kind. */
  sourceOptions: readonly SourceOption[];
  /** Required column names to display in the spec card. */
  requiredColumns: readonly string[];
  /** Optional column names to display in the spec card. */
  optionalColumns: readonly string[];
  /** Path to the format-spec section in the docs (relative to /docs). */
  formatDocPath: string;
}

type Step = "upload" | "preview" | "committed";

export function ImportWorkbench(props: Props) {
  const [step, setStep] = useState<Step>("upload");

  // upload state
  const [csvText, setCsvText] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(null);
  const [source, setSource] = useState<string>(props.sourceOptions[0]?.value ?? "");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // preview state
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [acknowledgePrior, setAcknowledgePrior] = useState<boolean>(false);

  // commit result
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [commitImportId, setCommitImportId] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.`);
      return;
    }
    setError(null);
    const text = await file.text();
    setCsvText(text);
    setFilename(file.name);
  }

  async function onPreview() {
    setBusy(true);
    setError(null);
    setPreview(null);
    setAcknowledgePrior(false);
    const res = await previewImportAction({
      kind: props.kind,
      csvText,
      source,
      originalFilename: filename,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPreview(res.preview);
    setStep("preview");
  }

  async function onCommit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const res = await commitImportAction({
      kind: props.kind,
      csvText,
      source,
      originalFilename: filename,
      acknowledgePriorUpload: acknowledgePrior,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Commit failed.");
      return;
    }
    setCommitMsg(`Inserted ${res.inserted}, skipped ${res.skipped} duplicates, rejected ${res.rejected}.`);
    setCommitImportId(res.importId ?? null);
    setStep("committed");
  }

  function reset() {
    setStep("upload");
    setCsvText("");
    setFilename(null);
    setPreview(null);
    setError(null);
    setCommitMsg(null);
    setCommitImportId(null);
    setAcknowledgePrior(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <SpecCard
        kind={props.kind}
        requiredColumns={props.requiredColumns}
        optionalColumns={props.optionalColumns}
        formatDocPath={props.formatDocPath}
      />

      {step === "upload" && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Upload CSV</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              CSV file (≤ 50 MB)
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="block w-full text-sm text-slate-700 file:mr-4 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
            {filename && (
              <p className="text-xs text-slate-500">
                Loaded: <code className="font-mono">{filename}</code> · {csvText.length.toLocaleString()} bytes
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Provenance (source)
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              {props.sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value} title={opt.hint}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {props.sourceOptions.find((o) => o.value === source)?.hint}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={!csvText || busy}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? "Validating…" : "Preview"}
            </button>
            {csvText && (
              <button
                type="button"
                onClick={reset}
                className="text-sm text-slate-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {error && <ErrorBanner message={error} />}
        </section>
      )}

      {step === "preview" && preview && (
        <PreviewPanel
          preview={preview}
          busy={busy}
          acknowledgePrior={acknowledgePrior}
          onAcknowledgePriorChange={setAcknowledgePrior}
          onCommit={onCommit}
          onBack={() => setStep("upload")}
          error={error}
        />
      )}

      {step === "committed" && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <h2 className="text-base font-semibold text-emerald-900">Import committed</h2>
          <p className="text-sm text-emerald-900">{commitMsg}</p>
          {commitImportId && (
            <p className="text-xs text-emerald-800">
              Import ID:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono">
                {commitImportId}
              </code>
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded border border-emerald-700 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              Import another file
            </button>
            <a
              href="/admin/political/imports"
              className="rounded border border-emerald-700 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              View import history
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec card
// ─────────────────────────────────────────────────────────────────────────────

function SpecCard(props: {
  kind: ImportKind;
  requiredColumns: readonly string[];
  optionalColumns: readonly string[];
  formatDocPath: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <p className="font-medium text-slate-900">
        Required columns (any common alias accepted):
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {props.requiredColumns.map((c) => (
          <code
            key={c}
            className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200"
          >
            {c}
          </code>
        ))}
      </div>
      {props.optionalColumns.length > 0 && (
        <>
          <p className="mt-3 font-medium text-slate-900">Optional columns:</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {props.optionalColumns.map((c) => (
              <code
                key={c}
                className="rounded bg-white px-2 py-0.5 font-mono text-xs text-slate-600 ring-1 ring-slate-200"
              >
                {c}
              </code>
            ))}
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Full spec + approved sources:{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
          {props.formatDocPath}
        </code>{" "}
        (in the repo).
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error banner
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner(props: { message: string }) {
  return (
    <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
      {props.message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PreviewPanel
// ─────────────────────────────────────────────────────────────────────────────

function PreviewPanel(props: {
  preview: ImportPreview;
  busy: boolean;
  acknowledgePrior: boolean;
  onAcknowledgePriorChange: (v: boolean) => void;
  onCommit: () => void;
  onBack: () => void;
  error: string | null;
}) {
  const { preview } = props;
  const t = preview.totals;
  const canCommit =
    preview.headerCheck.ok &&
    t.valid > 0 &&
    (!preview.priorUpload || props.acknowledgePrior);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Preview</h2>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Rows total"       value={t.total} />
          <Stat label="Will insert"      value={t.valid}     tone="emerald" />
          <Stat label="Skip (duplicate)" value={t.duplicate} tone="amber" />
          <Stat label="Reject (invalid)" value={t.invalid}   tone="rose" />
        </dl>

        {!preview.headerCheck.ok && (
          <ErrorBanner
            message={`Required column(s) missing from header: ${preview.headerCheck.missingRequired.join(", ")}. Fix the file and re-upload.`}
          />
        )}

        {preview.headerCheck.unknown.length > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Unknown columns will be ignored:{" "}
            {preview.headerCheck.unknown.map((u) => (
              <code key={u} className="mr-1 rounded bg-amber-50 px-1 font-mono">{u}</code>
            ))}
          </p>
        )}

        {preview.priorUpload && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">⚠ This exact file has been uploaded before.</p>
            <p className="mt-1 text-xs">
              Prior import:{" "}
              <code className="font-mono">{preview.priorUpload.importId}</code>{" "}
              (status: <strong>{preview.priorUpload.status}</strong>, uploaded:{" "}
              {new Date(preview.priorUpload.uploadedAt).toLocaleString()}).
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={props.acknowledgePrior}
                onChange={(e) => props.onAcknowledgePriorChange(e.target.checked)}
              />
              I understand and want to commit anyway.
            </label>
          </div>
        )}
      </div>

      <PreviewTable rows={preview.rows} />

      {props.error && <ErrorBanner message={props.error} />}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onCommit}
          disabled={!canCommit || props.busy}
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {props.busy ? "Committing…" : `Commit ${t.valid.toLocaleString()} row${t.valid === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      </div>
    </section>
  );
}

function Stat(props: { label: string; value: number; tone?: "emerald" | "amber" | "rose" }) {
  const toneClass =
    props.tone === "emerald" ? "text-emerald-700" :
    props.tone === "amber"   ? "text-amber-700"   :
    props.tone === "rose"    ? "text-rose-700"    : "text-slate-900";
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{props.label}</dt>
      <dd className={`mt-1 text-xl font-semibold ${toneClass}`}>
        {props.value.toLocaleString()}
      </dd>
    </div>
  );
}

function PreviewTable(props: { rows: PreviewRow[] }) {
  if (props.rows.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-500">
        No rows parsed.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
        First {props.rows.length} rows (capped for preview)
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold text-slate-700">#</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Verdict</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Reason / Payload</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r) => (
              <tr key={r.lineNumber} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 text-slate-500 font-mono">{r.lineNumber}</td>
                <td className="px-3 py-2">
                  <VerdictPill verdict={r.verdict} />
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {r.reason && <div className="text-slate-700">{r.reason}</div>}
                  {r.parsed && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-blue-700">parsed</summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
{JSON.stringify(r.parsed, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerdictPill(props: { verdict: PreviewRow["verdict"] }) {
  const cls =
    props.verdict === "valid"     ? "bg-emerald-100 text-emerald-800" :
    props.verdict === "duplicate" ? "bg-amber-100 text-amber-800"     :
                                    "bg-rose-100 text-rose-800";
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {props.verdict}
    </span>
  );
}
