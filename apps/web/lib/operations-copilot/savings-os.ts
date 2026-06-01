import type {
  BestPriceDeliveryBoard,
  BestPriceDeliveryRecommendation,
} from "@/lib/operations-copilot/delivery-intelligence";
import type {
  CopilotSnapshot,
  ProcurementRiskAlert,
  SmartBuyRecommendation,
} from "@/lib/operations-copilot/types";
import type { SupplierCheckoutOption } from "@/lib/operations-copilot/supplier-checkout";
import { buildSupplierCheckoutOptions } from "@/lib/operations-copilot/supplier-checkout";
import { procurementEmotionCopy } from "@/lib/brand/emotional-positioning";

export type OwnerSavingsSnapshot = {
  estimatedMonthlySavingsCents: number;
  estimatedAnnualSavingsCents: number;
  savingsFoundThisWeekCents: number;
  savingsFoundThisMonthCents: number;
  savingsCapturedThisWeekCents: number;
  savingsCapturedThisMonthCents: number;
  savingsCapturedCents: number;
  savingsPendingApprovalCents: number;
  totalSinceEnrollmentCents: number;
  enrolledAtLabel: string;
  lastUpdatedLabel: string;
};

export type OwnerSavingsOpportunity = {
  id: string;
  title: string;
  detail: string;
  projectedSavingsCents: number;
  sourceQuality: "verified" | "observed" | "estimated";
  sourceQualityLabel: string;
  difficulty: "Easy" | "Medium" | "Needs review";
  operationalImpact: "Low" | "Medium" | "High";
  confidence: "Low" | "Medium" | "High";
  actionLabel: string;
  actionType: string;
  payload: Record<string, unknown>;
};

export type OwnerOperationalIssue = {
  id: string;
  title: string;
  detail: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  actionLabel: string;
  actionType: string;
  payload: Record<string, unknown>;
};

export type OwnerDelivery = {
  id: string;
  supplierName: string;
  itemSummary: string;
  status: "Arriving today" | "Delayed" | "Partial" | "Completed" | "Prepared";
  etaLabel: string;
  missingItemsLabel: string;
  actionLabel: string;
  actionType: string;
  payload: Record<string, unknown>;
};

export type OwnerRecommendedAction = {
  id: string;
  title: string;
  detail: string;
  priority: "Do now" | "Today" | "This week";
  expectedOutcome: string;
  actionLabel: string;
  actionType?: string;
  href?: string;
  payload?: Record<string, unknown>;
};

export type OwnerQuickAction = {
  id: string;
  label: string;
  href?: string;
  actionType?: string;
  payload?: Record<string, unknown>;
};

export type ProcurementScore = {
  label: string;
  value: number;
  detail: string;
};

export type OwnerProcurementOs = {
  savingsSnapshot: OwnerSavingsSnapshot;
  topSavingsOpportunities: OwnerSavingsOpportunity[];
  supplierCheckoutOptions: SupplierCheckoutOption[];
  urgentIssues: OwnerOperationalIssue[];
  todaysDeliveries: OwnerDelivery[];
  recommendedActions: OwnerRecommendedAction[];
  quickActions: OwnerQuickAction[];
  scores: ProcurementScore[];
  aiAssistantSummary: string;
  safetyNotice: string;
};

