"use client";

import { useState, useTransition } from "react";
import { rescoreCandidatesAction, type RescoreResult } from "../actions";

export function RescoreButton({ lastRunLabel }: { lastRunLabel: string | null }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RescoreResult | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await rescoreCandidatesAction();
      setResult(res);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Rescoring…" : "Rescore now"}
      </button>

      {!result && lastRunLabel && (
        <span className="text-slate-500">Last rescore: {lastRunLabel}</span>
      )}

      {result?.ok && (
        <span className="text-emerald-700">
          ✓ Scanned {result.candidatesScanned?.toLocaleString()} · updated{" "}
          {result.candidatesUpdated?.toLocaleString()} in {result.durationMs ?? 0}ms
          {result.tierCounts && (
            <span className="ml-1 text-slate-500">
              ({result.tierCounts.hot} hot · {result.tierCounts.warm} warm · {result.tierCounts.cold} cold)
            </span>
          )}
        </span>
      )}

      {result && !result.ok && (
        <span className="text-rose-700">
          ✗ {result.error ?? "Rescore failed"}
        </span>
      )}
    </div>
  );
}
