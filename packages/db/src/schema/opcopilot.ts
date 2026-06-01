import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type OpcopilotApprovalPolicy = {
  autonomyLevel: 0 | 1 | 2 | 3 | 4;
  autoApproveUnderCents?: number;
  requireApprovalCategories?: string[];
  allowedSupplierIds?: string[];
};

export type OpcopilotPreferenceMemory = {
  preferredBrands?: string[];
  preferredSuppliers?: string[];
  substituteTolerance?: "low" | "medium" | "high";
  marginTargets?: Record<string, number>;
  rejectedRecommendations?: string[];
  acceptedRecommendations?: string[];
  deliveryProfile?: {
    businessAddress?: string;
    deliveryInstructions?: string;
    preferredDeliveryWindows?: string[];
    receivingLocation?: "front_door" | "back_door" | "loading_dock" | "contact_person";
    receivingContact?: string;
    taxExemptStatus?: "unknown" | "yes" | "no";
    preferredSuppliers?: string[];
    restrictedSuppliers?: string[];
    localPickupRadiusMiles?: number;
    deliveryPreference?: "cheapest" | "fastest" | "balanced" | "local_first";
  };
};

export const opcopilotBusinessContexts = pgTable(
  "opcopilot_business_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    companyName: text("company_name").notNull().default("Operations Command"),
    businessType: text("business_type").notNull().default("home_services"),
    operatingModel: text("operating_model").notNull().default("field_service"),
    serviceGeography: text("service_geography").notNull().default("local"),
    seasonalPatterns: jsonb("seasonal_patterns").$type<string[]>().notNull().default([]),
    approvalPolicy: jsonb("approval_policy")
      .$type<OpcopilotApprovalPolicy>()
      .notNull()
      .default({ autonomyLevel: 1, autoApproveUnderCents: 0 }),
    preferenceMemory: jsonb("preference_memory")
      .$type<OpcopilotPreferenceMemory>()
      .notNull()
      .default({}),
  },
  (table) => ({
    userUnique: uniqueIndex("opcopilot_business_contexts_user_id_key").on(
      table.userId
    ),
  })
);

export const opcopilotInventoryItems = pgTable(
  "opcopilot_inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    sku: text("sku").notNull(),
    itemName: text("item_name").notNull(),
    category: text("category").notNull(),
    preferredBrand: text("preferred_brand"),
    unit: text("unit").notNull().default("unit"),
    onHandQuantity: numeric("on_hand_quantity", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    reorderPointQuantity: numeric("reorder_point_quantity", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    targetStockQuantity: numeric("target_stock_quantity", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    averageDailyUse: numeric("average_daily_use", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    grossMarginImpactCents: integer("gross_margin_impact_cents")
      .notNull()
      .default(0),
    lastPurchasedAt: date("last_purchased_at"),
    expiresAt: date("expires_at"),
    substituteTolerance: text("substitute_tolerance").notNull().default("medium"),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    userSkuUnique: uniqueIndex("opcopilot_inventory_items_user_sku_key").on(
      table.userId,
      table.sku
    ),
    userCategoryIdx: index("opcopilot_inventory_items_user_category_idx").on(
      table.userId,
      table.category
    ),
  })
);

export const opcopilotSuppliers = pgTable(
  "opcopilot_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    supplierName: text("supplier_name").notNull(),
    categoryCoverage: jsonb("category_coverage").$type<string[]>().notNull().default([]),
    reliabilityScore: integer("reliability_score").notNull().default(80),
    averageLeadTimeDays: integer("average_lead_time_days").notNull().default(3),
    minimumOrderCents: integer("minimum_order_cents").notNull().default(0),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    paymentTerms: text("payment_terms").notNull().default("standard"),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    userSupplierUnique: uniqueIndex("opcopilot_suppliers_user_name_key").on(
      table.userId,
      table.supplierName
    ),
    userActiveIdx: index("opcopilot_suppliers_user_active_idx").on(
      table.userId,
      table.active
    ),
  })
);

