"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AtSign,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  PenLine,
  Rocket,
  Search,
  Send,
} from "lucide-react";
import type { CandidateLaunchPlanRow } from "@/lib/political/candidate-launch-agent";

interface CandidateAgentActionPanelProps {
  candidateId: string;
  initialPlan?: CandidateLaunchPlanRow | null;
  hasResearch?: boolean;
  compact?: boolean;
  approvalLockedReason?: string | null;
  productionLockedReason?: string | null;
}

type DraftPayload =
  | { type: "proposal"; subject: string; body: string; bullets: string[] }
  | {
      type: "follow_up";
      subject: string;
      body: string;
      toEmail: string | null;
      recipientName: string | null;
      recipientSource: string | null;
      senderEmail: string;
      senderName: string;
      approvalId: string | null;
      approvalStatus: string | null;
      sendReady: boolean;
      missingRequirements: string[];
      politicalOptionsImageUrl: string;
      politicalPlanUrl: string;
    }
  | {
      type: "creative";
      briefs: Array<{
        phase_key: string;
        title: string;
        brief: string;
        brand_mode?: string;
        postcard_type?: string;
        emotional_job?: string;
        visual_hierarchy?: string[];
        typography_system?: string[];
      }>;
    };

const ACTIONS = [
  { action: "manager_email_search", label: "Search Manager Email", icon: AtSign },
  { action: "research", label: "Run Candidate Research", icon: Search },
  { action: "plan", label: "Generate Multi-Phase Plan", icon: ClipboardList },
  { action: "proposal_draft", label: "Generate Proposal Draft", icon: FileText },
  { action: "creative_briefs", label: "Generate Postcard Creative Briefs", icon: PenLine },
  { action: "sales_follow_up", label: "Generate Sales Follow-Up", icon: Mail },
  { action: "approve_plan", label: "Mark Plan Reviewed", icon: CheckCircle2 },
  { action: "production_queue", label: "Stage Production Review", icon: Rocket },
] as const;

