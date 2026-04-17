import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Query Helpers
// Server-side only. Used in Server Components for each funnel step.
// Uses Supabase JS client (HTTP) — reliable in Vercel serverless.
// ─────────────────────────────────────────────────────────────────────────────

// ── Migrated client spot counts ───────────────────────────────────────────────
// Migrated clients store city/category/spotType in a [migration_meta] JSON blob
// in the notes field (city_id is null). This helper parses them and returns a
// nested map: cityName → categoryName → spotType → count.
// Only "legacy_active" and "new_system" statuses occupy real spots.
// "legacy_pending" does NOT count — not yet confirmed.

type MigratedCountMap = Record<string, Record<string, Record<string, number>>>;

async function getMigratedCounts(
  supabase: ReturnType<typeof createServiceClient>
): Promise<MigratedCountMap> {
  try {
    const { data } = await supabase
      .from("businesses")
      .select("notes")
      .like("notes", "%[migration_meta]%");

    const result: MigratedCountMap = {};

    for (const row of data ?? []) {
      try {
        const metaStr = row.notes?.split("[migration_meta]")[1];
        const meta = JSON.parse(metaStr ?? "{}") as Record<string, unknown>;

        // Pending clients don't occupy a spot yet
        if (meta.migrationStatus === "legacy_pending") continue;

        // Normalize "Ravenna, OH" → "Ravenna"
        const rawCity  = (meta.city  as string) ?? "";
        const cityName = rawCity.split(",")[0].trim();
        const category = ((meta.category as string) ?? "").trim();
        const spotType = ((meta.spotType as string) ?? "front").trim();

        if (!cityName || !category) continue;

        result[cityName] ??= {};
        result[cityName][category] ??= {};
        result[cityName][category][spotType] =
          (result[cityName][category][spotType] ?? 0) + 1;
      } catch { /* skip malformed rows */ }
    }

    return result;
  } catch {
    return {};
  }
}

export type CityWithAvailability = {
  id: string;
  name: string;
  state: string;
  slug: string;
  isActive: boolean;
  launchedAt: Date | null;
  totalSpotsRemaining: number;
  isComingSoon: boolean;
  foundingEligible: boolean;
  isFoundingOpen: boolean;
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
  standardPriceCents: number;
  foundingPriceCents: number;
};

// ── Step 1: Cities ────────────────────────────────────────────────────────────

const MAX_SPOTS_PER_CITY = 10; // 1 anchor + 3 front + 6 back per spec

