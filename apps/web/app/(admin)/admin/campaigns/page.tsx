import type { Metadata } from "next";
import Link from "next/link";
import {
  db,
  marketingCampaigns,
  campaignMetrics,
  businesses,
  cities,
  categories,
  bundles,
} from "@homereach/db";
import { desc, eq, sql } from "drizzle-orm";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const metadata: Metadata = { title: "Campaigns — HomeReach Admin" };

// ─────────────────────────────────────────────────────────────────────────────
// Admin Campaigns Page
// Lists all campaigns with inline drop-count status and a link to enter metrics.
// ─────────────────────────────────────────────────────────────────────────────

async function getAllCampaigns() {
  return db
    .select({
      campaign: marketingCampaigns,
      business: {
        id: businesses.id,
        name: businesses.name,
      },
      city: {
        name: cities.name,
        state: cities.state,
      },
      category: {
        name: categories.name,
        icon: categories.icon,
      },
      bundle: {
        name: bundles.name,
      },
      metricsCount: sql<number>`(
        select count(*)::int
        from campaign_metrics cm
        where cm.campaign_id = ${marketingCampaigns.id}
      )`,
    })
    .from(marketingCampaigns)
    .leftJoin(businesses, eq(marketingCampaigns.businessId, businesses.id))
    .leftJoin(cities, eq(marketingCampaigns.cityId, cities.id))
    .leftJoin(categories, eq(marketingCampaigns.categoryId, categories.id))
    .leftJoin(bundles, eq(marketingCampaigns.bundleId, bundles.id))
    .orderBy(desc(marketingCampaigns.createdAt));
}

const fmt = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export default async function AdminCampaignsPage() {
  const campaigns = await getAllCampaigns();

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total · Enter drop
            results after each mailer is sent
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No campaigns yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Campaigns are auto-created when a Stripe checkout completes.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Business</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City / Category</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Drops</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Next drop</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Metrics</th>
                <th className="px-4 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map(({ campaign, business, city, category, bundle, metricsCount }) => {
                const status = campaign.status as
                  | "upcoming"
                  | "active"
                  | "completed"
                  | "paused"
                  | "cancelled";
                return (
                  <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{business?.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{bundle?.name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">
                        {city?.name ?? "—"}, {city?.state ?? ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        {category?.icon} {category?.name ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={status} size="sm" />
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-gray-700">
                        {campaign.dropsCompleted}/{campaign.totalDrops}
                      </span>
                      <p className="text-xs text-gray-400">completed</p>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {fmt(campaign.nextDropDate)}
                    </td>
                    <td className="px-4 py-4">
                      {metricsCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">
                          {metricsCount} period{metricsCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          No data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
