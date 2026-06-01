"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function AdTechSyncButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const response = await fetch("/api/admin/ad-tech/sync", { method: "POST" });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.error || "Sync failed");
              setMessage(`Synced ${data.recordsTouched ?? 0} records.`);
              window.location.reload();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Sync failed");
            }
          });
        }}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
        {isPending ? "Syncing" : "Sync Draft Layer"}
      </button>
      {message ? <p className="max-w-xs text-xs font-semibold text-slate-500">{message}</p> : null}
    </div>
  );
}
