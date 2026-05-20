export type CopilotUrgency = "critical" | "high" | "medium" | "low";
export type CopilotConfidence = "high" | "medium" | "low";

export type CopilotInsight = {
  id: string;
  type:
    | "shortage"
    | "price_spike"
    | "supplier_risk"
    | "savings"
    | "bulk_buy"
    | "overstock"
    | "forecast"
    | "data_readiness";
  title: string;
  summary: string;
  recommendedAction: string;
  urgency: CopilotUrgency;
  confidence: CopilotConfidence;
  riskScore: number;
  estimatedImpactCents: number;
  reasoning: string[];
};

export type CopilotQuickAction = {
  id: string;
  label: string;
  description: string;
  actionType: string;
};

export type CopilotDisplayTone = "green" | "amber" | "red" | "blue" | "neutral";

export type CostHealthCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: CopilotDisplayTone;
  href: string;
};

export type SmartBuyRecommendation = {
  id: string;
  itemName: string;
  currentVendor: string;
  bestVendor: string;
  currentPriceCents: number;
  betterPriceCents: number;
  estimatedSavingsCents: number;
  quantityRecommended: number;
  inventoryImpact: string;
  deliveryTiming: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  explanation: string;
};

export type SavingsFeedEvent = {
  id: string;
  title: string;
  detail: string;
  impactCents: number;
  urgency: CopilotUrgency;
};

export type InventoryForecast = {
  id: string;
  itemName: string;
  category: string;
  daysUntilStockout: number | null;
  usageVelocity: string;
  reorderRecommendation: string;
  confidence: CopilotConfidence;
  riskLevel: "low" | "medium" | "high" | "critical";
};

export type VendorScorecard = {
  id: string;
  supplierName: string;
  reliabilityScore: number;
  priceTrend: "stable" | "watch" | "risk";
  totalTrackedSpendCents: number;
  deliveryIssueRisk: "low" | "medium" | "high";
  savingsOpportunityCount: number;
  itemsPurchased: number;
  alternativeVendorCount: number;
  riskScore: number;
};

export type ProcurementRiskAlert = {
  id: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
  recommendedAction: string;
};

export type WeeklyAiReport = {
  totalSavingsFoundCents: number;
  totalSavingsApprovedCents: number;
  biggestCostLeak: string;
  topVendorIssue: string;
  itemsAtRisk: number;
  recommendedActions: string[];
  nextWeekFocus: string;
};

export type EmergencyProcurementItem = {
  id: string;
  itemName: string;
  shortageReason: string;
  backupVendor: string;
  fastestOption: string;
  estimatedCostCents: number;
  recommendedAction: string;
};

export type BusinessMemorySummary = {
  preferredVendors: string[];
  preferredBrands: string[];
  approvalThresholdCents: number;
  substituteTolerance: string;
  categoryPriorities: string[];
  neverSubstituteCount: number;
};

export type CopilotSnapshot = {
  companyName: string;
  businessType: string;
  autonomyLevel: number;
  inventoryItemCount: number;
  supplierCount: number;
  openEventCount: number;
  pendingApprovalCount: number;
  projectedSavingsCents: number;
  atRiskInventoryCount: number;
  averageSupplierReliability: number;
  healthScore: number;
  aiExecutiveSummary: string;
  healthCards: CostHealthCard[];
  smartBuys: SmartBuyRecommendation[];
  savingsFeed: SavingsFeedEvent[];
  inventoryForecasts: InventoryForecast[];
  vendorScorecards: VendorScorecard[];
  riskAlerts: ProcurementRiskAlert[];
  weeklyReport: WeeklyAiReport;
  emergencyItems: EmergencyProcurementItem[];
  businessMemory: BusinessMemorySummary;
  insights: CopilotInsight[];
  quickActions: CopilotQuickAction[];
  activityFeed: string[];
};
