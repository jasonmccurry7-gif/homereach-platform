import {
  db,
  profiles,
  businesses,
  marketingCampaigns,
  campaignMetrics,
  cities,
  categories,
  bundles,
  orders,
} from "@homereach/db";
import { eq, desc, sum, and, inArray, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Query Helpers — server-side only
// ─────────────────────────────────────────────────────────────────────────────

// Full campaign record with all joined data for the dashboard
export type DashboardCampaign = Awaited<
  ReturnType<typeof getCampaignsForUser>
>[0];

export async function getCampaignsForUser(userId: string) {
  // Get all businesses owned by this user
  const userBusinesses = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, userId));

  if (userBusinesses.length === 0) return [];

  const businessIds = userBusinesses.map((b) => b.id);

  // Fetch campaigns with joined city, category, bundle, business
  const rows = await db
    .select({
      campaign: marketingCampaigns,
      business: {
        id: businesses.id,
        name: businesses.name,
        status: businesses.status,
      },
      city: {
        id: cities.id,
        name: cities.name,
        state: cities.state,
        slug: cities.slug,
      },
      category: {
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        slug: categories.slug,
      },
      bundle: {
        id: bundles.id,
        name: bundles.name,
        price: bundles.price,
        metadata: bundles.metadata,
      },
    })
    .from(marketingCampaigns)
    .leftJoin(businesses, eq(marketingCampaigns.businessId, businesses.id))
    .leftJoin(cities, eq(marketingCampaigns.cityId, cities.id))
    .leftJoin(categories, eq(marketingCampaigns.categoryId, categories.id))
    .leftJoin(bundles, eq(marketingCampaigns.bundleId, bundles.id))
    .where(eq(marketingCampaigns.businessId, businessIds[0]!))
    .orderBy(desc(marketingCampaigns.createdAt));

  return rows;
}

// Aggregate metrics for a campaign — includes derived KPIs
export async function getCampaignMetrics(campaignId: string) {
  const rows = await db
    .select()
    .from(campaignMetrics)
    .where(eq(campaignMetrics.campaignId, campaignId))
    .orderBy(campaignMetrics.periodStart);

  const totals = await db
    .select({
      totalImpressions: sum(campaignMetrics.impressions),
      totalMailpieces:  sum(campaignMetrics.mailpieces),
      totalQrScans:     sum(campaignMetrics.qrScans),
      totalPhoneLeads:  sum(campaignMetrics.phoneLeads),
      totalFormLeads:   sum(campaignMetrics.formLeads),
      totalLeads:       sum(campaignMetrics.totalLeads),
    })
    .from(campaignMetrics)
    .where(eq(campaignMetrics.campaignId, campaignId));

  const impressions       = Number(totals[0]?.totalImpressions ?? 0);
  const qrScans           = Number(totals[0]?.totalQrScans     ?? 0);
  const phoneLeads        = Number(totals[0]?.totalPhoneLeads  ?? 0);
  const formLeads         = Number(totals[0]?.totalFormLeads   ?? 0);
  const leads             = Number(totals[0]?.totalLeads       ?? 0);

  // Derived KPIs
  // total_engagements = every trackable action: scan, call, form
  const totalEngagements  = qrScans + phoneLeads + formLeads;
  // conversion_rate  = engagements / impressions  (expressed as %)
  const conversionRate    = impressions > 0
    ? Number(((totalEngagements / impressions) * 100).toFixed(2))
    : 0;

  return {
    rows,
    totals: {
      impressions,
      qrScans,
      phoneLeads,
      formLeads,
      leads,
      totalEngagements,
      conversionRate,   // e.g. 1.12  (meaning 1.12%)
    },
    hasRealData: rows.length > 0,
  };
}

// Orders for a user's businesses (for billing page)
export async function getOrdersForUser(userId: string) {
  const userBusinesses = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(eq(businesses.ownerId, userId));

  if (userBusinesses.length === 0) return [];

  const rows = await db
    .select({
      order: orders,
      bundle: {
        name: bundles.name,
        price: bundles.price,
      },
      business: {
        name: businesses.name,
      },
    })
    .from(orders)
    .leftJoin(bundles, eq(orders.bundleId, bundles.id))
    .leftJoin(businesses, eq(orders.businessId, businesses.id))
    .where(eq(orders.businessId, userBusinesses[0]!.id))
    .orderBy(desc(orders.createdAt));

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scarcity: how many spots remain for this bundle type in this city+category
// Used for the urgency line on the client dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export async function getSpotsRemaining(
  cityId: string,
  categoryId: string,
  bundleId: string
): Promise<{ maxSpots: number; spotsTaken: number; spotsRemaining: number }> {
  // Pull maxSpots from bundle metadata
  const [bundle] = await db
    .select({ metadata: bundles.metadata })
    .from(bundles)
    .where(eq(bundles.id, bundleId))
    .limit(1);

  const meta = (bundle?.metadata ?? {}) as Record<string, unknown>;
  const maxSpots = (meta.maxSpots as number) ?? 1;

  // Count all paid/active orders for this city + category + bundle combo
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(businesses, eq(orders.businessId, businesses.id))
    .where(
      and(
        eq(businesses.cityId, cityId),
        eq(businesses.categoryId, categoryId),
        eq(orders.bundleId, bundleId),
        inArray(orders.status, ["paid", "active"])
      )
    );

  const spotsTaken = row?.count ?? 0;
  const spotsRemaining = Math.max(0, maxSpots - spotsTaken);

  return { maxSpots, spotsTaken, spotsRemaining };
}

// Compute projected impressions chart data from campaign
// Fills in past drops as real, future as projected
export function buildImpressionsChartData(
  campaign: { startDate: Date | null; totalDrops: number; homesPerDrop: number; dropsCompleted: number },
  metricsRows: Awaited<ReturnType<typeof getCampaignMetrics>>["rows"]
) {
  const drops = [];
  const start = campaign.startDate ? new Date(campaign.startDate) : new Date();

  for (let i = 0; i < Math.max(campaign.totalDrops, 3); i++) {
    const dropDate = new Date(start);
    dropDate.setMonth(dropDate.getMonth() + i);

    const label = dropDate.toLocaleDateString("en-US", { month: "short" });
    const isCompleted = i < campaign.dropsCompleted;
    const isProjected = !isCompleted;

    // Use real metric if exists, otherwise use expected homes per drop
    const metric = metricsRows[i];
    const impressions = isCompleted
      ? (metric?.impressions ?? campaign.homesPerDrop)
      : campaign.homesPerDrop;

    drops.push({ label, impressions, isProjected });
  }

  return drops;
}
