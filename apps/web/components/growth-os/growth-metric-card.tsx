import { cn } from "@/lib/utils";
import type { GrowthOsMetricTrend } from "@/lib/growth-os/types";

export function GrowthMetricCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: GrowthOsMetricTrend | null;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {trend && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              trend.direction === "up" && "bg-green-50 text-green-700",
              trend.direction === "down" && "bg-red-50 text-red-700",
              trend.direction === "flat" && "bg-gray-100 text-gray-600"
            )}
          >
            {trend.label}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-gray-950">
        {value}
      </p>
    </div>
  );
}
