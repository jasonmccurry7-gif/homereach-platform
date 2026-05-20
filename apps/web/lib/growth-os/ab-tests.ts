import { db, fsgosAbTests } from "@homereach/db";
import { and, desc, eq } from "drizzle-orm";
import { calculateAovCents, getCurrentWeekStartDate } from "./metrics";
import type { GrowthOsAbTestPrimaryMetric, GrowthOsAbTestResult } from "./types";

type ActiveAppliedRecommendationInput = {
  appliedRecommendation: {
    id: string;
    userId: string;
    status: string;
  };
  recommendation: {
    leverCategory: string;
  } | null;
};

type WeeklyInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  avgOrderValueCents: number;
};

export type GrowthOsAbTestCreateInput = {
  testType: "pricing" | "bundle";
  hypothesis: string;
  variantAName: string;
  variantADescription: string;
  variantAPrice?: number;
  variantBName: string;
  variantBDescription: string;
  variantBPrice?: number;
  primaryMetric: GrowthOsAbTestPrimaryMetric;
};

export async function getGrowthOsAbTests(userId: string, limit = 20) {
  return db
    .select()
    .from(fsgosAbTests)
    .where(eq(fsgosAbTests.userId, userId))
    .orderBy(desc(fsgosAbTests.createdAt))
    .limit(limit);
}

export async function getGrowthOsActiveAbTest(userId: string) {
  const [test] = await db
    .select()
    .from(fsgosAbTests)
    .where(and(eq(fsgosAbTests.userId, userId), eq(fsgosAbTests.status, "active")))
    .limit(1);

  return test ?? null;
}

export async function createGrowthOsAbTest({
  userId,
  activeAppliedRecommendation,
  input,
}: {
  userId: string;
  activeAppliedRecommendation: ActiveAppliedRecommendationInput | null;
  input: GrowthOsAbTestCreateInput;
}) {
  if (!activeAppliedRecommendation) {
    return {
      error: "A/B tests require an active lever first.",
      abTest: null,
    };
  }

  const activeTest = await getGrowthOsActiveAbTest(userId);
  if (activeTest) {
    return {
      error: "An active A/B test already exists.",
      abTest: activeTest,
    };
  }

  const [abTest] = await db
    .insert(fsgosAbTests)
    .values({
      userId,
      appliedRecommendationId:
        activeAppliedRecommendation.appliedRecommendation.id,
      testType: input.testType,
      hypothesis: input.hypothesis,
      variantAName: input.variantAName,
      variantAConfig: {
        description: input.variantADescription,
        priceCents:
          input.variantAPrice === undefined
            ? undefined
            : Math.round(input.variantAPrice * 100),
      },
      variantBName: input.variantBName,
      variantBConfig: {
        description: input.variantBDescription,
        priceCents:
          input.variantBPrice === undefined
            ? undefined
            : Math.round(input.variantBPrice * 100),
      },
      primaryMetric: input.primaryMetric,
      startDate: getCurrentWeekStartDate(),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return { error: null, abTest: abTest ?? null };
}

export async function evaluateGrowthOsActiveAbTest({
  userId,
  weeklyInputs,
}: {
  userId: string;
  weeklyInputs: WeeklyInput[];
}) {
  const activeTest = await getGrowthOsActiveAbTest(userId);
  if (!activeTest) return { error: "No active A/B test.", abTest: null };

  const result = evaluateGrowthOsAbTest(activeTest, weeklyInputs);
  const [updatedTest] = await db
    .update(fsgosAbTests)
    .set({
      status: result.weeksAnalyzed >= 2 ? "completed" : "active",
      endDate: result.weeksAnalyzed >= 2 ? getCurrentWeekStartDate() : null,
      winningVariant: getWinningVariant(result),
      confidence: getAbTestConfidence(result.weeksAnalyzed, result.liftPercent),
      resultSummary: result,
      updatedAt: new Date(),
    })
    .where(and(eq(fsgosAbTests.id, activeTest.id), eq(fsgosAbTests.userId, userId)))
    .returning();

  return { error: null, abTest: updatedTest ?? null };
}

export function evaluateGrowthOsAbTest(
  abTest: {
    startDate: string;
    primaryMetric: string;
  },
  weeklyInputs: WeeklyInput[]
): GrowthOsAbTestResult {
  const testWeeks = weeklyInputs
    .filter((input) => input.weekStartDate >= abTest.startDate)
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  const variantA = testWeeks.filter((_, index) => index % 2 === 0);
  const variantB = testWeeks.filter((_, index) => index % 2 === 1);
  const variantAValue = average(
    variantA.map((input) => selectPrimaryMetric(input, abTest.primaryMetric))
  );
  const variantBValue = average(
    variantB.map((input) => selectPrimaryMetric(input, abTest.primaryMetric))
  );
  const liftPercent =
    variantAValue === 0 ? 0 : ((variantBValue - variantAValue) / variantAValue) * 100;
  const weeksAnalyzed = testWeeks.length;

  return {
    weeksAnalyzed,
    variantAValue: Math.round(variantAValue),
    variantBValue: Math.round(variantBValue),
    liftPercent: Math.round(liftPercent * 10) / 10,
    notes:
      weeksAnalyzed < 2
        ? "Needs at least two submitted weeks after test start to compare A vs B."
        : "Directional weekly comparison. Not isolated for seasonality or traffic mix.",
  };
}

function selectPrimaryMetric(input: WeeklyInput, primaryMetric: string) {
  if (primaryMetric === "revenue_cents") return input.weeklyRevenueCents;
  if (primaryMetric === "orders") return input.weeklyOrders;
  return (
    input.avgOrderValueCents ||
    calculateAovCents(input.weeklyRevenueCents, input.weeklyOrders)
  );
}

function getWinningVariant(result: GrowthOsAbTestResult) {
  if (result.weeksAnalyzed < 2) return null;
  if (Math.abs(result.liftPercent) < 2) return "tie";
  return result.liftPercent > 0 ? "B" : "A";
}

function getAbTestConfidence(weeksAnalyzed: number, liftPercent: number) {
  if (weeksAnalyzed < 2) return null;
  if (weeksAnalyzed >= 4 && Math.abs(liftPercent) >= 8) return "medium";
  return "low";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
