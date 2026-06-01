"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Copy, FileText, Rocket, Send, X } from "lucide-react";
import type { GrowthDraftRow, GrowthOpportunityRow } from "@/lib/growth-intelligence/engine";
import { cn } from "@/lib/utils";

type Props = {
  opportunity: GrowthOpportunityRow;
  drafts?: GrowthDraftRow[];
  compact?: boolean;
};

const ACTIONS = [
  { type: "review", label: "Review", icon: Clipboard },
  { type: "launch", label: "Launch", icon: Rocket },
  { type: "create_campaign", label: "Create Campaign", icon: Send },
  { type: "create_proposal", label: "Create Proposal", icon: FileText },
  { type: "assign_task", label: "Assign Task", icon: Check },
  { type: "dismiss", label: "Dismiss", icon: X },
];

const DRAFT_ORDER = [
  "client_growth_email",
  "client_growth_sms",
  "client_growth_dm",
  "campaign_proposal_intro",
  "internal_strategy_note",
  "seasonal_campaign_message",
  "competitor_area_message",
  "neighborhood_expansion_message",
  "political_opportunity_message",
];

export function GrowthIntelligenceActions({ compact = false, drafts = [], opportunity }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const visibleActions = compact ? ACTIONS.filter((action) => action.type !== "assign_task").slice(0, 4) : ACTIONS;
  const visibleDrafts = useMemo(
    () => [...drafts].sort((a, b) => DRAFT_ORDER.indexOf(a.draft_type) - DRAFT_ORDER.indexOf(b.draft_type)).slice(0, compact ? 3 : 9),
    [drafts, compact],
  );

  async function record(actionType: string, draftId?: string) {
    setBusy(actionType);
    setMessage(null);
    try {
      const response = await fetch(`/api/growth-intelligence/opportunities/${opportunity.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          draftId,
          notes: actionType === "dismiss"
            ? "Dismissed from Growth Intelligence."
            : "Growth Intelligence workflow action recorded. Human approval remains required before outreach or campaign execution.",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Action failed");
      setMessage(actionType === "copy_draft" ? "Copied and logged" : "Saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function copyDraft(draft: GrowthDraftRow) {
    await navigator.clipboard.writeText(draft.content);
    await record("copy_draft", draft.id);
  }

  return (
    <div className="space-y-3">
      <div className={cn("flex flex-wrap gap-2", compact && "grid grid-cols-2")}>
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const primary = ["launch", "create_campaign", "create_proposal"].includes(action.type);
          const destructive = action.type === "dismiss";
          return (
            <button
              key={action.type}
              type="button"
              disabled={busy !== null}
              onClick={() => void record(action.type)}
              className={cn(
                "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-black transition disabled:opacity-50",
                primary && "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
                destructive && "border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-700",
                !primary && !destructive && "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
              title={action.type === "launch" ? "Record a workflow launch request. This does not launch ads or outreach." : action.label}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {busy === action.type ? "Saving..." : action.label}
            </button>
          );
        })}
      </div>

      {visibleDrafts.length > 0 ? (
        <div className="grid gap-2">
          {visibleDrafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void copyDraft(draft)}
              className="inline-flex min-h-9 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title={`Copy ${draft.label}`}
            >
              <span className="truncate">{draft.label}</span>
              <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {message ? (
        <p className={cn("text-xs font-bold", /failed|error|forbidden/i.test(message) ? "text-rose-700" : "text-emerald-700")}>
          {message}
        </p>
      ) : null}

      <p className="text-[11px] font-semibold leading-5 text-slate-500">
        Growth actions are advisory workflow records. HomeReach does not send outreach, launch paid ads, or make sensitive targeting decisions without human approval.
      </p>
    </div>
  );
}