export function buildOwnerProcurementOs({
  deliveryBoard,
  snapshot,
}: {
  deliveryBoard: BestPriceDeliveryBoard;
  snapshot: CopilotSnapshot;
}): OwnerProcurementOs {
  const opportunities = buildSavingsOpportunities({ deliveryBoard, snapshot });
  const supplierCheckoutOptions = buildSupplierCheckoutOptions({ deliveryBoard });
  const urgentIssues = buildUrgentIssues(snapshot);
  const todaysDeliveries = buildTodayDeliveries({ deliveryBoard, snapshot });
  const recommendedActions = buildRecommendedActions({
    deliveryBoard,
    opportunities,
    snapshot,
    urgentIssues,
  });
  const pendingSavings = opportunities
    .filter((opportunity) => opportunity.actionType.includes("approve"))
    .reduce((sum, opportunity) => sum + Math.max(0, opportunity.projectedSavingsCents), 0);
  const estimatedMonthlySavingsCents = Math.max(
    snapshot.projectedSavingsCents,
    deliveryBoard.totalMonthlySavingsCents,
    opportunities.reduce((sum, opportunity) => sum + Math.max(0, opportunity.projectedSavingsCents), 0)
  );
  const savingsCapturedCents = snapshot.weeklyReport.totalSavingsApprovedCents;
  const ledger = snapshot.savingsLedger;
  const foundThisWeekCents = Math.max(
    ledger.foundThisWeekCents,
    snapshot.weeklyReport.totalSavingsFoundCents,
    deliveryBoard.topSavingsCents
  );
  const foundThisMonthCents = Math.max(
    ledger.foundThisMonthCents,
    estimatedMonthlySavingsCents,
    foundThisWeekCents
  );
  const totalSinceEnrollmentCents = Math.max(
    ledger.totalIdentifiedSinceEnrollmentCents,
    ledger.capturedSinceEnrollmentCents,
    foundThisMonthCents,
    savingsCapturedCents
  );

  return {
    savingsSnapshot: {
      estimatedMonthlySavingsCents,
      estimatedAnnualSavingsCents: estimatedMonthlySavingsCents * 12,
      savingsFoundThisWeekCents: foundThisWeekCents,
      savingsFoundThisMonthCents: foundThisMonthCents,
      savingsCapturedThisWeekCents: ledger.capturedThisWeekCents,
      savingsCapturedThisMonthCents: ledger.capturedThisMonthCents,
      savingsCapturedCents,
      savingsPendingApprovalCents: Math.max(
        pendingSavings,
        ledger.pendingApprovalCents,
        snapshot.pendingApprovalCount > 0 ? deliveryBoard.topSavingsCents : 0
      ),
      totalSinceEnrollmentCents,
      enrolledAtLabel: formatDateLabel(ledger.enrolledAt),
      lastUpdatedLabel: formatDateTimeLabel(ledger.lastUpdatedAt),
    },
    topSavingsOpportunities: opportunities.slice(0, 4),
    supplierCheckoutOptions: supplierCheckoutOptions.slice(0, 8),
    urgentIssues: urgentIssues.slice(0, 4),
    todaysDeliveries,
    recommendedActions,
    quickActions: [
      { id: "approve", label: "Review Approvals", href: "/operations-copilot/approvals" },
      {
        id: "reorder",
        label: "Reorder",
        actionType: "owner_quick_reorder",
        payload: { source: "owner_savings_dashboard" },
      },
      { id: "deliveries", label: "View Deliveries", href: "/operations-copilot/delivery" },
      {
        id: "issue",
        label: "Report Issue",
        actionType: "owner_report_procurement_issue",
        payload: { source: "owner_savings_dashboard" },
      },
      {
        id: "vendor",
        label: "Contact Vendor",
        actionType: "owner_contact_vendor",
        payload: { source: "owner_savings_dashboard" },
      },
    ],
    scores: buildScores({ deliveryBoard, snapshot }),
    aiAssistantSummary: buildAssistantSummary({
      estimatedMonthlySavingsCents,
      opportunities,
      urgentIssues,
      todaysDeliveries,
    }),
    safetyNotice: procurementEmotionCopy.safetyNotice,
  };
}

