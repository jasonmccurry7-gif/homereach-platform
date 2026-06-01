import { db, fsgosRecommendations } from "@homereach/db";
import { sql } from "drizzle-orm";
import { getGrowthOsBenchmarksForProfile } from "./benchmarks";
import { getCurrentWeekStartDate, formatCurrencyCents, formatPercent } from "./metrics";
import { refineRecommendationLanguageWithClaude } from "./claude";
import type {
  GrowthOsContextFlags,
  GrowthOsLeverCategory,
  GrowthOsRecommendation,
  GrowthOsRecommendationConfidence,
  GrowthOsRecommendationSource,
} from "./types";

const MONTHLY_WEEKS = 4.33;
const CONFIDENCE_WEIGHTS: Record<GrowthOsRecommendationConfidence, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1,
};

type GrowthOsProfileInput = {
  userId: string;
  createdAt: Date;
  companyName: string;
  businessType: string;
  locationZip: string;
  weeklyRevenueCents: number;
  avgOrderValueCents: number;
  dailyCustomers: number;
  laborCostWeeklyCents: number;
  ingredientCostWeeklyCents: number;
  ownerGoal: string;
};

type GrowthOsWeeklyInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  weeklyLaborCostCents: number;
  weeklyIngredientCostCents: number;
  weeklyWasteEstimateCents: number;
  avgOrderValueCents: number;
  contextFlags: Partial<GrowthOsContextFlags>;
};

type GenerateGrowthOsRecommendationsArgs = {
  profile: GrowthOsProfileInput;
  weeklyInputs: GrowthOsWeeklyInput[];
  now?: Date;
};

type OperatingSnapshot = {
  dataWeeks: number;
  weekStartDate: string;
  revenueCents: number;
  weeklyOrders: number;
  aovCents: number;
  laborCostCents: number;
  ingredientCostCents: number;
  wasteEstimateCents: number;
  foodCostPercent: number;
  laborPercent: number;
  contextFlags: GrowthOsContextFlags[];
};

