import { CheckCircle2, DollarSign, Gauge, Sparkles } from "lucide-react";
import { ApplyRecommendationButton } from "@/components/growth-os/apply-recommendation-button";
import { formatCurrencyCents } from "@/lib/growth-os/metrics";
import type { GrowthOsRecommendation } from "@/lib/growth-os/types";

const CONFIDENCE_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function RecommendationCard({
  recommendation,
  index,
  hasActiveLever = false,
  isActive = false,
}: {
  recommendation: GrowthOsRecommendation;
  index: number;
  hasActiveLever?: boolean;
  isActive?: boolean;
}) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 text-sm font-bold text-white">
                {index + 1}
              </span>
              {recommendation.fastWin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Fast win
                </span>
              ) : null}
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700">
                {recommendation.leverCategory}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-gray-950">
              {recommendation.title}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Impact
            </p>
            <p className="text-lg font-bold text-gray-950">
              {formatCurrencyCents(recommendation.estimatedMonthlyImpactCents)}
              <span className="text-xs font-semibold text-gray-500">/mo</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm leading-6 text-gray-700">
            <span className="font-semibold text-gray-950">Problem: </span>
            {recommendation.problem}
          </p>
          <p className="text-sm leading-6 text-gray-700">
            <span className="font-semibold text-gray-950">Action: </span>
            {recommendation.actionText}
          </p>
        </div>

        <div className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
          <div className="flex gap-2">
            <DollarSign className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
            <p className="text-sm text-gray-700">{recommendation.whyItMatters}</p>
          </div>
          <div className="flex gap-2">
            <Gauge className="mt-0.5 h-4 w-4 text-blue-600" aria-hidden="true" />
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-950">
                {CONFIDENCE_LABELS[recommendation.confidence]} confidence.{" "}
              </span>
              {recommendation.confidenceReasoning}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {isActive ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Active lever
            </span>
          ) : (
            <ApplyRecommendationButton
              triggerKey={recommendation.triggerKey}
              disabled={hasActiveLever}
            />
          )}
        </div>
      </div>
    </article>
  );
}
