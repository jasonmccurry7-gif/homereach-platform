import { sql } from "drizzle-orm";
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

export type FsgosContextFlags = {
  badWeather?: boolean;
  holidaySpike?: boolean;
  equipmentIssue?: boolean;
  staffingIssue?: boolean;
  promotionRunning?: boolean;
};

export const fsgosBusinessProfiles = pgTable(
  "fsgos_business_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    companyName: text("company_name").notNull(),
    locationZip: text("location_zip").notNull(),
    businessType: text("business_type").notNull(),
    weeklyRevenueCents: integer("weekly_revenue_cents").notNull().default(0),
    avgOrderValueCents: integer("avg_order_value_cents").notNull().default(0),
    dailyCustomers: integer("daily_customers").notNull().default(0),
    laborCostWeeklyCents: integer("labor_cost_weekly_cents")
      .notNull()
      .default(0),
    ingredientCostWeeklyCents: integer("ingredient_cost_weekly_cents")
      .notNull()
      .default(0),
    overheadMonthlyCents: integer("overhead_monthly_cents")
      .notNull()
      .default(0),
    ownerGoal: text("owner_goal").notNull(),
    timezone: text("timezone").notNull().default("America/New_York"),
  },
  (table) => ({
    userUnique: uniqueIndex("fsgos_business_profiles_user_id_key").on(
      table.userId
    ),
    businessTypeIdx: index("fsgos_business_profiles_business_type_idx").on(
      table.businessType
    ),
  })
);

export const fsgosWeeklyInputs = pgTable(
  "fsgos_weekly_inputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    weekStartDate: date("week_start_date").notNull(),
    weeklyRevenueCents: integer("weekly_revenue_cents").notNull().default(0),
    weeklyOrders: integer("weekly_orders").notNull().default(0),
    weeklyLaborCostCents: integer("weekly_labor_cost_cents")
      .notNull()
      .default(0),
    weeklyIngredientCostCents: integer("weekly_ingredient_cost_cents")
      .notNull()
      .default(0),
    weeklyWasteEstimateCents: integer("weekly_waste_estimate_cents")
      .notNull()
      .default(0),
    avgOrderValueCents: integer("avg_order_value_cents").notNull().default(0),
    notes: text("notes"),
    contextFlags: jsonb("context_flags")
      .$type<FsgosContextFlags>()
      .notNull()
      .default({}),
    sameAsPrevious: boolean("same_as_previous").notNull().default(false),
  },
  (table) => ({
    userWeekUnique: uniqueIndex("fsgos_weekly_inputs_user_week_key").on(
      table.userId,
      table.weekStartDate
    ),
    userWeekIdx: index("fsgos_weekly_inputs_user_week_idx").on(
      table.userId,
      table.weekStartDate
    ),
  })
);

export const fsgosUserState = pgTable(
  "fsgos_user_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    currentStreakWeeks: integer("current_streak_weeks").notNull().default(0),
    longestStreakWeeks: integer("longest_streak_weeks").notNull().default(0),
    lastInputWeekStart: date("last_input_week_start"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    firstWinAchievedAt: timestamp("first_win_achieved_at", {
      withTimezone: true,
    }),
  },
  (table) => ({
    userUnique: uniqueIndex("fsgos_user_state_user_id_key").on(table.userId),
  })
);

export type FsgosRecommendationSnapshot = {
  dataWeeks: number;
  currentRevenueCents: number;
  currentAovCents: number;
  currentFoodCostPercent: number;
  currentLaborPercent: number;
  contextFlags: FsgosContextFlags[];
};

