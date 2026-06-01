import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCampaignsForUser,
  getCampaignMetrics,
  buildImpressionsChartData,
} from "@/lib/dashboard/queries";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ImpressionsChart } from "@/components/dashboard/impressions-chart";
import { EngagementBreakdown } from "@/components/dashboard/engagement-breakdown";

export const metadata: Metadata = { title: "Campaigns - HomeReach" };

export default async function CampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const campaigns = await getCampaignsForUser(user.id);

  if (campaigns.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageIntro
          title="Campaigns"
          body="This is where your active visibility work will live once your first campaign is started."
        />
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            No campaign is active yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Start with one city and HomeReach will keep the schedule, reach,
            proof, and next steps organized here.
          </p>
          <Link
            href="/get-started"
            className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Start first campaign
          </Link>
        </div>
      </div>
    );
  }

  const activeCount = campaigns.filter((row) =>
    ["active", "upcoming"].includes(row.campaign.status),
  ).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title={`Campaign${campaigns.length > 1 ? "s" : ""}`}
          body={`${activeCount} active or upcoming campaign${activeCount !== 1 ? "s" : ""}. HomeReach keeps the work, timing, and response proof visible here.`}
        />
        <Link
          href="/get-started"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Add city
        </Link>
      </div>

      {campaigns.map((row) => (
        <CampaignPanel key={row.campaign.id} row={row} />
      ))}
    </div>
  );
}

async function CampaignPanel({
  row,
}: {
  row: Awaited<ReturnType<typeof getCampaignsForUser>>[0];
}) {
  const camp = row.campaign;
  const status = camp.status as
    | "upcoming"
    | "active"
    | "completed"
    | "paused"
    | "cancelled";
  const {
    rows: metricRows,
    totals,
    hasRealData,
  } = await getCampaignMetrics(camp.id);
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
  const nextCustomerStep =
    status === "upcoming"
      ? "HomeReach is preparing the campaign for launch."
      : hasRealData && totals.totalEngagements > 0
        ? "Review replies and follow up with interested customers."
        : status === "active"
          ? "HomeReach is monitoring scans, calls, and form fills."
          : status === "completed"
            ? "Review results and decide whether to renew or expand."
            : "Check with HomeReach before making changes.";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {row.business?.name ?? "Your Business"}
            </h2>
            <StatusBadge status={status} size="sm" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {row.city?.name}, {row.city?.state} | {row.category?.name} |{" "}
            {row.bundle?.name}
          </p>
        </div>
        <Link
          href="/replies"
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          View replies
        </Link>
      </div>

      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Next customer step
          </p>
          <p className="mt-2 text-sm font-bold text-blue-950">
            {nextCustomerStep}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Homes reached"
            value={
              totalActualReach > 0
                ? totalActualReach.toLocaleString()
                : "Pending"
            }
            subtext={
              totalActualReach > 0 ? "delivered to date" : "campaign upcoming"
            }
          />
          <MetricCard
            label="Planned reach"
            value={totalProjectedReach.toLocaleString()}
            subtext={`across ${camp.totalDrops} drop${camp.totalDrops !== 1 ? "s" : ""}`}
          />
          <MetricCard
            label="Customer actions"
            value={totals.totalEngagements}
            isMock={!hasRealData}
            subtext="scans, calls, forms"
          />
          <MetricCard
            label="Conversion"
            value={hasRealData ? `${totals.conversionRate}%` : "0%"}
            isMock={!hasRealData}
            subtext="of homes reached"
          />
        </div>

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

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-gray-800">
              Homes reached by drop
            </p>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500">
              {camp.dropsCompleted}/{camp.totalDrops} complete
            </span>
          </div>
          <ImpressionsChart
            drops={chartData}
            homesPerDrop={camp.homesPerDrop}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="mb-3 text-sm font-semibold text-gray-800">
              What HomeReach is handling
            </p>
            <ol className="relative space-y-4 border-l border-gray-200 pl-6">
              {[
                {
                  label: "Campaign purchased",
                  date: camp.createdAt,
                  done: true,
                  note: "Payment and campaign record are connected.",
                },
                {
                  label: "Creative and launch prep",
                  date: null,
                  done: camp.status !== "upcoming",
                  note: "Ad setup, schedule checks, and campaign readiness.",
                },
                {
                  label: "Mailer drop",
                  date: camp.nextDropDate,
                  done: camp.dropsCompleted >= 1,
                  note: `${camp.homesPerDrop.toLocaleString()} homes per drop.`,
                },
                {
                  label: "Renewal review",
                  date: camp.renewalDate,
                  done: false,
                  note: "Keep, adjust, or expand when the window arrives.",
                },
              ].map((item) => (
                <li key={item.label} className="relative">
                  <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-500">
                    {item.done ? "OK" : ""}
                  </span>
                  <p
                    className={`text-sm font-semibold ${
                      item.done ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {item.label}
                  </p>
                  {item.date && (
                    <p className="text-xs text-gray-400">
                      {fmt(new Date(item.date))}
                    </p>
                  )}
                  <p className="text-xs leading-5 text-gray-400">{item.note}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
              Category protection
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-green-950">
              You are the only {row.category?.name?.toLowerCase() ?? "business"}{" "}
              on this mailer in {row.city?.name ?? "your city"}.
            </p>
            <p className="mt-2 text-xs leading-5 text-green-700">
              That keeps your offer from sitting next to a direct local
              competitor on the same shared mailer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageIntro({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Customer campaign center
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">{body}</p>
    </div>
  );
}
