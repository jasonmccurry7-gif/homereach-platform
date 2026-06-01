"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Send, XCircle } from "lucide-react";

type ApprovalSendActionsProps = {
  approvalId: string;
  channel: string;
  status: string;
  messageBody: string | null;
};

export function ApprovalSendActions({
  approvalId,
  channel,
  status,
  messageBody,
}: ApprovalSendActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => {
    return channel === "email" && status === "approved";
  }, [channel, status]);
  const canReview = useMemo(() => {
    return status === "draft" || status === "needs_review";
  }, [status]);

  async function copyDraft() {
    if (!messageBody) return;
    await navigator.clipboard.writeText(messageBody);
    setError(null);
    setFeedback("Draft copied.");
  }

  async function sendNow() {
    if (!canSend) {
      setError("Human approval is required before sending.");
      return;
    }

    const confirmed = window.confirm(
      `Send approved email now?\n\nApproval ID: ${approvalId}\nStatus: ${status}`,
    );
    if (!confirmed) return;

    setFeedback(null);
    setError(null);

    const response = await fetch(`/api/admin/revenue-messaging/approvals/${approvalId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

    if (!response.ok) {
      setError(payload.error ?? "Send failed. Review the draft and sender health.");
      return;
    }

    setFeedback(payload.message ?? "Email sent and logged.");
    startTransition(() => router.refresh());
  }

  async function reviewDraft(action: "approve" | "reject") {
    if (!canReview) {
      setError("Only draft or needs-review items can be reviewed here.");
      return;
    }

    const reason =
      action === "reject"
        ? window.prompt("Reject reason", "Needs revision before customer-facing use.")
        : null;
    if (action === "reject" && reason === null) return;

    const confirmed = window.confirm(
      action === "approve"
        ? `Approve this revenue draft?\n\nThis does not send it. Sending remains a separate action.\n\nApproval ID: ${approvalId}`
        : `Reject this revenue draft?\n\nNo outbound action will run.\n\nApproval ID: ${approvalId}`,
    );
    if (!confirmed) return;

    setFeedback(null);
    setError(null);

    const response = await fetch(`/api/admin/revenue-messaging/approvals/${approvalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approve"
          ? {
              action,
              reviewNotes:
                "Approved from Revenue Operations. Sending remains a separate explicit action.",
            }
          : { action, reason },
      ),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

    if (!response.ok) {
      setError(payload.error ?? "Review action failed.");
      return;
    }

    setFeedback(payload.message ?? (action === "approve" ? "Draft approved." : "Draft rejected."));
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={copyDraft}
        disabled={!messageBody}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy
      </button>
      <button
        type="button"
        onClick={() => void reviewDraft("approve")}
        disabled={!canReview || isPending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Approve
      </button>
      <button
        type="button"
        onClick={() => void reviewDraft("reject")}
        disabled={!canReview || isPending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-300/30 bg-rose-400/15 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </button>
      <button
        type="button"
        onClick={sendNow}
        disabled={!canSend || isPending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {isPending ? "Sending..." : "Send email"}
      </button>
      {feedback && <span className="text-xs font-semibold text-emerald-200">{feedback}</span>}
      {error && <span className="text-xs font-semibold text-rose-200">{error}</span>}
    </div>
  );
}
