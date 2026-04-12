import { db } from "@homereach/db";
import { cities, spotAssignments } from "@homereach/db/schema";
import { inArray, sql } from "drizzle-orm";
import { TrafficEngineClient } from "./traffic-engine-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Traffic Engine — HomeReach Admin",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CityExpansionData = {
  id: string;
  name: string;
  state: string;
  slug: string;
  isActive: boolean;
  activeSpots: number;
  pendingSpots: number;
  mrrCents: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Traffic Engine Page (server)
// Loads city expansion data, passes to client
// ─────────────────────────────────────────────────────────────────────────────

export default async function TrafficEnginePage() {
  // Fetch all cities
  const allCities = await db
    .select()
    .from(cities)
    .orderBy(cities.name)
    .catch(() => [] as typeof cities.$inferSelect[]);

  // Fetch spot counts per city (active + pending + mrr)
  const spotRows = await db
    .select({
      cityId: spotAssignments.cityId,
      status: spotAssignments.status,
      mrrCents: sql<number>`sum(${spotAssignments.monthlyValueCents})`,
      count: sql<number>`count(*)`,
    })
    .from(spotAssignments)
    .where(
      inArray(spotAssignments.status, ["active", "pending"])
    )
    .groupBy(spotAssignments.cityId, spotAssignments.status)
    .catch(() => []);

  // Build city map: cityId → { activeSpots, pendingSpots, mrrCents }
  const cityMap = new Map<
    string,
    { activeSpots: number; pendingSpots: number; mrrCents: number }
  >();
  for (const row of spotRows) {
    const existing = cityMap.get(row.cityId) ?? {
      activeSpots: 0,
      pendingSpots: 0,
      mrrCents: 0,
    };
    if (row.status === "active") {
      existing.activeSpots = Number(row.count);
      existing.mrrCents = Number(row.mrrCents ?? 0);
    } else if (row.status === "pending") {
      existing.pendingSpots = Number(row.count);
    }
    cityMap.set(row.cityId, existing);
  }

  // Merge into CityExpansionData
  const cityData: CityExpansionData[] = allCities.map((city) => {
    const spots = cityMap.get(city.id) ?? {
      activeSpots: 0,
      pendingSpots: 0,
      mrrCents: 0,
    };
    return {
      id: city.id,
      name: city.name,
      state: city.state,
      slug: city.slug,
      isActive: city.isActive,
      ...spots,
    };
  });

  return <TrafficEngineClient cities={cityData} />;
}
