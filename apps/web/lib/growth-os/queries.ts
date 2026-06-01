import {
  db,
  fsgosAbTests,
  fsgosAppliedRecommendations,
  fsgosBusinessProfiles,
  fsgosImpactTracking,
  fsgosRecommendations,
  fsgosRiskAlerts,
  fsgosUserState,
  fsgosWeeklyInputs,
} from "@homereach/db";
import { and, desc, eq } from "drizzle-orm";

export async function getGrowthOsProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(fsgosBusinessProfiles)
    .where(eq(fsgosBusinessProfiles.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function getGrowthOsUserState(userId: string) {
  const [state] = await db
    .select()
    .from(fsgosUserState)
    .where(eq(fsgosUserState.userId, userId))
    .limit(1);

  return state ?? null;
}

export async function getGrowthOsWeeklyInputs(userId: string, limit = 12) {
  return db
    .select()
    .from(fsgosWeeklyInputs)
    .where(eq(fsgosWeeklyInputs.userId, userId))
    .orderBy(desc(fsgosWeeklyInputs.weekStartDate))
    .limit(limit);
}

export async function getGrowthOsLatestWeeklyInput(userId: string) {
  const [input] = await getGrowthOsWeeklyInputs(userId, 1);
  return input ?? null;
}

export async function getGrowthOsActiveAppliedRecommendation(userId: string) {
  const [row] = await db
    .select({
      appliedRecommendation: fsgosAppliedRecommendations,
      recommendation: fsgosRecommendations,
    })
    .from(fsgosAppliedRecommendations)
    .leftJoin(
      fsgosRecommendations,
      eq(
        fsgosAppliedRecommendations.recommendationId,
        fsgosRecommendations.id
      )
    )
    .where(
      and(
        eq(fsgosAppliedRecommendations.userId, userId),
        eq(fsgosAppliedRecommendations.status, "active")
      )
    )
    .limit(1);

  return row ?? null;
}

export async function getGrowthOsWinLog(userId: string, limit = 20) {
  return db
    .select({
      appliedRecommendation: fsgosAppliedRecommendations,
      recommendation: fsgosRecommendations,
      impactTracking: fsgosImpactTracking,
    })
    .from(fsgosAppliedRecommendations)
    .leftJoin(
      fsgosRecommendations,
      eq(
        fsgosAppliedRecommendations.recommendationId,
        fsgosRecommendations.id
      )
    )
    .leftJoin(
      fsgosImpactTracking,
      eq(
        fsgosAppliedRecommendations.id,
        fsgosImpactTracking.appliedRecommendationId
      )
    )
    .where(
      and(
        eq(fsgosAppliedRecommendations.userId, userId),
        eq(fsgosAppliedRecommendations.status, "completed")
      )
    )
    .orderBy(desc(fsgosAppliedRecommendations.completionDate))
    .limit(limit);
}

export async function getGrowthOsRiskAlerts(userId: string, limit = 10) {
  return db
    .select()
    .from(fsgosRiskAlerts)
    .where(
      and(eq(fsgosRiskAlerts.userId, userId), eq(fsgosRiskAlerts.status, "active"))
    )
    .orderBy(desc(fsgosRiskAlerts.detectedAt))
    .limit(limit);
}

export async function getGrowthOsAbTests(userId: string, limit = 20) {
  return db
    .select()
    .from(fsgosAbTests)
    .where(eq(fsgosAbTests.userId, userId))
    .orderBy(desc(fsgosAbTests.createdAt))
    .limit(limit);
}

export async function getGrowthOsPhase1Data(userId: string) {
  const [
    profile,
    weeklyInputs,
    userState,
    activeAppliedRecommendation,
    winLog,
    riskAlerts,
  ] = await Promise.all([
      getGrowthOsProfile(userId),
      getGrowthOsWeeklyInputs(userId, 12),
      getGrowthOsUserState(userId),
      getGrowthOsActiveAppliedRecommendation(userId),
      getGrowthOsWinLog(userId),
      getGrowthOsRiskAlerts(userId),
    ]);

  return {
    profile,
    weeklyInputs,
    latestWeeklyInput: weeklyInputs[0] ?? null,
    userState,
    activeAppliedRecommendation,
    winLog,
    riskAlerts,
  };
}
