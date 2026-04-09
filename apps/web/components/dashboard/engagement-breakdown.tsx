// ─────────────────────────────────────────────────────────────────────────────
// EngagementBreakdown
// Shows the full response funnel:
//   Impressions → Total Engagements → breakdown by type → conversion rate
// Only rendered when real metrics data exists.
// ─────────────────────────────────────────────────────────────────────────────

interface EngagementBreakdownProps {
  impressions: number;
  qrScans: number;
  phoneLeads: number;
  formLeads: number;
  totalEngagements: number;
  conversionRate: number; // e.g. 1.12 means 1.12%
}

export function EngagementBreakdown({
  impressions,
  qrScans,
  phoneLeads,
  formLeads,
  totalEngagements,
  conversionRate,
}: EngagementBreakdownProps) {
  const rows = [
    {
      icon: "📱",
      label: "QR scans",
      value: qrScans,
      pct: impressions > 0 ? ((qrScans / impressions) * 100).toFixed(2) : "0.00",
      barColor: "bg-blue-500",
    },
    {
      icon: "📞",
      label: "Phone calls",
      value: phoneLeads,
      pct: impressions > 0 ? ((phoneLeads / impressions) * 100).toFixed(2) : "0.00",
      barColor: "bg-green-500",
    },
    {
      icon: "📋",
      label: "Form fills",
      value: formLeads,
      pct: impressions > 0 ? ((formLeads / impressions) * 100).toFixed(2) : "0.00",
      barColor: "bg-purple-500",
    },
  ];

  const maxVal = Math.max(qrScans, phoneLeads, formLeads, 1);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-bold text-gray-900">Response Breakdown</h2>
        <p className="mt-0.5 text-sm text-gray-400">
          How your {impressions.toLocaleString()} reached households responded
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <KpiCell
          label="Total Engagements"
          value={totalEngagements.toString()}
          sub="scans + calls + forms"
          accent="blue"
        />
        <KpiCell
          label="Conversion Rate"
          value={`${conversionRate}%`}
          sub={`${totalEngagements} of ${impressions.toLocaleString()}`}
          accent="green"
        />
        <KpiCell
          label="Homes Reached"
          value={impressions.toLocaleString()}
          sub="verified addresses"
          accent="gray"
        />
      </div>

      {/* Breakdown bars */}
      <div className="divide-y divide-gray-50 px-6">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4 py-4">
            <span className="w-6 text-center text-lg">{row.icon}</span>

            <div className="w-28 shrink-0">
              <p className="text-sm font-medium text-gray-700">{row.label}</p>
              <p className="text-xs text-gray-400">{row.pct}% of reach</p>
            </div>

            {/* Bar */}
            <div className="flex flex-1 items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.barColor} transition-all`}
                  style={{ width: `${Math.max(2, (row.value / maxVal) * 100)}%` }}
                />
              </div>
              <span className="w-6 text-right text-sm font-bold text-gray-900 tabular-nums">
                {row.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer formula */}
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-3">
        <p className="text-xs text-gray-400">
          <span className="font-mono font-medium text-gray-600">
            Conversion rate = (QR scans + phone calls + form fills) ÷ impressions
          </span>
          {" "}={" "}
          <span className="font-mono font-medium text-gray-600">
            ({qrScans} + {phoneLeads} + {formLeads}) ÷ {impressions.toLocaleString()} = {conversionRate}%
          </span>
        </p>
      </div>

    </div>
  );
}

function KpiCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "green" | "gray";
}) {
  const color = {
    blue: "text-blue-700",
    green: "text-green-700",
    gray: "text-gray-700",
  }[accent];

  return (
    <div className="px-6 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  );
}