export const opcopilotSupplierQuotes = pgTable(
  "opcopilot_supplier_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    inventoryItemId: uuid("inventory_item_id").notNull(),
    quotedUnitCostCents: integer("quoted_unit_cost_cents").notNull().default(0),
    quotedAt: timestamp("quoted_at", { withTimezone: true }).notNull().defaultNow(),
    validUntil: date("valid_until"),
    availableQuantity: numeric("available_quantity", { precision: 12, scale: 2 }),
    leadTimeDays: integer("lead_time_days").notNull().default(3),
    landedCostCents: integer("landed_cost_cents").notNull().default(0),
  },
  (table) => ({
    userItemIdx: index("opcopilot_supplier_quotes_user_item_idx").on(
      table.userId,
      table.inventoryItemId
    ),
    supplierIdx: index("opcopilot_supplier_quotes_supplier_idx").on(
      table.supplierId
    ),
  })
);

export const opcopilotPriceSnapshots = pgTable(
  "opcopilot_price_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id"),
    industryId: text("industry_id").notNull(),
    region: text("region").notNull().default("Akron / Northeast Ohio"),
    zipCode: text("zip_code").notNull().default("44309"),
    sku: text("sku").notNull(),
    itemName: text("item_name").notNull(),
    category: text("category").notNull(),
    supplierName: text("supplier_name").notNull(),
    sourceType: text("source_type").notNull().default("public_web"),
    sourceLabel: text("source_label").notNull().default("Public benchmark"),
    sourceUrl: text("source_url"),
    unit: text("unit").notNull(),
    observedPriceCents: integer("observed_price_cents"),
    normalizedUnitPriceCents: integer("normalized_unit_price_cents"),
    landedPriceCents: integer("landed_price_cents"),
    availableQuantity: numeric("available_quantity", { precision: 12, scale: 2 }),
    inStock: boolean("in_stock"),
    leadTimeDays: integer("lead_time_days"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: date("valid_until"),
    confidence: text("confidence").notNull().default("medium"),
    priceBasis: text("price_basis").notNull().default("observed shelf price"),
    notes: text("notes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => ({
    userIndustrySkuIdx: index("opcopilot_price_snapshots_user_industry_sku_idx").on(
      table.userId,
      table.industryId,
      table.sku
    ),
    supplierIdx: index("opcopilot_price_snapshots_supplier_idx").on(
      table.supplierName
    ),
    capturedIdx: index("opcopilot_price_snapshots_captured_idx").on(
      table.capturedAt
    ),
  })
);

export type OpcopilotEventPayload = {
  [key: string]: unknown;
  itemIds?: string[];
  supplierIds?: string[];
  reasoning?: string[];
  recommendedAction?: string;
};

export const opcopilotAiEvents = pgTable(
  "opcopilot_ai_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    urgency: text("urgency").notNull().default("medium"),
    confidence: text("confidence").notNull().default("medium"),
    estimatedImpactCents: integer("estimated_impact_cents").notNull().default(0),
    riskScore: integer("risk_score").notNull().default(50),
    payload: jsonb("payload").$type<OpcopilotEventPayload>().notNull().default({}),
    status: text("status").notNull().default("open"),
  },
  (table) => ({
    userStatusIdx: index("opcopilot_ai_events_user_status_idx").on(
      table.userId,
      table.status
    ),
    userUrgencyIdx: index("opcopilot_ai_events_user_urgency_idx").on(
      table.userId,
      table.urgency
    ),
  })
);