export async function generateGrowthOsRecommendations({
  profile,
  weeklyInputs,
  now = new Date(),
}: GenerateGrowthOsRecommendationsArgs) {
  const snapshot = buildOperatingSnapshot(profile, weeklyInputs, now);
  const first14Days = isWithinDays(profile.createdAt, now, 14);
  const recommendations: GrowthOsRecommendation[] = [];
  const benchmarks = await getGrowthOsBenchmarksForProfile({
    businessType: profile.businessType,
    weeklyRevenueCents: snapshot.revenueCents || profile.weeklyRevenueCents,
    locationZip: profile.locationZip,
  });
  const aovBenchmark = benchmarks.metrics.aov_cents;
  const foodCostBenchmark = benchmarks.metrics.food_cost_percent;
  const laborBenchmark = benchmarks.metrics.labor_percent;
  const aovBenchmarkCents = Math.round(aovBenchmark.p50);
  const foodCostTargetPercent = foodCostBenchmark.p50;
  const laborTargetPercent = laborBenchmark.p50;

  if (snapshot.foodCostPercent > foodCostTargetPercent) {
    recommendations.push(
      buildRecommendation({
        triggerKey: "food_cost_high",
        source: "profile_based",
        leverCategory: "waste",
        fastWin: true,
        estimatedMonthlyImpactCents: Math.round(
          ((snapshot.foodCostPercent - foodCostTargetPercent) / 100) *
            snapshot.revenueCents *
            MONTHLY_WEEKS *
            0.5
        ),
        confidence: calculateConfidence(snapshot),
        snapshot,
        title: "Cut waste on the two most expensive items",
        problem: `${profile.companyName} is running food cost at ${formatPercent(
          snapshot.foodCostPercent
        )}, above the ${formatPercent(foodCostTargetPercent)} benchmark.`,
        whyItMatters:
          `Ingredient leakage compounds quickly because it reduces cash before sales volume can cover it. Benchmark source: ${formatBenchmarkSource(foodCostBenchmark.source)}.`,
        actionText:
          "For the next 7 days, record end-of-day unsold units by item and reduce tomorrow's batch size by 10% on the two highest-waste items.",
      })
    );
  }

  if (snapshot.laborPercent > laborTargetPercent) {
    recommendations.push(
      buildRecommendation({
        triggerKey: "labor_high",
        source: "profile_based",
        leverCategory: "staffing",
        fastWin: false,
        estimatedMonthlyImpactCents: Math.round(
          ((snapshot.laborPercent - laborTargetPercent) / 100) *
            snapshot.revenueCents *
            MONTHLY_WEEKS *
            0.35
        ),
        confidence: calculateConfidence(snapshot),
        snapshot,
        title: "Move prep work away from slow sales hours",
        problem: `${profile.companyName} is running labor at ${formatPercent(
          snapshot.laborPercent
        )}, above the ${formatPercent(laborTargetPercent)} benchmark.`,
        whyItMatters:
          `Labor overages are usually easier to fix through task timing than broad staffing cuts. Benchmark source: ${formatBenchmarkSource(laborBenchmark.source)}.`,
        actionText:
          "Move one repeatable prep task out of the slowest hour this week and track whether the same output is completed with fewer paid minutes.",
      })
    );
  }

  if (snapshot.aovCents > 0 && snapshot.aovCents < aovBenchmarkCents) {
    const liftCents = Math.min(aovBenchmarkCents - snapshot.aovCents, 250);
    recommendations.push(
      buildRecommendation({
        triggerKey: "aov_below_benchmark",
        source: "profile_based",
        leverCategory: "aov",
        fastWin: true,
        estimatedMonthlyImpactCents: Math.round(
          snapshot.weeklyOrders * liftCents * 0.25 * MONTHLY_WEEKS
        ),
        confidence: calculateConfidence(snapshot),
        snapshot,
        title: "Add a simple counter bundle",
        problem: `Average order value is ${formatCurrencyCents(
          snapshot.aovCents
        )}, below the ${formatCurrencyCents(
          aovBenchmarkCents
        )} benchmark for ${profile.businessType}.`,
        whyItMatters:
          `A small attach-rate lift can raise daily sales without requiring more foot traffic. Benchmark source: ${formatBenchmarkSource(aovBenchmark.source)}.`,
        actionText:
          "Create one visible bundle this week that adds a drink, mini item, or premium topping and coach the counter script around that offer.",
      })
    );
  }

  if (snapshot.dataWeeks >= 3) {
    const trendRecommendation = buildRevenueTrendRecommendation(
      profile,
      weeklyInputs,
      snapshot
    );
    if (trendRecommendation) recommendations.push(trendRecommendation);
  }

  const filledRecommendations = fillRecommendationMinimum(
    recommendations,
    profile,
    snapshot
  );
  const sortedRecommendations = sortRecommendations(
    dedupeRecommendations(filledRecommendations),
    first14Days
  ).slice(0, 3);

  return refineRecommendationLanguageWithClaude({
    companyName: profile.companyName,
    businessType: profile.businessType,
    ownerGoal: profile.ownerGoal,
    recommendations: sortedRecommendations,
  });
}

