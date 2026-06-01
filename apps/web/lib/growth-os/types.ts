export type GrowthOsContextFlagKey =
  | "badWeather"
  | "holidaySpike"
  | "equipmentIssue"
  | "staffingIssue"
  | "promotionRunning";

export type GrowthOsContextFlags = Record<GrowthOsContextFlagKey, boolean>;

export type GrowthOsMetricTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

export type GrowthOsDashboardMetric = {
  label: string;
  value: string;
  trend?: GrowthOsMetricTrend | null;
};

export type GrowthOsRecommendationConfidence = "low" | "medium" | "high";

export type GrowthOsRecommendationSource =
  | "profile_based"
  | "trend_based"
  | "baseline_based"
  | "fallback";

export type GrowthOsLeverCategory =
  | "pricing"
  | "waste"
  | "staffing"
  | "aov"
  | "demand";

export type GrowthOsRecommendation = {
  triggerKey: string;
  weekStartDate: string;
  source: GrowthOsRecommendationSource;
  leverCategory: GrowthOsLeverCategory;
  title: string;
  problem: string;
  whyItMatters: string;
  actionText: string;
  estimatedMonthlyImpactCents: number;
  confidence: GrowthOsRecommendationConfidence;
  confidenceReasoning: string;
  rankingScore: number;
  fastWin: boolean;
  dataSnapshot: {
    dataWeeks: number;
    currentRevenueCents: number;
    currentAovCents: number;
    currentFoodCostPercent: number;
    currentLaborPercent: number;
    contextFlags: GrowthOsContextFlags[];
  };
};

export type GrowthOsBaselineMetrics = {
  source: "rolling_4_week" | "profile_fallback";
  weeksIncluded: number;
  capturedAt: string;
  weekStartDates: string[];
  revenueCents: number;
  aovCents: number;
  foodCostPercent: number;
  laborPercent: number;
  wastePercent: number;
};

export type GrowthOsImpactConfidence = "low" | "medium" | "high";

export type GrowthOsImpactCalculation = {
  baselineValueCents: number;
  currentValueCents: number;
  estimatedMonthlyImpactCents: number;
  aovDrivenRevenueDeltaCents: number;
  volumeDrivenRevenueDeltaCents: number;
  costSavingsDeltaCents: number;
  confidence: GrowthOsImpactConfidence;
  confidenceReasoning: string;
  postApplicationWeeks: number;
  weekProgress: {
    current: number;
    total: number;
  };
};

export type GrowthOsRiskAlertType =
  | "profit_decline"
  | "labor_spike"
  | "revenue_drop";

export type GrowthOsRiskAlertSeverity = "low" | "medium" | "high";

export type GrowthOsRiskAlertSnapshot = {
  weeksAnalyzed: number;
  cleanWeeks: number;
  currentValue: number;
  priorAverage: number;
  changePercent: number;
  weekStartDates: string[];
};

export type GrowthOsRiskAlert = {
  alertType: GrowthOsRiskAlertType;
  severity: GrowthOsRiskAlertSeverity;
  title: string;
  description: string;
  metricSnapshot: GrowthOsRiskAlertSnapshot;
};

export type GrowthOsAbTestPrimaryMetric =
  | "aov_cents"
  | "revenue_cents"
  | "orders";

export type GrowthOsAbTestResult = {
  weeksAnalyzed: number;
  variantAValue: number;
  variantBValue: number;
  liftPercent: number;
  notes: string;
};

export const EMPTY_CONTEXT_FLAGS: GrowthOsContextFlags = {
  badWeather: false,
  holidaySpike: false,
  equipmentIssue: false,
  staffingIssue: false,
  promotionRunning: false,
};
