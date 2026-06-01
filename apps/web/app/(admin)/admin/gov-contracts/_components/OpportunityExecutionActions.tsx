"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ActionName =
  | "save"
  | "assign_owner"
  | "evaluate_fit"
  | "no_bid"
  | "team_opportunity"
  | "find_subcontractor"
  | "export_opportunity"
  | "build_response_package";

const ACTION_LABELS: Record<ActionName, string> = {
  save: "Save Opportunity",
  assign_owner: "Assign Owner",
  evaluate_fit: "Evaluate Fit",
  no_bid: "No-Bid",
  team_opportunity: "Team Opportunity",
  find_subcontractor: "Find Subcontractor",
  export_opportunity: "Export Opportunity",
  build_response_package: "Build Draft Package",
};

function destinationFor(action: ActionName, opportunityId: string) {
  const encoded = encodeURIComponent(opportunityId);
  if (action === "save") return "/admin/gov-contracts?status=saved";
  if (action === "assign_owner") return "/admin/gov-contracts?status=reviewing";
  if (action === "evaluate_fit") return `/admin/gov-contracts/${encoded}/bid-room?tab=overview`;
  if (action === "no_bid") return "/admin/gov-contracts?status=no_bid";
  if (action === "team_opportunity") return `/admin/gov-contracts/${encoded}/bid-room?tab=crm`;
  if (action === "find_subcontractor") return `/admin/gov-contracts/${encoded}/bid-room?tab=subcontractors`;
  if (action === "export_opportunity") return `/admin/gov-contracts/${encoded}/review-packet`;
  if (action === "build_response_package") return `/admin/gov-contracts/${encoded}/bid-room?tab=proposal`;
  return `/admin/gov-contracts/${encoded}`;
}

export function OpportunityExecutionActions({
  opportunityId,
  sourceUrl,
  compact = false,
}: {
  opportunityId: string;
  sourceUrl?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(action: ActionName) {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/admin/gov-contracts/opportunities/${encodeURIComponent(opportunityId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Action failed.");
        return;
      }
      const suffix = payload.warning
        ? ` ${payload.warning}`
        : `${payload.persisted ? "" : " for this review session"}.`;
      setMessage(`${ACTION_LABELS[action]} recorded${suffix}`);
      router.push(payload.redirectTo ?? destinationFor(action, opportunityId));
    });
  }

  function startBid() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/admin/gov-contracts/opportunities/${encodeURIComponent(opportunityId)}/start-bid`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Start bid failed.");
        return;
      }
      if (payload.warning) setMessage(payload.warning);
      router.push(payload.redirectTo ?? `/admin/gov-contracts/${encodeURIComponent(opportunityId)}/bid-room?tab=overview`);
    });
  }

  const buttonBase = compact
    ? "inline-flex items-center justify-center rounded-lg px-3 py-2 text-center text-xs font-black leading-4"
    : "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-black";
  const secondaryActions = compact ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2";

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Bid desk decision</p>
        <div className={compact ? "mt-2 grid gap-2" : "mt-2 grid gap-2 sm:grid-cols-2"}>
          <button
            type="button"
            disabled={isPending}
            onClick={startBid}
            className={`${buttonBase} bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60`}
          >
            Start Bid Workspace
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction("evaluate_fit")}
            className={`${buttonBase} bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100 disabled:opacity-60`}
          >
            Evaluate Fit
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction("no_bid")}
            className={`${buttonBase} bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-60`}
          >
            No-Bid
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction("find_subcontractor")}
            className={`${buttonBase} bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100 disabled:opacity-60`}
          >
            Find Subcontractor
          </button>
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">
          These actions create internal bid work, fit review, no-bid rationale, or partner sourcing. They do not submit,
          certify compliance, approve pricing, or commit spend.
        </p>
      </div>

      <div className={secondaryActions}>
        <Link
          href={`/admin/gov-contracts/${encodeURIComponent(opportunityId)}`}
          className={`${buttonBase} bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50`}
        >
          View Details
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction("save")}
          className={`${buttonBase} bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60`}
        >
          Save Opportunity
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction("assign_owner")}
          className={`${buttonBase} bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60`}
        >
          Assign Owner
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction("team_opportunity")}
          className={`${buttonBase} bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200 hover:bg-cyan-100 disabled:opacity-60`}
        >
          Team Opportunity
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={startBid}
          className={`${buttonBase} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-60`}
        >
          Build Draft Package
        </button>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={`${buttonBase} bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50`}
          >
            Official Notice
          </a>
        ) : null}
      </div>
      {message ? <p className="text-xs font-semibold text-blue-700">{message}</p> : null}
    </div>
  );
}
