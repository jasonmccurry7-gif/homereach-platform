"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

export function ApprovalActionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loadingDecision, setLoadingDecision] = useState<
    "approved" | "rejected" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    const confirmed = window.confirm(
      `${decision === "approved" ? "Approve" : "Reject"} this Supplify decision?\n\nThis records the owner decision only. Supplier orders, vendor changes, and spend still require the governed downstream workflow.`,
    );
    if (!confirmed) return;

    setLoadingDecision(decision);
    setError(null);

    try {
      const response = await fetch("/api/operations-copilot/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Decision could not be saved");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision could not be saved");
    } finally {
      setLoadingDecision(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={loadingDecision !== null}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-bold text-neutral-950 transition-colors hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {loadingDecision === "approved" ? "Approving..." : "Approve Request"}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={loadingDecision !== null}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300/40 px-3 py-2 text-sm font-bold text-red-100 transition-colors hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          {loadingDecision === "rejected" ? "Rejecting..." : "Reject Request"}
        </button>
      </div>
      <p className="text-xs leading-5 text-neutral-500">
        Approval records the owner decision only; supplier orders, vendor changes,
        and spend still require the governed downstream workflow.
      </p>
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
