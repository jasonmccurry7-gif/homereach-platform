"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

type SyncState =
  | { status: "idle"; message: string | null }
  | { status: "loading"; message: string | null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function GoogleBusinessProfileSyncButton({ disabled }: { disabled?: boolean }) {
  const [state, setState] = useState<SyncState>({ status: "idle", message: null });

  async function runSync() {
    setState({ status: "loading", message: null });
    const response = await fetch("/api/admin/google-business-profile/sync", { method: "POST" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response || !response.ok || !payload?.ok) {
      setState({
        status: "error",
        message: payload?.error ?? "Google Business Profile sync could not run.",
      });
      return;
    }

    const result = payload.result ?? {};
    setState({
      status: "success",
      message: `Read-only sync complete: ${result.accounts ?? 0} accounts, ${result.locations ?? 0} locations, ${result.reviews ?? 0} reviews.`,
    });
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={disabled || state.status === "loading"}
        onClick={runSync}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${state.status === "loading" ? "animate-spin" : ""}`} />
        {state.status === "loading" ? "Syncing GBP" : "Run Read-Only Sync"}
      </button>
      {state.message && (
        <p className={state.status === "error" ? "text-xs font-bold text-rose-200" : "text-xs font-bold text-emerald-200"}>
          {state.message}
        </p>
      )}
    </div>
  );
}
