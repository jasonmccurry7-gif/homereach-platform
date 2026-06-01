"use client";

import { useState, useTransition } from "react";
import { Check, Clipboard, Copy, Eye, ThumbsDown, X } from "lucide-react";
import type { CostControlDraftRow, CostControlOpportunityRow } from "@/lib/cost-control/engine";
import { cn } from "@/lib/utils";

type Props = {
  opportunity: CostControlOpportunityRow;
  drafts?: CostControlDraftRow[];
  compact?: boolean;
};

const ACTIONS = [
  { type: "review", label: "Review", icon: Eye },
  { type: "assign", label: "Assign", icon: Clipboard },
  { type: "approve", label: "Approve", icon: Check },
  { type: "dismiss", label: "Dismiss", icon: X },
];

export function CostControlActions({ compact = false, drafts = [], opportunity }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function record(actionType: string, draftId?: string) {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/cost-control/opportunities/${opportunity.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, draftId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setMessage(payload.error ?? "Action failed");
        return;
      }
      setMessage(actionType === "copy_draft" ? "Copied and logged" : "Saved");
    });
  }

  async function copyDraft(draft: CostControlDraftRow) {
    await navigator.clipboard.writeText(draft.content);
    record("copy_draft", draft.id);
  }

  return (
    <div className="space-y-3">
      <div className={cn("flex flex-wrap gap-2", compact && "grid grid-cols-2")}>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.type}
              type="button"
              disabled={isPending}
              onClick={() => record(action.type)}
              className={cn(
                "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-black transition",
                action.type === "approve"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : action.type === "dismiss"
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {action.label}
            </button>
          );
        })}
      </div>

      {drafts.length > 0 ? (
        <div className="grid gap-2">
          {drafts.slice(0, compact ? 2 : 6).map((draft) => (
            <button
              key={draft.id}
              type="button"
              disabled={isPending}
              onClick={() => copyDraft(draft)}
              className="inline-flex min-h-9 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-black text-slate-700 hover:bg-slate-50"
              title={`Copy ${draft.label}`}
            >
              <span className="truncate">{draft.label}</span>
              <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {message ? (
        <p className={cn("text-xs font-bold", message.includes("failed") ? "text-rose-700" : "text-emerald-700")}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isPending}
        onClick={() => record("reject")}
        className="inline-flex min-h-8 items-center gap-1.5 text-xs font-black text-slate-500 hover:text-rose-700"
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
        Reject
      </button>
    </div>
  );
}
