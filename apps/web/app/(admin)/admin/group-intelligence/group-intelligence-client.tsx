"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Filter,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  GROUP_OBSERVATION_STATUSES,
  GROUP_OPPORTUNITY_CATEGORIES,
  type GroupDashboardData,
  type GroupDraftType,
  type GroupObservation,
  type GroupObservationStatus,
  type GroupResponseDraft,
} from "@/lib/group-intelligence/types";
import { cn } from "@/lib/utils";

type FormState = {
  groupName: string;
  groupUrl: string;
  groupType: string;
  postAuthorName: string;
  businessName: string;
  businessType: string;
  postUrl: string;
  observedAt: string;
  sourceText: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  groupName: "",
  groupUrl: "",
  groupType: "local_small_business",
  postAuthorName: "",
  businessName: "",
  businessType: "",
  postUrl: "",
  observedAt: "",
  sourceText: "",
  notes: "",
};

const GROUP_TYPES = [
  ["local_small_business", "Local small business"],
  ["restaurant_owner", "Restaurant owner"],
  ["bakery", "Bakery"],
  ["real_estate", "Real estate"],
  ["contractor", "Contractor"],
  ["lawncare", "Lawncare"],
  ["dealership", "Dealership"],
  ["chamber_community", "Chamber/community"],
  ["political_campaign", "Political/campaign"],
  ["other", "Other"],
] as const;

type Props = {
  initialData: GroupDashboardData;
};