function buildSavingsOpportunities({
  deliveryBoard,
  snapshot,
}: {
  deliveryBoard: BestPriceDeliveryBoard;
  snapshot: CopilotSnapshot;
}): OwnerSavingsOpportunity[] {
  const deliveryOpportunities = deliveryBoard.recommendations
    .filter((recommendation) => recommendation.savingsAudit.monthlyEstimatedSavingsCents > 0)
    .map((recommendation) => opportunityFromDeliveryRecommendation(recommendation));
  const smartBuys = snapshot.smartBuys.map(opportunityFromSmartBuy);
  const savingsFeed = snapshot.savingsFeed.map((event) => ({
    id: `feed-${event.id}`,
    title: event.title,
    detail: event.detail,
    projectedSavingsCents: Math.max(0, event.impactCents),
    sourceQuality: "estimated" as const,
    sourceQualityLabel: "Estimated",
    difficulty: "Needs review" as const,
    operationalImpact: urgencyToImpact(event.urgency),
    confidence: "Medium" as const,
    actionLabel: "Review",
    actionType: "review_savings_signal",
    payload: {
      source: "owner_savings_dashboard",
      eventId: event.id,
      estimatedSavingsCents: event.impactCents,
    },
  }));

  const unique = new Map<string, OwnerSavingsOpportunity>();
  for (const opportunity of [...deliveryOpportunities, ...smartBuys, ...savingsFeed]) {
    const key = normalizeKey(opportunity.title);
    const existing = unique.get(key);
    if (!existing || opportunity.projectedSavingsCents > existing.projectedSavingsCents) {
      unique.set(key, opportunity);
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) => b.projectedSavingsCents - a.projectedSavingsCents
  );
}

function opportunityFromDeliveryRecommendation(
  recommendation: BestPriceDeliveryRecommendation
): OwnerSavingsOpportunity {
  const sourceQuality = deliveryDataQualityToSourceQuality(recommendation.savingsAudit.dataQuality);

  return {
    id: `delivery-${recommendation.id}`,
    title: recommendation.title,
    detail: `${recommendation.supplierName} can reduce true delivered cost. ${recommendation.deliveryLabel}; ${recommendation.estimatedDeliveryDateLabel}.`,
    projectedSavingsCents: Math.max(0, recommendation.savingsAudit.monthlyEstimatedSavingsCents),
    sourceQuality,
    sourceQualityLabel: formatSourceQuality(sourceQuality),
    difficulty:
      recommendation.itemMatchConfidence === "high" &&
      recommendation.savingsAudit.dataQuality === "verified"
        ? "Easy"
        : "Needs review",
    operationalImpact:
      recommendation.deliveryOption === "not_delivery_eligible" ? "Medium" : "Low",
    confidence: capitalizeConfidence(recommendation.itemMatchConfidence),
    actionLabel: "Queue Approval",
    actionType: "approve_savings_recommendation",
    payload: {
      source: "owner_savings_dashboard",
      recommendationId: recommendation.id,
      itemName: recommendation.itemName,
      supplierName: recommendation.supplierName,
      estimatedSavingsCents: recommendation.savingsAudit.monthlyEstimatedSavingsCents,
      trueLandedCostCents: recommendation.savingsAudit.recommendedTotalDeliveredCostCents,
      approvalOnly: true,
      liveOrderingEnabled: false,
    },
  };
}

function opportunityFromSmartBuy(buy: SmartBuyRecommendation): OwnerSavingsOpportunity {
  return {
    id: `smart-${buy.id}`,
    title: `Switch ${buy.itemName} to ${buy.bestVendor}`,
    detail: buy.explanation,
    projectedSavingsCents: Math.max(0, buy.estimatedSavingsCents),
    sourceQuality: "estimated",
    sourceQualityLabel: "Estimated",
    difficulty: buy.riskLevel === "low" || buy.riskLevel === "medium" ? "Easy" : "Medium",
    operationalImpact: buy.riskLevel === "critical" ? "High" : buy.riskLevel === "high" ? "Medium" : "Low",
    confidence: "High",
    actionLabel: "Queue Approval",
    actionType: "approve_smart_buy",
    payload: {
      source: "owner_savings_dashboard",
      smartBuyId: buy.id,
      itemName: buy.itemName,
      bestVendor: buy.bestVendor,
      estimatedSavingsCents: buy.estimatedSavingsCents,
      approvalOnly: true,
      liveOrderingEnabled: false,
    },
  };
}