export async function persistGrowthOsRecommendations(
  userId: string,
  recommendations: GrowthOsRecommendation[]
) {
  if (recommendations.length === 0) return [];

  return db
    .insert(fsgosRecommendations)
    .values(
      recommendations.map((recommendation) => ({
        userId,
        weekStartDate: recommendation.weekStartDate,
        triggerKey: recommendation.triggerKey,
        source: recommendation.source,
        leverCategory: recommendation.leverCategory,
        title: recommendation.title,
        problem: recommendation.problem,
        whyItMatters: recommendation.whyItMatters,
        actionText: recommendation.actionText,
        estimatedMonthlyImpactCents:
          recommendation.estimatedMonthlyImpactCents,
        confidence: recommendation.confidence,
        confidenceReasoning: recommendation.confidenceReasoning,
        rankingScore: recommendation.rankingScore.toFixed(2),
        fastWin: recommendation.fastWin,
        status: "recommended",
        dataSnapshot: recommendation.dataSnapshot,
        updatedAt: new Date(),
      }))
    )
    .onConflictDoUpdate({
      target: [
        fsgosRecommendations.userId,
        fsgosRecommendations.weekStartDate,
        fsgosRecommendations.triggerKey,
      ],
      set: {
        updatedAt: new Date(),
        source: sql`excluded.source`,
        leverCategory: sql`excluded.lever_category`,
        title: sql`excluded.title`,
        problem: sql`excluded.problem`,
        whyItMatters: sql`excluded.why_it_matters`,
        actionText: sql`excluded.action_text`,
        estimatedMonthlyImpactCents: sql`excluded.estimated_monthly_impact_cents`,
        confidence: sql`excluded.confidence`,
        confidenceReasoning: sql`excluded.confidence_reasoning`,
        rankingScore: sql`excluded.ranking_score`,
        fastWin: sql`excluded.fast_win`,
        dataSnapshot: sql`excluded.data_snapshot`,
      },
    })
    .returning();
}

function buildRevenueTrendRecommendation(
  profile: GrowthOsProfileInput,
  weeklyInputs: GrowthOsWeeklyInput[],
  snapshot: OperatingSnapshot
) {
  const sorted = [...weeklyInputs].sort((a, b) =>
    a.weekStartDate.localeCompare(b.weekStartDate)
  );
  const recent = sorted.slice(-4);
  if (recent.length < 3) return null;

  const first = recent[0]!.weeklyRevenueCents;
  const last = recent[recent.length - 1]!.weeklyRevenueCents;
  if (first <= 0) return null;

  const changePercent = ((last - first) / first) * 100;
  if (changePercent > 2) return null;

  const averageRevenueCents = Math.round(
    recent.reduce((sum, input) => sum + input.weeklyRevenueCents, 0) /
      recent.length
  );
  const gapCents = Math.max(averageRevenueCents - last, snapshot.revenueCents * 0.02);

  return buildRecommendation({
    triggerKey: "revenue_flat_or_declining",
    source: "trend_based",
    leverCategory: "demand",
    fastWin: false,
    estimatedMonthlyImpactCents: Math.round(gapCents * MONTHLY_WEEKS * 0.4),
    confidence: calculateConfidence(snapshot),
    snapshot,
    title: "Use one focused offer to restart weekly sales momentum",
    problem: `${profile.companyName} revenue is ${formatPercent(
      changePercent
    )} over the last ${recent.length} submitted weeks.`,
    whyItMatters:
      "A flat or declining sales line needs one clean test before broader marketing work is worth the effort.",
    actionText:
      "Pick the weakest day from the last three weeks and run one limited bundle or add-on offer only on that day this week.",
  });
}

