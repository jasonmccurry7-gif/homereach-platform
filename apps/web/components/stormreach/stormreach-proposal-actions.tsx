"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function StormReachProposalActions({ token }: { token: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestApproval() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/stormreach/proposals/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Client requested review from public StormReach proposal." }),
      });
      const result = await response.json().catch(() => ({}));
      setStatus(result.ok ? "Request captured. HomeReach will review before any campaign work starts." : String(result.error ?? "Request failed."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={requestApproval}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {pending ? "Recording..." : "Request Approval Review"}
      </button>
      {status ? <p className="text-sm font-semibold text-slate-600">{status}</p> : null}
    </div>
  );
}
