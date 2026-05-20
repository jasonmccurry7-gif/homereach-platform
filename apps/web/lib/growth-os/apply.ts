import {
  db,
  fsgosAppliedRecommendations,
  fsgosRecommendations,
} from "@homereach/db";
import { and, eq } from "drizzle-orm";
import { calculateGrowthOsBaselineMetrics } from "./baseline";
import { getGrowthOsActiveAppliedRecommendation } from "./queries";
import { persistGrowthOsRecommendations } from "./recommendations";
import type { GrowthOsRecommendation } from "./types";

type GrowthOsProfileApplyInput = {
  weeklyRevenueCents: number;
  avgOrderValueCents: number;
  dailyCustomers: number;
  laborCostWeeklyCents: number;
  ingredientCostWeeklyCents: number;
};

type GrowthOsWeeklyApplyInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  weeklyLaborCostCents: number;
  weeklyIngredientCostCents: number;
  weeklyWasteEstimateCents: number;
  avgOrderValueCents: number;
};

export async function applyGrowthOsRecommendation({
  userId,
  profile,
  weeklyInputs,
  recommendation,
  now = new Date(),
}: {
  userId: string;
  profile: GrowthOsProfileApplyInput;
  weeklyInputs: GrowthOsWeeklyApplyInput[];
  recommendation: GrowthOsRecommendation;
  now?: Date;
}) {
  const activeAppliedRecommendation =
    await getGrowthOsActiveAppliedRecommendation(userId);

  if (activeAppliedRecommendation) {
    return {
      appliedRecommendation: null,
      recommendation: null,
      activeAppliedRecommendation,
      alreadyActive: true,
    };
  }

  const [savedRecommendation] = await persistGrowthOsRecommendations(userId, [
    recommendation,
  ]);

  if (!savedRecommendation) {
    throw new Error("Recommendation could not be saved before activation.");
  }

  const baselineMetrics = calculateGrowthOsBaselineMetrics({
    profile,
    weeklyInputs,
    now,
  });

  const [appliedRecommendation] = await db
    .insert(fsgosAppliedRecommendations)
    .values({
      userId,
      recommendationId: savedRecommendation.id,
      leverCategory: recommendation.leverCategory,
      fastWin: recommendation.fastWin,
      baselineMetrics,
      dateApplied: now,
      status: "active",
      confidence: recommendation.confidence,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(fsgosRecommendations)
    .set({
      status: "applied",
      updatedAt: now,
    })
    .where(
      and(
        eq(fsgosRecommendations.id, savedRecommendation.id),
        eq(fsgosRecommendations.userId, userId)
      )
    );

  return {
    appliedRecommendation: appliedRecommendation ?? null,
    recommendation: savedRecommendation,
    activeAppliedRecommendation: null,
    alreadyActive: false,
  };
}