function fillRecommendationMinimum(
  recommendations: GrowthOsRecommendation[],
  profile: GrowthOsProfileInput,
  snapshot: OperatingSnapshot
) {
  const minCount = snapshot.dataWeeks >= 4 ? 3 : 1;
  if (recommendations.length >= minCount) return recommendations;
  const fillerSource: GrowthOsRecommendationSource =
    snapshot.dataWeeks <= 2 ? "profile_based" : "fallback";

  const fillers = [
    buildRecommendation({
      triggerKey: "fast_win_bundle_launch",
      source: fillerSource,
      leverCategory: "aov",
      fastWin: true,
      estimatedMonthlyImpactCents: Math.round(
        snapshot.weeklyOrders * 150 * 0.2 * MONTHLY_WEEKS
      ),
      confidence: calculateConfidence(snapshot),
      snapshot,
      title: "Launch one easy add-on bundle",
      problem: `${profile.companyName} needs a fast lever that can show a measurable sales lift within 14 days.`,
      whyItMatters:
        "Bundles are quick to explain, easy to track, and usually show impact faster than staffing or demand changes.",
      actionText:
        "Choose one high-margin item and one natural add-on, price the pair with a visible savings cue, and track bundle orders separately this week.",
    }),
    buildRecommendation({
      triggerKey: "fast_win_price_rounding",
      source: fillerSource,
      leverCategory: "pricing",
      fastWin: true,
      estimatedMonthlyImpactCents: Math.round(
        snapshot.revenueCents * 0.03 * 0.7 * MONTHLY_WEEKS
      ),
      confidence: calculateConfidence(snapshot),
      snapshot,
      title: "Round prices on your easiest sellers",
      problem: `${profile.companyName} can test a small pricing lift without changing the whole menu.`,
      whyItMatters:
        "A tiny increase on familiar items is one of the fastest ways to improve profit without adding labor.",
      actionText:
        "Pick three best-selling items, raise each by 25 to 50 cents, and compare order count and revenue against last week.",
    }),
    buildRecommendation({
      triggerKey: "fast_win_waste_log",
      source: fillerSource,
      leverCategory: "waste",
      fastWin: true,
      estimatedMonthlyImpactCents: Math.round(
        Math.max(snapshot.ingredientCostCents * 0.04, 2500) * MONTHLY_WEEKS
      ),
      confidence: calculateConfidence(snapshot),
      snapshot,
      title: "Start a 7-day waste log",
      problem: `${profile.companyName} needs a simple waste baseline before bigger operational changes.`,
      whyItMatters:
        "Waste reductions turn directly into cash and are easier to prove when the count is simple.",
      actionText:
        "Log unsold units and estimated dollar waste by item at close for 7 days, then cut prep volume on the top waste item by 10%.",
    }),
  ];

  const output = [...recommendations];
  for (const filler of fillers) {
    if (output.length >= minCount) break;
    if (!output.some((item) => item.triggerKey === filler.triggerKey)) {
      output.push(filler);
    }
  }

  return output;
}

function buildRecommendation({
  triggerKey,
  source,
  leverCategory,
  fastWin,
  estimatedMonthlyImpactCents,
  confidence,
  snapshot,
  title,
  problem,
  whyItMatters,
  actionText,
}: {
  triggerKey: string;
  source: GrowthOsRecommendationSource;
  leverCategory: GrowthOsLeverCategory;
  fastWin: boolean;
  estimatedMonthlyImpactCents: number;
  confidence: GrowthOsRecommendationConfidence;
  snapshot: OperatingSnapshot;
  title: string;
  problem: string;
  whyItMatters: string;
  actionText: string;
}) {
  const safeImpact = Math.max(estimatedMonthlyImpactCents, 1000);
  const rankingScore = safeImpact * CONFIDENCE_WEIGHTS[confidence];

  return {
    triggerKey,
    weekStartDate: snapshot.weekStartDate,
    source,
    leverCategory,
    title,
    problem,
    whyItMatters,
    actionText,
    estimatedMonthlyImpactCents: safeImpact,
    confidence,
    confidenceReasoning: buildConfidenceReasoning(snapshot),
    rankingScore,
    fastWin,
    dataSnapshot: {
      dataWeeks: snapshot.dataWeeks,
      currentRevenueCents: snapshot.revenueCents,
      currentAovCents: snapshot.aovCents,
      currentFoodCostPercent: snapshot.foodCostPercent,
      currentLaborPercent: snapshot.laborPercent,
      contextFlags: snapshot.contextFlags,
    },
  };
}