export const opcopilotActionRequests = pgTable(
  "opcopilot_action_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    eventId: uuid("event_id"),
    actionType: text("action_type").notNull(),
    title: text("title").notNull(),
    proposedBy: text("proposed_by").notNull().default("ai"),
    autonomyLevel: integer("autonomy_level").notNull().default(1),
    status: text("status").notNull().default("draft"),
    estimatedSpendCents: integer("estimated_spend_cents").notNull().default(0),
    estimatedSavingsCents: integer("estimated_savings_cents").notNull().default(0),
    confidence: text("confidence").notNull().default("medium"),
    riskScore: integer("risk_score").notNull().default(50),
    approvalRequired: boolean("approval_required").notNull().default(true),
    requestPayload: jsonb("request_payload").$type<Record<string, unknown>>().notNull().default({}),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userStatusIdx: index("opcopilot_action_requests_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

export const opcopilotSavingsRecommendations = pgTable(
  "opcopilot_savings_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    source: text("source").notNull().default("ai_savings_engine"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    category: text("category").notNull().default("savings"),
    projectedMonthlySavingsCents: integer("projected_monthly_savings_cents").notNull().default(0),
    projectedAnnualSavingsCents: integer("projected_annual_savings_cents").notNull().default(0),
    difficulty: text("difficulty").notNull().default("easy"),
    operationalImpact: text("operational_impact").notNull().default("low"),
    confidence: text("confidence").notNull().default("medium"),
    status: text("status").notNull().default("pending_approval"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    relatedSupplierId: uuid("related_supplier_id"),
    relatedInventoryItemId: uuid("related_inventory_item_id"),
    recommendationPayload: jsonb("recommendation_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userStatusIdx: index("opcopilot_savings_recommendations_user_status_idx").on(
      table.userId,
      table.status,
      table.createdAt
    ),
  })
);

export const opcopilotLandedCostModels = pgTable(
  "opcopilot_landed_cost_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    supplierId: uuid("supplier_id"),
    inventoryItemId: uuid("inventory_item_id"),
    modelSource: text("model_source").notNull().default("estimated"),
    productCostCents: integer("product_cost_cents").notNull().default(0),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    fuelSurchargeCents: integer("fuel_surcharge_cents").notNull().default(0),
    rushFeeCents: integer("rush_fee_cents").notNull().default(0),
    spoilageRiskCents: integer("spoilage_risk_cents").notNull().default(0),
    substitutionRiskCents: integer("substitution_risk_cents").notNull().default(0),
    receivingBurdenCents: integer("receiving_burden_cents").notNull().default(0),
    orderingFrequencyBurdenCents: integer("ordering_frequency_burden_cents").notNull().default(0),
    trueLandedCostCents: integer("true_landed_cost_cents").notNull().default(0),
    reliabilityAdjustmentCents: integer("reliability_adjustment_cents").notNull().default(0),
    assumptions: jsonb("assumptions").$type<Record<string, unknown>>().notNull().default({}),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userItemIdx: index("opcopilot_landed_cost_models_user_item_idx").on(
      table.userId,
      table.inventoryItemId,
      table.createdAt
    ),
  })
);

export const opcopilotDeliveries = pgTable(
  "opcopilot_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    supplierId: uuid("supplier_id"),
    deliveryReference: text("delivery_reference"),
    supplierName: text("supplier_name").notNull(),
    status: text("status").notNull().default("scheduled"),
    etaAt: timestamp("eta_at", { withTimezone: true }),
    deliveryWindow: text("delivery_window"),
    itemSummary: text("item_summary").notNull().default("Supply delivery"),
    expectedItemCount: integer("expected_item_count").notNull().default(0),
    receivedItemCount: integer("received_item_count").notNull().default(0),
    missingItemCount: integer("missing_item_count").notNull().default(0),
    estimatedDeliveryCostCents: integer("estimated_delivery_cost_cents").notNull().default(0),
    savingsContext: jsonb("savings_context").$type<Record<string, unknown>>().notNull().default({}),
    issueSummary: text("issue_summary"),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userStatusEtaIdx: index("opcopilot_deliveries_user_status_eta_idx").on(
      table.userId,
      table.status,
      table.etaAt
    ),
  })
);

export const opcopilotDeliveryEvents = pgTable(
  "opcopilot_delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    deliveryId: uuid("delivery_id"),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    actor: text("actor").notNull().default("system"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    deliveryIdx: index("opcopilot_delivery_events_delivery_idx").on(
      table.deliveryId,
      table.createdAt
    ),
  })
);

export const opcopilotReceivingRecords = pgTable(
  "opcopilot_receiving_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    deliveryId: uuid("delivery_id"),
    status: text("status").notNull().default("draft"),
    receivedBy: text("received_by"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    checkedItemCount: integer("checked_item_count").notNull().default(0),
    damagedItemCount: integer("damaged_item_count").notNull().default(0),
    missingItemCount: integer("missing_item_count").notNull().default(0),
    invoiceMismatchCount: integer("invoice_mismatch_count").notNull().default(0),
    photos: jsonb("photos").$type<Array<Record<string, unknown>>>().notNull().default([]),
    notes: text("notes"),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userStatusIdx: index("opcopilot_receiving_records_user_status_idx").on(
      table.userId,
      table.status,
      table.createdAt
    ),
  })
);

