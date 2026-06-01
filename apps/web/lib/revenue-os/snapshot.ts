import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  REVENUE_PIPELINE_STAGES,
  type DailyRevenueCommandCenterData,
  type RevenueCampaignPerformance,
  type RevenueHealthGuardrail,
  type RevenueMetric,
  type RevenuePipelineStage,
  type RevenuePipelineStageSummary,
  type RevenuePriorityAction,
  type RevenueStrategyRecommendation,
  type RevenueTeamPerformance,
  type RevenueTomorrowQueueItem,
  type RevenueTone,
} from "./types";

type QueryError = { message?: string; code?: string };

type PipelineItemRow = {
  id: string;
  source_system: string | null;
  source_id: string | null;
  business_line: string | null;
  primary_stage: string | null;
  lead_name: string | null;
  organization_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  category: string | null;
  campaign_type: string | null;
  assigned_owner_key: string | null;
  estimated_value_cents: number | null;
  engagement_score: number | null;
  response_likelihood_score: number | null;
  urgency_score: number | null;
  conversion_probability_score: number | null;
  revenue_priority_score: number | null;
  latest_outreach_channel: string | null;
  latest_outreach_at: string | null;
  latest_reply_at: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  next_recommended_channel: string | null;
  status: string | null;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type PipelineTaskRow = {
  id: string;
  pipeline_item_id: string | null;
  source_system: string | null;
  source_id: string | null;
  task_type: string | null;
  channel: string | null;
  title: string | null;
  detail: string | null;
  assigned_owner_key: string | null;
  due_at: string | null;
  priority: string | null;
  status: string | null;
  approval_required: boolean | null;
  approval_queue_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type SalesLeadRow = {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  priority: string | null;
  buying_signal: boolean | null;
  do_not_contact: boolean | null;
  sms_opt_out: boolean | null;
  last_contacted_at: string | null;
  last_reply_at: string | null;
  next_follow_up_at?: string | null;
  total_messages_sent: number | null;
  total_replies: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type RevenueEventRow = {
  id: string;
  business_line: string | null;
  channel: string | null;
  direction: string | null;
  event_type: string | null;
  normalized_from: string | null;
  normalized_to: string | null;
  subject: string | null;
  message_body: string | null;
  source_system: string | null;
  source_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

type DailyOutreachTaskRow = {
  id: string;
  outreach_date: string | null;
  campaign_type: string | null;
  category: string | null;
  business_name: string | null;
  campaign_name: string | null;
  contact_name: string | null;
  sender_key: string | null;
  sender_name: string | null;
  sender_email: string | null;
  scheduled_send_at: string | null;
  send_status: string | null;
  approval_status: string | null;
  action_type: string | null;
  priority: string | null;
  email_subject: string | null;
  cta_variant_key: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  created_at: string | null;
};

type SenderControlRow = {
  sender_key: string | null;
  sender_name: string | null;
  sender_email: string | null;
  business_line: string | null;
  daily_cap: number | null;
  paused: boolean | null;
  manual_approval_required: boolean | null;
};

type StrategyInsightRow = {
  id: string;
  insight_type: string | null;
  title: string | null;
  detail: string | null;
  recommendation: string | null;
  confidence: number | string | null;
  impact: string | null;
  status: string | null;
};

type ApprovalRow = {
  id: string;
  business_line: string | null;
  channel: string | null;
  status: string | null;
  title: string | null;
  due_at: string | null;
  created_at: string | null;
};

type IntakeRow = {
  id: string;
  status: string | null;
  submitted_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SalesEventRow = {
  id: string;
  lead_id: string | null;
  action_type: string | null;
  channel: string | null;
  revenue_cents: number | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

type SenderHealthRow = {
  sender_email: string | null;
  channel: string | null;
  sends: number | null;
  replies: number | null;
  bounces: number | null;
  complaints: number | null;
  unsubscribes: number | null;
  failures: number | null;
  risk_score: number | null;
  health_status: string | null;
  recommended_action: string | null;
};

type SystemControlsRow = {
  all_paused: boolean | null;
  email_paused: boolean | null;
  sms_paused: boolean | null;
  facebook_paused: boolean | null;
  manual_approval_mode: boolean | null;
  outreach_test_mode: boolean | null;
  domain_reputation_paused: boolean | null;
  max_domain_daily_email_cap: number | null;
  email_domain_authentication_verified: boolean | null;
  postmark_sender_signatures_verified: boolean | null;
  twilio_a2p_approved: boolean | null;
};

const TEAM = [
  {
    senderKey: "jason" as const,
    name: "Jason",
    email: "jason@home-reach.com",
    role: "Executive political and high-value opportunities",
  },
  {
    senderKey: "heather" as const,
    name: "Heather",
    email: "heather@home-reach.com",
    role: "Premium procurement and margin protection",
  },
  {
    senderKey: "josh" as const,
    name: "Josh",
    email: "josh@home-reach.com",
    role: "Local business and targeted mail outreach",
  },
  {
    senderKey: "chelsi" as const,
    name: "Chelsi",
    email: "chelsi@home-reach.com",
    role: "Warm nurture, follow-up, and onboarding",
  },
];

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function percent(value: number): string {
  return `${Math.round(value)}%`;
}

function clean(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfLocalDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function compactDue(value: string | null | undefined, nowMs = Date.now()): string {
  const parsed = parseTime(value);
  if (!parsed) return "No due date";
  const hours = Math.round((parsed - nowMs) / 3_600_000);
  if (hours < -24) return `${Math.abs(Math.round(hours / 24))}d overdue`;
  if (hours < 0) return "Overdue";
  if (hours < 2) return "Now";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function isPipelineStage(value: string | null | undefined): value is RevenuePipelineStage {
  return Boolean(value && (REVENUE_PIPELINE_STAGES as readonly string[]).includes(value));
}

function normalizeStage(value: string | null | undefined): RevenuePipelineStage {
  return isPipelineStage(value) ? value : "New Lead";
}

function readable(value: string | null | undefined, fallback = "Unknown"): string {
  const base = clean(value, fallback).replaceAll("_", " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function positiveReply(row: RevenueEventRow): boolean {
  const text = `${row.subject ?? ""} ${row.message_body ?? ""}`.toLowerCase();
  return /\b(yes|interested|send|quote|cost|price|call|meeting|calendar|info|options|talk|review)\b/.test(text);
}

async function queryMaybe<T>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: QueryError | null }>,
): Promise<{ data: T | null; error?: string }> {
  try {
    const result = await run();
    if (result.error) return { data: null, error: `${label}: ${result.error.message ?? result.error.code ?? "unknown error"}` };
    return { data: result.data };
  } catch (error) {
    return { data: null, error: `${label}: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

async function loadSalesLeadsFallback(db: ReturnType<typeof createServiceClient>) {
  return queryMaybe<SalesLeadRow[]>("sales_leads fallback", () =>
    db
      .from("sales_leads")
      .select("id,business_name,contact_name,email,phone,city,state,category,source,status,score,priority,buying_signal,do_not_contact,sms_opt_out,last_contacted_at,last_reply_at,next_follow_up_at,total_messages_sent,total_replies,created_at,updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(700),
  );
}

function stageFromSalesLead(row: SalesLeadRow): RevenuePipelineStage {
  if (row.do_not_contact || row.sms_opt_out) return "Do Not Contact";
  if (row.status === "dead") return "Closed Lost";
  if (row.status === "closed") return "Closed Won";
  if (row.status === "payment_sent") return "Proposal Sent";
  if (row.status === "interested") return "Interested";
  if (row.status === "replied") return "Replied";
  if (row.status === "contacted") return "Awaiting Response";
  return "New Lead";
}

function synthesizePipelineItems(leads: SalesLeadRow[]): PipelineItemRow[] {
  return leads.map((lead) => {
    const replyWeight = number(lead.total_replies) * 14;
    const messageWeight = Math.min(number(lead.total_messages_sent) * 2, 10);
    const score = number(lead.score);
    const buyingSignal = lead.buying_signal ? 18 : 0;
    const urgency =
      (lead.next_follow_up_at && parseTime(lead.next_follow_up_at)! <= Date.now() ? 40 : 0) +
      (lead.status === "replied" ? 35 : 0) +
      (lead.status === "payment_sent" ? 30 : 0);
    const revenuePriority = clampScore(score + buyingSignal + replyWeight + urgency / 2);
    return {
      id: lead.id,
      source_system: "sales_leads",
      source_id: lead.id,
      business_line: lead.category?.toLowerCase().includes("political") ? "political" : "targeted_mailing",
      primary_stage: stageFromSalesLead(lead),
      lead_name: lead.contact_name,
      organization_name: lead.business_name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      city: lead.city,
      county: null,
      state: lead.state,
      category: lead.category,
      campaign_type: null,
      assigned_owner_key: "unassigned",
      estimated_value_cents: Math.max(30000, score * 900),
      engagement_score: clampScore(score + buyingSignal + replyWeight + messageWeight),
      response_likelihood_score: clampScore(score + replyWeight + (lead.status === "replied" ? 25 : 0)),
      urgency_score: clampScore(urgency),
      conversion_probability_score: clampScore(score + buyingSignal + (lead.status === "interested" ? 25 : 0)),
      revenue_priority_score: revenuePriority,
      latest_outreach_channel: lead.email ? "email" : lead.phone ? "call" : "manual",
      latest_outreach_at: lead.last_contacted_at,
      latest_reply_at: lead.last_reply_at,
      next_action: lead.status === "replied"
        ? "Reply from inbox or approve the AI-assisted response."
        : lead.status === "payment_sent"
          ? "Review checkout state and approve a payment-safe recovery follow-up."
          : "Assign owner and choose the next approved outreach step.",
      next_action_due_at: lead.next_follow_up_at ?? null,
      next_recommended_channel: lead.email ? "email" : lead.phone ? "call" : "manual",
      status: lead.do_not_contact || lead.sms_opt_out ? "suppressed" : "active",
      source_url: null,
      metadata: { source: lead.source, fallback: true },
      created_at: lead.created_at,
      updated_at: lead.updated_at,
    };
  });
}

function buildMetrics(input: {
  pipelineItems: PipelineItemRow[];
  revenueEvents: RevenueEventRow[];
  dailyTasks: DailyOutreachTaskRow[];
  intakeRows: IntakeRow[];
  aiIntakeRows: IntakeRow[];
  salesEvents: SalesEventRow[];
  approvals: ApprovalRow[];
  todayStartMs: number;
}): RevenueMetric[] {
  const todayEvents = input.revenueEvents.filter((event) => {
    const t = parseTime(event.created_at);
    return t !== null && t >= input.todayStartMs;
  });
  const sentEmailEvents = todayEvents.filter((event) => event.direction === "outbound" && event.channel === "email").length;
  const sentDailyEmails = input.dailyTasks.filter((task) => task.send_status === "sent").length;
  const emailsSent = Math.max(sentEmailEvents, sentDailyEmails);
  const followUpsSent =
    input.salesEvents.filter((event) => event.action_type === "follow_up_sent").length +
    input.dailyTasks.filter((task) => String(task.action_type ?? "").toLowerCase().includes("follow") && task.send_status === "sent").length;
  const inboundReplies = todayEvents.filter((event) => event.direction === "inbound");
  const positiveReplies = inboundReplies.filter(positiveReply);
  const meetingsBooked = input.salesEvents.filter((event) =>
    ["meeting_booked", "call_booked", "demo_booked"].includes(String(event.action_type ?? "")),
  ).length;
  const formsCompleted =
    input.intakeRows.filter((row) => row.status === "submitted" || row.submitted_at).length +
    input.aiIntakeRows.filter((row) => ["confirmed", "checkout_created", "paid"].includes(String(row.status ?? ""))).length;
  const proposalsSent = input.salesEvents.filter((event) =>
    ["payment_link_created", "proposal_sent"].includes(String(event.action_type ?? "")),
  ).length + input.approvals.filter((approval) => String(approval.title ?? "").toLowerCase().includes("proposal")).length;
  const closedDeals = input.salesEvents.filter((event) => event.action_type === "deal_closed").length +
    input.pipelineItems.filter((item) => item.primary_stage === "Closed Won" && (parseTime(item.updated_at) ?? 0) >= input.todayStartMs).length;
  const pipelineValue = input.pipelineItems
    .filter((item) => item.status === "active" && !["Closed Won", "Closed Lost", "Do Not Contact", "Future Opportunity"].includes(String(item.primary_stage)))
    .reduce((total, item) => total + number(item.estimated_value_cents), 0);

  return [
    { key: "emails", label: "Emails Sent", value: String(emailsSent), detail: "Approved outbound today", tone: emailsSent > 0 ? "good" : "neutral" },
    { key: "followups", label: "Follow-Ups Sent", value: String(followUpsSent), detail: "Follow-through touches", tone: followUpsSent > 0 ? "good" : "watch" },
    { key: "replies", label: "Replies Received", value: String(inboundReplies.length), detail: "Inbound email/SMS captured", tone: inboundReplies.length > 0 ? "good" : "neutral" },
    { key: "positive", label: "Positive Responses", value: String(positiveReplies.length), detail: "Likely interest signals", tone: positiveReplies.length > 0 ? "good" : "neutral" },
    { key: "meetings", label: "Meetings Booked", value: String(meetingsBooked), detail: "Calls, demos, or calendar movement", tone: meetingsBooked > 0 ? "good" : "neutral" },
    { key: "forms", label: "Forms Completed", value: String(formsCompleted), detail: "Intake and cart completion", tone: formsCompleted > 0 ? "good" : "watch" },
    { key: "proposals", label: "Proposals Sent", value: String(proposalsSent), detail: "Quote or payment-path movement", tone: proposalsSent > 0 ? "good" : "neutral" },
    { key: "closed", label: "Closed Deals", value: String(closedDeals), detail: "Won today", tone: closedDeals > 0 ? "good" : "neutral" },
    { key: "pipeline", label: "Pipeline Value", value: money(pipelineValue), detail: "Estimated active opportunity value", tone: pipelineValue > 0 ? "watch" : "neutral" },
  ];
}

function buildPipeline(items: PipelineItemRow[]): RevenuePipelineStageSummary[] {
  return REVENUE_PIPELINE_STAGES.map((stage) => {
    const rows = items.filter((item) => normalizeStage(item.primary_stage) === stage);
    return {
      stage,
      count: rows.length,
      estimatedValueCents: rows.reduce((total, row) => total + number(row.estimated_value_cents), 0),
      attentionCount: rows.filter((row) =>
        row.status === "active" &&
        (number(row.urgency_score) >= 60 || ["Replied", "Interested", "Proposal Sent"].includes(stage) || (parseTime(row.next_action_due_at) ?? Infinity) <= Date.now()),
      ).length,
    };
  });
}

function ownerLabel(key: string | null | undefined): string {
  const member = TEAM.find((sender) => sender.senderKey === key);
  return member?.name ?? "Unassigned";
}

function itemHref(item: PipelineItemRow): string {
  if (item.business_line === "political") return "/admin/revenue-operations";
  if (item.business_line === "inventory_procurement") return "/admin/daily-outreach";
  if (item.source_system === "sales_leads") return "/admin/sales-engine";
  return "/admin";
}

function priorityTone(score: number, dueAt?: string | null): RevenueTone {
  const due = parseTime(dueAt);
  if (score >= 80 || (due !== null && due <= Date.now())) return "danger";
  if (score >= 60) return "watch";
  return "neutral";
}

function taskRank(task: PipelineTaskRow): number {
  const priorityWeight =
    task.priority === "urgent" ? 90 :
    task.priority === "high" ? 70 :
    task.priority === "medium" ? 45 : 20;
  const due = parseTime(task.due_at);
  const dueWeight = due !== null && due <= Date.now() ? 35 : 0;
  return priorityWeight + dueWeight;
}

function buildPriorityActions(tasks: PipelineTaskRow[], items: PipelineItemRow[]): RevenuePriorityAction[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const itemBySource = new Map(items.map((item) => [`${item.source_system}:${item.source_id}`, item]));
  const openTasks = tasks
    .filter((task) => task.status === "open" || task.status === "in_progress")
    .sort((a, b) => taskRank(b) - taskRank(a))
    .slice(0, 10);

  if (openTasks.length > 0) {
    return openTasks.map((task) => {
      const item =
        (task.pipeline_item_id ? itemById.get(task.pipeline_item_id) : null) ??
        itemBySource.get(`${task.source_system}:${task.source_id}`) ??
        null;
      const score = Math.max(number(item?.revenue_priority_score), taskRank(task));
      return {
        id: task.id,
        title: clean(task.title, "Next revenue action"),
        leadName: clean(item?.lead_name, "No contact"),
        organizationName: clean(item?.organization_name, "Unknown opportunity"),
        businessLine: readable(item?.business_line ?? "unknown"),
        stage: normalizeStage(item?.primary_stage),
        owner: ownerLabel(task.assigned_owner_key ?? item?.assigned_owner_key),
        dueLabel: compactDue(task.due_at),
        score: clampScore(score),
        channel: readable(task.channel, "Manual"),
        nextAction: clean(task.detail ?? item?.next_action, "Review and choose the next approved step."),
        reason: readable(task.task_type, "Next action"),
        href: item ? itemHref(item) : "/admin/revenue-operations",
        tone: priorityTone(score, task.due_at),
      };
    });
  }

  return items
    .filter((item) => item.status === "active" && !["Closed Won", "Closed Lost", "Do Not Contact"].includes(String(item.primary_stage)))
    .sort((a, b) =>
      number(b.revenue_priority_score) - number(a.revenue_priority_score) ||
      number(b.urgency_score) - number(a.urgency_score),
    )
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      title: normalizeStage(item.primary_stage) === "Replied" ? "Reply waiting" : "Next revenue action",
      leadName: clean(item.lead_name, "No contact"),
      organizationName: clean(item.organization_name, "Unknown opportunity"),
      businessLine: readable(item.business_line),
      stage: normalizeStage(item.primary_stage),
      owner: ownerLabel(item.assigned_owner_key),
      dueLabel: compactDue(item.next_action_due_at),
      score: number(item.revenue_priority_score),
      channel: readable(item.next_recommended_channel, "Manual"),
      nextAction: clean(item.next_action, "Review and choose the next approved step."),
      reason: `${number(item.urgency_score)} urgency / ${number(item.conversion_probability_score)} conversion`,
      href: itemHref(item),
      tone: priorityTone(number(item.revenue_priority_score), item.next_action_due_at),
    }));
}

function senderMatches(row: RevenueEventRow, email: string): boolean {
  const needle = email.toLowerCase();
  return [row.normalized_from, row.normalized_to, String(row.metadata?.sender_email ?? "")]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function buildTeamPerformance(input: {
  dailyTasks: DailyOutreachTaskRow[];
  revenueEvents: RevenueEventRow[];
  pipelineItems: PipelineItemRow[];
  senderControls: SenderControlRow[];
}): RevenueTeamPerformance[] {
  return TEAM.map((member) => {
    const senderTasks = input.dailyTasks.filter((task) =>
      task.sender_key === member.senderKey || String(task.sender_email ?? "").toLowerCase() === member.email,
    );
    const sentTasks = senderTasks.filter((task) => task.send_status === "sent").length;
    const sentEvents = input.revenueEvents.filter((event) =>
      event.direction === "outbound" && event.channel === "email" && senderMatches(event, member.email),
    ).length;
    const replies = input.revenueEvents.filter((event) =>
      event.direction === "inbound" && senderMatches(event, member.email),
    );
    const positive = replies.filter(positiveReply).length;
    const ownerItems = input.pipelineItems.filter((item) => item.assigned_owner_key === member.senderKey);
    const conversions = ownerItems.filter((item) => ["Interested", "Proposal Sent", "Negotiation", "Closed Won"].includes(String(item.primary_stage))).length;
    const emailsSent = Math.max(sentTasks, sentEvents);
    const responseRate = emailsSent > 0 ? (replies.length / emailsSent) * 100 : 0;
    const conversionRate = ownerItems.length > 0 ? (conversions / ownerItems.length) * 100 : 0;
    const control = input.senderControls.find((row) => row.sender_key === member.senderKey);
    const paused = control?.paused;
    const nextAction =
      paused ? "Paused. Review sender health before resuming." :
      replies.length > 0 ? "Work replies before approving more outbound volume." :
      emailsSent === 0 ? "Queue a small approved batch if lead quality is ready." :
      "Keep volume conservative and watch reply quality.";
    return {
      ...member,
      emailsSent,
      followUpsSent: senderTasks.filter((task) => String(task.action_type ?? "").toLowerCase().includes("follow")).length,
      repliesReceived: replies.length,
      positiveReplies: positive,
      responseRate: Math.round(responseRate),
      conversionRate: Math.round(conversionRate),
      nextAction,
      tone: paused ? "danger" : responseRate >= 12 || positive > 0 ? "good" : emailsSent > 0 ? "watch" : "neutral",
    };
  });
}

function buildTomorrowQueue(tasks: DailyOutreachTaskRow[], items: PipelineItemRow[], tomorrowStart: Date, dayAfter: Date): RevenueTomorrowQueueItem[] {
  const tomorrowStartMs = tomorrowStart.getTime();
  const dayAfterMs = dayAfter.getTime();
  const scheduled = tasks
    .filter((task) => {
      const t = parseTime(task.scheduled_send_at);
      return t !== null && t >= tomorrowStartMs && t < dayAfterMs;
    })
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      title: clean(task.business_name ?? task.campaign_name, "Queued outreach"),
      audience: readable(task.campaign_type ?? task.category, "Audience"),
      owner: ownerLabel(task.sender_key),
      campaignType: readable(task.campaign_type, "Campaign"),
      scheduledFor: task.scheduled_send_at ?? "Tomorrow",
      angle: clean(task.email_subject, "Personalized first touch or follow-up"),
      readiness: task.approval_status === "approved" ? "Approved" : "Needs review",
      href: "/admin/daily-outreach",
    }));

  const suggested = items
    .filter((item) => ["New Lead", "AI Queued", "Outreach Scheduled"].includes(String(item.primary_stage)) && item.status === "active")
    .sort((a, b) => number(b.revenue_priority_score) - number(a.revenue_priority_score))
    .slice(0, Math.max(0, 8 - scheduled.length))
    .map((item) => ({
      id: item.id,
      title: clean(item.organization_name ?? item.lead_name, "Opportunity"),
      audience: readable(item.business_line, "Audience"),
      owner: ownerLabel(item.assigned_owner_key),
      campaignType: readable(item.campaign_type ?? item.category, "Campaign"),
      scheduledFor: "Suggested for tomorrow",
      angle: clean(item.next_action, "Use the highest-quality next approved angle."),
      readiness: item.contact_email ? "Email ready" : "Needs contact data",
      href: itemHref(item),
    }));

  return [...scheduled, ...suggested];
}

function buildCampaignPerformance(tasks: DailyOutreachTaskRow[], events: RevenueEventRow[]): RevenueCampaignPerformance[] {
  const groups = new Map<string, RevenueCampaignPerformance>();
  const ensure = (key: string, label: string) => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created: RevenueCampaignPerformance = {
      id: key,
      label,
      sends: 0,
      replies: 0,
      positiveReplies: 0,
      replyRate: 0,
      conversionRate: 0,
      bestSubject: "Not enough data yet",
      bestCta: "Approve a clear next step",
      nextAction: "Watch quality before increasing volume.",
      tone: "neutral",
    };
    groups.set(key, created);
    return created;
  };

  for (const task of tasks) {
    const key = String(task.campaign_type ?? task.category ?? "unknown");
    const group = ensure(key, readable(key, "Unknown campaign"));
    if (task.send_status === "sent") group.sends += 1;
    if (task.replied_at) group.replies += 1;
    if (task.email_subject && group.bestSubject === "Not enough data yet") group.bestSubject = task.email_subject;
    if (task.cta_variant_key && group.bestCta === "Approve a clear next step") group.bestCta = readable(task.cta_variant_key, "CTA");
  }

  for (const event of events) {
    const key = String(event.business_line ?? "unknown");
    const group = ensure(key, readable(key, "Unknown campaign"));
    if (event.direction === "outbound") group.sends += 1;
    if (event.direction === "inbound") {
      group.replies += 1;
      if (positiveReply(event)) group.positiveReplies += 1;
    }
    if (event.subject && group.bestSubject === "Not enough data yet") group.bestSubject = event.subject;
  }

  return [...groups.values()]
    .map((group) => {
      const replyRate = group.sends > 0 ? (group.replies / group.sends) * 100 : 0;
      const conversionRate = group.sends > 0 ? (group.positiveReplies / group.sends) * 100 : 0;
      const tone: RevenueTone = replyRate >= 12 ? "good" : group.sends >= 5 && replyRate < 5 ? "danger" : group.sends > 0 ? "watch" : "neutral";
      return {
        ...group,
        replyRate: Math.round(replyRate),
        conversionRate: Math.round(conversionRate),
        nextAction:
          tone === "good" ? "Scale carefully with the same audience and sender pattern." :
          tone === "danger" ? "Pause scaling and improve list quality, subject line, or offer angle." :
          "Keep measuring until there is enough response data.",
        tone,
      };
    })
    .sort((a, b) => b.replies - a.replies || b.sends - a.sends)
    .slice(0, 6);
}

function buildStrategyRecommendations(input: {
  insights: StrategyInsightRow[];
  priorityActions: RevenuePriorityAction[];
  campaignPerformance: RevenueCampaignPerformance[];
  teamPerformance: RevenueTeamPerformance[];
  failedSends: number;
}): RevenueStrategyRecommendation[] {
  const stored = input.insights
    .filter((insight) => insight.status === "active")
    .slice(0, 4)
    .map((insight) => ({
      id: insight.id,
      title: clean(insight.title, "Revenue recommendation"),
      detail: clean(insight.detail, "Review the current revenue posture."),
      recommendation: clean(insight.recommendation, "Choose the next best action."),
      impact: clean(insight.impact, "medium"),
      confidence: Math.round(number(insight.confidence) * 100),
      tone: insight.impact === "high" ? "watch" as const : "neutral" as const,
    }));

  const generated: RevenueStrategyRecommendation[] = [];
  const urgent = input.priorityActions.filter((action) => action.tone === "danger").length;
  if (urgent > 0) {
    generated.push({
      id: "urgent-action-queue",
      title: "Clear urgent actions before new outreach",
      detail: `${urgent} high-risk or overdue revenue item${urgent === 1 ? "" : "s"} need owner attention.`,
      recommendation: "Work replies, intake recovery, and proposal follow-ups first; then approve new outbound.",
      impact: "high",
      confidence: 91,
      tone: "danger",
    });
  }

  const winner = input.campaignPerformance.find((campaign) => campaign.tone === "good");
  if (winner) {
    generated.push({
      id: `scale-${winner.id}`,
      title: `Scale ${winner.label} carefully`,
      detail: `${winner.label} is showing a ${winner.replyRate}% reply rate with ${winner.positiveReplies} positive signal${winner.positiveReplies === 1 ? "" : "s"}.`,
      recommendation: "Reuse the winning sender, subject shape, and CTA while keeping caps conservative.",
      impact: "medium",
      confidence: 82,
      tone: "good",
    });
  }

  const weak = input.campaignPerformance.find((campaign) => campaign.tone === "danger");
  if (weak) {
    generated.push({
      id: `rewrite-${weak.id}`,
      title: `Improve ${weak.label} before increasing volume`,
      detail: `${weak.label} has sends but weak reply quality so far.`,
      recommendation: "Change subject, opening line, or lead quality before approving another larger batch.",
      impact: "medium",
      confidence: 78,
      tone: "watch",
    });
  }

  const bestSender = [...input.teamPerformance].sort((a, b) => b.responseRate - a.responseRate)[0];
  if (bestSender && bestSender.responseRate > 0) {
    generated.push({
      id: `sender-${bestSender.senderKey}`,
      title: `${bestSender.name} has the clearest response signal`,
      detail: `${bestSender.email} is showing a ${bestSender.responseRate}% response rate today.`,
      recommendation: "Study that voice, timing, and audience fit before scaling other sender personas.",
      impact: "medium",
      confidence: 76,
      tone: "good",
    });
  }

  if (input.failedSends > 0) {
    generated.push({
      id: "failed-send-risk",
      title: "Failed sends need deliverability review",
      detail: `${input.failedSends} failed send${input.failedSends === 1 ? "" : "s"} were detected today.`,
      recommendation: "Check provider response, sender verification, suppressions, and list quality before resuming that lane.",
      impact: "high",
      confidence: 89,
      tone: "danger",
    });
  }

  return [...generated, ...stored].slice(0, 6);
}

function buildGuardrails(input: {
  systemControls: SystemControlsRow | null;
  senderHealth: SenderHealthRow[];
  activeSuppressions: number;
  failedSends: number;
}): RevenueHealthGuardrail[] {
  const controls = input.systemControls;
  const highestRisk = input.senderHealth.reduce((max, row) => Math.max(max, number(row.risk_score)), 0);
  const bounces = input.senderHealth.reduce((total, row) => total + number(row.bounces), 0);
  const complaints = input.senderHealth.reduce((total, row) => total + number(row.complaints), 0);
  return [
    {
      label: "Global Sending",
      value: controls?.all_paused ? "Paused" : controls?.email_paused ? "Email paused" : "Ready",
      detail: controls?.manual_approval_mode === false ? "Manual approval is off. Review before scaling." : "Human approval remains the operating default.",
      tone: controls?.all_paused || controls?.email_paused ? "danger" : controls?.manual_approval_mode === false ? "watch" : "good",
    },
    {
      label: "Domain Health",
      value: controls?.domain_reputation_paused ? "Paused" : controls?.email_domain_authentication_verified ? "Verified" : "Verify",
      detail: `Domain cap ${controls?.max_domain_daily_email_cap ?? 60}/day. Highest sender risk ${highestRisk}.`,
      tone: controls?.domain_reputation_paused ? "danger" : controls?.email_domain_authentication_verified ? "good" : "watch",
    },
    {
      label: "Sender Reputation",
      value: highestRisk >= 70 ? "Risk" : highestRisk >= 40 ? "Watch" : "Healthy",
      detail: `${bounces} bounce${bounces === 1 ? "" : "s"}, ${complaints} complaint${complaints === 1 ? "" : "s"}, ${input.failedSends} failed send${input.failedSends === 1 ? "" : "s"}.`,
      tone: highestRisk >= 70 || complaints > 0 ? "danger" : highestRisk >= 40 || bounces > 0 || input.failedSends > 0 ? "watch" : "good",
    },
    {
      label: "Suppression Safety",
      value: String(input.activeSuppressions),
      detail: "Active opt-out, bounce, complaint, or do-not-contact records protected from outreach.",
      tone: input.activeSuppressions > 0 ? "watch" : "good",
    },
    {
      label: "SMS Readiness",
      value: controls?.twilio_a2p_approved ? "A2P approved" : "Manual-safe",
      detail: "Future SMS remains conservative until consent and A2P status are verified.",
      tone: controls?.twilio_a2p_approved ? "good" : "watch",
    },
  ];
}

export async function loadDailyRevenueCommandCenter(): Promise<DailyRevenueCommandCenterData> {
  const db = createServiceClient();
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterTomorrow = addDays(todayStart, 2);
  const thirtyDaysAgo = addDays(todayStart, -30);
  const todayIso = todayStart.toISOString();
  const dayAfterIso = dayAfterTomorrow.toISOString();
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
  const sourceErrors: string[] = [];

  const salesLeadsResult = await loadSalesLeadsFallback(db);
  if (salesLeadsResult.error) sourceErrors.push(salesLeadsResult.error);

  const [
    pipelineResult,
    taskResult,
    eventResult,
    dailyTaskResult,
    senderControlResult,
    insightResult,
    approvalResult,
    intakeResult,
    aiIntakeResult,
    salesEventResult,
    senderHealthResult,
    controlsResult,
    suppressionResult,
  ] = await Promise.all([
    queryMaybe<PipelineItemRow[]>("revenue_pipeline_items", () =>
      db
        .from("revenue_pipeline_items")
        .select("*")
        .order("revenue_priority_score", { ascending: false, nullsFirst: false })
        .limit(900),
    ),
    queryMaybe<PipelineTaskRow[]>("revenue_pipeline_tasks", () =>
      db
        .from("revenue_pipeline_tasks")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(100),
    ),
    queryMaybe<RevenueEventRow[]>("revenue_message_events", () =>
      db
        .from("revenue_message_events")
        .select("id,business_line,channel,direction,event_type,normalized_from,normalized_to,subject,message_body,source_system,source_id,created_at,metadata")
        .gte("created_at", thirtyDaysAgoIso)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1500),
    ),
    queryMaybe<DailyOutreachTaskRow[]>("daily_outreach_tasks", () =>
      db
        .from("daily_outreach_tasks")
        .select("id,outreach_date,campaign_type,category,business_name,campaign_name,contact_name,sender_key,sender_name,sender_email,scheduled_send_at,send_status,approval_status,action_type,priority,email_subject,cta_variant_key,replied_at,bounced_at,created_at")
        .gte("scheduled_send_at", todayIso)
        .lt("scheduled_send_at", dayAfterIso)
        .order("scheduled_send_at", { ascending: true, nullsFirst: false })
        .limit(300),
    ),
    queryMaybe<SenderControlRow[]>("daily_outreach_sender_controls", () =>
      db
        .from("daily_outreach_sender_controls")
        .select("sender_key,sender_name,sender_email,business_line,daily_cap,paused,manual_approval_required")
        .order("sender_key", { ascending: true }),
    ),
    queryMaybe<StrategyInsightRow[]>("revenue_strategy_insights", () =>
      db
        .from("revenue_strategy_insights")
        .select("id,insight_type,title,detail,recommendation,confidence,impact,status")
        .eq("status", "active")
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(8),
    ),
    queryMaybe<ApprovalRow[]>("revenue_message_approval_queue", () =>
      db
        .from("revenue_message_approval_queue")
        .select("id,business_line,channel,status,title,due_at,created_at")
        .in("status", ["draft", "needs_review", "approved_pending"])
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(80),
    ),
    queryMaybe<IntakeRow[]>("intake_submissions", () =>
      db
        .from("intake_submissions")
        .select("id,status,submitted_at,created_at,updated_at")
        .gte("created_at", thirtyDaysAgoIso)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(200),
    ),
    queryMaybe<IntakeRow[]>("ai_intake_sessions", () =>
      db
        .from("ai_intake_sessions")
        .select("id,status,created_at,updated_at")
        .gte("created_at", thirtyDaysAgoIso)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(200),
    ),
    queryMaybe<SalesEventRow[]>("sales_events", () =>
      db
        .from("sales_events")
        .select("id,lead_id,action_type,channel,revenue_cents,created_at,metadata")
        .gte("created_at", todayIso)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(600),
    ),
    queryMaybe<SenderHealthRow[]>("outreach_sender_health_snapshots", () =>
      db
        .from("outreach_sender_health_snapshots")
        .select("sender_email,channel,sends,replies,bounces,complaints,unsubscribes,failures,risk_score,health_status,recommended_action")
        .gte("snapshot_date", todayIso.slice(0, 10))
        .limit(100),
    ),
    queryMaybe<SystemControlsRow[]>("system_controls", () =>
      db
        .from("system_controls")
        .select("all_paused,email_paused,sms_paused,facebook_paused,manual_approval_mode,outreach_test_mode,domain_reputation_paused,max_domain_daily_email_cap,email_domain_authentication_verified,postmark_sender_signatures_verified,twilio_a2p_approved")
        .eq("id", 1)
        .limit(1),
    ),
    queryMaybe<Array<{ id: string }>>("outreach_suppression_list", () =>
      db
        .from("outreach_suppression_list")
        .select("id")
        .eq("active", true)
        .limit(1000),
    ),
  ]);

  for (const result of [
    pipelineResult,
    taskResult,
    eventResult,
    dailyTaskResult,
    senderControlResult,
    insightResult,
    approvalResult,
    intakeResult,
    aiIntakeResult,
    salesEventResult,
    senderHealthResult,
    controlsResult,
    suppressionResult,
  ]) {
    if (result.error) sourceErrors.push(result.error);
  }

  const fallbackItems = synthesizePipelineItems(salesLeadsResult.data ?? []);
  const pipelineItems = pipelineResult.data && pipelineResult.data.length > 0
    ? pipelineResult.data
    : fallbackItems;
  if (pipelineResult.error) {
    sourceErrors.push("Revenue OS pipeline is using sales_leads fallback until the new migration is applied.");
  }

  const pipelineTasks = taskResult.data ?? [];
  const revenueEvents = eventResult.data ?? [];
  const dailyTasks = dailyTaskResult.data ?? [];
  const senderControls = senderControlResult.data ?? [];
  const insights = insightResult.data ?? [];
  const approvals = approvalResult.data ?? [];
  const intakeRows = (intakeResult.data ?? []).filter((row) => (parseTime(row.created_at) ?? 0) >= todayStart.getTime() || row.status === "pending");
  const aiIntakeRows = (aiIntakeResult.data ?? []).filter((row) => (parseTime(row.created_at) ?? 0) >= todayStart.getTime());
  const salesEvents = salesEventResult.data ?? [];
  const senderHealth = senderHealthResult.data ?? [];
  const controls = controlsResult.data?.[0] ?? null;
  const failedSends = dailyTasks.filter((task) => task.send_status === "failed" || task.bounced_at).length +
    senderHealth.reduce((total, row) => total + number(row.failures), 0);

  const todayMetrics = buildMetrics({
    pipelineItems,
    revenueEvents,
    dailyTasks,
    intakeRows,
    aiIntakeRows,
    salesEvents,
    approvals,
    todayStartMs: todayStart.getTime(),
  });
  const teamPerformance = buildTeamPerformance({
    dailyTasks,
    revenueEvents,
    pipelineItems,
    senderControls,
  });
  const pipeline = buildPipeline(pipelineItems);
  const priorityActions = buildPriorityActions(pipelineTasks, pipelineItems);
  const tomorrowQueue = buildTomorrowQueue(dailyTasks, pipelineItems, tomorrowStart, dayAfterTomorrow);
  const campaignPerformance = buildCampaignPerformance(dailyTasks, revenueEvents);
  const strategyRecommendations = buildStrategyRecommendations({
    insights,
    priorityActions,
    campaignPerformance,
    teamPerformance,
    failedSends,
  });
  const guardrails = buildGuardrails({
    systemControls: controls,
    senderHealth,
    activeSuppressions: suppressionResult.data?.length ?? 0,
    failedSends,
  });

  return {
    generatedAt: now.toISOString(),
    todayMetrics,
    teamPerformance,
    pipeline,
    priorityActions,
    tomorrowQueue,
    strategyRecommendations,
    campaignPerformance,
    guardrails,
    sourceErrors: Array.from(new Set(sourceErrors)).slice(0, 10),
  };
}

export function formatRevenueMoney(cents: number): string {
  return money(cents);
}

export function formatRevenuePercent(value: number): string {
  return percent(value);
}