function buildUrgentIssues(snapshot: CopilotSnapshot): OwnerOperationalIssue[] {
  const riskIssues = snapshot.riskAlerts.map((risk) => issueFromRisk(risk));
  const inventoryIssues = snapshot.inventoryForecasts
    .filter((item) => item.riskLevel === "critical" || item.riskLevel === "high")
    .map((item) => ({
      id: `inventory-${item.id}`,
      title: `${item.itemName} may run low`,
      detail:
        item.daysUntilStockout === null
          ? item.reorderRecommendation
          : `${item.daysUntilStockout} day${item.daysUntilStockout === 1 ? "" : "s"} remaining. ${item.reorderRecommendation}`,
      severity: item.riskLevel === "critical" ? "Critical" : "High",
      actionLabel: "Prepare Reorder",
      actionType: "prepare_reorder_from_issue",
      payload: {
        source: "owner_savings_dashboard",
        itemName: item.itemName,
        riskLevel: item.riskLevel,
      },
    } satisfies OwnerOperationalIssue));
  const vendorIssues = snapshot.vendorScorecards
    .filter((vendor) => vendor.deliveryIssueRisk === "high" || vendor.riskScore >= 45)
    .map((vendor) => ({
      id: `vendor-${vendor.id}`,
      title: `${vendor.supplierName} needs review`,
      detail: `${vendor.reliabilityScore}/100 reliability with ${vendor.priceTrend} pricing behavior.`,
      severity: vendor.deliveryIssueRisk === "high" ? "High" : "Medium",
      actionLabel: "Review Vendor",
      actionType: "review_vendor_issue",
      payload: {
        source: "owner_savings_dashboard",
        supplierName: vendor.supplierName,
        riskScore: vendor.riskScore,
      },
    } satisfies OwnerOperationalIssue));

  const allIssues = [...inventoryIssues, ...vendorIssues, ...riskIssues];
  if (allIssues.length > 0) return allIssues;

  return [
    {
      id: "issue-data-readiness",
      title: "Connect invoices to find more savings",
      detail: "No urgent operational issue is visible from the loaded data.",
      severity: "Low",
      actionLabel: "Add Data",
      actionType: "connect_procurement_data",
      payload: { source: "owner_savings_dashboard" },
    },
  ];
}

function issueFromRisk(risk: ProcurementRiskAlert): OwnerOperationalIssue {
  return {
    id: `risk-${risk.id}`,
    title: risk.title,
    detail: risk.detail,
    severity: capitalizeSeverity(risk.severity),
    actionLabel: "Review",
    actionType: "review_operational_alert",
    payload: {
      source: "owner_savings_dashboard",
      riskId: risk.id,
      severity: risk.severity,
    },
  };
}

function buildTodayDeliveries({
  deliveryBoard,
  snapshot,
}: {
  deliveryBoard: BestPriceDeliveryBoard;
  snapshot: CopilotSnapshot;
}): OwnerDelivery[] {
  const prepared = deliveryBoard.recommendations
    .filter((recommendation) => recommendation.deliveryOption !== "not_delivery_eligible")
    .slice(0, 3)
    .map((recommendation) => ({
      id: `prepared-${recommendation.id}`,
      supplierName: recommendation.supplierName,
      itemSummary: recommendation.itemName,
      status: "Prepared" as const,
      etaLabel: recommendation.estimatedDeliveryDateLabel,
      missingItemsLabel: "None reported",
      actionLabel: "Receive",
      actionType: "open_receiving_check",
      payload: {
        source: "owner_savings_dashboard",
        recommendationId: recommendation.id,
        supplierName: recommendation.supplierName,
        itemName: recommendation.itemName,
      },
    }));

  if (prepared.length > 0) return prepared;

  return snapshot.emergencyItems.slice(0, 2).map((item) => ({
    id: `emergency-delivery-${item.id}`,
    supplierName: item.backupVendor,
    itemSummary: item.itemName,
    status: "Prepared",
    etaLabel: item.fastestOption,
    missingItemsLabel: "Needs approval",
    actionLabel: "Prepare",
    actionType: "prepare_emergency_delivery",
    payload: {
      source: "owner_savings_dashboard",
      itemName: item.itemName,
      backupVendor: item.backupVendor,
    },
  }));
}

