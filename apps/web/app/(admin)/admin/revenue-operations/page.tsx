import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ListChecks,
  Mail,
  MailCheck,
  MessageSquare,
  PauseCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { loadAiWorkforceCommandCenter } from "@/lib/ai-workforce/repository";
import type { AiWorkforceCommandCenterData, WorkforceTask } from "@/lib/ai-workforce/types";
import { cn } from "@/lib/utils";
import { DailyOutreachClient } from "../daily-outreach/daily-outreach-client";
import { ApprovalSendActions } from "./approval-send-actions";
import { EmailApprovalQueue } from "./email-approval-queue";
import { GeneratePoliticalEmailsButton } from "./generate-political-emails-button";
import { SearchPoliticalEmailsButton } from "./search-political-emails-button";

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
  metadata: Record<string, unknown> | null;
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
  thread_id: string | null;
  business_line: BusinessLine;
  channel: string;
  direction: string;
  provider: string | null;
  provider_message_id: string | null;
  processing_status: string;
  contact_name: string | null;
  contact_email: string | null;
  subject: string | null;
  message_body: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type OutreachMemoryRow = {
  key: string;
  candidateName: string;
  contactEmail: string;
  sentCount: number;
  lastSentAt: string | null;
  lastSubject: string | null;
  followUpStatus: "due" | "queued" | "waiting" | "replied";
  followUpLabel: string;
  followUpDetail: string;
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

type RevenueAgentLane = {
  agentName: string;
  mission: string;
  status: "blocked" | "action" | "watch" | "ready";
  metric: string | number;
  metricLabel: string;
  detail: string;
  allowedNow: string;
  approvalGate: string;
  nextAction: string;
  taskCount: number;
  approvalCount: number;
  href: string;
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
      label: "Candidate refresh",
      value: process.env.POLITICAL_DAILY_SYNC_STATES || "OH, IL, TN daily",
      tone: "ok",
    },
    {
      label: "Approved email auto-send",
      value: `${process.env.AUTO_SEND_APPROVED_EMAIL_LIMIT || "3"}/run weekdays`,
      tone: "ok",
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
      status: controls?.manual_approval_mode ? "ready" : "needs_owner",
      detail: "Political replies must notify Jason and pause automation. Initial outreach must be approved before it becomes eligible for auto-send.",
      ownerStep: controls?.manual_approval_mode
        ? "Manual approval mode is active. Approve drafts you want released; unapproved drafts stay parked."
        : "Turn on manual approval mode before approving political message templates for live sends.",
    },
    {
      title: "Daily candidate refresh",
      status: "ready",
      detail: "The nightly candidate intelligence job now refreshes Ohio, Illinois, and Tennessee by default.",
      ownerStep: "Add state SOS/BOE feed configs when available to expand beyond FEC and configured public feeds.",
    },
    {
      title: "Approved email auto-send",
      status: "ready",
      detail: "Approved political emails can send automatically during weekday business hours through the same reputation and suppression checks as the manual button.",
      ownerStep: "Review and approve drafts. Anything still marked needs review will not send.",
    },
    {
      title: "Leave SerpAPI discovery paused",
      status: "watch",
      detail: "Broad paid search discovery remains paused to prevent surprise usage and charges. Daily candidate refresh still runs from approved election data sources.",
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
          .select("id,thread_id,business_line,channel,status,title,message_body,created_at,due_at,metadata")
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
          .select("id,thread_id,business_line,channel,direction,provider,provider_message_id,processing_status,contact_name,contact_email,subject,message_body,created_at,metadata")
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

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function homeReachUrl(pathname: string, params: Record<string, string | number | null | undefined>) {
  const url = new URL(pathname, "https://www.home-reach.com");
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function approvalPreviewImageUrl(item: ApprovalRow) {
  const metadata = item.metadata ?? {};
  const displayName = firstString(
    metadata.organization_name,
    metadata.display_name,
    metadata.candidate_name,
    metadata.business_name,
    item.title,
  );
  const sourceSystem = firstString(metadata.source_system);

  if (sourceSystem === "daily_outreach_tasks") {
    if (item.business_line === "political") {
      return homeReachUrl("/api/political/candidate-options-image", {
        candidate: displayName,
        office: firstString(metadata.office, metadata.industry),
        county: firstString(metadata.county),
        city: firstString(metadata.city),
        state: firstString(metadata.state),
      });
    }
    if (item.business_line === "inventory_procurement") {
      return homeReachUrl("/api/outreach-visuals/supplyfy-savings", {
        business: displayName,
        category: firstString(metadata.industry, metadata.category),
      });
    }
    if (item.business_line === "targeted_mailing") {
      return homeReachUrl("/api/outreach-visuals/targeted-neighborhood", {
        business: displayName,
        city: firstString(metadata.city),
        industry: firstString(metadata.industry, metadata.category),
        neighborhood: firstString(metadata.neighborhood_example),
        households: firstString(metadata.household_density_estimate),
      });
    }
  }

  return firstString(metadata.political_options_image_url, metadata.visual_url);
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

function formatShortDate(value: string | null) {
  if (!value) return "Not sent";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function outreachMemoryKey(contactEmail: string | null, candidateName: string | null, fallback: string) {
  return (contactEmail ?? candidateName ?? fallback).toLowerCase();
}

function buildPoliticalOutreachMemory(events: EventRow[], approvals: ApprovalRow[] = []): OutreachMemoryRow[] {
  const queuedFollowUps = new Set<string>();
  for (const approval of approvals) {
    if (approval.business_line !== "political" || approval.channel !== "email") continue;
    if (!["draft", "needs_review", "approved", "scheduled"].includes(approval.status)) continue;
    if (approval.metadata?.outreach_stage !== "follow_up") continue;
    const contactEmail = firstString(approval.metadata?.to_email, approval.metadata?.contact_email);
    const candidateName = firstString(approval.metadata?.candidate_name, approval.metadata?.organization_name);
    queuedFollowUps.add(outreachMemoryKey(contactEmail, candidateName, approval.id));
  }

  const groups = new Map<string, EventRow[]>();
  for (const event of events) {
    if (event.business_line !== "political" || event.channel !== "email") continue;
    const contactEmail = firstString(event.contact_email, event.metadata?.to_email, event.metadata?.contact_email);
    const candidateName = firstString(event.metadata?.candidate_name, event.contact_name, event.metadata?.organization_name);
    const key = outreachMemoryKey(contactEmail, candidateName, event.thread_id ?? event.id);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const rows: OutreachMemoryRow[] = [];
  for (const [key, groupEvents] of groups) {
    const sorted = [...groupEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const outbound = sorted.filter((event) => event.direction === "outbound");
    if (outbound.length === 0) continue;
    const lastOutbound = outbound[0]!;
    const contactEmail = firstString(lastOutbound.contact_email, lastOutbound.metadata?.to_email, lastOutbound.metadata?.contact_email) ?? "No email logged";
    const candidateName =
      firstString(lastOutbound.metadata?.candidate_name, lastOutbound.contact_name, lastOutbound.metadata?.organization_name) ??
      "Campaign contact";
    const lastSentAt = lastOutbound.created_at;
    const repliedAfterLast = sorted.some(
      (event) =>
        event.direction === "inbound" &&
        new Date(event.created_at).getTime() > new Date(lastSentAt).getTime(),
    );
    const followUpDate = addDays(lastSentAt, 3);
    const due = Date.now() >= followUpDate.getTime();
    const followUpQueued = queuedFollowUps.has(key);
    const followUpStatus: OutreachMemoryRow["followUpStatus"] = repliedAfterLast
      ? "replied"
      : followUpQueued
        ? "queued"
        : due
          ? "due"
          : "waiting";

    rows.push({
      key,
      candidateName,
      contactEmail,
      sentCount: outbound.length,
      lastSentAt,
      lastSubject: lastOutbound.subject,
      followUpStatus,
      followUpLabel: repliedAfterLast
        ? "Reply received"
        : followUpQueued
          ? "Follow-up queued"
          : due
            ? "Follow-up due"
            : `Follow-up ${formatShortDate(followUpDate.toISOString())}`,
      followUpDetail: repliedAfterLast
        ? "Manual response path"
        : followUpQueued
          ? "Review queued draft"
          : due
            ? "Generate a follow-up draft"
            : "Wait before sending another email",
    });
  }

  return rows.sort((a, b) => {
    const toneRank = { due: 0, queued: 1, waiting: 2, replied: 3 };
    const rank = toneRank[a.followUpStatus] - toneRank[b.followUpStatus];
    if (rank !== 0) return rank;
    return new Date(b.lastSentAt ?? 0).getTime() - new Date(a.lastSentAt ?? 0).getTime();
  });
}

function lineLabel(line: BusinessLine) {
  return BUSINESS_LINES.find((entry) => entry.id === line)?.label ?? "Unknown";
}

function inferThreadBusinessLine(thread: ThreadRow): BusinessLine {
  if (thread.business_line === "political") return "political";

  const haystack = [
    thread.source_system,
    thread.display_name,
    thread.organization_name,
    thread.city,
    thread.category,
    thread.latest_message_body,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\bpolitical\b|\bcandidate\b|\bcampaign committee\b|\bgovernor\b|\bsenate\b|\battorney general\b|\bsecretary of state\b|\bauditor\b|\btreasurer\b|\bmayor\b|\bcity council\b|\bschool board\b|\bcommissioner\b|\bjudicial\b|\bjudge\b|\bsheriff\b/.test(
      haystack,
    )
  ) {
    return "political";
  }

  if (
    /\bprocurement\b|\binventory\b|\bsupplier\b|\bvendor\b|\bsavings audit\b|\blanded cost\b/.test(
      haystack,
    )
  ) {
    return "inventory_procurement";
  }

  return thread.business_line;
}

function normalizeThreadBusinessLine(thread: ThreadRow): ThreadRow {
  const inferred = inferThreadBusinessLine(thread);
  return inferred === thread.business_line ? thread : { ...thread, business_line: inferred };
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
      detail: "Daily candidate refresh is active for OH, IL, and TN. Broad SerpAPI discovery remains paused until restarted with quotas.",
      tone: "green",
    },
  ];
}

function taskCountForAgent(tasks: WorkforceTask[], agentName: string) {
  return tasks.filter((task) => task.assignedAgent.toLowerCase().includes(agentName.toLowerCase())).length;
}

function taskCountForWorkflow(tasks: WorkforceTask[], pattern: RegExp) {
  return tasks.filter((task) => pattern.test(`${task.workflowName} ${task.assignedAgent} ${task.expectedOutput}`)).length;
}

function countBusinessLineApprovals(approvals: ApprovalRow[], line: BusinessLine) {
  return approvals.filter((approval) => approval.business_line === line).length;
}

function buildRevenueAgentLanes({
  connectorStatus,
  controls,
  followUpsDue,
  ownerActions,
  pendingApprovals,
  politicalHandoffs,
  politicalSendsTracked,
  received24h,
  sent24h,
  unread,
  workforce,
  data,
}: {
  connectorStatus: ReturnType<typeof getEnvStatus>;
  controls: SystemControls | null;
  followUpsDue: number;
  ownerActions: OwnerAction[];
  pendingApprovals: number;
  politicalHandoffs: number;
  politicalSendsTracked: number;
  received24h: number;
  sent24h: number;
  unread: number;
  workforce: AiWorkforceCommandCenterData;
  data: RevenueOpsData;
}): RevenueAgentLane[] {
  const tasks = workforce.tasks;
  const blockedOwnerActions = ownerActions.filter((action) => action.status === "blocked").length;
  const ownerItems = ownerActions.filter((action) => action.status === "needs_owner").length;
  const missingConnectors = connectorStatus.filter((item) => item.tone !== "ok").length;
  const approvedPoliticalEmails = data.approvals.filter(
    (approval) => approval.business_line === "political" && approval.channel === "email" && approval.status === "approved",
  ).length;
  const procurementQueue = countBusinessLineApprovals(data.approvals, "inventory_procurement");
  const procurementSuggestions = data.suggestions.filter((suggestion) => suggestion.business_line === "inventory_procurement").length;
  const stalePressure = unread + pendingApprovals + followUpsDue + politicalHandoffs;

  return [
    {
      agentName: "Orchestrator Agent",
      mission: "Owns dependency order, approval gates, and final handoff discipline.",
      status: blockedOwnerActions > 0 ? "blocked" : ownerItems > 0 ? "watch" : "ready",
      metric: blockedOwnerActions,
      metricLabel: "blockers",
      detail: "Coordinates Revenue Operations work without creating duplicate dashboards or bypassing approval rules.",
      allowedNow: "Assign agent tasks, summarize blockers, and keep next actions visible.",
      approvalGate: "Cannot publish, send, charge, change pricing, or alter live campaigns.",
      nextAction:
        blockedOwnerActions > 0
          ? "Clear blocked owner action items before scaling."
          : ownerItems > 0
            ? "Resolve remaining owner action items."
            : "Keep monitoring agent queues and approvals.",
      taskCount: taskCountForAgent(tasks, "Orchestrator"),
      approvalCount: pendingApprovals,
      href: "/admin/agents",
    },
    {
      agentName: "Revenue Integrity Agent",
      mission: "Finds stuck leads, missed follow-ups, unpaid opportunities, and daily revenue risk.",
      status: stalePressure > 0 ? "action" : "ready",
      metric: stalePressure,
      metricLabel: "risk items",
      detail: "Combines unread replies, review queue load, due follow-ups, and political handoffs into one owner-facing risk count.",
      allowedNow: "Prioritize recovery actions, draft follow-ups, and flag high-value stuck opportunities.",
      approvalGate: "Recovery messages and payment-related actions still require human approval.",
      nextAction:
        stalePressure > 0
          ? "Work the oldest replies, due follow-ups, and review items first."
          : "No immediate revenue leakage visible in the current ledger.",
      taskCount: taskCountForAgent(tasks, "Revenue Integrity"),
      approvalCount: pendingApprovals,
      href: "/admin/agents",
    },
    {
      agentName: "Outreach Agent",
      mission: "Drafts email/SMS/DM variations and keeps outreach human, compliant, and non-repetitive.",
      status: pendingApprovals > 0 || approvedPoliticalEmails > 0 ? "action" : "ready",
      metric: `${pendingApprovals}/${approvedPoliticalEmails}`,
      metricLabel: "review/approved",
      detail: "Keeps needs-review drafts parked and releases only approved political email through existing safety checks.",
      allowedNow: "Create variants, queue follow-ups, rotate phrasing, and prepare approval-ready drafts.",
      approvalGate: "Needs-review drafts cannot send. Approved sends remain subject to caps, suppression, and business hours.",
      nextAction:
        approvedPoliticalEmails > 0
          ? "Approved political emails are eligible for the weekday auto-send job."
          : pendingApprovals > 0
            ? "Review drafts, approve only the ones ready to release."
            : "Generate fresh candidate drafts or follow-ups as needed.",
      taskCount: taskCountForAgent(tasks, "Outreach"),
      approvalCount: pendingApprovals,
      href: "/admin/revenue-operations",
    },
    {
      agentName: "Political Campaign Agent",
      mission: "Supports compliant political mail plans, candidate context, geography, timing, and proposal drafts.",
      status: politicalHandoffs > 0 || followUpsDue > 0 ? "action" : politicalSendsTracked > 0 ? "watch" : "ready",
      metric: politicalSendsTracked,
      metricLabel: "tracked sends",
      detail: "Uses public race context and campaign/logistics data only; no individual voter belief inference.",
      allowedNow: "Refresh candidate context, draft neutral mail-plan follow-ups, and flag campaign handoffs.",
      approvalGate: "Political messaging must remain approval-gated; replies move to Jason/manual takeover.",
      nextAction:
        politicalHandoffs > 0
          ? "Handle political replies manually before more automation."
          : followUpsDue > 0
            ? "Generate due follow-up drafts for review."
            : "Keep daily candidate refresh and approved outreach moving.",
      taskCount: taskCountForWorkflow(tasks, /political|candidate|campaign/i),
      approvalCount: countBusinessLineApprovals(data.approvals, "political"),
      href: "/admin/political",
    },
    {
      agentName: "Data / Revenue Agent",
      mission: "Measures message flow, conversion signals, queue pressure, and revenue opportunity quality.",
      status: data.suggestions.length > 0 || sent24h + received24h > 0 ? "watch" : "ready",
      metric: `${sent24h}/${received24h}`,
      metricLabel: "sent/inbound 24h",
      detail: "Turns the communication ledger into a simple operating readout for what happened today.",
      allowedNow: "Analyze trends, summarize conversion bottlenecks, and recommend next best actions.",
      approvalGate: "Cannot mark deals won, change revenue state, discount, or alter payment records.",
      nextAction:
        data.suggestions.length > 0
          ? "Review AI suggestions and convert useful ones into approval queue items."
          : "Keep monitoring sends, replies, and conversion events.",
      taskCount: taskCountForAgent(tasks, "Data / Revenue"),
      approvalCount: data.suggestions.length,
      href: "/admin/revenue-operations",
    },
    {
      agentName: "Procurement Agent",
      mission: "Finds supplier savings, vendor-risk angles, and procurement outreach opportunities.",
      status: procurementQueue + procurementSuggestions > 0 ? "action" : "ready",
      metric: procurementQueue + procurementSuggestions,
      metricLabel: "procurement items",
      detail: "Keeps procurement outreach separate from political and local-business messaging.",
      allowedNow: "Draft savings-audit notes, organize demo follow-ups, and flag owner-friendly procurement insights.",
      approvalGate: "Cannot place orders, switch vendors, approve purchases, or commit spend.",
      nextAction:
        procurementQueue + procurementSuggestions > 0
          ? "Review procurement drafts and savings suggestions."
          : "No procurement queue pressure in the current snapshot.",
      taskCount: taskCountForWorkflow(tasks, /procurement|inventory|supplier/i),
      approvalCount: procurementQueue,
      href: "/admin/procurement",
    },
    {
      agentName: "QA / System Health Agent",
      mission: "Protects auth, webhooks, sends, queues, payments, dashboards, and error states.",
      status: !controls || blockedOwnerActions > 0 ? "blocked" : missingConnectors > 0 ? "watch" : "ready",
      metric: missingConnectors,
      metricLabel: "connector warnings",
      detail: "Holds the line on revenue-critical flows before more automation is allowed to scale.",
      allowedNow: "Audit controls, verify connector status, and document regressions with reproduction steps.",
      approvalGate: "Cannot run destructive tests or mutate production data without approval.",
      nextAction:
        !controls
          ? "Verify system_controls migration and row id=1."
          : missingConnectors > 0
            ? "Resolve connector warnings before increasing send volume."
            : "Continue health checks and route verification.",
      taskCount: taskCountForAgent(tasks, "QA"),
      approvalCount: blockedOwnerActions,
      href: "/admin/agents",
    },
  ];
}

function agentLaneTone(status: RevenueAgentLane["status"]): "green" | "amber" | "red" | "neutral" {
  if (status === "blocked") return "red";
  if (status === "action" || status === "watch") return "amber";
  return "green";
}

function agentLaneLabel(status: RevenueAgentLane["status"]) {
  if (status === "blocked") return "blocked";
  if (status === "action") return "act now";
  if (status === "watch") return "watch";
  return "ready";
}

function revenueAgentReadiness(lanes: RevenueAgentLane[]) {
  const blocked = lanes.filter((lane) => lane.status === "blocked").length;
  const action = lanes.filter((lane) => lane.status === "action").length;
  const watch = lanes.filter((lane) => lane.status === "watch").length;
  const score = Math.max(0, 100 - blocked * 25 - action * 10 - watch * 5);
  return { blocked, action, watch, score };
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
  const [data, workforce] = await Promise.all([
    loadRevenueOperations(),
    loadAiWorkforceCommandCenter(),
  ]);
  const normalizedThreads = data.threads.map(normalizeThreadBusinessLine);
  const latestPoliticalThreads = normalizedThreads
    .filter((thread) => thread.business_line === "political")
    .slice(0, 12);
  const unread = normalizedThreads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0);
  const pendingApprovals = countWhere(data.approvals, (row) => row.status === "needs_review" || row.status === "draft");
  const politicalHandoffs = countWhere(
    normalizedThreads,
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
  const sentMessages = data.events
    .filter((event) => event.direction === "outbound")
    .slice(0, 10);
  const politicalOutreachMemory = buildPoliticalOutreachMemory(data.events, data.approvals);
  const followUpsDue = politicalOutreachMemory.filter((row) => row.followUpStatus === "due").length;
  const followUpsQueued = politicalOutreachMemory.filter((row) => row.followUpStatus === "queued").length;
  const politicalSendsTracked = politicalOutreachMemory.reduce((total, row) => total + row.sentCount, 0);
  const dailySummary = buildDailySummary({
    controls: data.controls,
    ownerActions,
    pendingApprovals,
    politicalHandoffs,
    received24h,
    sent24h,
    unread,
  });
  const revenueAgentLanes = buildRevenueAgentLanes({
    connectorStatus,
    controls: data.controls,
    followUpsDue,
    ownerActions,
    pendingApprovals,
    politicalHandoffs,
    politicalSendsTracked,
    received24h,
    sent24h,
    unread,
    workforce,
    data,
  });
  const agentReadiness = revenueAgentReadiness(revenueAgentLanes);

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
              <a
                href="#daily-outreach"
                className="rounded-md border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-100 transition hover:bg-sky-400/15"
              >
                Daily Outreach
              </a>
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
            value={normalizedThreads.length}
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

        <MomentumStrip
          sentTracked={politicalSendsTracked}
          followUpsDue={followUpsDue}
          followUpsQueued={followUpsQueued}
          pendingApprovals={pendingApprovals}
          unread={unread}
        />

        <EmailApprovalQueue
          approvals={data.approvals.map((approval) => ({
            ...approval,
            previewImageUrl: approvalPreviewImageUrl(approval),
          }))}
        />

        <RevenueAgentCommandLayer
          lanes={revenueAgentLanes}
          readiness={agentReadiness}
          workforce={workforce}
        />

        <section id="daily-outreach" className="scroll-mt-6 rounded-xl border border-slate-800 bg-white p-4 text-slate-950 shadow-2xl md:p-5">
          <DailyOutreachClient embedded />
        </section>

        <OwnerActionPanel actions={ownerActions} />

        <section className="grid gap-4 lg:grid-cols-3">
          {BUSINESS_LINES.map((line) => {
            const threads = normalizedThreads.filter((thread) => thread.business_line === line.id);
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
                      ? "Approved initial outreach can auto-send through caps and suppression checks; inbound replies pause automation and create a manual handoff."
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
                  Political-only while email volume is throttled. Non-political threads stay logged, but the active send focus is campaign outreach.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SearchPoliticalEmailsButton />
                <GeneratePoliticalEmailsButton label="Generate first emails" mode="first_touch" />
                <StatusPill tone="amber">{latestPoliticalThreads.length} political loaded</StatusPill>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr] bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>Lead</span>
                <span>Line</span>
                <span>Status</span>
                <span>Latest</span>
              </div>
              <div className="divide-y divide-slate-800">
                {latestPoliticalThreads.map((thread) => (
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
                {latestPoliticalThreads.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">
                    No political revenue messaging threads are loaded yet.
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

        <PoliticalOutreachMemoryPanel rows={politicalOutreachMemory} />

        <SentMessagesPanel events={sentMessages} memoryRows={politicalOutreachMemory} />

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

function MomentumStrip({
  sentTracked,
  followUpsDue,
  followUpsQueued,
  pendingApprovals,
  unread,
}: {
  sentTracked: number;
  followUpsDue: number;
  followUpsQueued: number;
  pendingApprovals: number;
  unread: number;
}) {
  const items = [
    {
      label: "Known email sends",
      value: sentTracked,
      detail: "Tracked in the communication ledger.",
      icon: MailCheck,
      tone: sentTracked > 0 ? "green" : "neutral",
    },
    {
      label: "Follow-ups due",
      value: followUpsDue,
      detail: "Draft follow-ups before leads cool off.",
      icon: Clock3,
      tone: followUpsDue > 0 ? "amber" : "green",
    },
    {
      label: "Queued follow-ups",
      value: followUpsQueued,
      detail: "Needs-review items stay parked until approved.",
      icon: ShieldCheck,
      tone: followUpsQueued > 0 ? "amber" : "green",
    },
    {
      label: "Replies / approvals",
      value: `${unread}/${pendingApprovals}`,
      detail: "Unread messages and approval-gated drafts.",
      icon: MessageSquare,
      tone: unread + pendingApprovals > 0 ? "amber" : "green",
    },
  ] as const;

  return (
    <section className="rounded-lg border border-sky-300/20 bg-sky-400/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Sales momentum</p>
          <h2 className="mt-1 text-xl font-black text-white">What needs movement before opportunities go stale</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-300">
          This strip shows sent emails, follow-up need, review gates, and replies. Approved political emails can auto-send; needs-review items stay parked.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-white">{item.value}</p>
                </div>
                <div
                  className={cn(
                    "rounded-md border p-2",
                    item.tone === "green" && "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
                    item.tone === "amber" && "border-amber-300/30 bg-amber-400/10 text-amber-200",
                    item.tone === "neutral" && "border-sky-300/20 bg-sky-400/10 text-sky-200",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RevenueAgentCommandLayer({
  lanes,
  readiness,
  workforce,
}: {
  lanes: RevenueAgentLane[];
  readiness: ReturnType<typeof revenueAgentReadiness>;
  workforce: AiWorkforceCommandCenterData;
}) {
  const activeTasks = workforce.tasks.filter((task) =>
    ["new", "assigned", "in_progress", "blocked", "awaiting_approval", "needs_revision", "failed"].includes(task.status),
  );
  const highRiskTasks = activeTasks.filter((task) =>
    ["blocked", "failed", "awaiting_approval", "needs_revision"].includes(task.status),
  );

  return (
    <section className="rounded-xl border border-sky-300/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sky-300/25 bg-sky-400/10 text-sky-200">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-200">Agent Revenue Command Layer</p>
            <h2 className="mt-1 text-2xl font-black text-white">AI agents strengthen the queue without bypassing human control</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              This layer connects Revenue Operations to the AI Workforce task manifest, activity ledger, AI Assets rules,
              and HomeReach approval gates. Agents can analyze, draft, prioritize, and escalate. They cannot send,
              publish, charge, change pricing, or alter active campaigns without approval.
            </p>
          </div>
        </div>
        <div className="grid min-w-[260px] grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <MiniMetric label="Readiness" value={`${readiness.score}/100`} />
          <MiniMetric label="Act now" value={readiness.action} />
          <MiniMetric label="Blocked" value={readiness.blocked} />
          <MiniMetric label="Watch" value={readiness.watch} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-7">
        {lanes.map((lane) => (
          <div key={lane.agentName} className="rounded-lg border border-slate-800 bg-slate-950/75 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Agent</p>
                <h3 className="mt-1 text-sm font-black leading-5 text-white">{lane.agentName}</h3>
              </div>
              <StatusPill tone={agentLaneTone(lane.status)}>{agentLaneLabel(lane.status)}</StatusPill>
            </div>
            <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/60 p-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{lane.metricLabel}</p>
              <p className="mt-1 text-2xl font-black text-white">{lane.metric}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{lane.mission}</p>
            <div className="mt-3 space-y-2 text-xs leading-5">
              <div className="rounded-md border border-emerald-300/15 bg-emerald-400/10 p-2 text-emerald-100">
                <span className="font-black">Allowed: </span>
                {lane.allowedNow}
              </div>
              <div className="rounded-md border border-amber-300/15 bg-amber-400/10 p-2 text-amber-100">
                <span className="font-black">Gate: </span>
                {lane.approvalGate}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{lane.nextAction}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill>{lane.taskCount} tasks</StatusPill>
              <StatusPill>{lane.approvalCount} approvals</StatusPill>
            </div>
            <Link href={lane.href} className="mt-3 inline-flex text-xs font-black uppercase tracking-[0.12em] text-sky-300 hover:text-sky-200">
              Open lane
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">Agent task manifest</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Pulls from the shared `ai_workforce_tasks` manifest. High-risk tasks surface first.
              </p>
            </div>
            <Link href="/admin/agents" className="rounded-md border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-100 hover:bg-sky-400/15">
              Full command
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {(highRiskTasks.length ? highRiskTasks : activeTasks).slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{task.taskId || task.workflowName}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.assignedAgent} - {task.workflowName}</p>
                  </div>
                  <StatusPill tone={["blocked", "failed"].includes(task.status) ? "red" : task.status === "awaiting_approval" ? "amber" : "neutral"}>
                    {task.status.replaceAll("_", " ")}
                  </StatusPill>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{task.expectedOutput || task.completionNotes || "No task detail captured."}</p>
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                No active AI workforce tasks are visible in the current manifest.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-4">
          <h3 className="text-lg font-black text-white">Hardening rules now enforced visually</h3>
          <div className="mt-3 space-y-3">
            {[
              "Every outbound draft remains approval-gated before use.",
              "Political outreach uses public/campaign/logistics context only, never individual voter belief inference.",
              "Approved auto-send still runs through sender identity, suppression, reputation, caps, and business-hour checks.",
              "Procurement agents may recommend savings but cannot commit spend or switch vendors.",
              "Revenue agents can prioritize and draft, but cannot change pricing, payment, or deal status.",
            ].map((rule) => (
              <div key={rule} className="flex gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm leading-6 text-slate-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-sky-300/20 bg-sky-400/10 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-200">Source of truth</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              AI Assets and AGENTS.md define agent behavior; `revenue_message_*` remains the canonical communication ledger.
            </p>
          </div>
        </div>
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

function followUpTone(status: OutreachMemoryRow["followUpStatus"]): "neutral" | "green" | "amber" | "red" {
  if (status === "due") return "amber";
  if (status === "queued") return "amber";
  if (status === "replied") return "green";
  return "neutral";
}

function PoliticalOutreachMemoryPanel({ rows }: { rows: OutreachMemoryRow[] }) {
  const dueCount = rows.filter((row) => row.followUpStatus === "due").length;
  const queuedCount = rows.filter((row) => row.followUpStatus === "queued").length;
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-sky-300/20 bg-sky-400/10 text-sky-200">
            <MailCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Political Outreach Memory</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Tracks who already got emails and when a follow-up email should be drafted.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={dueCount > 0 ? "amber" : "green"}>
            {dueCount} due
          </StatusPill>
          {queuedCount > 0 && <StatusPill tone="amber">{queuedCount} queued</StatusPill>}
          <GeneratePoliticalEmailsButton
            label="Generate due follow-ups"
            mode="due_followups"
            tone="amber"
            limit={8}
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
        <div className="grid grid-cols-[1.1fr_1fr_0.55fr_0.7fr_0.9fr] bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span>Campaign</span>
          <span>Email</span>
          <span>Sent</span>
          <span>Last Email</span>
          <span>Follow-Up Email</span>
        </div>
        <div className="divide-y divide-slate-800">
          {rows.slice(0, 12).map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1.1fr_1fr_0.55fr_0.7fr_0.9fr] gap-3 px-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{row.candidateName}</p>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">{row.lastSubject ?? "No subject logged"}</p>
              </div>
              <p className="min-w-0 truncate text-xs font-semibold text-slate-300">{row.contactEmail}</p>
              <p className="text-sm font-black text-white">{row.sentCount}</p>
              <p className="text-xs text-slate-400">{formatDate(row.lastSentAt)}</p>
              <div>
                <StatusPill tone={followUpTone(row.followUpStatus)}>{row.followUpLabel}</StatusPill>
                <p className="mt-1 text-xs text-slate-500">{row.followUpDetail}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-slate-500">
              No political email sends have been logged yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SentMessagesPanel({ events, memoryRows }: { events: EventRow[]; memoryRows: OutreachMemoryRow[] }) {
  const memoryByEmail = new Map(memoryRows.map((row) => [row.contactEmail.toLowerCase(), row]));
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
            <MailCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Sent Messages</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              This is the live send ledger. Anything you send from the approval queue appears here after Postmark accepts it.
            </p>
          </div>
        </div>
        <StatusPill tone={events.length > 0 ? "green" : "neutral"}>{events.length} recent sends</StatusPill>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
        <div className="grid grid-cols-[0.65fr_0.9fr_0.7fr_1.2fr_0.9fr] bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <span>Sent</span>
          <span>Recipient</span>
          <span>Status</span>
          <span>Message</span>
          <span>Follow-Up Email</span>
        </div>
        <div className="divide-y divide-slate-800">
          {events.map((event) => {
            const contactEmail = firstString(event.contact_email, event.metadata?.to_email, event.metadata?.contact_email);
            const memory = contactEmail ? memoryByEmail.get(contactEmail.toLowerCase()) : null;
            return (
              <div
                key={event.id}
                className="grid grid-cols-[0.65fr_0.9fr_0.7fr_1.2fr_0.9fr] gap-3 px-3 py-3 text-sm"
              >
                <div className="text-xs text-slate-400">
                  <p>{formatDate(event.created_at)}</p>
                  <p className="mt-1 uppercase text-slate-500">{event.channel}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">
                    {event.contact_name ?? String(event.metadata?.candidate_name ?? "Campaign contact")}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {contactEmail ?? "No email saved"}
                  </p>
                </div>
                <div>
                  <StatusPill tone={event.processing_status === "processed" ? "green" : "amber"}>
                    {event.processing_status}
                  </StatusPill>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {event.provider ?? "provider pending"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-200">{event.subject ?? "No subject"}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                    {event.message_body ?? "No message body captured."}
                  </p>
                </div>
                <div>
                  {memory ? (
                    <>
                      <StatusPill tone={followUpTone(memory.followUpStatus)}>{memory.followUpLabel}</StatusPill>
                      <p className="mt-1 text-xs text-slate-500">{memory.followUpDetail}</p>
                    </>
                  ) : (
                    <StatusPill>Not tracked</StatusPill>
                  )}
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-slate-500">
              No sent messages have been logged yet. Generate email drafts, review them, then click Send email to populate this ledger.
            </div>
          )}
        </div>
      </div>
    </section>
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
            Needs-review items do not send. Once a political email is approved, the weekday auto-send job can release it through the same safety checks as the manual button.
          </p>
        </div>
        <StatusPill tone={approvals.length > 0 ? "amber" : "green"}>{approvals.length} items</StatusPill>
      </div>
      <div className="mt-4 space-y-3">
        {approvals.slice(0, 6).map((item) => {
          const previewImageUrl = approvalPreviewImageUrl(item);
          return (
          <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {lineLabel(item.business_line)} - {item.channel.toUpperCase()} - {formatDate(item.created_at)}
                </p>
                {item.metadata && (
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <p>
                      From:{" "}
                      <span className="text-slate-200">
                        {String(item.metadata.sender_name ?? "HomeReach")} &lt;{String(item.metadata.sender_email ?? "not assigned")}&gt;
                      </span>
                    </p>
                    <p>
                      To:{" "}
                      <span className="text-slate-200">
                        {String(item.metadata.to_email ?? item.metadata.contact_email ?? "missing recipient")}
                      </span>
                    </p>
                    <p>
                      Subject:{" "}
                      <span className="text-slate-200">
                        {String(item.metadata.subject ?? item.title)}
                      </span>
                    </p>
                    {Boolean(
                      item.metadata.outreach_stage ||
                        item.metadata.previous_email_count ||
                        item.metadata.follow_up_due_at ||
                        item.metadata.copy_variant_key,
                    ) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {typeof item.metadata.outreach_stage === "string" && (
                          <StatusPill tone={item.metadata.outreach_stage === "follow_up" ? "amber" : "neutral"}>
                            {item.metadata.outreach_stage.replaceAll("_", " ")}
                          </StatusPill>
                        )}
                        {typeof item.metadata.previous_email_count === "number" && (
                          <StatusPill>
                            {item.metadata.previous_email_count} prior email
                            {item.metadata.previous_email_count === 1 ? "" : "s"}
                          </StatusPill>
                        )}
                        {typeof item.metadata.follow_up_due_at === "string" && (
                          <StatusPill tone="amber">
                            due {formatShortDate(item.metadata.follow_up_due_at)}
                          </StatusPill>
                        )}
                        {typeof item.metadata.copy_variant_key === "string" && (
                          <StatusPill>
                            variant {item.metadata.copy_variant_key}
                          </StatusPill>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <StatusPill tone={item.status === "needs_review" ? "amber" : "neutral"}>
                {item.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
            {item.message_body && (
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{item.message_body}</p>
            )}
            {previewImageUrl && (
              <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-slate-950">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Outreach image included
                  </p>
                  <a
                    href={previewImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-sky-300 hover:text-sky-200"
                  >
                    Open
                  </a>
                </div>
                <img
                  src={previewImageUrl}
                  alt={`${String(item.metadata?.candidate_name ?? item.metadata?.organization_name ?? "Outreach")} visual preview`}
                  className="block aspect-[1200/630] w-full object-cover"
                />
              </div>
            )}
            <ApprovalSendActions
              approvalId={item.id}
              channel={item.channel}
              status={item.status}
              messageBody={item.message_body}
            />
          </div>
          );
        })}
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
      body: "Approve/edit/reject/schedule actions are the release gate; approved email sends still pass throttling and opt-out checks.",
    },
    {
      title: "Phase 3 - Procurement Outreach",
      body: "Tag procurement leads, generate savings-audit drafts, and connect Operations Copilot recommendations to outreach threads.",
    },
    {
      title: "Phase 4 - Political Handoff",
      body: "Approved initial outreach can auto-send. All responses pause automation and notify Jason for manual takeover.",
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
