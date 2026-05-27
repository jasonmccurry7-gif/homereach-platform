"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileUp,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
} from "lucide-react";
import type {
  DailyOutreachPayload,
  DailyOutreachTask,
  OutreachActivity,
} from "@/lib/daily-outreach/types";

type FilterKey = "today" | "week" | "category" | "completed" | "incomplete";

const KPI_LABELS: Array<[keyof DailyOutreachPayload["stats"], string]> = [
  ["todayTasks", "Today's Tasks"],
  ["completedToday", "Completed Today"],
  ["remainingToday", "Remaining Today"],
  ["emailsSent", "Emails Sent"],
  ["textsSent", "Texts Sent"],
  ["dmsCompleted", "DMs Completed"],
  ["followUpsDue", "Follow-Ups Due"],
  ["responsesReceived", "Responses Received"],
  ["groupPostsCompleted", "Group Posts Completed"],
  ["facebookPostsCompleted", "Facebook Posts Completed"],
];

const emptyPayload: DailyOutreachPayload = {
  date: new Date().toISOString().slice(0, 10),
  stats: {
    todayTasks: 0,
    completedToday: 0,
    remainingToday: 0,
    emailsSent: 0,
    textsSent: 0,
    dmsCompleted: 0,
    followUpsDue: 0,
    responsesReceived: 0,
    groupPostsCompleted: 0,
    facebookPostsCompleted: 0,
  },
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
  if (completed || status === "completed" || status === "posted") return "border-green-200 bg-green-50 text-green-700";
  if (status === "follow_up") return "border-purple-200 bg-purple-50 text-purple-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-white text-gray-700";
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

  return (
    <div className={cn("space-y-6", embedded && "pb-2")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {embedded ? "Daily execution" : "Admin execution"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Daily Outreach Command Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Fast daily action console for outreach tasks, social drafts, follow-ups, and exportable progress.
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {KPI_LABELS.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-950">{payload.stats[key]}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Today&apos;s Outreach Tasks</h2>
            <p className="text-sm text-gray-500">Human-action-only email, SMS, DM, Facebook, follow-up, and completion actions.</p>
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
                    Send Email
                  </Button>
                  <Button onClick={() => void handleSms(task)} disabled={!task.phone}>
                    <Smartphone className="h-4 w-4" />
                    Send Text
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
                  <Button onClick={() => void updateTask(task.id, { completed: true })} disabled={task.completed || busy === task.id} variant="primary">
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