export const fsgosRecommendations = pgTable(
  "fsgos_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    weekStartDate: date("week_start_date").notNull(),
    triggerKey: text("trigger_key").notNull(),
    source: text("source").notNull(),
    leverCategory: text("lever_category").notNull(),
    title: text("title").notNull(),
    problem: text("problem").notNull(),
    whyItMatters: text("why_it_matters").notNull(),
    actionText: text("action_text").notNull(),
    estimatedMonthlyImpactCents: integer("estimated_monthly_impact_cents")
      .notNull()
      .default(0),
    confidence: text("confidence").notNull(),
    confidenceReasoning: text("confidence_reasoning").notNull(),
    rankingScore: numeric("ranking_score", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    fastWin: boolean("fast_win").notNull().default(false),
    status: text("status").notNull().default("recommended"),
    dataSnapshot: jsonb("data_snapshot")
      .$type<FsgosRecommendationSnapshot>()
      .notNull()
      .default({
        dataWeeks: 0,
        currentRevenueCents: 0,
        currentAovCents: 0,
        currentFoodCostPercent: 0,
        currentLaborPercent: 0,
        contextFlags: [],
      }),
  },
  (table) => ({
    userWeekTriggerUnique: uniqueIndex(
      "fsgos_recommendations_user_week_trigger_key"
    ).on(table.userId, table.weekStartDate, table.triggerKey),
    userStatusIdx: index("fsgos_recommendations_user_status_idx").on(
      table.userId,
      table.status
    ),
    userWeekIdx: index("fsgos_recommendations_user_week_idx").on(
      table.userId,
      table.weekStartDate
    ),
  })
);

export type FsgosBaselineMetrics = {
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

export const fsgosAppliedRecommendations = pgTable(
  "fsgos_applied_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    recommendationId: uuid("recommendation_id").notNull(),
    leverCategory: text("lever_category").notNull(),
    fastWin: boolean("fast_win").notNull().default(false),
    baselineMetrics: jsonb("baseline_metrics")
      .$type<FsgosBaselineMetrics>()
      .notNull()
      .default({
        source: "profile_fallback",
        weeksIncluded: 0,
        capturedAt: "",
        weekStartDates: [],
        revenueCents: 0,
        aovCents: 0,
        foodCostPercent: 0,
        laborPercent: 0,
        wastePercent: 0,
      }),
    dateApplied: timestamp("date_applied", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("active"),
    completionDate: timestamp("completion_date", { withTimezone: true }),
    finalImpactCents: integer("final_impact_cents"),
    confidence: text("confidence").notNull(),
  },
  (table) => ({
    userActiveUnique: uniqueIndex(
      "fsgos_applied_recommendations_one_active_idx"
    )
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    userStatusIdx: index("fsgos_applied_recommendations_user_status_idx").on(
      table.userId,
      table.status
    ),
    recommendationIdx: index(
      "fsgos_applied_recommendations_recommendation_idx"
    ).on(table.recommendationId),
  })
);

export const fsgosImpactTracking = pgTable(
  "fsgos_impact_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    appliedRecommendationId: uuid("applied_recommendation_id").notNull(),
    baselineValueCents: integer("baseline_value_cents").notNull().default(0),
    currentValueCents: integer("current_value_cents").notNull().default(0),
    estimatedMonthlyImpactCents: integer("estimated_monthly_impact_cents")
      .notNull()
      .default(0),
    aovDrivenRevenueDeltaCents: integer(
      "aov_driven_revenue_delta_cents"
    )
      .notNull()
      .default(0),
    volumeDrivenRevenueDeltaCents: integer(
      "volume_driven_revenue_delta_cents"
    )
      .notNull()
      .default(0),
    costSavingsDeltaCents: integer("cost_savings_delta_cents")
      .notNull()
      .default(0),
    confidence: text("confidence").notNull(),
    confidenceReasoning: text("confidence_reasoning").notNull(),
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appliedUnique: uniqueIndex(
      "fsgos_impact_tracking_applied_recommendation_key"
    ).on(table.appliedRecommendationId),
    userIdx: index("fsgos_impact_tracking_user_idx").on(table.userId),
  })
);

