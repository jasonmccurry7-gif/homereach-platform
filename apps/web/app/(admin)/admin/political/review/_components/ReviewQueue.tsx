"use client";

import { useState, useTransition } from "react";
import { reviewStagingRecordAction, batchReviewAction } from "../actions";
import type { ReviewRow } from "../page";

// ─────────────────────────────────────────────────────────────────────────────
// ReviewQueue — per-row + per-batch approve/reject UI for the staging tables.
// ─────────────────────────────────────────────────────────────────────────────

interface Counts { candidate: number; organization: number; campaign: number }

interface Props {
  rows: ReviewRow[];
  counts: Counts;
  activeKind: "candidate" | "organization" | "campaign" | null;
  activeBatch: string | null;
}

export function ReviewQueue(props: Props) {
  return (
    <div className="space-y-3">
      <KindFilter counts={props.counts} active={props.activeKind} batch={props.activeBatch} />
      {props.activeBatch && (
        <BatchControls
          importBatchId={props.activeBatch}
          activeKind={props.activeKind}
        />
      )}
      <Table rows={props.rows} />
    </div>
  );
}

function KindFilter(props: {
  counts: Counts;
  active: Props["activeKind"];
  batch: string | null;
}) {
  const buttons: { label: string; href: string; active: boolean; count: number | null }[] = [
    { label: "All",           href: maybeBatch("/admin/political/review", props.batch),                            active: !props.active, count: null },
    { label: "Candidates",    href: maybeBatch("/admin/political/review?kind=candidate", props.batch),             active: props.active === "candidate",    count: props.counts.candidate },
    { label: "Organizations", href: maybeBatch("/admin/political/review?kind=organization", props.batch),          active: props.active === "organization", count: props.counts.organization },
    { label: "Campaigns",     href: maybeBatch("/admin/political/review?kind=campaign", props.batch),              active: props.active === "campaign",     count: props.counts.campaign },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded border border-slate-200 bg-white p-1">
      {buttons.map((b) => (
        <a
          key={b.href}
          href={b.href}
          className={
            b.active
              ? "rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          }
        >
          {b.label}
          {b.count !== null && (
            <span className={"ml-1.5 rounded px-1.5 py-0.5 text-[10px] " +
              (b.active ? "bg-white/20" : "bg-slate-100 text-slate-700")}>
              {b.count}
            </span>
          )}
        </a>
      ))}
      {props.batch && (
        <a
          href={props.active ? `/admin/political/review?kind=${props.active}` : "/admin/political/review"}
          className="ml-auto rounded px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          Clear batch filter ({props.batch.slice(0, 8)}…)
        </a>
      )}
    </nav>
  );
}

function maybeBatch(base: string, batch: string | null): string {
  if (!batch) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}batch=${encodeURIComponent(batch)}`;
}

function BatchControls(props: {
  importBatchId: string;
  activeKind: Props["activeKind"];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const kind = props.activeKind ?? "candidate"; // batch action requires a kind; default to candidate

  function run(action: "approve" | "reject") {
    if (!props.activeKind) {
      setResult({ ok: false, message: "Pick a kind tab (Candidates / Organizations / Campaigns) before running a batch action." });
      return;
    }
    const confirmed = confirm(
      `${action === "approve" ? "APPROVE" : "REJECT"} every pending ${kind} record in batch ${props.importBatchId.slice(0, 8)}…?\nThis is a bulk action and may affect many rows.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = await batchReviewAction({
        kind: kind as "candidate" | "organization" | "campaign",
        importBatchId: props.importBatchId,
        action,
      });
      if (res.ok) {
        setResult({ ok: true, message: `Marked ${res.affected} row(s) as ${action}d.` });
      } else {
        setResult({ ok: false, message: res.error ?? "Batch action failed." });
      }
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-amber-900">
          Filtered to import batch{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
            {props.importBatchId}
          </code>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run("approve")}
            disabled={pending}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Approve all pending in batch
          </button>
          <button
            type="button"
            onClick={() => run("reject")}
            disabled={pending}
            className="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            Reject all pending in batch
          </button>
        </div>
      </div>
      {result && (
        <div className={
          "mt-2 rounded p-2 text-xs " +
          (result.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900")
        }>
          {result.message}
        </div>
      )}
    </div>
  );
}

function Table(props: { rows: ReviewRow[] }) {
  if (props.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          Queue empty. Run a FEC ingestion from{" "}
          <a href="/admin/political/data-sources" className="text-blue-700 hover:underline">
            /admin/political/data-sources
          </a>{" "}
          to populate.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Kind</th>
            <th className="px-3 py-2 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Office / Type</th>
            <th className="px-3 py-2 font-semibold">Jurisdiction / State</th>
            <th className="px-3 py-2 font-semibold">Cycle</th>
            <th className="px-3 py-2 font-semibold">Source</th>
            <th className="px-3 py-2 font-semibold">Match?</th>
            <th className="px-3 py-2 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <Row key={`${r.record_kind}-${r.id}`} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row(props: { row: ReviewRow }) {
  const r = props.row;
  const [pending, startTransition] = useTransition();
  const [verdict, setVerdict] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: "approve" | "reject") {
    startTransition(async () => {
      setError(null);
      const res = await reviewStagingRecordAction({
        kind: r.record_kind,
        id: r.id,
        action,
      });
      if (res.ok) {
        setVerdict(action === "approve" ? "approved" : "rejected");
      } else {
        setError(res.error ?? "Action failed");
      }
    });
  }

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2">
        <KindBadge kind={r.record_kind} />
      </td>
      <td className="px-3 py-2 font-medium text-slate-900">{r.display_name}</td>
      <td className="px-3 py-2 text-slate-700">{r.detail_1 ?? "—"}</td>
      <td className="px-3 py-2 text-slate-700">{r.detail_2 ?? r.state ?? "—"}</td>
      <td className="px-3 py-2 text-slate-700">{r.cycle ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-slate-700">
        <div className="font-mono">{r.source_type}</div>
        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
            source ↗
          </a>
        )}
        {r.import_batch_id && (
          <div className="mt-0.5">
            <a
              href={`/admin/political/review?batch=${r.import_batch_id}`}
              className="text-[11px] text-slate-500 hover:underline"
            >
              filter to batch
            </a>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-500">
        {r.match_confidence !== null ? `${r.match_confidence.toFixed(0)}%` : "—"}
      </td>
      <td className="px-3 py-2">
        {verdict ? (
          <span className={
            verdict === "approved"
              ? "inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
              : "inline-flex rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800"
          }>
            {verdict}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => run("approve")}
              disabled={pending}
              className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => run("reject")}
              disabled={pending}
              className="rounded border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
        {error && <div className="mt-1 text-[11px] text-rose-700">{error}</div>}
      </td>
    </tr>
  );
}

function KindBadge(props: { kind: ReviewRow["record_kind"] }) {
  const map = {
    candidate:    "bg-blue-100 text-blue-800",
    organization: "bg-purple-100 text-purple-800",
    campaign:     "bg-emerald-100 text-emerald-800",
  } as const;
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${map[props.kind]}`}>
      {props.kind}
    </span>
  );
}
