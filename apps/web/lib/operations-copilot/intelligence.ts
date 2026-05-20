import { randomUUID } from "crypto";
import {
  db,
  opcopilotActionRequests,
  opcopilotAiEvents,
  opcopilotBusinessContexts,
  opcopilotInventoryItems,
  opcopilotSupplierQuotes,
  opcopilotSuppliers,
} from "@homereach/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type {
  BusinessMemorySummary,
  CopilotInsight,
  CopilotQuickAction,
  CopilotSnapshot,
  CostHealthCard,
  EmergencyProcurementItem,
  InventoryForecast,
  ProcurementRiskAlert,
  SavingsFeedEvent,
  SmartBuyRecommendation,
  VendorScorecard,
  WeeklyAiReport,
} from "./types";

type InventoryRow = typeof opcopilotInventoryItems.$inferSelect;
type SupplierRow = typeof opcopilotSuppliers.$inferSelect;
type QuoteRow = typeof opcopilotSupplierQuotes.$inferSelect;
type ContextRow = typeof opcopilotBusinessContexts.$inferSelect | undefined;
type ActionRequestRow = typeof opcopilotActionRequests.$inferSelect;

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function buildOperationsCopilotSnapshot(
  userId: string
): Promise<CopilotSnapshot> {
  const [context] = await db
    .select()
    .from(opcopilotBusinessContexts)
    .where(eq(opcopilotBusinessContexts.userId, userId))
    .limit(1);

  const [inventory, suppliers, quotes, openEvents, actionRequests] =
    await Promise.all([
      db
        .select()
        .from(opcopilotInventoryItems)
        .where(
          and(
            eq(opcopilotInventoryItems.userId, userId),
            eq(opcopilotInventoryItems.active, true)
          )
        ),
      db
        .select()
        .from(opcopilotSuppliers)
        .where(
          and(
            eq(opcopilotSuppliers.userId, userId),
            eq(opcopilotSuppliers.active, true)
          )
        ),
      db
        .select()
        .from(opcopilotSupplierQuotes)
        .where(eq(opcopilotSupplierQuotes.userId, userId)),
      db
        .select()
        .from(opcopilotAiEvents)
        .where(
          and(
            eq(opcopilotAiEvents.userId, userId),
            eq(opcopilotAiEvents.status, "open")
          )
        )
        .orderBy(desc(opcopilotAiEvents.createdAt))
        .limit(12),
      db
        .select()
        .from(opcopilotActionRequests)
        .where(eq(opcopilotActionRequests.userId, userId))
        .orderBy(desc(opcopilotActionRequests.createdAt))
        .limit(20),
    ]);

  const pendingActions = actionRequests.filter(
    (action) => action.status === "pending_approval"
  );
  const generatedInsights = generateDeterministicInsights({
    inventory,
    suppliers,
    quotes,
  });

  const persistedInsights: CopilotInsight[] = openEvents.map((event) => ({
    id: event.id,
    type: normalizeInsightType(event.eventType),
    title: event.title,
    summary: event.summary,
    recommendedAction:
      event.payload?.recommendedAction ?? "Review this event and decide next step.",
    urgency: normalizeUrgency(event.urgency),
    confidence: normalizeConfidence(event.confidence),
    riskScore: event.riskScore,
    estimatedImpactCents: event.estimatedImpactCents,
    reasoning: event.payload?.reasoning ?? [],
  }));

  const insights = [...generatedInsights, ...persistedInsights].slice(0, 8);
  const projectedSavingsCents = insights.reduce(
    (sum, insight) => sum + Math.max(0, insight.estimatedImpactCents),
    0
  );
  const atRiskInventoryCount = inventory.filter((item) => {
    const onHand = toNumber(item.onHandQuantity);
    const reorder = toNumber(item.reorderPointQuantity);
    const dailyUse = toNumber(item.averageDailyUse);
    return onHand <= reorder || (dailyUse > 0 && onHand / dailyUse <= 7);
  }).length;
  const averageSupplierReliability =
    suppliers.length > 0
      ? Math.round(
          suppliers.reduce((sum, supplier) => sum + supplier.reliabilityScore, 0) /
            suppliers.length
        )
      : 0;
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      88 -
        atRiskInventoryCount * 8 -
        pendingActions.length * 3 +
        Math.round(averageSupplierReliability / 10)
    )
  );
  const smartBuys = buildSmartBuyRecommendations({ inventory, suppliers, quotes });
  const inventoryForecasts = buildInventoryForecasts(inventory);
  const vendorScorecards = buildVendorScorecards({ suppliers, quotes });
  const riskAlerts = buildRiskAlerts({
    insights,
    suppliers,
    pendingActionsCount: pendingActions.length,
  });
  const weeklyReport = buildWeeklyReport({
    insights,
    actionRequests,
    atRiskInventoryCount,
    vendorScorecards,
  });
  const businessMemory = buildBusinessMemorySummary(context);
  const emergencyItems = buildEmergencyItems({
    inventoryForecasts,
    smartBuys,
    suppliers,
  });
  const healthCards = buildHealthCards({
    projectedSavingsCents,
    pendingApprovalCount: pendingActions.length,
    atRiskInventoryCount,
    insights,
    smartBuys,
    riskAlerts,
  });

  return {
    companyName: context?.companyName ?? "Operations Command",
    businessType: context?.businessType ?? "procurement operations",
    autonomyLevel: context?.approvalPolicy?.autonomyLevel ?? 1,
    inventoryItemCount: inventory.length,
    supplierCount: suppliers.length,
    openEventCount: openEvents.length + generatedInsights.length,
    pendingApprovalCount: pendingActions.length,
    projectedSavingsCents,
    atRiskInventoryCount,
    averageSupplierReliability,
    healthScore,
    aiExecutiveSummary: buildAiExecutiveSummary({
      companyName: context?.companyName ?? "your business",
      projectedSavingsCents,
      pendingApprovalCount: pendingActions.length,
      atRiskInventoryCount,
      riskAlerts,
      smartBuys,
    }),
    healthCards,
    smartBuys,
    savingsFeed: buildSavingsFeed({ insights, smartBuys }),
    inventoryForecasts,
    vendorScorecards,
    riskAlerts,
    weeklyReport,
    emergencyItems,
    businessMemory,
    insights,
    quickActions: buildQuickActions(),
    activityFeed: buildActivityFeed({ insights, pendingActionsCount: pendingActions.length }),
  };
}

