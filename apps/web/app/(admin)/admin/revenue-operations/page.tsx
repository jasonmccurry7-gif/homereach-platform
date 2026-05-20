import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListChecks,
  Mail,
  MessageSquare,
  PauseCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Revenue Operations Command - HomeReach Admin",
};

type BusinessLine = "targeted_mailing" | "inventory_procurement" | "political" | "unknown";

type ThreadRow = {
  id: string;
  business_line: BusinessLine;
  source_system: string;
  source_id: string | null;
  channel: string;
  display_name: string | null;
  organization_name: string | null;
  city: string | null;
  category: string | null;
  status: string;
  lead_status: string | null;
  latest_message_body: string | null;
  latest_message_at: string | null;
  latest_direction: "inbound" | "outbound" | null;
  unread_count: number;
  automation_mode: string;
  automation_paused: boolean;
  pause_reason: string | null;
};

type ApprovalRow = {
  id: string;
  thread_id: string | null;
  business_line: BusinessLine;
  channel: string;
  status: string;
  title: string;
  message_body: string | null;
  created_at: string;
  due_at: string | null;
};

type SuggestionRow = {
  id: string;
  business_line: BusinessLine;
  status: string;
  suggestion_type: string;
  confidence: number | null;
};

type EventRow = {
  id: string;
  business_line: BusinessLine;
  channel: string;
  direction: string;
  provider: string | null;
  processing_status: string;
  created_at: string;
};

type SystemControls = {
  all_paused?: boolean;
  sms_paused?: boolean;
  email_paused?: boolean;
  facebook_paused?: boolean;
  outreach_test_mode?: boolean;
  manual_approval_mode?: boolean;
  sms_prospecting_live_enabled?: boolean;
  daily_sms_cap?: number;
  daily_email_cap_per_sender?: number;
  automation_batch_limit?: number;
  default_time_zone?: string;
};

type RevenueOpsData = {
  setupRequired: boolean;
  setupMessage?: string;
  threads: ThreadRow[];
  approvals: ApprovalRow[];
  suggestions: SuggestionRow[];
  events: EventRow[];
  controls: SystemControls | null;
};

type OwnerAction = {
  title: string;
  status: "blocked" | "needs_owner" | "ready" | "watch";
  detail: string;
  ownerStep: string;
};

type DailySummaryItem = {
  title: string;
  detail: string;
  tone: "neutral" | "green" | "amber" | "red";
};

const BUSINESS_LINES: Array<{
  id: BusinessLine;
  label: string;
  detail: string;
}> = [
  {
    id: "targeted_mailing",
    label: "Targeted Mail",
    detail: "Local business postcard, intake, proposal, and payment follow-up.",
  },
  {
    id: "inventory_procurement",
    label: "Procurement",
    detail: "Savings audit, demo, quote, and inventory intelligence outreach.",
  },
  {
    id: "political",
    label: "Political",
    detail: "Approved campaign outreach with immediate human handoff on replies.",
  },
];

