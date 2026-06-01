import { calculateAndStoreGrowthOsImpact } from "./impact";
import {
  calculateWeeklyDashboardMetrics,
  formatCurrencyCents,
  formatPercent,
} from "./metrics";
import { getGrowthOsPhase1Data } from "./queries";
import { generateGrowthOsRecommendations } from "./recommendations";

export type GrowthOsAiContext = Awaited<ReturnType<typeof buildGrowthOsAiContext>>;

export async function buildGrowthOsAiContext(userId: string) {
  const data = await getGrowthOsPhase1Data(userId);
  if (!data.profile) return null;

  const latestWeeklyInput = data.latestWeeklyInput;
  const currentMetrics = latestWeeklyInput
    ? calculateWeeklyDashboardMetrics(latestWeeklyInput, data.profile)
    : null;
  const recommendations = await generateGrowthOsRecommendations({
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });
  const activeImpact = data.activeAppliedRecommendation
    ? (
        await calculateAndStoreGrowthOsImpact({
          userId,
          appliedRecommendation:
            data.activeAppliedRecommendation.appliedRecommendation,
          weeklyInputs: data.weeklyInputs,
        })
      ).calculation
    : null;
  const recentWins = data.winLog.slice(0, 5).map((entry) => ({
    title: entry.recommendation?.title ?? entry.appliedRecommendation.leverCategory,
    action: entry.recommendation?.actionText ?? "",
    impactCents:
      entry.appliedRecommendation.finalImpactCents ??
      entry.impactTracking?.estimatedMonthlyImpactCents ??
      0,
    confidence:
      entry.impactTracking?.confidence ?? entry.appliedRecommendation.confidence,
    completedAt: entry.appliedRecommendation.completionDate,
  }));

  return {
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
    currentMetrics,
    activeLever: data.activeAppliedRecommendation
      ? {
          appliedRecommendation:
            data.activeAppliedRecommendation.appliedRecommendation,
          recommendation: data.activeAppliedRecommendation.recommendation,
          impact: activeImpact,
        }
      : null,
    recommendations,
    recentWins,
    summary: buildContextSummary({
      companyName: data.profile.companyName,
      businessType: data.profile.businessType,
      ownerGoal: data.profile.ownerGoal,
      weeksSubmitted: data.weeklyInputs.length,
      currentMetrics,
      activeLeverTitle:
        data.activeAppliedRecommendation?.recommendation?.title ?? null,
      activeImpactCents: activeImpact?.estimatedMonthlyImpactCents ?? null,
      recentWins,
      topRecommendationTitle: recommendations[0]?.title ?? null,
    }),
  };
}

function buildContextSummary({
  companyName,
  businessType,
  ownerGoal,
  weeksSubmitted,
  currentMetrics,
  activeLeverTitle,
  activeImpactCents,
  recentWins,
  topRecommendationTitle,
}: {
  companyName: string;
  businessType: string;
  ownerGoal: string;
  weeksSubmitted: number;
  currentMetrics: ReturnType<typeof calculateWeeklyDashboardMetrics> | null;
  activeLeverTitle: string | null;
  activeImpactCents: number | null;
  recentWins: Array<{ title: string; impactCents: number }>;
  topRecommendationTitle: string | null;
}) {
  const metricsText = currentMetrics
    ? [
        `Revenue ${formatCurrencyCents(currentMetrics.revenueCents)}`,
        `Profit ${formatCurrencyCents(currentMetrics.profitCents)}`,
        `AOV ${formatCurrencyCents(currentMetrics.aovCents)}`,
        `Food cost ${formatPercent(currentMetrics.foodCostPercent)}`,
        `Labor ${formatPercent(currentMetrics.laborPercent)}`,
      ].join(", ")
    : "No weekly input yet; use profile metrics and cold-start recommendations.";
  const activeText = activeLeverTitle
    ? `${activeLeverTitle} with estimated impact ${
        activeImpactCents === null
          ? "not calculated yet"
          : formatCurrencyCents(activeImpactCents)
      }/mo`
    : "No active lever.";
  const winsText =
    recentWins.length > 0
      ? recentWins
          .map((win) => `${win.title}: ${formatCurrencyCents(win.impactCents)}/mo`)
          .join("; ")
      : "No completed wins yet.";

  return [
    `${companyName} is a ${businessType}.`,
    `Owner goal: ${ownerGoal}.`,
    `Weeks submitted: ${weeksSubmitted}.`,
    `Current metrics: ${metricsText}`,
    `Active lever: ${activeText}`,
    `Recent wins: ${winsText}`,
    `Next recommendation: ${topRecommendationTitle ?? "none available"}.`,
  ].join("\n");
}