function buildRecommendedActions({
  deliveryBoard,
  opportunities,
  snapshot,
  urgentIssues,
}: {
  deliveryBoard: BestPriceDeliveryBoard;
  opportunities: OwnerSavingsOpportunity[];
  snapshot: CopilotSnapshot;
  urgentIssues: OwnerOperationalIssue[];
}): OwnerRecommendedAction[] {
  const actions: OwnerRecommendedAction[] = [];
  const urgentIssue = urgentIssues.find((issue) => issue.severity === "Critical" || issue.severity === "High");
  const atRiskInventory = snapshot.inventoryForecasts.find(
    (item) => item.riskLevel === "critical" || item.riskLevel === "high"
  );
  const topOpportunity = opportunities[0];
  const vendorRisk = snapshot.vendorScorecards.find(
    (vendor) => vendor.deliveryIssueRisk === "high" || vendor.riskScore >= 45
  );

  if (urgentIssue) {
    actions.push({
      id: `action-issue-${urgentIssue.id}`,
      title: urgentIssue.title,
      detail: urgentIssue.detail,
      priority: urgentIssue.severity === "Critical" ? "Do now" : "Today",
      expectedOutcome: "Prevent a supply, delivery, or cost problem before it becomes another owner burden.",
      actionLabel: urgentIssue.actionLabel,
      actionType: urgentIssue.actionType,
      payload: urgentIssue.payload,
    });
  }

  if (atRiskInventory) {
    actions.push({
      id: `action-reorder-${atRiskInventory.id}`,
      title: `Order ${atRiskInventory.itemName}`,
      detail:
        atRiskInventory.daysUntilStockout === null
          ? atRiskInventory.reorderRecommendation
          : `${atRiskInventory.daysUntilStockout} day${atRiskInventory.daysUntilStockout === 1 ? "" : "s"} remaining. ${atRiskInventory.reorderRecommendation}`,
      priority: atRiskInventory.riskLevel === "critical" ? "Do now" : "Today",
      expectedOutcome: "Avoid running out without asking the owner to study usage data.",
      actionLabel: "Prepare Reorder",
      actionType: "prepare_reorder_from_ai_action",
      payload: {
        source: "owner_recommended_actions",
        itemName: atRiskInventory.itemName,
        riskLevel: atRiskInventory.riskLevel,
      },
    });
  }

  if (topOpportunity) {
    actions.push({
      id: `action-savings-${topOpportunity.id}`,
      title: topOpportunity.title,
      detail: topOpportunity.detail,
      priority: topOpportunity.projectedSavingsCents >= 20000 ? "Today" : "This week",
      expectedOutcome: `Potential monthly savings: ${formatMoney(topOpportunity.projectedSavingsCents)}.`,
      actionLabel: topOpportunity.actionLabel,
      actionType: topOpportunity.actionType,
      payload: {
        source: "owner_recommended_actions",
        ...topOpportunity.payload,
      },
    });
  }

  if (vendorRisk) {
    actions.push({
      id: `action-vendor-${vendorRisk.id}`,
      title: `Review ${vendorRisk.supplierName}`,
      detail: `${vendorRisk.reliabilityScore}/100 reliability with ${vendorRisk.priceTrend} pricing behavior.`,
      priority: vendorRisk.deliveryIssueRisk === "high" ? "Today" : "This week",
      expectedOutcome: "Reduce delivery uncertainty and quiet vendor-driven margin leaks.",
      actionLabel: "Review Vendor",
      actionType: "review_vendor_issue",
      payload: {
        source: "owner_recommended_actions",
        supplierName: vendorRisk.supplierName,
        riskScore: vendorRisk.riskScore,
      },
    });
  }

  actions.push({
    id: "action-next-step",
    title: deliveryBoard.recommendedNextStep,
    detail: "HomeReach keeps ordering, delivery, and supplier complexity inside the AI layer so the owner can decide from clear recommendations.",
    priority: deliveryBoard.pendingApprovalCount > 0 ? "Today" : "This week",
    expectedOutcome: "More margin visibility with less manual analysis.",
    actionLabel: deliveryBoard.pendingApprovalCount > 0 ? "Review Approvals" : "View Prices",
    href: deliveryBoard.pendingApprovalCount > 0 ? "/operations-copilot/approvals" : "/operations-copilot/supplier-prices",
  });

  const unique = new Map<string, OwnerRecommendedAction>();
  for (const action of actions) {
    const key = normalizeKey(action.title);
    if (!unique.has(key)) unique.set(key, action);
  }

  return Array.from(unique.values()).slice(0, 4);
}

