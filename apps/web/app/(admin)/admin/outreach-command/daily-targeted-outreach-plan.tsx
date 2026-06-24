"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clipboard,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  MousePointer2,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { DailyOutreachTask } from "@/lib/daily-outreach/types";
import type { TargetedPlanPayload } from "@/lib/daily-outreach/targeted-plan";

const emptyPayload: TargetedPlanPayload = {
  date: new Date().toISOString().slice(0, 10),
  stats: {
    newProspects: 0,
    followUpsDue: 0,
    emailsCompleted: 0,
    textsCompleted: 0,
    dmsCompleted: 0,
    callsCompleted: 0,
    interestedReplies: 0,
    quotesNeeded: 0,
    dailyGoal: 32,
    followUpGoal: 8,
    completionPercent: 0,
  },
  tasks: [],
  socialPosts: [],
  activity: [],
  sourceWarning: null,
};

const OUTCOMES = [
  "New",
  "Contacted",
  "Follow-Up Due",
  "Interested",
  "Needs Quote",
  "Proposal Sent",
  "Won",
  "Lost",
  "Not a Fit",
] as const;

type Outcome = (typeof OUTCOMES)[number];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function scoreTone(score?: number | null) {
  if ((score ?? 0) >= 82) return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if ((score ?? 0) >= 70) return "border-sky-300/30 bg-sky-400/10 text-sky-100";
  if ((score ?? 0) >= 55) return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-slate-700 bg-slate-900 text-slate-200";
}

