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

export const metadata: Metadata = { title: "Campaign Detail — HomeReach Admin" };

// ─────────────────────────────────────────────────────────────────────────────
// Admin Campaign Detail Page
// Shows campaign info, existing metrics rows, and a form to add new drop results.
// ─────────────────────────────────────────────────────────────────────────────

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
    : "—";

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

  return (
    <div className="max-w-4xl space-y-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/campaigns" className="hover:text-gray-900">
          Campaigns
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{business?.name ?? "Campaign"}</span>
      </div>

      {/* Campaign summary */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{business?.name ?? "—"}</h1>
              <StatusBadge status={status} size="sm" />
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {city?.name}, {city?.state} · {category?.icon} {category?.name} · {bundle?.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Drops
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {campaign.dropsCompleted}/{campaign.totalDrops}
            </p>
            <p className="text-xs text-gray-400">completed</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Homes / Drop
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {campaign.homesPerDrop.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Start date
            </p>
            <p className="mt-1 text-base font-semibold text-gray-700">
              {fmt(campaign.startDate)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Renewal date
            </p>
            <p className="mt-1 text-base font-semibold text-gray-700">
              {fmt(campaign.renewalDate)}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 pb-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 pt-5">
            Campaign ID
          </p>
          <p className="font-mono text-xs text-gray-500">{campaign.id}</p>
        </div>
      </div>

      {/* Status management */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Campaign status</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Update status and campaign dates. Changes reflect immediately on the
            client dashboard.
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

      {/* Drop results — existing metrics */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Drop results</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Actual performance data per mailer drop. Clients see this aggregated on their
            dashboard.
          </p>
        </div>

        {metrics.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-gray-500">No drop results entered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Period</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Impressions
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    QR Scans
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Forms
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Engagements
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Conv. %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {metrics.map((m) => {
                  const eng = m.qrScans + m.phoneLeads + m.formLeads;
                  const conv =
                    m.impressions > 0
                      ? ((eng / m.impressions) * 100).toFixed(2)
                      : "0.00";
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        <p className="font-medium">
                          {new Date(m.periodStart).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          →{" "}
                          {new Date(m.periodEnd).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs font-mono text-gray-400">{m.id}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {m.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-700">
                        {m.qrScans}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-700">
                        {m.phoneLeads}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-700">
                        {m.formLeads}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                        {eng}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-700">
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

      {/* Add new drop results */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Record new drop results</h2>
          <p className="mt-0.5 text-sm text-gray-400">
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
  );
}
