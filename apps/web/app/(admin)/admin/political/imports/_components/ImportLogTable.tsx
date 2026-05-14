"use client";

import { useState, useTransition } from "react";
import { rollbackImportAction } from "../actions";
import type { ImportLogRow } from "@/lib/political/imports/types";

// ─────────────────────────────────────────────────────────────────────────────
// ImportLogTable — renders the import-history table with inline rollback.
// ─────────────────────────────────────────────────────────────────────────────

export function ImportLogTable(props: {
  rows: ImportLogRow[];
  highlight: string | null;
}) {
  if (props.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">No imports yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">When</th>
            <th className="px-3 py-2 font-semibold">Kind</th>
            <th className="px-3 py-2 font-semibold">Source</th>
            <th className="px-3 py-2 font-semibold">File</th>
            <th className="px-3 py-2 font-semibold text-right">Total</th>
            <th className="px-3 py-2 font-semibold text-right">Inserted</th>
            <th className="px-3 py-2 font-semibold text-right">Skipped</th>
            <th className="px-3 py-2 font-semibold text-right">Rejected</th>
            <th className="px-3 py-2 font-semibold text-right">Live</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <Row key={r.id} row={r} highlighted={props.highlight === r.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row(props: { row: ImportLogRow; highlighted: boolean }) {
  const r = props.row;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function onRollback() {
    const confirmed = confirm(
      `Roll back this import?\n\nKind: ${r.kind}\nSource: ${r.source}\nRows currently attached: ${r.rowsCurrentlyAttached}\n\nThis will DELETE ${r.rowsCurrentlyAttached} row(s) tagged with import ${r.id}. This cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await rollbackImportAction(r.id);
      if (res.ok) {
        setResult({ ok: true, message: `Removed ${res.rowsRemoved} row(s). Refresh to see updated state.` });
      } else {
        setResult({ ok: false, message: res.error ?? "Rollback failed." });
      }
    });
  }

  const canRollback = r.status === "committed" && r.rowsCurrentlyAttached > 0;

  return (
    <>
      <tr
        className={`border-t border-slate-100 align-top ${props.highlighted ? "bg-amber-50" : ""}`}
      >
        <td className="px-3 py-2 text-xs text-slate-700">
          {new Date(r.uploadedAt).toLocaleString()}
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {r.kind}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-slate-700">{r.source}</td>
        <td className="px-3 py-2">
          <div className="font-mono text-xs text-slate-700">{r.originalFilename ?? "—"}</div>
          <div className="font-mono text-[10px] text-slate-400">{r.id.slice(0, 8)}…</div>
        </td>
        <td className="px-3 py-2 text-right text-xs text-slate-700">{r.rowCountTotal.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs text-emerald-700">{r.rowCountAccepted.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs text-amber-700">{r.rowCountDuplicate.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs text-rose-700">{r.rowCountRejected.toLocaleString()}</td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-slate-900">
          {r.rowsCurrentlyAttached.toLocaleString()}
        </td>
        <td className="px-3 py-2">
          <StatusPill status={r.status} />
        </td>
        <td className="px-3 py-2">
          {canRollback ? (
            <button
              type="button"
              onClick={onRollback}
              disabled={pending}
              className="rounded border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {pending ? "Rolling back…" : "Rollback"}
            </button>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
      </tr>
      {result && (
        <tr className="border-t border-slate-100">
          <td colSpan={11} className="px-3 py-2">
            <div
              className={
                result.ok
                  ? "rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900"
                  : "rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900"
              }
            >
              {result.message}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusPill(props: { status: ImportLogRow["status"] }) {
  const map = {
    previewed:    "bg-slate-100 text-slate-700",
    committed:    "bg-emerald-100 text-emerald-800",
    rolled_back:  "bg-amber-100 text-amber-800",
    failed:       "bg-rose-100 text-rose-800",
  } as const;
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[props.status]}`}>
      {props.status}
    </span>
  );
}
