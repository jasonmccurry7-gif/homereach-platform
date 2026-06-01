import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  Megaphone,
  MessageSquareText,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  MultiChannelActionRow,
  type OutreachSubject,
} from "@/components/outreach/multi-channel-action-row";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";
import { DailyTargetedOutreachPlan } from "./daily-targeted-outreach-plan";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type GenericRow = Record<string, unknown>;

type SystemControls = {
  all_paused?: boolean | null;
  email_paused?: boolean | null;
  sms_paused?: boolean | null;
  facebook_paused?: boolean | null;
  manual_approval_mode?: boolean | null;
  outreach_test_mode?: boolean | null;
  daily_email_cap_per_sender?: number | null;
  daily_sms_cap?: number | null;
  automation_batch_limit?: number | null;
};

type ApprovalRow = {
  id: string;
  business_line: string | null;
  channel: string | null;
  status: string | null;
  title: string | null;
  message_body: string | null;
  created_at: string | null;
  metadata: GenericRow | null;
};

type EventRow = {
  id: string;
  business_line: string | null;
  channel: string | null;
  direction: string | null;
  processing_status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  subject: string | null;
  message_body: string | null;
  created_at: string | null;
  metadata: GenericRow | null;
};

type QueryResult<T> = {
  data: T | null;
  error: string | null;
};