export async function createOperationsCopilotActionRequest({
  userId,
  actionType,
  title,
  payload,
}: {
  userId: string;
  actionType: string;
  title: string;
  payload?: Record<string, unknown>;
}) {
  const [context] = await db
    .select()
    .from(opcopilotBusinessContexts)
    .where(eq(opcopilotBusinessContexts.userId, userId))
    .limit(1);
  const autonomyLevel = context?.approvalPolicy?.autonomyLevel ?? 1;
  const approvalRequired = autonomyLevel < 3;

  const [request] = await db
    .insert(opcopilotActionRequests)
    .values({
      userId,
      actionType,
      title,
      autonomyLevel,
      approvalRequired,
      status: approvalRequired ? "pending_approval" : "queued",
      requestPayload: payload ?? {},
      auditLog: [
        {
          at: new Date().toISOString(),
          actor: "ai",
          event: "action_request_created",
          approvalRequired,
        },
      ],
    })
    .returning();

  return request;
}

export async function listOperationsCopilotData(userId: string) {
  const [context] = await db
    .select()
    .from(opcopilotBusinessContexts)
    .where(eq(opcopilotBusinessContexts.userId, userId))
    .limit(1);

  const [inventory, suppliers, quotes, actionRequests] = await Promise.all([
    db
      .select()
      .from(opcopilotInventoryItems)
      .where(eq(opcopilotInventoryItems.userId, userId)),
    db
      .select()
      .from(opcopilotSuppliers)
      .where(eq(opcopilotSuppliers.userId, userId)),
    db
      .select()
      .from(opcopilotSupplierQuotes)
      .where(eq(opcopilotSupplierQuotes.userId, userId)),
    db
      .select()
      .from(opcopilotActionRequests)
      .where(eq(opcopilotActionRequests.userId, userId))
      .orderBy(desc(opcopilotActionRequests.createdAt))
      .limit(25),
  ]);

  return { context, inventory, suppliers, quotes, actionRequests };
}

export async function listOperationsCopilotApprovals(userId: string) {
  return db
    .select()
    .from(opcopilotActionRequests)
    .where(eq(opcopilotActionRequests.userId, userId))
    .orderBy(desc(opcopilotActionRequests.createdAt))
    .limit(50);
}

export async function resolveOperationsCopilotActionRequest({
  userId,
  requestId,
  decision,
}: {
  userId: string;
  requestId: string;
  decision: "approved" | "rejected";
}) {
  const [existing] = await db
    .select()
    .from(opcopilotActionRequests)
    .where(
      and(
        eq(opcopilotActionRequests.userId, userId),
        eq(opcopilotActionRequests.id, requestId)
      )
    )
    .limit(1);

  if (!existing) return null;

  const [updated] = await db
    .update(opcopilotActionRequests)
    .set({
      status: decision,
      updatedAt: new Date(),
      auditLog: [
        ...(existing.auditLog ?? []),
        {
          at: new Date().toISOString(),
          actor: "owner",
          event: `action_request_${decision}`,
        },
      ],
    })
    .where(
      and(
        eq(opcopilotActionRequests.userId, userId),
        eq(opcopilotActionRequests.id, requestId)
      )
    )
    .returning();

  return updated;
}

