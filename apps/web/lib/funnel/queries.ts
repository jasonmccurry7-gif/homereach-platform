import { db, cities, categories, bundles, orders } from "@homereach/db";
import { eq, and, inArray, sql, isNull, or } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Query Helpers
// Server-side only. Used in Server Components for each funnel step.
// ─────────────────────────────────────────────────────────────────────────────

export type CityWithAvailability = {
  id: string;
  name: string;
  state: string;
  slug: string;
  isActive: boolean;
  launchedAt: Date | null;
  totalSpotsRemaining: number;
  isComingSoon: boolean;
};

export type CategoryWithAvailability = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  spotsRemaining: number;
  isAvailable: boolean;
};

export type BundleWithAvailability = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  spotType: "anchor" | "front" | "back";
  maxSpots: number;
  spotsTaken: number;
  spotsRemaining: number;
  isSoldOut: boolean;
  features: string[];
  badgeText: string | null;
  badgeColor: string | null;
  highlight: boolean;
  sortOrder: number;
};

// ── Step 1: Cities ────────────────────────────────────────────────────────────

export async function getActiveCities(): Promise<CityWithAvailability[]> {
  const allCities = await db
    .select()
    .from(cities)
    .orderBy(cities.name);

  // Calculate total spots remaining per city
  // Spots = sum of (maxSpots per bundle * num categories) - sold orders
  const cityResults: CityWithAvailability[] = allCities.map((city) => ({
    ...city,
    // Simplified: active cities show "spots available", inactive show "coming soon"
    totalSpotsRemaining: city.isActive ? 99 : 0,
    isComingSoon: !city.isActive,
  }));

  // For active cities, calculate real availability
  const activeCityIds = allCities
    .filter((c) => c.isActive)
    .map((c) => c.id);

  if (activeCityIds.length === 0) return cityResults;

  // Count paid orders per city to estimate fill rate
  const orderCounts = await db
    .select({
      cityId: sql<string>`b.city_id`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .innerJoin(
      sql`businesses b`,
      sql`orders.business_id = b.id`
    )
    .where(
      and(
        inArray(sql`b.city_id`, activeCityIds),
        inArray(orders.status, ["paid", "active"])
      )
    )
    .groupBy(sql`b.city_id`);

  const countMap = Object.fromEntries(
    orderCounts.map((r) => [r.cityId, r.count])
  );

  return cityResults.map((city) => ({
    ...city,
    // 10 spots per city max
    totalSpotsRemaining: city.isActive
      ? Math.max(0, 10 - (countMap[city.id] ?? 0))
      : 0,
  }));
}

// ── Step 2: Categories ────────────────────────────────────────────────────────

export async function getCategoriesForCity(
  cityId: string
): Promise<CategoryWithAvailability[]> {
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.name);

  // Count paid orders per category in this city
  const orderCounts = await db
    .select({
      categoryId: sql<string>`b.category_id`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .innerJoin(
      sql`businesses b`,
      sql`orders.business_id = b.id`
    )
    .where(
      and(
        sql`b.city_id = ${cityId}`,
        inArray(orders.status, ["paid", "active"])
      )
    )
    .groupBy(sql`b.category_id`);

  const countMap = Object.fromEntries(
    orderCounts.map((r) => [r.categoryId, r.count])
  );

  // Total spots per category = sum of maxSpots across all bundles (1+3+6 = 10)
  const TOTAL_SPOTS_PER_CATEGORY = 10;

  return allCategories.map((cat) => {
    const taken = countMap[cat.id] ?? 0;
    const remaining = Math.max(0, TOTAL_SPOTS_PER_CATEGORY - taken);
    return {
      ...cat,
      spotsRemaining: remaining,
      isAvailable: remaining > 0,
    };
  });
}

// ── Step 3: Bundles (with real scarcity) ──────────────────────────────────────

export async function getBundlesWithAvailability(
  cityId: string,
  categoryId: string
): Promise<BundleWithAvailability[]> {
  // Fetch global bundles (cityId = null) and city-specific bundles
  const availableBundles = await db
    .select()
    .from(bundles)
    .where(
      and(
        eq(bundles.isActive, true),
        or(isNull(bundles.cityId), eq(bundles.cityId, cityId))
      )
    );

  if (availableBundles.length === 0) return [];

  const bundleIds = availableBundles.map((b) => b.id);

  // Count paid orders per bundle in this city + category
  const orderCounts = await db
    .select({
      bundleId: orders.bundleId,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .innerJoin(
      sql`businesses b`,
      sql`orders.business_id = b.id`
    )
    .where(
      and(
        sql`b.city_id = ${cityId}`,
        sql`b.category_id = ${categoryId}`,
        inArray(orders.bundleId, bundleIds),
        inArray(orders.status, ["paid", "active"])
      )
    )
    .groupBy(orders.bundleId);

  const countMap = Object.fromEntries(
    orderCounts.map((r) => [r.bundleId!, r.count])
  );

  return availableBundles
    .map((bundle) => {
      const meta = (bundle.metadata ?? {}) as Record<string, unknown>;
      const maxSpots = (meta.maxSpots as number) ?? 1;
      const spotsTaken = countMap[bundle.id] ?? 0;
      const spotsRemaining = Math.max(0, maxSpots - spotsTaken);

      return {
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        description: bundle.description,
        price: bundle.price,
        spotType: (meta.spotType as "anchor" | "front" | "back") ?? "back",
        maxSpots,
        spotsTaken,
        spotsRemaining,
        isSoldOut: spotsRemaining === 0,
        features: (meta.features as string[]) ?? [],
        badgeText: (meta.badgeText as string) ?? null,
        badgeColor: (meta.badgeColor as string) ?? null,
        highlight: (meta.highlight as boolean) ?? false,
        sortOrder: (meta.sortOrder as number) ?? 99,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export async function getCityBySlug(slug: string) {
  const [city] = await db
    .select()
    .from(cities)
    .where(eq(cities.slug, slug))
    .limit(1);
  return city ?? null;
}

export async function getCategoryBySlug(slug: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return category ?? null;
}

export async function getBundleById(id: string) {
  const [bundle] = await db
    .select()
    .from(bundles)
    .where(eq(bundles.id, id))
    .limit(1);
  return bundle ?? null;
}
