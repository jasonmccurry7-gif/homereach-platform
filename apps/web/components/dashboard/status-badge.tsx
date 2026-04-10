import { cn } from "@/lib/utils";

type CampaignStatus = "upcoming" | "active" | "completed" | "paused" | "cancelled";

const config: Record<CampaignStatus, { label: string; dot: string; pill: string }> = {
  upcoming: {
    label: "Upcoming",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-800 border-amber-200",
  },
  active: {
    label: "Active",
    dot: "bg-green-500 animate-pulse",
    pill: "bg-green-50 text-green-800 border-green-200",
  },
  completed: {
    label: "Completed",
    dot: "bg-gray-400",
    pill: "bg-gray-100 text-gray-600 border-gray-200",
  },
  paused: {
    label: "Paused",
    dot: "bg-orange-400",
    pill: "bg-orange-50 text-orange-700 border-orange-200",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-400",
    pill: "bg-red-50 text-red-700 border-red-200",
  },
};

interface StatusBadgeProps {
  status: CampaignStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const c = config[status] ?? config.upcoming;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        c.pill
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
