import {
  db,
  fsgosAppliedRecommendations,
  fsgosImpactTracking,
  fsgosRecommendations,
  fsgosUserState,
} from "@homereach/db";
import { and, eq, sql } from "drizzle-orm";
import { calculateAovCents, getCurrentWeekStartDate } from "./metrics";
import type {
  GrowthOsBaselineMetrics,
  GrowthOsContextFlags,
  GrowthOsImpactCalculation,
  GrowthOsImpactConfidence,
} from "./types";

const MONTHLY_WEEKS = 4.33;

type AppliedRecommendationInput = {
  id: string;
  userId: string;
  dateApplied: Date;
  recommendationId: string;
  baselineMetrics: GrowthOsBaselineMetrics;
  fastWin: boolean;
};

type WeeklyImpactInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  weeklyLaborCostCents: number;
  weeklyIngredientCostCents: number;
  weeklyWasteEstimateCents: number;
  avgOrderValueCents: number;
  contextFlags: Partial<GrowthOsContextFlags>;
};

type CurrentMetrics = {
  revenueCents: number;
  orders: number;
  aovCents: number;
  foodCostPercent: number;
  laborPercent: number;
  wastePercent: number;
  contextFlags: GrowthOsContextFlags[];
  weeksIncluded: number;
};

export const IMPACT_DISCLAIMER =
  "Estimated impact based on directional comparison. Not isolated for seasonality, weather, or external factors.";

export async function calculateAndStoreGrowthOsImpact({
  userId,
  appliedRecommendation,
  weeklyInputs,
  now = new Date(),
}: {
  userId: string;
  appliedRecommendation: AppliedRecommendationInput;
  weeklyInputs: WeeklyImpactInput[];
  now?: Date;
}) {
  const calculation = calculateGrowthOsImpact({
    appliedRecommendation,
    weeklyInputs,
  });

  const [impactTracking] = await db
    .insert(fsgosImpactTracking)
    .values({
      userId,
      appliedRecommendationId: appliedRecommendation.id,
      baselineValueCents: calculation.baselineValueCents,
      currentValueCents: calculation.currentValueCents,
      estimatedMonthlyImpactCents: calculation.estimatedMonthlyImpactCents,
      aovDrivenRevenueDeltaCents:
        calculation.aovDrivenRevenueDeltaCents,
      volumeDrivenRevenueDeltaCents:
        calculation.volumeDrivenRevenueDeltaCents,
      costSavingsDeltaCents: calculation.costSavingsDeltaCents,
      confidence: calculation.confidence,
      confidenceReasoning: calculation.confidenceReasoning,
      lastUpdated: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: fsgosImpactTracking.appliedRecommendationId,
      set: {
        updatedAt: now,
        baselineValueCents: sql`excluded.baseline_value_cents`,
        currentValueCents: sql`excluded.current_value_cents`,
        estimatedMonthlyImpactCents:
          sql`excluded.estimated_monthly_impact_cents`,
        aovDrivenRevenueDeltaCents:
          sql`excluded.aov_driven_revenue_delta_cents`,
        volumeDrivenRevenueDeltaCents:
          sql`excluded.volume_driven_revenue_delta_cents`,
        costSavingsDeltaCents: sql`excluded.cost_savings_delta_cents`,
        confidence: sql`excluded.confidence`,
        confidenceReasoning: sql`excluded.confidence_reasoning`,
        lastUpdated: sql`excluded.last_updated`,
      },
    })
    .returning();

  return {
    calculation,
    impactTracking: impactTracking ?? null,
  };
}

