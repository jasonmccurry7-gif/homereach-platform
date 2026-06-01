import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

type QueryError = { message?: string; code?: string };

type SalesLeadRow = {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  city: string | null;
  category: string | null;
  source: string | null;
  status: string | null;
  score: number | null;
  priority: string | null;
  buying_signal: boolean | null;
  do_not_contact: boolean | null;
  sms_opt_out?: boolean | null;
  last_contacted_at: string | null;
  last_reply_at: string | null;
  next_follow_up_at?: string | null;
  total_messages_sent?: number | null;
  total_replies?: number | null;
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
};

type RevenueApprovalRow = {
  id: string;
  business_line: string | null;
  channel: string | null;
  status: string | null;
  title: string | null;
  message_body: string | null;
  created_at: string | null;
  due_at: string | null;
};

type AiOutputRow = {
  id: string;
  title: string | null;
  agent_name: string | null;
  workflow: string | null;
  output_type: string | null;
  approval_status: string | null;
  created_at: string | null;
};

export type RevenueOpsTone = "good" | "watch" | "danger" | "neutral";

export type RevenueOpsLeadSignal = {
  id: string;
  businessName: string;
  contactName: string;
  city: string;
  category: string;
  source: string;
  status: string;
  score: number;
  priority: string;
  reason: string;
  nextAction: string;
  lastActivity: string;
  lastActivityAt: string | null;
  estimatedValue: string;
  href: string;
  tone: RevenueOpsTone;
};

export type RevenueOpsApproval = {
  id: string;
  title: string;
  source: string;
  status: string;
  createdAt: string | null;
  dueAt: string | null;
  preview: string;
  href: string;
};

export type LeadSourcePerformance = {
  source: string;
  leads: number;
  hotLeads: number;
  replies: number;
  wins: number;
  replyRate: number;
  actualRevenueCents: number;
  estimatedOpenValueCents: number;
  nextAction: string;
  tone: RevenueOpsTone;
};

export type RevenueRiskSignal = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  detail: string;
  ownerAction: string;
  estimatedImpact: string;
  href: string;
};

export type AdminRevenueOpsSnapshot = {
  generatedAt: string;
  counts: {
    hotLeads: number;
    staleOpportunities: number;
    followUpsDue: number;
    draftApprovals: number;
    leadSources: number;
    revenueRisks: number;
  };
  hotLeads: RevenueOpsLeadSignal[];
  staleOpportunities: RevenueOpsLeadSignal[];
  followUpsDue: RevenueOpsLeadSignal[];
  draftApprovals: RevenueOpsApproval[];
  sourcePerformance: LeadSourcePerformance[];
  revenueRisks: RevenueRiskSignal[];
  sourceErrors: string[];
};

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

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function hoursSince(value: string | null | undefined, nowMs = Date.now()): number | null {
  const parsed = parseTime(value);
  if (!parsed) return null;
  return Math.max(0, Math.floor((nowMs - parsed) / 3_600_000));
}

