import {
  campaignCandidates,
  campaignMapPlans,
  db,
  emailEvents,
  intakeSubmissions,
  marketingCampaigns,
  opcopilotActionRequests,
  opcopilotAiEvents,
  opcopilotInventoryItems,
  opcopilotPriceSnapshots,
  opcopilotSuppliers,
  orders,
  outreachReplies,
  politicalCampaigns,
  politicalCandidateAgents,
  politicalCandidateResearch,
  politicalMapLayers,
  politicalMailLaunchPlans,
  politicalOrders,
  politicalPriorityRuns,
  politicalProposals,
  salesEvents,
  salesLeads,
  spotAssignments,
  targetedRouteCampaigns,
  twilioMessageStatus,
  uspsMapLayers,
  waitlistEntries,
} from "@homereach/db";
import { and, count, desc, eq, gte, inArray, lt, or, sum } from "drizzle-orm";
import type {
  HomeReachOSData,
  OSActivity,
  OSAgent,
  OSCommandCard,
  OSCommunityLoop,
  OSDigitalEmployee,
  OSExecutionLayer,
  OSExperienceBoundary,
  OSHealthDimension,
  OSIndustryPlaybook,
  OSMapLayer,
  OSMetric,
  OSMembershipPlan,
  OSMoneyLeak,
  OSNextBestAction,
  OSMonitor,
  OSOpportunity,
  OSPipelineStage,
  OSProductPanel,
  OSStatus,
  OSSpecializedAgent,
} from "./types";
import { getSeoCommandCenterSnapshot } from "@/lib/seo/authority";

