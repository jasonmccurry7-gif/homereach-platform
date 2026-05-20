import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList } from "lucide-react";
import { ActionGeneratorPanel } from "@/components/growth-os/action-generator-panel";
import { ActiveLeverCard } from "@/components/growth-os/active-lever-card";
import { AiChatPanel } from "@/components/growth-os/ai-chat-panel";
import { FirstWinBanner } from "@/components/growth-os/first-win-banner";
import { GrowthMetricCard } from "@/components/growth-os/growth-metric-card";
import { RecommendationCard } from "@/components/growth-os/recommendation-card";
import { RiskAlertsPanel } from "@/components/growth-os/risk-alerts-panel";
import { StreakCounter } from "@/components/growth-os/streak-counter";
import { WinLog } from "@/components/growth-os/win-log";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import {
  calculateAndStoreGrowthOsImpact,
  IMPACT_DISCLAIMER,
} from "@/lib/growth-os/impact";
import {
  calculateTrend,
  calculateWeeklyDashboardMetrics,
  formatCurrencyCents,
  formatPercent,
} from "@/lib/growth-os/metrics";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import { generateGrowthOsRecommendations } from "@/lib/growth-os/recommendations";
import { refreshGrowthOsRiskAlerts } from "@/lib/growth-os/risk-alerts";

export default async function GrowthOsDashboardPage() {
  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os/dashboard");

  const data = await getGrowthOsPhase1Data(user.id);
  if (!data.profile) redirect("/growth-os/onboarding");

  const latest = data.latestWeeklyInput;
  const metricInputs = data.weeklyInputs.map((input) => ({
    weekStartDate: input.weekStartDate,
    weeklyRevenueCents: input.weeklyRevenueCents,
    weeklyOrders: input.weeklyOrders,
    weeklyLaborCostCents: input.weeklyLaborCostCents,
    weeklyIngredientCostCents: input.weeklyIngredientCostCents,
    weeklyWasteEstimateCents: input.weeklyWasteEstimateCents,
    avgOrderValueCents: input.avgOrderValueCents,
  }));

  const metrics = latest
    ? calculateWeeklyDashboardMetrics(latest, data.profile)
    : null;
  const recommendations = await generateGrowthOsRecommendations({
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });
  const riskAlertResult = await refreshGrowthOsRiskAlerts({
    userId: user.id,
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });
  const activeAppliedRecommendation = data.activeAppliedRecommendation;
  const activeTriggerKey =
    activeAppliedRecommendation?.recommendation?.triggerKey ?? null;
  const hasActiveLever = Boolean(activeAppliedRecommendation);
  const activeImpact = activeAppliedRecommendation
    ? (
        await calculateAndStoreGrowthOsImpact({
          userId: user.id,
          appliedRecommendation:
            activeAppliedRecommendation.appliedRecommendation,
          weeklyInputs: data.weeklyInputs,
        })
      ).calculation
    : null;
  const completedImpactCents = data.winLog.reduce((sum, entry) => {
    return (
      sum +
      (entry.appliedRecommendation.finalImpactCents ??
        entry.impactTracking?.estimatedMonthlyImpactCents ??
        0)
    );
  }, 0);
  const lifetimeNetImpactCents =
    completedImpactCents + (activeImpact?.estimatedMonthlyImpactCents ?? 0);
  const showFirstWinBanner =
    !hasActiveLever &&
    isWithinDays(data.profile.createdAt, new Date(), 14) &&
    recommendations.some((recommendation) => recommendation.fastWin);
  const firstWinRecommendation = showFirstWinBanner
    ? recommendations.find((recommendation) => recommendation.fastWin)
    : null;

  const metricCards = metrics
    ? [
        {
          label: "Revenue",
          value: formatCurrencyCents(metrics.revenueCents),
          trend: calculateTrend(metricInputs, (input) => input.weeklyRevenueCents),
        },
        {
          label: "Profit",
          value: formatCurrencyCents(metrics.profitCents),
          trend: calculateTrend(metricInputs, (input) =>
            calculateWeeklyDashboardMetrics(input, data.profile!).profitCents
          ),
        },
        {
          label: "AOV",
          value: formatCurrencyCents(metrics.aovCents),
          trend: calculateTrend(metricInputs, (input) => input.avgOrderValueCents),
        },
        {
          label: "Food Cost %",
          value: formatPercent(metrics.foodCostPercent),
          trend: calculateTrend(
            metricInputs,
            (input) =>
              calculateWeeklyDashboardMetrics(input, data.profile!)
                .foodCostPercent
          ),
        },
        {
          label: "Labor %",
          value: formatPercent(metrics.laborPercent),
          trend: calculateTrend(
            metricInputs,
            (input) =>
              calculateWeeklyDashboardMetrics(input, data.profile!).laborPercent
          ),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">
            {data.profile.companyName}
          </h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <StreakCounter weeks={data.userState?.currentStreakWeeks ?? 0} />
          <Link
            href="/growth-os/weekly"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Weekly input
          </Link>
        </div>
      </div>

      {!latest ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-950">
            Add your first week
          </h2>
          <Link
            href="/growth-os/weekly"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Start weekly input
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {metricCards.map((metric) => (
              <GrowthMetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                trend={metric.trend}
              />
            ))}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryItem
                label="Business type"
                value={data.profile.businessType}
              />
              <SummaryItem
                label="Owner goal"
                value={data.profile.ownerGoal}
              />
              <SummaryItem
                label="Weeks submitted"
                value={String(data.weeklyInputs.length)}
              />
            </div>
          </section>
        </>
      )}

      {firstWinRecommendation ? (
        <FirstWinBanner recommendation={firstWinRecommendation} />
      ) : null}

      {activeAppliedRecommendation && activeImpact ? (
        <ActiveLeverCard
          applied={activeAppliedRecommendation.appliedRecommendation}
          recommendation={activeAppliedRecommendation.recommendation}
          impact={activeImpact}
          lifetimeNetImpactCents={lifetimeNetImpactCents}
          disclaimer={IMPACT_DISCLAIMER}
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Recommendations
            </p>
            <h2 className="text-xl font-bold text-gray-950">
              Best next levers
            </h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600">
            Estimated impact uses directional comparisons and context flags.
          </p>
        </div>
        <div className="space-y-4">
          {recommendations.map((recommendation, index) => (
            <RecommendationCard
              key={recommendation.triggerKey}
              recommendation={recommendation}
              index={index}
              hasActiveLever={hasActiveLever}
              isActive={recommendation.triggerKey === activeTriggerKey}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AiChatPanel />
        <ActionGeneratorPanel />
      </section>

      <RiskAlertsPanel result={riskAlertResult} />

      <WinLog entries={data.winLog} />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-950">{value}</p>
    </div>
  );
}

function isWithinDays(start: Date, end: Date, days: number) {
  return end.getTime() - start.getTime() < days * 24 * 60 * 60 * 1000;
}