export const opcopilotInvoiceAudits = pgTable(
  "opcopilot_invoice_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    supplierId: uuid("supplier_id"),
    deliveryId: uuid("delivery_id"),
    invoiceReference: text("invoice_reference"),
    status: text("status").notNull().default("needs_review"),
    invoiceTotalCents: integer("invoice_total_cents").notNull().default(0),
    expectedTotalCents: integer("expected_total_cents").notNull().default(0),
    varianceCents: integer("variance_cents").notNull().default(0),
    issueType: text("issue_type").notNull().default("price_check"),
    issueSummary: text("issue_summary").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userStatusIdx: index("opcopilot_invoice_audits_user_status_idx").on(
      table.userId,
      table.status,
      table.createdAt
    ),
  })
);

export const opcopilotVendorScorecards = pgTable(
  "opcopilot_vendor_scorecards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    supplierId: uuid("supplier_id"),
    supplierName: text("supplier_name").notNull(),
    onTimeRate: integer("on_time_rate").notNull().default(0),
    fillRate: integer("fill_rate").notNull().default(0),
    substitutionRate: integer("substitution_rate").notNull().default(0),
    invoiceAccuracyRate: integer("invoice_accuracy_rate").notNull().default(0),
    responsivenessScore: integer("responsiveness_score").notNull().default(0),
    pricingStabilityScore: integer("pricing_stability_score").notNull().default(0),
    reliabilityScore: integer("reliability_score").notNull().default(0),
    savingsPotentialCents: integer("savings_potential_cents").notNull().default(0),
    riskLabel: text("risk_label").notNull().default("watch"),
    aiSummary: text("ai_summary"),
    scorePayload: jsonb("score_payload").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    userSupplierUnique: uniqueIndex("opcopilot_vendor_scorecards_user_supplier_key").on(
      table.userId,
      table.supplierName
    ),
  })
);

export const opcopilotOperationalAlerts = pgTable(
  "opcopilot_operational_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    alertType: text("alert_type").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    severity: text("severity").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    recommendedAction: text("recommended_action").notNull(),
    estimatedImpactCents: integer("estimated_impact_cents").notNull().default(0),
    relatedRecordType: text("related_record_type"),
    relatedRecordId: uuid("related_record_id"),
    auditLog: jsonb("audit_log").$type<Array<Record<string, unknown>>>().notNull().default([]),
  },
  (table) => ({
    userStatusIdx: index("opcopilot_operational_alerts_user_status_idx").on(
      table.userId,
      table.status,
      table.severity,
      table.createdAt
    ),
  })
);

export const opcopilotProcurementEfficiencyScores = pgTable(
  "opcopilot_procurement_efficiency_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    scoreDate: date("score_date").notNull().defaultNow(),
    savingsScore: integer("savings_score").notNull().default(0),
    procurementEfficiencyScore: integer("procurement_efficiency_score").notNull().default(0),
    vendorOptimizationScore: integer("vendor_optimization_score").notNull().default(0),
    deliveryEfficiencyScore: integer("delivery_efficiency_score").notNull().default(0),
    wasteReductionScore: integer("waste_reduction_score").notNull().default(0),
    summary: text("summary"),
    weakSpots: jsonb("weak_spots").$type<string[]>().notNull().default([]),
    recommendedActions: jsonb("recommended_actions").$type<string[]>().notNull().default([]),
  },
  (table) => ({
    userDateUnique: uniqueIndex("opcopilot_procurement_efficiency_scores_user_date_key").on(
      table.userId,
      table.scoreDate
    ),
  })
);

export const opcopilotInventoryForecasts = pgTable(
  "opcopilot_inventory_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
    inventoryItemId: uuid("inventory_item_id"),
    itemName: text("item_name").notNull(),
    forecastDate: date("forecast_date").notNull().defaultNow(),
    daysUntilStockout: integer("days_until_stockout"),
    expectedDailyUse: numeric("expected_daily_use", { precision: 12, scale: 2 }),
    reorderRecommendation: text("reorder_recommendation").notNull(),
    wasteRisk: text("waste_risk").notNull().default("low"),
    shortageRisk: text("shortage_risk").notNull().default("low"),
    confidence: text("confidence").notNull().default("medium"),
    forecastPayload: jsonb("forecast_payload").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    userItemDateUnique: uniqueIndex("opcopilot_inventory_forecasts_user_item_date_key").on(
      table.userId,
      table.inventoryItemId,
      table.forecastDate
    ),
  })
);