async function queryMaybe<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>,
): Promise<QueryResult<T>> {
  try {
    const result = await run();
    if (result.error) return { data: null, error: `${label}: ${result.error.message ?? result.error.code}` };
    return { data: result.data, error: null };
  } catch (error) {
    return { data: null, error: `${label}: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function firstBoolean(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
}

function inferLine(row: GenericRow): OutreachSubject["businessLine"] {
  const haystack = [
    row.business_line,
    row.category,
    row.source,
    row.business_name,
    row.candidate_name,
    row.office_sought,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/candidate|campaign|governor|senate|mayor|council|political|attorney general|auditor|treasurer/.test(haystack)) {
    return "political";
  }
  if (/procurement|inventory|supplier|vendor|restaurant|bakery|food|pizza|supplies|cost/.test(haystack)) {
    return "inventory_procurement";
  }
  if (haystack) return "targeted_mailing";
  return "unknown";
}

function displayTime(value: string | null | undefined) {
  if (!value) return "No timestamp";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function includesSearch(row: GenericRow, query: string) {
  if (!query) return true;
  const haystack = Object.values(row)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesLine(row: GenericRow, line: string) {
  if (!line || line === "all") return true;
  return inferLine(row) === line;
}

function leadSubject(row: GenericRow): OutreachSubject {
  return {
    sourceType: "sales_lead",
    sourceId: firstString(row.id) ?? "sales-lead",
    businessLine: inferLine(row),
    displayName: firstString(row.business_name, row.contact_name) ?? "Sales lead",
    city: firstString(row.city),
    category: firstString(row.category),
    email: firstString(row.email),
    phone: firstString(row.phone),
    facebookUrl: firstString(row.facebook_url),
    messengerUrl: firstString(row.messenger_url),
    websiteUrl: firstString(row.website_url, row.website),
  };
}

function candidateSubject(row: GenericRow): OutreachSubject {
  return {
    sourceType: "campaign_candidate",
    sourceId: firstString(row.id) ?? "campaign-candidate",
    businessLine: "political",
    displayName: firstString(row.candidate_name, row.campaign_name) ?? "Campaign candidate",
    city: firstString(row.geography_value, row.city, row.county, row.state),
    category: firstString(row.office_sought, row.race_level),
    email: firstString(row.campaign_email, row.campaign_manager_email, row.email),
    phone: firstString(row.campaign_phone, row.phone),
    facebookUrl: firstString(row.facebook_url),
    messengerUrl: firstString(row.messenger_url),
    websiteUrl: firstString(row.campaign_website, row.website_url, row.website),
  };
}

function facebookSubject(row: GenericRow): OutreachSubject {
  return {
    sourceType: "manual",
    sourceId: firstString(row.id) ?? "facebook-opportunity",
    businessLine: inferLine(row),
    displayName: firstString(row.page_name, row.business_name, row.title) ?? "Facebook opportunity",
    city: firstString(row.city, row.location),
    category: firstString(row.category, row.opportunity_type),
    email: firstString(row.email),
    phone: firstString(row.phone),
    facebookUrl: firstString(row.facebook_url, row.page_url, row.url),
    messengerUrl: firstString(row.messenger_url),
    websiteUrl: firstString(row.website_url, row.website),
  };
}

function statusBadge(status: string | null | undefined) {
  const label = status?.replace(/_/g, " ") ?? "unknown";
  const tone =
    status === "failed" || status === "blocked"
      ? "border-rose-300/30 bg-rose-400/10 text-rose-100"
      : status === "approved" || status === "sent" || status === "delivered"
        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
        : "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]", tone)}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "slate" | "green" | "amber" | "rose" | "blue";
}) {
  const tones = {
    slate: "border-slate-700 bg-slate-950/70",
    green: "border-emerald-300/20 bg-emerald-400/10",
    amber: "border-amber-300/20 bg-amber-400/10",
    rose: "border-rose-300/20 bg-rose-400/10",
    blue: "border-sky-300/20 bg-sky-400/10",
  };

  return (
    <div className={cn("rounded-xl border p-4", tones[tone])}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function ProspectCard({
  subject,
  reason,
  score,
}: {
  subject: OutreachSubject;
  reason: string;
  score: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-300">
            {subject.businessLine.replace(/_/g, " ")}
          </p>
          <h3 className="mt-1 text-lg font-black text-white">{subject.displayName}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {[subject.city, subject.category].filter(Boolean).join(" - ") || "Context pending"}
          </p>
        </div>
        {score !== null && (
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">Score</p>
            <p className="text-xl font-black text-white">{Math.round(score)}</p>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{reason}</p>
      <div className="mt-4">
        <MultiChannelActionRow subject={subject} compact />
      </div>
    </div>
  );
}

async function loadOutreachCommand() {
  const db = createServiceClient();
  const sinceToday = new Date();
  sinceToday.setHours(0, 0, 0, 0);
  const sinceIso = sinceToday.toISOString();

  const [
    controlsResult,
    approvalsResult,
    eventsResult,
    leadsResult,
    candidatesResult,
    facebookResult,
  ] = await Promise.all([
    queryMaybe<SystemControls>("system_controls", () => db.from("system_controls").select("*").eq("id", 1).maybeSingle()),
    queryMaybe<ApprovalRow[]>("revenue_message_approval_queue", () =>
      db
        .from("revenue_message_approval_queue")
        .select("id,business_line,channel,status,title,message_body,created_at,metadata")
        .in("status", ["draft", "needs_review", "approved", "scheduled"])
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(40),
    ),
    queryMaybe<EventRow[]>("revenue_message_events", () =>
      db
        .from("revenue_message_events")
        .select("id,business_line,channel,direction,processing_status,contact_name,contact_email,subject,message_body,created_at,metadata")
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(80),
    ),
    queryMaybe<GenericRow[]>("sales_leads", () =>
      db.from("sales_leads").select("*").order("updated_at", { ascending: false, nullsFirst: false }).limit(60),
    ),
    queryMaybe<GenericRow[]>("campaign_candidates", () =>
      db.from("campaign_candidates").select("*").order("priority_score", { ascending: false, nullsFirst: false }).limit(60),
    ),
    queryMaybe<GenericRow[]>("fb_opportunities", () =>
      db.from("fb_opportunities").select("*").order("lead_score", { ascending: false, nullsFirst: false }).limit(40),
    ),
  ]);

  const events = eventsResult.data ?? [];
  const todayEvents = events.filter((event) => event.created_at && new Date(event.created_at).getTime() >= sinceToday.getTime());

  return {
    generatedAt: new Date().toISOString(),
    controls: controlsResult.data ?? null,
    approvals: approvalsResult.data ?? [],
    events,
    todayEvents,
    leads: leadsResult.data ?? [],
    candidates: candidatesResult.data ?? [],
    facebookOpportunities: facebookResult.data ?? [],
    sourceErrors: [
      controlsResult.error,
      approvalsResult.error,
      eventsResult.error,
      leadsResult.error,
      candidatesResult.error,
      facebookResult.error,
    ].filter(Boolean) as string[],
    sinceIso,
  };
}

export default async function OutreachCommandPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const query = readParam(params, "q").trim();
  const line = readParam(params, "line") || "all";
  const data = await loadOutreachCommand();

  const pendingApprovals = data.approvals.filter((approval) =>
    ["draft", "needs_review", "scheduled"].includes(approval.status ?? ""),
  );
  const socialApprovals = data.approvals.filter((approval) => {
    const metadata = approval.metadata ?? {};
    return (
      approval.channel === "facebook_dm" ||
      metadata.workflow === "multi_channel_social_outreach" ||
      metadata.source_system === "facebook"
    );
  });
  const repliesToday = data.todayEvents.filter((event) => event.direction === "inbound").length;
  const outboundToday = data.todayEvents.filter((event) => event.direction === "outbound").length;
  const failedToday = data.todayEvents.filter((event) => event.processing_status === "failed").length;

  const filteredLeads = data.leads.filter((row) => includesSearch(row, query) && matchesLine(row, line));
  const filteredCandidates = data.candidates.filter((row) => includesSearch(row, query) && matchesLine(row, line));
  const filteredFacebook = data.facebookOpportunities.filter((row) => includesSearch(row, query) && matchesLine(row, line));

  const hotSales = filteredLeads
    .filter((row) => firstBoolean(row.buying_signal) || (firstNumber(row.score, row.signal_score) ?? 0) >= 70)
    .slice(0, 6);
  const hotCandidates = filteredCandidates
    .filter((row) => !firstBoolean(row.do_not_contact))
    .slice(0, 6);
  const hotFacebook = filteredFacebook.slice(0, 4);

  const pausedChannels = [
    data.controls?.all_paused ? "Global" : null,
    data.controls?.email_paused ? "Email" : null,
    data.controls?.sms_paused ? "SMS" : null,
    data.controls?.facebook_paused ? "Facebook" : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-800 bg-[#07111f] p-5 text-white shadow-xl sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-sky-100">
              <Megaphone className="h-3.5 w-3.5" />
              Multi-channel outreach command
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Social, email, SMS, and browser-assisted outreach in one control layer.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              This command center reuses the existing CRM, Facebook Engine, approval queue,
              revenue message ledger, and system controls. AI can draft, research, and queue
              workflows. Humans still approve before anything public or outbound moves.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-[32rem]">
            <MetricCard label="Approvals pending" value={pendingApprovals.length} detail="Drafts awaiting owner review." tone="amber" />
            <MetricCard label="Outbound today" value={outboundToday} detail="Logged across live channels." tone="blue" />
            <MetricCard label="Replies today" value={repliesToday} detail="Inbound responses to act on." tone="green" />
            <MetricCard label="Failed today" value={failedToday} detail="Delivery or workflow failures." tone={failedToday ? "rose" : "slate"} />
          </div>
        </div>
      </section>

      <DailyTargetedOutreachPlan />

      <section className="mt-5 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
              Group Intelligence
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Turn group pain points into reviewed response drafts.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Paste posts or comments from groups you are authorized to view, classify the owner pain point,
              draft a helpful public comment and DM, then save strong opportunities into the existing CRM.
              Nothing posts or sends automatically.
            </p>
          </div>
          <Link
            href="/admin/group-intelligence"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Open Group Intelligence
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Do now</p>
              <h2 className="mt-1 text-2xl font-black">Revenue-first prospect queue</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Search existing leads, campaign records, and Facebook opportunities. Every action
                writes back into the approval and audit path instead of sending directly.
              </p>
            </div>
            <form className="flex flex-col gap-2 sm:flex-row" action="/admin/outreach-command">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search business, campaign, city..."
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-500"
              />
              <select
                name="line"
                defaultValue={line}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-500"
              >
                <option value="all">All lines</option>
                <option value="political">Political</option>
                <option value="inventory_procurement">Procurement</option>
                <option value="targeted_mailing">Targeted mail</option>
              </select>
              <button className="min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
                Filter
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-4">
            {hotCandidates.slice(0, line === "political" || line === "all" ? 6 : 0).map((row) => (
              <ProspectCard
                key={`candidate-${firstString(row.id)}`}
                subject={candidateSubject(row)}
                score={firstNumber(row.priority_score, row.completeness_score)}
                reason="Political prospect. Generate a candidate-specific follow-up, open the campaign site, or queue a browser-assisted verification flow before contacting."
              />
            ))}
            {hotSales.slice(0, 6).map((row) => (
              <ProspectCard
                key={`lead-${firstString(row.id)}`}
                subject={leadSubject(row)}
                score={firstNumber(row.score, row.signal_score)}
                reason={
                  inferLine(row) === "inventory_procurement"
                    ? "Procurement prospect. Lead with hidden supplier overspending, receipt/invoice benchmarking, and done-for-you savings discovery."
                    : "Local growth prospect. Lead with neighborhood visibility, postcard execution, and simple follow-up support."
                }
              />
            ))}
            {hotFacebook.map((row) => (
              <ProspectCard
                key={`facebook-${firstString(row.id)}`}
                subject={facebookSubject(row)}
                score={firstNumber(row.lead_score, row.score)}
                reason="Facebook opportunity. Use Social Research first, then Browser Assist only after public context is verified."
              />
            ))}
            {hotCandidates.length === 0 && hotSales.length === 0 && hotFacebook.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-lg font-black">No matching prospects found.</p>
                <p className="mt-2 text-sm text-slate-600">
                  Clear filters or use the existing Facebook Engine and CRM imports to add more leads.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Safety engine</p>
                <h2 className="text-xl font-black">Human-in-the-loop controls</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Current mode</p>
                <p className="mt-1 text-sm font-bold">
                  {data.controls?.manual_approval_mode ? "Manual approval mode is on" : "Manual approval mode is not confirmed"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Paused channels</p>
                <p className="mt-1 text-sm font-bold">
                  {pausedChannels.length ? pausedChannels.join(", ") : "No pauses detected from system_controls"}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Email cap"
                  value={data.controls?.daily_email_cap_per_sender ?? "Set"}
                  detail="Per-sender pacing control."
                  tone="slate"
                />
                <MetricCard
                  label="SMS cap"
                  value={data.controls?.daily_sms_cap ?? "Set"}
                  detail="SMS remains gated until Twilio is ready."
                  tone="slate"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">AI workforce</p>
                <h2 className="text-xl font-black">Social outreach agents</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Political Agent", "Candidate plans, four-option mail snapshots, campaign follow-up drafts."],
                ["Local Business Agent", "Business research, Facebook page context, local postcard angle."],
                ["Procurement Agent", "Hidden savings, invoices, supplier overspending, receipt benchmarks."],
                ["Browser Assist Agent", "Opens public profiles and prepares manual operator workflows."],
              ].map(([name, detail]) => (
                <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-black text-slate-950">{name}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Connected systems</p>
                <h2 className="text-xl font-black">Reusable, not duplicated</h2>
              </div>
              <Activity className="h-5 w-5 text-slate-500" />
            </div>
            <div className="mt-4 grid gap-2">
              {(
                [
                  ["/admin/crm", "CRM records"],
                  ["/admin/facebook", "Facebook Engine"],
                  ["/admin/revenue-operations", "Revenue Command"],
                  ["/admin/inbox", "Unified Inbox"],
                  ["/admin/agents", "AI Workforce"],
                ] satisfies Array<[string, string]>
              ).map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  {label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Unified timeline</p>
              <h2 className="text-2xl font-black">Latest communication history</h2>
            </div>
            <Inbox className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
            {data.events.slice(0, 12).map((event) => (
              <div key={event.id} className="grid gap-3 bg-white p-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-950">
                      {event.contact_name ?? event.contact_email ?? event.subject ?? "Message event"}
                    </p>
                    {statusBadge(event.processing_status)}
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {[event.business_line, event.channel, event.direction].filter(Boolean).join(" - ")}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {event.message_body ?? event.subject ?? "No preview stored."}
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-500">{displayTime(event.created_at)}</p>
              </div>
            ))}
            {data.events.length === 0 && (
              <div className="p-6 text-center text-sm font-semibold text-slate-500">
                No communication events are available yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Approval queue</p>
              <h2 className="text-2xl font-black">Social and outreach drafts</h2>
            </div>
            <Sparkles className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-4 grid gap-3">
            {socialApprovals.slice(0, 10).map((approval) => (
              <div key={approval.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-slate-950">{approval.title ?? "Outreach draft"}</p>
                  {statusBadge(approval.status)}
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  {[approval.business_line, approval.channel, displayTime(approval.created_at)].filter(Boolean).join(" - ")}
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                  {approval.message_body ?? "No draft preview stored."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/admin/revenue-operations" className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white">
                    Review
                  </Link>
                  <Link href="/admin/agents" className="rounded-md border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">
                    Assign agent
                  </Link>
                </div>
              </div>
            ))}
            {socialApprovals.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="font-black text-slate-950">No social drafts are waiting.</p>
                <p className="mt-2 text-sm text-slate-600">Use AI Draft DM, Social Research, or Browser Assist to stage the next item.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        {[
          {
            icon: Target,
            title: "Lead discovery and search",
            body: "Use the existing Facebook Engine, CRM, and campaign candidate records as source systems. Import remains review-first so social platform risk stays low.",
            href: "/admin/facebook",
          },
          {
            icon: MessageSquareText,
            title: "Message generation",
            body: "AI drafts are contextual by line: political plans, procurement savings, and local postcard growth. Every draft enters human review.",
            href: "/admin/revenue-operations",
          },
          {
            icon: MousePointer2,
            title: "Browser-assisted workflow",
            body: "The system can open public pages and prepare the operator path, but the final click remains human-controlled.",
            href: "/admin/outreach-command",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <Icon className="h-5 w-5 text-blue-600" />
              <h3 className="mt-3 text-xl font-black text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
            </Link>
          );
        })}
      </section>

      {data.sourceErrors.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <h2 className="font-black text-amber-950">Source warnings</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                The command center stayed online, but one or more optional sources did not load.
              </p>
              <ul className="mt-3 space-y-1 text-sm font-semibold text-amber-950">
                {data.sourceErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-black text-slate-950">No new database island</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Drafts, logs, approvals, and communication history use the existing revenue messaging layer.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="font-black text-slate-950">Phased rollout ready</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Manual browser assist works now; Meta API send can stay gated until tokens, permissions, and webhooks are verified.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 text-purple-600" />
            <div>
              <p className="font-black text-slate-950">Operator-simple</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                One row shows email, SMS, call, Facebook, Messenger, website, AI draft, research, browser assist, and copy.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
