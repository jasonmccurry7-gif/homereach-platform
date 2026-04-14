import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Query Helpers
// Server-side only. Used in Server Components for each funnel step.
// Uses Supabase JS client (HTTP) — reliable in Vercel serverless.
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
  foundingEligible: boolean;
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
  const supabase = createServiceClient();

  const { data: allCities, error } = await supabase
    .from("cities")
    .select("*")
    .order("name");

  if (error || !allCities) return [];

  return allCities.map((city) => ({
    id: city.id,
    name: city.name,
    state: city.state,
    slug: city.slug,
    isActive: city.is_active,
    launchedAt: city.launched_at ? new Date(city.launched_at) : null,
    foundingEligible: city.founding_eligible ?? false,
    totalSpotsRemaining: city.is_active ? 99 : 0,
    isComingSoon: !city.is_active,
  }));
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
