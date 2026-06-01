"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Clock,
  Clipboard,
  Download,
  ExternalLink,
  FileUp,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type {
  DailyOutreachPayload,
  DailyOutreachTask,
  OutreachActivity,
  OutreachEmailTemplate,
} from "@/lib/daily-outreach/types";

type FilterKey = "today" | "week" | "category" | "completed" | "incomplete";

const KPI_LABELS: Array<[keyof DailyOutreachPayload["stats"], string]> = [
  ["totalEmailsScheduledToday", "Scheduled Today"],
  ["emailsSent", "Sent Today"],
  ["totalEmailsRemainingToday", "Remaining Today"],
  ["politicalEmailsSent", "Political Sent"],
  ["supplyfyEmailsSent", "Supplify Sent"],
  ["failedSends", "Failed Sends"],
  ["pausedCampaigns", "Paused Campaigns"],
  ["repliesReceived", "Replies Received"],
  ["followUpsDue", "Follow-Ups Due"],
  ["emailsPendingApproval", "Pending Review"],
];

const emptyPayload: DailyOutreachPayload = {
  date: new Date().toISOString().slice(0, 10),
  stats: {
    todayTasks: 0,
    completedToday: 0,
    remainingToday: 0,
    emailDraftsOpened: 0,
    emailsSent: 0,
    emailsScheduled: 0,
    emailsPendingApproval: 0,
    emailsApproved: 0,
    textsSent: 0,
    dmsCompleted: 0,
    followUpsDue: 0,
    responsesReceived: 0,
    groupPostsCompleted: 0,
    facebookPostsCompleted: 0,
    totalEmailsScheduledToday: 0,
    totalEmailsRemainingToday: 0,
    politicalEmailsSent: 0,
    supplyfyEmailsSent: 0,
    failedSends: 0,
    pausedCampaigns: 0,
    repliesReceived: 0,
  },
  senderControls: [],
  campaignControls: [],
  templates: [],
  replies: [],
  tasks: [],
  socialPosts: [],
  activity: [],
};

function encode(value?: string | null) {
  return encodeURIComponent(value ?? "");
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function priorityStyle(priority: string) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "low") return "border-gray-200 bg-gray-50 text-gray-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function statusStyle(status: string, completed?: boolean) {
  if (completed || status === "completed" || status === "posted" || status === "sent" || status === "test_logged") return "border-green-200 bg-green-50 text-green-700";
  if (status === "follow_up") return "border-purple-200 bg-purple-50 text-purple-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "approved" || status === "approved_pending_send") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "queued_for_review" || status === "needs_review") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-gray-200 bg-white text-gray-700";
}

