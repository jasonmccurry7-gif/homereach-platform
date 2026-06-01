import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { GrowthOsRiskAlert } from "@/lib/growth-os/types";

type RiskAlertResult =
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
    };

export function RiskAlertsPanel({ result }: { result: RiskAlertResult }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Risk Alerts
          </p>
          <h2 className="text-xl font-bold text-gray-950">
            Profit protection
          </h2>
        </div>
        <p className="text-sm text-gray-600">
          {result.cleanWeeks} / {result.requiredWeeks} clean weeks
        </p>
      </div>

      {!result.ready ? (
        <div className="mt-4 flex gap-3 rounded-lg border border-dashed border-gray-200 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-gray-500" aria-hidden="true" />
          <p className="text-sm leading-6 text-gray-600">{result.reason}</p>
        </div>
      ) : result.alerts.length === 0 ? (
        <div className="mt-4 flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="text-sm font-medium leading-6 text-emerald-800">
            No active revenue, labor, or profit risk detected across the latest
            clean six-week window.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {result.alerts.map((alert) => (
            <article
              key={alert.alertType}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 text-amber-600"
                  aria-hidden="true"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-950">{alert.title}</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold capitalize text-amber-700">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    {alert.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
