"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

type SavingsAction = {
  label: string;
  actionType?: string;
  href?: string;
  payload?: Record<string, unknown>;
};

export function OwnerSavingsActionButtons({
  actions,
  compact = false,
}: {
  actions: SavingsAction[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createAction(action: SavingsAction) {
    if (!action.actionType) return;

    setLoading(action.actionType);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/operations-copilot/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: action.actionType,
          title: action.label,
          payload: {
            source: "owner_savings_dashboard",
            approvalOnly: true,
            liveOrderingEnabled: false,
            ...action.payload,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Action could not be saved.");
      setMessage("Saved for owner review. No order, vendor change, or spend change was made.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action could not be saved.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className={compact ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-5"}>
        {actions.map((action, index) => {
          const primary = index === 0;
          const className = primary
            ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-emerald-200 disabled:opacity-60"
            : "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60";

          if (action.href) {
            return (
              <Link key={`${action.label}-${action.href}`} href={action.href} className={className}>
                {primary ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
                {action.label}
              </Link>
            );
          }

          return (
            <button
              key={`${action.label}-${action.actionType}`}
              type="button"
              onClick={() => createAction(action)}
              disabled={loading !== null}
              className={className}
            >
              {loading === action.actionType ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : primary ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : null}
              {loading === action.actionType ? "Saving..." : action.label}
            </button>
          );
        })}
      </div>
      {message ? (
        <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
