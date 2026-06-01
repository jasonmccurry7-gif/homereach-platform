"use client";

import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ApprovalLedgerSyncButton({
  available,
  disabled,
}: {
  available: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function syncLedger() {
    if (!available || disabled) return;

    try {
      setBusy(true);
      setMessage(null);
      const response = await fetch("/api/admin/approvals/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(String(payload.error ?? "Sync failed"));
        return;
      }

      const synced = Number(payload.synced ?? 0);
      setMessage(`Synced ${synced} item${synced === 1 ? "" : "s"}.`);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const isDisabled = disabled || !available || busy || isPending;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => void syncLedger()}
        disabled={isDisabled}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm font-black text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCcw className={`h-4 w-4 ${busy || isPending ? "animate-spin" : ""}`} />
        Sync Ledger
      </button>
      {message ? <p className="text-xs font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}
