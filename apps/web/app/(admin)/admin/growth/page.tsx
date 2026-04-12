// ─────────────────────────────────────────────────────────────────────────────
// /admin/growth — Growth Intelligence Dashboard
//
// Server component. Fetches all data from DB and passes to client.
// Shows: deal velocity, city fill progress, channel performance vs benchmarks,
// daily log form, 7-day trend, and daily report output.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import {
  db,
  growthActivityLogs,
  businesses,
  cities,
  spotAssignments,
  CHANNEL_BENCHMARKS,
  GROWTH_TARGETS,
} from "@homereach/db";
import { desc, gte, inArray, sql } from "drizzle-orm";
import { GrowthClient } from "./growth-client";

export const dynamic   = "force-dynamic";
export const metadata: Metadata = { title: "Growth Intelligence — HomeReach Admin" };

// Last N days helper — returns a YYYY-MM-DD string
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function GrowthPage() {
  const today  = todayStr();
  const day30  = daysAgo(30);
  const day7   = daysAgo(7);

  // ── 1. Activity logs — last 30 days ──────────────────────────────────────
  const activityLogs = await db
    .select()
    .from(growthActivityLogs)
    .where(gte(growthActivityLogs.date, day30))
    .orderBy(desc(growthActivityLogs.date))
    .catch(() => []);

  // ── 2. Deals closed — businesses that activated in last 30 days ──────────
  // We use `businesses.createdAt` as proxy for deal date since the subscription
  // webhook sets business to active. For more precision, use spot_assignments.
  const recentBusinesses = await db
    .select({
      id:        businesses.id,
      name:      businesses.name,
      status:    businesses.status,
      createdAt: businesses.createdAt,
    })
    .from(businesses)
    .where(gte(businesses.createdAt, new Date(day30 + "T00:00:00Z")))
    .orderBy(desc(businesses.createdAt))
    .catch(() => []);

  // ── 3. City fill progress ─────────────────────────────────────────────────
  const cityRows = await db
    .select({
      id:   cities.id,
      name: cities.name,
      slug: cities.slug,
    })
    .from(cities)
    .catch(() => []);

  // Active spots per city
  const activeSpotsByCityRaw = await db
    .select({
      cityId:      spotAssignments.cityId,
      activeCount: sql<number>`count(*)`,
    })
    .from(spotAssignments)
    .where(inArray(spotAssignments.status, ["active", "pending"]))
    .groupBy(spotAssignments.cityId)
    .catch(() => []);

  const activeSpotsByCity: Record<string, number> = {};
  for (const r of activeSpotsByCityRaw) {
    if (r.cityId) activeSpotsByCity[r.cityId] = Number(r.activeCount);
  }

  const citiesWithData = cityRows.map((c) => ({
    id:          c.id,
    name:        c.name,
    slug:        c.slug,
    activeSpots: activeSpotsByCity[c.id] ?? 0,
    isFilled:    (activeSpotsByCity[c.id] ?? 0) >= 1, // at least one paid spot = "started"
  }));

  const filledCities  = citiesWithData.filter((c) => c.isFilled).length;
  const totalCities   = citiesWithData.length;

  // ── 4. Deal velocity summary ──────────────────────────────────────────────
  // Deals from activity logs (manual attribution) for last 7 days
  const last7Logs = activityLogs.filter((l) => l.date >= day7);
  const dealsLast7FromLogs = last7Logs.reduce((sum, l) => sum + (l.dealsClosed ?? 0), 0);

  // Deals from DB (businesses created last 7 days) as alternate signal
  const dealsLast7FromDB = recentBusinesses.filter(
    (b) => b.createdAt && b.createdAt >= new Date(day7 + "T00:00:00Z")
  ).length;

  // Use whichever is higher (logs are manual; DB is automatic)
  const dealsLast7 = Math.max(dealsLast7FromLogs, dealsLast7FromDB);

  // Today's log entries (pre-fill the form)
  const todayLogs = activityLogs.filter((l) => l.date === today);

  return (
    <GrowthClient
      today={today}
      activityLogs={activityLogs}
      todayLogs={todayLogs}
      recentBusinesses={recentBusinesses.map((b) => ({
        id:        b.id,
        name:      b.name ?? "Unknown",
        status:    b.status ?? "unknown",
        createdAt: b.createdAt?.toISOString() ?? "",
      }))}
      citiesWithData={citiesWithData}
      filledCities={filledCities}
      totalCities={totalCities}
      dealsLast7={dealsLast7}
      benchmarks={CHANNEL_BENCHMARKS}
      targets={GROWTH_TARGETS}
    />
  );
}
