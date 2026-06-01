import { Trophy } from "lucide-react";
import { WinLogActions } from "@/components/growth-os/win-log-actions";
import { formatCurrencyCents } from "@/lib/growth-os/metrics";

type WinLogEntry = {
  appliedRecommendation: {
    id: string;
    completionDate: Date | null;
    finalImpactCents: number | null;
    fastWin: boolean;
    leverCategory: string;
    confidence: string;
  };
  recommendation: {
    title: string;
    actionText: string;
  } | null;
  impactTracking: {
    estimatedMonthlyImpactCents: number;
    confidence: string;
  } | null;
};

export function WinLog({ entries }: { entries: WinLogEntry[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Win Log
          </p>
          <h2 className="text-xl font-bold text-gray-950">
            Completed levers
          </h2>
        </div>
        <p className="text-sm text-gray-600">
          {entries.length} completed
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-600">
            Completed levers will appear here with their dollar impact.
          </p>
        </div>
      ) : (
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const impactCents =
              entry.appliedRecommendation.finalImpactCents ??
              entry.impactTracking?.estimatedMonthlyImpactCents ??
              0;
            const title =
              entry.recommendation?.title ??
              `${entry.appliedRecommendation.leverCategory} lever`;
            const firstWin =
              entry.appliedRecommendation.fastWin && impactCents > 0;

            return (
              <article
                key={entry.appliedRecommendation.id}
                id={`win-${entry.appliedRecommendation.id}`}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {firstWin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                          First Win Achieved
                        </span>
                      ) : null}
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700">
                        {entry.appliedRecommendation.leverCategory}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">
                        {entry.appliedRecommendation.confidence} confidence
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-gray-950">
                      {title}
                    </h3>
                    {entry.recommendation?.actionText ? (
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {entry.recommendation.actionText}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-medium text-gray-500">
                      Completed{" "}
                      {entry.appliedRecommendation.completionDate
                        ? entry.appliedRecommendation.completionDate.toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )
                        : "recently"}
                    </p>
                  </div>
                  <div className="shrink-0 space-y-3 lg:text-right">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Impact
                      </p>
                      <p className="text-2xl font-bold text-gray-950">
                        {formatCurrencyCents(impactCents)}
                        <span className="text-sm font-semibold text-gray-500">
                          /mo
                        </span>
                      </p>
                    </div>
                    <WinLogActions
                      winId={entry.appliedRecommendation.id}
                      title={title}
                      impactCents={impactCents}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
