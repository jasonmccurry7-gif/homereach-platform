import type { Metadata } from "next";
import { AvailabilityEngine } from "@/lib/engine/availability";
import { ReservationEngine }  from "@/lib/engine/reservation";
import {
  db,
  businesses,
  waitlistEntries,
  orders,
  marketingCampaigns,
  outreachReplies,
} from "@homereach/db";
import { eq, count, sum, gte, isNull, and } from "drizzle-orm";
import { HubClient } from "./hub-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "HomeReach OS — Control Center" };

export default async function HubPage() {
  const availEngine = new AvailabilityEngine();
  const resEngine   = new ReservationEngine();

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    cities,
    activeReservations,
    activeClientsResult,
    totalLeadsResult,
    newLeadsThisWeekResult,
    mrrResult,
    activeCampaignsResult,
    upcomingCampaignsResult,
    unreadRepliesResult,
    waitlistCountResult,
  ] = await Promise.all([
    availEngine.getAllCities(),
    resEngine.getAllActive(),
    db.select({ n: count() }).from(businesses).where(eq(businesses.status, "active")),
    db.select({ n: count() }).from(waitlistEntries),
    db.select({ n: count() }).from(waitlistEntries).where(
      gte(waitlistEntries.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    ),
    db.select({ total: sum(orders.total) }).from(orders).where(
      and(eq(orders.status, "paid"), gte(orders.paidAt, monthStart))
    ),
    db.select({ n: count() }).from(marketingCampaigns).where(eq(marketingCampaigns.status, "active")),
    db.select({ n: count() }).from(marketingCampaigns).where(eq(marketingCampaigns.status, "upcoming")),
    db.select({ n: count() }).from(outreachReplies).where(eq(outreachReplies.isRead, false)),
    db.select({ n: count() }).from(waitlistEntries).where(isNull(waitlistEntries.convertedToBusinessId)),
  ]);

  const totalSpots    = cities.reduce((s, c) => s + c.totalSpots, 0);
  const soldSpots     = cities.reduce((s, c) => s + c.soldSpots, 0);
  const reservedSpots = cities.reduce((s, c) => s + c.reservedSpots, 0);

  const activeClients    = activeClientsResult[0]?.n    ?? 0;
  const totalLeads       = totalLeadsResult[0]?.n        ?? 0;
  const newLeadsThisWeek = newLeadsThisWeekResult[0]?.n  ?? 0;
  const mrr              = Math.round(Number(mrrResult[0]?.total ?? 0));
  const activeCampaigns  = activeCampaignsResult[0]?.n   ?? 0;
  const upcomingCampaigns = upcomingCampaignsResult[0]?.n ?? 0;
  const unreadReplies    = unreadRepliesResult[0]?.n      ?? 0;
  const waitlistCount    = waitlistCountResult[0]?.n      ?? 0;

  const snapshot = {
    activeCities:    cities.filter((c) => c.soldSpots > 0).length,
    totalCities:     cities.length,
    spotsFilled:     soldSpots + reservedSpots,
    totalSpots,
    estimatedMRR:    mrr,
    totalLeads,
    newLeadsThisWeek,
    activeClients,
    activeCampaigns,
    upcomingCampaigns,
    unreadReplies,
    waitlistCount,
    conversionRate:
      totalLeads > 0 ? Math.round((activeClients / totalLeads) * 100) : 0,
  };

  return (
    <HubClient
      cities={cities}
      activeReservations={activeReservations}
      snapshot={snapshot}
    />
  );
}