function compactAge(value: string | null | undefined): string {
  const hours = hoursSince(value);
  if (hours === null) return "No activity";
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function label(value: string | null | undefined, fallback: string): string {
  const clean = value?.trim();
  return clean ? clean : fallback;
}

function normalizeSource(source: string | null | undefined): string {
  const clean = label(source, "unknown").replaceAll("_", " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function readableStatus(status: string | null | undefined): string {
  return label(status, "unknown").replaceAll("_", " ");
}

function activeLead(row: SalesLeadRow): boolean {
  const status = row.status ?? "";
  return !row.do_not_contact && status !== "closed" && status !== "dead";
}

function isHotLead(row: SalesLeadRow): boolean {
  const status = row.status ?? "";
  return (
    Boolean(row.buying_signal) ||
    number(row.score) >= 75 ||
    row.priority === "high" ||
    status === "replied" ||
    status === "interested" ||
    status === "payment_sent"
  );
}

function leadLastActivityAt(row: SalesLeadRow): string | null {
  return row.last_reply_at ?? row.last_contacted_at ?? row.updated_at ?? row.created_at;
}

function hotLeadRank(row: SalesLeadRow): number {
  const status = row.status ?? "";
  const statusWeight =
    status === "payment_sent" ? 70 :
    status === "replied" ? 60 :
    status === "interested" ? 45 :
    status === "contacted" ? 20 : 0;
  const signalWeight = row.buying_signal ? 30 : 0;
  const priorityWeight = row.priority === "high" ? 15 : 0;
  return number(row.score) + statusWeight + signalWeight + priorityWeight;
}

function staleReason(row: SalesLeadRow): string | null {
  const status = row.status ?? "";
  const replyAge = hoursSince(row.last_reply_at);
  const contactAge = hoursSince(row.last_contacted_at);

  if (status === "payment_sent" && (contactAge ?? 999) >= 48) {
    return "Payment link has cooled off";
  }
  if (status === "replied" && (replyAge ?? 999) >= 12) {
    return "Lead replied and is waiting";
  }
  if (status === "interested" && (contactAge ?? 999) >= 48) {
    return "Interested lead has no fresh owner touch";
  }
  if (status === "contacted" && (contactAge ?? 0) >= 168) {
    return "Contacted lead is stale";
  }

  return null;
}

function followUpReason(row: SalesLeadRow): string | null {
  const nowMs = Date.now();
  const followUpMs = parseTime(row.next_follow_up_at);
  if (followUpMs && followUpMs <= nowMs) return "Scheduled follow-up is due";

  const status = row.status ?? "";
  const contactAge = hoursSince(row.last_contacted_at);
  if (status === "contacted" && (contactAge ?? 0) >= 24) return "Day 1 follow-up window";
  if (status === "interested" && (contactAge ?? 0) >= 48) return "Interest needs a next step";
  if (status === "payment_sent" && (contactAge ?? 0) >= 24) return "Payment follow-up due";
  return null;
}

function leadTone(row: SalesLeadRow): RevenueOpsTone {
  if ((row.status ?? "") === "payment_sent" || number(row.score) >= 85 || row.buying_signal) return "danger";
  if ((row.status ?? "") === "replied" || (row.status ?? "") === "interested" || number(row.score) >= 70) return "watch";
  return "neutral";
}

function leadNextAction(row: SalesLeadRow, reason: string): string {
  const status = row.status ?? "";
  if (status === "payment_sent") return "Confirm checkout friction and draft a payment-safe recovery note for approval.";
  if (status === "replied") return "Open the inbox and respond or approve the AI reply draft.";
  if (status === "interested") return "Move them to a clear call, proposal, or checkout next step.";
  if (reason.includes("follow-up")) return "Approve or assign the next follow-up draft.";
  return "Review source context, then choose the next owner action.";
}

function leadSignal(row: SalesLeadRow, reason: string): RevenueOpsLeadSignal {
  const lastActivityAt = leadLastActivityAt(row);
  return {
    id: row.id,
    businessName: label(row.business_name, "Unnamed lead"),
    contactName: label(row.contact_name, "No contact name"),
    city: label(row.city, "No city"),
    category: label(row.category, "No category"),
    source: normalizeSource(row.source),
    status: readableStatus(row.status),
    score: number(row.score),
    priority: label(row.priority, "medium"),
    reason,
    nextAction: leadNextAction(row, reason),
    lastActivity: compactAge(lastActivityAt),
    lastActivityAt,
    estimatedValue: formatMoney(Math.max(30000, number(row.score) * 900)),
    href: "/admin/sales-engine",
    tone: leadTone(row),
  };
}

function approvalFromRevenue(row: RevenueApprovalRow): RevenueOpsApproval {
  return {
    id: `revenue-${row.id}`,
    title: label(row.title, "Revenue draft"),
    source: `${label(row.business_line, "revenue").replaceAll("_", " ")} / ${label(row.channel, "channel")}`,
    status: readableStatus(row.status),
    createdAt: row.created_at,
    dueAt: row.due_at,
    preview: label(row.message_body, "No draft preview available."),
    href: "/admin/revenue-operations",
  };
}

function approvalFromAiOutput(row: AiOutputRow): RevenueOpsApproval {
  return {
    id: `ai-${row.id}`,
    title: label(row.title, "AI output draft"),
    source: `${label(row.agent_name, "AI workforce")} / ${label(row.workflow ?? row.output_type, "workflow")}`,
    status: readableStatus(row.approval_status),
    createdAt: row.created_at,
    dueAt: null,
    preview: "AI Asset output waiting for human review before reuse, publication, or outbound action.",
    href: "/admin/ai-assets",
  };
}

function buildSourcePerformance(leads: SalesLeadRow[], events: SalesEventRow[]): LeadSourcePerformance[] {
  const leadSourceById = new Map<string, string>();
  const groups = new Map<string, LeadSourcePerformance>();

  function groupFor(source: string): LeadSourcePerformance {
    const existing = groups.get(source);
    if (existing) return existing;
    const created: LeadSourcePerformance = {
      source,
      leads: 0,
      hotLeads: 0,
      replies: 0,
      wins: 0,
      replyRate: 0,
      actualRevenueCents: 0,
      estimatedOpenValueCents: 0,
      nextAction: "Keep watching source quality.",
      tone: "neutral",
    };
    groups.set(source, created);
    return created;
  }

  for (const lead of leads) {
    const source = normalizeSource(lead.source);
    leadSourceById.set(lead.id, source);
    const group = groupFor(source);
    const status = lead.status ?? "";
    group.leads += 1;
    if (isHotLead(lead)) group.hotLeads += 1;
    if ((lead.total_replies ?? 0) > 0 || ["replied", "interested", "payment_sent", "closed"].includes(status)) {
      group.replies += 1;
    }
    if (status === "closed") group.wins += 1;
    if (activeLead(lead) && isHotLead(lead)) {
      group.estimatedOpenValueCents += Math.max(30000, number(lead.score) * 900);
    }
  }

  for (const event of events) {
    if (event.action_type !== "deal_closed" || !event.lead_id) continue;
    const source = leadSourceById.get(event.lead_id) ?? "Unknown";
    groupFor(source).actualRevenueCents += number(event.revenue_cents);
  }

  return [...groups.values()]
    .map((group) => {
      const replyRate = group.leads > 0 ? Math.round((group.replies / group.leads) * 100) : 0;
      const tone: RevenueOpsTone =
        group.hotLeads > 0 && replyRate >= 15 ? "good" :
        group.hotLeads > 0 || replyRate >= 8 ? "watch" :
        "neutral";
      return {
        ...group,
        replyRate,
        tone,
        nextAction:
          group.hotLeads > 0
            ? `Work ${group.hotLeads} hot lead${group.hotLeads === 1 ? "" : "s"} from this source first.`
            : replyRate === 0
            ? "Audit offer, list quality, or channel fit before scaling."
            : "Keep source in rotation and watch reply quality.",
      };
    })
    .sort((a, b) => b.hotLeads - a.hotLeads || b.replyRate - a.replyRate || b.leads - a.leads)
    .slice(0, 6);
}

function buildRisks(input: {
  hotLeads: RevenueOpsLeadSignal[];
  staleOpportunities: RevenueOpsLeadSignal[];
  followUpsDue: RevenueOpsLeadSignal[];
  draftApprovals: RevenueOpsApproval[];
  sourcePerformance: LeadSourcePerformance[];
  sourceErrors: string[];
}): RevenueRiskSignal[] {
  const risks: RevenueRiskSignal[] = [];
  const paymentStale = input.staleOpportunities.filter((lead) => lead.status === "payment sent").length;
  const repliedWaiting = input.staleOpportunities.filter((lead) => lead.status === "replied").length;

  if (paymentStale > 0) {
    risks.push({
      id: "payment-links",
      title: "Payment links cooling off",
      severity: "high",
      detail: `${paymentStale} payment-stage lead${paymentStale === 1 ? "" : "s"} need a human-approved recovery touch.`,
      ownerAction: "Review checkout state and approve a recovery draft before any customer contact.",
      estimatedImpact: formatMoney(paymentStale * 45000),
      href: "/admin/sales-engine",
    });
  }

  if (repliedWaiting > 0) {
    risks.push({
      id: "replied-waiting",
      title: "Replies need owner speed",
      severity: "high",
      detail: `${repliedWaiting} replied lead${repliedWaiting === 1 ? "" : "s"} are aging past the response window.`,
      ownerAction: "Open the inbox, answer directly, or approve the AI-assisted reply.",
      estimatedImpact: formatMoney(repliedWaiting * 40000),
      href: "/admin/inbox",
    });
  }

  if (input.followUpsDue.length > 0) {
    risks.push({
      id: "follow-ups-due",
      title: "Follow-ups due today",
      severity: "medium",
      detail: `${input.followUpsDue.length} opportunity follow-up${input.followUpsDue.length === 1 ? "" : "s"} are ready for review.`,
      ownerAction: "Approve, revise, or assign the next touch. Do not auto-send without approval.",
      estimatedImpact: formatMoney(input.followUpsDue.length * 30000),
      href: "/admin/sales-engine",
    });
  }

  if (input.draftApprovals.length > 0) {
    risks.push({
      id: "draft-approvals",
      title: "Draft approvals are blocking motion",
      severity: "medium",
      detail: `${input.draftApprovals.length} draft or AI output approval${input.draftApprovals.length === 1 ? "" : "s"} cannot move without human review.`,
      ownerAction: "Approve, reject, or request revision from the approval queue.",
      estimatedImpact: "Approval gated",
      href: "/admin/revenue-operations",
    });
  }

  const topSource = input.sourcePerformance[0];
  if (topSource && topSource.leads >= 10 && topSource.replyRate < 5) {
    risks.push({
      id: "source-quality",
      title: "Lead source quality needs review",
      severity: "low",
      detail: `${topSource.source} has ${topSource.leads} recent lead${topSource.leads === 1 ? "" : "s"} and a ${topSource.replyRate}% reply rate.`,
      ownerAction: "Audit targeting, offer, and first-touch copy before increasing volume.",
      estimatedImpact: "List quality risk",
      href: "/admin/sales-dashboard",
    });
  }

  if (input.sourceErrors.length > 0) {
    risks.push({
      id: "source-errors",
      title: "Some revenue sources did not load",
      severity: "low",
      detail: `${input.sourceErrors.length} read-only source check${input.sourceErrors.length === 1 ? "" : "s"} returned an error.`,
      ownerAction: "Review the source warning list before treating counts as complete.",
      estimatedImpact: "Incomplete snapshot",
      href: "/admin/control-center",
    });
  }

  if (risks.length === 0) {
    risks.push({
      id: "clear",
      title: "No urgent revenue risk detected",
      severity: "low",
      detail: "Current lead, follow-up, approval, and source checks do not show an immediate blocker.",
      ownerAction: "Keep monitoring hot leads and approval queues.",
      estimatedImpact: "No active estimate",
      href: "/admin/sales-engine",
    });
  }

  return risks.slice(0, 5);
}

async function loadSalesLeads() {
  const db = createServiceClient();
  const baseColumns = "id,business_name,contact_name,city,category,source,status,score,priority,buying_signal,do_not_contact,sms_opt_out,last_contacted_at,last_reply_at,total_messages_sent,total_replies,created_at,updated_at";
  const withFollowUp = `${baseColumns},next_follow_up_at`;

  const primary = await queryMaybe<SalesLeadRow[]>("sales_leads", () =>
    db
      .from("sales_leads")
      .select(withFollowUp)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(600),
  );

  if (!primary.error) return primary;

  const fallback = await queryMaybe<SalesLeadRow[]>("sales_leads fallback", () =>
    db
      .from("sales_leads")
      .select(baseColumns)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(600),
  );

  return {
    data: fallback.data,
    error: fallback.error ? `${primary.error}; ${fallback.error}` : primary.error,
  };
}

export async function loadAdminRevenueOpsSnapshot(): Promise<AdminRevenueOpsSnapshot> {
  const db = createServiceClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const sourceErrors: string[] = [];

  const [leadResult, eventResult, revenueApprovalResult, aiOutputResult] = await Promise.all([
    loadSalesLeads(),
    queryMaybe<SalesEventRow[]>("sales_events", () =>
      db
        .from("sales_events")
        .select("id,lead_id,action_type,channel,revenue_cents,created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1200),
    ),
    queryMaybe<RevenueApprovalRow[]>("revenue_message_approval_queue", () =>
      db
        .from("revenue_message_approval_queue")
        .select("id,business_line,channel,status,title,message_body,created_at,due_at")
        .in("status", ["draft", "needs_review"])
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(25),
    ),
    queryMaybe<AiOutputRow[]>("ai_outputs", () =>
      db
        .from("ai_outputs")
        .select("id,title,agent_name,workflow,output_type,approval_status,created_at")
        .in("approval_status", ["draft", "needs_review", "revision_needed"])
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(25),
    ),
  ]);

  if (leadResult.error) sourceErrors.push(leadResult.error);
  if (eventResult.error) sourceErrors.push(eventResult.error);
  if (revenueApprovalResult.error) sourceErrors.push(revenueApprovalResult.error);
  if (aiOutputResult.error) sourceErrors.push(aiOutputResult.error);

  const leads = (leadResult.data ?? []).filter(activeLead);
  const events = eventResult.data ?? [];
  const hotLeads = leads
    .filter(isHotLead)
    .sort((a, b) => hotLeadRank(b) - hotLeadRank(a))
    .slice(0, 8)
    .map((lead) => leadSignal(lead, lead.buying_signal ? "Buying signal detected" : "High-intent lead"));

  const staleOpportunities = leads
    .map((lead) => ({ lead, reason: staleReason(lead) }))
    .filter((item): item is { lead: SalesLeadRow; reason: string } => Boolean(item.reason))
    .sort((a, b) => (hoursSince(leadLastActivityAt(b.lead)) ?? 0) - (hoursSince(leadLastActivityAt(a.lead)) ?? 0))
    .slice(0, 8)
    .map((item) => leadSignal(item.lead, item.reason));

  const followUpsDue = leads
    .map((lead) => ({ lead, reason: followUpReason(lead) }))
    .filter((item): item is { lead: SalesLeadRow; reason: string } => Boolean(item.reason))
    .sort((a, b) => (parseTime(a.lead.next_follow_up_at) ?? 0) - (parseTime(b.lead.next_follow_up_at) ?? 0))
    .slice(0, 8)
    .map((item) => leadSignal(item.lead, item.reason));

  const draftApprovals = [
    ...(revenueApprovalResult.data ?? []).map(approvalFromRevenue),
    ...(aiOutputResult.data ?? []).map(approvalFromAiOutput),
  ]
    .sort((a, b) => (parseTime(b.createdAt) ?? 0) - (parseTime(a.createdAt) ?? 0))
    .slice(0, 10);

  const thirtyDayLeadRows = (leadResult.data ?? []).filter((lead) => {
    const created = parseTime(lead.created_at);
    return created !== null && created >= new Date(thirtyDaysAgo).getTime();
  });
  const sourcePerformance = buildSourcePerformance(thirtyDayLeadRows, events);

  const riskInput = {
    hotLeads,
    staleOpportunities,
    followUpsDue,
    draftApprovals,
    sourcePerformance,
    sourceErrors,
  };
  const revenueRisks = buildRisks(riskInput);

  return {
    generatedAt: now.toISOString(),
    counts: {
      hotLeads: hotLeads.length,
      staleOpportunities: staleOpportunities.length,
      followUpsDue: followUpsDue.length,
      draftApprovals: draftApprovals.length,
      leadSources: sourcePerformance.length,
      revenueRisks: revenueRisks.filter((risk) => risk.id !== "clear").length,
    },
    hotLeads,
    staleOpportunities,
    followUpsDue,
    draftApprovals,
    sourcePerformance,
    revenueRisks,
    sourceErrors,
  };
}
