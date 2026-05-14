"use client";

import { useState, useTransition } from "react";
import {
  runFecIngestionAction,
  toggleDataSourceEnabledAction,
} from "../actions";
import type { DataSourceRow } from "../page";

// ─────────────────────────────────────────────────────────────────────────────
// DataSourcesTable — interactive list of registered data sources.
// ─────────────────────────────────────────────────────────────────────────────

export function DataSourcesTable(props: { rows: DataSourceRow[] }) {
  if (props.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          No data sources registered. Run migration 071 to seed the FEC / OH SoS / BOE entries.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Source</th>
            <th className="px-3 py-2 font-semibold">Kind</th>
            <th className="px-3 py-2 font-semibold">Reliability</th>
            <th className="px-3 py-2 font-semibold">Cadence</th>
            <th className="px-3 py-2 font-semibold">Enabled</th>
            <th className="px-3 py-2 font-semibold">Last run</th>
            <th className="px-3 py-2 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row(props: { row: DataSourceRow }) {
  const r = props.row;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [enabled, setEnabled] = useState<boolean>(r.enabled);

  // FEC ingestion controls
  const [cycle, setCycle] = useState<number>(2026);
  const [state, setState] = useState<string>("OH");

  const isFec = r.source_key.startsWith("fec_");
  const isFecApi = r.source_key === "fec_candidates_v1" || r.source_key === "fec_committees_v1";

  function onToggleEnabled() {
    const next = !enabled;
    startTransition(async () => {
      const res = await toggleDataSourceEnabledAction({ id: r.id, enabled: next });
      if (res.ok) {
        setEnabled(next);
      } else {
        setResult({ ok: false, message: res.error ?? "Toggle failed" });
      }
    });
  }

  function onRunFec() {
    if (!enabled) {
      setResult({ ok: false, message: "Enable the source before running ingestion." });
      return;
    }
    const kind: "candidates" | "committees" =
      r.source_key === "fec_candidates_v1" ? "candidates" : "committees";

    startTransition(async () => {
      setResult(null);
      const res = await runFecIngestionAction({
        kind,
        cycle,
        state: state || undefined,
        maxRecords: 5000,
      });
      if (res.ok) {
        const demo = res.isDemoKey ? " (DEMO_KEY — slow)" : "";
        setResult({
          ok: true,
          message: `Ingested${demo}: fetched ${res.fetched}, inserted ${res.inserted}, skipped ${res.skipped}, failed ${res.failed} (${(res.durationMs / 1000).toFixed(1)}s).`,
        });
      } else {
        setResult({ ok: false, message: res.error ?? "Ingestion failed" });
      }
    });
  }

  return (
    <>
      <tr className="border-t border-slate-100 align-top">
        <td className="px-3 py-2">
          <div className="font-medium text-slate-900">{r.display_name}</div>
          <div className="text-xs text-slate-500">{r.publisher}</div>
          {r.homepage_url && (
            <a
              href={r.homepage_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-700 hover:underline"
            >
              {new URL(r.homepage_url).hostname}
            </a>
          )}
          {r.license_notes && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-slate-500">license</summary>
              <p className="mt-1 text-xs text-slate-600">{r.license_notes}</p>
            </details>
          )}
        </td>
        <td className="px-3 py-2">
          <KindPill kind={r.kind} />
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {r.reliability_tier}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-slate-700">{r.refresh_cadence}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggleEnabled}
            disabled={pending}
            className={
              "rounded px-2 py-1 text-xs font-medium " +
              (enabled
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300")
            }
          >
            {enabled ? "Enabled" : "Disabled"}
          </button>
        </td>
        <td className="px-3 py-2 text-xs text-slate-700">
          {r.last_run_at ? (
            <>
              <div>{new Date(r.last_run_at).toLocaleString()}</div>
              <StatusPill status={r.last_run_status} />
              {r.last_run_summary && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-slate-500">summary</summary>
                  <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-[10px]">
{JSON.stringify(r.last_run_summary, null, 2)}
                  </pre>
                </details>
              )}
            </>
          ) : (
            <span className="text-slate-400">never run</span>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          {isFecApi ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={2000}
                max={2050}
                step={2}
                value={cycle}
                onChange={(e) => setCycle(parseInt(e.target.value || "0", 10) || 2026)}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                title="Cycle (election year)"
              />
              <input
                type="text"
                value={state}
                maxLength={2}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="w-12 rounded border border-slate-300 px-2 py-1 text-xs uppercase"
                title="2-letter state (blank = all)"
                placeholder="OH"
              />
              <button
                type="button"
                onClick={onRunFec}
                disabled={pending || !enabled}
                className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {pending ? "Running…" : "Run now"}
              </button>
            </div>
          ) : isFec ? (
            <span className="text-xs text-slate-400">use Imports → CSV</span>
          ) : (
            <span className="text-xs text-slate-400">Phase 4</span>
          )}
        </td>
      </tr>
      {result && (
        <tr className="border-t border-slate-100">
          <td colSpan={7} className="px-3 py-2">
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

function KindPill(props: { kind: DataSourceRow["kind"] }) {
  const map = {
    api:    "bg-blue-100 text-blue-800",
    bulk:   "bg-purple-100 text-purple-800",
    csv:    "bg-cyan-100 text-cyan-800",
    crawl:  "bg-amber-100 text-amber-800",
    manual: "bg-slate-100 text-slate-700",
  } as const;
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[props.kind]}`}>
      {props.kind}
    </span>
  );
}

function StatusPill(props: { status: string | null }) {
  if (!props.status) return null;
  const map: Record<string, string> = {
    ok:      "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    failed:  "bg-rose-100 text-rose-800",
  };
  const cls = map[props.status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {props.status}
    </span>
  );
}