export async function completeGrowthOsActiveLever({
  userId,
  activeAppliedRecommendation,
  weeklyInputs,
  now = new Date(),
}: {
  userId: string;
  activeAppliedRecommendation: {
    appliedRecommendation: AppliedRecommendationInput;
    recommendation: { id: string } | null;
  };
  weeklyInputs: WeeklyImpactInput[];
  now?: Date;
}) {
  const { calculation, impactTracking } =
    await calculateAndStoreGrowthOsImpact({
      userId,
      appliedRecommendation: activeAppliedRecommendation.appliedRecommendation,
      weeklyInputs,
      now,
    });

  await db
    .update(fsgosAppliedRecommendations)
    .set({
      status: "completed",
      completionDate: now,
      finalImpactCents: calculation.estimatedMonthlyImpactCents,
      confidence: calculation.confidence,
      updatedAt: now,
    })
    .where(
      and(
        eq(
          fsgosAppliedRecommendations.id,
          activeAppliedRecommendation.appliedRecommendation.id
        ),
        eq(fsgosAppliedRecommendations.userId, userId),
        eq(fsgosAppliedRecommendations.status, "active")
      )
    );

  if (activeAppliedRecommendation.recommendation?.id) {
    await db
      .update(fsgosRecommendations)
      .set({
        status: "applied",
        updatedAt: now,
      })
      .where(
        and(
          eq(
            fsgosRecommendations.id,
            activeAppliedRecommendation.recommendation.id
          ),
          eq(fsgosRecommendations.userId, userId)
        )
      );
  }

  if (
    activeAppliedRecommendation.appliedRecommendation.fastWin &&
    calculation.estimatedMonthlyImpactCents > 0
  ) {
    await db
      .update(fsgosUserState)
      .set({
        firstWinAchievedAt: sql`coalesce(${fsgosUserState.firstWinAchievedAt}, ${now})`,
        updatedAt: now,
      })
      .where(eq(fsgosUserState.userId, userId));
  }

  return {
    calculation,
    impactTracking,
  };
}

export function calculateGrowthOsImpact({
  appliedRecommendation,
  weeklyInputs,
}: {
  appliedRecommendation: AppliedRecommendationInput;
  weeklyInputs: WeeklyImpactInput[];
}): GrowthOsImpactCalculation {
  const baseline = appliedRecommendation.baselineMetrics;
  const dateAppliedWeekStart = getCurrentWeekStartDate(
    appliedRecommendation.dateApplied
  );
  const postApplicationInputs = weeklyInputs
    .filter((input) => input.weekStartDate >= dateAppliedWeekStart)
    .slice(0, 4);
  const current = buildCurrentMetrics(postApplicationInputs, baseline);
  const baselineOrders =
    baseline.aovCents > 0 ? baseline.revenueCents / baseline.aovCents : 0;

  const weeklyAovDelta =
    (current.aovCents - baseline.aovCents) * baselineOrders;
  const weeklyVolumeDelta =
    (current.orders - baselineOrders) * baseline.aovCents;
  const currentCostCents =
    current.revenueCents *
    ((current.foodCostPercent +
      current.laborPercent +
      current.wastePercent) /
      100);
  const baselineCostCents =
    baseline.revenueCents *
    ((baseline.foodCostPercent + baseline.laborPercent + baseline.wastePercent) /
      100);
  const weeklyCostSavings = baselineCostCents - currentCostCents;
  const aovDrivenRevenueDeltaCents = Math.round(weeklyAovDelta * MONTHLY_WEEKS);
  const volumeDrivenRevenueDeltaCents = Math.round(
    weeklyVolumeDelta * MONTHLY_WEEKS
  );
  const costSavingsDeltaCents = Math.round(weeklyCostSavings * MONTHLY_WEEKS);
  const estimatedMonthlyImpactCents =
    aovDrivenRevenueDeltaCents +
    volumeDrivenRevenueDeltaCents +
    costSavingsDeltaCents;
  const confidence = calculateImpactConfidence(current);

  return {
    baselineValueCents: baseline.revenueCents,
    currentValueCents: current.revenueCents,
    estimatedMonthlyImpactCents,
    aovDrivenRevenueDeltaCents,
    volumeDrivenRevenueDeltaCents,
    costSavingsDeltaCents,
    confidence,
    confidenceReasoning: buildImpactConfidenceReasoning(current, confidence),
    postApplicationWeeks: current.weeksIncluded,
    weekProgress: {
      current: Math.min(Math.max(current.weeksIncluded, 1), 4),
      total: 4,
    },
  };
}

