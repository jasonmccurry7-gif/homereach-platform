import { FlaskConical } from "lucide-react";
import { EvaluateAbTestButton } from "@/components/growth-os/evaluate-ab-test-button";
import { formatCurrencyCents } from "@/lib/growth-os/metrics";

type AbTest = {
  id: string;
  testType: string;
  hypothesis: string;
  variantAName: string;
  variantBName: string;
  primaryMetric: string;
  startDate: string;
  endDate: string | null;
  status: string;
  winningVariant: string | null;
  confidence: string | null;
  resultSummary: {
    weeksAnalyzed: number;
    variantAValue: number;
    variantBValue: number;
    liftPercent: number;
    notes: string;
  };
};

export function AbTestList({ tests }: { tests: AbTest[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-950 text-white">
            <FlaskConical className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              Tests
            </p>
            <h2 className="text-xl font-bold text-gray-950">A/B history</h2>
          </div>
        </div>
        {tests.some((test) => test.status === "active") ? (
          <EvaluateAbTestButton />
        ) : null}
      </div>

      {tests.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 p-4 text-sm font-medium text-gray-600">
          No A/B tests yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {tests.map((test) => (
            <article key={test.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700">
                      {test.testType}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">
                      {test.status}
                    </span>
                    {test.confidence ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold capitalize text-emerald-700">
                        {test.confidence} confidence
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-bold text-gray-950">{test.hypothesis}</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    A: {test.variantAName} vs B: {test.variantBName}
                  </p>
                </div>
                <div className="shrink-0 lg:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Winner
                  </p>
                  <p className="text-lg font-bold text-gray-950">
                    {test.winningVariant ?? "Pending"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
                <Metric label="Variant A" value={formatMetric(test.primaryMetric, test.resultSummary.variantAValue)} />
                <Metric label="Variant B" value={formatMetric(test.primaryMetric, test.resultSummary.variantBValue)} />
                <Metric label="Lift" value={`${test.resultSummary.liftPercent.toFixed(1)}%`} />
              </div>
              <p className="mt-3 text-sm text-gray-600">{test.resultSummary.notes}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 font-bold text-gray-950">{value}</p>
    </div>
  );
}

function formatMetric(primaryMetric: string, value: number) {
  if (primaryMetric === "orders") return String(value);
  return formatCurrencyCents(value);
}
