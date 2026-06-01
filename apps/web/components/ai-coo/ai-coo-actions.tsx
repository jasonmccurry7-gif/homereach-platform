"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Send, X } from "lucide-react";
import type { AiCooDraftRow, AiCooRecommendationRow } from "@/lib/ai-coo/recommendations";

type Props = {
  recommendation: AiCooRecommendationRow;
  drafts?: AiCooDraftRow[];
  compact?: boolean;
};

const ACTION_TYPE_BY_LABEL: Record<string, string> = {
  Launch: "launch",
  Review: "review",
  "Create Campaign": "create_campaign",
  "Create Proposal": "create_proposal",
  "Assign Task": "assign_task",
  "Review Savings": "review_savings",
  "Launch Campaign": "launch_campaign",
  "Create Draft": "create_draft",
  Assign: "assign",
  Fix: "fix",
  Dismiss: "dismiss",
  Approve: "approve",
};

const DRAFT_COPY_LABELS: Record<string, string> = {
  email: "Copy Email",
  sms: "Copy SMS",
  dm: "Copy DM",
  proposal_intro: "Copy Proposal",
  client_follow_up: "Copy Follow-Up",
  renewal_message: "Copy Renewal",
  upsell_message: "Copy Upsell",
};

function actionTypeFor(label: string) {
  return ACTION_TYPE_BY_LABEL[label] ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function postAction(recommendationId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/ai-coo/recommendations/${recommendationId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "AI COO action failed.");
  return data;
}

export function AiCooActions({ recommendation, drafts = [], compact = false }: Props) {
  const router = useRouter();
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visibleActions = useMemo(() => {
    const labels = recommendation.action_labels ?? [];
    const actionLabels = labels.filter((label) => !/^copy/i.test(label));
    const limit = compact ? 6 : 8;
    if (actionLabels.includes("Dismiss") && actionLabels.indexOf("Dismiss") >= limit) {
      return [...actionLabels.slice(0, limit - 1), "Dismiss"];
    }
    return actionLabels.slice(0, limit);
  }, [recommendation.action_labels, compact]);
  const visibleDrafts = useMemo(() => {
    const order = ["email", "sms", "dm", "proposal_intro", "client_follow_up", "renewal_message", "upsell_message"];
    return [...drafts].sort((a, b) => order.indexOf(a.draft_type) - order.indexOf(b.draft_type)).slice(0, compact ? 3 : 7);
  }, [drafts, compact]);

  async function runAction(label: string) {
    setBusyLabel(label);
    setError(null);
    try {
      await postAction(recommendation.id, {
        actionType: actionTypeFor(label),
        label,
        notes: label === "Dismiss" ? "Dismissed from AI COO feed." : `${label} requested. Human approval still required before execution.`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI COO action failed.");
    } finally {
      setBusyLabel(null);
    }
  }

  async function copyDraft(draft: AiCooDraftRow) {
    const label = DRAFT_COPY_LABELS[draft.draft_type] ?? "Copy Draft";
    setBusyLabel(label);
    setError(null);
    try {
      await navigator.clipboard.writeText(draft.content);
      setCopiedDraftId(draft.id);
      await postAction(recommendation.id, {
        actionType: `copy_${draft.draft_type}`,
        label,
        draftId: draft.id,
        notes: "Copied draft text. Human approval is still required before outbound use.",
      });
      setTimeout(() => setCopiedDraftId(null), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setBusyLabel(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((label) => {
          const destructive = label === "Dismiss";
          return (
            <button
              key={label}
              type="button"
              disabled={busyLabel !== null}
              onClick={() => void runAction(label)}
              className={
                destructive
                  ? "inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  : "inline-flex min-h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
              }
            >
              {destructive ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
              {busyLabel === label ? "Saving..." : label}
            </button>
          );
        })}
      </div>

      {visibleDrafts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visibleDrafts.map((draft) => {
            const copied = copiedDraftId === draft.id;
            const label = DRAFT_COPY_LABELS[draft.draft_type] ?? "Copy Draft";
            return (
              <button
                key={draft.id}
                type="button"
                disabled={busyLabel !== null}
                onClick={() => void copyDraft(draft)}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? "Copied" : label}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
    </div>
  );
}