export function CandidateAgentActionPanel({
  candidateId,
  initialPlan,
  compact = false,
  approvalLockedReason = null,
  productionLockedReason = null,
}: CandidateAgentActionPanelProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingApprovalId, setSendingApprovalId] = useState<string | null>(null);
  const [planId, setPlanId] = useState(initialPlan?.id ?? null);
  const [planStatus, setPlanStatus] = useState(initialPlan?.status ?? null);

  const canStageProduction = planStatus === "approved" || planStatus === "proposal_ready";
  const statusLabel = useMemo(() => {
    if (!planStatus) return "No plan yet";
    return planStatus.replaceAll("_", " ");
  }, [planStatus]);

  async function runAction(action: string) {
    setBusyAction(action);
    setMessage(null);
    setDraft(null);
    setSendMessage(null);
    setSendError(null);
    try {
      const response = await fetch(`/api/admin/political/candidate-agents/${candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, planId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Action failed.");
      }

      if (payload.result?.plan?.id) {
        setPlanId(payload.result.plan.id);
        setPlanStatus(payload.result.plan.status);
      }
      if (payload.plan?.id) {
        setPlanId(payload.plan.id);
        setPlanStatus(payload.plan.status);
      }
      if (payload.draft?.subject) {
        setDraft(
          payload.action === "sales_follow_up"
            ? {
                type: "follow_up",
                subject: payload.draft.subject,
                body: payload.draft.body,
                toEmail: payload.draft.toEmail ?? null,
                recipientName: payload.draft.recipientName ?? null,
                recipientSource: payload.draft.recipientSource ?? null,
                senderEmail: payload.draft.senderEmail ?? "",
                senderName: payload.draft.senderName ?? "",
                approvalId: payload.draft.approvalId ?? null,
                approvalStatus: payload.draft.approvalStatus ?? null,
                sendReady: Boolean(payload.draft.sendReady),
                missingRequirements: Array.isArray(payload.draft.missingRequirements)
                  ? payload.draft.missingRequirements
                  : [],
                politicalOptionsImageUrl: payload.draft.politicalOptionsImageUrl ?? "",
                politicalPlanUrl: payload.draft.politicalPlanUrl ?? "",
              }
            : {
                type: "proposal",
                subject: payload.draft.subject,
                body: payload.draft.body,
                bullets: payload.draft.bullets ?? [],
              },
        );
      }
      if (payload.creative_briefs) {
        setDraft({ type: "creative", briefs: payload.creative_briefs });
      }

      setMessage(labelForAction(action));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function sendFollowUpEmail(approvalId: string) {
    setSendingApprovalId(approvalId);
    setSendMessage(null);
    setSendError(null);
    try {
      const response = await fetch(`/api/admin/revenue-messaging/approvals/${approvalId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Email send failed. Review sender health and approval metadata.");
      }
      setSendMessage(payload.message ?? "Email sent and logged.");
      router.refresh();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error));
    } finally {
      setSendingApprovalId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold capitalize text-slate-200">
          {statusLabel}
        </span>
        {planId && (
          <span className="rounded-full border border-blue-300/20 bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-100">
            Plan linked
          </span>
        )}
      </div>

      <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"}>
        {ACTIONS.map(({ action, label, icon: Icon }) => {
          const isBusy = busyAction === action;
          const isApprovalBlocked = action === "approve_plan" && Boolean(approvalLockedReason);
          const isProductionBlocked =
            action === "production_queue" && (!canStageProduction || Boolean(productionLockedReason));
          const disabledReason = isApprovalBlocked
            ? approvalLockedReason
            : isProductionBlocked
              ? productionLockedReason ?? "Plan must be approved before production staging."
              : null;
          return (
            <button
              key={action}
              type="button"
              onClick={() => runAction(action)}
              disabled={Boolean(busyAction) || Boolean(disabledReason)}
              title={disabledReason ?? label}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-left text-xs font-bold text-slate-100 transition hover:border-blue-300/40 hover:bg-blue-500/15 disabled:cursor-wait disabled:opacity-60"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-blue-300/15 bg-blue-950/25 px-3 py-2 text-xs leading-5 text-blue-100">
        Operator guardrail: these actions draft, review, or stage internal records.
        Outbound email, client review, checkout, production, or campaign use still
        requires an approved approval record and human operator intent.
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-100">
          {message}
        </div>
      )}

      {(approvalLockedReason || productionLockedReason) && (
        <div className="rounded-lg border border-amber-300/20 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-100">
          Verified launch gate: {approvalLockedReason ?? productionLockedReason}
        </div>
      )}

      {draft && (
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200">
          {draft.type === "creative" ? (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                Creative Briefs
              </div>
              {draft.briefs.map((brief) => (
                <div key={brief.phase_key} className="rounded border border-white/10 bg-white/[0.04] p-2">
                  <div className="font-semibold text-white">{brief.title}</div>
                  {(brief.brand_mode || brief.postcard_type) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {brief.brand_mode && (
                        <span className="rounded-full border border-red-300/20 bg-red-500/10 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-red-100">
                          {brief.brand_mode}
                        </span>
                      )}
                      {brief.postcard_type && (
                        <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-100">
                          {brief.postcard_type}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs leading-5 text-slate-300">{brief.brief}</p>
                  {brief.emotional_job && (
                    <p className="mt-2 text-xs font-semibold leading-5 text-amber-100">
                      Emotional job: {brief.emotional_job}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                Draft Output
              </div>
              <div className="font-semibold text-white">{draft.subject}</div>
              {draft.type === "follow_up" && (
                <div className="grid gap-2 rounded border border-white/10 bg-white/[0.04] p-2 text-xs text-slate-300 sm:grid-cols-2">
                  <div>
                    <span className="font-bold text-slate-100">To:</span>{" "}
                    {draft.toEmail ? (
                      <>
                        {draft.recipientName ? `${draft.recipientName} ` : ""}
                        &lt;{draft.toEmail}&gt;
                      </>
                    ) : (
                      "No saved campaign email"
                    )}
                    {draft.recipientSource && (
                      <div className="mt-1 text-[11px] text-slate-500">Source: {draft.recipientSource}</div>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-slate-100">From:</span>{" "}
                    {draft.senderName ? `${draft.senderName} ` : ""}
                    {draft.senderEmail ? <>&lt;{draft.senderEmail}&gt;</> : "Not assigned"}
                  </div>
                </div>
              )}
              <p className="whitespace-pre-line text-xs leading-5 text-slate-300">{draft.body}</p>
              {draft.type === "proposal" && draft.bullets.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-300">
                  {draft.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {draft.type === "follow_up" && (
                <div className="space-y-2">
                  {draft.sendReady && draft.approvalId && draft.approvalStatus === "approved" ? (
                    <button
                      type="button"
                      onClick={() => sendFollowUpEmail(draft.approvalId!)}
                      disabled={Boolean(sendingApprovalId)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-60"
                    >
                      {sendingApprovalId === draft.approvalId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {sendingApprovalId === draft.approvalId ? "Sending..." : "Send Approved Email"}
                    </button>
                  ) : (
                    <div className="rounded border border-amber-300/20 bg-amber-950/30 p-2 text-xs leading-5 text-amber-100">
                      {draft.approvalId && draft.approvalStatus !== "approved" ? (
                        <>
                          Queued for human review in Revenue Operations. Status:{" "}
                          {draft.approvalStatus ?? "needs_review"}.{" "}
                          <Link href="/admin/revenue-operations" className="font-black underline">
                            Open review queue
                          </Link>
                        </>
                      ) : draft.missingRequirements.length > 0 ? (
                        draft.missingRequirements.join(" ")
                      ) : (
                        "A saved campaign email is required before this can be sent."
                      )}
                    </div>
                  )}
                  {sendMessage && <div className="text-xs font-semibold text-emerald-200">{sendMessage}</div>}
                  {sendError && <div className="text-xs font-semibold text-rose-200">{sendError}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function labelForAction(action: string): string {
  switch (action) {
    case "research":
      return "Candidate research completed.";
    case "manager_email_search":
      return "Campaign manager/contact email search completed and stored for review if found.";
    case "plan":
      return "Multi-phase launch plan generated.";
    case "proposal_draft":
      return "Proposal draft generated for human review. It is not client-facing until readiness gates are complete.";
    case "creative_briefs":
      return "Postcard creative briefs generated.";
    case "sales_follow_up":
      return "Sales follow-up prepared from saved campaign contact data.";
    case "approve_plan":
      return "Plan marked reviewed with compliance checklist.";
    case "production_queue":
      return "Plan staged for production readiness review.";
    default:
      return "Action completed.";
  }
}
