import type { GrowthOsMetricTrend } from "./types";

type WeeklyMetricInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  weeklyLaborCostCents: number;
  weeklyIngredientCostCents: number;
  weeklyWasteEstimateCents: number;
  avgOrderValueCents: number;
};

type BusinessCostInput = {
  overheadMonthlyCents: number;
};

export function dollarsToCents(value: number) {
  return Math.round(value * 100);
}

export function centsToDollars(value: number) {
  return value / 100;
}

export function formatCurrencyCents(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(centsToDollars(value));
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function calculateAovCents(revenueCents: number, orders: number) {
  if (orders <= 0) return 0;
  return Math.round(revenueCents / orders);
}

export function getCurrentWeekStartDate(today = new Date()) {
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDateKey(date);
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function subtractWeeks(dateKey: string, weeks: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - weeks * 7);
  return toDateKey(date);
}

export function calculateWeeklyDashboardMetrics(
  input: WeeklyMetricInput,
  profile: BusinessCostInput
): {
  revenueCents: number;
  profitCents: number;
  aovCents: number;
  foodCostPercent: number;
  laborPercent: number;
} {
  const revenueCents = input.weeklyRevenueCents;
  const weeklyOverheadCents = Math.round(profile.overheadMonthlyCents / 4.33);
  const profitCents =
    revenueCents -
    input.weeklyLaborCostCents -
    input.weeklyIngredientCostCents -
    input.weeklyWasteEstimateCents -
    weeklyOverheadCents;

  return {
    revenueCents,
    profitCents,
    aovCents:
      input.avgOrderValueCents ||
      calculateAovCents(input.weeklyRevenueCents, input.weeklyOrders),
    foodCostPercent: percentOf(input.weeklyIngredientCostCents, revenueCents),
    laborPercent: percentOf(input.weeklyLaborCostCents, revenueCents),
  };
}

export function calculateTrend(
  inputs: WeeklyMetricInput[],
  selector: (input: WeeklyMetricInput) => number
): GrowthOsMetricTrend | null {
  if (inputs.length < 4) return null;

  const sorted = [...inputs].sort((a, b) =>
    a.weekStartDate.localeCompare(b.weekStartDate)
  );
  const lastFour = sorted.slice(-4);
  const first = selector(lastFour[0]!);
  const last = selector(lastFour[lastFour.length - 1]!);

  if (first === 0 && last === 0) {
    return { direction: "flat" as const, label: "4w flat" };
  }

  if (first === 0) {
    return { direction: "up" as const, label: "4w new" };
  }

  const change = ((last - first) / Math.abs(first)) * 100;
  const direction: GrowthOsMetricTrend["direction"] =
    Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const sign = change > 0 ? "+" : "";
  return {
    direction,
    label: `4w ${sign}${change.toFixed(1)}%`,
  };
}

export function computeWeeklyStreak(weekStartDates: string[]) {
  const uniqueDates = Array.from(new Set(weekStartDates)).sort();
  if (uniqueDates.length === 0) {
    return { current: 0, longest: 0, latest: null as string | null };
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < uniqueDates.length; i += 1) {
    if (uniqueDates[i] === subtractWeeks(uniqueDates[i - 1]!, -1)) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const latest = uniqueDates[uniqueDates.length - 1]!;
  let current = 1;
  let cursor = latest;
  for (let i = uniqueDates.length - 2; i >= 0; i -= 1) {
    const expectedPrevious = subtractWeeks(cursor, 1);
    if (uniqueDates[i] !== expectedPrevious) break;
    current += 1;
    cursor = uniqueDates[i]!;
  }

  return { current, longest, latest };
}

function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}
