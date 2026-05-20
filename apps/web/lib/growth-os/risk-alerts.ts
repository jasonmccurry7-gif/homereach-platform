import { db, fsgosRiskAlerts } from "@homereach/db";
import { and, eq, sql } from "drizzle-orm";
import type {
  GrowthOsContextFlags,
  GrowthOsRiskAlert,
  GrowthOsRiskAlertSeverity,
  GrowthOsRiskAlertSnapshot,
  GrowthOsRiskAlertType,
} from "./types";

const MIN_CLEAN_WEEKS = 6;

type RiskProfileInput = {
  overheadMonthlyCents: number;
};

type RiskWeeklyInput = {
  weekStartDate: string;
  weeklyRevenueCents: number;
  weeklyOrders: number;
  weeklyLaborCostCents: number;
  weeklyIngredientCostCents: number;
  weeklyWasteEstimateCents: number;
  avgOrderValueCents: number;
  contextFlags: Partial<GrowthOsContextFlags>;
};

type RiskMetricWeek = {
  weekStartDate: string;
  revenueCents: number;
  profitCents: number;
  laborPercent: number;
};

export async function refreshGrowthOsRiskAlerts({
  userId,
  profile,
  weeklyInputs,
  now = new Date(),
}: {
  userId: string;
  profile: RiskProfileInput;
  weeklyInputs: RiskWeeklyInput[];
  now?: Date;
}) {
  const result = calculateGrowthOsRiskAlerts({ profile, weeklyInputs });
  if (!result.ready) return result;

  for (const alert of result.alerts) {
    await upsertRiskAlert({ userId, alert, now });
  }

  const activeTypes = new Set(result.alerts.map((alert) => alert.alertType));
  for (const alertType of getAlertTypes()) {
    if (!activeTypes.has(alertType)) {
      await resolveRiskAlert({ userId, alertType, now });
    }
  }

  return result;
}

export function calculateGrowthOsRiskAlerts({
  profile,
  weeklyInputs,
}: {
  profile: RiskProfileInput;
  weeklyInputs: RiskWeeklyInput[];
}):
  | {
      ready: false;
      reason: string;
      cleanWeeks: number;
      requiredWeeks: number;
      alerts: GrowthOsRiskAlert[];
    }
  | {
      ready: true;
      cleanWeeks: number;
      requiredWeeks: number;
      alerts: GrowthOsRiskAlert[];
    } {
  const cleanWeeks = weeklyInputs
    .filter((input) => isCleanWeek(input.contextFlags))
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
    .slice(0, MIN_CLEAN_WEEKS);

  if (cleanWeeks.length < MIN_CLEAN_WEEKS) {
    return {
      ready: false,
      reason: "Risk alerts require at least 6 clean weekly inputs.",
      cleanWeeks: cleanWeeks.length,
      requiredWeeks: MIN_CLEAN_WEEKS,
      alerts: [],
    };
  }

  const metrics = cleanWeeks
    .map((input) => buildRiskMetricWeek(input, profile))
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  const recentThree = metrics.slice(-3);
  const priorThree = metrics.slice(0, 3);
  const alerts: GrowthOsRiskAlert[] = [];

  const revenueAlert = buildDirectionalAlert({
    alertType: "revenue_drop",
    title: "Revenue is dropping",
    description:
      "Weekly revenue is down versus the prior clean three-week baseline.",
    currentValue: average(recentThree.map((week) => week.revenueCents)),
    priorAverage: average(priorThree.map((week) => week.revenueCents)),
    thresholdPercent: -10,
    weekStartDates: metrics.map((week) => week.weekStartDate),
    lowerIsRisk: true,
  });
  if (revenueAlert) alerts.push(revenueAlert);

  const profitAlert = buildDirectionalAlert({
    alertType: "profit_decline",
    title: "Profit is declining",
    description:
      "Estimated weekly profit is down versus the prior clean three-week baseline.",
    currentValue: average(recentThree.map((week) => week.profitCents)),
    priorAverage: average(priorThree.map((week) => week.profitCents)),
    thresholdPercent: -12,
    weekStartDates: metrics.map((week) => week.weekStartDate),
    lowerIsRisk: true,
  });
  if (profitAlert) alerts.push(profitAlert);

  const laborAlert = buildDirectionalAlert({
    alertType: "labor_spike",
    title: "Labor percentage is spiking",
    description:
      "Labor cost percentage is up versus the prior clean three-week baseline.",
    currentValue: average(recentThree.map((week) => week.laborPercent)),
    priorAverage: average(priorThree.map((week) => week.laborPercent)),
    thresholdPercent: 12,
    weekStartDates: metrics.map((week) => week.weekStartDate),
    lowerIsRisk: false,
  });
  if (laborAlert) alerts.push(laborAlert);

  return {
    ready: true,
    cleanWeeks: cleanWeeks.length,
    requiredWeeks: MIN_CLEAN_WEEKS,
    alerts,
  };
}

