"use client";

import { useState, useTransition } from "react";
import type { GovContractPipelineStatus } from "@/lib/gov-contracts/types";

const STATUS_LABELS: Record<GovContractPipelineStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  strong_fit: "Strong Fit",
  need_subcontractor: "Need Subcontractor",
  bid_prep: "Bid Prep",
  awaiting_approval: "Awaiting Approval",
  submitted: "Submitted",
  awarded: "Awarded",
  lost: "Lost",
  no_bid: "No Bid",
  archived: "Archived",
};

export function OpportunityStatusActions({
  opportunityId,
  initialStatus,
}: {
  opportunityId: string;
  initialStatus: GovContractPipelineStatus;
}) {
  const [status, setStatus] = useState<GovContractPipelineStatus>(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(nextStatus: GovContractPipelineStatus) {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/admin/gov-contracts/opportunities/${encodeURIComponent(opportunityId)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Status update failed.");
        return;
      }
      setStatus(nextStatus);
      setMessage(payload.persisted ? "Saved." : "Updated in this review session. Database persistence is not active yet.");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("reviewing")}
          className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
        >
          Save for Review
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("no_bid")}
          className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-60"
        >
          Mark No Bid
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus("archived")}
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 disabled:opacity-60"
        >
          Archive
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Current status: <span className="font-semibold text-slate-700">{STATUS_LABELS[status]}</span>
        {message ? <span className="ml-2 text-blue-700">{message}</span> : null}
      </p>
    </div>
  );
}