export async function getActiveCities(): Promise<CityWithAvailability[]> {
  const supabase = createServiceClient();

  const { data: allCities, error } = await supabase
    .from("cities")
    .select("*")
    .order("name");

  if (error || !allCities) return [];

  const activeCityIds = allCities.filter(c => c.is_active).map(c => c.id);

  // Count distinct categories with active/paid orders per city
  // (each category slot = 1 spot taken out of the 10 per city)
  let takenMap: Record<string, number> = {};
  if (activeCityIds.length > 0) {
    try {
      const { data: bizWithOrders } = await supabase
        .from("businesses")
        .select("city_id, category_id, orders!inner(status)")
        .in("city_id", activeCityIds)
        .in("orders.status", ["paid", "active"]);

      if (bizWithOrders) {
        // Count unique city_id + category_id combos (each = 1 taken slot)
        const seen = new Set<string>();
        for (const biz of bizWithOrders) {
          const key = `${biz.city_id}:${biz.category_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            takenMap[biz.city_id] = (takenMap[biz.city_id] ?? 0) + 1;
          }
        }
      }
    } catch { /* fallback to 10 remaining if query fails */ }
  }

  // Add migrated client spots (city_id is null; city stored as text in migration_meta)
  // Each unique city+category combo in migration_meta = 1 taken slot
  const migratedCounts = await getMigratedCounts(supabase);
  // Build a city name → city id lookup for matching
  const cityNameToId: Record<string, string> = {};
  for (const city of allCities) {
    cityNameToId[city.name.toLowerCase()] = city.id;
  }
  for (const [cityName, categoryMap] of Object.entries(migratedCounts)) {
    const cityId = cityNameToId[cityName.toLowerCase()];
    if (!cityId) continue; // migrated city not in DB yet — skip
    // Each distinct category in this city = 1 slot taken
    const migSlots = Object.keys(categoryMap).length;
    takenMap[cityId] = (takenMap[cityId] ?? 0) + migSlots;
  }

  return allCities.map((city) => {
    const taken = takenMap[city.id] ?? 0;
    const remaining = Math.max(0, MAX_SPOTS_PER_CITY - taken);
    return {
      id: city.id,
      name: city.name,
      state: city.state,
      slug: city.slug,
      isActive: city.is_active,
      launchedAt: city.launched_at ? new Date(city.launched_at) : null,
      foundingEligible: city.founding_eligible ?? false,
      totalSpotsRemaining: city.is_active ? remaining : 0,
      isComingSoon: !city.is_active,
      isFoundingOpen: city.founding_eligible ?? true,
    };
  });
}

// ── Step 2: Categories ────────────────────────────────────────────────────────

export async function getCategoriesForCity(
  cityId: string
): Promise<CategoryWithAvailability[]> {
  const supabase = createServiceClient();

  const { data: allCategories, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error || !allCategories) return [];

  // Count paid orders per category — best-effort, default to 0 if query fails
  let countMap: Record<string, number> = {};
  try {
    const { data: orderCounts } = await supabase
      .from("orders")
      .select("bundle_id, businesses!inner(category_id, city_id)")
      .eq("businesses.city_id", cityId)
      .in("status", ["paid", "active"]);

    if (orderCounts) {
      for (const order of orderCounts) {
        const catId = (order.businesses as any)?.category_id;
        if (catId) countMap[catId] = (countMap[catId] ?? 0) + 1;
      }
    }
  } catch {
    countMap = {};
  }

  // Add migrated clients for this city (matched by city name)
  // countMap keys are category UUIDs; migrated clients store category names.
  // Build a categoryName → categoryId lookup from allCategories.
  const catNameToId: Record<string, string> = {};
  for (const cat of allCategories) {
    catNameToId[cat.name.toLowerCase()] = cat.id;
  }
  try {
    // Look up this city's name so we can match migrated records
    const { data: cityRow } = await supabase
      .from("cities").select("name").eq("id", cityId).single();
    if (cityRow?.name) {
      const migratedCounts = await getMigratedCounts(supabase);
      const cityName = cityRow.name.toLowerCase();
      const catMap = migratedCounts[cityRow.name] ?? migratedCounts[cityName] ?? {};
      for (const [catName, spotTypes] of Object.entries(catMap)) {
        const catId = catNameToId[catName.toLowerCase()];
        if (!catId) continue;
        const total = Object.values(spotTypes).reduce((s, n) => s + n, 0);
        countMap[catId] = (countMap[catId] ?? 0) + total;
      }
    }
  } catch { /* non-critical */ }

  const TOTAL_SPOTS_PER_CATEGORY = 10;

  return allCategories.map((cat) => {
    const taken = countMap[cat.id] ?? 0;
    const remaining = Math.max(0, TOTAL_SPOTS_PER_CATEGORY - taken);
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? null,
      icon: cat.icon ?? null,
      spotsRemaining: remaining,
      isAvailable: remaining > 0,
    };
  });
}

// ── Step 3: Bundles ────────────────────────────────────────────────────────────

export async function getBundlesWithAvailability(
  cityId: string,
  categoryId: string
): Promise<BundleWithAvailability[]> {
  const supabase = createServiceClient();

  // Fetch active bundles (city_id = null means global, available everywhere)
  const { data: rawBundles, error } = await supabase
    .from("bundles")
    .select("*")
    .eq("is_active", true)
    .or(`city_id.is.null,city_id.eq.${cityId}`);

  if (error || !rawBundles || rawBundles.length === 0) return [];

  const bundleIds = rawBundles.map((b) => b.id);

  // Count paid orders per bundle in this city+category — best-effort
  let countMap: Record<string, number> = {};
  try {
    const { data: orderCounts } = await supabase
      .from("orders")
      .select("bundle_id, businesses!inner(city_id, category_id)")
      .eq("businesses.city_id", cityId)
      .eq("businesses.category_id", categoryId)
      .in("bundle_id", bundleIds)
      .in("status", ["paid", "active"]);

    if (orderCounts) {
      for (const order of orderCounts) {
        const bid = order.bundle_id;
        if (bid) countMap[bid] = (countMap[bid] ?? 0) + 1;
      }
    }
  } catch {
    countMap = {};
  }

  // Add migrated clients — match by city name + category name, then by spotType
  try {
    const [cityRow, catRow] = await Promise.all([
      supabase.from("cities").select("name").eq("id", cityId).single(),
      supabase.from("categories").select("name").eq("id", categoryId).single(),
    ]);
    if (cityRow.data?.name && catRow.data?.name) {
      const migratedCounts = await getMigratedCounts(supabase);
      const cityName = cityRow.data.name;
      const catName  = catRow.data.name;
      // Look up the migrated spot-type counts for this city+category
      const spotTypeCounts =
        migratedCounts[cityName]?.[catName] ??
        migratedCounts[cityName.toLowerCase()]?.[catName.toLowerCase()] ??
        {};
      // Map spotType → bundle IDs with matching spotType in their metadata
      for (const bundle of rawBundles) {
        const meta = (bundle.metadata ?? {}) as Record<string, unknown>;
        const bundleSpotType = (meta.spotType as string) ?? "back";
        const migCount = spotTypeCounts[bundleSpotType] ?? 0;
        if (migCount > 0) {
          countMap[bundle.id] = (countMap[bundle.id] ?? 0) + migCount;
        }
      }
    }
  } catch { /* non-critical */ }

  return rawBundles
    .map((bundle) => {
      const meta = (bundle.metadata ?? {}) as Record<string, unknown>;
      const maxSpots = (meta.maxSpots as number) ?? 1;
      const spotsTaken = countMap[bundle.id] ?? 0;
      const spotsRemaining = Math.max(0, maxSpots - spotsTaken);

      return {
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        description: bundle.description ?? null,
        price: String(bundle.price ?? "0"),
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
        standardPriceCents: (bundle.standard_price as number) ?? Math.round(Number(bundle.price) * 150),
        foundingPriceCents: (bundle.founding_price as number) ?? Math.round(Number(bundle.price) * 100),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export async function getCityBySlug(slug: string): Promise<CityWithAvailability | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    state: data.state,
    slug: data.slug,
    isActive: data.is_active,
    launchedAt: data.launched_at ? new Date(data.launched_at) : null,
    foundingEligible: data.founding_eligible ?? false,
    totalSpotsRemaining: data.is_active ? 99 : 0,
    isComingSoon: !data.is_active,
    isFoundingOpen: data.founding_eligible ?? true,
  };
}

export async function getCategoryBySlug(slug: string): Promise<CategoryWithAvailability | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description ?? null,
    icon: data.icon ?? null,
    spotsRemaining: 10,
    isAvailable: true,
  };
}

export async function getBundleById(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("bundles")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data;
}