function buildCurrentMetrics(
  weeklyInputs: WeeklyImpactInput[],
  baseline: GrowthOsBaselineMetrics
): CurrentMetrics {
  if (weeklyInputs.length === 0) {
    return {
      revenueCents: baseline.revenueCents,
      orders:
        baseline.aovCents > 0 ? baseline.revenueCents / baseline.aovCents : 0,
      aovCents: baseline.aovCents,
      foodCostPercent: baseline.foodCostPercent,
      laborPercent: baseline.laborPercent,
      wastePercent: baseline.wastePercent,
      contextFlags: [],
      weeksIncluded: 0,
    };
  }

  const revenueCents = Math.round(
    average(weeklyInputs.map((input) => input.weeklyRevenueCents))
  );
  const orders = average(weeklyInputs.map((input) => input.weeklyOrders));
  const aovCents =
    orders > 0
      ? calculateAovCents(revenueCents, Math.round(orders))
      : Math.round(average(weeklyInputs.map((input) => input.avgOrderValueCents)));

  return {
    revenueCents,
    orders,
    aovCents,
    foodCostPercent: roundOne(
      average(
        weeklyInputs.map((input) =>
          percentOf(input.weeklyIngredientCostCents, input.weeklyRevenueCents)
        )
      )
    ),
    laborPercent: roundOne(
      average(
        weeklyInputs.map((input) =>
          percentOf(input.weeklyLaborCostCents, input.weeklyRevenueCents)
        )
      )
    ),
    wastePercent: roundOne(
      average(
        weeklyInputs.map((input) =>
          percentOf(input.weeklyWasteEstimateCents, input.weeklyRevenueCents)
        )
      )
    ),
    contextFlags: weeklyInputs.map((input) =>
      normalizeContextFlags(input.contextFlags)
    ),
    weeksIncluded: weeklyInputs.length,
  };
}

function calculateImpactConfidence(
  current: CurrentMetrics
): GrowthOsImpactConfidence {
  const significantFlagWeeks = current.contextFlags.filter(
    (flags) => flags.badWeather || flags.equipmentIssue || flags.staffingIssue
  ).length;
  const flagShare =
    current.weeksIncluded > 0 ? significantFlagWeeks / current.weeksIncluded : 0;

  if (current.weeksIncluded < 2 || flagShare > 0.25) return "low";
  if (current.weeksIncluded < 4 || significantFlagWeeks > 0) return "medium";
  return "high";
}

function buildImpactConfidenceReasoning(
  current: CurrentMetrics,
  confidence: GrowthOsImpactConfidence
) {
  const flaggedWeeks = current.contextFlags.filter((flags) =>
    Object.values(flags).some(Boolean)
  ).length;
  const significantFlagWeeks = current.contextFlags.filter(
    (flags) => flags.badWeather || flags.equipmentIssue || flags.staffingIssue
  ).length;
  const flagText =
    flaggedWeeks === 0
      ? "No context flags are present in the tracking window."
      : `${flaggedWeeks} of ${current.weeksIncluded} tracking weeks include context flags; ${significantFlagWeeks} include significant external factors.`;

  return `${confidence.toUpperCase()} confidence: based on ${
    current.weeksIncluded
  } post-application week${current.weeksIncluded === 1 ? "" : "s"}. ${flagText}`;
}

function normalizeContextFlags(flags: Partial<GrowthOsContextFlags> = {}) {
  return {
    badWeather: Boolean(flags.badWeather),
    holidaySpike: Boolean(flags.holidaySpike),
    equipmentIssue: Boolean(flags.equipmentIssue),
    staffingIssue: Boolean(flags.staffingIssue),
    promotionRunning: Boolean(flags.promotionRunning),
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
