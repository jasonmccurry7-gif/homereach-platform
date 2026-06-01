import type { Metadata } from "next";
import Link from "next/link";
import {
  db,
  marketingCampaigns,
  businesses,
  cities,
  categories,
  bundles,
} from "@homereach/db";
import { desc, eq, sql } from "drizzle-orm";
import { StatusBadge } from "@/components/dashboard/status-badge";

export const metadata: Metadata = { title: "Campaigns - HomeReach Admin" };

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
        price: bundles.price,
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
    : "-";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const dayMs = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysUntil(date: Date | null, today: Date) {
  if (!date) return null;
  return Math.ceil((startOfDay(new Date(date)).getTime() - today.getTime()) / dayMs);
}

function getCampaignAttention(
  row: Awaited<ReturnType<typeof getAllCampaigns>>[number],
  today: Date
) {
  const { campaign, metricsCount } = row;
  const status = campaign.status as string;
  const count = Number(metricsCount ?? 0);
  const days = daysUntil(campaign.nextDropDate, today);

  if (status === "active" && days !== null && days < 0 && campaign.dropsCompleted < campaign.totalDrops) {
    return {
      priority: "High",
      label: "Drop date passed",
      nextStep: "Confirm mail status and update the next drop date.",
      badge: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (campaign.dropsCompleted > count) {
    return {
      priority: "High",
      label: "Drop results missing",
      nextStep: "Record QR, phone, form, and mailpiece results.",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  if ((status === "active" || status === "upcoming") && days !== null && days <= 7) {
    return {
      priority: "Medium",
      label: days === 0 ? "Drop due today" : `Drop in ${days} day${days === 1 ? "" : "s"}`,
      nextStep: "Review print, design, and production readiness.",
      badge: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  if (status === "active" && campaign.dropsCompleted >= campaign.totalDrops) {
    return {
      priority: "Medium",
      label: "Ready to close out",
      nextStep: "Enter final results and mark complete if fulfillment is finished.",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  return null;
}

export default async function AdminCampaignsPage() {
  const campaigns = await getAllCampaigns();
  const today = startOfDay(new Date());
  const activeCount = campaigns.filter(({ campaign }) => campaign.status === "active").length;
  const upcomingCount = campaigns.filter(({ campaign }) => campaign.status === "upcoming").length;
  const needsMetricsCount = campaigns.filter(
    ({ campaign, metricsCount }) => campaign.dropsCompleted > Number(metricsCount ?? 0)
  ).length;
  const nextSevenDays = campaigns.filter(({ campaign }) => {
    const days = daysUntil(campaign.nextDropDate, today);
    return (
      (campaign.status === "active" || campaign.status === "upcoming") &&
      days !== null &&
      days >= 0 &&
      days <= 7
    );
  }).length;
  const totalActiveValue = campaigns
    .filter(({ campaign }) => campaign.status === "active")
    .reduce((sum, { bundle }) => sum + Number(bundle?.price ?? 0), 0);
  const attentionItems = campaigns
    .map((row) => ({ row, attention: getCampaignAttention(row, today) }))
    .filter((item): item is { row: (typeof campaigns)[number]; attention: NonNullable<ReturnType<typeof getCampaignAttention>> } =>
      Boolean(item.attention)
    )
    .slice(0, 6);

  return (
    <div className="max-w-7xl space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Fulfillment command
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Shared postcard campaigns
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              The daily view for active drops, missing results, print readiness, and client-facing campaign proof.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/spots"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Manage spot inventory
            </Link>
            <Link
              href="/admin/availability"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Check availability
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Active campaigns", value: activeCount, note: "Currently mailing" },
          { label: "Upcoming", value: upcomingCount, note: "Paid, not live yet" },
          { label: "Drops this week", value: nextSevenDays, note: "Review print readiness" },
          { label: "Results needed", value: needsMetricsCount, note: "Update client proof" },
          { label: "Active value", value: money(totalActiveValue), note: "Bundle baseline" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">What needs attention today</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sorted for revenue protection: overdue drops, missing results, and near-term production checks.
            </p>
          </div>
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {attentionItems.length} open item{attentionItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">No campaign fulfillment issues are visible from current records.</p>
            <p className="mt-1 text-sm text-emerald-700">
              Keep reviewing print/design approvals before each scheduled drop.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {attentionItems.map(({ row, attention }) => (
              <div
                key={row.campaign.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${attention.badge}`}>
                      {attention.priority} - {attention.label}
                    </span>
                    <span className="text-sm font-bold text-slate-950">{row.business?.name ?? "Unassigned business"}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {row.city?.name ?? "Market"}, {row.city?.state ?? ""} - {row.category?.name ?? "Category"}.
                    {` ${attention.nextStep}`}
                  </p>
                </div>
                <Link
                  href={`/admin/campaigns/${row.campaign.id}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open campaign
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="font-semibold text-slate-700">No campaigns yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Campaigns are auto-created when a Stripe checkout completes.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-950">Campaign ledger</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage fulfillment status, upcoming drops, and the performance data clients see.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Business</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">City / Category</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Drops</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Next drop</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Metrics</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Attention</th>
                  <th className="px-4 py-3 font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.map(({ campaign, business, city, category, bundle, metricsCount }) => {
                  const status = campaign.status as
                    | "upcoming"
                    | "active"
                    | "completed"
                    | "paused"
                    | "cancelled";
                  const count = Number(metricsCount ?? 0);
                  const row = { campaign, business, city, category, bundle, metricsCount };
                  const attention = getCampaignAttention(row, today);
                  return (
                    <tr key={campaign.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">{business?.name ?? "-"}</p>
                        <p className="text-xs text-slate-500">{bundle?.name ?? "-"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-slate-700">
                          {city?.name ?? "-"}, {city?.state ?? ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {category?.icon} {category?.name ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={status} size="sm" />
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-slate-700">
                          {campaign.dropsCompleted}/{campaign.totalDrops}
                        </span>
                        <p className="text-xs text-slate-500">completed</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {fmt(campaign.nextDropDate)}
                      </td>
                      <td className="px-4 py-4">
                        {count > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            {count} period{count !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            No data
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {attention ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${attention.badge}`}>
                            {attention.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Clear</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