export function GroupIntelligenceClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    group: "all",
    minScore: "0",
    q: "",
  });
  const [expandedId, setExpandedId] = useState<string | null>(data.observations[0]?.id ?? null);

  const groups = useMemo(
    () => Array.from(new Set(data.observations.map((item) => item.groupName).filter(Boolean))).sort(),
    [data.observations],
  );

  async function refresh(nextFilters = filters) {
    const params = new URLSearchParams();
    if (nextFilters.status !== "all") params.set("status", nextFilters.status);
    if (nextFilters.category !== "all") params.set("category", nextFilters.category);
    if (nextFilters.group !== "all") params.set("group", nextFilters.group);
    if (Number(nextFilters.minScore) > 0) params.set("minScore", nextFilters.minScore);
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    const res = await fetch(`/api/admin/group-intelligence?${params.toString()}`);
    const payload = await res.json();
    if (res.ok) setData(payload);
  }

  async function submitObservation() {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/admin/group-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotice({ ok: true, message: "Pain point analyzed and drafts queued for review." });
      setForm(EMPTY_FORM);
      await refresh();
      setExpandedId(payload.observation?.id ?? null);
    } else {
      setNotice({ ok: false, message: payload.error ?? "Unable to analyze this group post." });
    }
    setBusy(false);
  }

  async function runAction(body: Record<string, unknown>, successMessage: string) {
    const res = await fetch("/api/admin/group-intelligence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotice({ ok: true, message: successMessage });
      await refresh();
    } else {
      setNotice({ ok: false, message: payload.error ?? "Action failed." });
    }
  }

  async function copyDraft(draft: GroupResponseDraft) {
    await navigator.clipboard.writeText(draft.content);
    await runAction(
      { action: "mark_copied", draftId: draft.id, draftType: draft.draftType },
      "Draft copied. Nothing was sent or posted.",
    );
  }

  async function updateStatus(observationId: string, status: GroupObservationStatus) {
    await runAction({ action: "update_status", observationId, status }, `Marked ${status}.`);
  }

  async function saveAsLead(observationId: string) {
    await runAction({ action: "save_as_lead", observationId }, "Saved into the existing CRM as a lead.");
  }

  const selected = data.observations.find((item) => item.id === expandedId) ?? data.observations[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 text-slate-950">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-200/60">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100">
                Group Intelligence
              </span>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-100">
                Human review only
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
              Find owner pain points and turn them into helpful, reviewed responses.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Paste posts or comments from groups you are authorized to view. HomeReach extracts the pain point,
              scores the opportunity, drafts a public comment and DM, and keeps every action copy-only until you review it.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-black text-white">Safety mode is locked on</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  No auto-posting, no auto-DMs, no mass messaging, no scraping bypass, and no platform-limit workarounds.
                  Strong opportunities can be saved into the existing CRM only by clicking Save as Lead.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {notice && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm font-semibold",
            notice.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          )}
        >
          {notice.message}
        </div>
      )}

      {!data.schemaReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-black">Migration needed before data persists</p>
          <p className="mt-1 leading-6">{data.warnings[0]}</p>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="New pain points" value={data.summary.newPainPoints} detail="Waiting for review" />
        <MetricCard label="Best today" value={data.summary.bestOpportunitiesToday} detail="Score 65+" tone="green" />
        <MetricCard label="Drafts ready" value={data.summary.draftsReadyForReview} detail="Copy-only responses" tone="blue" />
        <MetricCard label="Copied" value={data.summary.responsesCopied} detail="Manual action logged" />
        <MetricCard label="Follow-ups" value={data.summary.followUpsDue} detail="Due or marked due" tone="amber" />
        <MetricCard label="Leads saved" value={data.summary.convertedLeads} detail="Existing CRM" tone="green" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Manual import</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Paste a post or comment</h2>
            </div>
            <Plus className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-5 grid gap-3">
            <Input label="Group name" value={form.groupName} onChange={(groupName) => setForm({ ...form, groupName })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Post author" value={form.postAuthorName} onChange={(postAuthorName) => setForm({ ...form, postAuthorName })} />
              <Input label="Business name" value={form.businessName} onChange={(businessName) => setForm({ ...form, businessName })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                Group type
                <select
                  value={form.groupType}
                  onChange={(event) => setForm({ ...form, groupType: event.target.value })}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-500"
                >
                  {GROUP_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <Input label="Business type" value={form.businessType} onChange={(businessType) => setForm({ ...form, businessType })} />
            </div>
            <Input label="Source post URL" value={form.postUrl} onChange={(postUrl) => setForm({ ...form, postUrl })} />
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">
              Post/comment text
              <textarea
                value={form.sourceText}
                onChange={(event) => setForm({ ...form, sourceText: event.target.value })}
                rows={7}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-950 outline-none focus:border-cyan-500"
                placeholder="Paste the post or comment here. Keep this limited to content you are authorized to review."
              />
            </label>
            <Input label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
            <button
              type="button"
              onClick={submitObservation}
              disabled={busy || !form.groupName.trim() || !form.sourceText.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analyze & Draft
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Daily summary</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">What groups are telling us</h2>
            </div>
            <MessageSquareText className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {data.summary.dailyBrief}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Recurring pain points</p>
              <div className="mt-3 space-y-2">
                {data.summary.topPainPoints.length ? data.summary.topPainPoints.map((pain) => (
                  <div key={pain.label} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-800">{pain.label}</span>
                    <span className="text-xs font-black text-slate-500">{pain.count}</span>
                  </div>
                )) : <p className="text-sm text-slate-500">No imported pain points yet.</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Suggested posts</p>
              <div className="mt-3 space-y-2">
                {data.summary.suggestedFacebookPosts.length ? data.summary.suggestedFacebookPosts.map((idea) => (
                  <div key={idea} className="rounded-lg border border-slate-200 px-3 py-2 text-sm leading-5 text-slate-700">
                    {idea}
                  </div>
                )) : <p className="text-sm text-slate-500">Post ideas will appear after observations are analyzed.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Opportunity queue</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Review, copy, save, or ignore</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select value={filters.status} onChange={(status) => setFilters({ ...filters, status })}>
              <option value="all">All statuses</option>
              {GROUP_OBSERVATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
            <Select value={filters.category} onChange={(category) => setFilters({ ...filters, category })}>
              <option value="all">All categories</option>
              {GROUP_OPPORTUNITY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
            <Select value={filters.group} onChange={(group) => setFilters({ ...filters, group })}>
              <option value="all">All groups</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.q}
                onChange={(event) => setFilters({ ...filters, q: event.target.value })}
                className="min-h-10 w-48 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-500"
                placeholder="Search"
              />
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Apply
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            {data.observations.length ? data.observations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setExpandedId(item.id)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition",
                  selected?.id === item.id
                    ? "border-cyan-400 bg-cyan-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{item.groupName}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.painPointSummary}</p>
                  </div>
                  <ScoreBadge score={item.opportunityScore} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={item.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {item.opportunityCategory}
                  </span>
                </div>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-black text-slate-950">No group observations yet</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Paste a post or comment to create the first supervised opportunity.
                </p>
              </div>
            )}
          </div>

          {selected ? (
            <ObservationDetail
              observation={selected}
              onCopyDraft={copyDraft}
              onStatus={updateStatus}
              onSaveAsLead={saveAsLead}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ObservationDetail({
  observation,
  onCopyDraft,
  onStatus,
  onSaveAsLead,
}: {
  observation: GroupObservation;
  onCopyDraft: (draft: GroupResponseDraft) => Promise<void>;
  onStatus: (id: string, status: GroupObservationStatus) => Promise<void>;
  onSaveAsLead: (id: string) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <ScoreBadge score={observation.opportunityScore} />
            <StatusBadge status={observation.status} />
          </div>
          <h3 className="mt-3 text-xl font-black text-slate-950">
            {observation.businessName || observation.postAuthorName || observation.groupName}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{observation.painPointSummary}</p>
        </div>
        {observation.postUrl && (
          <Link
            href={observation.postUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            <ExternalLink className="h-4 w-4" />
            View Source Post
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoBlock label="Category" value={observation.opportunityCategory} />
        <InfoBlock label="Service fit" value={observation.suggestedServiceFit} />
        <InfoBlock label="Follow-up" value={observation.followUpSuggestion} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Original text</p>
        <p className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {observation.sourceText}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {observation.drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} onCopyDraft={onCopyDraft} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStatus(observation.id, "Reviewed")}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Reviewed
        </button>
        <button
          type="button"
          onClick={() => onStatus(observation.id, "Responded")}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
        >
          <MessageSquareText className="h-4 w-4" />
          Mark Responded
        </button>
        <button
          type="button"
          onClick={() => onSaveAsLead(observation.id)}
          disabled={Boolean(observation.convertedLeadId)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          {observation.convertedLeadId ? "Saved as Lead" : "Save as Lead"}
        </button>
        <button
          type="button"
          onClick={() => onStatus(observation.id, "Not Relevant")}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
        >
          <Archive className="h-4 w-4" />
          Ignore
        </button>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  onCopyDraft,
}: {
  draft: GroupResponseDraft;
  onCopyDraft: (draft: GroupResponseDraft) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{draftLabel(draft.draftType)}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft.content}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopyDraft(draft)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          <Clipboard className="h-4 w-4" />
          Copy
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "slate" | "green" | "amber" | "blue";
}) {
  const tones = {
    slate: "border-slate-200 bg-white",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", tones[tone])}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-500"
      />
    </label>
  );
}

function Select({
  children,
  value,
  onChange,
}: {
  children: unknown;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-500"
    >
      {children as never}
    </select>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-800">{value}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : score >= 60
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-slate-300 bg-slate-100 text-slate-700";
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]", tone)}>
      {score}/100
    </span>
  );
}

function StatusBadge({ status }: { status: GroupObservationStatus }) {
  const tone =
    status === "Converted to Lead" || status === "Responded"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Not Relevant" || status === "Archived"
        ? "bg-slate-200 text-slate-700"
        : "bg-cyan-100 text-cyan-800";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]", tone)}>
      {status}
    </span>
  );
}

function draftLabel(type: GroupDraftType) {
  if (type === "public_comment") return "Public comment";
  if (type === "private_dm") return "Private DM";
  if (type === "follow_up") return "Follow-up";
  return "Facebook post idea";
}
