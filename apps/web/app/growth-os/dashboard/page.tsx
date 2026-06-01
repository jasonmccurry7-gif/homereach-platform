import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
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
  const primaryRecommendation = recommendations[0] ?? null;
  const activeRiskAlert =
    riskAlertResult.ready && riskAlertResult.alerts.length > 0
      ? riskAlertResult.alerts[0]
      : null;
  const ownerAction = !latest
    ? {
        label: "Do now",
        title: "Add the first weekly snapshot",
        body: "Enter one week of sales, labor, ingredient, and waste numbers so Growth OS can stop guessing and start protecting margin.",
        href: "/growth-os/weekly",
        button: "Add first week",
      }
    : activeAppliedRecommendation
      ? {
          label: "Stay focused",
          title:
            activeAppliedRecommendation.recommendation?.title ??
            "Keep the active lever running",
          body:
            activeAppliedRecommendation.recommendation?.actionText ??
            "Keep this one lever active and submit weekly numbers before starting anything else.",
          href: "/growth-os/weekly",
          button: "Update this week",
        }
      : primaryRecommendation
        ? {
            label: "Needs approval",
            title: primaryRecommendation.title,
            body: primaryRecommendation.actionText,
            href: "#recommendations",
            button: "Review lever",
          }
        : {
            label: "Do now",
            title: "Keep the weekly rhythm",
            body: "No new lever is ready yet. Add this week's numbers so the next recommendation stays tied to real operating data.",
            href: "/growth-os/weekly",
            button: "Update this week",
          };
  const dataFreshnessLabel = latest
    ? `Last weekly input: ${formatWeekDate(latest.weekStartDate)}`
    : "Waiting on first weekly input";

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
        <OwnerCommandPanel
          ownerAction={ownerAction}
          handledText="Once the first week is saved, Growth OS will turn it into one clear savings or growth lever."
          protectedValue="Not calculated yet"
          protectedText="Margin protection starts after your first weekly snapshot."
          approvalText="Growth OS will recommend actions. You approve every price, offer, staffing, or customer-facing change before it is used."
          dataFreshnessLabel={dataFreshnessLabel}
          riskText="Risk alerts are waiting for enough clean weekly inputs."
        />
      ) : (
        <>
          <OwnerCommandPanel
            ownerAction={ownerAction}
            handledText={
              activeAppliedRecommendation
                ? "Growth OS is tracking the active lever, comparing new weekly inputs to the saved baseline, and keeping you from changing too many things at once."
                : primaryRecommendation
                  ? "Growth OS reviewed your latest numbers and selected one highest-value lever for owner approval."
                  : "Growth OS is monitoring weekly rhythm, profit movement, and context flags while it waits for the next useful lever."
            }
            protectedValue={formatCurrencyCents(lifetimeNetImpactCents)}
            protectedText={
              lifetimeNetImpactCents > 0
                ? "Estimated monthly net impact from active and completed levers. Directional, not guaranteed."
                : "No captured impact yet. The next approved lever will create the first tracking baseline."
            }
            approvalText="Nothing is sent, published, repriced, staffed, or promised automatically. Growth OS drafts and recommends; the owner approves."
            dataFreshnessLabel={dataFreshnessLabel}
            riskText={
              activeRiskAlert
                ? `${activeRiskAlert.title}: ${activeRiskAlert.description}`
                : riskAlertResult.ready
                  ? "No active profit, revenue, or labor risk detected in the clean comparison window."
                  : `${riskAlertResult.cleanWeeks}/${riskAlertResult.requiredWeeks} clean weeks collected for risk alerts.`
            }
          />

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

      <section id="recommendations" className="scroll-mt-6 space-y-4">
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

function OwnerCommandPanel({
  ownerAction,
  handledText,
  protectedValue,
  protectedText,
  approvalText,
  dataFreshnessLabel,
  riskText,
}: {
  ownerAction: {
    label: string;
    title: string;
    body: string;
    href: string;
    button: string;
  };
  handledText: string;
  protectedValue: string;
  protectedText: string;
  approvalText: string;
  dataFreshnessLabel: string;
  riskText: string;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Owner command
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">
            What needs attention now
          </h2>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
          {dataFreshnessLabel}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <CommandCard
          icon={<Target className="h-5 w-5" aria-hidden="true" />}
          label={ownerAction.label}
          title={ownerAction.title}
          body={ownerAction.body}
          actionHref={ownerAction.href}
          actionLabel={ownerAction.button}
          accent="blue"
        />
        <CommandCard
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          label="Handled for you"
          title="One lever at a time"
          body={handledText}
          accent="gray"
        />
        <CommandCard
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          label="Money protected"
          title={protectedValue}
          body={protectedText}
          accent="emerald"
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-gray-950">
                Owner approval stays in control
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                {approvalText}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-gray-700"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-gray-950">
                Current risk posture
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-700">{riskText}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommandCard({
  icon,
  label,
  title,
  body,
  actionHref,
  actionLabel,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  accent: "blue" | "emerald" | "gray";
}) {
  const accentClasses = {
    blue: "bg-blue-600 text-white",
    emerald: "bg-emerald-600 text-white",
    gray: "bg-gray-950 text-white",
  };

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentClasses[accent]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {label}
          </p>
          <h3 className="mt-1 text-lg font-bold text-gray-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-700">{body}</p>
          {actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function formatWeekDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isWithinDays(start: Date, end: Date, days: number) {
  return end.getTime() - start.getTime() < days * 24 * 60 * 60 * 1000;
}