function buildScores({
  deliveryBoard,
  snapshot,
}: {
  deliveryBoard: BestPriceDeliveryBoard;
  snapshot: CopilotSnapshot;
}): ProcurementScore[] {
  const savingsScore = Math.min(100, Math.max(30, Math.round(snapshot.projectedSavingsCents / 2500)));
  const vendorScore = snapshot.averageSupplierReliability || 70;
  const deliveryScore = Math.min(
    100,
    Math.max(45, 70 + deliveryBoard.deliveryReadyCount * 4 - deliveryBoard.needsReviewCount * 3)
  );
  const wasteScore = snapshot.insights.some((insight) => insight.type === "overstock") ? 62 : 86;

  return [
    { label: "Savings Score", value: savingsScore, detail: "Visible monthly cost reduction" },
    { label: "Procurement Efficiency", value: snapshot.healthScore, detail: "Risk, approvals, and supply health" },
    { label: "Vendor Optimization", value: vendorScore, detail: "Reliability and backup coverage" },
    { label: "Delivery Efficiency", value: deliveryScore, detail: "Delivery-ready savings options" },
    { label: "Waste Reduction", value: wasteScore, detail: "Overstock and spoilage exposure" },
  ];
}

function buildAssistantSummary({
  estimatedMonthlySavingsCents,
  opportunities,
  urgentIssues,
  todaysDeliveries,
}: {
  estimatedMonthlySavingsCents: number;
  opportunities: OwnerSavingsOpportunity[];
  urgentIssues: OwnerOperationalIssue[];
  todaysDeliveries: OwnerDelivery[];
}) {
  const topOpportunity = opportunities[0];
  const topIssue = urgentIssues.find((issue) => issue.severity !== "Low");
  const deliveryCount = todaysDeliveries.length;

  if (topOpportunity) {
    return `${procurementEmotionCopy.assistantPrefix} I found ${formatMoney(estimatedMonthlySavingsCents)} in estimated monthly savings. Start with: ${topOpportunity.title}. ${topIssue ? `Also watch: ${topIssue.title}.` : ""} ${deliveryCount} delivery item${deliveryCount === 1 ? "" : "s"} are ready to review.`;
  }

  return "No verified savings are ready yet. Add invoices, supplier quotes, or delivery data and HomeReach will surface the simplest next action.";
}

function urgencyToImpact(urgency: string): OwnerSavingsOpportunity["operationalImpact"] {
  if (urgency === "critical" || urgency === "high") return "High";
  if (urgency === "medium") return "Medium";
  return "Low";
}

function capitalizeConfidence(value: string): OwnerSavingsOpportunity["confidence"] {
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
}

function capitalizeSeverity(value: string): OwnerOperationalIssue["severity"] {
  if (value === "critical") return "Critical";
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
}

function deliveryDataQualityToSourceQuality(
  value: BestPriceDeliveryRecommendation["savingsAudit"]["dataQuality"]
): OwnerSavingsOpportunity["sourceQuality"] {
  if (value === "verified") return "verified";
  if (value === "benchmark") return "observed";
  return "estimated";
}

function formatSourceQuality(value: OwnerSavingsOpportunity["sourceQuality"]) {
  if (value === "verified") return "Verified";
  if (value === "observed") return "Observed";
  return "Estimated";
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateLabel(date: Date | null) {
  if (!date) return "Enrollment date pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
