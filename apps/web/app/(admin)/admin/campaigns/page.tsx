import type { Metadata } from "next";
import {
  db,
  marketingCampaigns,
  businesses,
  cities,
  categories,
  bundles,
  orders,
} from "@homereach/db";
import { eq, desc } from "drizzle-orm";
import { CampaignsClient } from "./campaigns-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaigns — HomeReach Admin" };

export default async function AdminCampaignsPage() {
  // ── Fetch all marketing campaigns with related data ────────────────────────
  const rows = await db
    .select({
      id:             marketingCampaigns.id,
      status:         marketingCampaigns.status,
      startDate:      marketingCampaigns.startDate,
      endDate:        marketingCampaigns.endDate,
      renewalDate:    marketingCampaigns.renewalDate,
      nextDropDate:   marketingCampaigns.nextDropDate,
      totalDrops:     marketingCampaigns.totalDrops,
      dropsCompleted: marketingCampaigns.dropsCompleted,
      homesPerDrop:   marketingCampaigns.homesPerDrop,
      notes:          marketingCampaigns.notes,
      createdAt:      marketingCampaigns.createdAt,
      // Business
      businessId:     businesses.id,
      businessName:   businesses.name,
      businessPhone:  businesses.phone,
      businessEmail:  businesses.email,
      // Geography
      cityName:       cities.name,
      cityState:      cities.state,
      categoryName:   categories.name,
      // Bundle
      bundleName:     bundles.name,
      // Order
      orderId:        orders.id,
      orderTotal:     orders.total,
      orderPaidAt:    orders.paidAt,
    })
    .from(marketingCampaigns)
    .leftJoin(businesses,  eq(marketingCampaigns.businessId,  businesses.id))
    .leftJoin(cities,      eq(marketingCampaigns.cityId,      cities.id))
    .leftJoin(categories,  eq(marketingCampaigns.categoryId,  categories.id))
    .leftJoin(bundles,     eq(marketingCampaigns.bundleId,    bundles.id))
    .leftJoin(orders,      eq(marketingCampaigns.orderId,     orders.id))
    .orderBy(desc(marketingCampaigns.createdAt))
    .limit(100);

  // ── Shape for client component ─────────────────────────────────────────────
  const campaigns = rows.map((r) => ({
    id:             r.id,
    businessId:     r.businessId ?? "",
    businessName:   r.businessName ?? "Unknown Business",
    businessPhone:  r.businessPhone ?? "",
    businessEmail:  r.businessEmail ?? "",
    city:           r.cityName ? `${r.cityName}, ${r.cityState ?? ""}`.trim() : "Unknown City",
    category:       r.categoryName ?? "Unknown Category",
    bundleName:     r.bundleName ?? "Unknown Bundle",
    orderId:        r.orderId ?? "",
    orderTotal:     Number(r.orderTotal ?? 0),
    orderPaidAt:    r.orderPaidAt?.toISOString() ?? null,
    status:         r.status,
    startDate:      r.startDate?.toISOString() ?? null,
    endDate:        r.endDate?.toISOString() ?? null,
    renewalDate:    r.renewalDate?.toISOString() ?? null,
    nextDropDate:   r.nextDropDate?.toISOString() ?? null,
    totalDrops:     r.totalDrops,
    dropsCompleted: r.dropsCompleted,
    homesPerDrop:   r.homesPerDrop,
    homesTotal:     r.totalDrops * r.homesPerDrop,
    notes:          r.notes ?? "",
    createdAt:      r.createdAt?.toISOString() ?? new Date().toISOString(),
  }));

  return <CampaignsClient campaigns={campaigns} />;
}
