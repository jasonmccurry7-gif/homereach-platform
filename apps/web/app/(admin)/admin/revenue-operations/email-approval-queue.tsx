"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  MailCheck,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BusinessLine = "targeted_mailing" | "inventory_procurement" | "political" | "unknown";

type EmailApprovalItem = {
  id: string;
  thread_id: string | null;
  business_line: BusinessLine;
  channel: string;
  status: string;
  title: string;
  message_body: string | null;
  created_at: string;
  due_at: string | null;
  metadata: Record<string, unknown> | null;
  previewImageUrl?: string | null;
};

const APPROVABLE_STATUSES = new Set(["draft", "needs_review", "rejected"]);
const SENDABLE_STATUSES = new Set(["approved"]);
const PLAN_SAFE_STATUSES = new Set(["approved", "proposal_ready", "production_ready"]);

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function lineLabel(line: BusinessLine) {
  if (line === "political") return "Political";
  if (line === "inventory_procurement") return "Supply savings";
  if (line === "targeted_mailing") return "Targeted mail";
  return "Revenue";
}

function senderLabel(item: EmailApprovalItem) {
  const metadata = item.metadata ?? {};
  const name = firstString(metadata.sender_name, metadata.from_name) ?? "HomeReach";
  const email = firstString(metadata.sender_email, metadata.from_email) ?? "sender not assigned";
  return `${name} <${email}>`;
}

function recipientLabel(item: EmailApprovalItem) {
  const metadata = item.metadata ?? {};
  return firstString(metadata.to_email, metadata.contact_email, metadata.email) ?? "Missing recipient";
}

function subjectLabel(item: EmailApprovalItem) {
  const metadata = item.metadata ?? {};
  return firstString(metadata.subject, item.title) ?? "No subject";
}

function statusTone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "approved" || status === "sent") return "green";
  if (status === "rejected") return "red";
  if (status === "draft" || status === "needs_review" || status === "scheduled") return "amber";
  return "neutral";
}

function isPoliticalPlanBlocked(item: EmailApprovalItem) {
  const metadata = item.metadata ?? {};
  const workflow = firstString(metadata.workflow);
  if (item.business_line !== "political" || workflow !== "candidate_agent_sales_follow_up") {
    return false;
  }
  if (metadata.owner_override === true || metadata.political_send_override === true) return false;
  return !PLAN_SAFE_STATUSES.has(String(metadata.plan_status ?? "").toLowerCase());
}

function warningFor(item: EmailApprovalItem) {
  const metadata = item.metadata ?? {};
  if (isPoliticalPlanBlocked(item)) {
    return "Political plan must be reviewed before this email can be approved or sent.";
  }
  return firstString(
    metadata.last_send_blocked_reason,
    metadata.last_send_error,
    metadata.approval_blocker,
    metadata.blocker,
  );
}

function sortApprovalItems(a: EmailApprovalItem, b: EmailApprovalItem) {
  const rank = (item: EmailApprovalItem) => {
    if (isPoliticalPlanBlocked(item)) return 3;
    if (item.status === "needs_review" || item.status === "draft") return 0;
    if (item.status === "approved") return 1;
    if (item.status === "rejected") return 2;
    if (item.status === "scheduled") return 4;
    if (item.status === "sent") return 5;
    return 6;
  };
  const rankDelta = rank(a) - rank(b);
  if (rankDelta !== 0) return rankDelta;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: string | number;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]",
        tone === "green" && "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
        tone === "amber" && "border-amber-300/30 bg-amber-400/10 text-amber-100",
        tone === "red" && "border-rose-300/30 bg-rose-400/10 text-rose-100",
        tone === "neutral" && "border-slate-700 bg-slate-900 text-slate-300",
      )}
    >
      {children}
    </span>
  );
}

function QueueMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "red";
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-black",
          tone === "green" && "text-emerald-200",
          tone === "amber" && "text-amber-200",
          tone === "red" && "text-rose-200",
          !tone && "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function EmailApprovalQueue({ approvals }: { approvals: EmailApprovalItem[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailApprovals = useMemo(
    () =>
      approvals
        .filter((item) => item.channel === "email")
        .filter((item) => item.status !== "sent")
        .sort(sortApprovalItems),
    [approvals],
  );

  const selected = emailApprovals.find((item) => item.id === selectedId) ?? emailApprovals[0] ?? null;
  const selectedWarning = selected ? warningFor(selected) : null;
  const selectedPlanBlocked = selected ? isPoliticalPlanBlocked(selected) : false;
  const selectedCanApprove = selected ? APPROVABLE_STATUSES.has(selected.status) && !selectedPlanBlocked : false;
  const selectedCanSend = selected ? SENDABLE_STATUSES.has(selected.status) && !selectedPlanBlocked : false;
  const selectedCanApproveAndSend = Boolean(selectedCanApprove && selected?.channel === "email");

  const needsReviewCount = emailApprovals.filter((item) => item.status === "draft" || item.status === "needs_review").length;
  const approvedCount = emailApprovals.filter((item) => item.status === "approved").length;
  const blockedCount = emailApprovals.filter((item) => Boolean(warningFor(item))).length;

  async function copyDraft(item: EmailApprovalItem) {
    if (!item.message_body) return;
    await navigator.clipboard.writeText(item.message_body);
    setError(null);
    setFeedback("Draft copied.");
  }

  async function requestReview(item: EmailApprovalItem, action: "approve" | "reject", reason?: string) {
    setFeedback(null);
    setError(null);
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/revenue-messaging/approvals/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? {
                action,
                reviewNotes:
                  "Approved from the simplified Email Approval Queue. External send remains explicit.",
              }
            : { action, reason: reason ?? "Rejected from simplified Email Approval Queue." },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? "Review action failed.");
        return false;
      }
      setFeedback(payload.message ?? (action === "approve" ? "Draft approved." : "Draft rejected."));
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function requestSend(item: EmailApprovalItem) {
    setFeedback(null);
    setError(null);
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/revenue-messaging/approvals/${item.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? "Send failed. Review the draft and sender health.");
        return false;
      }
      setFeedback(payload.message ?? "Email sent and logged.");
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function sendApprovedBatch() {
    const confirmed = window.confirm(
      "Send the currently approved, auto-send eligible email drafts?\n\nThis does not send drafts still waiting for review. Backend business-hours, suppression, reputation, sender, political-plan, and test-mode checks still apply.",
    );
    if (!confirmed) return;
    setFeedback(null);
    setError(null);
    setBatchBusy(true);
    try {
      const response = await fetch(
        "/api/admin/revenue-messaging/send-approved?businessLines=targeted_mailing,inventory_procurement,political&limit=10",
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        selectedCount?: number;
        blockedBy?: string | null;
        error?: string;
      };
      if (!response.ok || payload.ok === false) {
        setError(payload.error ?? payload.blockedBy ?? "Approved-send batch could not run.");
        return;
      }
      setFeedback(
        payload.blockedBy
          ? `Approved-send sweep checked ${payload.selectedCount ?? 0} eligible draft(s), but was blocked: ${payload.blockedBy}`
          : `Approved-send sweep complete: ${payload.sent ?? 0} sent/logged, ${payload.failed ?? 0} failed.`,
      );
      startTransition(() => router.refresh());
    } finally {
      setBatchBusy(false);
    }
  }

  async function approveOnly(item: EmailApprovalItem) {
    if (!selectedCanApprove) return;
    const confirmed = window.confirm(
      `Approve this email draft?\n\nTo: ${recipientLabel(item)}\nSubject: ${subjectLabel(item)}\n\nThis does not send the email.`,
    );
    if (!confirmed) return;
    const ok = await requestReview(item, "approve");
    if (ok) startTransition(() => router.refresh());
  }

  async function sendOnly(item: EmailApprovalItem) {
    if (!selectedCanSend) return;
    const confirmed = window.confirm(
      `Send this approved email now?\n\nTo: ${recipientLabel(item)}\nSubject: ${subjectLabel(item)}\n\nThis sends one email only and still runs all backend suppression, reputation, and sender checks.`,
    );
    if (!confirmed) return;
    const ok = await requestSend(item);
    if (ok) startTransition(() => router.refresh());
  }

  async function approveAndSend(item: EmailApprovalItem) {
    if (!selectedCanApproveAndSend) return;
    const confirmed = window.confirm(
      `Approve and send this email now?\n\nTo: ${recipientLabel(item)}\nSubject: ${subjectLabel(item)}\n\nThis sends one email only. Political, suppression, reputation, and sender checks still apply.`,
    );
    if (!confirmed) return;
    const approved = await requestReview(item, "approve");
    if (!approved) return;
    const sent = await requestSend(item);
    if (sent) startTransition(() => router.refresh());
  }

  async function rejectDraft(item: EmailApprovalItem) {
    if (!APPROVABLE_STATUSES.has(item.status) && item.status !== "approved" && item.status !== "scheduled") {
      setError("This item cannot be rejected from its current status.");
      return;
    }
    const reason = window.prompt("Reject reason", "Needs revision before customer-facing use.");
    if (reason === null) return;
    const ok = await requestReview(item, "reject", reason);
    if (ok) startTransition(() => router.refresh());
  }

  if (emailApprovals.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
              Email Approval Queue
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">No email drafts waiting.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Generated email drafts will appear here with a one-email approval and send flow.
            </p>
          </div>
          <StatusPill tone="green">clear</StatusPill>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 shadow-2xl md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <MailCheck className="h-5 w-5 text-sky-300" />
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">
              Email Approval Queue
            </p>
            <StatusPill tone="amber">one email at a time</StatusPill>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
            Review, approve, and send revenue emails faster.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This is the simplified operator lane for auto-send eligible email drafts. Approval gates, suppression,
            reputation controls, political plan checks, and sender limits still run before anything leaves HomeReach.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <QueueMetric label="Needs review" value={needsReviewCount} tone={needsReviewCount > 0 ? "amber" : "green"} />
          <QueueMetric label="Ready send" value={approvedCount} tone={approvedCount > 0 ? "green" : undefined} />
          <QueueMetric label="Blocked" value={blockedCount} tone={blockedCount > 0 ? "red" : "green"} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-sky-300/20 bg-sky-400/10 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">Approved-send automation</p>
          <p className="mt-1 text-xs leading-5 text-sky-100/80">
            Human-approved daily outreach drafts can be swept automatically during the safe send window. Review-needed and blocked drafts stay here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sendApprovedBatch()}
          disabled={approvedCount === 0 || batchBusy || isPending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-sky-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {batchBusy ? "Running..." : "Send Approved Batch"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-2">
          {emailApprovals.slice(0, 10).map((item) => {
            const warning = warningFor(item);
            const active = selected?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setFeedback(null);
                  setError(null);
                }}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition",
                  active
                    ? "border-sky-300 bg-sky-400/10 shadow-[0_0_0_1px_rgba(125,211,252,0.25)]"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{subjectLabel(item)}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                      To {recipientLabel(item)}
                    </p>
                  </div>
                  <StatusPill tone={warning ? "red" : statusTone(item.status)}>
                    {warning ? "blocked" : item.status.replaceAll("_", " ")}
                  </StatusPill>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill>{lineLabel(item.business_line)}</StatusPill>
                  <StatusPill>
                    {formatDate(item.due_at ?? item.created_at)}
                  </StatusPill>
                </div>
                {warning && <p className="mt-2 line-clamp-2 text-xs font-semibold text-rose-200">{warning}</p>}
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={selectedWarning ? "red" : statusTone(selected.status)}>
                    {selectedWarning ? "needs fix" : selected.status.replaceAll("_", " ")}
                  </StatusPill>
                  <StatusPill>{lineLabel(selected.business_line)}</StatusPill>
                  <StatusPill>{formatDate(selected.created_at)}</StatusPill>
                </div>
                <h3 className="mt-3 text-xl font-black text-white">{subjectLabel(selected)}</h3>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                  <p>
                    <span className="font-black text-slate-500">From</span>
                    <br />
                    {senderLabel(selected)}
                  </p>
                  <p>
                    <span className="font-black text-slate-500">To</span>
                    <br />
                    {recipientLabel(selected)}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
                <button
                  type="button"
                  onClick={() => void approveAndSend(selected)}
                  disabled={!selectedCanApproveAndSend || busyId === selected.id || isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Approve + Send
                </button>
                <button
                  type="button"
                  onClick={() => void sendOnly(selected)}
                  disabled={!selectedCanSend || busyId === selected.id || isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-sky-300/30 bg-sky-400/15 px-3 py-2 text-sm font-black text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MailCheck className="h-4 w-4" />
                  Send Now
                </button>
                <button
                  type="button"
                  onClick={() => void approveOnly(selected)}
                  disabled={!selectedCanApprove || busyId === selected.id || isPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve Only
                </button>
                <button
                  type="button"
                  onClick={() => void rejectDraft(selected)}
                  disabled={busyId === selected.id || isPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-300/30 bg-rose-400/15 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>

            {selectedWarning && (
              <div className="mt-4 rounded-md border border-rose-300/30 bg-rose-400/10 p-3 text-sm font-semibold leading-6 text-rose-100">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{selectedWarning}</p>
                </div>
              </div>
            )}

            {(feedback || error) && (
              <div
                className={cn(
                  "mt-4 rounded-md border p-3 text-sm font-semibold leading-6",
                  feedback && "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
                  error && "border-rose-300/30 bg-rose-400/10 text-rose-100",
                )}
              >
                {feedback ?? error}
              </div>
            )}

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Email draft</p>
                  <button
                    type="button"
                    onClick={() => void copyDraft(selected)}
                    disabled={!selected.message_body}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <div className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-6 text-slate-950">
                  {selected.message_body ?? "No message body is attached yet."}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Safety
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    One click can send one email only. The backend still validates approval, sender identity,
                    suppression, reputation, and policy.
                  </p>
                </div>
                {selected.previewImageUrl && (
                  <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Image
                      </p>
                      <a
                        href={selected.previewImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <img
                      src={selected.previewImageUrl}
                      alt="Outreach visual preview"
                      className="block aspect-[1200/630] w-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
