import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCampaignsForUser, getCampaignMetrics, buildImpressionsChartData } from "@/lib/dashboard/queries";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ImpressionsChart } from "@/components/dashboard/impressions-chart";
import { EngagementBreakdown } from "@/components/dashboard/engagement-breakdown";

export const metadata: Metadata = { title: "My Campaign — HomeReach" };

export default async function CampaignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campaigns = await getCampaignsForUser(user.id);

  if (campaigns.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">My Campaign</h1>
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No campaigns found.</p>
          <Link
            href="/get-started"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Start your first campaign →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Campaign{campaigns.length > 1 ? "s" : ""}</h1>
        <Link
          href="/get-started"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          + Add city
        </Link>
      </div>

      {campaigns.map((row) => (
        <CampaignPanel key={row.campaign.id} row={row} />
      ))}
    </div>
  );
}

// ─── Campaign Panel ───────────────────────────────────────────────────────────

async function CampaignPanel({
  row,
}: {
  row: Awaited<ReturnType<typeof getCampaignsForUser>>[0];
}) {
  const camp = row.campaign;
  const status = camp.status as "upcoming" | "active" | "completed" | "paused" | "cancelled";
  const { rows: metricRows, totals, hasRealData } = await getCampaignMetrics(camp.id);
  const chartData = buildImpressionsChartData(camp, metricRows);

  const fmt = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "TBD";

  const totalActualReach = camp.dropsCompleted * camp.homesPerDrop;
  const totalProjectedReach = camp.totalDrops * camp.homesPerDrop;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Panel header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {row.business?.name ?? "Your Business"}
            </h2>
            <StatusBadge status={status} size="sm" />
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {row.city?.name}, {row.city?.state} · {row.category?.name} · {row.bundle?.name}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Metrics strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Homes Reached"
            value={totalActualReach > 0 ? totalActualReach.toLocaleString() : "Pending"}
            subtext={totalActualReach > 0 ? "to date" : "campaign upcoming"}
            icon="📬"
          />
          <MetricCard
            label="Total Projected"
            value={totalProjectedReach.toLocaleString()}
            subtext={`across ${camp.totalDrops} drop${camp.totalDrops !== 1 ? "s" : ""}`}
            icon="📈"
          />
          <MetricCard
            label="Engagements"
            value={totals.totalEngagements}
            icon="⚡"
            isMock={!hasRealData}
            subtext="scans + calls + forms"
          />
          <MetricCard
            label="Conversion"
            value={hasRealData ? `${totals.conversionRate}%` : "—"}
            icon="📊"
            isMock={!hasRealData}
            subtext="of homes reached"
          />
        </div>

        {/* Engagement breakdown — only when real data exists */}
        {hasRealData && (
          <EngagementBreakdown
            impressions={totals.impressions}
            qrScans={totals.qrScans}
            phoneLeads={totals.phoneLeads}
            formLeads={totals.formLeads}
            totalEngagements={totals.totalEngagements}
            conversionRate={totals.conversionRate}
          />
        )}

        {/* Chart */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">Homes reached per drop</p>
          <ImpressionsChart drops={chartData} homesPerDrop={camp.homesPerDrop} />
        </div>

        {/* Campaign timeline */}
        <div>
          <p className="mb-3 text-sm font-semibold text-gray-700">Campaign timeline</p>
          <ol className="relative border-l border-gray-200 pl-6 space-y-4">
            {[
              {
                label: "Campaign purchased",
                date: camp.createdAt,
                done: true,
                icon: "✅",
              },
              {
                label: "Design & approval",
                date: null,
                done: camp.status !== "upcoming",
                icon: "🎨",
                note: "Our team creates your ad",
              },
              {
                label: "First mailer drop",
                date: camp.nextDropDate,
                done: camp.dropsCompleted >= 1,
                icon: "📬",
              },
              {
                label: "Campaign renewal",
                date: camp.renewalDate,
                done: false,
                icon: "🔄",
              },
            ].map((item, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 text-xs">
                  {item.done ? "✓" : item.icon}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${item.done ? "text-gray-900" : "text-gray-400"}`}>
                    {item.label}
                  </p>
                  {item.date && (
                    <p className="text-xs text-gray-400">{fmt(new Date(item.date))}</p>
                  )}
                  {item.note && (
                    <p className="text-xs text-gray-400">{item.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Exclusivity bar */}
        <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <span className="text-lg">🔒</span>
          <p className="text-sm text-green-800">
            <span className="font-semibold">Category exclusive</span> — you are the only{" "}
            {row.category?.name?.toLowerCase() ?? "business"} on this mailer in{" "}
            {row.city?.name ?? "your city"}.
          </p>
        </div>

      </div>
    </div>
  );
}
