import type { DashboardKpis } from "@/lib/political/dashboard-queries";

// Pure presentational — mobile-first grid.

export function KpiStrip({ kpis }: { kpis: DashboardKpis }) {
  const cells = [
    {
      label: "Candidates",
      value: kpis.totalCandidates.toLocaleString(),
      sub: `${kpis.activeCandidates.toLocaleString()} active`,
    },
    {
      label: "Hot priority",
      value: kpis.hotCandidates.toLocaleString(),
      sub: "priority ≥ 70",
      tone: "hot" as const,
    },
    {
      label: "Follow-ups due",
      value: kpis.followUpsDue.toLocaleString(),
      sub: "next_follow_up_at ≤ now",
      tone: kpis.followUpsDue > 0 ? ("warn" as const) : undefined,
    },
    {
      label: "Proposals sent",
      value: kpis.proposalsSent.toLocaleString(),
      sub: `${kpis.proposalsApproved.toLocaleString()} approved · ${kpis.proposalsDeclined.toLocaleString()} declined`,
    },
    {
      label: "Close rate",
      value: kpis.closeRatePct !== null ? `${kpis.closeRatePct}%` : "—",
      sub: "approved / (approved + declined)",
    },
    {
      label: "Revenue",
      value: formatCents(kpis.revenueCents),
      sub: kpis.avgDealCents !== null ? `avg deal ${formatCents(kpis.avgDealCents)}` : "no paid orders yet",
    },
    {
      label: "Elections · 90d",
      value: kpis.electionsThisQuarter.toLocaleString(),
      sub: "upcoming",
    },
  ];

  return (
    <section
      aria-label="Political Command Center KPIs"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7"
    >
      {cells.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg border bg-white px-3 py-2 shadow-sm ${
            c.tone === "hot"
              ? "border-rose-200"
              : c.tone === "warn"
                ? "border-amber-200"
                : "border-slate-200"
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {c.label}
          </div>
          <div
            className={`mt-0.5 text-xl font-semibold tracking-tight ${
              c.tone === "hot"
                ? "text-rose-700"
                : c.tone === "warn"
                  ? "text-amber-700"
                  : "text-slate-900"
            }`}
          >
            {c.value}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-slate-500" title={c.sub}>
            {c.sub}
          </div>
        </div>
      ))}
    </section>
  );
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
