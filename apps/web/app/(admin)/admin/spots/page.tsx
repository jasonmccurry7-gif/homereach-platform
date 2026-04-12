import type { Metadata } from "next";
import {
  db, spotAssignments, businesses, cities, categories,
} from "@homereach/db";
import { desc, eq } from "drizzle-orm";
import { SpotsClient } from "./spots-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spot Management — HomeReach Admin" };

// ─────────────────────────────────────────────────────────────────────────────
// Agent 2 — Fulfillment & Ops
// /admin/spots — View and manage all spot_assignments
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminSpotsPage() {
  const rows = await db
    .select({
      id:                 spotAssignments.id,
      status:             spotAssignments.status,
      spotType:           spotAssignments.spotType,
      monthlyValueCents:  spotAssignments.monthlyValueCents,
      activatedAt:        spotAssignments.activatedAt,
      commitmentEndsAt:   spotAssignments.commitmentEndsAt,
      releasedAt:         spotAssignments.releasedAt,
      createdAt:          spotAssignments.createdAt,
      stripeSubscriptionId: spotAssignments.stripeSubscriptionId,
      businessName:       businesses.name,
      businessEmail:      businesses.email,
      cityName:           cities.name,
      cityState:          cities.state,
      categoryName:       categories.name,
    })
    .from(spotAssignments)
    .leftJoin(businesses, eq(spotAssignments.businessId, businesses.id))
    .leftJoin(cities,     eq(spotAssignments.cityId,     cities.id))
    .leftJoin(categories, eq(spotAssignments.categoryId, categories.id))
    .orderBy(desc(spotAssignments.createdAt))
    .limit(500);

  const spots = rows.map((r) => ({
    id:                r.id,
    status:            r.status,
    spotType:          r.spotType,
    monthlyValueCents: r.monthlyValueCents,
    activatedAt:       r.activatedAt instanceof Date ? r.activatedAt.toISOString() : (r.activatedAt ?? null),
    commitmentEndsAt:  r.commitmentEndsAt instanceof Date ? r.commitmentEndsAt.toISOString() : (r.commitmentEndsAt ?? null),
    releasedAt:        r.releasedAt instanceof Date ? r.releasedAt.toISOString() : (r.releasedAt ?? null),
    createdAt:         r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    stripeSubscriptionId: r.stripeSubscriptionId ?? null,
    businessName:      r.businessName ?? "—",
    businessEmail:     r.businessEmail ?? "—",
    market:            r.cityName && r.cityState ? `${r.cityName}, ${r.cityState}` : "—",
    category:          r.categoryName ?? "—",
  }));

  // Summary stats
  const active    = spots.filter((s) => s.status === "active").length;
  const pending   = spots.filter((s) => s.status === "pending").length;
  const paused    = spots.filter((s) => s.status === "paused").length;
  const churned   = spots.filter((s) => s.status === "churned").length;
  const mrr       = spots
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.monthlyValueCents, 0);

  return (
    <SpotsClient
      spots={spots}
      stats={{ active, pending, paused, churned, mrrCents: mrr }}
    />
  );
}
