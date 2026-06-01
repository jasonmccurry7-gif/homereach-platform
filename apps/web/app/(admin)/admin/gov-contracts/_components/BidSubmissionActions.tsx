"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { GovContractPipelineStatus } from "@/lib/gov-contracts/types";

export function BidSubmissionActions({
  opportunityId,
  compact = false,
}: {
  opportunityId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<GovContractPipelineStatus | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [isPending, startTransition] = useTransition();

  function exportPackage() {
    router.push(`/admin/gov-contracts/${encodeURIComponent(opportunityId)}/review-packet`);
  }

  function runResearch() {
    router.push(`/admin/gov-contracts/${encodeURIComponent(opportunityId)}/market-research`);
  }

  function statusLabel(status: GovContractPipelineStatus) {
    return status.replaceAll("_", " ");
  }

  function openApproval(status: GovContractPipelineStatus) {
    setMessage(null);
    setApprovalStatus(status);
  }

  function updateStatus(status: GovContractPipelineStatus) {
    const note = approvalNote.trim();
    const reference = externalReference.trim();
    if (!note) {
      setMessage("A human approval note is required before this status can be recorded.");
      setApprovalStatus(status);
      return;
    }
    if (["submitted", "under_evaluation", "awarded"].includes(status) && !reference) {
      setMessage("External confirmation, portal reference, award notice, or submission evidence is required for this status.");
      setApprovalStatus(status);
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/admin/gov-contracts/opportunities/${encodeURIComponent(opportunityId)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          approvalConfirmed: true,
          note,
          externalSubmissionReference: reference || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Status update failed.");
        return;
      }
      setMessage(`${statusLabel(status)} recorded${payload.persisted ? "" : " for this review session"}.`);
      setApprovalStatus(null);
      setApprovalNote("");
      setExternalReference("");
      router.refresh();
    });
  }

  const buttonBase = compact
    ? "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-black"
    : "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-black";

  return (
    <div className="space-y-2">
      <div className={compact ? "grid gap-2" : "flex flex-wrap gap-2"}>
        <button
          type="button"
          onClick={exportPackage}
          className={`${buttonBase} bg-white text-slate-950 ring-1 ring-slate-200 hover:bg-slate-50`}
        >
          Preview Review Packet
        </button>
        <button
          type="button"
          onClick={runResearch}
          className={`${buttonBase} bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100`}
        >
          Run Market Research
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => openApproval("ready_to_submit")}
          className={`${buttonBase} bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-60`}
        >
          Mark Ready For Approval
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => openApproval("submitted")}
          className={`${buttonBase} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-60`}
        >
          Mark Submitted
        </button>
      </div>
      {approvalStatus ? (
        <div className="rounded-xl border border-amber-200 bg-white p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-800">
            Human approval note required
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
            Recording {statusLabel(approvalStatus)} documents owner confirmation only. It does not submit externally,
            certify compliance, accept an award, approve pricing, or commit subcontractors.
          </p>
          <textarea
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            placeholder="Reviewer, evidence checked, and final submission/approval context"
            rows={compact ? 3 : 2}
            className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          {["submitted", "under_evaluation", "awarded"].includes(approvalStatus) ? (
            <input
              value={externalReference}
              onChange={(event) => setExternalReference(event.target.value)}
              placeholder="External confirmation, portal reference, submission receipt, or award notice"
              className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          ) : null}
          <div className={compact ? "mt-2 grid gap-2" : "mt-2 flex flex-wrap gap-2"}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateStatus(approvalStatus)}
              className={`${buttonBase} bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60`}
            >
              Record {statusLabel(approvalStatus)}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setApprovalStatus(null);
                setApprovalNote("");
                setExternalReference("");
              }}
              className={`${buttonBase} bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <p className="text-[11px] font-semibold leading-4 text-slate-500">
        Submission actions are human-gated. Exporting creates a review packet; marking submitted records owner confirmation only.
      </p>
      {message ? <p className="text-xs font-semibold text-blue-700">{message}</p> : null}
    </div>
  );
}
