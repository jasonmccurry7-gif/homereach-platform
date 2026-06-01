"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function GrowthIntelligenceSyncButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sync() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/growth-intelligence/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Sync failed");
        return;
      }
      setMessage(`Synced ${payload.recordsTouched ?? 0} growth signals`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={sync}
        disabled={isPending}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
        {isPending ? "Syncing" : "Sync Intelligence"}
      </button>
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </div>
  );
}