export async function seedOperationsCopilotDemoData(userId: string) {
  const [context] = await db
    .insert(opcopilotBusinessContexts)
    .values({
      userId,
      companyName: "HomeReach Operations",
      businessType: "home_services",
      operatingModel: "field_service",
      serviceGeography: "metro service area",
      seasonalPatterns: [
        "mulch demand rises in spring",
        "roofing supply risk increases after storm weeks",
        "janitorial replenishment repeats every 21 days",
      ],
      approvalPolicy: {
        autonomyLevel: 2,
        autoApproveUnderCents: 100000,
        requireApprovalCategories: ["roofing", "equipment", "new_supplier"],
      },
      preferenceMemory: {
        preferredBrands: ["GAF", "Scotts", "Libman"],
        preferredSuppliers: ["Home Depot Pro", "Local distributor"],
        substituteTolerance: "medium",
        marginTargets: { roofing: 38, landscaping: 44, janitorial: 31 },
        deliveryProfile: {
          businessAddress: "123 Market Street, Akron, OH 44309",
          deliveryInstructions: "Use rear lot when trucks are available; call before arrival.",
          preferredDeliveryWindows: ["Weekdays 8 AM to 4 PM"],
          receivingLocation: "back_door",
          receivingContact: "Operations manager",
          taxExemptStatus: "unknown",
          preferredSuppliers: ["Home Depot Pro", "Local distributor"],
          restrictedSuppliers: [],
          localPickupRadiusMiles: 25,
          deliveryPreference: "balanced",
        },
      },
    })
    .onConflictDoUpdate({
      target: opcopilotBusinessContexts.userId,
      set: {
        companyName: "HomeReach Operations",
        businessType: "home_services",
        operatingModel: "field_service",
        serviceGeography: "metro service area",
        seasonalPatterns: [
          "mulch demand rises in spring",
          "roofing supply risk increases after storm weeks",
          "janitorial replenishment repeats every 21 days",
        ],
        approvalPolicy: {
          autonomyLevel: 2,
          autoApproveUnderCents: 100000,
          requireApprovalCategories: ["roofing", "equipment", "new_supplier"],
        },
        preferenceMemory: {
          preferredBrands: ["GAF", "Scotts", "Libman"],
          preferredSuppliers: ["Home Depot Pro", "Local distributor"],
          substituteTolerance: "medium",
          marginTargets: { roofing: 38, landscaping: 44, janitorial: 31 },
          deliveryProfile: {
            businessAddress: "123 Market Street, Akron, OH 44309",
            deliveryInstructions: "Use rear lot when trucks are available; call before arrival.",
            preferredDeliveryWindows: ["Weekdays 8 AM to 4 PM"],
            receivingLocation: "back_door",
            receivingContact: "Operations manager",
            taxExemptStatus: "unknown",
            preferredSuppliers: ["Home Depot Pro", "Local distributor"],
            restrictedSuppliers: [],
            localPickupRadiusMiles: 25,
            deliveryPreference: "balanced",
          },
        },
        updatedAt: new Date(),
      },
    })
    .returning();

  const inventorySeed = [
    {
      sku: "ROOF-GAF-TIMBERLINE",
      itemName: "GAF Timberline shingles",
      category: "roofing",
      preferredBrand: "GAF",
      unit: "bundle",
      onHandQuantity: "22",
      reorderPointQuantity: "30",
      targetStockQuantity: "90",
      averageDailyUse: "4.8",
      unitCostCents: 4280,
      grossMarginImpactCents: 186000,
      substituteTolerance: "low",
    },
    {
      sku: "LAND-MULCH-HARDWOOD",
      itemName: "Hardwood mulch",
      category: "landscaping",
      preferredBrand: "Premium Hardwood",
      unit: "yard",
      onHandQuantity: "18",
      reorderPointQuantity: "24",
      targetStockQuantity: "75",
      averageDailyUse: "5.6",
      unitCostCents: 3100,
      grossMarginImpactCents: 97000,
      substituteTolerance: "medium",
    },
    {
      sku: "LAND-FERT-20-10-10",
      itemName: "20-10-10 fertilizer",
      category: "landscaping",
      preferredBrand: "Scotts",
      unit: "bag",
      onHandQuantity: "94",
      reorderPointQuantity: "40",
      targetStockQuantity: "80",
      averageDailyUse: "1.7",
      unitCostCents: 1850,
      grossMarginImpactCents: 42000,
      substituteTolerance: "medium",
    },
    {
      sku: "JAN-TRASH-55GAL",
      itemName: "55 gallon contractor bags",
      category: "janitorial",
      preferredBrand: "Contractor Pro",
      unit: "case",
      onHandQuantity: "46",
      reorderPointQuantity: "18",
      targetStockQuantity: "36",
      averageDailyUse: "0.7",
      unitCostCents: 2790,
      grossMarginImpactCents: 26000,
      substituteTolerance: "high",
    },
  ];

  const inventory = await db
    .insert(opcopilotInventoryItems)
    .values(inventorySeed.map((item) => ({ ...item, userId })))
    .onConflictDoUpdate({
      target: [opcopilotInventoryItems.userId, opcopilotInventoryItems.sku],
      set: {
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  const supplierSeed = [
    {
      supplierName: "Builder Supply Co",
      categoryCoverage: ["roofing", "janitorial"],
      reliabilityScore: 88,
      averageLeadTimeDays: 2,
      minimumOrderCents: 50000,
      deliveryFeeCents: 7500,
      paymentTerms: "net_30",
    },
    {
      supplierName: "Regional Depot",
      categoryCoverage: ["roofing", "landscaping", "janitorial"],
      reliabilityScore: 68,
      averageLeadTimeDays: 5,
      minimumOrderCents: 25000,
      deliveryFeeCents: 12000,
      paymentTerms: "card_on_file",
    },
    {
      supplierName: "GreenPro Wholesale",
      categoryCoverage: ["landscaping"],
      reliabilityScore: 91,
      averageLeadTimeDays: 3,
      minimumOrderCents: 35000,
      deliveryFeeCents: 6500,
      paymentTerms: "net_15",
    },
  ];

  const suppliers = await db
    .insert(opcopilotSuppliers)
    .values(supplierSeed.map((supplier) => ({ ...supplier, userId })))
    .onConflictDoUpdate({
      target: [opcopilotSuppliers.userId, opcopilotSuppliers.supplierName],
      set: {
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  const itemBySku = new Map(inventory.map((item) => [item.sku, item]));
  const supplierByName = new Map(
    suppliers.map((supplier) => [supplier.supplierName, supplier])
  );

  const quoteSeed = [
    ["Builder Supply Co", "ROOF-GAF-TIMBERLINE", 4280, 4280, 140, 2],
    ["Regional Depot", "ROOF-GAF-TIMBERLINE", 4925, 4925, 210, 5],
    ["GreenPro Wholesale", "LAND-MULCH-HARDWOOD", 2890, 2890, 100, 3],
    ["Regional Depot", "LAND-MULCH-HARDWOOD", 3460, 3460, 60, 5],
    ["GreenPro Wholesale", "LAND-FERT-20-10-10", 1710, 1710, 160, 3],
    ["Regional Depot", "LAND-FERT-20-10-10", 2035, 2035, 75, 5],
    ["Builder Supply Co", "JAN-TRASH-55GAL", 2790, 2790, 80, 2],
    ["Regional Depot", "JAN-TRASH-55GAL", 3015, 3015, 55, 4],
  ] as const;

  const quoteValues = quoteSeed.flatMap(
    ([supplierName, sku, quotedUnitCostCents, landedCostCents, availableQuantity, leadTimeDays]) => {
      const supplier = supplierByName.get(supplierName);
      const item = itemBySku.get(sku);
      if (!supplier || !item) return [];
      return [
        {
          userId,
          supplierId: supplier.id,
          inventoryItemId: item.id,
          quotedUnitCostCents,
          landedCostCents,
          availableQuantity: String(availableQuantity),
          leadTimeDays,
        },
      ];
    }
  );

  if (quoteValues.length > 0) {
    const currentQuoteIds = (
      await db
        .select({ id: opcopilotSupplierQuotes.id })
        .from(opcopilotSupplierQuotes)
        .where(
          and(
            eq(opcopilotSupplierQuotes.userId, userId),
            inArray(
              opcopilotSupplierQuotes.inventoryItemId,
              inventory.map((item) => item.id)
            )
          )
        )
    ).map((quote) => quote.id);

    if (currentQuoteIds.length > 0) {
      await db
        .delete(opcopilotSupplierQuotes)
        .where(inArray(opcopilotSupplierQuotes.id, currentQuoteIds));
    }

    await db.insert(opcopilotSupplierQuotes).values(quoteValues);
  }

  const [event] = await db
    .insert(opcopilotAiEvents)
    .values({
      userId,
      eventType: "forecast",
      title: "Spring demand spike approaching",
      summary:
        "Mulch and fertilizer demand historically rises next week; current mulch coverage is under four days.",
      urgency: "high",
      confidence: "medium",
      estimatedImpactCents: 124000,
      riskScore: 81,
      payload: {
        reasoning: [
          "Seasonal pattern: spring landscaping demand spike",
          "Mulch on-hand inventory is below reorder point",
          "GreenPro Wholesale is the best current landed cost",
        ],
        recommendedAction:
          "Prepare a consolidated landscaping replenishment order for owner approval.",
      },
      status: "open",
    })
    .returning();

  await createOperationsCopilotActionRequest({
    userId,
    actionType: "prepare_weekly_order",
    title: "Approve consolidated landscaping replenishment plan",
    payload: {
      eventId: event?.id,
      estimatedSpendCents: 84500,
      estimatedSavingsCents: 124000,
      supplier: "GreenPro Wholesale",
      items: ["Hardwood mulch", "20-10-10 fertilizer"],
    },
  });

  return {
    context,
    inventoryCount: inventory.length,
    supplierCount: suppliers.length,
    quoteCount: quoteValues.length,
  };
}

export function answerOperationsQuestion({
  snapshot,
  message,
}: {
  snapshot: CopilotSnapshot;
  message: string;
}) {
  const lower = message.toLowerCase();
  const top = snapshot.insights[0];

  if (lower.includes("low") || lower.includes("run out") || lower.includes("reorder")) {
    const shortage = snapshot.insights.find((insight) => insight.type === "shortage");
    return formatAnswer({
      title: "Inventory risk readout",
      lead:
        shortage?.summary ??
        "No critical low-stock item is loaded yet. Connect inventory counts to unlock precise reorder timing.",
      snapshot,
      action:
        shortage?.recommendedAction ??
        "Import inventory items with on-hand quantity, reorder point, and average daily usage.",
    });
  }

  if (lower.includes("save") || lower.includes("overpay") || lower.includes("cheapest")) {
    const savings = snapshot.insights.find(
      (insight) => insight.type === "savings" || insight.type === "price_spike"
    );
    return formatAnswer({
      title: "Savings and supplier optimization",
      lead:
        savings?.summary ??
        `Current projected opportunity is ${money(snapshot.projectedSavingsCents)} based on loaded risks and quotes.`,
      snapshot,
      action:
        savings?.recommendedAction ??
        "Load supplier quotes so I can compare landed cost, lead time, and reliability.",
    });
  }

  if (lower.includes("supplier") || lower.includes("delivery") || lower.includes("reliable")) {
    const supplierRisk = snapshot.insights.find(
      (insight) => insight.type === "supplier_risk"
    );
    return formatAnswer({
      title: "Supplier performance readout",
      lead:
        supplierRisk?.summary ??
        `Average supplier reliability is ${snapshot.averageSupplierReliability}/100 across ${snapshot.supplierCount} active suppliers.`,
      snapshot,
      action:
        supplierRisk?.recommendedAction ??
        "Compare landed cost and lead time before approving the next supplier switch.",
    });
  }

  if (lower.includes("forecast") || lower.includes("next month") || lower.includes("spike")) {
    const forecast = snapshot.insights.find((insight) => insight.type === "forecast");
    return formatAnswer({
      title: "Forecast and demand risk",
      lead:
        forecast?.summary ??
        "Loaded signals show no forecasted spike yet. Add recurring jobs, seasonality, and weather inputs to sharpen projections.",
      snapshot,
      action:
        forecast?.recommendedAction ??
        "Load recurring purchasing cycles and upcoming job volume so forecast actions can be ranked.",
    });
  }

  if (lower.includes("summary") || lower.includes("focus") || lower.includes("today")) {
    return formatAnswer({
      title: "Today's operational command brief",
      lead:
        top?.summary ??
        "The command center is online. The next highest value step is connecting inventory, supplier, and purchase history feeds.",
      snapshot,
      action:
        top?.recommendedAction ??
        "Start with inventory counts and your top 5 recurring suppliers.",
    });
  }

  return formatAnswer({
    title: "Operational recommendation",
    lead:
      top?.summary ??
      "I am ready to monitor inventory, supplier pricing, reorder timing, approvals, and savings once data is connected.",
    snapshot,
    action:
      top?.recommendedAction ??
      "Use a quick action to generate a procurement report or prepare a weekly order.",
  });
}

function generateDeterministicInsights({
  inventory,
  suppliers,
  quotes,
}: {
  inventory: InventoryRow[];
  suppliers: SupplierRow[];
  quotes: QuoteRow[];
}) {
  const insights: CopilotInsight[] = [];

  for (const item of inventory) {
    const onHand = toNumber(item.onHandQuantity);
    const dailyUse = toNumber(item.averageDailyUse);
    const reorderPoint = toNumber(item.reorderPointQuantity);
    const daysRemaining = dailyUse > 0 ? onHand / dailyUse : null;

    if (onHand <= reorderPoint || (daysRemaining !== null && daysRemaining <= 7)) {
      insights.push({
        id: `shortage-${item.id}`,
        type: "shortage",
        title: `${item.itemName} reorder risk`,
        summary:
          daysRemaining !== null
            ? `${item.itemName} is projected to run out in ${Math.max(1, Math.round(daysRemaining))} days.`
            : `${item.itemName} is at or below its reorder point.`,
        recommendedAction: `Prepare a replenishment order for ${item.itemName} to reach target stock.`,
        urgency: daysRemaining !== null && daysRemaining <= 3 ? "critical" : "high",
        confidence: dailyUse > 0 ? "high" : "medium",
        riskScore: daysRemaining !== null && daysRemaining <= 3 ? 92 : 76,
        estimatedImpactCents: item.grossMarginImpactCents,
        reasoning: [
          `On hand: ${onHand} ${item.unit}`,
          `Reorder point: ${reorderPoint} ${item.unit}`,
          `Average daily use: ${dailyUse} ${item.unit}`,
        ],
      });
    }
  }

  const unreliable = suppliers.filter((supplier) => supplier.reliabilityScore < 70);
  for (const supplier of unreliable) {
    insights.push({
      id: `supplier-${supplier.id}`,
      type: "supplier_risk",
      title: `${supplier.supplierName} reliability risk`,
      summary: `${supplier.supplierName} is below reliability threshold at ${supplier.reliabilityScore}/100.`,
      recommendedAction: "Compare backup suppliers before the next operationally critical order.",
      urgency: "medium",
      confidence: "medium",
      riskScore: 72,
      estimatedImpactCents: 0,
      reasoning: [
        `Reliability score: ${supplier.reliabilityScore}/100`,
        `Average lead time: ${supplier.averageLeadTimeDays} days`,
      ],
    });
  }

  const quoteGroups = new Map<string, Array<typeof opcopilotSupplierQuotes.$inferSelect>>();
  for (const quote of quotes) {
    const group = quoteGroups.get(quote.inventoryItemId) ?? [];
    group.push(quote);
    quoteGroups.set(quote.inventoryItemId, group);
  }

  for (const [itemId, group] of quoteGroups.entries()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => a.landedCostCents - b.landedCostCents
    );
    const cheapest = sorted[0]!;
    const expensive = sorted[sorted.length - 1]!;
    const spread = expensive.landedCostCents - cheapest.landedCostCents;
    if (spread <= 0) continue;

    const item = inventory.find((candidate) => candidate.id === itemId);
    insights.push({
      id: `savings-${itemId}`,
      type: "savings",
      title: `${item?.itemName ?? "Item"} supplier spread detected`,
      summary: `Supplier quote spread is ${money(spread)} per unit on ${item?.itemName ?? "this item"}.`,
      recommendedAction: "Route the next order to the lowest landed-cost supplier if reliability is acceptable.",
      urgency: spread > 2500 ? "high" : "medium",
      confidence: "high",
      riskScore: 44,
      estimatedImpactCents: spread,
      reasoning: [
        `Lowest landed cost: ${money(cheapest.landedCostCents)}`,
        `Highest landed cost: ${money(expensive.landedCostCents)}`,
        `Quotes compared: ${group.length}`,
      ],
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: randomUUID(),
      type: "data_readiness",
      title: "Command center ready for operating data",
      summary:
        "Inventory, supplier, and quote feeds are not loaded yet. Once connected, I can detect shortages, overpayment, supplier risk, and reorder timing automatically.",
      recommendedAction:
        "Import current inventory counts, top suppliers, last purchase prices, lead times, and approval rules.",
      urgency: "medium",
      confidence: "high",
      riskScore: 35,
      estimatedImpactCents: 0,
      reasoning: [
        "No active inventory records were found.",
        "No supplier quote history was found.",
        "AI autonomy remains in controlled draft mode until policy is configured.",
      ],
    });
  }

  return insights.sort((a, b) => b.riskScore - a.riskScore);
}

function buildHealthCards({
  projectedSavingsCents,
  pendingApprovalCount,
  atRiskInventoryCount,
  insights,
  smartBuys,
  riskAlerts,
}: {
  projectedSavingsCents: number;
  pendingApprovalCount: number;
  atRiskInventoryCount: number;
  insights: CopilotInsight[];
  smartBuys: SmartBuyRecommendation[];
  riskAlerts: ProcurementRiskAlert[];
}): CostHealthCard[] {
  const priceIncreases = insights.filter((insight) => insight.type === "price_spike").length;
  const topSavings = Math.max(0, ...smartBuys.map((buy) => buy.estimatedSavingsCents), projectedSavingsCents);
  const criticalRisks = riskAlerts.filter((risk) => risk.severity === "critical" || risk.severity === "high").length;

  return [
    {
      id: "savings-found",
      label: "Savings Found This Month",
      value: money(projectedSavingsCents),
      detail: "Open savings and avoided overpayment signals from loaded supplier and inventory data.",
      tone: projectedSavingsCents > 0 ? "green" : "neutral",
      href: "#savings-feed",
    },
    {
      id: "orders-awaiting-approval",
      label: "Orders Awaiting Approval",
      value: String(pendingApprovalCount),
      detail: "AI-created action requests waiting for an owner or admin decision.",
      tone: pendingApprovalCount > 0 ? "amber" : "green",
      href: "#action-center",
    },
    {
      id: "items-running-low",
      label: "Items Running Low",
      value: String(atRiskInventoryCount),
      detail: "Items at or below reorder point, or projected to run out within seven days.",
      tone: atRiskInventoryCount > 0 ? "red" : "green",
      href: "#inventory-risk",
    },
    {
      id: "vendor-price-increases",
      label: "Vendor Price Increases",
      value: String(priceIncreases),
      detail: "Price-spike events from captured quotes, benchmarks, or imported supplier updates.",
      tone: priceIncreases > 0 ? "amber" : "green",
      href: "#vendor-watch",
    },
    {
      id: "top-cost-leak",
      label: "Top Cost Leak",
      value: money(topSavings),
      detail: "Largest visible monthly savings or supplier-spread opportunity.",
      tone: topSavings > 0 ? "green" : "neutral",
      href: "#smart-buy",
    },
    {
      id: "inventory-risk",
      label: "Inventory Risk",
      value: criticalRisks > 0 ? "Needs review" : "Stable",
      detail: "Stockout, vendor, duplicate order, overstock, and abnormal spend watchlist.",
      tone: criticalRisks > 0 ? "red" : "green",
      href: "#risk-detection",
    },
    {
      id: "overstock-risk",
      label: "Overstock Risk",
      value: insights.some((insight) => insight.type === "overstock") ? "Watch" : "Clear",
      detail: "Slow-moving or excess inventory signals. Requires order history for stronger detection.",
      tone: insights.some((insight) => insight.type === "overstock") ? "amber" : "green",
      href: "#inventory-risk",
    },
    {
      id: "recommended-orders",
      label: "Recommended Orders",
      value: String(smartBuys.length),
      detail: "Smart Buy suggestions prepared for safe approval workflow.",
      tone: smartBuys.length > 0 ? "blue" : "neutral",
      href: "#smart-buy",
    },
  ];
}

function buildAiExecutiveSummary({
  companyName,
  projectedSavingsCents,
  pendingApprovalCount,
  atRiskInventoryCount,
  riskAlerts,
  smartBuys,
}: {
  companyName: string;
  projectedSavingsCents: number;
  pendingApprovalCount: number;
  atRiskInventoryCount: number;
  riskAlerts: ProcurementRiskAlert[];
  smartBuys: SmartBuyRecommendation[];
}) {
  const topBuy = smartBuys[0];
  const riskCount = riskAlerts.filter((risk) => risk.severity !== "low").length;
  const recommendation =
    topBuy
      ? `I recommend reviewing ${topBuy.itemName} from ${topBuy.bestVendor}; it could save about ${money(topBuy.estimatedSavingsCents)} on the next smart buy.`
      : "I recommend loading current invoices and supplier quotes so I can find verified savings.";

  return [
    `Good morning. I reviewed ${companyName}'s inventory, vendors, approvals, and price signals.`,
    `I found ${money(projectedSavingsCents)} in visible savings opportunity, ${pendingApprovalCount} order/action approval${pendingApprovalCount === 1 ? "" : "s"}, ${atRiskInventoryCount} item${atRiskInventoryCount === 1 ? "" : "s"} at supply risk, and ${riskCount} active alert${riskCount === 1 ? "" : "s"} that need attention.`,
    recommendation,
  ].join(" ");
}

function buildSmartBuyRecommendations({
  inventory,
  suppliers,
  quotes,
}: {
  inventory: InventoryRow[];
  suppliers: SupplierRow[];
  quotes: QuoteRow[];
}): SmartBuyRecommendation[] {
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const quoteGroups = new Map<string, QuoteRow[]>();
  for (const quote of quotes) {
    const group = quoteGroups.get(quote.inventoryItemId) ?? [];
    group.push(quote);
    quoteGroups.set(quote.inventoryItemId, group);
  }

  return inventory.flatMap((item) => {
    const group = quoteGroups.get(item.id) ?? [];
    if (group.length < 2) return [];

    const sorted = [...group].sort((a, b) => a.landedCostCents - b.landedCostCents);
    const bestQuote = sorted[0]!;
    const currentQuote = sorted[sorted.length - 1]!;
    const spread = currentQuote.landedCostCents - bestQuote.landedCostCents;
    if (spread <= 0) return [];

    const onHand = toNumber(item.onHandQuantity);
    const target = toNumber(item.targetStockQuantity);
    const reorder = toNumber(item.reorderPointQuantity);
    const dailyUse = toNumber(item.averageDailyUse);
    const quantityRecommended = Math.max(
      1,
      Math.round(target > onHand ? target - onHand : Math.max(reorder, dailyUse * 7))
    );
    const daysRemaining = dailyUse > 0 ? onHand / dailyUse : null;
    const bestVendor = supplierById.get(bestQuote.supplierId);
    const currentVendor = supplierById.get(currentQuote.supplierId);
    const riskLevel: SmartBuyRecommendation["riskLevel"] =
      daysRemaining !== null && daysRemaining <= 3
        ? "critical"
        : daysRemaining !== null && daysRemaining <= 7
          ? "high"
          : "medium";

    return [
      {
        id: `smart-buy-${item.id}`,
        itemName: item.itemName,
        currentVendor: currentVendor?.supplierName ?? "Current vendor",
        bestVendor: bestVendor?.supplierName ?? "Best available vendor",
        currentPriceCents: currentQuote.landedCostCents,
        betterPriceCents: bestQuote.landedCostCents,
        estimatedSavingsCents: spread * quantityRecommended,
        quantityRecommended,
        inventoryImpact:
          daysRemaining !== null
            ? `Covers roughly ${Math.max(1, Math.round(quantityRecommended / Math.max(1, dailyUse)))} days of usage. Current stock has about ${Math.max(1, Math.round(daysRemaining))} days left.`
            : "Replenishes toward target stock once usage data is verified.",
        deliveryTiming: `${bestQuote.leadTimeDays} day${bestQuote.leadTimeDays === 1 ? "" : "s"} estimated lead time`,
        riskLevel,
        explanation: `${bestVendor?.supplierName ?? "The best vendor"} is ${money(spread)} lower per ${item.unit} than ${currentVendor?.supplierName ?? "the current baseline"}. This creates a safe approval-ready Smart Buy, not a live supplier order.`,
      },
    ];
  }).sort((a, b) => b.estimatedSavingsCents - a.estimatedSavingsCents).slice(0, 4);
}

function buildSavingsFeed({
  insights,
  smartBuys,
}: {
  insights: CopilotInsight[];
  smartBuys: SmartBuyRecommendation[];
}): SavingsFeedEvent[] {
  const insightEvents = insights
    .filter((insight) => insight.type !== "data_readiness")
    .map((insight) => ({
      id: `feed-${insight.id}`,
      title: insight.title,
      detail: insight.summary,
      impactCents: insight.estimatedImpactCents,
      urgency: insight.urgency,
    }));
  const smartBuyEvents = smartBuys.map((buy) => ({
    id: `feed-${buy.id}`,
    title: `Smart Buy found for ${buy.itemName}`,
    detail: `${buy.bestVendor} beats ${buy.currentVendor}. Estimated order savings: ${money(buy.estimatedSavingsCents)}.`,
    impactCents: buy.estimatedSavingsCents,
    urgency: buy.riskLevel === "critical" ? "critical" : buy.riskLevel === "high" ? "high" : "medium",
  } satisfies SavingsFeedEvent));

  return [...smartBuyEvents, ...insightEvents]
    .sort((a, b) => b.impactCents - a.impactCents)
    .slice(0, 8);
}

function buildInventoryForecasts(inventory: InventoryRow[]): InventoryForecast[] {
  return inventory
    .map((item) => {
      const onHand = toNumber(item.onHandQuantity);
      const dailyUse = toNumber(item.averageDailyUse);
      const reorderPoint = toNumber(item.reorderPointQuantity);
      const targetStock = toNumber(item.targetStockQuantity);
      const daysUntilStockout = dailyUse > 0 ? onHand / dailyUse : null;
      const shortage = onHand <= reorderPoint || (daysUntilStockout !== null && daysUntilStockout <= 7);
      const quantity = Math.max(0, Math.round(targetStock - onHand));
      const riskLevel =
        daysUntilStockout !== null && daysUntilStockout <= 3
          ? "critical"
          : shortage
            ? "high"
            : onHand > targetStock * 1.35 && targetStock > 0
              ? "medium"
              : "low";

      return {
        id: item.id,
        itemName: item.itemName,
        category: item.category,
        daysUntilStockout: daysUntilStockout === null ? null : Math.max(0, Math.round(daysUntilStockout)),
        usageVelocity: dailyUse > 0 ? `${dailyUse} ${item.unit}/day` : "Usage not loaded",
        reorderRecommendation:
          quantity > 0
            ? `Reorder about ${quantity} ${item.unit} to reach target stock.`
            : "No reorder needed right now.",
        confidence: dailyUse > 0 ? "high" : "low",
        riskLevel,
      } satisfies InventoryForecast;
    })
    .sort((a, b) => {
      const aDays = a.daysUntilStockout ?? 9999;
      const bDays = b.daysUntilStockout ?? 9999;
      return aDays - bDays;
    });
}

function buildVendorScorecards({
  suppliers,
  quotes,
}: {
  suppliers: SupplierRow[];
  quotes: QuoteRow[];
}): VendorScorecard[] {
  return suppliers
    .map((supplier) => {
      const supplierQuotes = quotes.filter((quote) => quote.supplierId === supplier.id);
      const totalTrackedSpendCents = supplierQuotes.reduce(
        (sum, quote) => sum + quote.landedCostCents,
        0
      );
      const itemIds = new Set(supplierQuotes.map((quote) => quote.inventoryItemId));
      const riskScore = Math.min(
        100,
        Math.max(0, 100 - supplier.reliabilityScore + supplier.averageLeadTimeDays * 4)
      );
      const deliveryIssueRisk =
        supplier.reliabilityScore < 70 || supplier.averageLeadTimeDays > 5
          ? "high"
          : supplier.reliabilityScore < 82
            ? "medium"
            : "low";

      return {
        id: supplier.id,
        supplierName: supplier.supplierName,
        reliabilityScore: supplier.reliabilityScore,
        priceTrend:
          supplier.reliabilityScore < 70
            ? "risk"
            : supplier.averageLeadTimeDays > 4
              ? "watch"
              : "stable",
        totalTrackedSpendCents,
        deliveryIssueRisk,
        savingsOpportunityCount: supplierQuotes.filter((quote) => quote.landedCostCents > 0).length,
        itemsPurchased: itemIds.size,
        alternativeVendorCount: Math.max(0, suppliers.length - 1),
        riskScore,
      } satisfies VendorScorecard;
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

function buildRiskAlerts({
  insights,
  suppliers,
  pendingActionsCount,
}: {
  insights: CopilotInsight[];
  suppliers: SupplierRow[];
  pendingActionsCount: number;
}): ProcurementRiskAlert[] {
  const fromInsights = insights
    .filter((insight) => insight.type !== "data_readiness")
    .map((insight) => ({
      id: `risk-${insight.id}`,
      title: insight.title,
      detail: insight.summary,
      severity: insight.urgency,
      recommendedAction: insight.recommendedAction,
    } satisfies ProcurementRiskAlert));
  const vendorDependency = suppliers.length === 1
    ? [
        {
          id: "risk-vendor-dependency",
          title: "Vendor dependency risk",
          detail: "Only one active supplier is loaded. Add backup suppliers before relying on emergency ordering.",
          severity: "medium" as const,
          recommendedAction: "Add at least one backup supplier for critical categories.",
        },
      ]
    : [];
  const duplicateOrder = pendingActionsCount > 3
    ? [
        {
          id: "risk-duplicate-orders",
          title: "Duplicate order risk",
          detail: "Several order/action requests are pending. Review before approving more buys.",
          severity: "medium" as const,
          recommendedAction: "Open the approval queue and consolidate overlapping requests.",
        },
      ]
    : [];

  const alerts = [...fromInsights, ...vendorDependency, ...duplicateOrder].slice(0, 8);
  if (alerts.length > 0) return alerts;

  return [
    {
      id: "risk-data-readiness",
      title: "Connect purchase history for stronger risk detection",
      detail: "No active vendor, duplicate order, late delivery, or abnormal spend risk is visible from the loaded data.",
      severity: "low",
      recommendedAction: "Import invoices, order history, delivery dates, and current inventory counts.",
    },
  ];
}

function buildWeeklyReport({
  insights,
  actionRequests,
  atRiskInventoryCount,
  vendorScorecards,
}: {
  insights: CopilotInsight[];
  actionRequests: ActionRequestRow[];
  atRiskInventoryCount: number;
  vendorScorecards: VendorScorecard[];
}): WeeklyAiReport {
  const biggest = [...insights].sort(
    (a, b) => b.estimatedImpactCents - a.estimatedImpactCents
  )[0];
  const topVendorIssue = vendorScorecards[0];
  const totalSavingsApprovedCents = actionRequests
    .filter((action) => action.status === "approved")
    .reduce((sum, action) => sum + action.estimatedSavingsCents, 0);

  return {
    totalSavingsFoundCents: insights.reduce(
      (sum, insight) => sum + Math.max(0, insight.estimatedImpactCents),
      0
    ),
    totalSavingsApprovedCents,
    biggestCostLeak: biggest?.title ?? "No cost leak loaded yet",
    topVendorIssue: topVendorIssue
      ? `${topVendorIssue.supplierName} risk score ${topVendorIssue.riskScore}/100`
      : "No supplier issue loaded yet",
    itemsAtRisk: atRiskInventoryCount,
    recommendedActions: insights.slice(0, 3).map((insight) => insight.recommendedAction),
    nextWeekFocus:
      atRiskInventoryCount > 0
        ? "Stabilize low-stock items, then approve the highest-confidence savings order."
        : "Load more supplier quotes and purchase history to expand verified savings.",
  };
}

function buildBusinessMemorySummary(context: ContextRow): BusinessMemorySummary {
  const memory = context?.preferenceMemory ?? {};
  const approvalPolicy = context?.approvalPolicy ?? { autonomyLevel: 1 };
  return {
    preferredVendors: memory.preferredSuppliers ?? [],
    preferredBrands: memory.preferredBrands ?? [],
    approvalThresholdCents: approvalPolicy.autoApproveUnderCents ?? 0,
    substituteTolerance: memory.substituteTolerance ?? "medium",
    categoryPriorities: Object.keys(memory.marginTargets ?? {}),
    neverSubstituteCount: (memory.rejectedRecommendations ?? []).length,
  };
}

function buildEmergencyItems({
  inventoryForecasts,
  smartBuys,
  suppliers,
}: {
  inventoryForecasts: InventoryForecast[];
  smartBuys: SmartBuyRecommendation[];
  suppliers: SupplierRow[];
}): EmergencyProcurementItem[] {
  const fastestSupplier = [...suppliers].sort(
    (a, b) => a.averageLeadTimeDays - b.averageLeadTimeDays
  )[0];
  return inventoryForecasts
    .filter((forecast) => forecast.riskLevel === "critical" || forecast.riskLevel === "high")
    .slice(0, 4)
    .map((forecast) => {
      const smartBuy = smartBuys.find((buy) => buy.itemName === forecast.itemName);
      return {
        id: `emergency-${forecast.id}`,
        itemName: forecast.itemName,
        shortageReason:
          forecast.daysUntilStockout !== null
            ? `${forecast.daysUntilStockout} day${forecast.daysUntilStockout === 1 ? "" : "s"} until projected stockout`
            : "Stockout risk needs usage data",
        backupVendor: smartBuy?.bestVendor ?? fastestSupplier?.supplierName ?? "Add backup supplier",
        fastestOption: smartBuy?.deliveryTiming ?? `${fastestSupplier?.averageLeadTimeDays ?? 3} day estimated lead`,
        estimatedCostCents: smartBuy
          ? smartBuy.betterPriceCents * smartBuy.quantityRecommended
          : 0,
        recommendedAction: smartBuy
          ? "Create an approval-ready emergency order; external ordering remains manual."
          : "Add supplier quote data, then prepare a manual emergency order.",
      };
    });
}

function buildQuickActions(): CopilotQuickAction[] {
  return [
    {
      id: "reorder-now",
      label: "Reorder Now",
      description: "Prepare the highest urgency replenishment order for approval.",
      actionType: "reorder_now",
    },
    {
      id: "show-savings",
      label: "Show Savings",
      description: "Summarize active savings, avoided overpayment, and margin impact.",
      actionType: "show_savings",
    },
    {
      id: "optimize-purchasing",
      label: "Optimize Purchasing",
      description: "Find overpayment, split-order, and consolidation opportunities.",
      actionType: "optimize_purchasing",
    },
    {
      id: "prepare-weekly-order",
      label: "Prepare Weekly Order",
      description: "Draft next week's purchase plan with risk, savings, and approval flags.",
      actionType: "prepare_weekly_order",
    },
    {
      id: "forecast-inventory-risk",
      label: "Forecast Inventory Risk",
      description: "Project shortages, overstock, slow movers, and demand spikes.",
      actionType: "forecast_inventory_risk",
    },
    {
      id: "find-cheapest-supplier",
      label: "Find Cheapest Supplier",
      description: "Compare quotes by landed cost, delivery timing, and reliability.",
      actionType: "find_cheapest_supplier",
    },
    {
      id: "generate-procurement-report",
      label: "Generate Procurement Report",
      description: "Create an executive savings, supplier, and risk summary.",
      actionType: "generate_procurement_report",
    },
    {
      id: "review-ai-recommendations",
      label: "Review AI Recommendations",
      description: "Open all current operational signals and recommended actions.",
      actionType: "review_ai_recommendations",
    },
    {
      id: "approve-pending-orders",
      label: "Approve Pending Orders",
      description: "Review low-risk pending orders against approval rules.",
      actionType: "approve_pending_orders",
    },
    {
      id: "review-supplier-performance",
      label: "Review Supplier Performance",
      description: "Rank suppliers by reliability, lead time, and pricing behavior.",
      actionType: "review_supplier_performance",
    },
    {
      id: "analyze-margin-impact",
      label: "Analyze Margin Impact",
      description: "Prioritize inventory and purchasing moves by gross margin effect.",
      actionType: "analyze_margin_impact",
    },
    {
      id: "detect-waste-opportunities",
      label: "Detect Waste Opportunities",
      description: "Find excess stock, slow movers, and aging inventory risk.",
      actionType: "detect_waste_opportunities",
    },
  ];
}

function buildActivityFeed({
  insights,
  pendingActionsCount,
}: {
  insights: CopilotInsight[];
  pendingActionsCount: number;
}) {
  return [
    `${insights.length} operational signals evaluated`,
    `${pendingActionsCount} actions awaiting approval`,
    "Approval rules checked before autonomy decisions",
    "Supplier, inventory, risk, and savings engines synchronized",
  ];
}

function normalizeInsightType(value: string): CopilotInsight["type"] {
  const allowed: CopilotInsight["type"][] = [
    "shortage",
    "price_spike",
    "supplier_risk",
    "savings",
    "bulk_buy",
    "overstock",
    "forecast",
    "data_readiness",
  ];
  return allowed.includes(value as CopilotInsight["type"])
    ? (value as CopilotInsight["type"])
    : "forecast";
}

function normalizeUrgency(value: string): CopilotInsight["urgency"] {
  return value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
    ? value
    : "medium";
}

function normalizeConfidence(value: string): CopilotInsight["confidence"] {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "medium";
}

function formatAnswer({
  title,
  lead,
  snapshot,
  action,
}: {
  title: string;
  lead: string;
  snapshot: CopilotSnapshot;
  action: string;
}) {
  return [
    `**${title}**`,
    lead,
    "",
    `Current command score: ${snapshot.healthScore}/100.`,
    `Projected savings in active signals: ${money(snapshot.projectedSavingsCents)}.`,
    `At-risk inventory items: ${snapshot.atRiskInventoryCount}.`,
    `Pending approvals: ${snapshot.pendingApprovalCount}.`,
    "",
    `Recommended next action: ${action}`,
  ].join("\n");
}

export { money as formatCopilotMoney };
