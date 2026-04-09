import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";

interface CampaignDetailCardProps {
  businessName: string;
  cityName: string;
  stateName: string;
  categoryName: string;
  categoryIcon: string | null;
  bundleName: string;
  status: "upcoming" | "active" | "completed" | "paused" | "cancelled";
  startDate: Date | null;
  renewalDate: Date | null;
  nextDropDate: Date | null;
  homesPerDrop: number;
  dropsCompleted: number;
  totalDrops: number;
}

export function CampaignDetailCard({
  businessName,
  cityName,
  stateName,
  categoryName,
  categoryIcon,
  bundleName,
  status,
  startDate,
  renewalDate,
  nextDropDate,
  homesPerDrop,
  dropsCompleted,
  totalDrops,
}: CampaignDetailCardProps) {
  const fmt = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const daysUntilRenewal = renewalDate
    ? Math.max(0, Math.ceil((new Date(renewalDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Active Campaign
          </p>
          <h2 className="mt-0.5 font-bold text-gray-900">{businessName}</h2>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Detail grid */}
      <div className="grid divide-y divide-gray-50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Left column */}
        <div className="space-y-0 divide-y divide-gray-50">
          <DetailRow label="City" value={`${cityName}, ${stateName}`} icon="📍" />
          <DetailRow
            label="Category"
            value={categoryName}
            icon={categoryIcon ?? "🏢"}
            badge="Exclusive"
            badgeColor="green"
          />
          <DetailRow label="Package" value={bundleName} icon="📦" />
          <DetailRow
            label="Homes reached per drop"
            value={homesPerDrop.toLocaleString()}
            icon="📬"
          />
        </div>

        {/* Right column */}
        <div className="space-y-0 divide-y divide-gray-50">
          <DetailRow
            label="Campaign start"
            value={fmt(startDate)}
            icon="🗓️"
          />
          <DetailRow
            label="Next mailer drop"
            value={fmt(nextDropDate)}
            icon="✉️"
          />
          <DetailRow
            label="Renewal date"
            value={
              daysUntilRenewal !== null
                ? `${fmt(renewalDate)} (${daysUntilRenewal}d)`
                : "—"
            }
            icon="🔄"
            valueColor={
              daysUntilRenewal !== null && daysUntilRenewal <= 14
                ? "text-amber-600 font-semibold"
                : undefined
            }
          />
          <DetailRow
            label="Drops"
            value={`${dropsCompleted} of ${totalDrops} completed`}
            icon="📊"
          />
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
  badge,
  badgeColor,
  valueColor,
}: {
  label: string;
  value: string;
  icon?: string;
  badge?: string;
  badgeColor?: "green" | "blue";
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {icon && <span className="w-5 text-center text-base">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={cn("text-sm font-semibold text-gray-900 truncate", valueColor)}>
            {value}
          </p>
          {badge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                badgeColor === "green"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              )}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
