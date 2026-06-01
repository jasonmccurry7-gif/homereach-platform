import { Zap } from "lucide-react";
import { formatCurrencyCents } from "@/lib/growth-os/metrics";
import type { GrowthOsRecommendation } from "@/lib/growth-os/types";

export function FirstWinBanner({
  recommendation,
}: {
  recommendation: GrowthOsRecommendation;
}) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
              Fastest way to make money this week
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-950">
              {recommendation.title}
            </h2>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-emerald-700">Estimated impact</p>
          <p className="text-xl font-bold text-gray-950">
            {formatCurrencyCents(recommendation.estimatedMonthlyImpactCents)}
            <span className="text-sm font-semibold text-gray-600">/mo</span>
          </p>
        </div>
      </div>
    </section>
  );
}
