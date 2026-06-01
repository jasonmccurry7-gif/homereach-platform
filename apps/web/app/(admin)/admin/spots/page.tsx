import type { Metadata } from "next";
import {
  db,
  spotAssignments,
  businesses,
  cities,
  categories,
} from "@homereach/db";
import { desc, eq } from "drizzle-orm";
import { SpotsClient } from "./spots-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spot Management - HomeReach Admin" };

const dayMs = 24 * 60 * 60 * 1000;

function isWithinDays(date: Date | string | null, days: number) {
  if (!date) return false;
  const target = new Date(date).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return target >= now.getTime() && target <= now.getTime() + days * dayMs;
}

export default async function AdminSpotsPage() {
  const rows = await db
    .select({
      id: spotAssignments.id,
      status: spotAssignments.status,
      spotType: spotAssignments.spotType,
      monthlyValueCents: spotAssignments.monthlyValueCents,
      activatedAt: spotAssignments.activatedAt,
      commitmentEndsAt: spotAssignments.commitmentEndsAt,
      releasedAt: spotAssignments.releasedAt,
      createdAt: spotAssignments.createdAt,
      stripeSubscriptionId: spotAssignments.stripeSubscriptionId,
      businessName: businesses.name,
      businessEmail: businesses.email,
      cityName: cities.name,
      cityState: cities.state,
      categoryName: categories.name,
    })
    .from(spotAssignments)
    .leftJoin(businesses, eq(spotAssignments.businessId, businesses.id))
    .leftJoin(cities, eq(spotAssignments.cityId, cities.id))
    .leftJoin(categories, eq(spotAssignments.categoryId, categories.id))
    .orderBy(desc(spotAssignments.createdAt))
    .limit(500);

  const spots = rows.map((r) => ({
    id: r.id,
    status: r.status,
    spotType: r.spotType,
    monthlyValueCents: r.monthlyValueCents,
    activatedAt: r.activatedAt instanceof Date ? r.activatedAt.toISOString() : (r.activatedAt ?? null),
    commitmentEndsAt: r.commitmentEndsAt instanceof Date ? r.commitmentEndsAt.toISOString() : (r.commitmentEndsAt ?? null),
    releasedAt: r.releasedAt instanceof Date ? r.releasedAt.toISOString() : (r.releasedAt ?? null),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    stripeSubscriptionId: r.stripeSubscriptionId ?? null,
    businessName: r.businessName ?? "-",
    businessEmail: r.businessEmail ?? "-",
    market: r.cityName && r.cityState ? `${r.cityName}, ${r.cityState}` : "-",
    category: r.categoryName ?? "-",
  }));

  const active = spots.filter((s) => s.status === "active").length;
  const pending = spots.filter((s) => s.status === "pending").length;
  const paused = spots.filter((s) => s.status === "paused").length;
  const churned = spots.filter((s) => s.status === "churned").length;
  const cancelled = spots.filter((s) => s.status === "cancelled").length;
  const mrr = spots
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.monthlyValueCents, 0);
  const pendingValueCents = spots
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.monthlyValueCents, 0);
  const renewalDue = spots.filter((s) => s.status === "active" && isWithinDays(s.commitmentEndsAt, 30)).length;
  const activeWithoutSubscription = spots.filter((s) => s.status === "active" && !s.stripeSubscriptionId).length;
  const needsReview = pending + paused + renewalDue + activeWithoutSubscription;

  return (
    <SpotsClient
      spots={spots}
      stats={{
        active,
        pending,
        paused,
        churned,
        cancelled,
        mrrCents: mrr,
        pendingValueCents,
        renewalDue,
        activeWithoutSubscription,
        needsReview,
      }}
    />
  );
}