function statusTone(status?: string | null) {
  if (status === "Interested" || status === "Needs Quote" || status === "Won") return "bg-emerald-100 text-emerald-800";
  if (status === "Follow-Up Due" || status === "Proposal Sent") return "bg-blue-100 text-blue-800";
  if (status === "Lost" || status === "Not a Fit") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function emailDraftHref(task: DailyOutreachTask) {
  if (!task.email) return null;
  const subject = encodeURIComponent(task.email_subject ?? `${task.business_name ?? "HomeReach"} neighborhood campaign idea`);
  const body = encodeURIComponent(task.email_body ?? "");
  return `mailto:${encodeURIComponent(task.email)}?subject=${subject}&body=${body}`;
}

function normalizePhoneForSms(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function smsHandoffHref(task: DailyOutreachTask) {
  const phone = normalizePhoneForSms(task.phone);
  if (!phone || !task.sms_body) return null;
  return `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(task.sms_body)}`;
}

function messengerHandoffHref(task: DailyOutreachTask) {
  return task.messenger_url || task.facebook_url || null;
}

function ActionButton({
  children,
  onClick,
  href,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string | null;
  disabled?: boolean;
  primary?: boolean;
}) {
  const classes = cn(
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition",
    primary ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    disabled && "pointer-events-none opacity-45",
  );

  if (href) {
    return (
      <a className={classes} href={href} target="_blank" rel="noreferrer">
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

function Kpi({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export function DailyTargetedOutreachPlan() {
  const [payload, setPayload] = useState<TargetedPlanPayload>(emptyPayload);
  const [busy, setBusy] = useState<string | null>("load");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [followUpDates, setFollowUpDates] = useState<Record<string, string>>({});

  async function load() {
    setBusy("load");
    setError(null);
    try {
      const response = await fetch(`/api/admin/daily-targeted-outreach?date=${payload.date}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load targeted plan");
      setPayload(data);
      const nextNotes: Record<string, string> = {};
      const nextDates: Record<string, string> = {};
      for (const task of data.tasks ?? []) {
        nextNotes[task.id] = task.notes ?? "";
        nextDates[task.id] = task.follow_up_date ?? "";
      }
      setNotes(nextNotes);
      setFollowUpDates(nextDates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load targeted plan");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-targeted-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", date: payload.date }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to generate targeted plan");
      setPayload(data);
      setNotice("Daily targeted outreach plan is ready.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate targeted plan");
    } finally {
      setBusy(null);
    }
  }

  async function copyText(text: string | null | undefined, label: string, task?: DailyOutreachTask, activityType?: string, channel?: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setNotice(`${label} copied.`);
    if (task && activityType) {
      await updateTask(task, { activity_type: activityType, channel });
    }
  }

  async function openEmailDraft(task: DailyOutreachTask) {
    const href = emailDraftHref(task);
    if (!href) return;
    window.location.href = href;
    setNotice("Email draft opened. Confirm sender and content before sending.");
    await updateTask(task, { activity_type: "email_handoff_opened", channel: "email" });
  }

  async function sendEmailNow(task: DailyOutreachTask) {
    if (!task.email) return;
    setBusy(task.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-targeted-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_email",
          date: payload.date,
          task_id: task.id,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.result?.result?.error ?? data.error ?? "Email send failed");
      }
      setPayload(data.payload);
      const testMode = data.result?.result?.testMode === true;
      setNotice(testMode ? "Email test send recorded. Provider is in test mode." : `Email sent to ${task.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email send failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendTextFromPhone(task: DailyOutreachTask) {
    const href = smsHandoffHref(task);
    if (!href) return;
    if (task.sms_body) {
      await navigator.clipboard.writeText(task.sms_body).catch(() => undefined);
    }
    window.location.href = href;
    setNotice("Text opened on your computer/phone. Review it and tap send to complete.");
    await updateTask(task, { activity_type: "sms_handoff_opened", channel: "sms" });
  }

  async function copyDmAndOpenMessenger(task: DailyOutreachTask) {
    const href = messengerHandoffHref(task);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
    if (task.dm_body) await navigator.clipboard.writeText(task.dm_body);
    setNotice(href ? "Facebook DM copied and Messenger handoff opened." : "Facebook DM copied.");
    await updateTask(task, { activity_type: "messenger_handoff_opened", channel: "facebook_dm" });
  }

  async function runTaskAction(task: DailyOutreachTask, action: string, success: string) {
    setBusy(task.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-targeted-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          date: payload.date,
          task_id: task.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action failed");
      setPayload(data.payload);
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function updateTask(task: DailyOutreachTask, patch: Record<string, unknown>) {
    setBusy(task.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/daily-targeted-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task",
          date: payload.date,
          task_id: task.id,
          ...patch,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update task");
      setPayload(data.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task");
    } finally {
      setBusy(null);
    }
  }

  const visibleTasks = useMemo(() => {
    return payload.tasks.filter((task) => {
      const verticalOk = verticalFilter === "all" || task.vertical === verticalFilter;
      const statusOk = statusFilter === "all" || task.outcome_status === statusFilter;
      return verticalOk && statusOk;
    });
  }, [payload.tasks, statusFilter, verticalFilter]);

  const verticals = useMemo(
    () => Array.from(new Set(payload.tasks.map((task) => task.vertical).filter(Boolean) as string[])).sort(),
    [payload.tasks],
  );

  const progressWidth = `${Math.min(100, Math.max(0, payload.stats.completionPercent))}%`;

  return (
    <section id="daily-outreach-plan" className="mt-5 rounded-2xl border border-slate-800 bg-[#07111f] p-5 text-white shadow-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-100">
            <Target className="h-3.5 w-3.5" />
            Daily Outreach Plan
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Dealership, dental, medical, and local service outreach</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Daily prospect generation with reviewed one-click action paths: send email through HomeReach, open a prefilled text on your connected phone, open Messenger with the DM copied, and generate website-informed postcard concepts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={load} disabled={Boolean(busy)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </ActionButton>
          <ActionButton onClick={generate} disabled={Boolean(busy)} primary>
            {busy === "generate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Generate Prospects Today
          </ActionButton>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Today's New Prospects" value={payload.stats.newProspects} detail={`Goal: ${payload.stats.dailyGoal} new outreaches`} />
        <Kpi label="Follow-Ups Due" value={payload.stats.followUpsDue} detail={`Goal: ${payload.stats.followUpGoal} follow-ups`} />
        <Kpi label="Email + DM Handoffs" value={payload.stats.emailsCompleted + payload.stats.dmsCompleted} detail="Opened drafts, Messenger handoffs, and manual send logs" />
        <Kpi label="Quotes Needed" value={payload.stats.quotesNeeded} detail={`${payload.stats.interestedReplies} interested replies`} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Daily progress</p>
            <p className="mt-1 text-sm text-slate-300">
              {payload.stats.completionPercent}% complete / {payload.stats.dailyGoal} new outreach target / {payload.stats.followUpGoal} follow-up target
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={verticalFilter}
              onChange={(event) => setVerticalFilter(event.target.value)}
              className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-white"
            >
              <option value="all">All verticals</option>
              {verticals.map((vertical) => (
                <option key={vertical} value={vertical}>{vertical}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-white"
            >
              <option value="all">All statuses</option>
              {OUTCOMES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-blue-500" style={{ width: progressWidth }} />
        </div>
      </div>

      {(notice || error || payload.sourceWarning) && (
        <div className={cn("mt-4 rounded-xl border p-3 text-sm font-semibold", error ? "border-rose-300/30 bg-rose-400/10 text-rose-100" : "border-amber-300/30 bg-amber-400/10 text-amber-100")}>
          {error ?? notice ?? payload.sourceWarning}
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {visibleTasks.map((task) => {
          const disabled = busy === task.id;
          const emailHref = emailDraftHref(task);
          const smsHref = smsHandoffHref(task);
          const messengerHref = messengerHandoffHref(task);
          return (
            <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700">
                          {task.vertical ?? "Needs Review"}
                        </span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", statusTone(task.outcome_status))}>
                          {task.outcome_status ?? "New"}
                        </span>
                      </div>
                      <h3 className="mt-2 text-xl font-black">{task.business_name ?? "Unnamed prospect"}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {[task.contact_name, task.city, task.industry].filter(Boolean).join(" / ") || "Prospect context pending"}
                      </p>
                    </div>
                    <div className={cn("rounded-xl border px-3 py-2 text-right", scoreTone(task.outreach_priority_score))}>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Score</p>
                      <p className="text-2xl font-black">{task.outreach_priority_score ?? "--"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Recommended offer</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{task.recommended_offer ?? "Needs Review"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Today&apos;s action</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{task.today_suggested_action ?? "Review contact path"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Score note</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{task.score_label ?? "Needs Review"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <DraftBox title="Email draft" value={`${task.email_subject ?? ""}\n\n${task.email_body ?? ""}`} />
                    <DraftBox title="SMS draft" value={task.sms_body ?? ""} />
                    <DraftBox title="Facebook DM draft" value={task.dm_body ?? ""} />
                    <DraftBox title="Call script" value={task.call_script ?? ""} />
                  </div>
                </div>

                <aside className="space-y-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-700" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">Agent handoff</p>
                        <p className="mt-1 text-sm font-black text-slate-950">{task.sender_name ?? "HomeReach Outreach Agent"}</p>
                        <p className="mt-0.5 break-all text-xs font-semibold text-slate-600">{task.sender_email ?? "Review sender before use"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-blue-900">
                      Manual approval workflow. Email sends only when you click. Text and Messenger open a human handoff with copy prefilled.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <ActionButton onClick={() => sendEmailNow(task)} disabled={!task.email || !task.email_body || disabled} primary>
                      <Mail className="h-3.5 w-3.5" />
                      Send Email
                    </ActionButton>
                    <ActionButton onClick={() => sendTextFromPhone(task)} disabled={!smsHref || disabled} primary>
                      <MessageCircle className="h-3.5 w-3.5" />
                      Send Text
                    </ActionButton>
                    <ActionButton onClick={() => copyDmAndOpenMessenger(task)} disabled={!task.dm_body || !messengerHref || disabled} primary>
                      <MousePointer2 className="h-3.5 w-3.5" />
                      Open Messenger
                    </ActionButton>
                    <ActionButton onClick={() => openEmailDraft(task)} disabled={!emailHref || disabled}>
                      <Mail className="h-3.5 w-3.5" />
                      Open Email App
                    </ActionButton>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton onClick={() => runTaskAction(task, "research_task", "Website researched and drafts refreshed.")} disabled={!task.website || disabled}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Research Site
                    </ActionButton>
                    <ActionButton onClick={() => runTaskAction(task, "generate_postcard", "Postcard design brief generated.")} disabled={disabled}>
                      <Target className="h-3.5 w-3.5" />
                      Postcard Design
                    </ActionButton>
                    <ActionButton onClick={() => copyText(`${task.email_subject ?? ""}\n\n${task.email_body ?? ""}`, "Email", task, "email_copied", "email")} disabled={!task.email_body || disabled}>
                      <Clipboard className="h-3.5 w-3.5" />
                      Copy Email
                    </ActionButton>
                    <ActionButton onClick={() => copyText(task.sms_body, "SMS", task, "sms_copied", "sms")} disabled={!task.sms_body || disabled}>
                      <Clipboard className="h-3.5 w-3.5" />
                      Copy SMS
                    </ActionButton>
                    <ActionButton onClick={() => copyText(task.dm_body, "Facebook DM", task, "dm_copied", "facebook_dm")} disabled={!task.dm_body || disabled}>
                      <Clipboard className="h-3.5 w-3.5" />
                      Copy DM
                    </ActionButton>
                    <ActionButton onClick={() => copyText(task.call_script, "Call script", task, "call_script_copied", "call")} disabled={!task.call_script || disabled}>
                      <Phone className="h-3.5 w-3.5" />
                      Script
                    </ActionButton>
                    <ActionButton href={task.website}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Website
                    </ActionButton>
                    <ActionButton href={task.facebook_url}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Facebook
                    </ActionButton>
                    <ActionButton href={task.messenger_url}>
                      <Send className="h-3.5 w-3.5" />
                      Messenger
                    </ActionButton>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton onClick={() => updateTask(task, { activity_type: "email_sent", channel: "email", outcome_status: "Contacted" })} disabled={disabled}>
                      <Mail className="h-3.5 w-3.5" />
                      Log Email Sent
                    </ActionButton>
                    <ActionButton onClick={() => updateTask(task, { activity_type: "sms_sent", channel: "sms", outcome_status: "Contacted" })} disabled={disabled}>
                      <MessageCircle className="h-3.5 w-3.5" />
                      Log Text Sent
                    </ActionButton>
                    <ActionButton onClick={() => updateTask(task, { activity_type: "dm_sent", channel: "facebook_dm", outcome_status: "Contacted" })} disabled={disabled}>
                      <Send className="h-3.5 w-3.5" />
                      Log DM Sent
                    </ActionButton>
                    <ActionButton onClick={() => updateTask(task, { activity_type: "called", channel: "call", outcome_status: "Contacted" })} disabled={disabled}>
                      <Phone className="h-3.5 w-3.5" />
                      Log Called
                    </ActionButton>
                  </div>

                  <select
                    value={(task.outcome_status as Outcome | null) ?? "New"}
                    onChange={(event) => updateTask(task, { outcome_status: event.target.value })}
                    className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800"
                  >
                    {OUTCOMES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      type="date"
                      value={followUpDates[task.id] ?? ""}
                      onChange={(event) => setFollowUpDates((current) => ({ ...current, [task.id]: event.target.value }))}
                      className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                    />
                    <ActionButton onClick={() => updateTask(task, { follow_up_date: followUpDates[task.id] || null, activity_type: "follow_up_scheduled" })} disabled={disabled}>
                      <CalendarPlus className="h-3.5 w-3.5" />
                    </ActionButton>
                  </div>

                  <textarea
                    value={notes[task.id] ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [task.id]: event.target.value }))}
                    placeholder="Add note"
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton onClick={() => updateTask(task, { notes: notes[task.id] ?? "", activity_type: "note_added" })} disabled={disabled}>
                      Save Note
                    </ActionButton>
                    <ActionButton onClick={() => updateTask(task, { completed: true, activity_type: "task_completed" })} disabled={disabled} primary>
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </ActionButton>
                  </div>
                </aside>
              </div>
            </article>
          );
        })}

        {!visibleTasks.length && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center">
            <p className="text-lg font-black text-white">No targeted tasks match this view.</p>
            <p className="mt-2 text-sm text-slate-400">Generate today’s plan or adjust filters.</p>
          </div>
        )}
      </div>

      {payload.socialPosts.length > 0 && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {payload.socialPosts.map((post) => (
            <div key={post.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-200">{post.post_type}</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{post.content}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton onClick={() => copyText(post.content, "Post")}>
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy Post
                </ActionButton>
                <ActionButton onClick={() => copyText(post.short_content ?? post.content, "Short post")}>
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy Short
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DraftBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-700">
        {value || "No draft available"}
      </p>
    </div>
  );
}