function buildOperatingSnapshot(
  profile: GrowthOsProfileInput,
  weeklyInputs: GrowthOsWeeklyInput[],
  now: Date
): OperatingSnapshot {
  const latest = weeklyInputs[0];
  const revenueCents =
    latest?.weeklyRevenueCents ?? profile.weeklyRevenueCents;
  const profileOrders = estimateProfileWeeklyOrders(profile);
  const weeklyOrders = latest?.weeklyOrders || profileOrders;
  const aovCents =
    latest?.avgOrderValueCents ||
    profile.avgOrderValueCents ||
    calculateAovCents(revenueCents, weeklyOrders);
  const laborCostCents =
    latest?.weeklyLaborCostCents ?? profile.laborCostWeeklyCents;
  const ingredientCostCents =
    latest?.weeklyIngredientCostCents ?? profile.ingredientCostWeeklyCents;
  const wasteEstimateCents = latest?.weeklyWasteEstimateCents ?? 0;
  const contextFlags = weeklyInputs
    .slice(0, 4)
    .map((input) => normalizeContextFlags(input.contextFlags));

  return {
    dataWeeks: weeklyInputs.length,
    weekStartDate: getCurrentWeekStartDate(now),
    revenueCents,
    weeklyOrders,
    aovCents,
    laborCostCents,
    ingredientCostCents,
    wasteEstimateCents,
    foodCostPercent: percentOf(ingredientCostCents, revenueCents),
    laborPercent: percentOf(laborCostCents, revenueCents),
    contextFlags,
  };
}

function calculateConfidence(snapshot: OperatingSnapshot) {
  const significantFlagWeeks = snapshot.contextFlags.filter(
    (flags) => flags.badWeather || flags.equipmentIssue || flags.staffingIssue
  ).length;
  const trackingWeeks = Math.max(snapshot.contextFlags.length, 1);
  const significantFlagShare = significantFlagWeeks / trackingWeeks;

  if (snapshot.dataWeeks < 2 || significantFlagShare > 0.25) return "low";
  if (snapshot.dataWeeks < 4 || significantFlagWeeks > 0) return "medium";
  return "high";
}

function buildConfidenceReasoning(snapshot: OperatingSnapshot) {
  const flaggedWeeks = snapshot.contextFlags.filter((flags) =>
    Object.values(flags).some(Boolean)
  ).length;
  const flagText =
    flaggedWeeks === 0
      ? "No context flags are present in the current comparison window."
      : `${flaggedWeeks} of the latest ${
          snapshot.contextFlags.length
        } weeks include context flags.`;

  return `Based on ${
    snapshot.dataWeeks
  } submitted week${snapshot.dataWeeks === 1 ? "" : "s"} and current profile metrics. ${flagText}`;
}

function sortRecommendations(
  recommendations: GrowthOsRecommendation[],
  first14Days: boolean
) {
  return [...recommendations].sort((a, b) => {
    if (first14Days && a.fastWin !== b.fastWin) return a.fastWin ? -1 : 1;
    return b.rankingScore - a.rankingScore;
  });
}

function dedupeRecommendations(recommendations: GrowthOsRecommendation[]) {
  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    if (seen.has(recommendation.triggerKey)) return false;
    seen.add(recommendation.triggerKey);
    return true;
  });
}

function formatBenchmarkSource(source: string) {
  return source === "aggregated_user_data"
    ? "anonymized Growth OS cohort"
    : "public industry fallback";
}

function estimateProfileWeeklyOrders(profile: GrowthOsProfileInput) {
  if (profile.weeklyRevenueCents > 0 && profile.avgOrderValueCents > 0) {
    return Math.max(1, Math.round(profile.weeklyRevenueCents / profile.avgOrderValueCents));
  }
  if (profile.dailyCustomers > 0) return profile.dailyCustomers * 6;
  return 1;
}

function calculateAovCents(revenueCents: number, orders: number) {
  if (orders <= 0) return 0;
  return Math.round(revenueCents / orders);
}

function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
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

function isWithinDays(start: Date, end: Date, days: number) {
  return end.getTime() - start.getTime() < days * 24 * 60 * 60 * 1000;
}
