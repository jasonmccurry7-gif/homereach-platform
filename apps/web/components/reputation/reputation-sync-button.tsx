"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReputationSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runSync() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/reputation/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Sync failed");
        return;
      }
      setMessage(`${payload.recordsTouched ?? 0} records synced`);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={runSync}
        disabled={isPending}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
      >
        <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} aria-hidden="true" />
        Sync Reputation
      </button>
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </div>
  );
}