function getEnvStatus() {
  const emailProvider = process.env.EMAIL_PROVIDER || (
    process.env.POSTMARK_API_TOKEN
      ? "postmark"
      : process.env.MAILGUN_API_KEY
      ? "mailgun"
      : process.env.RESEND_API_KEY
      ? "resend"
      : "not configured"
  );

  return [
    {
      label: "Twilio",
      value:
        process.env.TWILIO_ACCOUNT_SID &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
          ? "configured"
          : "needs setup",
      tone:
        process.env.TWILIO_ACCOUNT_SID &&
        (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
          ? "ok"
          : "warn",
    },
    {
      label: "Email provider",
      value: emailProvider,
      tone: emailProvider === "not configured" ? "warn" : "ok",
    },
    {
      label: "Postmark webhook",
      value: process.env.ENABLE_POSTMARK_WEBHOOK === "true" ? "enabled" : "disabled",
      tone: process.env.ENABLE_POSTMARK_WEBHOOK === "true" ? "ok" : "warn",
    },
    {
      label: "Facebook auto-send",
      value:
        process.env.FACEBOOK_AUTO_REPLY_ENABLED === "true" ||
        process.env.FACEBOOK_FOLLOWUP_AUTO_SEND_ENABLED === "true"
          ? "enabled"
          : "paused",
      tone:
        process.env.FACEBOOK_AUTO_REPLY_ENABLED === "true" ||
        process.env.FACEBOOK_FOLLOWUP_AUTO_SEND_ENABLED === "true"
          ? "warn"
          : "ok",
    },
    {
      label: "SerpAPI discovery",
      value: process.env.SERPAPI_PAUSED === "false" ? "env allows" : "paused",
      tone: "ok",
    },
  ];
}

function getOwnerActionItems(data: RevenueOpsData): OwnerAction[] {
  const controls = data.controls;
  const emailProvider = process.env.EMAIL_PROVIDER ?? "resend";
  const postmarkWebhookEnabled = process.env.ENABLE_POSTMARK_WEBHOOK !== "false";
  const missingEmailProviderKey =
    emailProvider === "resend" && !process.env.RESEND_API_KEY
      ? "RESEND_API_KEY"
      : emailProvider === "postmark" && !process.env.POSTMARK_API_TOKEN
      ? "POSTMARK_API_TOKEN"
      : emailProvider === "mailgun" && (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN)
      ? "MAILGUN_API_KEY / MAILGUN_DOMAIN"
      : null;

  return [
    {
      title: "Apply revenue messaging migration 093",
      status: data.setupRequired ? "blocked" : "ready",
      detail: "The command center needs the canonical revenue_message_* tables before approvals and daily summaries can be trusted.",
      ownerStep: data.setupRequired
        ? "Apply supabase/migrations/093_revenue_messaging_engine.sql in Supabase."
        : "No action if production already has the revenue_message_* tables.",
    },
    {
      title: "Verify outreach safety migration 086",
      status: controls ? "ready" : "needs_owner",
      detail: "System controls hold global pause, channel pause, test mode, manual approval, caps, and business-hour settings.",
      ownerStep: controls
        ? "No action if system_controls shows one row with id=1."
        : "Apply or verify supabase/migrations/086_outreach_owner_controls.sql.",
    },
    {
      title: "Complete production email credentials",
      status: missingEmailProviderKey ? "blocked" : "ready",
      detail: "Build/startup validation requires the selected email provider credentials before production can run safely.",
      ownerStep: missingEmailProviderKey
        ? `Set ${missingEmailProviderKey} in Vercel for EMAIL_PROVIDER=${emailProvider}.`
        : "No action if the selected email provider key is already set in Vercel.",
    },
    {
      title: "Set Postmark webhook credentials",
      status:
        postmarkWebhookEnabled && (!process.env.POSTMARK_WEBHOOK_USER || !process.env.POSTMARK_WEBHOOK_PASSWORD)
          ? "blocked"
          : "ready",
      detail: "The Postmark webhook rejects unauthenticated delivery events and should be protected with Basic Auth.",
      ownerStep:
        postmarkWebhookEnabled && (!process.env.POSTMARK_WEBHOOK_USER || !process.env.POSTMARK_WEBHOOK_PASSWORD)
          ? "Set POSTMARK_WEBHOOK_USER and POSTMARK_WEBHOOK_PASSWORD in Vercel or disable ENABLE_POSTMARK_WEBHOOK."
          : "No action if webhook credentials are already set or the webhook is intentionally disabled.",
    },
    {
      title: "Confirm Twilio A2P/10DLC and webhook URLs",
      status: controls?.sms_prospecting_live_enabled ? "watch" : "needs_owner",
      detail: "Prospecting SMS should stay disabled until the number, campaign registration, inbound webhook, and status callback are verified.",
      ownerStep: "Confirm Twilio A2P/10DLC approval, then point inbound SMS and status callbacks to production URLs.",
    },
    {
      title: "Set hot lead alert phone",
      status: process.env.ALERT_PHONE_NUMBER || process.env.SYSTEM_ALERT_PHONE ? "ready" : "needs_owner",
      detail: "The newer revenue messaging layer can notify the owner phone, but the older hot-lead alert engine expects ALERT_PHONE_NUMBER.",
      ownerStep: "Set ALERT_PHONE_NUMBER=+13302069639 in Vercel if you want legacy hot-lead SMS alerts enabled.",
    },
    {
      title: "Keep political outreach in human approval mode",
      status: "needs_owner",
      detail: "Political replies must notify Jason and pause automation. Initial outreach should be approved before sending.",
      ownerStep: "Approve political message templates and legal/compliance language before any live sends.",
    },
    {
      title: "Leave SerpAPI discovery paused",
      status: "watch",
      detail: "Lead discovery scraping is intentionally paused to prevent surprise usage and charges.",
      ownerStep: "No action unless you explicitly want SerpAPI restarted with quotas and a narrow target list.",
    },
  ];
}

async function queryMaybe<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const result = await run();
    if (result.error) return { data: null, error: `${label}: ${result.error.message ?? result.error.code}` };
    return { data: result.data, error: null };
  } catch (error) {
    return { data: null, error: `${label}: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

async function loadRevenueOperations(): Promise<RevenueOpsData> {
  const supabase = createServiceClient();

  const [threadsResult, approvalsResult, suggestionsResult, eventsResult, controlsResult] =
    await Promise.all([
      queryMaybe("threads", () =>
        supabase
          .from("revenue_message_threads")
          .select(
            "id,business_line,source_system,source_id,channel,display_name,organization_name,city,category,status,lead_status,latest_message_body,latest_message_at,latest_direction,unread_count,automation_mode,automation_paused,pause_reason",
          )
          .order("latest_message_at", { ascending: false, nullsFirst: false })
          .limit(40),
      ),
      queryMaybe("approval queue", () =>
        supabase
          .from("revenue_message_approval_queue")
          .select("id,thread_id,business_line,channel,status,title,message_body,created_at,due_at")
          .in("status", ["draft", "needs_review", "approved", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(30),
      ),
      queryMaybe("AI suggestions", () =>
        supabase
          .from("revenue_ai_suggestions")
          .select("id,business_line,status,suggestion_type,confidence")
          .in("status", ["draft", "needs_review", "approved"])
          .order("created_at", { ascending: false })
          .limit(50),
      ),
      queryMaybe("events", () =>
        supabase
          .from("revenue_message_events")
          .select("id,business_line,channel,direction,provider,processing_status,created_at")
          .order("created_at", { ascending: false })
          .limit(120),
      ),
      queryMaybe("system controls", () =>
        supabase
          .from("system_controls")
          .select(
            "all_paused,sms_paused,email_paused,facebook_paused,outreach_test_mode,manual_approval_mode,sms_prospecting_live_enabled,daily_sms_cap,daily_email_cap_per_sender,automation_batch_limit,default_time_zone",
          )
          .eq("id", 1)
          .maybeSingle(),
      ),
    ]);

  const fatal = threadsResult.error && threadsResult.error.includes("revenue_message_threads");

  return {
    setupRequired: Boolean(fatal),
    setupMessage: fatal
      ? "Run Supabase migration 093_revenue_messaging_engine.sql to enable the canonical Revenue Messaging Engine."
      : undefined,
    threads: (threadsResult.data ?? []) as ThreadRow[],
    approvals: (approvalsResult.data ?? []) as ApprovalRow[],
    suggestions: (suggestionsResult.data ?? []) as SuggestionRow[],
    events: (eventsResult.data ?? []) as EventRow[],
    controls: (controlsResult.data ?? null) as SystemControls | null,
  };
}

function countWhere<T>(rows: T[], predicate: (row: T) => boolean) {
  return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0);
}

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function lineLabel(line: BusinessLine) {
  return BUSINESS_LINES.find((entry) => entry.id === line)?.label ?? "Unknown";
}

function buildDailySummary({
  controls,
  ownerActions,
  pendingApprovals,
  politicalHandoffs,
  received24h,
  sent24h,
  unread,
}: {
  controls: SystemControls | null;
  ownerActions: OwnerAction[];
  pendingApprovals: number;
  politicalHandoffs: number;
  received24h: number;
  sent24h: number;
  unread: number;
}): DailySummaryItem[] {
  const blockedOwnerItems = ownerActions.filter((action) => action.status === "blocked").length;
  const ownerItems = ownerActions.filter((action) => action.status === "needs_owner").length;
  const allPaused = Boolean(controls?.all_paused);
  const manualApproval = Boolean(controls?.manual_approval_mode);

  return [
    {
      title: "Outreach posture",
      detail: allPaused
        ? "Global pause is on. This is safe for audit and review, but live sends are blocked."
        : "Global pause is off. Keep channel caps, approval checks, and opt-out handling verified before live sends.",
      tone: allPaused ? "amber" : "green",
    },
    {
      title: "Message flow",
      detail: `${sent24h} outbound and ${received24h} inbound message event${sent24h + received24h === 1 ? "" : "s"} in the last 24 hours. ${unread} unread message${unread === 1 ? "" : "s"} need review.`,
      tone: unread > 0 || received24h > 0 ? "amber" : "neutral",
    },
    {
      title: "Review queue",
      detail:
        pendingApprovals > 0
          ? `${pendingApprovals} draft or review item${pendingApprovals === 1 ? "" : "s"} require approval before sending.`
          : "No pending draft/review items are waiting to send.",
      tone: pendingApprovals > 0 ? "amber" : "green",
    },
    {
      title: "Political handoff",
      detail:
        politicalHandoffs > 0
          ? `${politicalHandoffs} political thread${politicalHandoffs === 1 ? "" : "s"} require Jason/manual takeover.`
          : manualApproval
          ? "Political outreach remains protected by manual approval mode."
          : "Turn on manual approval mode before any political outreach goes live.",
      tone: politicalHandoffs > 0 || !manualApproval ? "red" : "green",
    },
    {
      title: "Owner finalization",
      detail:
        blockedOwnerItems > 0
          ? `${blockedOwnerItems} blocker${blockedOwnerItems === 1 ? "" : "s"} still prevent production use.`
          : `${ownerItems} owner-controlled item${ownerItems === 1 ? "" : "s"} remain before scaling.`,
      tone: blockedOwnerItems > 0 ? "red" : ownerItems > 0 ? "amber" : "green",
    },
    {
      title: "Discovery spend",
      detail: "SerpAPI discovery remains paused by request. No broad search/discovery automation should run until restarted with quotas.",
      tone: "green",
    },
  ];
}

function StatCard(props: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const Icon = props.icon;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
          <p className="mt-2 text-3xl font-black text-white">{props.value}</p>
        </div>
        <div
          className={cn(
            "rounded-md border p-2",
            props.tone === "green" && "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
            props.tone === "amber" && "border-amber-300/30 bg-amber-400/10 text-amber-200",
            props.tone === "red" && "border-rose-300/30 bg-rose-400/10 text-rose-200",
            (!props.tone || props.tone === "neutral") && "border-sky-300/20 bg-sky-400/10 text-sky-200",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{props.detail}</p>
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em]",
        tone === "green" && "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
        tone === "amber" && "border-amber-300/30 bg-amber-400/10 text-amber-200",
        tone === "red" && "border-rose-300/30 bg-rose-400/10 text-rose-200",
        tone === "neutral" && "border-slate-700 bg-slate-900 text-slate-300",
      )}
    >
      {children}
    </span>
  );
}

export default async function RevenueOperationsPage() {
  const data = await loadRevenueOperations();
  const unread = data.threads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0);
  const pendingApprovals = countWhere(data.approvals, (row) => row.status === "needs_review" || row.status === "draft");
  const politicalHandoffs = countWhere(
    data.threads,
    (thread) => thread.business_line === "political" && thread.status === "waiting_on_homereach",
  );
  const sent24h = countWhere(data.events, (event) => {
    const created = new Date(event.created_at).getTime();
    return event.direction === "outbound" && Date.now() - created < 24 * 60 * 60 * 1000;
  });
  const received24h = countWhere(data.events, (event) => {
    const created = new Date(event.created_at).getTime();
    return event.direction === "inbound" && Date.now() - created < 24 * 60 * 60 * 1000;
  });
  const controls = data.controls ?? {};
  const connectorStatus = getEnvStatus();
  const ownerActions = getOwnerActionItems(data);
  const dailySummary = buildDailySummary({
    controls: data.controls,
    ownerActions,
    pendingApprovals,
    politicalHandoffs,
    received24h,
    sent24h,
    unread,
  });

  return (
    <main className="min-h-screen bg-[#07111f] px-6 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">
                Unified Revenue Operations
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Outreach Command Center
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Read-only control plane for targeted mail, procurement, and political messaging.
                This consolidates existing systems before any higher-risk outbound automation is enabled.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/inbox"
                className="rounded-md border border-slate-700 bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
              >
                Open Inbox
              </Link>
              <Link
                href="/api/admin/outreach/health"
                className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
              >
                Health API
              </Link>
            </div>
          </div>

          {data.setupRequired && (
            <div className="mt-5 rounded-lg border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p className="font-bold">Revenue messaging tables are not active yet.</p>
              <p className="mt-1">{data.setupMessage}</p>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Open threads"
            value={data.threads.length}
            detail={`${unread} unread message${unread === 1 ? "" : "s"} across all business lines.`}
            icon={MessageSquare}
            tone={unread > 0 ? "amber" : "green"}
          />
          <StatCard
            label="Pending approvals"
            value={pendingApprovals}
            detail="AI drafts and replies waiting for human review before sending."
            icon={ShieldCheck}
            tone={pendingApprovals > 0 ? "amber" : "green"}
          />
          <StatCard
            label="Political handoffs"
            value={politicalHandoffs}
            detail="Political replies requiring Jason/manual takeover."
            icon={PauseCircle}
            tone={politicalHandoffs > 0 ? "red" : "green"}
          />
          <StatCard
            label="24h message flow"
            value={`${sent24h}/${received24h}`}
            detail="Outbound sent / inbound received in the last 24 hours."
            icon={Mail}
          />
        </section>

        <OwnerActionPanel actions={ownerActions} />

        <section className="grid gap-4 lg:grid-cols-3">
          {BUSINESS_LINES.map((line) => {
            const threads = data.threads.filter((thread) => thread.business_line === line.id);
            const approvals = data.approvals.filter((approval) => approval.business_line === line.id);
            const suggestions = data.suggestions.filter((suggestion) => suggestion.business_line === line.id);
            return (
              <div key={line.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-white">{line.label}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{line.detail}</p>
                  </div>
                  <StatusPill tone={line.id === "political" ? "amber" : "green"}>
                    {line.id === "political" ? "Approval" : "Draft first"}
                  </StatusPill>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniMetric label="Threads" value={threads.length} />
                  <MiniMetric label="Approvals" value={approvals.length} />
                  <MiniMetric label="AI drafts" value={suggestions.length} />
                </div>
                <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/60 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Required guardrail
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {line.id === "political"
                      ? "Approved initial outreach only; inbound replies pause automation and create a manual handoff."
                      : "AI can draft and queue follow-up. Live sends stay behind approval, caps, quiet hours, and opt-out checks."}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Latest Threads</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Canonical ledger for SMS, email, Facebook/manual, and future channels.
                </p>
              </div>
              <StatusPill>{data.threads.length} loaded</StatusPill>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr] bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>Lead</span>
                <span>Line</span>
                <span>Status</span>
                <span>Latest</span>
              </div>
              <div className="divide-y divide-slate-800">
                {data.threads.slice(0, 12).map((thread) => (
                  <div
                    key={thread.id}
                    className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr] gap-3 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">
                        {thread.display_name ?? thread.organization_name ?? "Unmatched thread"}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {thread.city ?? "No city"} {thread.category ? `- ${thread.category}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{lineLabel(thread.business_line)}</p>
                      <p className="mt-1 text-xs uppercase text-slate-500">{thread.channel}</p>
                    </div>
                    <div>
                      <StatusPill
                        tone={
                          thread.status === "waiting_on_homereach"
                            ? "amber"
                            : thread.status === "paused"
                            ? "red"
                            : "neutral"
                        }
                      >
                        {thread.status.replaceAll("_", " ")}
                      </StatusPill>
                    </div>
                    <div className="text-xs text-slate-400">
                      <p>{formatDate(thread.latest_message_at)}</p>
                      <p className="mt-1 uppercase text-slate-500">{thread.latest_direction ?? "none"}</p>
                    </div>
                  </div>
                ))}
                {data.threads.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">
                    No normalized revenue messaging threads yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <h2 className="text-xl font-black text-white">Safety State</h2>
              <div className="mt-4 space-y-2">
                <SafetyRow label="Global pause" active={Boolean(controls.all_paused)} danger />
                <SafetyRow label="SMS paused" active={Boolean(controls.sms_paused)} />
                <SafetyRow label="Email paused" active={Boolean(controls.email_paused)} />
                <SafetyRow label="Facebook paused" active={Boolean(controls.facebook_paused)} />
                <SafetyRow label="Manual approval mode" active={Boolean(controls.manual_approval_mode)} goodWhenActive />
                <SafetyRow label="Test mode" active={Boolean(controls.outreach_test_mode)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="Daily SMS cap" value={controls.daily_sms_cap ?? "30"} />
                <MiniMetric label="Email cap" value={controls.daily_email_cap_per_sender ?? "30"} />
                <MiniMetric label="Batch cap" value={controls.automation_batch_limit ?? "10"} />
                <MiniMetric label="Timezone" value={controls.default_time_zone ?? "ET"} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <h2 className="text-xl font-black text-white">Connectors</h2>
              <div className="mt-4 space-y-2">
                {connectorStatus.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md bg-slate-900/70 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-300">{item.label}</span>
                    <StatusPill tone={item.tone === "ok" ? "green" : "amber"}>{item.value}</StatusPill>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <QueuePanel approvals={data.approvals} />
          <DailySummaryPanel items={dailySummary} />
          <RoadmapPanel />
        </section>
      </div>
    </main>
  );
}

function OwnerActionPanel({ actions }: { actions: OwnerAction[] }) {
  const blocked = actions.filter((action) => action.status === "blocked").length;
  const needsOwner = actions.filter((action) => action.status === "needs_owner").length;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-sky-300" />
            <h2 className="text-xl font-black text-white">Owner Action Tracker</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            These are the items that require Jason or account-owner action before mass outreach can safely move from
            draft/review into live production sends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={blocked > 0 ? "red" : "green"}>{blocked} blockers</StatusPill>
          <StatusPill tone={needsOwner > 0 ? "amber" : "green"}>{needsOwner} owner items</StatusPill>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {actions.map((action) => (
          <div key={action.title} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{action.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{action.detail}</p>
              </div>
              <StatusPill tone={actionTone(action.status)}>{actionLabel(action.status)}</StatusPill>
            </div>
            <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Jason action</p>
              <p className="mt-1 text-sm leading-6 text-slate-200">{action.ownerStep}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function actionTone(status: OwnerAction["status"]) {
  if (status === "blocked") return "red";
  if (status === "needs_owner" || status === "watch") return "amber";
  return "green";
}

function actionLabel(status: OwnerAction["status"]) {
  if (status === "blocked") return "blocked";
  if (status === "needs_owner") return "owner";
  if (status === "watch") return "watch";
  return "ready";
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}

function SafetyRow({
  label,
  active,
  danger,
  goodWhenActive,
}: {
  label: string;
  active: boolean;
  danger?: boolean;
  goodWhenActive?: boolean;
}) {
  const tone = active
    ? danger
      ? "red"
      : goodWhenActive
      ? "green"
      : "amber"
    : danger
    ? "green"
    : "neutral";

  return (
    <div className="flex items-center justify-between rounded-md bg-slate-900/70 px-3 py-2">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <StatusPill tone={tone}>{active ? "On" : "Off"}</StatusPill>
    </div>
  );
}

function QueuePanel({ approvals }: { approvals: ApprovalRow[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Human Review Queue</h2>
          <p className="mt-1 text-sm text-slate-400">
            Nothing here sends automatically. These are the work items to approve, edit, reject, or assign.
          </p>
        </div>
        <StatusPill tone={approvals.length > 0 ? "amber" : "green"}>{approvals.length} items</StatusPill>
      </div>
      <div className="mt-4 space-y-3">
        {approvals.slice(0, 6).map((item) => (
          <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {lineLabel(item.business_line)} - {item.channel.toUpperCase()} - {formatDate(item.created_at)}
                </p>
              </div>
              <StatusPill tone={item.status === "needs_review" ? "amber" : "neutral"}>
                {item.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
            {item.message_body && (
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{item.message_body}</p>
            )}
          </div>
        ))}
        {approvals.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-700 p-6 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300" />
            <p className="mt-2 text-sm font-semibold text-slate-300">No pending review items.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DailySummaryPanel({ items }: { items: DailySummaryItem[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-sky-300" />
        <h2 className="text-xl font-black text-white">Daily Executive Summary</h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        A quick operator readout for what happened, what is blocked, and what needs action before scaling outreach.
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-white">{item.title}</p>
              <StatusPill tone={item.tone}>{item.tone}</StatusPill>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadmapPanel() {
  const phases = [
    {
      title: "Phase 1 - Visibility",
      body: "Keep this dashboard read-only, verify migration 093, and route all outbound/inbound logs into the canonical ledger.",
    },
    {
      title: "Phase 2 - Approval Workflows",
      body: "Add approve/edit/reject/schedule actions on the queue with throttling and opt-out checks before any send.",
    },
    {
      title: "Phase 3 - Procurement Outreach",
      body: "Tag procurement leads, generate savings-audit drafts, and connect Operations Copilot recommendations to outreach threads.",
    },
    {
      title: "Phase 4 - Political Handoff",
      body: "Approved initial outreach only. All responses pause automation and notify Jason for manual takeover.",
    },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-sky-300" />
        <h2 className="text-xl font-black text-white">Controlled Rollout Plan</h2>
      </div>
      <div className="mt-4 space-y-3">
        {phases.map((phase) => (
          <div key={phase.title} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <p className="font-bold text-white">{phase.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{phase.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-400/10 p-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
          <p className="text-sm leading-6 text-amber-100">
            Lead discovery via SerpAPI remains paused. Do not restart broad scraping until the owner explicitly asks
            and quotas/compliance are reviewed.
          </p>
        </div>
      </div>
    </div>
  );
}
