import { calculateAovCents } from "./metrics";
import type { GrowthOsBaselineMetrics } from "./types";

type GrowthOsProfileBaselineInput = {
  weeklyRevenueCents: number;
  avgOrderValueCents: number;
  dailyCustomers: number;
  laborCostWeeklyCents: number;
  ingredientCostWeeklyCents: number;
};

type GrowthOsWeeklyBaselineInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  weeklyLaborCostCents: number;
  weeklyIngredientCostCents: number;
  weeklyWasteEstimateCents: number;
  avgOrderValueCents: number;
};

export function calculateGrowthOsBaselineMetrics({
  profile,
  weeklyInputs,
  now = new Date(),
}: {
  profile: GrowthOsProfileBaselineInput;
  weeklyInputs: GrowthOsWeeklyBaselineInput[];
  now?: Date;
}): GrowthOsBaselineMetrics {
  const latestFour = weeklyInputs.slice(0, 4);
  if (latestFour.length === 0) {
    const estimatedOrders = estimateProfileWeeklyOrders(profile);
    const aovCents =
      profile.avgOrderValueCents ||
      calculateAovCents(profile.weeklyRevenueCents, estimatedOrders);

    return {
      source: "profile_fallback",
      weeksIncluded: 0,
      capturedAt: now.toISOString(),
      weekStartDates: [],
      revenueCents: profile.weeklyRevenueCents,
      aovCents,
      foodCostPercent: percentOf(
        profile.ingredientCostWeeklyCents,
        profile.weeklyRevenueCents
      ),
      laborPercent: percentOf(
        profile.laborCostWeeklyCents,
        profile.weeklyRevenueCents
      ),
      wastePercent: 0,
    };
  }

  const metrics = latestFour.map((input) => ({
    revenueCents: input.weeklyRevenueCents,
    aovCents:
      input.avgOrderValueCents ||
      calculateAovCents(input.weeklyRevenueCents, input.weeklyOrders),
    foodCostPercent: percentOf(
      input.weeklyIngredientCostCents,
      input.weeklyRevenueCents
    ),
    laborPercent: percentOf(
      input.weeklyLaborCostCents,
      input.weeklyRevenueCents
    ),
    wastePercent: percentOf(
      input.weeklyWasteEstimateCents,
      input.weeklyRevenueCents
    ),
  }));

  return {
    source: "rolling_4_week",
    weeksIncluded: latestFour.length,
    capturedAt: now.toISOString(),
    weekStartDates: latestFour.map((input) => input.weekStartDate),
    revenueCents: Math.round(average(metrics.map((metric) => metric.revenueCents))),
    aovCents: Math.round(average(metrics.map((metric) => metric.aovCents))),
    foodCostPercent: roundOne(
      average(metrics.map((metric) => metric.foodCostPercent))
    ),
    laborPercent: roundOne(average(metrics.map((metric) => metric.laborPercent))),
    wastePercent: roundOne(average(metrics.map((metric) => metric.wastePercent))),
  };
}

function estimateProfileWeeklyOrders(profile: GrowthOsProfileBaselineInput) {
  if (profile.weeklyRevenueCents > 0 && profile.avgOrderValueCents > 0) {
    return Math.max(
      1,
      Math.round(profile.weeklyRevenueCents / profile.avgOrderValueCents)
    );
  }
  if (profile.dailyCustomers > 0) return profile.dailyCustomers * 6;
  return 1;
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
