import {
  industryPriceCatalogs,
  type IndustryPriceCatalog,
} from "@/lib/operations-copilot/industry-catalog";
import { listOperationsCopilotData } from "@/lib/operations-copilot/intelligence";
import { buildSupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";
import { buildSupplyOpportunityBoard } from "@/lib/operations-copilot/supply-opportunities";
import {
  buildSupplierConnectorControlPanel,
  buildSupplierSearchUrl,
  resolveSupplierConnector,
  type SupplierConnector,
} from "@/lib/operations-copilot/supplier-connectors";

export type DeliveryPreference = "cheapest" | "fastest" | "balanced" | "local_first";

export type BusinessDeliveryProfile = {
  businessName: string;
  businessAddress: string;
  deliveryInstructions: string;
  preferredDeliveryWindows: string[];
  receivingLocation: "front_door" | "back_door" | "loading_dock" | "contact_person";
  receivingContact: string;
  taxExemptStatus: "unknown" | "yes" | "no";
  preferredSuppliers: string[];
  restrictedSuppliers: string[];
  localPickupRadiusMiles: number;
  deliveryPreference: DeliveryPreference;
  profileCompleteness: number;
  missingFields: string[];
};

export type DeliveryOptionKind =
  | "delivered_to_business"
  | "pickup_available_today"
  | "delivered_tomorrow"
  | "free_delivery_over_minimum"
  | "supplier_truck_delivery"
  | "third_party_delivery_required"
  | "local_courier_option"
  | "not_delivery_eligible";

export type RecommendationUrgency = "high" | "medium" | "low";

export type ProcurementRecommendationStatus =
  | "recommendation_found"
  | "pending_owner_approval"
  | "quote_requested"
  | "approved"
  | "ordered_manually"
  | "ordered_through_supplier"
  | "delivered"
  | "ignored"
  | "needs_review";

export type SavingsAudit = {
  currentVendorTotalCostCents: number;
  recommendedTotalDeliveredCostCents: number;
  savingsPerOrderCents: number;
  monthlyEstimatedSavingsCents: number;
  currentUnitPriceCents: number;
  recommendedUnitPriceCents: number;
  currentDeliveryFeeCents: number;
  recommendedDeliveryFeeCents: number;
  estimatedFeesCents: number;
  spoilageRiskCents: number;
  substitutionRiskCents: number;
  receivingBurdenCents: number;
  orderingFrequencyBurdenCents: number;
  trueLandedCostNotes: string[];
  orderQuantity: number;
  monthlyUsageEstimate: number;
  formula: string;
  dataQuality: "verified" | "estimated" | "benchmark";
};

export type BestPriceDeliveryRecommendation = {
  id: string;
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  supplierName: string;
  currentVendorName: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  urgency: RecommendationUrgency;
  status: ProcurementRecommendationStatus;
  deliveryOption: DeliveryOptionKind;
  deliveryLabel: string;
  estimatedDeliveryDateLabel: string;
  itemMatchConfidence: "low" | "medium" | "high";
  supplierReliabilityScore: number;
  searchUrl: string | null;
  connector: Pick<
    SupplierConnector,
    | "mode"
    | "supportsDelivery"
    | "supportsPickup"
    | "supportsSupplierTruck"
    | "lastCheckedLabel"
    | "complianceNotes"
    | "liveOrderingEnabled"
  >;
  savingsAudit: SavingsAudit;
};

export type BestPriceDeliveryBoard = {
  industryId: IndustryPriceCatalog["id"];
  industryLabel: string;
  region: string;
  zipCode: string;
  asOfDate: Date;
  businessProfile: BusinessDeliveryProfile;
  recommendationCount: number;
  deliveryReadyCount: number;
  needsReviewCount: number;
  pendingApprovalCount: number;
  totalMonthlySavingsCents: number;
  topSavingsCents: number;
  recommendedNextStep: string;
  recommendations: BestPriceDeliveryRecommendation[];
  connectorControlPanel: ReturnType<typeof buildSupplierConnectorControlPanel>;
  workflowStatuses: Array<{
    status: ProcurementRecommendationStatus;
    label: string;
    description: string;
  }>;
  notificationHooks: Array<{
    label: string;
    status: "ready_for_review" | "requires_integration" | "disabled";
    description: string;
  }>;
  dataNotices: string[];
};

export async function buildBestPriceDeliveryBoard({
  userId,
  industryId = "roofing",
}: {
  userId: string;
  industryId?: IndustryPriceCatalog["id"];
}): Promise<BestPriceDeliveryBoard> {
  const catalog =
    industryPriceCatalogs.find((candidate) => candidate.id === industryId) ??
    industryPriceCatalogs[0];

  if (!catalog) {
    throw new Error("No procurement industry catalog is configured.");
  }

  const [data, priceIntelligence] = await Promise.all([
    listOperationsCopilotData(userId),
    buildSupplierPriceIntelligence({ catalog, userId }),
  ]);

  const opportunityBoard = buildSupplyOpportunityBoard({
    catalog,
    intelligence: priceIntelligence,
  });
  const businessProfile = buildBusinessDeliveryProfile(data.context);
  const recommendations = opportunityBoard.rows
    .slice(0, 12)
    .map((row) =>
      buildRecommendation({
        row,
        supplierRecords: data.suppliers,
      })
    );

  const totalMonthlySavingsCents = recommendations.reduce(
    (sum, recommendation) =>
      sum + Math.max(0, recommendation.savingsAudit.monthlyEstimatedSavingsCents),
    0
  );
  const topSavingsCents = Math.max(
    0,
    ...recommendations.map(
      (recommendation) => recommendation.savingsAudit.monthlyEstimatedSavingsCents
    )
  );
  const deliveryReadyCount = recommendations.filter(
    (recommendation) => recommendation.deliveryOption !== "not_delivery_eligible"
  ).length;
  const needsReviewCount = recommendations.filter(
    (recommendation) =>
      recommendation.savingsAudit.dataQuality !== "verified" ||
      recommendation.itemMatchConfidence !== "high"
  ).length;
  const pendingApprovalCount = data.actionRequests.filter(
    (request) => request.status === "pending_approval"
  ).length;

  return {
    industryId: catalog.id,
    industryLabel: catalog.label,
    region: opportunityBoard.region,
    zipCode: opportunityBoard.zipCode,
    asOfDate: opportunityBoard.asOfDate,
    businessProfile,
    recommendationCount: recommendations.length,
    deliveryReadyCount,
    needsReviewCount,
    pendingApprovalCount,
    totalMonthlySavingsCents,
    topSavingsCents,
    recommendedNextStep: resolveRecommendedNextStep({
      businessProfile,
      recommendations,
      pendingApprovalCount,
    }),
    recommendations,
    connectorControlPanel: buildSupplierConnectorControlPanel({ catalog }),
    workflowStatuses: buildWorkflowStatuses(),
    notificationHooks: buildNotificationHooks(),
    dataNotices: [
      "Live ordering is disabled. Approval actions queue owner/admin review and do not place supplier orders.",
      "Supplier prices are captured snapshots or benchmark estimates until invoice, quote, CSV, or approved API data is connected.",
      "Delivery fees, taxes, minimums, and arrival dates are estimates unless marked verified from supplier account data.",
    ],
  };
}

function buildRecommendation({
  row,
  supplierRecords,
}: {
  row: ReturnType<typeof buildSupplyOpportunityBoard>["rows"][number];
  supplierRecords: Array<{
    supplierName: string;
    reliabilityScore: number;
    deliveryFeeCents: number;
    minimumOrderCents: number;
    averageLeadTimeDays: number;
  }>;
}): BestPriceDeliveryRecommendation {
  const connector = resolveSupplierConnector(row.supplierName);
  const supplierRecord = supplierRecords.find((supplier) =>
    supplierNamesMatch(supplier.supplierName, row.supplierName)
  );
  const orderQuantity = Math.max(1, Math.round(row.estimatedWeeklyQuantity));
  const currentDeliveryFeeCents = resolveCurrentDeliveryFee(row.baselinePriceCents, orderQuantity);
  const recommendedDeliveryFeeCents = resolveRecommendedDeliveryFee({
    connector,
    supplierRecord,
    orderSubtotalCents: row.bestTodayPriceCents * orderQuantity,
  });
  const estimatedFeesCents = 0;
  const deliveryOption = resolveDeliveryOption({ connector, supplierRecord });
  const trueCostAdjustments = buildTrueCostAdjustments({
    category: row.category,
    connector,
    deliveryOption,
    itemMatchConfidence: row.confidence,
    orderQuantity,
    recommendedUnitPriceCents: row.bestTodayPriceCents,
    supplierReliabilityScore:
      supplierRecord?.reliabilityScore ?? Math.round(connector.confidenceScore),
  });
  const currentVendorTotalCostCents =
    row.baselinePriceCents * orderQuantity +
    currentDeliveryFeeCents +
    estimatedFeesCents +
    trueCostAdjustments.currentReceivingBurdenCents +
    trueCostAdjustments.currentOrderingFrequencyBurdenCents;
  const recommendedTotalDeliveredCostCents =
    row.bestTodayPriceCents * orderQuantity +
    recommendedDeliveryFeeCents +
    estimatedFeesCents +
    trueCostAdjustments.spoilageRiskCents +
    trueCostAdjustments.substitutionRiskCents +
    trueCostAdjustments.receivingBurdenCents +
    trueCostAdjustments.orderingFrequencyBurdenCents;
  const savingsPerOrderCents =
    currentVendorTotalCostCents - recommendedTotalDeliveredCostCents;
  const monthlyUsageEstimate = Math.max(1, Math.round(row.estimatedWeeklyQuantity * 4.33));
  const monthlyEstimatedSavingsCents = Math.round(
    savingsPerOrderCents * (monthlyUsageEstimate / orderQuantity)
  );
  const deliveryLabel = formatDeliveryLabel(deliveryOption);
  const estimatedDeliveryDateLabel = formatEstimatedDeliveryDate(
    supplierRecord?.averageLeadTimeDays ?? connector.defaultLeadTimeDays
  );
  const urgency = resolveUrgency({
    monthlyEstimatedSavingsCents,
    deliveryOption,
    sku: row.sku,
  });
  const dataQuality =
    row.sourceLabel === "Captured price snapshot"
      ? "verified"
      : row.confidence === "medium"
        ? "estimated"
        : "benchmark";

  return {
    id: `${row.sku}-${slugify(row.supplierName)}`,
    sku: row.sku,
    itemName: row.itemName,
    category: row.category,
    unit: row.unit,
    supplierName: row.supplierName,
    currentVendorName: "Current vendor baseline",
    title: buildRecommendationTitle({
      itemName: row.itemName,
      monthlyEstimatedSavingsCents,
      deliveryOption,
    }),
    explanation: buildRecommendationExplanation({
      row,
      monthlyEstimatedSavingsCents,
      deliveryLabel,
      dataQuality,
    }),
    recommendedAction:
      monthlyEstimatedSavingsCents > 0
        ? "Request a verified quote, then send to owner/admin approval before ordering."
        : "Review this item before buying. The current vendor may be competitive or the benchmark may be stale.",
    urgency,
    status: dataQuality === "verified" ? "recommendation_found" : "needs_review",
    deliveryOption,
    deliveryLabel,
    estimatedDeliveryDateLabel,
    itemMatchConfidence: row.confidence,
    supplierReliabilityScore:
      supplierRecord?.reliabilityScore ?? Math.round(connector.confidenceScore),
    searchUrl: buildSupplierSearchUrl({
      supplierName: row.supplierName,
      query: `${row.itemName} ${row.unit}`,
    }),
    connector: {
      mode: connector.mode,
      supportsDelivery: connector.supportsDelivery,
      supportsPickup: connector.supportsPickup,
      supportsSupplierTruck: connector.supportsSupplierTruck,
      lastCheckedLabel: connector.lastCheckedLabel,
      complianceNotes: connector.complianceNotes,
      liveOrderingEnabled: connector.liveOrderingEnabled,
    },
    savingsAudit: {
      currentVendorTotalCostCents,
      recommendedTotalDeliveredCostCents,
      savingsPerOrderCents,
      monthlyEstimatedSavingsCents,
      currentUnitPriceCents: row.baselinePriceCents,
      recommendedUnitPriceCents: row.bestTodayPriceCents,
      currentDeliveryFeeCents,
      recommendedDeliveryFeeCents,
      estimatedFeesCents,
      spoilageRiskCents: trueCostAdjustments.spoilageRiskCents,
      substitutionRiskCents: trueCostAdjustments.substitutionRiskCents,
      receivingBurdenCents: trueCostAdjustments.receivingBurdenCents,
      orderingFrequencyBurdenCents: trueCostAdjustments.orderingFrequencyBurdenCents,
      trueLandedCostNotes: trueCostAdjustments.notes,
      orderQuantity,
      monthlyUsageEstimate,
      formula:
        "Savings = current true landed cost minus recommended true landed cost. True landed cost includes unit price, delivery, fees, spoilage/substitution risk, receiving burden, and ordering frequency burden. Monthly savings multiplies order savings by estimated monthly usage.",
      dataQuality,
    },
  };
}

function buildTrueCostAdjustments({
  category,
  connector,
  deliveryOption,
  itemMatchConfidence,
  orderQuantity,
  recommendedUnitPriceCents,
  supplierReliabilityScore,
}: {
  category: string;
  connector: SupplierConnector;
  deliveryOption: DeliveryOptionKind;
  itemMatchConfidence: "low" | "medium" | "high";
  orderQuantity: number;
  recommendedUnitPriceCents: number;
  supplierReliabilityScore: number;
}) {
  const productSubtotal = recommendedUnitPriceCents * orderQuantity;
  const spoilageRiskCents = /produce|dairy|bakery|food|perishable/i.test(category)
    ? Math.round(productSubtotal * 0.03)
    : 0;
  const substitutionRiskCents =
    itemMatchConfidence === "low"
      ? Math.round(productSubtotal * 0.04)
      : itemMatchConfidence === "medium"
        ? Math.round(productSubtotal * 0.015)
        : 0;
  const receivingBurdenCents =
    deliveryOption === "pickup_available_today"
      ? 2200
      : deliveryOption === "third_party_delivery_required"
        ? 1800
        : 900;
  const orderingFrequencyBurdenCents = connector.freeDeliveryMinimumCents === null ? 400 : 700;
  const reliabilityAdjustmentCents =
    supplierReliabilityScore < 70 ? Math.round(productSubtotal * 0.025) : 0;

  return {
    spoilageRiskCents,
    substitutionRiskCents: substitutionRiskCents + reliabilityAdjustmentCents,
    receivingBurdenCents,
    orderingFrequencyBurdenCents,
    currentReceivingBurdenCents: 1400,
    currentOrderingFrequencyBurdenCents: 900,
    notes: [
      "Includes delivery and handling burden, not just product shelf price.",
      spoilageRiskCents > 0 ? "Perishable category includes spoilage exposure." : "No perishable spoilage add-on applied.",
      substitutionRiskCents > 0 || reliabilityAdjustmentCents > 0
        ? "Substitution/reliability risk included before approval."
        : "Supplier/item match risk is low from loaded data.",
    ],
  };
}

function buildBusinessDeliveryProfile(context: Awaited<ReturnType<typeof listOperationsCopilotData>>["context"]): BusinessDeliveryProfile {
  const memory = asRecord(context?.preferenceMemory);
  const deliveryProfile = asRecord(memory.deliveryProfile);
  const preferredSuppliers = readStringArray(
    deliveryProfile,
    "preferredSuppliers",
    readStringArray(memory, "preferredSuppliers", [])
  );
  const restrictedSuppliers = readStringArray(deliveryProfile, "restrictedSuppliers", []);
  const businessAddress = readString(
    deliveryProfile,
    "businessAddress",
    "Add delivery address in business profile"
  );
  const preferredDeliveryWindows = readStringArray(
    deliveryProfile,
    "preferredDeliveryWindows",
    ["Weekdays 8 AM to 4 PM"]
  );
  const deliveryInstructions = readString(
    deliveryProfile,
    "deliveryInstructions",
    "Add receiving notes, parking, dock, or door instructions"
  );
  const receivingContact = readString(
    deliveryProfile,
    "receivingContact",
    "Add receiving contact"
  );
  const missingFields = [
    businessAddress.startsWith("Add") ? "business address" : "",
    deliveryInstructions.startsWith("Add") ? "delivery instructions" : "",
    receivingContact.startsWith("Add") ? "receiving contact" : "",
  ].filter(Boolean);

  return {
    businessName: context?.companyName ?? "Business profile",
    businessAddress,
    deliveryInstructions,
    preferredDeliveryWindows,
    receivingLocation: readReceivingLocation(deliveryProfile),
    receivingContact,
    taxExemptStatus: readTaxExemptStatus(deliveryProfile),
    preferredSuppliers,
    restrictedSuppliers,
    localPickupRadiusMiles: readNumber(deliveryProfile, "localPickupRadiusMiles", 20),
    deliveryPreference: readDeliveryPreference(deliveryProfile),
    profileCompleteness: Math.round(((3 - missingFields.length) / 3) * 100),
    missingFields,
  };
}

function resolveCurrentDeliveryFee(unitPriceCents: number, orderQuantity: number) {
  const subtotal = unitPriceCents * orderQuantity;
  if (subtotal >= 25000) return 0;
  return 1500;
}

function resolveRecommendedDeliveryFee({
  connector,
  supplierRecord,
  orderSubtotalCents,
}: {
  connector: SupplierConnector;
  supplierRecord?: {
    deliveryFeeCents: number;
    minimumOrderCents: number;
  };
  orderSubtotalCents: number;
}) {
  const freeMinimum =
    supplierRecord?.minimumOrderCents ?? connector.freeDeliveryMinimumCents ?? null;
  if (freeMinimum !== null && orderSubtotalCents >= freeMinimum) return 0;
  return supplierRecord?.deliveryFeeCents ?? connector.estimatedDeliveryFeeCents;
}

function resolveDeliveryOption({
  connector,
  supplierRecord,
}: {
  connector: SupplierConnector;
  supplierRecord?: {
    averageLeadTimeDays: number;
  };
}): DeliveryOptionKind {
  if (!connector.supportsDelivery && connector.supportsPickup) return "pickup_available_today";
  if (!connector.supportsDelivery) return "not_delivery_eligible";
  const leadTime = supplierRecord?.averageLeadTimeDays ?? connector.defaultLeadTimeDays;
  if (leadTime <= 1) return "delivered_tomorrow";
  if (connector.supportsSupplierTruck) return "supplier_truck_delivery";
  if (connector.estimatedDeliveryFeeCents === 0 || connector.freeDeliveryMinimumCents !== null) {
    return "free_delivery_over_minimum";
  }
  return "delivered_to_business";
}

function formatDeliveryLabel(option: DeliveryOptionKind) {
  const labels: Record<DeliveryOptionKind, string> = {
    delivered_to_business: "Delivered to your business",
    pickup_available_today: "Pickup available today",
    delivered_tomorrow: "Delivered tomorrow",
    free_delivery_over_minimum: "Free delivery over minimum",
    supplier_truck_delivery: "Supplier truck delivery",
    third_party_delivery_required: "Third-party delivery required",
    local_courier_option: "Local courier option",
    not_delivery_eligible: "Not delivery eligible",
  };
  return labels[option];
}

function formatEstimatedDeliveryDate(leadTimeDays: number) {
  if (leadTimeDays <= 0) return "Today";
  if (leadTimeDays === 1) return "Tomorrow";
  const date = new Date();
  date.setDate(date.getDate() + leadTimeDays);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function resolveUrgency({
  monthlyEstimatedSavingsCents,
  deliveryOption,
  sku,
}: {
  monthlyEstimatedSavingsCents: number;
  deliveryOption: DeliveryOptionKind;
  sku: string;
}): RecommendationUrgency {
  if (deliveryOption === "not_delivery_eligible") return "medium";
  if (monthlyEstimatedSavingsCents >= 20000) return "high";
  if (monthlyEstimatedSavingsCents >= 7500) return "medium";
  if (sku.includes("EQUIP") || sku.includes("SHINGLES") || sku.includes("REFRIGERANT")) {
    return "medium";
  }
  return "low";
}

function buildRecommendationTitle({
  itemName,
  monthlyEstimatedSavingsCents,
  deliveryOption,
}: {
  itemName: string;
  monthlyEstimatedSavingsCents: number;
  deliveryOption: DeliveryOptionKind;
}) {
  if (monthlyEstimatedSavingsCents > 0) {
    return `Save ${formatCompactMoney(monthlyEstimatedSavingsCents)} this month on ${itemName}`;
  }
  if (deliveryOption === "not_delivery_eligible") {
    return `${itemName} needs pickup or quote review`;
  }
  return `${itemName} is close to current vendor pricing`;
}

function buildRecommendationExplanation({
  row,
  monthlyEstimatedSavingsCents,
  deliveryLabel,
  dataQuality,
}: {
  row: { supplierName: string; unit: string };
  monthlyEstimatedSavingsCents: number;
  deliveryLabel: string;
  dataQuality: SavingsAudit["dataQuality"];
}) {
  const savings =
    monthlyEstimatedSavingsCents > 0
      ? `${formatCompactMoney(monthlyEstimatedSavingsCents)} estimated monthly savings`
      : "No confirmed savings yet";
  const quality =
    dataQuality === "verified"
      ? "captured price data"
      : dataQuality === "estimated"
        ? "estimated supplier data"
        : "benchmark data";

  return `${row.supplierName} is the best available option from ${quality}. ${deliveryLabel}. ${savings}; verify quote before approval.`;
}

function resolveRecommendedNextStep({
  businessProfile,
  recommendations,
  pendingApprovalCount,
}: {
  businessProfile: BusinessDeliveryProfile;
  recommendations: BestPriceDeliveryRecommendation[];
  pendingApprovalCount: number;
}) {
  if (businessProfile.missingFields.length > 0) {
    return `Complete delivery profile: ${businessProfile.missingFields.join(", ")}.`;
  }
  if (pendingApprovalCount > 0) {
    return "Review pending approvals before creating more quote/order actions.";
  }
  const best = recommendations.find(
    (recommendation) => recommendation.savingsAudit.monthlyEstimatedSavingsCents > 0
  );
  if (best) {
    return `Request a verified quote for ${best.itemName} from ${best.supplierName}.`;
  }
  return "Import invoices or supplier quotes to improve today's recommendations.";
}

function buildWorkflowStatuses() {
  return [
    {
      status: "recommendation_found" as const,
      label: "Recommendation Found",
      description: "Dashboard found a potential best price or delivery option.",
    },
    {
      status: "pending_owner_approval" as const,
      label: "Pending Owner Approval",
      description: "Owner or admin must approve before HomeReach/vendor manager acts.",
    },
    {
      status: "quote_requested" as const,
      label: "Quote Requested",
      description: "Supplier quote is requested or ready for manual verification.",
    },
    {
      status: "approved" as const,
      label: "Approved",
      description: "Approved to proceed with manual ordering workflow.",
    },
    {
      status: "ordered_manually" as const,
      label: "Ordered Manually",
      description: "Order was placed outside the system and can be tracked here.",
    },
    {
      status: "ordered_through_supplier" as const,
      label: "Ordered Through Supplier",
      description: "Reserved for future approved supplier integrations.",
    },
    {
      status: "delivered" as const,
      label: "Delivered",
      description: "Business received the item and savings can be verified.",
    },
    {
      status: "ignored" as const,
      label: "Ignored",
      description: "Recommendation dismissed and kept in the audit trail.",
    },
    {
      status: "needs_review" as const,
      label: "Needs Review",
      description: "Price, delivery, substitute, or profile data needs verification.",
    },
  ];
}

function buildNotificationHooks() {
  return [
    {
      label: "Price drop found",
      status: "ready_for_review" as const,
      description: "Can create an internal alert/action request today.",
    },
    {
      label: "Reorder needed",
      status: "ready_for_review" as const,
      description: "Can be driven from reorder thresholds and usage estimates.",
    },
    {
      label: "Quote received",
      status: "requires_integration" as const,
      description: "Needs supplier email/API intake before external notification.",
    },
    {
      label: "Weekly savings report",
      status: "requires_integration" as const,
      description: "Prepared for email/SMS after approved notification policy.",
    },
    {
      label: "Live supplier order",
      status: "disabled" as const,
      description: "Disabled until secure credentials, supplier terms, and explicit approval exist.",
    },
  ];
}

function supplierNamesMatch(left: string, right: string) {
  return slugify(left).includes(slugify(right)) || slugify(right).includes(slugify(left));
}

function formatCompactMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback: string
) {
  return typeof record[key] === "string" && record[key] ? String(record[key]) : fallback;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  fallback: number
) {
  return typeof record[key] === "number" ? Number(record[key]) : fallback;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
  fallback: string[]
) {
  return Array.isArray(record[key])
    ? record[key].filter((item): item is string => typeof item === "string")
    : fallback;
}

function readReceivingLocation(
  record: Record<string, unknown>
): BusinessDeliveryProfile["receivingLocation"] {
  const value = record.receivingLocation;
  if (
    value === "front_door" ||
    value === "back_door" ||
    value === "loading_dock" ||
    value === "contact_person"
  ) {
    return value;
  }
  return "front_door";
}

function readTaxExemptStatus(
  record: Record<string, unknown>
): BusinessDeliveryProfile["taxExemptStatus"] {
  const value = record.taxExemptStatus;
  if (value === "yes" || value === "no" || value === "unknown") return value;
  return "unknown";
}

function readDeliveryPreference(record: Record<string, unknown>): DeliveryPreference {
  const value = record.deliveryPreference;
  if (
    value === "cheapest" ||
    value === "fastest" ||
    value === "balanced" ||
    value === "local_first"
  ) {
    return value;
  }
  return "balanced";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
