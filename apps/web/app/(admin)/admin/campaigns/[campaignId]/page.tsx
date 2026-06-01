import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  db,
  marketingCampaigns,
  campaignMetrics,
  businesses,
  cities,
  categories,
  bundles,
} from "@homereach/db";
import { eq, desc } from "drizzle-orm";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { MetricsEntryForm } from "./metrics-entry-form";
import { CampaignStatusForm } from "./campaign-status-form";

export const metadata: Metadata = { title: "Campaign Detail - HomeReach Admin" };

async function getCampaignDetail(campaignId: string) {
  const [row] = await db
    .select({
      campaign: marketingCampaigns,
      business: { id: businesses.id, name: businesses.name },
      city: { name: cities.name, state: cities.state },
      category: { name: categories.name, icon: categories.icon },
      bundle: { name: bundles.name, price: bundles.price },
    })
    .from(marketingCampaigns)
    .leftJoin(businesses, eq(marketingCampaigns.businessId, businesses.id))
    .leftJoin(cities, eq(marketingCampaigns.cityId, cities.id))
    .leftJoin(categories, eq(marketingCampaigns.categoryId, categories.id))
    .leftJoin(bundles, eq(marketingCampaigns.bundleId, bundles.id))
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (!row) return null;

  const metrics = await db
    .select()
    .from(campaignMetrics)
    .where(eq(campaignMetrics.campaignId, campaignId))
    .orderBy(desc(campaignMetrics.periodStart));

  return { ...row, metrics };
}

const fmt = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "-";

const fmtShort = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

const dayMs = 24 * 60 * 60 * 1000;

function daysUntil(date: Date | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / dayMs);
}

