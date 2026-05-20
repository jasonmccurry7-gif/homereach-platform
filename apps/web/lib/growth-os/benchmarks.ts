import {
  db,
  fsgosBenchmarks,
  fsgosBusinessProfiles,
  fsgosWeeklyInputs,
} from "@homereach/db";
import { and, eq, sql } from "drizzle-orm";
import { calculateAovCents } from "./metrics";

export type GrowthOsBenchmarkMetricType =
  | "aov_cents"
  | "food_cost_percent"
  | "labor_percent"
  | "waste_percent";

export type GrowthOsBenchmark = {
  metricType: GrowthOsBenchmarkMetricType;
  p25: number;
  p50: number;
  p75: number;
  sampleSize: number;
  source: "aggregated_user_data" | "public_industry_fallback";
};

const MIN_AGGREGATED_SAMPLE_SIZE = 10;
const DEFAULT_REGION = "national";

const PUBLIC_FALLBACKS: Record<
  string,
  Record<GrowthOsBenchmarkMetricType, Omit<GrowthOsBenchmark, "metricType">>
> = {
  bakery: {
    aov_cents: fallback(1050, 1400, 1850),
    food_cost_percent: fallback(28, 32, 36),
    labor_percent: fallback(24, 30, 36),
    waste_percent: fallback(3, 5, 8),
  },
  coffee: {
    aov_cents: fallback(650, 850, 1150),
    food_cost_percent: fallback(24, 29, 34),
    labor_percent: fallback(25, 31, 38),
    waste_percent: fallback(2, 4, 7),
  },
  juice: {
    aov_cents: fallback(850, 1100, 1450),
    food_cost_percent: fallback(30, 35, 41),
    labor_percent: fallback(22, 29, 36),
    waste_percent: fallback(4, 7, 11),
  },
  "ice cream": {
    aov_cents: fallback(725, 950, 1300),
    food_cost_percent: fallback(24, 30, 36),
    labor_percent: fallback(23, 30, 37),
    waste_percent: fallback(2, 4, 7),
  },
  "food truck": {
    aov_cents: fallback(1100, 1500, 2100),
    food_cost_percent: fallback(28, 34, 40),
    labor_percent: fallback(18, 25, 33),
    waste_percent: fallback(2, 5, 9),
  },
  qsr: {
    aov_cents: fallback(950, 1300, 1750),
    food_cost_percent: fallback(28, 33, 38),
    labor_percent: fallback(24, 30, 36),
    waste_percent: fallback(2, 4, 7),
  },
  default: {
    aov_cents: fallback(900, 1200, 1600),
    food_cost_percent: fallback(28, 32, 38),
    labor_percent: fallback(24, 30, 37),
    waste_percent: fallback(3, 5, 8),
  },
};

export async function getGrowthOsBenchmarksForProfile({
  businessType,
  weeklyRevenueCents,
  locationZip,
}: {
  businessType: string;
  weeklyRevenueCents: number;
  locationZip: string;
}) {
  const normalizedBusinessType = normalizeBusinessType(businessType);
  const revenueTier = getRevenueTier(weeklyRevenueCents);
  const region = getRegionFromZip(locationZip);
  const stored = await db
    .select()
    .from(fsgosBenchmarks)
    .where(
      and(
        eq(fsgosBenchmarks.businessType, normalizedBusinessType),
        eq(fsgosBenchmarks.revenueTier, revenueTier),
        eq(fsgosBenchmarks.region, region)
      )
    );

  const byMetric = new Map<GrowthOsBenchmarkMetricType, GrowthOsBenchmark>();
  for (const row of stored) {
    const metricType = row.metricType as GrowthOsBenchmarkMetricType;
    if (row.sampleSize >= MIN_AGGREGATED_SAMPLE_SIZE) {
      byMetric.set(metricType, {
        metricType,
        p25: Number(row.p25),
        p50: Number(row.p50),
        p75: Number(row.p75),
        sampleSize: row.sampleSize,
        source: "aggregated_user_data",
      });
    }
  }

  for (const metricType of getBenchmarkMetricTypes()) {
    if (!byMetric.has(metricType)) {
      byMetric.set(
        metricType,
        getPublicFallbackBenchmark(normalizedBusinessType, metricType)
      );
    }
  }

  return {
    businessType: normalizedBusinessType,
    revenueTier,
    region,
    metrics: Object.fromEntries(byMetric) as Record<
      GrowthOsBenchmarkMetricType,
      GrowthOsBenchmark
    >,
  };
}

