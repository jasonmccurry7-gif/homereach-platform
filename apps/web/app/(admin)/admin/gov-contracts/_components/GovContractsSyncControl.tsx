"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function ReadinessItem({
  label,
  ready,
  detail,
}: {
  label: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
          ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {ready ? "✓" : "!"}
      </span>
      <div>
        <p className="text-sm font-black text-slate-950">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export function GovContractsSyncControl({
  samConfigured,
  databaseReady,
  lastRunAt,
}: {
  samConfigured: boolean;
  databaseReady: boolean;
  lastRunAt: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const readyToSync = samConfigured && databaseReady;

  function runSync() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/gov-contracts/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: "OH", limit: 50 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "SAM.gov sync failed.");
        return;
      }
      setMessage(`Sync complete: ${payload.recordsUpserted ?? 0} stored, ${payload.recordsFailed ?? 0} failed.`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Go-live readiness</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">SAM.gov opportunity sync</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Run a controlled Ohio SAM.gov import after the database tables and API key are available. This only imports and
            scores opportunities; it never submits bids or creates outside commitments.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!readyToSync || isPending}
            onClick={runSync}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            title={
              readyToSync
                ? "Import recent Ohio SAM.gov opportunities."
                : "Apply the Supabase migration and add SAM_GOV_API_KEY before running sync."
            }
          >
            {isPending ? "Syncing..." : "Run Ohio SAM.gov Sync"}
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Refresh Status
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ReadinessItem
          label="Database tables"
          ready={databaseReady}
          detail={databaseReady ? "Gov Contracts tables are reachable." : "Apply migration 096 before persistence works."}
        />
        <ReadinessItem
          label="SAM.gov API key"
          ready={samConfigured}
          detail={samConfigured ? "SAM_GOV_API_KEY is configured." : "Waiting on SAM_GOV_API_KEY in Vercel."}
        />
        <ReadinessItem
          label="Last sync"
          ready={Boolean(lastRunAt)}
          detail={lastRunAt ? new Date(lastRunAt).toLocaleString() : "No live sync has run yet."}
        />
      </div>

      {message ? (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${message.includes("failed") ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