async function upsertRiskAlert({
  userId,
  alert,
  now,
}: {
  userId: string;
  alert: GrowthOsRiskAlert;
  now: Date;
}) {
  await db
    .insert(fsgosRiskAlerts)
    .values({
      userId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      metricSnapshot: alert.metricSnapshot,
      status: "active",
      detectedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [fsgosRiskAlerts.userId, fsgosRiskAlerts.alertType],
      targetWhere: sql`${fsgosRiskAlerts.status} = 'active'`,
      set: {
        severity: sql`excluded.severity`,
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        metricSnapshot: sql`excluded.metric_snapshot`,
        updatedAt: now,
      },
    });
}

async function resolveRiskAlert({
  userId,
  alertType,
  now,
}: {
  userId: string;
  alertType: GrowthOsRiskAlertType;
  now: Date;
}) {
  await db
    .update(fsgosRiskAlerts)
    .set({
      status: "resolved",
      resolvedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(fsgosRiskAlerts.userId, userId),
        eq(fsgosRiskAlerts.alertType, alertType),
        eq(fsgosRiskAlerts.status, "active")
      )
    );
}

function buildRiskMetricWeek(
  input: RiskWeeklyInput,
  profile: RiskProfileInput
): RiskMetricWeek {
  const weeklyOverheadCents = Math.round(profile.overheadMonthlyCents / 4.33);
  const profitCents =
    input.weeklyRevenueCents -
    input.weeklyLaborCostCents -
    input.weeklyIngredientCostCents -
    input.weeklyWasteEstimateCents -
    weeklyOverheadCents;

  return {
    weekStartDate: input.weekStartDate,
    revenueCents: input.weeklyRevenueCents,
    profitCents,
    laborPercent: percentOf(input.weeklyLaborCostCents, input.weeklyRevenueCents),
  };
}

function buildDirectionalAlert({
  alertType,
  title,
  description,
  currentValue,
  priorAverage,
  thresholdPercent,
  weekStartDates,
  lowerIsRisk,
}: {
  alertType: GrowthOsRiskAlertType;
  title: string;
  description: string;
  currentValue: number;
  priorAverage: number;
  thresholdPercent: number;
  weekStartDates: string[];
  lowerIsRisk: boolean;
}) {
  if (priorAverage === 0) return null;
  const changePercent = ((currentValue - priorAverage) / Math.abs(priorAverage)) * 100;
  const isRisk = lowerIsRisk
    ? changePercent <= thresholdPercent
    : changePercent >= thresholdPercent;
  if (!isRisk) return null;

  const severity = getSeverity(Math.abs(changePercent));
  const snapshot: GrowthOsRiskAlertSnapshot = {
    weeksAnalyzed: MIN_CLEAN_WEEKS,
    cleanWeeks: MIN_CLEAN_WEEKS,
    currentValue: Math.round(currentValue),
    priorAverage: Math.round(priorAverage),
    changePercent: Math.round(changePercent * 10) / 10,
    weekStartDates,
  };

  return {
    alertType,
    severity,
    title,
    description: `${description} Change: ${snapshot.changePercent.toFixed(1)}%.`,
    metricSnapshot: snapshot,
  };
}

function isCleanWeek(flags: Partial<GrowthOsContextFlags>) {
  return !flags.badWeather && !flags.equipmentIssue && !flags.staffingIssue;
}

function getAlertTypes(): GrowthOsRiskAlertType[] {
  return ["profit_decline", "labor_spike", "revenue_drop"];
}

function getSeverity(absChangePercent: number): GrowthOsRiskAlertSeverity {
  if (absChangePercent >= 25) return "high";
  if (absChangePercent >= 15) return "medium";
  return "low";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}