export async function recomputeGrowthOsBenchmarks(systemUserId: string) {
  const rows = await db
    .select({
      userId: fsgosBusinessProfiles.userId,
      businessType: fsgosBusinessProfiles.businessType,
      weeklyRevenueCents: fsgosWeeklyInputs.weeklyRevenueCents,
      weeklyOrders: fsgosWeeklyInputs.weeklyOrders,
      weeklyLaborCostCents: fsgosWeeklyInputs.weeklyLaborCostCents,
      weeklyIngredientCostCents: fsgosWeeklyInputs.weeklyIngredientCostCents,
      weeklyWasteEstimateCents: fsgosWeeklyInputs.weeklyWasteEstimateCents,
      avgOrderValueCents: fsgosWeeklyInputs.avgOrderValueCents,
      locationZip: fsgosBusinessProfiles.locationZip,
    })
    .from(fsgosWeeklyInputs)
    .innerJoin(
      fsgosBusinessProfiles,
      eq(fsgosWeeklyInputs.userId, fsgosBusinessProfiles.userId)
    );

  const cohorts = new Map<string, number[]>();
  for (const row of rows) {
    const businessType = normalizeBusinessType(row.businessType);
    const revenueTier = getRevenueTier(row.weeklyRevenueCents);
    const region = getRegionFromZip(row.locationZip);
    const metrics: Record<GrowthOsBenchmarkMetricType, number> = {
      aov_cents:
        row.avgOrderValueCents ||
        calculateAovCents(row.weeklyRevenueCents, row.weeklyOrders),
      food_cost_percent: percentOf(
        row.weeklyIngredientCostCents,
        row.weeklyRevenueCents
      ),
      labor_percent: percentOf(
        row.weeklyLaborCostCents,
        row.weeklyRevenueCents
      ),
      waste_percent: percentOf(
        row.weeklyWasteEstimateCents,
        row.weeklyRevenueCents
      ),
    };

    for (const metricType of getBenchmarkMetricTypes()) {
      const key = getBenchmarkKey({
        businessType,
        revenueTier,
        region,
        metricType,
      });
      const values = cohorts.get(key) ?? [];
      values.push(metrics[metricType]);
      cohorts.set(key, values);
    }
  }

  const upserts = Array.from(cohorts.entries())
    .filter(([, values]) => values.length >= MIN_AGGREGATED_SAMPLE_SIZE)
    .map(([key, values]) => {
      const [businessType, revenueTier, region, metricType] = key.split("|") as [
        string,
        string,
        string,
        GrowthOsBenchmarkMetricType,
      ];
      return {
        userId: systemUserId,
        businessType,
        revenueTier,
        region,
        metricType,
        p25: percentile(values, 0.25).toFixed(2),
        p50: percentile(values, 0.5).toFixed(2),
        p75: percentile(values, 0.75).toFixed(2),
        sampleSize: values.length,
        source: "aggregated_user_data",
        updatedAt: new Date(),
      };
    });

  if (upserts.length === 0) {
    return { recomputed: 0, skippedSmallCohorts: cohorts.size };
  }

  await db
    .insert(fsgosBenchmarks)
    .values(upserts)
    .onConflictDoUpdate({
      target: [
        fsgosBenchmarks.businessType,
        fsgosBenchmarks.revenueTier,
        fsgosBenchmarks.region,
        fsgosBenchmarks.metricType,
      ],
      set: {
        userId: sql`excluded.user_id`,
        p25: sql`excluded.p25`,
        p50: sql`excluded.p50`,
        p75: sql`excluded.p75`,
        sampleSize: sql`excluded.sample_size`,
        source: sql`excluded.source`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  return {
    recomputed: upserts.length,
    skippedSmallCohorts: Array.from(cohorts.values()).filter(
      (values) => values.length < MIN_AGGREGATED_SAMPLE_SIZE
    ).length,
  };
}

export function getPublicFallbackBenchmark(
  businessType: string,
  metricType: GrowthOsBenchmarkMetricType
): GrowthOsBenchmark {
  const normalized = normalizeBusinessType(businessType);
  const fallbackSet = PUBLIC_FALLBACKS[normalized] ?? PUBLIC_FALLBACKS.default!;
  const values = fallbackSet[metricType];
  return {
    metricType,
    ...values,
  };
}

export function normalizeBusinessType(businessType: string) {
  const normalized = businessType.toLowerCase();
  if (normalized.includes("cupcake") || normalized.includes("bakery")) {
    return "bakery";
  }
  if (normalized.includes("coffee")) return "coffee";
  if (normalized.includes("juice")) return "juice";
  if (normalized.includes("ice cream")) return "ice cream";
  if (normalized.includes("food truck")) return "food truck";
  if (normalized.includes("ghost")) return "ghost kitchen";
  if (normalized.includes("qsr")) return "qsr";
  return "default";
}

export function getRevenueTier(weeklyRevenueCents: number) {
  if (weeklyRevenueCents < 500_000) return "under_5k";
  if (weeklyRevenueCents < 1_500_000) return "5k_15k";
  if (weeklyRevenueCents < 3_000_000) return "15k_30k";
  return "30k_plus";
}

function getRegionFromZip(locationZip: string) {
  const prefix = locationZip.trim().slice(0, 1);
  if (!prefix) return DEFAULT_REGION;
  return `zip_${prefix}`;
}

function getBenchmarkMetricTypes(): GrowthOsBenchmarkMetricType[] {
  return [
    "aov_cents",
    "food_cost_percent",
    "labor_percent",
    "waste_percent",
  ];
}

function getBenchmarkKey({
  businessType,
  revenueTier,
  region,
  metricType,
}: {
  businessType: string;
  revenueTier: string;
  region: string;
  metricType: GrowthOsBenchmarkMetricType;
}) {
  return [businessType, revenueTier, region, metricType].join("|");
}

function fallback(
  p25: number,
  p50: number,
  p75: number
): Omit<GrowthOsBenchmark, "metricType"> {
  return {
    p25,
    p50,
    p75,
    sampleSize: 0,
    source: "public_industry_fallback",
  };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}