function formatTime(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minutesLabel(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function Button({
  children,
  onClick,
  href,
  disabled,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const classes = cn(
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
    variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
    variant === "secondary" && "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
    variant === "ghost" && "text-gray-600 hover:bg-gray-100",
    disabled && "cursor-not-allowed opacity-50"
  );

  if (href) {
    return (
      <a className={classes} href={href} target="_blank" rel="noreferrer" aria-disabled={disabled}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function DailyOutreachClient({ embedded = false }: { embedded?: boolean } = {}) {
  const [payload, setPayload] = useState<DailyOutreachPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<FilterKey>("today");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [followUpNotes, setFollowUpNotes] = useState<Record<string, string>>({});
  const [followUpDates, setFollowUpDates] = useState<Record<string, string>>({});
  const [postNotes, setPostNotes] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [templateEdits, setTemplateEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [duePreview, setDuePreview] = useState<{ date: string; count: number; previewedAt: number } | null>(null);
  const [manualProspect, setManualProspect] = useState({
    campaign_type: "political",
    business_name: "",
    campaign_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    facebook_url: "",
    city: "",
    county: "",
    state: "OH",
    assigned_sender: "jason",
    notes: "",
  });

  const today = payload.date || new Date().toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/daily-outreach?date=${today}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load daily outreach");
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load daily outreach");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generatePlan() {
    setBusy("generate");
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", date: today }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to generate daily outreach");
      setPayload(data);
      setNotice("Daily outreach plan is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate daily outreach");
    } finally {
      setBusy(null);
    }
  }

  async function logTaskAction(task: DailyOutreachTask, activityType: string, channel?: string) {
    await fetch("/api/admin/daily-outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "log_task_action",
        task_id: task.id,
        activity_type: activityType,
        channel,
      }),
    });
    await load();
  }

  async function updateTask(taskId: string, patch: Record<string, unknown>) {
    setBusy(taskId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/daily-outreach/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update task");
      setPayload((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? data.task : task)),
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setBusy(null);
    }
  }

  async function updatePost(postId: string, patch: Record<string, unknown>) {
    setBusy(postId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/daily-outreach/social/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update social post");
      setPayload((current) => ({
        ...current,
        socialPosts: current.socialPosts.map((post) => (post.id === postId ? data.post : post)),
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update social post");
    } finally {
      setBusy(null);
    }
  }

  async function copyText(text: string | null | undefined, message: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setNotice(message);
  }

  async function handleEmail(task: DailyOutreachTask) {
    await logTaskAction(task, "email_draft_opened", "email");
    window.location.href = `mailto:${encode(task.email)}?subject=${encode(task.email_subject)}&body=${encode(task.email_body)}`;
  }

  async function handleSms(task: DailyOutreachTask) {
    await logTaskAction(task, "sms_draft_opened", "sms");
    window.location.href = `sms:${encode(task.phone)}?&body=${encode(task.sms_body)}`;
  }

  async function handleCopyDm(task: DailyOutreachTask) {
    await copyText(task.dm_body, "DM draft copied.");
    await logTaskAction(task, "dm_copied", "facebook");
  }

  function exportRange(range: "today" | "week" | "month") {
    window.location.href = `/api/admin/daily-outreach/export?range=${range}`;
  }

  async function previewImport(file: File) {
    const text = await file.text();
    const parsedRows = parseCsv(text);
    const headers = Object.keys(parsedRows[0] ?? {});
    const duplicateHint = payload.tasks.filter((task) => text.includes(task.email ?? "") || text.includes(task.business_name ?? "")).length;
    setImportRows(parsedRows);
    setImportPreview(
      `Preview ready: ${parsedRows.length} rows detected. Columns: ${headers.join(", ") || "unknown"}. Possible duplicate matches: ${duplicateHint}.`
    );
  }

  async function importPlan() {
    if (importRows.length === 0) return;
    setBusy("import");
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_plan", date: today, rows: importRows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to import outreach plan");
      setPayload(data.payload);
      setNotice(`Imported ${data.import.inserted} tasks. Skipped ${data.import.duplicates} duplicates.`);
      setImportRows([]);
      setImportPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import outreach plan");
    } finally {
      setBusy(null);
    }
  }

  async function updateSenderControl(senderKey: string, patch: Record<string, unknown>) {
    if (
      patch.manual_approval_required === false &&
      !window.confirm("Enable auto-send after human approval for this sender? Keep this off until the domain, sender identity, and copy review process are verified.")
    ) {
      return;
    }
    setBusy(`sender-${senderKey}`);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_sender_control",
          date: today,
          sender_key: senderKey,
          patch,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update sender controls");
      setPayload(data.payload);
      setNotice("Sender controls updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update sender controls");
    } finally {
      setBusy(null);
    }
  }

  async function updateCampaignControl(campaignType: string, patch: Record<string, unknown>) {
    if (
      patch.manual_approval_required === false &&
      !window.confirm("Enable auto-send after human approval for this campaign? This only sends rows that pass the server-side daily outreach guardrails.")
    ) {
      return;
    }
    setBusy(`campaign-${campaignType}`);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_campaign_control",
          date: today,
          campaign_type: campaignType,
          patch,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update campaign controls");
      setPayload(data.payload);
      setNotice("Campaign controls updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update campaign controls");
    } finally {
      setBusy(null);
    }
  }

  async function saveTemplate(template: OutreachEmailTemplate) {
    const edit = templateEdits[template.id];
    if (!edit) return;
    setBusy(`template-${template.id}`);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_template",
          date: today,
          template_id: template.id,
          patch: edit,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update template");
      setPayload(data.payload);
      setTemplateEdits((current) => {
        const next = { ...current };
        delete next[template.id];
        return next;
      });
      setNotice("Template saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update template");
    } finally {
      setBusy(null);
    }
  }

  async function addProspect() {
    setBusy("add-prospect");
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_prospect", date: today, prospect: manualProspect }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to add prospect");
      setPayload(data.payload);
      setManualProspect((current) => ({
        ...current,
        business_name: "",
        campaign_name: "",
        contact_name: "",
        email: "",
        phone: "",
        website: "",
        facebook_url: "",
        city: "",
        county: "",
        notes: "",
      }));
      setNotice("Prospect added to the manual queue.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add prospect");
    } finally {
      setBusy(null);
    }
  }

  async function sendDue(dryRun = false) {
    if (!dryRun) {
      const freshPreview =
        duePreview?.date === today &&
        duePreview.previewedAt > Date.now() - 5 * 60 * 1000;
      if (!freshPreview) {
        setError("Run Preview Due first. Processing is blocked unless the due queue was previewed in the last 5 minutes.");
        return;
      }
      if (
        !window.confirm(
          `Process ${duePreview.count} due outreach item${duePreview.count === 1 ? "" : "s"} now? Manual-mode items will only queue for review; only explicit daily-outreach auto-send approvals can send.`
        )
      ) {
        return;
      }
    }
    setBusy(dryRun ? "preview-due" : "send-due");
    setError(null);
    try {
      const response = await fetch(`/api/admin/daily-outreach/send-due?date=${today}${dryRun ? "&dryRun=1" : ""}`, {
        method: dryRun ? "GET" : "POST",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to process due sends");
      if (dryRun) {
        setDuePreview({
          date: today,
          count: data.considered?.length ?? 0,
          previewedAt: Date.now(),
        });
      }
      setNotice(
        dryRun
          ? `Preview found ${data.considered?.length ?? 0} due outreach items.`
          : `Processed due outreach: ${data.queuedForReview ?? 0} queued for review, ${data.approvedForSend ?? 0} approved for sending, ${data.failedToQueue ?? 0} blocked.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process due sends");
    } finally {
      setBusy(null);
    }
  }

  async function queueEmail(task: DailyOutreachTask, mode: "review" | "approve") {
    setBusy(`${mode}-${task.id}`);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "approve" ? "approve_email_send" : "queue_email_review",
          date: today,
          task_id: task.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to queue email");
      setPayload(data.payload);
      setNotice(mode === "approve" ? "Email approved for the scheduled send queue." : "Email queued for human review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue email");
    } finally {
      setBusy(null);
    }
  }

  const filteredActivity = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekKey = weekAgo.toISOString().slice(0, 10);

    return payload.activity.filter((item) => {
      if (activityFilter === "today") return item.outreach_date === today;
      if (activityFilter === "week") return item.outreach_date >= weekKey;
      if (activityFilter === "category") return categoryFilter === "all" || item.category === categoryFilter;
      if (activityFilter === "completed") return item.activity_type.includes("completed") || item.activity_type.includes("posted");
      if (activityFilter === "incomplete") return !item.activity_type.includes("completed") && !item.activity_type.includes("posted");
      return true;
    });
  }, [activityFilter, categoryFilter, payload.activity, today]);

  const categories = useMemo(
    () => Array.from(new Set(payload.tasks.map((task) => task.category).filter(Boolean))),
    [payload.tasks]
  );
  const followUpQueue = useMemo(
    () => payload.tasks.filter((task) => task.follow_up_date && task.status !== "completed").slice(0, 12),
    [payload.tasks]
  );
  const liveSendLog = useMemo(
    () => payload.tasks.filter((task) => task.email).slice(0, 20),
    [payload.tasks]
  );
  const needsAttention = useMemo(
    () =>
      payload.tasks
        .filter((task) =>
          Boolean(
            task.last_error ||
              task.bounced_at ||
              task.send_status === "failed" ||
              task.delivery_status === "failed" ||
              (task.send_attempts ?? 0) > 1
          )
        )
        .slice(0, 12),
    [payload.tasks]
  );
  const terminalEmailStatuses = new Set(["sent", "sending", "approved_pending_send"]);
  const terminalApprovalStatuses = new Set(["sent", "sending", "rejected"]);
  const terminalDeliveryStatuses = new Set(["sent", "delivered", "bounced", "complained", "unsubscribed"]);
  function isEmailTerminal(task: DailyOutreachTask) {
    return (
      task.completed ||
      terminalEmailStatuses.has(String(task.send_status ?? "").toLowerCase()) ||
      terminalApprovalStatuses.has(String(task.approval_status ?? "").toLowerCase()) ||
      terminalDeliveryStatuses.has(String(task.delivery_status ?? "").toLowerCase())
    );
  }

  return (
    <div className={cn("space-y-6", embedded && "pb-2")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {embedded ? "Daily execution" : "Admin execution"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Outreach Command Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Approval-first daily outreach for shared postcards, political mail, and Supplify savings conversations. Sends stay capped, spaced, logged, and guarded by sender, campaign, system, and suppression checks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={generatePlan} disabled={busy === "generate"} variant="primary">
            <CalendarPlus className="h-4 w-4" />
            Generate Today&apos;s Outreach
          </Button>
          <Button onClick={() => void sendDue(true)} disabled={busy === "preview-due"}>
            <ShieldCheck className="h-4 w-4" />
            Preview Due
          </Button>
          <Button onClick={() => void sendDue(false)} disabled={busy === "send-due"} variant="primary">
            <Send className="h-4 w-4" />
            Process Due Queue
          </Button>
          <Button onClick={() => exportRange("today")}>
            <Download className="h-4 w-4" />
            Export Today
          </Button>
        </div>
      </div>

      {(notice || error) && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
          )}
        >
          {error ?? notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {KPI_LABELS.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{payload.stats[key]}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Manual Controls</h2>
          <p className="text-sm text-gray-500">
            Campaign-level caps run on top of sender caps. Political defaults to five/day, Supplify defaults to ten/day across Heather and Chelsi, and manual review is the default.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {payload.campaignControls.map((control) => (
            <div key={control.campaign_type} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-950">{control.display_name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {control.emails_sent_today ?? 0} sent / {control.emails_planned_today ?? 0} planned / {control.emails_remaining_today ?? control.daily_cap} remaining
                  </p>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", control.paused ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
                  {control.paused ? "paused" : "active"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => void updateCampaignControl(control.campaign_type, { paused: !control.paused })}
                  disabled={busy === `campaign-${control.campaign_type}`}
                >
                  {control.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {control.paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  onClick={() => void updateCampaignControl(control.campaign_type, { manual_approval_required: !control.manual_approval_required })}
                  disabled={busy === `campaign-${control.campaign_type}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {control.manual_approval_required ? "Manual send required" : "Auto-send after approval"}
                </Button>
                <select
                  className="min-h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                  value={control.daily_cap}
                  onChange={(event) => void updateCampaignControl(control.campaign_type, { daily_cap: Number(event.target.value) })}
                  disabled={busy === `campaign-${control.campaign_type}`}
                  aria-label={`${control.display_name} daily cap`}
                >
                  {[0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30].map((value) => (
                    <option key={value} value={value}>{value}/day</option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[11px] font-medium text-gray-400">
                Window: {minutesLabel(control.business_start_minutes)}-{minutesLabel(control.business_end_minutes)} / {control.min_spacing_minutes}+ min spacing
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Sender Rotation</h2>
          <p className="text-sm text-gray-500">
            Each sender is capped at five emails, spaced at least 45 minutes apart between 8:30 AM and 4:30 PM local time.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          {payload.senderControls.map((control) => (
            <div key={control.sender_key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-950">{control.sender_name}</p>
                  <p className="truncate text-xs text-gray-500">{control.sender_email}</p>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", control.paused ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
                  {control.paused ? "paused" : "active"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="font-semibold text-gray-500">Cap</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{control.daily_cap}/day</p>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="font-semibold text-gray-500">Planned</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{control.emails_planned_today ?? 0}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="font-semibold text-gray-500">Review</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{control.emails_pending_review ?? 0}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="font-semibold text-gray-500">Sent</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{control.emails_sent_today ?? 0}</p>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {control.manual_approval_required
                      ? "Manual-send mode: approval queue items still require a human send click."
                      : "Approved-send mode: human-approved items may be picked up by scheduled send automation."}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => void updateSenderControl(control.sender_key, { paused: !control.paused })}
                  disabled={busy === `sender-${control.sender_key}`}
                >
                  {control.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {control.paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  onClick={() => void updateSenderControl(control.sender_key, { manual_approval_required: !control.manual_approval_required })}
                  disabled={busy === `sender-${control.sender_key}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {control.manual_approval_required ? "Manual send required" : "Auto-send after approval"}
                </Button>
                <select
                  className="min-h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                  value={control.daily_cap}
                  onChange={(event) => void updateSenderControl(control.sender_key, { daily_cap: Number(event.target.value) })}
                  disabled={busy === `sender-${control.sender_key}`}
                  aria-label={`${control.sender_name} daily cap`}
                >
                  {[0, 1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>{value}/day</option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[11px] font-medium text-gray-400">
                Window: {minutesLabel(control.business_start_minutes)}-{minutesLabel(control.business_end_minutes)} / {control.min_spacing_minutes}+ min spacing
              </p>
            </div>
          ))}
        </div>
      </section>

      {needsAttention.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Needs Attention</h2>
            <p className="text-sm text-gray-500">Blocked, failed, bounced, or retried email items that need a human check before another send attempt.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {needsAttention.map((task) => (
              <div key={`attention-${task.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-amber-950">{task.business_name || task.campaign_name || task.email}</p>
                    <p className="mt-1 text-xs text-amber-800">{task.sender_email || "No sender"} / attempts {task.send_attempts ?? 0}</p>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusStyle(task.send_status || task.delivery_status || "blocked"))}>
                    {(task.send_status || task.delivery_status || "blocked").replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-3 text-amber-900">{task.last_error || "Review delivery status, suppression, or approval state before retrying."}</p>
                <div className="mt-3 grid gap-1 text-xs text-amber-800">
                  <span>Provider: {task.provider_message_id || "not assigned"}</span>
                  <span>Opened: {task.opened_at ? formatTime(task.opened_at) : "not tracked"}</span>
                  <span>Replied: {task.replied_at ? formatTime(task.replied_at) : "not tracked"}</span>
                  <span>Bounced: {task.bounced_at ? formatTime(task.bounced_at) : "not tracked"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-950">Live Send Log</h2>
          <p className="text-sm text-gray-500">Scheduled, approved, sent, failed, and reply states for today&apos;s email outreach.</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[140px_1.3fr_1fr_1fr_1.3fr_120px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 md:grid">
            <span>Send Time</span>
            <span>Prospect</span>
            <span>Campaign Type</span>
            <span>Sender</span>
            <span>Subject</span>
            <span>Status</span>
          </div>
          {liveSendLog.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No email tasks are scheduled yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {liveSendLog.map((task) => (
                <div key={`log-${task.id}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[140px_1.3fr_1fr_1fr_1.3fr_120px]">
                  <span className="font-medium text-gray-900">{formatTime(task.scheduled_send_at)}</span>
                  <span className="min-w-0 truncate text-gray-700">{task.business_name || task.campaign_name || task.contact_name || task.email}</span>
                  <span className="text-gray-500">{task.campaign_type || task.category}</span>
                  <span className="min-w-0 truncate text-gray-500">{task.sender_email}</span>
                  <span className="min-w-0 truncate text-gray-700">{task.email_subject}</span>
                  <span className={cn("w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusStyle(task.send_status || "draft"))}>
                    {(task.send_status || "draft").replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Replies Inbox</h2>
            <p className="text-sm text-gray-500">Phase 1 reply visibility; deeper inbox sync can hydrate this list next.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {payload.replies.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">No inbound replies have been synced yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {payload.replies.map((reply) => (
                  <div key={reply.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-950">{reply.from_name || reply.from_email || "Unknown sender"}</p>
                        <p className="text-xs text-gray-500">{reply.business_or_campaign_name || reply.original_subject || reply.campaign_type}</p>
                      </div>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {reply.sentiment.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{reply.reply_preview || "No preview available."}</p>
                    <p className="mt-2 text-xs font-medium text-gray-500">{reply.recommended_next_action || "Review and assign next action."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => void copyText(reply.reply_preview, "Reply preview copied.")}>Copy Reply</Button>
                      <Button onClick={() => void copyText(reply.recommended_next_action, "Next action copied.")}>Copy Action</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Follow-Up Queue</h2>
            <p className="text-sm text-gray-500">People who need a human follow-up, copyable across email, SMS, and DM.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {followUpQueue.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">No follow-ups are due in the current queue.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {followUpQueue.map((task) => (
                  <div key={`follow-${task.id}`} className="p-4">
                    <p className="font-semibold text-gray-950">{task.business_name || task.campaign_name || task.email}</p>
                    <p className="mt-1 text-xs text-gray-500">Due {task.follow_up_date} / last status {(task.send_status || task.status).replace(/_/g, " ")}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{task.email_body || task.sms_body || task.dm_body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => void copyText(task.email_body, "Follow-up email copied.")}>Copy Email</Button>
                      <Button onClick={() => void copyText(task.sms_body, "Follow-up SMS copied.")}>Copy SMS</Button>
                      <Button onClick={() => void copyText(task.dm_body, "Follow-up DM copied.")}>Copy DM</Button>
                      <Button onClick={() => void updateTask(task.id, { completed: true })}>Mark Complete</Button>
                      <Button onClick={() => void updateTask(task.id, { follow_up_date: today, status: "follow_up" })}>Snooze</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Today&apos;s Outreach Tasks</h2>
            <p className="text-sm text-gray-500">Review-first email drafts with sender, schedule, visual, CTA, and approval state visible before anything sends.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportRange("week")}>
              <Download className="h-4 w-4" />
              Week
            </Button>
            <Button onClick={() => exportRange("month")}>
              <Download className="h-4 w-4" />
              Month
            </Button>
          </div>
        </div>

        {loading && <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading daily console...</div>}
        {!loading && payload.tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="font-semibold text-gray-900">No outreach plan exists for today yet.</p>
            <p className="mt-1 text-sm text-gray-500">Generate a lightweight plan to start today&apos;s execution list.</p>
            <div className="mt-4">
              <Button onClick={generatePlan} variant="primary">
                <CalendarPlus className="h-4 w-4" />
                Generate Today&apos;s Outreach
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {payload.tasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-[24px_minmax(220px,1.2fr)_minmax(320px,2fr)_minmax(280px,1fr)]">
                <label className="pt-1">
                  <input
                    className="h-5 w-5 rounded border-gray-300"
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => void updateTask(task.id, { completed: true })}
                    disabled={task.completed || busy === task.id}
                    aria-label={`Mark ${task.business_name || task.campaign_name || "task"} complete`}
                  />
                </label>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-gray-950">{task.business_name || task.campaign_name || "Daily outreach task"}</p>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", priorityStyle(task.priority))}>{task.priority}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusStyle(task.status, task.completed))}>{task.completed ? "completed" : task.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{task.category} / {task.industry || "Uncategorized"}</p>
                  {(task.sender_email || task.scheduled_send_at) && (
                    <div className="mt-3 space-y-1 rounded-md border border-gray-100 bg-gray-50 p-2 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        <span className="truncate">{task.sender_name || "Sender"} / {task.sender_email || "No sender email"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{formatTime(task.scheduled_send_at)}</span>
                      </div>
                      {task.neighborhood_example && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-gray-400" />
                          <span>{task.neighborhood_example} / {task.household_density_estimate}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 grid gap-1 text-xs text-gray-600">
                    <span>{task.phone || "No phone"}</span>
                    <span>{task.email || "No email"}</span>
                    <span className="truncate">{task.website || "No website"}</span>
                    <span className="truncate">{task.facebook_url || "No Facebook URL"}</span>
                    <span className="truncate">{task.messenger_url || "No Messenger URL"}</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Action needed</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{task.action_type.replace(/_/g, " ")}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-gray-600">{task.notes || task.email_body || task.dm_body || "No notes yet."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusStyle(task.approval_status || "needs_review"))}>
                      approval: {(task.approval_status || "needs_review").replace(/_/g, " ")}
                    </span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusStyle(task.send_status || "draft"))}>
                      send: {(task.send_status || "draft").replace(/_/g, " ")}
                    </span>
                    {task.cta_variant_key && (
                      <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {task.cta_variant_key}
                      </span>
                    )}
                  </div>
                  {task.visual_url && (
                    <a
                      className="mt-3 flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      href={task.visual_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                      <span className="min-w-0 truncate">{task.visual_type || "visual"} / {task.visual_alt || "email visual"}</span>
                    </a>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs"
                      type="date"
                      value={followUpDates[task.id] ?? task.follow_up_date ?? ""}
                      onChange={(event) => setFollowUpDates((current) => ({ ...current, [task.id]: event.target.value }))}
                      aria-label="Follow-up date"
                    />
                    <input
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs"
                      type="text"
                      value={followUpNotes[task.id] ?? ""}
                      onChange={(event) => setFollowUpNotes((current) => ({ ...current, [task.id]: event.target.value }))}
                      placeholder="Quick follow-up note"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap content-start gap-2">
                  <Button onClick={() => void handleEmail(task)} disabled={!task.email}>
                    <Mail className="h-4 w-4" />
                    Open Draft
                  </Button>
                  <Button onClick={() => void copyText(`${task.email_subject ?? ""}\n\n${task.email_body ?? ""}`, "Email draft copied.")} disabled={!task.email_body}>
                    <Clipboard className="h-4 w-4" />
                    Copy Email
                  </Button>
                  <Button
                    onClick={() => void queueEmail(task, "review")}
                    disabled={!task.email || isEmailTerminal(task) || busy === `review-${task.id}`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Queue Review
                  </Button>
                  <Button
                    onClick={() => void queueEmail(task, "approve")}
                    disabled={!task.email || task.manual_approval_required !== false || isEmailTerminal(task) || busy === `approve-${task.id}`}
                    variant="primary"
                  >
                    <Send className="h-4 w-4" />
                    Approve Auto Send
                  </Button>
                  <Button onClick={() => void handleSms(task)} disabled={!task.phone}>
                    <Smartphone className="h-4 w-4" />
                    Send Text
                  </Button>
                  <Button onClick={() => void copyText(task.sms_body, "SMS draft copied.")} disabled={!task.sms_body}>
                    <Clipboard className="h-4 w-4" />
                    Copy SMS
                  </Button>
                  <Button onClick={() => void handleCopyDm(task)} disabled={!task.dm_body}>
                    <Clipboard className="h-4 w-4" />
                    Copy DM
                  </Button>
                  <Button href={task.facebook_url ?? undefined} disabled={!task.facebook_url}>
                    <ExternalLink className="h-4 w-4" />
                    Facebook
                  </Button>
                  <Button href={task.messenger_url ?? undefined} disabled={!task.messenger_url}>
                    <MessageSquare className="h-4 w-4" />
                    Messenger
                  </Button>
                  <Button onClick={() => void updateTask(task.id, { completed: true })} disabled={task.completed || busy === task.id}>
                    <Check className="h-4 w-4" />
                    Mark Complete
                  </Button>
                  <Button
                    onClick={() => void updateTask(task.id, {
                      status: "follow_up",
                      follow_up_date: followUpDates[task.id] || task.follow_up_date || today,
                      notes: followUpNotes[task.id] || task.notes || "",
                    })}
                    disabled={busy === task.id}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Follow-Up
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-950">Today&apos;s Social Posts</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {payload.socialPosts.map((post) => (
            <div key={post.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-950">{post.post_type}</p>
                  <p className="text-xs text-gray-500">{post.category} / {post.audience || "General audience"}</p>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusStyle(post.status, post.posted))}>
                  {post.posted ? "posted" : post.status}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">{post.content}</p>
              {post.short_content && <p className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">{post.short_content}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void copyText(post.content, "Post copied.").then(() => updatePost(post.id, { activity_type: "post_copied" }))}>
                  <Clipboard className="h-4 w-4" />
                  Copy Post
                </Button>
                <Button onClick={() => void copyText(post.short_content || post.content, "Short version copied.").then(() => updatePost(post.id, { activity_type: "short_post_copied" }))}>
                  <Clipboard className="h-4 w-4" />
                  Copy Short
                </Button>
                <Button onClick={() => void updatePost(post.id, { rewrite_mode: "emotional" })}>More Emotional</Button>
                <Button onClick={() => void updatePost(post.id, { rewrite_mode: "direct" })}>More Direct</Button>
                <Button onClick={() => void updatePost(post.id, { rewrite_mode: "professional" })}>Professional</Button>
                <Button href="https://www.facebook.com/">
                  <ExternalLink className="h-4 w-4" />
                  Facebook
                </Button>
                <Button onClick={() => void updatePost(post.id, { posted: true })} disabled={post.posted} variant="primary">
                  <Send className="h-4 w-4" />
                  Mark Posted
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-xs"
                  type="text"
                  value={postNotes[post.id] ?? ""}
                  onChange={(event) => setPostNotes((current) => ({ ...current, [post.id]: event.target.value }))}
                  placeholder="Add notes"
                />
                <Button onClick={() => void updatePost(post.id, { notes: postNotes[post.id] || post.notes || "" })}>Save Notes</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Activity History</h2>
            <p className="text-sm text-gray-500">Rolling ledger of draft opens, copied DMs, posted content, follow-ups, and completed tasks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["today", "week", "category", "completed", "incomplete"] as FilterKey[]).map((filter) => (
              <Button key={filter} onClick={() => setActivityFilter(filter)} variant={activityFilter === filter ? "primary" : "secondary"}>
                {filter}
              </Button>
            ))}
            {activityFilter === "category" && (
              <select
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {filteredActivity.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No matching activity yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredActivity.map((item: OutreachActivity) => (
                <div key={item.id} className="grid gap-2 p-4 text-sm md:grid-cols-[150px_180px_1fr_170px]">
                  <span className="font-semibold text-gray-900">{item.activity_type.replace(/_/g, " ")}</span>
                  <span className="text-gray-500">{item.category || item.channel || "daily outreach"}</span>
                  <span className="text-gray-700">{item.summary || "Activity logged."}</span>
                  <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-gray-950">Add Prospect</h2>
          <p className="mt-1 text-sm text-gray-500">Manual entry feeds the next generated queue. Nothing sends from this form.</p>
          <div className="mt-4 grid gap-2">
            <select
              className="rounded-md border border-gray-200 px-3 py-2 text-sm"
              value={manualProspect.campaign_type}
              onChange={(event) => setManualProspect((current) => ({
                ...current,
                campaign_type: event.target.value,
                assigned_sender: event.target.value === "political" ? "jason" : "chelsi",
              }))}
            >
              <option value="political">Political postcard campaign</option>
              <option value="supplyfy">Supplify food-service</option>
            </select>
            <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Business or organization" value={manualProspect.business_name} onChange={(event) => setManualProspect((current) => ({ ...current, business_name: event.target.value }))} />
            <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Campaign name" value={manualProspect.campaign_name} onChange={(event) => setManualProspect((current) => ({ ...current, campaign_name: event.target.value }))} />
            <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Contact name" value={manualProspect.contact_name} onChange={(event) => setManualProspect((current) => ({ ...current, contact_name: event.target.value }))} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Email" value={manualProspect.email} onChange={(event) => setManualProspect((current) => ({ ...current, email: event.target.value }))} />
              <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Phone" value={manualProspect.phone} onChange={(event) => setManualProspect((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Website" value={manualProspect.website} onChange={(event) => setManualProspect((current) => ({ ...current, website: event.target.value }))} />
            <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Facebook URL" value={manualProspect.facebook_url} onChange={(event) => setManualProspect((current) => ({ ...current, facebook_url: event.target.value }))} />
            <div className="grid gap-2 sm:grid-cols-3">
              <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="City" value={manualProspect.city} onChange={(event) => setManualProspect((current) => ({ ...current, city: event.target.value }))} />
              <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="County" value={manualProspect.county} onChange={(event) => setManualProspect((current) => ({ ...current, county: event.target.value }))} />
              <input className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="State" value={manualProspect.state} onChange={(event) => setManualProspect((current) => ({ ...current, state: event.target.value }))} />
            </div>
            <textarea className="min-h-20 rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Notes" value={manualProspect.notes} onChange={(event) => setManualProspect((current) => ({ ...current, notes: event.target.value }))} />
            <Button onClick={() => void addProspect()} disabled={busy === "add-prospect"} variant="primary">
              <CalendarPlus className="h-4 w-4" />
              Add Prospect
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-gray-950">Email Templates</h2>
          <p className="mt-1 text-sm text-gray-500">Editable Phase 1 templates. Variables include first_name, business_name, campaign_name, city, county, sender_name, sender_email, quote_link, dashboard_link.</p>
          <div className="mt-4 max-h-[620px] space-y-3 overflow-auto pr-1">
            {payload.templates.length === 0 ? (
              <p className="text-sm text-gray-500">No templates found. Run the database migration to seed default templates.</p>
            ) : payload.templates.map((template) => {
              const edit = templateEdits[template.id] ?? { subject: template.subject, body: template.body };
              return (
                <div key={template.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-gray-950">{template.display_name}</p>
                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">{template.campaign_type}</span>
                  </div>
                  <input
                    className="mt-3 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs"
                    value={edit.subject}
                    onChange={(event) => setTemplateEdits((current) => ({ ...current, [template.id]: { ...edit, subject: event.target.value } }))}
                  />
                  <textarea
                    className="mt-2 min-h-32 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs leading-5"
                    value={edit.body}
                    onChange={(event) => setTemplateEdits((current) => ({ ...current, [template.id]: { ...edit, body: event.target.value } }))}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button onClick={() => void saveTemplate(template)} disabled={busy === `template-${template.id}`}>Save</Button>
                    <Button onClick={() => void copyText(`${edit.subject}\n\n${edit.body}`, "Template copied.")}>Copy</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-950">Import Outreach Plan</h2>
            <p className="text-sm text-gray-500">CSV import uses preview first, skips duplicates, then writes tasks only after you click import.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <FileUp className="h-4 w-4" />
              Import Preview
              <input className="sr-only" type="file" accept=".csv,.txt" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void previewImport(file);
              }} />
            </label>
            <Button onClick={() => void importPlan()} disabled={importRows.length === 0 || busy === "import"} variant="primary">
              Import Reviewed Rows
            </Button>
          </div>
        </div>
        {importPreview && <p className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-700">{importPreview}</p>}
      </section>
    </div>
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);

  const headers = rows.shift()?.map((header) => normalizeHeader(header)) ?? [];
  return rows.map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = values[index] ?? "";
    });
    return record;
  });
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