function getNextAction({
  status,
  dropsCompleted,
  totalDrops,
  metricsCount,
  nextDropDate,
}: {
  status: string;
  dropsCompleted: number;
  totalDrops: number;
  metricsCount: number;
  nextDropDate: Date | null;
}) {
  const days = daysUntil(nextDropDate);

  if (status === "active" && days !== null && days < 0 && dropsCompleted < totalDrops) {
    return {
      label: "Confirm overdue drop",
      detail: "The next drop date has passed. Confirm mail status, update the date, and keep the client proof current.",
      tone: "border-red-200 bg-red-50 text-red-800",
    };
  }

  if (dropsCompleted > metricsCount) {
    return {
      label: "Record missing drop results",
      detail: "A completed drop does not yet have matching performance data. Add QR, phone, form, mailpiece, and impression results.",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if ((status === "active" || status === "upcoming") && days !== null && days <= 7) {
    return {
      label: days === 0 ? "Drop due today" : `Drop in ${days} day${days === 1 ? "" : "s"}`,
      detail: "Review design approval, print readiness, route timing, and customer expectations before the mailer goes out.",
      tone: "border-blue-200 bg-blue-50 text-blue-800",
    };
  }

  if (status === "active" && dropsCompleted >= totalDrops) {
    return {
      label: "Closeout ready",
      detail: "All scheduled drops appear complete. Enter final results and move the campaign to completed when fulfillment is confirmed.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return {
    label: "No urgent action",
    detail: "Campaign records look steady. Keep the next drop date, status, and client-facing results current.",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const data = await getCampaignDetail(campaignId);
  if (!data) notFound();

  const { campaign, business, city, category, bundle, metrics } = data;
  const status = campaign.status as
    | "upcoming"
    | "active"
    | "completed"
    | "paused"
    | "cancelled";
  const totalEngagements = metrics.reduce(
    (sum, m) => sum + m.qrScans + m.phoneLeads + m.formLeads,
    0
  );
  const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
  const conversionRate =
    totalImpressions > 0 ? ((totalEngagements / totalImpressions) * 100).toFixed(2) : "0.00";
  const nextAction = getNextAction({
    status,
    dropsCompleted: campaign.dropsCompleted,
    totalDrops: campaign.totalDrops,
    metricsCount: metrics.length,
    nextDropDate: campaign.nextDropDate,
  });

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/campaigns" className="font-medium hover:text-slate-900">
          Campaigns
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{business?.name ?? "Campaign"}</span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                Campaign command
              </p>
              <StatusBadge status={status} size="sm" />
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {business?.name ?? "-"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {city?.name ?? "-"}, {city?.state ?? ""} - {category?.icon} {category?.name ?? "-"} - {bundle?.name ?? "-"}
            </p>
          </div>
          <div className={`max-w-xl rounded-2xl border p-4 ${nextAction.tone}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Next best action</p>
            <p className="mt-2 text-lg font-bold">{nextAction.label}</p>
            <p className="mt-1 text-sm leading-6">{nextAction.detail}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Drops complete",
            value: `${campaign.dropsCompleted}/${campaign.totalDrops}`,
            note: "Fulfillment progress",
          },
          {
            label: "Next drop",
            value: fmtShort(campaign.nextDropDate),
            note: "Production checkpoint",
          },
          {
            label: "Homes / drop",
            value: campaign.homesPerDrop.toLocaleString(),
            note: "Estimated reach",
          },
          {
            label: "Results periods",
            value: metrics.length,
            note: campaign.dropsCompleted > metrics.length ? "Needs update" : "Client proof ready",
          },
          {
            label: "Engagement rate",
            value: `${conversionRate}%`,
            note: `${totalEngagements.toLocaleString()} engagements`,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-bold text-slate-950">Campaign status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Update status and campaign dates. Changes reflect immediately on the client dashboard.
              </p>
            </div>
            <div className="p-6">
              <CampaignStatusForm
                campaignId={campaign.id}
                currentStatus={campaign.status}
                dropsCompleted={campaign.dropsCompleted}
                totalDrops={campaign.totalDrops}
                nextDropDate={campaign.nextDropDate?.toISOString() ?? null}
                renewalDate={campaign.renewalDate?.toISOString() ?? null}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-bold text-slate-950">Drop results</h2>
              <p className="mt-1 text-sm text-slate-500">
                Actual performance data per mailer drop. Clients see this aggregated on their dashboard.
              </p>
            </div>

            {metrics.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="font-semibold text-slate-700">No drop results entered yet.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Add the first result period after a mailer is sent.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="px-4 py-3 font-semibold text-slate-600">Period</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Impressions</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">QR scans</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Phone</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Forms</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Engagements</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Conv. %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {metrics.map((m) => {
                      const engagements = m.qrScans + m.phoneLeads + m.formLeads;
                      const conv =
                        m.impressions > 0
                          ? ((engagements / m.impressions) * 100).toFixed(2)
                          : "0.00";
                      return (
                        <tr key={m.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">
                            <p className="font-medium">
                              {new Date(m.periodStart).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              to{" "}
                              {new Date(m.periodEnd).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="font-mono text-xs text-slate-400">{m.id}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-900">
                            {m.impressions.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-blue-700">
                            {m.qrScans}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            {m.phoneLeads}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-violet-700">
                            {m.formLeads}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {engagements}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                            {conv}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-bold text-slate-950">Record new drop results</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter actual figures after each postcard drop completes.
              </p>
            </div>
            <div className="p-6">
              <MetricsEntryForm
                campaignId={campaign.id}
                defaultHomes={campaign.homesPerDrop}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Readiness checklist</h2>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "Status is current",
                  complete: Boolean(campaign.status),
                },
                {
                  label: "Next drop date set",
                  complete: Boolean(campaign.nextDropDate),
                },
                {
                  label: "Results match completed drops",
                  complete: campaign.dropsCompleted <= metrics.length,
                },
                {
                  label: "Renewal date visible",
                  complete: Boolean(campaign.renewalDate),
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      item.complete
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.complete ? "Ready" : "Needs review"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">Campaign details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Start date</dt>
                <dd className="mt-1 font-medium text-slate-800">{fmt(campaign.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Renewal date</dt>
                <dd className="mt-1 font-medium text-slate-800">{fmt(campaign.renewalDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Campaign ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-500">{campaign.id}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
