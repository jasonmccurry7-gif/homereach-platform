"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ApprovalActionTarget } from "@/lib/approvals/types";

export type ReviewActionTarget = ApprovalActionTarget;

export function ContentReviewActions({ target }: { target: ReviewActionTarget }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(label: string, request: () => Promise<Response>, note = "This updates the review record only. Protected publish/send gates still apply.") {
    setMessage(null);
    const confirmed = window.confirm(`${label}?\n\n${note}`);
    if (!confirmed) return;

    try {
      setBusy(true);
      const response = await request();
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(String(payload.error ?? "Action failed"));
        return;
      }
      setMessage(`${label} complete.`);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied draft.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copy failed.");
    }
  }

  if (target.kind === "daily_video") {
    const canApprove = target.status === "awaiting_approval" || target.status === "draft" || target.status === "needs_revision";
    if (!canApprove) return null;

    return (
      <ActionShell message={message}>
        <ActionButton
          disabled={busy || isPending}
          tone="approve"
          onClick={() =>
            run("Approve daily content", () =>
              fetch(`/api/admin/daily-content/${target.id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
              }),
            )
          }
        >
          Approve
        </ActionButton>
        <ActionButton
          disabled={busy || isPending}
          tone="neutral"
          onClick={() => {
            const reason = window.prompt("Revision note", "Needs revision before production.");
            if (reason === null) return;
            void run("Request revision", () =>
              fetch(`/api/admin/daily-content/${target.id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "needs_revision", reason }),
              }),
            );
          }}
        >
          Revise
        </ActionButton>
      </ActionShell>
    );
  }

  if (target.kind === "platform_post") {
    const canPrepare = target.status === "approved" || target.status === "scheduled";
    if (!canPrepare) return null;

    return (
      <ActionShell message={message}>
        <ActionButton
          disabled={busy || isPending}
          tone="approve"
          onClick={() =>
            run("Prepare manual publish packet", () =>
              fetch(`/api/admin/daily-content/${target.videoId}/platform-posts/${target.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "manual_publish_ready" }),
              }),
            )
          }
        >
          Prep Packet
        </ActionButton>
      </ActionShell>
    );
  }

  if (target.kind === "facebook_draft") {
    const status = target.status.split("/")[0]?.trim();
    const canReview = status === "pending";
    const canSend = status === "approved";

    if (!canReview && !canSend) return null;

    return (
      <ActionShell message={message}>
        {canReview ? (
          <>
            <ActionButton
              disabled={busy || isPending}
              tone="approve"
              onClick={() =>
                run("Approve Facebook draft", () =>
                  fetch("/api/admin/facebook", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "approve_draft", draft_message_id: target.id }),
                  }),
                )
              }
            >
              Approve
            </ActionButton>
            <ActionButton
              disabled={busy || isPending}
              tone="danger"
              onClick={() => {
                const reason = window.prompt("Reject reason", "Needs revision before sending.");
                if (reason === null) return;
                void run("Reject Facebook draft", () =>
                  fetch("/api/admin/facebook", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "reject_draft", draft_message_id: target.id, reason }),
                  }),
                );
              }}
            >
              Reject
            </ActionButton>
          </>
        ) : (
          <ActionButton
            disabled={busy || isPending}
            tone="approve"
            onClick={() =>
              run(
                "Send approved Facebook DM",
                () =>
                  fetch("/api/admin/facebook", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "send_draft", draft_message_id: target.id }),
                  }),
                "This sends one already approved Facebook DM. System controls, approval state, and the shared publish guard still apply.",
              )
            }
          >
            Send DM
          </ActionButton>
        )}
      </ActionShell>
    );
  }

  if (target.kind === "ai_output") {
    const [approvalStatus = "needs_review", verificationStatus = "pending"] = target.status
      .split("/")
      .map((value) => value.trim());
    const canApprove = ["needs_review", "revision_needed", "draft"].includes(approvalStatus);
    const canMarkWinner = approvalStatus === "approved" && verificationStatus === "verified" && !target.isWinning;

    if (!canApprove && !canMarkWinner) return null;

    return (
      <ActionShell message={message}>
        {canApprove ? (
          <>
            <ActionButton
              disabled={busy || isPending}
              tone="approve"
              onClick={() =>
                run(
                  "Approve AI artifact",
                  () =>
                    fetch("/api/admin/ai-assets/actions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "approve_output_artifact",
                        id: target.id,
                        reviewNotes: "Approved from the unified Content Review queue. Execution use still requires the owning workflow approval.",
                        verificationNotes:
                          "Required artifact-level checks verified from unified review. This approval does not authorize sending, publishing, submitting, charging, pricing changes, campaign changes, or spend commitments.",
                      }),
                    }),
                  "This approves the reusable AI artifact only. It does not send, publish, submit, charge, change pricing, change active campaigns, or commit spend.",
                )
              }
            >
              Approve
            </ActionButton>
            <ActionButton
              disabled={busy || isPending}
              tone="neutral"
              onClick={() => {
                const reason = window.prompt("Revision note", "Needs revision before reusable approval.");
                if (reason === null) return;
                void run("Request AI revision", () =>
                  fetch("/api/admin/ai-assets/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "update_output_status",
                      id: target.id,
                      status: "revision_needed",
                      reviewNotes: reason,
                    }),
                  }),
                );
              }}
            >
              Revise
            </ActionButton>
            <ActionButton
              disabled={busy || isPending}
              tone="danger"
              onClick={() => {
                const reason = window.prompt("Reject reason", "Not safe or useful as a reusable asset.");
                if (reason === null) return;
                void run("Reject AI artifact", () =>
                  fetch("/api/admin/ai-assets/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "update_output_status",
                      id: target.id,
                      status: "rejected",
                      reviewNotes: reason,
                    }),
                  }),
                );
              }}
            >
              Reject
            </ActionButton>
          </>
        ) : (
          <ActionButton
            disabled={busy || isPending}
            tone="approve"
            onClick={() =>
              run(
                "Mark winning output",
                () =>
                  fetch("/api/admin/ai-assets/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "mark_winning_output", id: target.id }),
                  }),
                "This labels an already approved and verified AI artifact as a winning reusable pattern. It does not publish or send anything.",
              )
            }
          >
            Mark Winner
          </ActionButton>
        )}
      </ActionShell>
    );
  }

  if (target.kind === "revenue_approval") {
    const status = target.status.split("/")[0]?.trim();
    const isEmail = target.channel.toLowerCase() === "email";
    const canReview = status === "draft" || status === "needs_review";
    const canSendEmail = isEmail && status === "approved";
    const canCopy = Boolean(target.messageBody?.trim());

    if (!canReview && !canSendEmail && !canCopy) return null;

    return (
      <ActionShell message={message}>
        {canCopy ? (
          <ActionButton disabled={busy || isPending} tone="neutral" onClick={() => void copyText(target.messageBody ?? "")}>
            Copy Draft
          </ActionButton>
        ) : null}
        {canReview ? (
          <>
            <ActionButton
              disabled={busy || isPending}
              tone="approve"
              onClick={() =>
                run(
                  "Approve revenue draft",
                  () =>
                    fetch(`/api/admin/revenue-messaging/approvals/${target.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "approve",
                        reviewNotes: "Approved from the unified Content Review queue. Sending remains a separate explicit action.",
                      }),
                    }),
                  "This approves the revenue message draft only. It does not send email, SMS, Facebook DMs, social posts, change pricing, charge customers, or change campaigns.",
                )
              }
            >
              Approve
            </ActionButton>
            <ActionButton
              disabled={busy || isPending}
              tone="danger"
              onClick={() => {
                const reason = window.prompt("Reject reason", "Needs revision before customer-facing use.");
                if (reason === null) return;
                void run(
                  "Reject revenue draft",
                  () =>
                    fetch(`/api/admin/revenue-messaging/approvals/${target.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "reject", reason }),
                    }),
                  "This rejects the revenue message draft and performs no outbound action.",
                );
              }}
            >
              Reject
            </ActionButton>
          </>
        ) : null}
        {canSendEmail ? (
          <ActionButton
            disabled={busy || isPending}
            tone="approve"
            onClick={() =>
              run(
                "Send approved revenue email",
                () =>
                  fetch(`/api/admin/revenue-messaging/approvals/${target.id}/send`, {
                    method: "POST",
                  }),
                "This sends one already approved email through the existing revenue messaging controls. Pauses, deliverability, reputation, sender identity, daily limits, and audit logging still apply.",
              )
            }
          >
            Send Email
          </ActionButton>
        ) : null}
      </ActionShell>
    );
  }

  return null;
}

function ActionShell({ children, message }: { children: React.JSX.Element | Array<React.JSX.Element | null>; message: string | null }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">{children}</div>
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  tone,
  onClick,
}: {
  children: string;
  disabled: boolean;
  tone: "approve" | "danger" | "neutral";
  onClick: () => void;
}) {
  const toneClass =
    tone === "approve"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-lg px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}
