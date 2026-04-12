import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, profiles } from "@homereach/db";
import { eq } from "drizzle-orm";
import {
  getCampaignsForUser,
  getCampaignMetrics,
  getSpotsRemaining,
  buildImpressionsChartData,
} from "@/lib/dashboard/queries";
import { CampaignDetailCard } from "@/components/dashboard/campaign-detail-card";
import { ImpressionsChart } from "@/components/dashboard/impressions-chart";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EngagementBreakdown } from "@/components/dashboard/engagement-breakdown";

// ─────────────────────────────────────────────────────────────────────────────
// Constants — configurable in a future settings page
// ─────────────────────────────────────────────────────────────────────────────
const AVG_JOB_VALUE = 500; // dollars

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmtDate = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [[profile], campaigns] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1),
    getCampaignsForUser(user.id),
  ]);

  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  const activeCampaign =
    campaigns.find(
      (c) => c.campaign.status === "active" || c.campaign.status === "upcoming"
    ) ??
    campaigns[0] ??
    null;

  const metrics = activeCampaign
    ? await getCampaignMetrics(activeCampaign.campaign.id)
    : null;

  const chartData = activeCampaign
    ? buildImpressionsChartData(
        activeCampaign.campaign,
        metrics?.rows ?? []
      )
    : [];

  // Scarcity — only query when we have a full city+category+bundle
  const scarcity =
    activeCampaign?.campaign.cityId &&
    activeCampaign?.campaign.categoryId &&
    activeCampaign?.campaign.bundleId
      ? await getSpotsRemaining(
          activeCampaign.campaign.cityId,
          activeCampaign.campaign.categoryId,
          activeCampaign.campaign.bundleId
        )
      : null;

  const camp = activeCampaign?.campaign;

  const totalActualReach = camp ? camp.dropsCompleted * camp.homesPerDrop : 0;
  const projectedReach = camp ? camp.totalDrops * camp.homesPerDrop : 0;
  const displayReach =
    totalActualReach > 0 ? totalActualReach : projectedReach;

  const daysUntilRenewal = camp?.renewalDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(camp.renewalDate).getTime() - Date.now()) / 86400000
        )
      )
    : null;

  const status = (camp?.status ?? "upcoming") as
    | "upcoming"
    | "active"
    | "completed"
    | "paused"
    | "cancelled";

  const t = metrics?.totals;

  // ROI calculations
  const estimatedRevenue = t ? t.totalEngagements * AVG_JOB_VALUE : 0;
  // Use order.total (actual charged amount) — NOT bundle.price (display-only).
  const adSpend = activeCampaign?.order?.total
    ? Number(activeCampaign.order.total)
    : 0;
  const roas =
    adSpend > 0 && estimatedRevenue > 0
      ? Math.round(estimatedRevenue / adSpend)
      : null;

  const categoryName =
    activeCampaign?.category?.name?.toLowerCase() ?? "business";
  const cityName = activeCampaign?.city?.name ?? "your city";

  // ── No campaign ─────────────────────────────────────────────────────────────
  if (!activeCampaign || !camp) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {firstName}
          </h1>
          <p className="mt-1 text-gray-500">
            You don&apos;t have an active campaign yet.
          </p>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 text-5xl">📬</div>
          <h2 className="text-xl font-bold text-gray-900">
            Ready to reach your neighborhood?
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-gray-500">
            Purchase a HomeReach campaign to start getting your business in
            front of 2,500+ homes.
          </p>
          <Link
            href="/get-started"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Get started →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-2xl font-bold text-gray-900">{firstName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {campaigns.length > 1 && (
            <Link
              href="/dashboard/campaign"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {campaigns.length} campaigns →
            </Link>
          )}
        </div>
      </div>

      {/* ── Renewal alert ────────────────────────────────────────────────────── */}
      {daysUntilRenewal !== null && daysUntilRenewal <= 14 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="mt-0.5 text-lg">⏰</span>
          <div>
            <p className="font-semibold text-amber-800">
              Campaign renews in {daysUntilRenewal} day
              {daysUntilRenewal !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-amber-700">
              Renew to keep your exclusive spot.{" "}
              <Link
                href="/dashboard/billing"
                className="font-semibold underline"
              >
                View billing →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Performance headline ─────────────────────────────────────────────── */}
      {metrics?.hasRealData && t && (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-5 text-white shadow-sm">
          <p className="text-sm font-medium text-blue-200 uppercase tracking-widest mb-1">
            Campaign performance
          </p>
          <p className="text-xl font-bold leading-snug sm:text-2xl">
            This campaign reached{" "}
            <span className="text-white underline decoration-blue-300 decoration-2 underline-offset-2">
              {t.impressions.toLocaleString()} homeowners
            </span>{" "}
            and generated{" "}
            <span className="text-white underline decoration-blue-300 decoration-2 underline-offset-2">
              {t.totalEngagements} customer action
              {t.totalEngagements !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      )}

      {/* ── Hero metric strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <HeroStat
          label="Homes Reached"
          value={
            metrics?.hasRealData
              ? t!.impressions.toLocaleString()
              : displayReach.toLocaleString()
          }
          sub={
            metrics?.hasRealData
              ? "verified addresses"
              : totalActualReach > 0
              ? "delivered to date"
              : "projected this campaign"
          }
          accent="blue"
          isMock={!metrics?.hasRealData}
        />
        <HeroStat
          label="Customer Actions"
          value={metrics?.hasRealData ? t!.totalEngagements.toString() : "—"}
          sub="scans · calls · form fills"
          accent="green"
          isMock={!metrics?.hasRealData}
        />
        <HeroStat
          label="Conversion Rate"
          value={
            metrics?.hasRealData && t ? `${t.conversionRate}%` : "—"
          }
          sub={
            metrics?.hasRealData && t
              ? `${t.totalEngagements} of ${t.impressions.toLocaleString()} reached`
              : "no data yet"
          }
          accent="purple"
          isMock={!metrics?.hasRealData}
        />
      </div>

      {/* ── ROI Estimator ─────────────────────────────────────────────────────── */}
      {metrics?.hasRealData && t && t.totalEngagements > 0 && (
        <div className="rounded-2xl border border-green-200 bg-green-50 shadow-sm overflow-hidden">
          <div className="border-b border-green-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <h2 className="font-bold text-green-900">ROI Estimator</h2>
            </div>
            <p className="mt-0.5 text-sm text-green-700">
              Based on {t.totalEngagements} customer action
              {t.totalEngagements !== 1 ? "s" : ""} × ${AVG_JOB_VALUE} average
              job value
            </p>
          </div>

          <div className="grid grid-cols-1 divide-y divide-green-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 px-0">
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-600">
                Estimated Revenue
              </p>
              <p className="mt-1 text-4xl font-bold text-green-800">
                {fmt$(estimatedRevenue)}
              </p>
              <p className="mt-1 text-sm text-green-700">
                {t.totalEngagements} actions × {fmt$(AVG_JOB_VALUE)} avg job
              </p>
            </div>

            {roas !== null && adSpend > 0 && (
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-600">
                  Return on Ad Spend
                </p>
                <p className="mt-1 text-4xl font-bold text-green-800">
                  {roas}x
                </p>
                <p className="mt-1 text-sm text-green-700">
                  {fmt$(estimatedRevenue)} ÷ {fmt$(adSpend)} ad spend
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-green-100 bg-green-50/80 px-6 py-2.5">
            <p className="text-xs text-green-600">
              Estimate assumes ${AVG_JOB_VALUE}/job average. Actual results vary.
            </p>
          </div>
        </div>
      )}

      {/* ── Exclusivity badge + urgency ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Exclusivity */}
        <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-white px-5 py-4 shadow-sm">
          <span className="mt-0.5 text-2xl">🔒</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-green-600 mb-1">
              Category Exclusive
            </p>
            <p className="font-bold text-gray-900 leading-snug">
              You are the{" "}
              <span className="text-green-700 uppercase tracking-wide">only</span>{" "}
              {categoryName} on this mailer in {cityName}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              No competing {categoryName} can advertise on the same mailer.
            </p>
          </div>
        </div>

        {/* Next drop + urgency */}
        <div className="flex flex-col gap-3">
          {/* Next drop date */}
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                Next Drop Date
              </p>
              <p className="font-bold text-gray-900 text-lg">
                {fmtDate(camp.nextDropDate) ?? "TBD"}
              </p>
              <p className="text-xs text-gray-400">
                {camp.homesPerDrop.toLocaleString()} homes ·{" "}
                {camp.dropsCompleted}/{camp.totalDrops} drops completed
              </p>
            </div>
          </div>

          {/* Scarcity / urgency */}
          {scarcity !== null && (
            <div
              className={`flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-sm ${
                scarcity.spotsRemaining <= 1
                  ? "border-red-200 bg-red-50"
                  : scarcity.spotsRemaining <= 2
                  ? "border-amber-200 bg-amber-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <span className="text-2xl">
                {scarcity.spotsRemaining <= 1 ? "🔥" : scarcity.spotsRemaining <= 2 ? "⚡" : "📊"}
              </span>
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-widest mb-0.5 ${
                    scarcity.spotsRemaining <= 1
                      ? "text-red-600"
                      : scarcity.spotsRemaining <= 2
                      ? "text-amber-600"
                      : "text-gray-400"
                  }`}
                >
                  Spot availability
                </p>
                <p
                  className={`font-bold ${
                    scarcity.spotsRemaining <= 1
                      ? "text-red-800"
                      : scarcity.spotsRemaining <= 2
                      ? "text-amber-800"
                      : "text-gray-900"
                  }`}
                >
                  {scarcity.spotsRemaining === 0
                    ? `All ${scarcity.maxSpots} spots are filled in ${cityName}`
                    : `Only ${scarcity.spotsRemaining} spot${scarcity.spotsRemaining !== 1 ? "s" : ""} remaining in ${cityName}`}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    scarcity.spotsRemaining <= 1
                      ? "text-red-700"
                      : scarcity.spotsRemaining <= 2
                      ? "text-amber-700"
                      : "text-gray-500"
                  }`}
                >
                  {scarcity.spotsTaken} of {scarcity.maxSpots} spots taken for {categoryName}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Campaign detail + chart ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CampaignDetailCard
            businessName={activeCampaign.business?.name ?? "Your Business"}
            cityName={activeCampaign.city?.name ?? "—"}
            stateName={activeCampaign.city?.state ?? ""}
            categoryName={activeCampaign.category?.name ?? "—"}
            categoryIcon={activeCampaign.category?.icon ?? null}
            bundleName={activeCampaign.bundle?.name ?? "—"}
            status={status}
            startDate={camp.startDate}
            renewalDate={camp.renewalDate}
            nextDropDate={camp.nextDropDate}
            homesPerDrop={camp.homesPerDrop}
            dropsCompleted={camp.dropsCompleted}
            totalDrops={camp.totalDrops}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  Monthly Reach
                </p>
                <p className="text-xs text-gray-400">Homes per mailer drop</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="inline-block h-2 w-2 rounded-sm bg-blue-100 border border-blue-200" />
                Projected
              </span>
            </div>
            {chartData.length > 0 ? (
              <ImpressionsChart
                drops={chartData}
                homesPerDrop={camp.homesPerDrop}
              />
            ) : (
              <div className="flex h-28 items-center justify-center text-sm text-gray-400">
                Chart appears after first drop
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Engagement breakdown ─────────────────────────────────────────────── */}
      {metrics?.hasRealData && t && (
        <EngagementBreakdown
          impressions={t.impressions}
          qrScans={t.qrScans}
          phoneLeads={t.phoneLeads}
          formLeads={t.formLeads}
          totalEngagements={t.totalEngagements}
          conversionRate={t.conversionRate}
        />
      )}

      {/* ── CTAs ─────────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-semibold text-blue-900">
            🏙️ Expand to another city
          </p>
          <p className="mt-1 text-sm text-blue-700">
            Claim a spot in a second market and double your reach.
          </p>
          <Link
            href="/get-started"
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            Add another city →
          </Link>
        </div>

        <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5">
          <p className="text-sm font-semibold text-purple-900">
            🤝 Refer a business
          </p>
          <p className="mt-1 text-sm text-purple-700">
            Know another local business that should be on the mailer?
          </p>
          <Link
            href="/refer"
            className="mt-3 inline-block rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
          >
            Send a referral →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroStat — large number display for the 3 primary KPIs
// ─────────────────────────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  sub,
  accent,
  isMock = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "green" | "purple";
  isMock?: boolean;
}) {
  const accentColor = {
    blue: "text-blue-600",
    green: "text-green-600",
    purple: "text-purple-600",
  }[accent];

  return (
    <div className="relative px-6 py-6">
      {isMock && (
        <span className="absolute right-4 top-4 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
          Coming soon
        </span>
      )}
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
        {label}
      </p>
      <p
        className={`text-5xl font-black leading-none tabular-nums ${
          isMock ? "text-gray-200" : accentColor
        }`}
      >
        {isMock ? "—" : value}
      </p>
      <p className="mt-2 text-xs text-gray-400">{sub}</p>
    </div>
  );
}
