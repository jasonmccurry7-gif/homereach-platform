import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  trend?: "up" | "down" | "neutral";
  isMock?: boolean;  // shows a "coming soon" chip for data not yet wired
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  isMock = false,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm",
        className
      )}
    >
      {isMock && (
        <span className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
          Coming soon
        </span>
      )}

      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>

      <div className="flex items-end justify-between">
        <p
          className={cn(
            "font-bold leading-none text-gray-900",
            isMock ? "text-3xl text-gray-300" : "text-3xl"
          )}
        >
          {isMock ? "—" : value}
        </p>

        {trend && !isMock && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend === "up" && "bg-green-50 text-green-700",
              trend === "down" && "bg-red-50 text-red-700",
              trend === "neutral" && "bg-gray-100 text-gray-500"
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trend === "neutral" && "→"}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1.5 text-xs text-gray-400">{subtext}</p>
      )}
    </div>
  );
}
