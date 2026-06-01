"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ClipboardCheck, MessageSquare, Rocket, XCircle } from "lucide-react";

type Props = {
  launchPackageId?: string | null;
  approvalId?: string | null;
  admin?: boolean;
};

const clientActions = [
  { actionType: "approve", label: "Approve", icon: CheckCircle2 },
  { actionType: "request_changes", label: "Changes", icon: MessageSquare },
  { actionType: "question", label: "Question", icon: MessageSquare },
];

const adminActions = [
  { actionType: "mark_ready", label: "Ready", icon: ClipboardCheck },
  { actionType: "manual_launch_complete", label: "Manual Launch", icon: Rocket },
  { actionType: "reject", label: "Reject", icon: XCircle },
];

export function AdTechActions({ admin = false, approvalId, launchPackageId }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const actions = admin ? adminActions : clientActions;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map(({ actionType, icon: Icon, label }) => (
          <button
            key={actionType}
            type="button"
            disabled={isPending}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                try {
                  const response = await fetch("/api/ad-tech/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      actionType,
                      approvalId,
                      launchPackageId,
                      notes: `${label} recorded from ${admin ? "admin" : "client"} campaign launch workflow.`,
                    }),
                  });
                  const data = await response.json().catch(() => ({}));
                  if (!response.ok) throw new Error(data.error || "Action failed");
                  setMessage(`${label} recorded.`);
                  window.location.reload();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Action failed");
                }
              });
            }}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {message ? <p className="text-xs font-semibold text-slate-500">{message}</p> : null}
    </div>
  );
}
