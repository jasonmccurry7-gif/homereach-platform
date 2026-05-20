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
  OSMapLayer,
  OSMetric,
  OSNextBestAction,
  OSMonitor,
  OSOpportunity,
  OSPipelineStage,
  OSProductPanel,
  OSStatus,
} from "./types";

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
    nextBestActions,
    audit: [
      "Admin architecture audited: route group at /admin with role-gated layout and existing module pages.",
      "Sales dashboard audited: API-driven sales funnel, leaderboard, insights, and polling client preserved.",
      "Routing audited: /admin is the post-login admin destination; funnel, auth, dashboard, webhook, Stripe, and targeted routes are separate.",
      "Database audited: existing tables cover sales, conversations, shared spots, targeted campaigns, political, maps, inventory, Twilio, Postmark, and orders.",
      "Communication systems audited: existing inbox, sales events, Twilio status webhook, Postmark webhook, and outreach automation remain untouched.",
      "Automation flows audited: automation send-due route, political priority runs, operations copilot actions, and provider observability are surfaced read-only.",
      "Reusable components identified: brand logo, badge, cn utility, sales APIs, conversations API, admin modules, political and operations copilot surfaces.",
      "Protected live functionality preserved: no schema migration, payment mutation, webhook, auth, intake, exclusivity, or Stripe/Twilio/Postmark send-path change.",
    ],
  };
}
