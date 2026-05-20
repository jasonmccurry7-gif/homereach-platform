import { Target } from "lucide-react";
import { CompleteLeverButton } from "@/components/growth-os/complete-lever-button";
import {
  formatCurrencyCents,
  formatPercent,
} from "@/lib/growth-os/metrics";
import type {
  GrowthOsBaselineMetrics,
  GrowthOsImpactCalculation,
} from "@/lib/growth-os/types";

type ActiveLeverApplied = {
  dateApplied: Date;
  leverCategory: string;
  confidence: string;
  baselineMetrics: GrowthOsBaselineMetrics;
};

type ActiveLeverRecommendation = {
  title: string;
  actionText: string;
} | null;

export function ActiveLeverCard({
  applied,
  recommendation,
  impact,
  lifetimeNetImpactCents,
  disclaimer,
}: {
  applied: ActiveLeverApplied;
  recommendation: ActiveLeverRecommendation;
  impact: GrowthOsImpactCalculation;
  lifetimeNetImpactCents: number;
  disclaimer: string;
}) {
  const baseline = applied.baselineMetrics;

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Target className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Impact & Growth
            </p>
            <h2 className="mt-1 text-xl font-bold text-gray-950">
              {recommendation?.title ?? applied.leverCategory}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
              {recommendation?.actionText ?? "Baseline captured for tracking."}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-left lg:text-right">
          <p className="text-sm font-medium text-blue-700">
            Week {impact.weekProgress.current} of {impact.weekProgress.total}
          </p>
          <p className="font-bold capitalize text-gray-950">
            {impact.confidence} confidence
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ImpactItem
          label="Estimated impact this period"
          value={`${formatCurrencyCents(
            impact.estimatedMonthlyImpactCents
          )}/mo`}
        />
        <ImpactItem
          label="Lifetime net impact"
          value={formatCurrencyCents(lifetimeNetImpactCents)}
        />
        <ImpactItem
          label="Applied"
          value={applied.dateApplied.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        />
      </div>

      <div className="mt-5 rounded-lg border border-blue-100 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Impact breakdown
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <BreakdownItem
                label="AOV change"
                value={formatCurrencyCents(
                  impact.aovDrivenRevenueDeltaCents
                )}
              />
              <BreakdownItem
                label="Volume change"
                value={formatCurrencyCents(
                  impact.volumeDrivenRevenueDeltaCents
                )}
              />
              <BreakdownItem
                label="Cost savings"
                value={formatCurrencyCents(impact.costSavingsDeltaCents)}
              />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {impact.confidenceReasoning}
            </p>
            <p className="mt-2 text-xs font-medium text-gray-500">
              {disclaimer}
            </p>
          </div>
          <CompleteLeverButton />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <BaselineItem
          label="Revenue"
          value={formatCurrencyCents(baseline.revenueCents)}
        />
        <BaselineItem
          label="AOV"
          value={formatCurrencyCents(baseline.aovCents)}
        />
        <BaselineItem
          label="Food cost"
          value={formatPercent(baseline.foodCostPercent)}
        />
        <BaselineItem
          label="Labor"
          value={formatPercent(baseline.laborPercent)}
        />
        <BaselineItem
          label="Waste"
          value={formatPercent(baseline.wastePercent)}
        />
      </div>
      <p className="mt-3 text-sm font-medium text-blue-700">
        Baseline:{" "}
        {baseline.weeksIncluded > 0
          ? `${baseline.weeksIncluded} week${
              baseline.weeksIncluded === 1 ? "" : "s"
            }`
          : "profile fallback"}
      </p>
    </section>
  );
}

function ImpactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-gray-950">{value}</p>
    </div>
  );
}

function BaselineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-gray-950">{value}</p>
    </div>
  );
}
