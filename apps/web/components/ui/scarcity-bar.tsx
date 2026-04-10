import { cn } from "@/lib/utils";

interface ScarcityBarProps {
  total: number;
  remaining: number;
  className?: string;
}

export function ScarcityBar({ total, remaining, className }: ScarcityBarProps) {
  const taken = total - remaining;
  const pct = total > 0 ? (taken / total) * 100 : 0;

  const urgency =
    remaining === 0
      ? "sold-out"
      : remaining === 1
      ? "critical"
      : pct >= 66
      ? "high"
      : "normal";

  const barColor = {
    "sold-out": "bg-gray-400",
    critical: "bg-red-500",
    high: "bg-amber-500",
    normal: "bg-blue-500",
  }[urgency];

  if (remaining === 0) {
    return (
      <div className={cn("text-xs font-semibold text-gray-500 uppercase tracking-wide", className)}>
        Sold Out
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-semibold",
            urgency === "critical" && "text-red-600",
            urgency === "high" && "text-amber-600",
            urgency === "normal" && "text-gray-600"
          )}
        >
          {urgency === "critical"
            ? "⚠️ Only 1 spot left!"
            : urgency === "high"
            ? `${remaining} of ${total} spots remaining`
            : `${remaining} spots available`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={cn("h-1.5 rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