async function safe<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([promise.catch(() => fallback), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function firstNumber<T, K extends keyof T>(rows: T[], key: K): number {
  return Number(rows[0]?.[key] ?? 0);
}

function centsFromDollars(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

function cents(value: unknown): number {
  return Math.round(Number(value ?? 0));
}

function formatMoney(centsValue: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(centsValue / 100);
}

function compactAge(dateValue: Date | string | null | undefined): string {
  if (!dateValue) return "recently";
  const date = new Date(dateValue);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function statusFromPressure(value: number, warnAt: number, criticalAt: number): OSStatus {
  if (value >= criticalAt) return "critical";
  if (value >= warnAt) return "watch";
  return "online";
}

function metric(label: string, value: string, detail: string, status: OSStatus = "online", trend?: string): OSMetric {
  return { label, value, detail, status, trend };
}

function action(input: OSNextBestAction): OSNextBestAction {
  return input;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusFromScore(score: number): OSStatus {
  if (score < 45) return "critical";
  if (score < 72) return "watch";
  return "online";
}

export async function getHomeReachOSData(): Promise<HomeReachOSData> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    activeSpotsRows,
    pendingSpotsRows,
    pausedSpotsRows,
    mrrRows,
    revenueTodayRows,
    salesRevenueTodayRows,
    politicalRevenueTodayRows,
    pendingOrdersRows,
    pendingOrdersValueRows,
    failedOrdersRows,
    pendingPoliticalOrdersRows,
    pendingPoliticalValueRows,
    failedPoliticalOrdersRows,
    pendingProposalRows,
    newSalesLeadsRows,
    hotSalesLeadsRows,
    staleSalesLeadsRows,
    aiRankedLeadRows,
    businessOpportunityRows,
    politicalOpportunityRows,
    routeOpportunityRows,
    activeMarketingRows,
    upcomingMarketingRows,
    activeTargetedRows,
    printJobRows,
    designApprovalRows,
    scheduledMailRows,
    unreadSmsRows,
    unreadEmailRows,
    unreadDmRows,
    unreadRepliesRows,
    websiteInquiryRows,
    intakeQueueRows,
    campaignReplyRows,
    opAiEventRows,
    opActionRows,
    politicalRunsRows,
    candidateAgentRows,
    candidateResearchRows,
    candidatePlanRows,
    candidateApprovalNeededRows,
    candidateProductionReadyRows,
    newCandidateRows,
    newBusinessRows,
    scoringChangeRows,
    draftRows,
    textsSentRows,
    emailsSentRows,
    dmsSentRows,
    callsMadeRows,
    meetingsRows,
    proposalsSentRows,
    dealsClosedRows,
    humanActionsRows,
    activeInventoryRows,
    activeSupplierRows,
    priceSnapshotRows,
    politicalCampaignRows,
    politicalOrderProductionRows,
    uspsLayerRows,
    politicalLayerRows,
    mapPlanRows,
    twilioFailureRows,
    emailFailureRows,
    topBusinessLeadRows,
    topPoliticalRows,
    recentReplyRows,
    recentEventRows,
  ] = await Promise.all([
    safe(db.select({ n: count() }).from(spotAssignments).where(eq(spotAssignments.status, "active")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(spotAssignments).where(eq(spotAssignments.status, "pending")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(spotAssignments).where(eq(spotAssignments.status, "paused")), [{ n: 0 }]),
    safe(db.select({ total: sum(spotAssignments.monthlyValueCents) }).from(spotAssignments).where(eq(spotAssignments.status, "active")), [{ total: null }]),
    safe(db.select({ total: sum(orders.total) }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.paidAt, todayStart))), [{ total: null }]),
    safe(db.select({ total: sum(salesEvents.revenueCents) }).from(salesEvents).where(and(eq(salesEvents.actionType, "deal_closed"), gte(salesEvents.createdAt, todayStart))), [{ total: null }]),
    safe(db.select({ total: sum(politicalOrders.amountPaidCents) }).from(politicalOrders).where(and(inArray(politicalOrders.paymentStatus, ["deposit_paid", "paid"]), gte(politicalOrders.paidAt, todayStart))), [{ total: null }]),
    safe(db.select({ n: count() }).from(orders).where(eq(orders.status, "pending")), [{ n: 0 }]),
    safe(db.select({ total: sum(orders.total) }).from(orders).where(eq(orders.status, "pending")), [{ total: null }]),
    safe(db.select({ n: count() }).from(orders).where(inArray(orders.status, ["cancelled", "refunded"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalOrders).where(eq(politicalOrders.paymentStatus, "pending")), [{ n: 0 }]),
    safe(db.select({ total: sum(politicalOrders.totalCents) }).from(politicalOrders).where(eq(politicalOrders.paymentStatus, "pending")), [{ total: null }]),
    safe(db.select({ n: count() }).from(politicalOrders).where(eq(politicalOrders.paymentStatus, "failed")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalProposals).where(inArray(politicalProposals.status, ["draft", "sent", "viewed"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesLeads).where(gte(salesLeads.createdAt, todayStart)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesLeads).where(or(eq(salesLeads.priority, "high"), gte(salesLeads.score, 80), eq(salesLeads.buyingSignal, true))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesLeads).where(and(inArray(salesLeads.status, ["contacted", "replied", "interested", "payment_sent"]), lt(salesLeads.lastContactedAt, sevenDaysAgo))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesLeads).where(gte(salesLeads.score, 1)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesLeads).where(inArray(salesLeads.status, ["queued", "contacted", "replied", "interested", "payment_sent"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(campaignCandidates).where(and(eq(campaignCandidates.candidateStatus, "active"), or(gte(campaignCandidates.priorityScore, 1), gte(campaignCandidates.completenessScore, 1)))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(targetedRouteCampaigns).where(inArray(targetedRouteCampaigns.status, ["intake_complete", "paid", "design_queued", "design_in_progress", "design_ready", "approved"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(marketingCampaigns).where(eq(marketingCampaigns.status, "active")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(marketingCampaigns).where(eq(marketingCampaigns.status, "upcoming")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(targetedRouteCampaigns).where(inArray(targetedRouteCampaigns.status, ["paid", "design_queued", "design_in_progress", "design_ready", "approved", "mailed"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(targetedRouteCampaigns).where(inArray(targetedRouteCampaigns.designStatus, ["queued", "in_progress", "ready"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(targetedRouteCampaigns).where(eq(targetedRouteCampaigns.designStatus, "ready")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(targetedRouteCampaigns).where(eq(targetedRouteCampaigns.mailingStatus, "scheduled")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(outreachReplies).where(and(eq(outreachReplies.isRead, false), eq(outreachReplies.channel, "sms"))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(outreachReplies).where(and(eq(outreachReplies.isRead, false), eq(outreachReplies.channel, "email"))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.actionType, "reply_received"), eq(salesEvents.channel, "facebook"), gte(salesEvents.createdAt, thirtyDaysAgo))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(outreachReplies).where(eq(outreachReplies.isRead, false)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(waitlistEntries).where(gte(waitlistEntries.createdAt, todayStart)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(intakeSubmissions).where(eq(intakeSubmissions.status, "submitted")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(outreachReplies).where(gte(outreachReplies.receivedAt, todayStart)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(opcopilotAiEvents).where(eq(opcopilotAiEvents.status, "open")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(opcopilotActionRequests).where(inArray(opcopilotActionRequests.status, ["draft", "pending", "needs_approval"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalPriorityRuns).where(gte(politicalPriorityRuns.startedAt, thirtyDaysAgo)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalCandidateAgents), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalCandidateResearch), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalMailLaunchPlans).where(inArray(politicalMailLaunchPlans.status, ["needs_review", "approved", "proposal_ready", "production_ready"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalMailLaunchPlans).where(eq(politicalMailLaunchPlans.status, "needs_review")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalMailLaunchPlans).where(eq(politicalMailLaunchPlans.status, "production_ready")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(campaignCandidates).where(gte(campaignCandidates.createdAt, todayStart)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesLeads).where(gte(salesLeads.createdAt, todayStart)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(gte(salesEvents.createdAt, todayStart), inArray(salesEvents.actionType, ["lead_loaded", "lead_skipped", "reply_received", "conversation_started"]))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalProposals).where(eq(politicalProposals.status, "draft")), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.actionType, "text_sent"), gte(salesEvents.createdAt, todayStart))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.actionType, "email_sent"), gte(salesEvents.createdAt, todayStart))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.actionType, "facebook_sent"), gte(salesEvents.createdAt, todayStart))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.channel, "call"), gte(salesEvents.createdAt, todayStart))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.actionType, "conversation_started"), gte(salesEvents.createdAt, todayStart))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalProposals).where(and(inArray(politicalProposals.status, ["sent", "viewed", "approved"]), gte(politicalProposals.sentAt, thirtyDaysAgo))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(and(eq(salesEvents.actionType, "deal_closed"), gte(salesEvents.createdAt, todayStart))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(salesEvents).where(gte(salesEvents.createdAt, todayStart)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(opcopilotInventoryItems).where(eq(opcopilotInventoryItems.active, true)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(opcopilotSuppliers).where(eq(opcopilotSuppliers.active, true)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(opcopilotPriceSnapshots).where(gte(opcopilotPriceSnapshots.capturedAt, thirtyDaysAgo)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalCampaigns).where(inArray(politicalCampaigns.pipelineStatus, ["prospect", "contacted", "proposal_sent"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalOrders).where(inArray(politicalOrders.fulfillmentStatus, ["pending", "production"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(uspsMapLayers), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(politicalMapLayers), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(campaignMapPlans).where(inArray(campaignMapPlans.status, ["draft", "saved", "proposal_ready", "proposal_sent", "approved"])), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(twilioMessageStatus).where(and(inArray(twilioMessageStatus.messageStatus, ["failed", "undelivered"]), gte(twilioMessageStatus.receivedAt, thirtyDaysAgo))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(emailEvents).where(and(inArray(emailEvents.eventType, ["bounce", "spam_complaint"]), gte(emailEvents.receivedAt, thirtyDaysAgo))), [{ n: 0 }]),
    safe(
      db
        .select({
          id: salesLeads.id,
          businessName: salesLeads.businessName,
          city: salesLeads.city,
          category: salesLeads.category,
          score: salesLeads.score,
          priority: salesLeads.priority,
          status: salesLeads.status,
        })
        .from(salesLeads)
        .where(eq(salesLeads.doNotContact, false))
        .orderBy(desc(salesLeads.score), desc(salesLeads.createdAt))
        .limit(5),
      [],
    ),
    safe(
      db
        .select({
          id: campaignCandidates.id,
          candidateName: campaignCandidates.candidateName,
          officeSought: campaignCandidates.officeSought,
          city: campaignCandidates.city,
          county: campaignCandidates.county,
          state: campaignCandidates.state,
          priorityScore: campaignCandidates.priorityScore,
          completenessScore: campaignCandidates.completenessScore,
        })
        .from(campaignCandidates)
        .where(eq(campaignCandidates.candidateStatus, "active"))
        .orderBy(desc(campaignCandidates.priorityScore), desc(campaignCandidates.createdAt))
        .limit(4),
      [],
    ),
    safe(
      db
        .select({
          id: outreachReplies.id,
          channel: outreachReplies.channel,
          body: outreachReplies.body,
          receivedAt: outreachReplies.receivedAt,
          isRead: outreachReplies.isRead,
        })
        .from(outreachReplies)
        .orderBy(desc(outreachReplies.receivedAt))
        .limit(5),
      [],
    ),
    safe(
      db
        .select({
          id: salesEvents.id,
          actionType: salesEvents.actionType,
          channel: salesEvents.channel,
          city: salesEvents.city,
          category: salesEvents.category,
          revenueCents: salesEvents.revenueCents,
          createdAt: salesEvents.createdAt,
        })
        .from(salesEvents)
        .orderBy(desc(salesEvents.createdAt))
        .limit(6),
      [],
    ),
  ]);

  const activeSpots = firstNumber(activeSpotsRows, "n");
  const pendingSpots = firstNumber(pendingSpotsRows, "n");
  const pausedSpots = firstNumber(pausedSpotsRows, "n");
  const mrrCents = cents(firstNumber(mrrRows, "total"));
  const revenueTodayCents =
    centsFromDollars(firstNumber(revenueTodayRows, "total")) +
    cents(firstNumber(salesRevenueTodayRows, "total")) +
    cents(firstNumber(politicalRevenueTodayRows, "total"));
  const pendingOrderValueCents = centsFromDollars(firstNumber(pendingOrdersValueRows, "total"));
  const pendingPoliticalValueCents = cents(firstNumber(pendingPoliticalValueRows, "total"));
  const salesPipelineCount = firstNumber(businessOpportunityRows, "n");
  const routeOpportunityCount = firstNumber(routeOpportunityRows, "n");
  const politicalOpportunityCount = firstNumber(politicalOpportunityRows, "n");
  const candidateAgentCount = firstNumber(candidateAgentRows, "n");
  const candidateResearchCount = firstNumber(candidateResearchRows, "n");
  const candidatePlanCount = firstNumber(candidatePlanRows, "n");
  const candidateApprovalNeededCount = firstNumber(candidateApprovalNeededRows, "n");
  const candidateProductionReadyCount = firstNumber(candidateProductionReadyRows, "n");
  const weightedPipelineCents =
    pendingOrderValueCents +
    pendingPoliticalValueCents +
    salesPipelineCount * 45000 +
    routeOpportunityCount * 40000 +
    politicalOpportunityCount * 125000;
  const closeProbability = Math.min(
    91,
    Math.max(18, Math.round((firstNumber(hotSalesLeadsRows, "n") * 6 + firstNumber(pendingProposalRows, "n") * 4 + activeSpots) / 2)),
  );

  const topBusiness: OSOpportunity[] = topBusinessLeadRows.map((lead) => ({
    id: lead.id,
    name: lead.businessName,
    segment: "business",
    location: [lead.city, lead.category].filter(Boolean).join(" / ") || "Market open",
    product: lead.priority === "high" ? "Shared postcards + targeted route" : "Shared postcards",
    score: Number(lead.score ?? 0),
    value: formatMoney(Math.max(35000, Number(lead.score ?? 0) * 1000)),
    nextAction: lead.status === "payment_sent" ? "Close payment loop" : "Send AI-ranked outreach",
  }));

  const topPolitical: OSOpportunity[] = topPoliticalRows.map((candidate) => ({
    id: candidate.id,
    name: candidate.candidateName,
    segment: "political",
    location: [candidate.officeSought, candidate.city ?? candidate.county ?? candidate.state].filter(Boolean).join(" / "),
    product: "Political campaign mail",
    score: Number(candidate.priorityScore ?? candidate.completenessScore ?? 0),
    value: formatMoney(Math.max(150000, Number(candidate.priorityScore ?? 55) * 2500)),
    nextAction: "Generate proposal and district route plan",
  }));

  const opportunities = [...topBusiness, ...topPolitical]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const pipeline: OSPipelineStage[] = [
    {
      name: "New",
      count: firstNumber(newSalesLeadsRows, "n"),
      value: formatMoney(firstNumber(newSalesLeadsRows, "n") * 30000),
      probability: 12,
    },
    {
      name: "Hot",
      count: firstNumber(hotSalesLeadsRows, "n"),
      value: formatMoney(firstNumber(hotSalesLeadsRows, "n") * 65000),
      probability: 48,
    },
    {
      name: "Proposal",
      count: firstNumber(pendingProposalRows, "n"),
      value: formatMoney(firstNumber(pendingProposalRows, "n") * 125000),
      probability: 62,
    },
    {
      name: "Payment",
      count: firstNumber(pendingOrdersRows, "n") + firstNumber(pendingPoliticalOrdersRows, "n"),
      value: formatMoney(pendingOrderValueCents + pendingPoliticalValueCents),
      probability: 78,
    },
    {
      name: "Won",
      count: firstNumber(dealsClosedRows, "n"),
      value: formatMoney(revenueTodayCents),
      probability: 100,
    },
  ];

  const operationsAlertCount =
    pausedSpots +
    firstNumber(failedOrdersRows, "n") +
    firstNumber(failedPoliticalOrdersRows, "n") +
    firstNumber(designApprovalRows, "n") +
    firstNumber(twilioFailureRows, "n") +
    firstNumber(emailFailureRows, "n");

  const productOps: OSProductPanel[] = [
    {
      name: "Shared Postcards",
      description: "City inventory, category exclusivity, renewals, schedules, and saturation.",
      href: "/admin/spots",
      status: statusFromPressure(pendingSpots + pausedSpots, 2, 5),
      metrics: [
        metric("Active spots", String(activeSpots), "Locked category positions"),
        metric("Pending spots", String(pendingSpots), "Reserved or checkout-started", statusFromPressure(pendingSpots, 2, 5)),
        metric("MRR", formatMoney(mrrCents), "Subscription run-rate"),
      ],
      actions: [
        { label: "Open inventory", href: "/admin/spots" },
        { label: "Availability", href: "/admin/availability" },
      ],
    },
    {
      name: "Targeted Campaigns",
      description: "Route builder, ZIP targeting, pricing, delivery scheduling, and approvals.",
      href: "/admin/targeted-campaigns",
      status: statusFromPressure(firstNumber(designApprovalRows, "n"), 1, 4),
      metrics: [
        metric("Active", String(firstNumber(activeTargetedRows, "n")), "Campaigns in motion"),
        metric("Print jobs", String(firstNumber(printJobRows, "n")), "Design or proof queue"),
        metric("Approvals", String(firstNumber(designApprovalRows, "n")), "Customer proof reviews", statusFromPressure(firstNumber(designApprovalRows, "n"), 1, 4)),
      ],
      actions: [
        { label: "Route campaigns", href: "/admin/targeted-campaigns" },
        { label: "Send intake", href: "/admin/intake" },
      ],
    },
    {
      name: "Political Campaigns",
      description: "Candidate CRM, district maps, proposals, mail operations, and compliance-safe workflows.",
      href: "/admin/political",
      status: candidateApprovalNeededCount > 0
        ? "watch"
        : statusFromPressure(firstNumber(politicalOrderProductionRows, "n"), 2, 6),
      metrics: [
        metric("Opportunities", String(politicalOpportunityCount), "Active ranked candidates"),
        metric("Launch agents", String(candidateAgentCount), "Assigned candidate agents"),
        metric("Plans ready", String(candidatePlanCount), "Generated mail launch plans"),
        metric("Approvals", String(candidateApprovalNeededCount), "Human review required", statusFromPressure(candidateApprovalNeededCount, 1, 4)),
      ],
      actions: [
        { label: "Political OS", href: "/admin/political" },
        { label: "Candidate agents", href: "/admin/political/candidate-agent" },
        { label: "District maps", href: "/admin/political/maps" },
      ],
    },
    {
      name: "Inventory & Purchasing",
      description: "Supplier tracking, recurring purchases, savings, price intelligence, and AI recommendations.",
      href: "/operations-copilot",
      status: statusFromPressure(firstNumber(opActionRows, "n"), 3, 8),
      metrics: [
        metric("Inventory", String(firstNumber(activeInventoryRows, "n")), "Tracked items"),
        metric("Suppliers", String(firstNumber(activeSupplierRows, "n")), "Active vendors"),
        metric("Price checks", String(firstNumber(priceSnapshotRows, "n")), "Snapshots in 30 days"),
      ],
      actions: [
        { label: "Open copilot", href: "/operations-copilot" },
        { label: "Approvals", href: "/operations-copilot/approvals" },
      ],
    },
    {
      name: "Government Contracts",
      description: "SAM.gov opportunities, fit scoring, bid rooms, outreach drafts, deadlines, and compliance review.",
      href: "/admin/gov-contracts",
      status: "online",
      metrics: [
        metric("Fit scoring", "Live", "Bid/no-bid triage"),
        metric("Bid rooms", "Ready", "Capability and compliance workspace"),
        metric("Human approval", "Locked", "No bid submission without review"),
      ],
      actions: [
        { label: "Gov contracts", href: "/admin/gov-contracts" },
        { label: "Bid room", href: "/admin/gov-contracts" },
      ],
    },
    {
      name: "Property Intelligence",
      description: "Property insights, homeowner targeting visuals, overlays, heatmaps, and address strategy.",
      href: "/admin/roi-preview",
      status: "online",
      metrics: [
        metric("Route plans", String(firstNumber(mapPlanRows, "n")), "Draft, priced, or approved"),
        metric("USPS layers", String(firstNumber(uspsLayerRows, "n")), "Available route sources"),
        metric("Geo layers", String(firstNumber(politicalLayerRows, "n")), "District and boundary layers"),
      ],
      actions: [
        { label: "Open map plans", href: "/admin/political/maps" },
        { label: "ROI preview", href: "/admin/roi-preview" },
      ],
    },
    {
      name: "Yard Signs, Door Hangers, Business Cards",
      description: "Print add-ons unified with direct mail, campaign, and purchasing operations.",
      href: "/admin/products",
      status: "online",
      metrics: [
        metric("Products", "3", "Operational add-on families"),
        metric("Catalog", "Live", "Managed in product admin"),
        metric("Attach rate", `${Math.min(100, Math.max(8, Math.round(activeSpots / 2)))}%`, "Estimated cross-sell signal"),
      ],
      actions: [
        { label: "Product catalog", href: "/admin/products" },
        { label: "Bundles", href: "/admin/bundles" },
      ],
    },
  ];

  const maps: OSMapLayer[] = [
    { name: "USPS Routes", type: "Carrier route", status: firstNumber(uspsLayerRows, "n") > 0 ? "online" : "idle", count: firstNumber(uspsLayerRows, "n"), detail: "Route counts and mail volume planning" },
    { name: "Political Districts", type: "Compliance-safe geography", status: firstNumber(politicalLayerRows, "n") > 0 ? "online" : "idle", count: firstNumber(politicalLayerRows, "n"), detail: "District overlays for campaign mail" },
    { name: "ZIPs and Counties", type: "Market boundary", status: "online", count: activeSpots + pendingSpots, detail: "Shared postcard territory coverage" },
    { name: "Property Heatmap", type: "Homeowner layer", status: routeOpportunityCount > 0 ? "online" : "idle", count: routeOpportunityCount, detail: "Targeted route opportunity clusters" },
  ];

  const agents: OSAgent[] = [
    {
      name: "Lead Research Agent",
      status: firstNumber(newBusinessRows, "n") > 0 ? "online" : "idle",
      currentTask: "Refreshing local business opportunity scores",
      lastAction: `${firstNumber(newBusinessRows, "n")} new business records today`,
      confidence: 86,
      queueCount: Math.max(0, firstNumber(businessOpportunityRows, "n")),
    },
    {
      name: "Political Filing Agent",
      status: firstNumber(newCandidateRows, "n") > 0 ? "online" : "watch",
      currentTask: "Monitoring filings and public campaign records",
      lastAction: `${firstNumber(newCandidateRows, "n")} candidate filings today`,
      confidence: 82,
      queueCount: politicalOpportunityCount,
    },
    {
      name: "Candidate Launch Agent",
      status: candidateApprovalNeededCount > 0 ? "watch" : candidatePlanCount > 0 ? "online" : "idle",
      currentTask: "Researching candidates and building multi-phase postcard launch plans",
      lastAction: `${candidateResearchCount} research files / ${candidatePlanCount} launch plans`,
      confidence: candidatePlanCount > 0 ? 88 : 76,
      queueCount: candidateApprovalNeededCount + Math.max(0, candidateAgentCount - candidatePlanCount),
    },
    {
      name: "Outreach Agent",
      status: firstNumber(unreadRepliesRows, "n") > 0 ? "watch" : "online",
      currentTask: "Sequencing replies, follow-ups, and channel handoffs",
      lastAction: `${firstNumber(textsSentRows, "n") + firstNumber(emailsSentRows, "n")} touches today`,
      confidence: 88,
      queueCount: firstNumber(unreadRepliesRows, "n") + firstNumber(staleSalesLeadsRows, "n"),
    },
    {
      name: "Proposal Agent",
      status: firstNumber(draftRows, "n") > 0 ? "online" : "idle",
      currentTask: "Drafting political and route proposals",
      lastAction: `${firstNumber(draftRows, "n")} drafts ready`,
      confidence: 91,
      queueCount: firstNumber(pendingProposalRows, "n"),
    },
    {
      name: "Compliance Agent",
      status: firstNumber(twilioFailureRows, "n") + firstNumber(emailFailureRows, "n") > 0 ? "watch" : "online",
      currentTask: "Watching send failures, opt-outs, and provider events",
      lastAction: `${firstNumber(twilioFailureRows, "n") + firstNumber(emailFailureRows, "n")} provider exceptions in 30 days`,
      confidence: 84,
      queueCount: firstNumber(twilioFailureRows, "n") + firstNumber(emailFailureRows, "n"),
    },
    {
      name: "Revenue Integrity Agent",
      status: firstNumber(failedOrdersRows, "n") + firstNumber(failedPoliticalOrdersRows, "n") + pausedSpots > 0 ? "critical" : "online",
      currentTask: "Reconciling failed payments, pending invoices, and pipeline leakage",
      lastAction: `${firstNumber(pendingOrdersRows, "n") + firstNumber(pendingPoliticalOrdersRows, "n")} pending payments`,
      confidence: 89,
      queueCount: firstNumber(failedOrdersRows, "n") + firstNumber(failedPoliticalOrdersRows, "n") + pausedSpots,
    },
    {
      name: "Route Optimization Agent",
      status: firstNumber(mapPlanRows, "n") > 0 ? "online" : "idle",
      currentTask: "Comparing routes, ZIPs, districts, and estimated mail volume",
      lastAction: `${firstNumber(mapPlanRows, "n")} map plans active`,
      confidence: 80,
      queueCount: firstNumber(mapPlanRows, "n"),
    },
    {
      name: "Inventory Intelligence Agent",
      status: firstNumber(opActionRows, "n") > 0 ? "watch" : "online",
      currentTask: "Scanning supplier quotes and savings opportunities",
      lastAction: `${firstNumber(opActionRows, "n")} purchasing actions queued`,
      confidence: 87,
      queueCount: firstNumber(opActionRows, "n"),
    },
    {
      name: "Property Intelligence Agent",
      status: routeOpportunityCount > 0 ? "online" : "idle",
      currentTask: "Building homeowner targeting and market density signals",
      lastAction: `${routeOpportunityCount} route opportunities detected`,
      confidence: 78,
      queueCount: routeOpportunityCount,
    },
  ];

  const recentConversations = recentReplyRows.map((reply) => ({
    id: reply.id,
    name: reply.channel === "sms" ? "Text reply" : "Email reply",
    channel: reply.channel,
    summary: reply.body,
    age: compactAge(reply.receivedAt),
    unread: !reply.isRead,
    urgency: reply.isRead ? 54 : 88,
    nextAction: reply.isRead ? "Review thread" : "Reply now",
  }));

  const activityFeed: OSActivity[] = [
    ...recentEventRows.map((event) => ({
      id: event.id,
      title: event.actionType.replaceAll("_", " "),
      detail: [event.channel, event.city, event.category].filter(Boolean).join(" / ") || "Sales activity",
      time: compactAge(event.createdAt),
      status: event.actionType === "deal_closed" ? "online" as OSStatus : "idle" as OSStatus,
    })),
    ...recentReplyRows.slice(0, 3).map((reply) => ({
      id: `reply-${reply.id}`,
      title: `${reply.channel.toUpperCase()} reply received`,
      detail: reply.body,
      time: compactAge(reply.receivedAt),
      status: reply.isRead ? "idle" as OSStatus : "watch" as OSStatus,
    })),
  ].slice(0, 8);

  const notifications: OSActivity[] = [
    {
      id: "payments",
      title: "Payment integrity",
      detail: `${firstNumber(failedOrdersRows, "n") + firstNumber(failedPoliticalOrdersRows, "n") + pausedSpots} failed, paused, refunded, or canceled payment records need review`,
      time: "live",
      status: statusFromPressure(firstNumber(failedOrdersRows, "n") + firstNumber(failedPoliticalOrdersRows, "n") + pausedSpots, 1, 3),
    },
    {
      id: "followups",
      title: "Missed follow-ups",
      detail: `${firstNumber(staleSalesLeadsRows, "n")} stale leads have not had timely contact`,
      time: "live",
      status: statusFromPressure(firstNumber(staleSalesLeadsRows, "n"), 3, 8),
    },
    {
      id: "routes",
      title: "Route conflicts and map plans",
      detail: `${firstNumber(mapPlanRows, "n")} synchronized map plans need pricing or approval`,
      time: "live",
      status: statusFromPressure(firstNumber(mapPlanRows, "n"), 4, 10),
    },
    {
      id: "candidate-launch-agents",
      title: "Candidate launch agents",
      detail: `${candidateApprovalNeededCount} launch plans need human approval; ${candidateProductionReadyCount} are production ready`,
      time: "live",
      status: statusFromPressure(candidateApprovalNeededCount, 1, 4),
    },
    {
      id: "candidate-filings",
      title: "Candidate filing alerts",
      detail: `${firstNumber(newCandidateRows, "n")} new candidate records today`,
      time: "today",
      status: firstNumber(newCandidateRows, "n") > 0 ? "watch" : "idle",
    },
    {
      id: "provider-health",
      title: "Provider health",
      detail: `${firstNumber(twilioFailureRows, "n")} Twilio and ${firstNumber(emailFailureRows, "n")} Postmark exceptions in 30 days`,
      time: "30d",
      status: statusFromPressure(firstNumber(twilioFailureRows, "n") + firstNumber(emailFailureRows, "n"), 1, 4),
    },
  ];

  const automation: OSMonitor[] = [
    {
      name: "Twilio",
      status: statusFromPressure(firstNumber(twilioFailureRows, "n"), 1, 5),
      detail: `${firstNumber(twilioFailureRows, "n")} failed or undelivered callbacks in 30 days`,
      href: "/api/webhooks/twilio/status",
    },
    {
      name: "Postmark",
      status: statusFromPressure(firstNumber(emailFailureRows, "n"), 1, 5),
      detail: `${firstNumber(emailFailureRows, "n")} bounce or complaint events in 30 days`,
      href: "/api/webhooks/postmark",
    },
    {
      name: "Automation Sequences",
      status: firstNumber(opActionRows, "n") > 0 ? "watch" : "online",
      detail: `${firstNumber(opActionRows, "n")} AI or purchasing approvals queued`,
      href: "/api/admin/automation/send-due",
    },
    {
      name: "Political Ingestion",
      status: firstNumber(politicalRunsRows, "n") > 0 ? "online" : "idle",
      detail: `${firstNumber(politicalRunsRows, "n")} priority runs in 30 days`,
      href: "/admin/political/intelligence",
    },
    {
      name: "Stripe Pipeline",
      status: statusFromPressure(firstNumber(pendingOrdersRows, "n") + firstNumber(pendingPoliticalOrdersRows, "n"), 5, 12),
      detail: `${firstNumber(pendingOrdersRows, "n") + firstNumber(pendingPoliticalOrdersRows, "n")} pending checkout or political payments`,
      href: "https://dashboard.stripe.com",
    },
  ];

  const revenueByProduct = [
    metric("Shared postcards", formatMoney(mrrCents), "Recurring monthly base"),
    metric("Targeted campaigns", formatMoney(firstNumber(activeTargetedRows, "n") * 40000), "Route campaigns in flight"),
    metric("Political mail", formatMoney(pendingPoliticalValueCents), "Pending political payment value"),
    metric("Purchasing OS", formatMoney(firstNumber(opActionRows, "n") * 25000), "Estimated savings pipeline"),
  ];

  const failedPaymentCount = firstNumber(failedOrdersRows, "n") + firstNumber(failedPoliticalOrdersRows, "n") + pausedSpots;
  const pendingPaymentCount = firstNumber(pendingOrdersRows, "n") + firstNumber(pendingPoliticalOrdersRows, "n");
  const providerExceptionCount = firstNumber(twilioFailureRows, "n") + firstNumber(emailFailureRows, "n");
  const pendingReplyCount = firstNumber(unreadRepliesRows, "n");
  const pendingPurchasingActions = firstNumber(opActionRows, "n");
  const designApprovalCount = firstNumber(designApprovalRows, "n");
  const staleLeadCount = firstNumber(staleSalesLeadsRows, "n");
  const pendingProposalCount = firstNumber(pendingProposalRows, "n");
  const activeMapPlanCount = firstNumber(mapPlanRows, "n");
  const websiteInquiryCount = firstNumber(websiteInquiryRows, "n");
  const seoSnapshot = getSeoCommandCenterSnapshot();
  const activeCampaignCount =
    firstNumber(activeMarketingRows, "n") +
    firstNumber(activeTargetedRows, "n") +
    firstNumber(politicalCampaignRows, "n");
  const reviewBaselineScore = 58;

  const healthDimensions: OSHealthDimension[] = [
    {
      id: "marketing-consistency",
      label: "Marketing consistency",
      score: clampScore(44 + activeCampaignCount * 8 + firstNumber(upcomingMarketingRows, "n") * 4 - designApprovalCount * 2),
      status: statusFromScore(clampScore(44 + activeCampaignCount * 8 + firstNumber(upcomingMarketingRows, "n") * 4 - designApprovalCount * 2)),
      detail: `${activeCampaignCount} active campaign records and ${firstNumber(upcomingMarketingRows, "n")} upcoming shared postcard schedules.`,
      weakSpot: activeCampaignCount > 0 ? "Keep the cadence visible and renewal-ready." : "No active campaign rhythm is visible yet.",
      nextAction: activeCampaignCount > 0 ? "Review renewals and next-drop timing." : "Build a monthly visibility plan.",
      href: "/admin/campaigns",
    },
    {
      id: "local-visibility",
      label: "Local visibility",
      score: clampScore(42 + activeSpots * 3 + routeOpportunityCount * 5 + activeMapPlanCount * 4),
      status: statusFromScore(clampScore(42 + activeSpots * 3 + routeOpportunityCount * 5 + activeMapPlanCount * 4)),
      detail: `${activeSpots} shared spots, ${routeOpportunityCount} route opportunities, ${activeMapPlanCount} map plans.`,
      weakSpot: "Visibility is strongest when routes, postcards, and follow-up stay connected.",
      nextAction: "Package the next map-backed visibility offer.",
      href: "/admin/availability",
    },
    {
      id: "follow-up-activity",
      label: "Follow-up activity",
      score: clampScore(92 - pendingReplyCount * 4 - staleLeadCount * 3),
      status: statusFromScore(clampScore(92 - pendingReplyCount * 4 - staleLeadCount * 3)),
      detail: `${pendingReplyCount} pending replies and ${staleLeadCount} stale follow-ups.`,
      weakSpot: staleLeadCount > 0 ? "Warm pipeline is cooling because follow-up is late." : "Keep response speed high.",
      nextAction: "Open the unified communication center.",
      href: "/admin/inbox",
    },
    {
      id: "seo-strength",
      label: "SEO strength",
      score: clampScore(55 + seoSnapshot.totals.publicAuthorityRoutes * 0.18 + seoSnapshot.totals.keywordTargets * 1.8),
      status: statusFromScore(clampScore(55 + seoSnapshot.totals.publicAuthorityRoutes * 0.18 + seoSnapshot.totals.keywordTargets * 1.8)),
      detail: `${seoSnapshot.totals.publicAuthorityRoutes} authority routes, ${seoSnapshot.totals.keywordTargets} keyword targets, ${seoSnapshot.totals.visualAssets} visual assets.`,
      weakSpot: "Search Console and analytics connectors are still needed before claiming live rankings.",
      nextAction: "Open SEO Command Center.",
      href: "/admin/marketing/seo-command-center",
    },
    {
      id: "review-activity",
      label: "Review activity",
      score: reviewBaselineScore,
      status: statusFromScore(reviewBaselineScore),
      detail: "Review request workflows exist; live reputation connectors should be connected before automated claims.",
      weakSpot: "Review volume and response timing should become part of the customer health rhythm.",
      nextAction: "Open review operations.",
      href: "/admin/reviews",
    },
    {
      id: "procurement-efficiency",
      label: "Procurement efficiency",
      score: clampScore(52 + firstNumber(priceSnapshotRows, "n") * 0.6 + firstNumber(activeSupplierRows, "n") * 2 - pendingPurchasingActions * 3),
      status: statusFromScore(clampScore(52 + firstNumber(priceSnapshotRows, "n") * 0.6 + firstNumber(activeSupplierRows, "n") * 2 - pendingPurchasingActions * 3)),
      detail: `${firstNumber(priceSnapshotRows, "n")} price snapshots, ${firstNumber(activeSupplierRows, "n")} suppliers, ${pendingPurchasingActions} pending actions.`,
      weakSpot: pendingPurchasingActions > 0 ? "Savings or reorder decisions are waiting on approval." : "Keep supplier checks fresh.",
      nextAction: "Review supplier price intelligence.",
      href: "/operations-copilot",
    },
    {
      id: "retention",
      label: "Customer retention",
      score: clampScore(64 + activeSpots * 2 - pausedSpots * 8 - failedPaymentCount * 4),
      status: statusFromScore(clampScore(64 + activeSpots * 2 - pausedSpots * 8 - failedPaymentCount * 4)),
      detail: `${activeSpots} active spots, ${pausedSpots} paused spots, ${failedPaymentCount} payment blockers.`,
      weakSpot: pausedSpots > 0 || failedPaymentCount > 0 ? "Renewal or payment friction can weaken retention." : "Retention signals are stable.",
      nextAction: "Review renewals and payment blockers.",
      href: "/admin/founding",
    },
    {
      id: "neighborhood-saturation",
      label: "Neighborhood saturation",
      score: clampScore(46 + firstNumber(activeTargetedRows, "n") * 8 + activeMapPlanCount * 4 + activeSpots),
      status: statusFromScore(clampScore(46 + firstNumber(activeTargetedRows, "n") * 8 + activeMapPlanCount * 4 + activeSpots)),
      detail: `${firstNumber(activeTargetedRows, "n")} targeted campaigns and ${activeMapPlanCount} coverage plans.`,
      weakSpot: "Saturation improves when repeat touches, maps, and postcard timing are planned together.",
      nextAction: "Open targeted campaigns.",
      href: "/admin/targeted-campaigns",
    },
  ];

  const businessHealthScore = clampScore(
    healthDimensions.reduce((total, dimension) => total + dimension.score, 0) / healthDimensions.length,
  );
  const businessHealth = {
    score: businessHealthScore,
    trend: businessHealthScore >= 78 ? "improving" as const : businessHealthScore >= 58 ? "steady" as const : "needs_attention" as const,
    summary:
      businessHealthScore >= 78
        ? "The operating rhythm is strong. Keep revenue, follow-up, reviews, SEO, and renewals moving together."
        : businessHealthScore >= 58
          ? "The business has usable operating visibility, with a few weak spots worth tightening this week."
          : "HomeReach OS found several places where revenue, visibility, or operations can leak if they are not handled.",
    dimensions: healthDimensions,
    weakSpots: healthDimensions
      .filter((dimension) => dimension.score < 72)
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map((dimension) => `${dimension.label}: ${dimension.weakSpot}`),
    opportunities: [
      "Turn the next campaign into a monthly visibility plan instead of a one-time order.",
      "Use map and postcard visuals in proposals so value is obvious before checkout.",
      "Route every reply, review request, and renewal into the same follow-up rhythm.",
    ],
  };

  const moneyLeaks: OSMoneyLeak[] = [
    failedPaymentCount > 0
      ? {
          id: "failed-payment-leak",
          title: "Payment leakage",
          issue: `${failedPaymentCount} failed, paused, refunded, or canceled payment records need review.`,
          estimatedImpact: formatMoney(pendingOrderValueCents + pendingPoliticalValueCents),
          recommendedAction: "Resolve payment blockers before production or renewal work expands.",
          relatedSolution: "Revenue Integrity Agent",
          actionLabel: "Open orders",
          href: "/admin/orders",
          status: "critical",
          severity: "High",
        }
      : null,
    staleLeadCount > 0
      ? {
          id: "missed-followup-leak",
          title: "Missed follow-up",
          issue: `${staleLeadCount} contacted leads are past the follow-up window.`,
          estimatedImpact: formatMoney(staleLeadCount * 35000),
          recommendedAction: "Send a short recovery touch and schedule the next step.",
          relatedSolution: "Follow-Up Agent",
          actionLabel: "Open sales engine",
          href: "/admin/sales-engine",
          status: "watch",
          severity: "Medium",
        }
      : null,
    pendingPurchasingActions > 0
      ? {
          id: "procurement-savings-leak",
          title: "Purchasing savings leakage",
          issue: `${pendingPurchasingActions} smart-buy or supplier actions are waiting for approval.`,
          estimatedImpact: formatMoney(pendingPurchasingActions * 25000),
          recommendedAction: "Approve, edit, or dismiss the savings recommendation while pricing is fresh.",
          relatedSolution: "Procurement Agent",
          actionLabel: "Open procurement",
          href: "/admin/procurement",
          status: "watch",
          severity: "Medium",
        }
      : null,
    activeCampaignCount === 0
      ? {
          id: "inactive-campaign-leak",
          title: "Inactive visibility",
          issue: "No active campaign rhythm is visible in the command snapshot.",
          estimatedImpact: "Pipeline risk",
          recommendedAction: "Create a monthly visibility plan with shared postcards, targeted routes, or SEO pages.",
          relatedSolution: "Marketing Agent",
          actionLabel: "Open campaigns",
          href: "/admin/campaigns",
          status: "watch",
          severity: "Medium",
        }
      : null,
    reviewBaselineScore < 72
      ? {
          id: "review-velocity-leak",
          title: "Review activity gap",
          issue: "Reputation workflows exist, but live review velocity is not yet part of the command score.",
          estimatedImpact: "Local trust risk",
          recommendedAction: "Connect review collection to completed jobs and renewals.",
          relatedSolution: "Reputation Agent",
          actionLabel: "Open reviews",
          href: "/admin/reviews",
          status: "watch",
          severity: "Medium",
        }
      : null,
    {
      id: "seo-analytics-leak",
      title: "Search visibility blind spot",
      issue: "The SEO authority engine is built, but live Search Console and analytics data are not connected yet.",
      estimatedImpact: "Inbound lead visibility",
      recommendedAction: "Connect ranking, traffic, and conversion data before making live SEO performance claims.",
      relatedSolution: "SEO Agent",
      actionLabel: "Open SEO Command Center",
      href: "/admin/marketing/seo-command-center",
      status: "watch",
      severity: "Medium",
    },
  ].filter((item): item is OSMoneyLeak => Boolean(item));

  const digitalEmployees: OSDigitalEmployee[] = [
    {
      name: "Marketing Agent",
      domain: "Visibility",
      promise: "Keeps the business visible with the next campaign, route, or seasonal offer.",
      ownerSees: "HomeReach is helping me stay visible.",
      watches: ["campaign cadence", "route coverage", "seasonal timing", "upsell fit"],
      recommends: activeCampaignCount > 0 ? "Review next-drop timing and renewal offers." : "Create a monthly visibility plan.",
      nextAction: "Open campaign operations.",
      href: "/admin/campaigns",
      status: activeCampaignCount > 0 ? "online" : "watch",
      approvalRequired: false,
    },
    {
      name: "Procurement Agent",
      domain: "Savings",
      promise: "Finds overspending, reorder timing, and supplier savings opportunities.",
      ownerSees: "HomeReach is helping me save money.",
      watches: ["supplier pricing", "inventory risk", "approval backlog", "vendor reliability"],
      recommends: pendingPurchasingActions > 0 ? "Review pending smart-buy actions." : "Keep supplier snapshots fresh.",
      nextAction: "Open procurement.",
      href: "/operations-copilot",
      status: pendingPurchasingActions > 0 ? "watch" : "online",
      approvalRequired: true,
    },
    {
      name: "SEO Agent",
      domain: "Local search",
      promise: "Finds search opportunities so more customers can discover the business.",
      ownerSees: "HomeReach is helping customers find me.",
      watches: ["authority pages", "keyword targets", "visual assets", "analytics readiness"],
      recommends: `${seoSnapshot.totals.keywordTargets} keyword targets are ready for review-first growth.`,
      nextAction: "Open SEO Command Center.",
      href: "/admin/marketing/seo-command-center",
      status: "online",
      approvalRequired: true,
    },
    {
      name: "Follow-Up Agent",
      domain: "Customer follow-up",
      promise: "Keeps leads, proposals, replies, and renewals from slipping.",
      ownerSees: "HomeReach helps me stay on top of customers.",
      watches: ["unread replies", "stale leads", "proposal timing", "renewal reminders"],
      recommends: pendingReplyCount + staleLeadCount > 0 ? "Work the follow-up queue today." : "Keep the response rhythm active.",
      nextAction: "Open inbox.",
      href: "/admin/inbox",
      status: pendingReplyCount + staleLeadCount > 0 ? "watch" : "online",
      approvalRequired: false,
    },
    {
      name: "Reputation Agent",
      domain: "Reviews",
      promise: "Protects local trust through review requests, response timing, and sentiment checks.",
      ownerSees: "HomeReach helps protect my reputation.",
      watches: ["review requests", "sentiment", "response gaps", "local trust signals"],
      recommends: "Tie review requests to completed jobs and renewal touchpoints.",
      nextAction: "Open reviews.",
      href: "/admin/reviews",
      status: "watch",
      approvalRequired: true,
    },
    {
      name: "Sales Agent",
      domain: "Revenue",
      promise: "Prioritizes leads, proposals, and upsells so the next sale is clearer.",
      ownerSees: "HomeReach helps me grow revenue.",
      watches: ["hot leads", "proposal views", "payment status", "upsell fit"],
      recommends: pendingProposalCount > 0 ? "Follow up on the proposal queue." : "Work the highest-scored lead.",
      nextAction: "Open sales dashboard.",
      href: "/admin/sales-dashboard",
      status: firstNumber(hotSalesLeadsRows, "n") + pendingProposalCount > 0 ? "watch" : "online",
      approvalRequired: false,
    },
    {
      name: "Political Outreach Agent",
      domain: "Campaign mail",
      promise: "Identifies campaign opportunities and recommends outreach packages with maps and mockups.",
      ownerSees: "HomeReach is finding campaign opportunities.",
      watches: ["candidate records", "campaign timing", "proposal readiness", "map packages"],
      recommends: "Contact Tier 1 opportunities with a map and postcard concept.",
      nextAction: "Open political outreach.",
      href: "/admin/political/outreach-strategy",
      status: politicalOpportunityCount > 0 ? "watch" : "idle",
      approvalRequired: true,
    },
    {
      name: "Creative Agent",
      domain: "Visual proof",
      promise: "Turns offers into postcard, map, proposal, and savings visuals.",
      ownerSees: "HomeReach makes my marketing easy to understand.",
      watches: ["proof queue", "proposal visuals", "Canva handoff", "approval status"],
      recommends: designApprovalCount > 0 ? "Clear proof approvals before the next mail window." : "Attach visuals to the next proposal.",
      nextAction: "Open Canva Design OS.",
      href: "/admin/canva",
      status: designApprovalCount > 0 ? "watch" : "online",
      approvalRequired: true,
    },
    {
      name: "Fulfillment Agent",
      domain: "Execution",
      promise: "Keeps intake, proof, print-ready, vendor, mail, and delivery status visible.",
      ownerSees: "HomeReach is keeping the work moving.",
      watches: ["intake", "payment", "proof", "print-ready", "mail schedule"],
      recommends: "Review open print jobs and scheduled drops.",
      nextAction: "Open campaigns.",
      href: "/admin/campaigns",
      status: firstNumber(printJobRows, "n") + firstNumber(scheduledMailRows, "n") > 0 ? "watch" : "online",
      approvalRequired: false,
    },
    {
      name: "Revenue Integrity Agent",
      domain: "Money path",
      promise: "Finds payment blockers, missed renewals, and pipeline leakage.",
      ownerSees: "HomeReach keeps my money path organized.",
      watches: ["failed payments", "pending orders", "paused subscriptions", "checkout gaps"],
      recommends: failedPaymentCount > 0 ? "Fix payment blockers first." : "Monitor pending payments and renewals.",
      nextAction: "Open orders.",
      href: "/admin/orders",
      status: failedPaymentCount > 0 ? "critical" : "online",
      approvalRequired: true,
    },
    {
      name: "Customer Retention Agent",
      domain: "Renewals",
      promise: "Turns wins into renewals, upsells, reviews, and repeat campaigns.",
      ownerSees: "HomeReach helps keep customers coming back.",
      watches: ["renewal timing", "inactive customers", "review opportunities", "next product fit"],
      recommends: "Bundle campaign status, review request, and next offer into the next customer touch.",
      nextAction: "Open businesses.",
      href: "/admin/businesses",
      status: pausedSpots > 0 ? "watch" : "online",
      approvalRequired: false,
    },
  ];

  const industryPlaybooks: OSIndustryPlaybook[] = [
    {
      industry: "Roofing",
      systemName: "Roofing Growth System",
      focus: "Storm season, emergency repairs, roof replacements, and neighborhood proof.",
      campaignStrategy: "Run route-level saturation around older housing pockets and recent storm paths.",
      targetingStrategy: "Use city, route, home age, and neighborhood density signals.",
      seoRecommendation: "Build city pages around roofing marketing, storm damage mail, and neighborhood visibility.",
      procurementRecommendation: "Monitor common material, dumpster, fuel, and subcontractor cost categories.",
      seasonalRecommendation: "Push spring inspection and post-storm follow-up campaigns.",
      retentionMove: "Request reviews after completed roof jobs and schedule annual check-in mail.",
      href: "/ohio/akron/roofing-marketing",
      status: "online",
    },
    {
      industry: "HVAC",
      systemName: "HVAC Growth System",
      focus: "Seasonal tune-ups, replacement urgency, service memberships, and review velocity.",
      campaignStrategy: "Mail before heating and cooling peaks with simple maintenance CTAs.",
      targetingStrategy: "Prioritize dense owner-occupied routes and repeat-touch neighborhoods.",
      seoRecommendation: "Create HVAC postcard and direct mail pages by city.",
      procurementRecommendation: "Track filters, refrigerant, service materials, and recurring vendor prices.",
      seasonalRecommendation: "Run spring AC and fall furnace tune-up offers.",
      retentionMove: "Convert service calls into review requests and maintenance reminders.",
      href: "/ohio/akron/hvac-postcards",
      status: "online",
    },
    {
      industry: "Landscaping",
      systemName: "Landscaping Growth System",
      focus: "Recurring maintenance, seasonal cleanups, lawn care, and route density.",
      campaignStrategy: "Dominate clustered neighborhoods where crews can serve multiple homes efficiently.",
      targetingStrategy: "Use route density and city-level property signals.",
      seoRecommendation: "Build lawn care advertising and neighborhood saturation pages.",
      procurementRecommendation: "Watch mulch, fuel, seed, fertilizer, and equipment supply pricing.",
      seasonalRecommendation: "Promote spring cleanup, summer mowing, and fall leaf campaigns.",
      retentionMove: "Turn one-time jobs into monthly route plans.",
      href: "/ohio/dayton/lawn-care-advertising",
      status: "online",
    },
    {
      industry: "Realtor",
      systemName: "Realtor Growth System",
      focus: "Neighborhood farming, listing visibility, just-sold proof, and repeat presence.",
      campaignStrategy: "Use route farming with consistent postcard identity and listing proof.",
      targetingStrategy: "Prioritize neighborhoods with ownership turnover and clear geographic identity.",
      seoRecommendation: "Build realtor postcard and neighborhood farming authority pages.",
      procurementRecommendation: "Bundle signs, business cards, and postcard packages for repeat use.",
      seasonalRecommendation: "Plan spring listing season and fall inventory update mail.",
      retentionMove: "Keep past-client touchpoints and review requests visible.",
      href: "/ohio/cleveland/realtor-postcards",
      status: "online",
    },
    {
      industry: "Restaurant",
      systemName: "Restaurant Growth System",
      focus: "Neighborhood awareness, offers, menu drops, reviews, and local loyalty.",
      campaignStrategy: "Use shared postcards and door hangers for nearby household reach.",
      targetingStrategy: "Target tight trade-area routes and repeat delivery zones.",
      seoRecommendation: "Create local restaurant marketing and menu mailer pages.",
      procurementRecommendation: "Monitor paper goods, food categories, packaging, and supplier changes.",
      seasonalRecommendation: "Run catering, holiday, patio, and back-to-school offers.",
      retentionMove: "Request reviews after catering or high-value orders.",
      href: "/shared-postcards",
      status: "online",
    },
    {
      industry: "Pizza Shop",
      systemName: "Pizza Shop Growth System",
      focus: "Delivery-zone awareness, repeat coupons, game days, schools, and family ordering.",
      campaignStrategy: "Mail high-frequency offers to dense routes inside delivery range.",
      targetingStrategy: "Focus on delivery zones, family neighborhoods, and school-adjacent routes.",
      seoRecommendation: "Build pizza shop advertising and local coupon strategy content.",
      procurementRecommendation: "Watch boxes, cheese, flour, sauce, and third-party delivery cost pressure.",
      seasonalRecommendation: "Run football, school, graduation, and holiday party campaigns.",
      retentionMove: "Convert coupon responders into review and SMS list opportunities.",
      href: "/shared-postcards",
      status: "online",
    },
    {
      industry: "Political Campaign",
      systemName: "Political Campaign System",
      focus: "Geographic campaign mail, postcard waves, turnout, persuasion, and visual proposals.",
      campaignStrategy: "Build persuasion, absentee, early vote, and GOTV mail waves by district geography.",
      targetingStrategy: "Use geography, office level, district boundaries, timing, and logistics only.",
      seoRecommendation: "Expand political mail pages by county, office type, and postcard type.",
      procurementRecommendation: "Track print, postage, signs, and campaign material cost assumptions.",
      seasonalRecommendation: "Work backward from filing, absentee, early vote, and Election Day dates.",
      retentionMove: "Turn campaign wins into case studies and county authority pages.",
      href: "/admin/political/outreach-strategy",
      status: politicalOpportunityCount > 0 ? "watch" : "online",
    },
  ];

  const membershipPlans: OSMembershipPlan[] = [
    {
      name: "Monthly Visibility Plan",
      cadence: "Monthly",
      bestFor: "Local businesses that need consistent neighborhood presence.",
      includes: ["shared postcards", "next-drop planning", "renewal reminders", "simple reporting"],
      outcome: "Stay visible year-round without rebuilding a campaign every month.",
      priceSignal: "Recurring visibility",
      href: "/admin/spots",
      status: "online",
    },
    {
      name: "SEO Visibility Plan",
      cadence: "Monthly",
      bestFor: "Businesses that want inbound search growth without managing content systems.",
      includes: ["city pages", "authority content", "visual metadata", "review-first publishing"],
      outcome: "Help customers find the business through local search.",
      priceSignal: "Recurring authority",
      href: "/admin/marketing/seo-command-center",
      status: "online",
    },
    {
      name: "Procurement Monitoring",
      cadence: "Monthly",
      bestFor: "Businesses with recurring supplier or inventory spend.",
      includes: ["price snapshots", "savings alerts", "smart-buy approvals", "vendor visibility"],
      outcome: "Reduce overspending and catch reorder risk earlier.",
      priceSignal: "Savings-backed",
      href: "/operations-copilot",
      status: "online",
    },
    {
      name: "Review and Follow-Up Plan",
      cadence: "Monthly",
      bestFor: "Owners who lose time chasing replies, reviews, and stale leads.",
      includes: ["follow-up reminders", "review requests", "suggested responses", "retention nudges"],
      outcome: "Keep customer communication from slipping.",
      priceSignal: "Retention engine",
      href: "/admin/inbox",
      status: pendingReplyCount + staleLeadCount > 0 ? "watch" : "online",
    },
    {
      name: "Local Domination Plan",
      cadence: "Quarterly",
      bestFor: "Businesses that want to own a city, neighborhood, or route cluster.",
      includes: ["targeted campaigns", "coverage maps", "postcard cadence", "proposal visuals"],
      outcome: "Become the local business people remember.",
      priceSignal: "Premium growth",
      href: "/admin/targeted-campaigns",
      status: "online",
    },
  ];

  const communityLoops: OSCommunityLoop[] = [
    {
      title: "Featured business spotlights",
      detail: "Turn active clients into city showcases and proof snapshots.",
      trustSignal: "Local familiarity",
      nextAction: "Identify the next client story from active campaigns.",
      href: "/admin/businesses",
      status: activeCampaignCount > 0 ? "online" : "idle",
    },
    {
      title: "City success stories",
      detail: "Use campaign maps, postcard visuals, and outcomes to support local authority pages.",
      trustSignal: "Geo-specific proof",
      nextAction: "Connect case studies to city SEO clusters.",
      href: "/case-studies",
      status: "online",
    },
    {
      title: "Shared campaign visibility",
      detail: "Show category-exclusive businesses how shared campaigns build repeated local recognition.",
      trustSignal: "Network effect",
      nextAction: "Invite complementary categories into open city routes.",
      href: "/admin/spots",
      status: pendingSpots > 0 ? "watch" : "online",
    },
    {
      title: "Local review flywheel",
      detail: "Completed jobs should feed review requests, testimonials, and local proof.",
      trustSignal: "Reputation compounding",
      nextAction: "Attach review requests to fulfillment completion.",
      href: "/admin/reviews",
      status: "watch",
    },
  ];

  const nextBestActions = [
    failedPaymentCount > 0
      ? action({
          id: "payment-blockers",
          title: "Fix payment blockers first",
          outcome: `${failedPaymentCount} payment records need review before fulfillment expands.`,
          reason: "Failed, paused, refunded, or canceled payment records can leak revenue or create fulfillment confusion.",
          ifIgnored: "Orders may stay stuck, customers may need manual follow-up, and production can move without clean payment status.",
          actionLabel: "Open orders",
          href: "/admin/orders",
          confidence: 96,
          urgency: 98,
          impact: "Protects revenue and fulfillment accuracy",
          risk: "High",
          status: "critical",
          category: "revenue",
        })
      : null,
    pendingReplyCount > 0
      ? action({
          id: "reply-now",
          title: "Reply to waiting conversations",
          outcome: `${pendingReplyCount} unread customer or campaign replies are waiting.`,
          reason: "Fast responses are usually the shortest path to booked calls, proposal approvals, and payment completion.",
          ifIgnored: "Warm leads cool off and political or business opportunities can stall in the inbox.",
          actionLabel: "Open inbox",
          href: "/admin/inbox",
          confidence: 92,
          urgency: 94,
          impact: "Improves conversion speed",
          risk: "Medium",
          status: "watch",
          category: "communications",
        })
      : null,
    candidateApprovalNeededCount > 0
      ? action({
          id: "candidate-plan-approval",
          title: "Review candidate launch plans",
          outcome: `${candidateApprovalNeededCount} political launch plan${candidateApprovalNeededCount === 1 ? "" : "s"} need human approval.`,
          reason: "Candidate agents can draft plans, but political proposals, creative, and production need human review before client-facing use.",
          ifIgnored: "Campaign opportunities remain stuck before proposal, checkout, or production handoff.",
          actionLabel: "Open candidate agents",
          href: "/admin/political/candidate-agent",
          confidence: 88,
          urgency: 87,
          impact: "Moves political opportunities toward proposal readiness",
          risk: "Medium",
          status: "watch",
          category: "political",
        })
      : null,
    pendingPurchasingActions > 0
      ? action({
          id: "procurement-approvals",
          title: "Approve or edit smart buys",
          outcome: `${pendingPurchasingActions} procurement action${pendingPurchasingActions === 1 ? "" : "s"} need a decision.`,
          reason: "Operations Copilot found supplier, inventory, or savings actions that are waiting for owner/admin approval.",
          ifIgnored: "Savings can expire, inventory risk can rise, and vendor issues may continue unnoticed.",
          actionLabel: "Open procurement",
          href: "/admin/procurement",
          confidence: 86,
          urgency: 82,
          impact: "Protects margin and reduces purchasing delay",
          risk: "Low",
          status: "watch",
          category: "procurement",
        })
      : null,
    designApprovalCount > 0
      ? action({
          id: "design-approvals",
          title: "Clear design approvals",
          outcome: `${designApprovalCount} design-ready campaign${designApprovalCount === 1 ? "" : "s"} can move forward.`,
          reason: "Approved proofs keep print, mail-drop, and postcard production schedules moving.",
          ifIgnored: "Mail windows can slip and customers may lose confidence in the launch timeline.",
          actionLabel: "Open targeted campaigns",
          href: "/admin/targeted-campaigns",
          confidence: 84,
          urgency: 78,
          impact: "Compresses launch time",
          risk: "Medium",
          status: "watch",
          category: "creative",
        })
      : null,
    staleLeadCount > 0
      ? action({
          id: "stale-followups",
          title: "Recover stale follow-ups",
          outcome: `${staleLeadCount} contacted leads are past the follow-up window.`,
          reason: "These leads already entered the funnel, so a short recovery touch is faster than starting cold.",
          ifIgnored: "Pipeline value decays and sales activity looks busier than it is productive.",
          actionLabel: "Open sales engine",
          href: "/admin/sales-engine",
          confidence: 80,
          urgency: 75,
          impact: "Recovers near-term pipeline",
          risk: "Low",
          status: "watch",
          category: "communications",
        })
      : null,
    pendingProposalCount > 0
      ? action({
          id: "proposal-review",
          title: "Review proposal queue",
          outcome: `${pendingProposalCount} proposal${pendingProposalCount === 1 ? "" : "s"} are draft, sent, or viewed.`,
          reason: "Viewed and draft proposals are often the closest bridge from strategy to payment.",
          ifIgnored: "Proposal momentum can fade before approval or checkout.",
          actionLabel: "Open proposals",
          href: "/admin/political/proposals",
          confidence: 82,
          urgency: 72,
          impact: "Improves proposal-to-payment speed",
          risk: "Medium",
          status: pendingProposalCount > 0 ? "watch" : "online",
          category: "revenue",
        })
      : null,
    activeMapPlanCount > 0
      ? action({
          id: "map-plan-review",
          title: "Review route and map plans",
          outcome: `${activeMapPlanCount} synchronized map plan${activeMapPlanCount === 1 ? "" : "s"} need pricing, approval, or readiness review.`,
          reason: "Geography, route counts, and pricing should be checked before proposal or checkout.",
          ifIgnored: "Campaign quotes may stay blocked or remain too uncertain to sell confidently.",
          actionLabel: "Open maps",
          href: "/admin/political/maps",
          confidence: 78,
          urgency: 69,
          impact: "Improves quoting confidence",
          risk: "Medium",
          status: "watch",
          category: "operations",
        })
      : null,
    providerExceptionCount > 0
      ? action({
          id: "provider-health",
          title: "Check provider health",
          outcome: `${providerExceptionCount} Twilio or email provider exception${providerExceptionCount === 1 ? "" : "s"} appeared in the last 30 days.`,
          reason: "Deliverability issues can quietly reduce outreach performance and hide customer responses.",
          ifIgnored: "Messages may fail or domain/number health can degrade before anyone notices.",
          actionLabel: "Open control center",
          href: "/admin/control-center",
          confidence: 76,
          urgency: 66,
          impact: "Protects deliverability",
          risk: "Medium",
          status: "watch",
          category: "operations",
        })
      : null,
    pendingPaymentCount > 0 && failedPaymentCount === 0
      ? action({
          id: "pending-payments",
          title: "Move pending payments forward",
          outcome: `${pendingPaymentCount} checkout or political payment${pendingPaymentCount === 1 ? "" : "s"} are pending.`,
          reason: "Pending payments are near-revenue actions and should be watched before production commitments.",
          ifIgnored: "Deals can sit unpaid while operations assume they are ready.",
          actionLabel: "Open orders",
          href: "/admin/orders",
          confidence: 83,
          urgency: 70,
          impact: "Improves cash collection",
          risk: "Medium",
          status: "watch",
          category: "revenue",
        })
      : null,
    action({
      id: "daily-command-review",
      title: "Review the command pulse",
      outcome: "Use the HomeReach OS snapshot to decide the day without opening every subsystem.",
      reason: "The simplest operating rhythm is to review revenue, replies, approvals, alerts, and AI queues from one page.",
      ifIgnored: "Work can spread across too many dashboards and important blockers become harder to see.",
      actionLabel: "Stay in command center",
      href: "/admin",
      confidence: 90,
      urgency: operationsAlertCount > 0 ? 65 : 45,
      impact: "Keeps the day focused",
      risk: "Low",
      status: operationsAlertCount > 0 ? "watch" : "online",
      category: "operations",
    }),
  ]
    .filter((item): item is OSNextBestAction => Boolean(item))
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 6);

  const commandCards = [
    {
      id: "today-revenue",
      title: "Today's revenue opportunities",
      segment: "revenue",
      value: formatMoney(weightedPipelineCents),
      detail: `${pendingPaymentCount} pending payments, ${pendingProposalCount} proposals, ${failedPaymentCount} payment blockers.`,
      nextAction: failedPaymentCount > 0 ? "Fix payment blockers before fulfillment." : "Work the highest-value proposal or payment follow-up.",
      href: "/admin/revenue-operations",
      status: failedPaymentCount > 0 ? "critical" : pendingPaymentCount > 0 || pendingProposalCount > 0 ? "watch" : "online",
      priority: failedPaymentCount > 0 ? 100 : 82,
    },
    {
      id: "political-outreach",
      title: "Political campaigns to contact",
      segment: "political",
      value: String(politicalOpportunityCount),
      detail: `${candidateAgentCount} campaign agents, ${candidatePlanCount} launch plans, ${candidateApprovalNeededCount} approvals.`,
      nextAction: "Open Outreach Strategy and contact the next Tier 1 campaign with a map/mockup package.",
      href: "/admin/political/outreach-strategy",
      status: candidateApprovalNeededCount > 0 || politicalOpportunityCount > 0 ? "watch" : "idle",
      priority: 90,
    },
    {
      id: "shared-postcards",
      title: "Shared postcard prospects",
      segment: "shared_postcards",
      value: String(websiteInquiryCount + pendingSpots),
      detail: `${activeSpots} active spots, ${pendingSpots} pending spots, ${websiteInquiryCount} website/waitlist inquiries today.`,
      nextAction: "Contact waitlist and pending spot owners with a reserve-my-spot CTA.",
      href: "/admin/spots",
      status: pendingSpots > 0 ? "watch" : "online",
      priority: 76,
    },
    {
      id: "targeted-campaigns",
      title: "Targeted campaign prospects",
      segment: "targeted_campaigns",
      value: String(routeOpportunityCount + firstNumber(activeTargetedRows, "n")),
      detail: `${firstNumber(activeTargetedRows, "n")} active route campaigns, ${designApprovalCount} proof approvals.`,
      nextAction: designApprovalCount > 0 ? "Clear proof approvals and move campaigns to mail scheduling." : "Package route-map visuals for the next targeted prospect.",
      href: "/admin/targeted-campaigns",
      status: designApprovalCount > 0 ? "watch" : "online",
      priority: 73,
    },
    {
      id: "procurement-leads",
      title: "Procurement dashboard leads",
      segment: "procurement",
      value: String(pendingPurchasingActions),
      detail: `${firstNumber(activeInventoryRows, "n")} inventory items, ${firstNumber(activeSupplierRows, "n")} suppliers, ${firstNumber(priceSnapshotRows, "n")} price snapshots.`,
      nextAction: pendingPurchasingActions > 0 ? "Approve or edit smart buys." : "Send a savings snapshot to the best procurement prospect.",
      href: "/admin/procurement",
      status: pendingPurchasingActions > 0 ? "watch" : "online",
      priority: 70,
    },
    {
      id: "sam-gov",
      title: "SAM.gov opportunities",
      segment: "gov_contracts",
      value: "Live",
      detail: "Search, fit scoring, bid/no-bid recommendation, bid rooms, and compliance locks are admin-only.",
      nextAction: "Open Gov Contracts and triage the strongest fit before any bid commitment.",
      href: "/admin/gov-contracts",
      status: "online",
      priority: 68,
    },
    {
      id: "followups-due",
      title: "Follow-ups due",
      segment: "client_success",
      value: String(staleLeadCount + pendingReplyCount),
      detail: `${staleLeadCount} stale leads and ${pendingReplyCount} unread replies need action.`,
      nextAction: "Use the universal outreach engine: email, text, call, DM copy, and schedule next touch.",
      href: "/admin/inbox",
      status: staleLeadCount + pendingReplyCount > 0 ? "watch" : "online",
      priority: 88,
    },
    {
      id: "creative-queue",
      title: "Creative and proof queue",
      segment: "creative",
      value: String(designApprovalCount + firstNumber(draftRows, "n")),
      detail: `${designApprovalCount} proofs and ${firstNumber(draftRows, "n")} AI drafts should attach to proposals/outreach.`,
      nextAction: "Open Canva/Ad Designer and attach proof-ready visuals to proposals.",
      href: "/admin/canva",
      status: designApprovalCount + firstNumber(draftRows, "n") > 0 ? "watch" : "online",
      priority: 67,
    },
    {
      id: "fulfillment-visibility",
      title: "Fulfillment visibility",
      segment: "fulfillment",
      value: String(firstNumber(printJobRows, "n") + firstNumber(scheduledMailRows, "n") + firstNumber(politicalOrderProductionRows, "n")),
      detail: `${firstNumber(printJobRows, "n")} print jobs, ${firstNumber(scheduledMailRows, "n")} scheduled drops, ${firstNumber(politicalOrderProductionRows, "n")} political orders in production.`,
      nextAction: "Check proof, print-ready, vendor, mail schedule, and delivery confirmation status.",
      href: "/admin/campaigns",
      status: firstNumber(printJobRows, "n") + firstNumber(politicalOrderProductionRows, "n") > 0 ? "watch" : "online",
      priority: 66,
    },
  ] satisfies OSCommandCard[];

  commandCards.sort((a, b) => b.priority - a.priority);

  const specializedAgents: OSSpecializedAgent[] = [
    {
      name: "Political Outreach Agent",
      domain: "Campaign mail",
      found: `${politicalOpportunityCount} active candidate/campaign opportunities`,
      recommends: "Prioritize Tier 1 outreach with Ohio map, postcard mockup, proposal option, and manual approval.",
      draftsCreated: firstNumber(draftRows, "n") + candidatePlanCount,
      nextAction: "Open political outreach strategy.",
      approvalRequired: true,
      revenueImpact: formatMoney(politicalOpportunityCount * 125000),
      status: politicalOpportunityCount > 0 ? "watch" : "idle",
      href: "/admin/political/outreach-strategy",
    },
    {
      name: "Shared Postcard Sales Agent",
      domain: "Local business spots",
      found: `${pendingSpots} pending/reserved shared spots`,
      recommends: "Recover pending spots and waitlist prospects with reserve-my-spot messaging.",
      draftsCreated: firstNumber(draftRows, "n"),
      nextAction: "Open shared postcard inventory.",
      approvalRequired: false,
      revenueImpact: formatMoney(Math.max(1, pendingSpots) * 9900),
      status: pendingSpots > 0 ? "watch" : "online",
      href: "/admin/spots",
    },
    {
      name: "Targeted Campaign Agent",
      domain: "Route campaigns",
      found: `${routeOpportunityCount} route opportunities and ${designApprovalCount} design approvals`,
      recommends: "Attach route maps, proof visuals, and payment CTA to the next targeted proposal.",
      draftsCreated: designApprovalCount,
      nextAction: "Open targeted campaigns.",
      approvalRequired: designApprovalCount > 0,
      revenueImpact: formatMoney(Math.max(1, routeOpportunityCount) * 40000),
      status: designApprovalCount > 0 ? "watch" : "online",
      href: "/admin/targeted-campaigns",
    },
    {
      name: "Procurement Sales Agent",
      domain: "Inventory savings",
      found: `${pendingPurchasingActions} procurement approvals or smart-buy actions`,
      recommends: "Use savings snapshots as the outreach visual for procurement dashboard prospects.",
      draftsCreated: pendingPurchasingActions,
      nextAction: "Open procurement.",
      approvalRequired: true,
      revenueImpact: formatMoney(Math.max(1, pendingPurchasingActions) * 25000),
      status: pendingPurchasingActions > 0 ? "watch" : "online",
      href: "/admin/procurement",
    },
    {
      name: "Government Contract Agent",
      domain: "SAM.gov pipeline",
      found: "Fit scoring and bid-room workflow are available",
      recommends: "Review strong-fit opportunities and draft capability/outreach materials before bid/no-bid.",
      draftsCreated: 0,
      nextAction: "Open gov contracts.",
      approvalRequired: true,
      revenueImpact: "Pipeline TBD",
      status: "online",
      href: "/admin/gov-contracts",
    },
    {
      name: "Creative Design Agent",
      domain: "Visual proof engine",
      found: `${designApprovalCount} proof or creative review items`,
      recommends: "Create postcard, map, savings snapshot, and proposal visuals in Canva/Figma-ready packages.",
      draftsCreated: firstNumber(draftRows, "n"),
      nextAction: "Open Canva Design OS.",
      approvalRequired: true,
      revenueImpact: "Improves proposal conversion",
      status: designApprovalCount > 0 ? "watch" : "online",
      href: "/admin/canva",
    },
    {
      name: "Follow-Up Agent",
      domain: "Universal outreach",
      found: `${staleLeadCount} stale follow-ups and ${pendingReplyCount} pending replies`,
      recommends: "Run the cadence engine: Day 0 DM, Day 2 email, Day 5 call, Day 7 proposal, Day 10 LinkedIn.",
      draftsCreated: firstNumber(draftRows, "n"),
      nextAction: "Open inbox.",
      approvalRequired: false,
      revenueImpact: "Recovers warm pipeline",
      status: staleLeadCount + pendingReplyCount > 0 ? "watch" : "online",
      href: "/admin/inbox",
    },
    {
      name: "Revenue Integrity Agent",
      domain: "Payments and leakage",
      found: `${failedPaymentCount} failed/paused payment blockers`,
      recommends: "Resolve payment blockers before production, fulfillment, or renewal actions.",
      draftsCreated: 0,
      nextAction: "Open orders.",
      approvalRequired: true,
      revenueImpact: formatMoney(pendingOrderValueCents + pendingPoliticalValueCents),
      status: failedPaymentCount > 0 ? "critical" : "online",
      href: "/admin/orders",
    },
    {
      name: "Fulfillment Agent",
      domain: "Print and mail execution",
      found: `${firstNumber(printJobRows, "n")} print jobs and ${firstNumber(scheduledMailRows, "n")} scheduled drops`,
      recommends: "Confirm intake, payment, proof, print-ready file, vendor assignment, mail schedule, and delivery status.",
      draftsCreated: 0,
      nextAction: "Open campaign operations.",
      approvalRequired: false,
      revenueImpact: "Protects delivery confidence",
      status: firstNumber(printJobRows, "n") > 0 ? "watch" : "online",
      href: "/admin/campaigns",
    },
    {
      name: "Client Success Agent",
      domain: "Portal, renewals, upsells",
      found: `${activeSpots + firstNumber(activeTargetedRows, "n") + firstNumber(politicalCampaignRows, "n")} active client/campaign records`,
      recommends: "Surface status, proof approvals, delivery timeline, results, renewals, and next-product offer.",
      draftsCreated: 0,
      nextAction: "Open client records.",
      approvalRequired: false,
      revenueImpact: "Improves retention and attach rate",
      status: "online",
      href: "/admin/businesses",
    },
  ];

  const experienceBoundaries: OSExperienceBoundary[] = [
    {
      system: "Homepage and product pages",
      publicExperience: "Premium, simple, outcome-led presentation with direct CTAs.",
      adminExperience: "Revenue OS owns routing, product logic, follow-up, and campaign execution.",
      migrationDecision: "simplify_public" as const,
      href: "/",
    },
    {
      system: "Political maps and campaign planning",
      publicExperience: "Preview maps, campaign options, pricing confidence, and guided plan CTA.",
      adminExperience: "Full district layers, campaign records, outreach strategy, mockups, proposals, compliance, and fulfillment.",
      migrationDecision: "preview_public" as const,
      href: "/admin/political/outreach-strategy",
    },
    {
      system: "Targeted campaign builder",
      publicExperience: "Guided route selection and checkout with minimal controls.",
      adminExperience: "Advanced route operations, proof workflow, fulfillment, production status, and cross-sell tracking.",
      migrationDecision: "keep_public" as const,
      href: "/admin/targeted-campaigns",
    },
    {
      system: "Procurement dashboard",
      publicExperience: "Find savings opportunities and see a clean dashboard preview.",
      adminExperience: "Supplier intelligence, price snapshots, smart buys, approvals, onboarding gaps, and procurement sales signals.",
      migrationDecision: "preview_public" as const,
      href: "/admin/procurement",
    },
    {
      system: "Government contracts",
      publicExperience: "No public complexity; sell as capability and strategy if needed.",
      adminExperience: "SAM.gov search, fit scoring, bid/no-bid, bid rooms, compliance tracking, and deadline management.",
      migrationDecision: "admin_only" as const,
      href: "/admin/gov-contracts",
    },
    {
      system: "AI agents and automation",
      publicExperience: "Done-for-you confidence, not internal orchestration.",
      adminExperience: "Agent findings, drafts, approvals, risks, expected revenue impact, and safety locks.",
      migrationDecision: "admin_only" as const,
      href: "/admin/agents",
    },
    {
      system: "Creative studio and visual proof",
      publicExperience: "Polished postcard, map, savings, and proposal previews.",
      adminExperience: "Canva/Figma handoff, versioning, revisions, approvals, exports, and reusable assets.",
      migrationDecision: "preview_public" as const,
      href: "/admin/canva",
    },
  ];

  const executionLayers: OSExecutionLayer[] = [
    {
      name: "Universal Outreach Engine",
      purpose: "Email, text, DM copy, website form message, phone script, cadence, replies, proposal attachments, and history.",
      currentSource: "Revenue Operations, Inbox, Sales Engine, Political Outreach Strategy",
      publicRole: "Invisible. Customers only see fast, confident follow-up.",
      adminRole: "Daily action layer for every lead and campaign.",
      nextAction: "Use revenue messaging as the canonical log before enabling higher automation.",
      href: "/admin/revenue-operations",
      status: pendingReplyCount + staleLeadCount > 0 ? "watch" : "online",
    },
    {
      name: "Universal Proposal Builder",
      purpose: "Problem, plan, visuals, maps, pricing, timeline, CTA, and payment link across products.",
      currentSource: "Political proposals, targeted campaigns, property intelligence, procurement snapshots",
      publicRole: "Proposal previews and simple CTA.",
      adminRole: "Executive-level proposal assembly and approval workflow.",
      nextAction: "Connect visual assets and map packages to proposal records.",
      href: "/admin/political/proposals",
      status: pendingProposalCount > 0 ? "watch" : "online",
    },
    {
      name: "Visual Proof Engine",
      purpose: "Postcard mockups, route maps, Ohio maps, savings snapshots, dashboard visuals, and before/after proof.",
      currentSource: "Canva Design OS, Ad Designer, Political Creative Mockup Engine, maps",
      publicRole: "Value is visible before buying.",
      adminRole: "Asset generation, versioning, approval, export, and attachment management.",
      nextAction: "Attach mockups/maps to outreach and proposals.",
      href: "/admin/canva",
      status: designApprovalCount > 0 ? "watch" : "online",
    },
    {
      name: "Fulfillment Operations Layer",
      purpose: "Intake, payment, proof, print-ready, vendor, mail schedule, delivery, renewal.",
      currentSource: "Campaign records, targeted routes, political orders, print jobs",
      publicRole: "Simple status and confidence timeline.",
      adminRole: "No order loses visibility across production handoffs.",
      nextAction: "Review print jobs and delivery windows.",
      href: "/admin/campaigns",
      status: firstNumber(printJobRows, "n") + firstNumber(politicalOrderProductionRows, "n") > 0 ? "watch" : "online",
    },
    {
      name: "Product Cross-Sell Intelligence",
      purpose: "Recommend the next offer by current product, geography, campaign stage, and revenue potential.",
      currentSource: "Product ops, businesses, orders, political records, procurement profiles",
      publicRole: "Simple next-step offers.",
      adminRole: "Estimated value, suggested outreach, and visual package recommendations.",
      nextAction: "Use command cards to work the next-product offer.",
      href: "/admin/businesses",
      status: "online",
    },
  ];

  return {
    generatedAt: now.toISOString(),
    revenue: {
      revenueToday: formatMoney(revenueTodayCents),
      mrr: formatMoney(mrrCents),
      arr: formatMoney(mrrCents * 12),
      pendingInvoices: firstNumber(pendingOrdersRows, "n") + firstNumber(pendingPoliticalOrdersRows, "n"),
      pendingProposals: firstNumber(pendingProposalRows, "n"),
      failedPayments: firstNumber(failedOrdersRows, "n") + firstNumber(failedPoliticalOrdersRows, "n") + pausedSpots,
      stripePipeline: formatMoney(pendingOrderValueCents + pendingPoliticalValueCents),
      projectedRevenue: formatMoney(weightedPipelineCents),
      closeProbability,
    },
    leadIntelligence: {
      newLeads: firstNumber(newSalesLeadsRows, "n"),
      hotLeads: firstNumber(hotSalesLeadsRows, "n"),
      staleLeads: firstNumber(staleSalesLeadsRows, "n"),
      aiRanked: firstNumber(aiRankedLeadRows, "n"),
      politicalOpportunities: politicalOpportunityCount,
      businessOpportunities: salesPipelineCount,
      routeOpportunities: routeOpportunityCount,
      opportunities,
    },
    operations: {
      activeCampaigns: firstNumber(activeMarketingRows, "n") + firstNumber(activeTargetedRows, "n") + firstNumber(politicalCampaignRows, "n"),
      printJobs: firstNumber(printJobRows, "n"),
      postcardSchedules: firstNumber(activeMarketingRows, "n") + firstNumber(upcomingMarketingRows, "n"),
      bmeuDrops: firstNumber(scheduledMailRows, "n"),
      designApprovals: firstNumber(designApprovalRows, "n"),
      deliveryWindows: firstNumber(scheduledMailRows, "n") + firstNumber(politicalOrderProductionRows, "n"),
      operationalAlerts: operationsAlertCount,
    },
    communications: {
      unreadTexts: firstNumber(unreadSmsRows, "n"),
      unreadEmails: firstNumber(unreadEmailRows, "n"),
      unreadDms: firstNumber(unreadDmRows, "n"),
      websiteInquiries: firstNumber(websiteInquiryRows, "n"),
      intakeSubmissions: firstNumber(intakeQueueRows, "n"),
      campaignReplies: firstNumber(campaignReplyRows, "n"),
      missedFollowUps: firstNumber(staleSalesLeadsRows, "n"),
      pendingReplies: firstNumber(unreadRepliesRows, "n"),
      conversations: recentConversations,
    },
    ai: {
      actions: firstNumber(opAiEventRows, "n") + firstNumber(opActionRows, "n"),
      leadResearchUpdates: firstNumber(newBusinessRows, "n"),
      newCandidateFilings: firstNumber(newCandidateRows, "n"),
      newBusinessOpportunities: firstNumber(newBusinessRows, "n"),
      scoringChanges: firstNumber(scoringChangeRows, "n"),
      drafts: firstNumber(draftRows, "n"),
      automationStatus: operationsAlertCount > 0 ? "watch" : "online",
      agents,
    },
    productOps,
    maps,
    pipeline,
    performance: {
      textsSent: firstNumber(textsSentRows, "n"),
      emailsSent: firstNumber(emailsSentRows, "n"),
      dmsSent: firstNumber(dmsSentRows, "n"),
      callsMade: firstNumber(callsMadeRows, "n"),
      meetingsBooked: firstNumber(meetingsRows, "n"),
      proposalsSent: firstNumber(proposalsSentRows, "n"),
      dealsClosed: firstNumber(dealsClosedRows, "n"),
      revenueByProduct,
      humanActions: Math.max(0, firstNumber(humanActionsRows, "n") - firstNumber(opAiEventRows, "n")),
      aiActions: firstNumber(opAiEventRows, "n") + firstNumber(opActionRows, "n"),
    },
    automation,
    notifications,
    roleViews: [
      { role: "Admin", href: "/admin", focus: "Global command, revenue, alerts, and governance", status: "online" },
      { role: "Sales", href: "/admin/sales-dashboard", focus: "Pipeline, outreach, proposals, and follow-ups", status: "online" },
      { role: "Operations", href: "/admin/targeted-campaigns", focus: "Campaign execution, print jobs, drops, approvals", status: "online" },
      { role: "Designer", href: "/admin/ad-designer", focus: "Proofs, creative requests, and design approvals", status: firstNumber(designApprovalRows, "n") > 0 ? "watch" : "online" },
      { role: "Client", href: "/dashboard", focus: "Customer campaigns, billing, replies, and results", status: "online" },
      { role: "Political", href: "/admin/political", focus: "Candidate CRM, proposals, maps, and fulfillment", status: politicalOpportunityCount > 0 ? "watch" : "idle" },
      { role: "Purchasing", href: "/operations-copilot", focus: "Supplier intelligence, savings, approvals, inventory", status: firstNumber(opActionRows, "n") > 0 ? "watch" : "online" },
    ],
    activityFeed,
    businessHealth,
    moneyLeaks,
    digitalEmployees,
    industryPlaybooks,
    membershipPlans,
    communityLoops,
    nextBestActions,
    commandCards,
    specializedAgents,
    experienceBoundaries,
    executionLayers,
    audit: [
      "Admin architecture audited: route group at /admin with role-gated layout and existing module pages.",
      "Sales dashboard audited: API-driven sales funnel, leaderboard, insights, and polling client preserved.",
      "Routing audited: /admin is the post-login admin destination; funnel, auth, dashboard, webhook, Stripe, and targeted routes are separate.",
      "Database audited: existing tables cover sales, conversations, shared spots, targeted campaigns, political, maps, inventory, Twilio, Postmark, and orders.",
      "Communication systems audited: existing inbox, sales events, Twilio status webhook, Postmark webhook, and outreach automation remain untouched.",
      "Automation flows audited: automation send-due route, political priority runs, operations copilot actions, and provider observability are surfaced read-only.",
      "Reusable components identified: brand logo, badge, cn utility, sales APIs, conversations API, admin modules, political and operations copilot surfaces.",
      "Public/admin boundary audited: customer pages should show premium previews and guided CTAs while admin owns AI orchestration, outreach, proposals, maps, fulfillment, and compliance.",
      "Government contract system audited: existing /admin/gov-contracts and bid-room flows remain admin-only with compliance locks.",
      "Protected live functionality preserved: no schema migration, payment mutation, webhook, auth, intake, exclusivity, or Stripe/Twilio/Postmark send-path change.",
    ],
  };
}
