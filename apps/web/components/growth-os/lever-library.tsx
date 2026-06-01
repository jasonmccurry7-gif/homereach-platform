import { Archive, TrendingUp } from "lucide-react";
import { WinLogActions } from "@/components/growth-os/win-log-actions";
import { formatCurrencyCents } from "@/lib/growth-os/metrics";

type LeverLibraryEntry = {
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
    problem: string;
    actionText: string;
  } | null;
  impactTracking: {
    estimatedMonthlyImpactCents: number;
    aovDrivenRevenueDeltaCents: number;
    volumeDrivenRevenueDeltaCents: number;
    costSavingsDeltaCents: number;
    confidence: string;
  } | null;
};

export function LeverLibrary({ entries }: { entries: LeverLibraryEntry[] }) {
  const totalImpact = entries.reduce(
    (sum, entry) =>
      sum +
      (entry.appliedRecommendation.finalImpactCents ??
        entry.impactTracking?.estimatedMonthlyImpactCents ??
        0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-950 text-white">
              <Archive className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
                Lever Library
              </p>
              <h1 className="text-2xl font-bold text-gray-950">
                Completed growth levers
              </h1>
            </div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 sm:text-right">
            <p className="text-sm font-medium text-gray-500">Library impact</p>
            <p className="text-2xl font-bold text-gray-950">
              {formatCurrencyCents(totalImpact)}
              <span className="text-sm font-semibold text-gray-500">/mo</span>
            </p>
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600">
            Completed levers will appear here once they move through impact
            tracking and the Win Log.
          </p>
        </section>
      ) : (
        <section className="grid gap-4">
          {entries.map((entry) => {
            const title =
              entry.recommendation?.title ??
              `${entry.appliedRecommendation.leverCategory} lever`;
            const impactCents =
              entry.appliedRecommendation.finalImpactCents ??
              entry.impactTracking?.estimatedMonthlyImpactCents ??
              0;

            return (
              <article
                key={entry.appliedRecommendation.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700">
                        {entry.appliedRecommendation.leverCategory}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">
                        {entry.appliedRecommendation.confidence} confidence
                      </span>
                      {entry.appliedRecommendation.fastWin ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Fast win
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-gray-950">
                      {title}
                    </h2>
                    {entry.recommendation?.problem ? (
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {entry.recommendation.problem}
                      </p>
                    ) : null}
                    {entry.recommendation?.actionText ? (
                      <p className="mt-3 text-sm leading-6 text-gray-700">
                        <span className="font-semibold text-gray-950">
                          Action:{" "}
                        </span>
                        {entry.recommendation.actionText}
                      </p>
                    ) : null}
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

                {entry.impactTracking ? (
                  <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
                    <ImpactPart
                      label="AOV"
                      value={entry.impactTracking.aovDrivenRevenueDeltaCents}
                    />
                    <ImpactPart
                      label="Volume"
                      value={entry.impactTracking.volumeDrivenRevenueDeltaCents}
                    />
                    <ImpactPart
                      label="Cost savings"
                      value={entry.impactTracking.costSavingsDeltaCents}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ImpactPart({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <TrendingUp className="h-4 w-4 text-blue-600" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="font-bold text-gray-950">{formatCurrencyCents(value)}</p>
      </div>
    </div>
  );
}
