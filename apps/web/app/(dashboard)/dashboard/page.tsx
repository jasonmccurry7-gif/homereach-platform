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
import { AiCooCommandCenter } from "@/components/ai-coo/ai-coo-command-center";

const AVG_JOB_VALUE = 500;

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const fmtDate = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

type DashboardSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

const inventoryProductIntents = new Set([
  "inventory",
  "inventory-intelligence",
  "inventory-purchasing",
  "inventory_purchasing",
  "purchasing",
  "purchasing-intelligence",
]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeProductIntent(value: string | undefined) {
  return value?.trim().toLowerCase();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const params = await searchParams;
  const productIntent = normalizeProductIntent(firstParam(params.product));
  if (productIntent && inventoryProductIntents.has(productIntent)) {
    redirect("/operations-copilot");
  }

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
      (c) => c.campaign.status === "active" || c.campaign.status === "upcoming",
    ) ??
    campaigns[0] ??
    null;

  const metrics = activeCampaign
    ? await getCampaignMetrics(activeCampaign.campaign.id)
    : null;

  const chartData = activeCampaign
    ? buildImpressionsChartData(activeCampaign.campaign, metrics?.rows ?? [])
    : [];

  const scarcity =
    activeCampaign?.campaign.cityId &&
    activeCampaign?.campaign.categoryId &&
    activeCampaign?.campaign.bundleId
      ? await getSpotsRemaining(
          activeCampaign.campaign.cityId,
          activeCampaign.campaign.categoryId,
          activeCampaign.campaign.bundleId,
        )
      : null;

  const camp = activeCampaign?.campaign;

  const totalActualReach = camp ? camp.dropsCompleted * camp.homesPerDrop : 0;
  const projectedReach = camp ? camp.totalDrops * camp.homesPerDrop : 0;
  const displayReach = totalActualReach > 0 ? totalActualReach : projectedReach;

  const daysUntilRenewal = camp?.renewalDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(camp.renewalDate).getTime() - Date.now()) / 86400000,
        ),
      )
    : null;

  const status = (camp?.status ?? "upcoming") as
    | "upcoming"
    | "active"
    | "completed"
    | "paused"
    | "cancelled";

  const totals = metrics?.totals;

  const estimatedRevenue = totals ? totals.totalEngagements * AVG_JOB_VALUE : 0;
  const adSpend = activeCampaign?.order?.total
    ? Number(activeCampaign.order.total)
    : activeCampaign?.bundle?.price
      ? Number(activeCampaign.bundle.price)
      : 0;
  const roas =
    adSpend > 0 && estimatedRevenue > 0
      ? Math.round(estimatedRevenue / adSpend)
      : null;

  const categoryName =
    activeCampaign?.category?.name?.toLowerCase() ?? "business";
  const cityName = activeCampaign?.city?.name ?? "your city";
  const businessName = activeCampaign?.business?.name ?? "Your Business";
  const nextAction =
    daysUntilRenewal !== null && daysUntilRenewal <= 14
      ? "Review billing so your spot stays protected."
      : metrics?.hasRealData && totals && totals.totalEngagements > 0
        ? "Check replies and follow up with interested customers."
        : status === "upcoming"
          ? "HomeReach is preparing your campaign for launch."
          : "HomeReach is watching for scans, calls, and form fills.";

  if (!activeCampaign || !camp) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader
          eyebrow="Customer dashboard"
          title={`Welcome, ${firstName}`}
          body="A simple place to see what HomeReach is doing for your business, what needs your attention, and where growth is starting to show up."
        />

        <AiCooCommandCenter user={{ id: user.id, email: user.email }} />

        <section className="rounded-2xl border border-blue-100 bg-blue-700 p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-100">
            Next best action
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight">
            Start with a clear visibility plan.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">
            HomeReach can help you choose where to show up, what to send, and
            how follow-up should be handled once people respond.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
            >
              Start a campaign
            </Link>
            <Link
              href="/operations-copilot"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Check savings opportunities
            </Link>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <SimpleCard
            title="Get seen locally"
            body="Shared postcards and route planning help your business stay visible in the neighborhoods that matter."
            href="/get-started"
            cta="Start campaign"
          />
          <SimpleCard
            title="Keep follow-up clear"
            body="Replies, approvals, campaign timing, and billing are organized so the next step is easier to see."
            href="/replies"
            cta="View replies"
          />
          <SimpleCard
            title="Watch costs"
            body="Operations Copilot can surface recurring purchasing gaps before they quietly drain margin."
            href="/operations-copilot"
            cta="Open savings"
          />
        </div>

        <CustomerGrowthSnapshot
          stats={[
            ["Active campaigns", "0", "Start with a simple campaign plan."],
            [
              "Leads generated",
              "0",
              "Lead capture turns on with your first campaign.",
            ],
            [
              "Postcards mailed",
              "0",
              "Reach appears after your first drop is scheduled.",
            ],
            ["QR scans", "Ready", "QR traffic connects back to your campaign."],
            ["Follow-up", "Ready", "HomeReach keeps reply activity visible."],
            [
              "Reviews",
              "Available",
              "Reputation support can be added when needed.",
            ],
          ]}
          nextAction="Choose the first service area to grow."
          serviceOptions={[
            "Shared postcards",
            "AI website assistant",
            "Local SEO",
            "Review requests",
          ]}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Customer dashboard"
        title={`Welcome back, ${firstName}`}
        body="Your campaign status, next customer action, and proof of work are together here."
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {campaigns.length > 1 && (
              <Link
                href="/campaign"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                View all campaigns
              </Link>
            )}
          </div>
        }
      />

      <AiCooCommandCenter user={{ id: user.id, email: user.email }} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Active work
          </p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">
            HomeReach is running {businessName} in {cityName}.
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Your {categoryName} spot is reserved, campaign timing is tracked,
            and response signals are collected as they come in.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniProof
              label="Campaign"
              value={activeCampaign.bundle?.name ?? "HomeReach Campaign"}
            />
            <MiniProof
              label="Next drop"
              value={fmtDate(camp.nextDropDate) ?? "Scheduling"}
            />
            <MiniProof
              label="Protected reach"
              value={`${displayReach.toLocaleString()} homes`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Needs attention
          </p>
          <p className="mt-2 text-lg font-bold text-blue-950">{nextAction}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={
                daysUntilRenewal !== null && daysUntilRenewal <= 14
                  ? "/billing"
                  : metrics?.hasRealData &&
                      totals &&
                      totals.totalEngagements > 0
                    ? "/replies"
                    : "/campaign"
              }
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Open next step
            </Link>
            <Link
              href="/settings"
              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
            >
              Update contact info
            </Link>
          </div>
        </div>
      </section>

      {daysUntilRenewal !== null && daysUntilRenewal <= 14 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">
            Your campaign renews in {daysUntilRenewal} day
            {daysUntilRenewal !== 1 ? "s" : ""}.
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Review billing to keep your local spot protected.
          </p>
        </div>
      )}

      {metrics?.hasRealData && totals && (
        <div className="rounded-2xl border border-blue-100 bg-blue-700 px-6 py-5 text-white shadow-sm">
          <p className="mb-1 text-sm font-medium uppercase tracking-widest text-blue-100">
            Result so far
          </p>
          <p className="text-xl font-bold leading-snug sm:text-2xl">
            This campaign reached {totals.impressions.toLocaleString()} homes
            and produced {totals.totalEngagements} tracked customer action
            {totals.totalEngagements !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <HeroStat
          label="Homes reached"
          value={
            metrics?.hasRealData
              ? totals!.impressions.toLocaleString()
              : displayReach.toLocaleString()
          }
          sub={
            metrics?.hasRealData
              ? "verified campaign reach"
              : totalActualReach > 0
                ? "delivered to date"
                : "planned campaign reach"
          }
          accent="blue"
          isPending={!metrics?.hasRealData && totalActualReach === 0}
        />
        <HeroStat
          label="Customer actions"
          value={
            metrics?.hasRealData ? totals!.totalEngagements.toString() : "0"
          }
          sub="scans, calls, and forms"
          accent="green"
          isPending={!metrics?.hasRealData}
        />
        <HeroStat
          label="Conversion rate"
          value={
            metrics?.hasRealData && totals ? `${totals.conversionRate}%` : "0%"
          }
          sub={
            metrics?.hasRealData && totals
              ? `${totals.totalEngagements} of ${totals.impressions.toLocaleString()} reached`
              : "starts after responses"
          }
          accent="purple"
          isPending={!metrics?.hasRealData}
        />
      </div>

      <CustomerGrowthSnapshot
        stats={[
          [
            "Active campaigns",
            String(campaigns.length),
            "Campaign records tied to your account.",
          ],
          [
            "Leads generated",
            metrics?.hasRealData && totals ? String(totals.leads) : "Pending",
            "Tracked phone, form, and QR responses.",
          ],
          [
            "Postcards mailed",
            totalActualReach > 0
              ? totalActualReach.toLocaleString()
              : "Scheduled",
            "Households reached or scheduled.",
          ],
          [
            "QR scans",
            metrics?.hasRealData && totals ? String(totals.qrScans) : "Pending",
            "Campaign scan traffic.",
          ],
          ["Follow-up", "Ready", "Replies stay visible from your portal."],
          [
            "Reviews",
            "Available",
            "Reputation support can be added when useful.",
          ],
        ]}
        nextAction={nextAction}
        serviceOptions={[
          "Targeted campaign",
          "Review requests",
          "Local SEO page",
          "AI website assistant",
        ]}
      />

      {metrics?.hasRealData && totals && totals.totalEngagements > 0 && (
        <div className="overflow-hidden rounded-2xl border border-green-200 bg-green-50 shadow-sm">
          <div className="border-b border-green-100 px-6 py-4">
            <h2 className="font-bold text-green-950">
              Potential value estimate
            </h2>
            <p className="mt-1 text-sm text-green-700">
              A simple estimate based on {totals.totalEngagements} tracked
              action
              {totals.totalEngagements !== 1 ? "s" : ""} and a{" "}
              {fmtMoney(AVG_JOB_VALUE)}
              average job value.
            </p>
          </div>

          <div className="grid grid-cols-1 divide-y divide-green-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <EstimateStat
              label="Estimated opportunity"
              value={fmtMoney(estimatedRevenue)}
              note={`${totals.totalEngagements} actions x ${fmtMoney(AVG_JOB_VALUE)} avg job`}
            />
            {roas !== null && adSpend > 0 && (
              <EstimateStat
                label="Estimated return"
                value={`${roas}x`}
                note={`${fmtMoney(estimatedRevenue)} / ${fmtMoney(adSpend)} campaign spend`}
              />
            )}
          </div>

          <p className="border-t border-green-100 px-6 py-3 text-xs text-green-700">
            This is not a guarantee. Actual revenue depends on close rate, job
            size, timing, and customer fit.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoPanel
          label="Category protection"
          title={`You are the only ${categoryName} on this mailer in ${cityName}.`}
          body={`No competing ${categoryName} is shown on the same shared mailer.`}
        />

        <div className="space-y-3">
          <InfoPanel
            label="Next drop"
            title={fmtDate(camp.nextDropDate) ?? "Date being scheduled"}
            body={`${camp.homesPerDrop.toLocaleString()} homes per drop. ${camp.dropsCompleted}/${camp.totalDrops} drops completed.`}
          />

          {scarcity !== null && (
            <InfoPanel
              label="Spot availability"
              title={
                scarcity.spotsRemaining === 0
                  ? `All ${scarcity.maxSpots} spots are filled in ${cityName}.`
                  : `${scarcity.spotsRemaining} spot${scarcity.spotsRemaining !== 1 ? "s" : ""} still open in ${cityName}.`
              }
              body={`${scarcity.spotsTaken} of ${scarcity.maxSpots} ${categoryName} spots are taken.`}
              tone={scarcity.spotsRemaining <= 2 ? "warm" : "neutral"}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CampaignDetailCard
            businessName={businessName}
            cityName={activeCampaign.city?.name ?? "-"}
            stateName={activeCampaign.city?.state ?? ""}
            categoryName={activeCampaign.category?.name ?? "-"}
            categoryIcon={activeCampaign.category?.icon ?? null}
            bundleName={activeCampaign.bundle?.name ?? "-"}
            status={status}
            startDate={camp.startDate}
            renewalDate={camp.renewalDate}
            nextDropDate={camp.nextDropDate}
            homesPerDrop={camp.homesPerDrop}
            dropsCompleted={camp.dropsCompleted}
            totalDrops={camp.totalDrops}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Reach by drop
                </p>
                <p className="text-xs text-gray-400">Homes per mailer drop</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                Planned
              </span>
            </div>
            {chartData.length > 0 ? (
              <ImpressionsChart
                drops={chartData}
                homesPerDrop={camp.homesPerDrop}
              />
            ) : (
              <div className="flex h-28 items-center justify-center text-sm text-gray-400">
                Reach appears after the first drop is scheduled.
              </div>
            )}
          </div>
        </div>
      </div>

      {metrics?.hasRealData && totals && (
        <EngagementBreakdown
          impressions={totals.impressions}
          qrScans={totals.qrScans}
          phoneLeads={totals.phoneLeads}
          formLeads={totals.formLeads}
          totalEngagements={totals.totalEngagements}
          conversionRate={totals.conversionRate}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SimpleCard
          title="Grow into another city"
          body="Add another local market when you are ready to widen reach without adding more work to your plate."
          href="/get-started"
          cta="Add city"
          tone="blue"
        />
        <SimpleCard
          title="Send a referral"
          body="Refer another local business that would benefit from clearer visibility and follow-up."
          href="/refer"
          cta="Refer business"
          tone="purple"
        />
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">{body}</p>
      </div>
      {action}
    </div>
  );
}

function CustomerGrowthSnapshot({
  stats,
  nextAction,
  serviceOptions,
}: {
  stats: Array<[string, string, string]>;
  nextAction: string;
  serviceOptions: string[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Growth snapshot
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-900">
            The simple scorecard for what HomeReach is building.
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Campaign reach, reply activity, proof, and add-on opportunities stay
            visible without making you manage the back office.
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Next
          </p>
          <p className="mt-1 text-sm font-bold text-blue-950">{nextAction}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value, detail]) => (
          <div
            key={label}
            className="rounded-xl border border-gray-100 bg-gray-50 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {label}
            </p>
            <p className="mt-2 text-xl font-black text-gray-900">{value}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {serviceOptions.map((option) => (
          <span
            key={option}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-600"
          >
            {option}
          </span>
        ))}
      </div>
    </div>
  );
}

function SimpleCard({
  title,
  body,
  href,
  cta,
  tone = "white",
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
  tone?: "white" | "blue" | "purple";
}) {
  const styles = {
    white: "border-gray-200 bg-white text-blue-600",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700",
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-sm font-bold hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  accent,
  isPending = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "green" | "purple";
  isPending?: boolean;
}) {
  const accentColor = {
    blue: "text-blue-600",
    green: "text-green-600",
    purple: "text-purple-600",
  }[accent];

  return (
    <div className="relative px-6 py-6">
      {isPending && (
        <span className="absolute right-4 top-4 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
          Pending
        </span>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p
        className={`text-5xl font-black leading-none tabular-nums ${accentColor}`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function MiniProof({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}

function InfoPanel({
  label,
  title,
  body,
  tone = "neutral",
}: {
  label: string;
  title: string;
  body: string;
  tone?: "neutral" | "warm";
}) {
  return (
    <div
      className={
        tone === "warm"
          ? "rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
          : "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      }
    >
      <p
        className={
          tone === "warm"
            ? "text-xs font-semibold uppercase tracking-widest text-amber-600"
            : "text-xs font-semibold uppercase tracking-widest text-gray-400"
        }
      >
        {label}
      </p>
      <p className="mt-2 text-base font-bold text-gray-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-gray-500">{body}</p>
    </div>
  );
}

function EstimateStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
        {label}
      </p>
      <p className="mt-1 text-4xl font-bold text-green-900">{value}</p>
      <p className="mt-1 text-sm text-green-700">{note}</p>
    </div>
  );
}