export const fsgosBenchmarks = pgTable(
  "fsgos_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    businessType: text("business_type").notNull(),
    revenueTier: text("revenue_tier").notNull(),
    region: text("region").notNull(),
    metricType: text("metric_type").notNull(),
    p25: numeric("p25", { precision: 12, scale: 2 }).notNull(),
    p50: numeric("p50", { precision: 12, scale: 2 }).notNull(),
    p75: numeric("p75", { precision: 12, scale: 2 }).notNull(),
    sampleSize: integer("sample_size").notNull().default(0),
    source: text("source").notNull().default("aggregated_user_data"),
  },
  (table) => ({
    benchmarkUnique: uniqueIndex("fsgos_benchmarks_unique_key").on(
      table.businessType,
      table.revenueTier,
      table.region,
      table.metricType
    ),
    lookupIdx: index("fsgos_benchmarks_lookup_idx").on(
      table.businessType,
      table.revenueTier,
      table.region
    ),
  })
);

export type FsgosRiskAlertSnapshot = {
  weeksAnalyzed: number;
  cleanWeeks: number;
  currentValue: number;
  priorAverage: number;
  changePercent: number;
  weekStartDates: string[];
};

export const fsgosRiskAlerts = pgTable(
  "fsgos_risk_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    alertType: text("alert_type").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    metricSnapshot: jsonb("metric_snapshot")
      .$type<FsgosRiskAlertSnapshot>()
      .notNull()
      .default({
        weeksAnalyzed: 0,
        cleanWeeks: 0,
        currentValue: 0,
        priorAverage: 0,
        changePercent: 0,
        weekStartDates: [],
      }),
    status: text("status").notNull().default("active"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    userTypeActiveUnique: uniqueIndex(
      "fsgos_risk_alerts_user_type_active_key"
    )
      .on(table.userId, table.alertType)
      .where(sql`${table.status} = 'active'`),
    userStatusIdx: index("fsgos_risk_alerts_user_status_idx").on(
      table.userId,
      table.status
    ),
    userDetectedIdx: index("fsgos_risk_alerts_user_detected_idx").on(
      table.userId,
      table.detectedAt
    ),
  })
);

export type FsgosAbTestVariantConfig = {
  description: string;
  priceCents?: number;
  bundleItems?: string[];
};

export type FsgosAbTestResult = {
  weeksAnalyzed: number;
  variantAValue: number;
  variantBValue: number;
  liftPercent: number;
  notes: string;
};

export const fsgosAbTests = pgTable(
  "fsgos_ab_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userId: uuid("user_id").notNull(),
    appliedRecommendationId: uuid("applied_recommendation_id").notNull(),
    testType: text("test_type").notNull(),
    hypothesis: text("hypothesis").notNull(),
    variantAName: text("variant_a_name").notNull(),
    variantAConfig: jsonb("variant_a_config")
      .$type<FsgosAbTestVariantConfig>()
      .notNull()
      .default({ description: "" }),
    variantBName: text("variant_b_name").notNull(),
    variantBConfig: jsonb("variant_b_config")
      .$type<FsgosAbTestVariantConfig>()
      .notNull()
      .default({ description: "" }),
    primaryMetric: text("primary_metric").notNull().default("aov_cents"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: text("status").notNull().default("active"),
    winningVariant: text("winning_variant"),
    confidence: text("confidence"),
    resultSummary: jsonb("result_summary")
      .$type<FsgosAbTestResult>()
      .notNull()
      .default({
        weeksAnalyzed: 0,
        variantAValue: 0,
        variantBValue: 0,
        liftPercent: 0,
        notes: "",
      }),
  },
  (table) => ({
    userActiveUnique: uniqueIndex("fsgos_ab_tests_one_active_idx")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    userStatusIdx: index("fsgos_ab_tests_user_status_idx").on(
      table.userId,
      table.status
    ),
    appliedIdx: index("fsgos_ab_tests_applied_idx").on(
      table.appliedRecommendationId
    ),
  })
);
