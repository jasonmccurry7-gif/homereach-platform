import { db, cities, categories, bundles, orders, businesses, spotAssignments } from "@homereach/db";
import { eq, and, inArray, sql, isNull, or } from "drizzle-orm";
import { normalizeName } from "@/lib/spots/deny-list";
import {
  SHARED_POSTCARD_SIZE_LABEL,
  SHARED_POSTCARD_SLOT_SIZE_LABEL,
  SHARED_POSTCARD_TOTAL_SPOTS,
  type SharedPostcardSlot,
  type SharedPostcardSnapshot,
} from "@/lib/spots/shared-postcard";
import { getPostcardDesignUrl } from "@/lib/spots/design-metadata";

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

const OCCUPYING_ORDER_STATUSES: Array<"pending" | "paid" | "active"> = [
  "pending",
  "paid",
  "active",
];
const OCCUPYING_SPOT_STATUSES: Array<"pending" | "active"> = [
  "pending",
  "active",
];
const MIGRATION_META_MARKER = "[migration_meta]";

type OccupiedSlot = Omit<SharedPostcardSlot, "position"> & {
  key: string;
  priority: number;
  spotType?: string | null;
};

function extractMigrationMeta(notes: string | null): Record<string, unknown> | null {
  if (!notes) return null;
  const idx = notes.indexOf(MIGRATION_META_MARKER);
  if (idx < 0) return null;

  try {
    const json = notes.slice(idx + MIGRATION_META_MARKER.length).trim();
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractDesignUrl(notes: string | null): string | null {
  return getPostcardDesignUrl(notes);
}

function firstStringValue(meta: Record<string, unknown> | null, keys: string[]): string {
  if (!meta) return "";

  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function addOccupiedSlot(slots: Map<string, OccupiedSlot>, slot: OccupiedSlot) {
  const existing = slots.get(slot.key);
  if (!existing || slot.priority < existing.priority) {
    slots.set(slot.key, slot);
  }
}

function normalizeBundleFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];

  return Array.from(
    new Set(
      features
        .filter((feature): feature is string => typeof feature === "string" && feature.trim().length > 0)
        .map((feature) => {
          if (/front page placement/i.test(feature) || /back page placement/i.test(feature)) {
            return `${SHARED_POSTCARD_SLOT_SIZE_LABEL} shared postcard ad slot`;
          }
          if (/largest spot on the card/i.test(feature) || /\d+\s*spots?\s+available/i.test(feature)) {
            return `Category-exclusive ${SHARED_POSTCARD_SLOT_SIZE_LABEL} ad slot`;
          }
          return feature.trim();
        })
    )
  );
}

function normalizeBundleDescription(
  description: string | null,
  spotType: BundleWithAvailability["spotType"]
): string | null {
  if (!description) return null;

  if (
    /three spots available/i.test(description) ||
    /six spots available/i.test(description) ||
    /spans the full top half/i.test(description) ||
    /largest placement/i.test(description) ||
    /12\s*[x×]\s*6\.5/i.test(description)
  ) {
    const placement = spotType === "back" ? "Back-side" : "Front-side";
    return `${placement} visibility for one category-exclusive ${SHARED_POSTCARD_SLOT_SIZE_LABEL} city postcard slot. Your design is shown in the live ${SHARED_POSTCARD_SIZE_LABEL} layout and mailed to 2,500+ homeowners.`;
  }

  return description;
}

export async function getSharedPostcardCitySnapshot(
  cityId: string
): Promise<SharedPostcardSnapshot> {
  const [city] = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .where(eq(cities.id, cityId))
    .limit(1);

  const occupied = new Map<string, OccupiedSlot>();

  if (!city) {
    return {
      cityId,
      cityName: "Unknown market",
      totalSpots: SHARED_POSTCARD_TOTAL_SPOTS,
      occupiedSpots: 0,
      availableSpots: SHARED_POSTCARD_TOTAL_SPOTS,
      sizeLabel: SHARED_POSTCARD_SIZE_LABEL,
      slotSizeLabel: SHARED_POSTCARD_SLOT_SIZE_LABEL,
      slots: Array.from({ length: SHARED_POSTCARD_TOTAL_SPOTS }, (_, index) => ({
        position: index + 1,
        status: "available",
        businessName: null,
        categoryId: null,
        categoryName: null,
        categorySlug: null,
        designUrl: null,
        source: "open",
      })),
    };
  }

  const [assignmentRows, orderRows, legacyRows] = await Promise.all([
    db
      .select({
        businessName: businesses.name,
        categoryId: spotAssignments.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        status: spotAssignments.status,
        spotType: spotAssignments.spotType,
        notes: businesses.notes,
      })
      .from(spotAssignments)
      .leftJoin(businesses, eq(spotAssignments.businessId, businesses.id))
      .leftJoin(categories, eq(spotAssignments.categoryId, categories.id))
      .where(
        and(
          eq(spotAssignments.cityId, cityId),
          inArray(spotAssignments.status, OCCUPYING_SPOT_STATUSES)
        )
      ),
    db
      .select({
        businessName: businesses.name,
        categoryId: businesses.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        status: orders.status,
        notes: businesses.notes,
      })
      .from(orders)
      .innerJoin(businesses, eq(orders.businessId, businesses.id))
      .leftJoin(categories, eq(businesses.categoryId, categories.id))
      .where(
        and(
          eq(businesses.cityId, cityId),
          inArray(orders.status, OCCUPYING_ORDER_STATUSES)
        )
      ),
    db
      .select({
        id: businesses.id,
        businessName: businesses.name,
        notes: businesses.notes,
      })
      .from(businesses)
      .where(sql`${businesses.notes} like '%[migration_meta]%'`)
      .limit(500),
  ]);

  for (const row of assignmentRows) {
    const key = row.categoryId ? `category:${row.categoryId}` : null;
    if (!key) continue;
    addOccupiedSlot(occupied, {
      key,
      priority: 1,
      status: row.status === "active" ? "active" : "pending",
      businessName: row.businessName ?? "Reserved advertiser",
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      designUrl: extractDesignUrl(row.notes),
      source: "spot_assignments",
      spotType: row.spotType,
    });
  }

  for (const row of orderRows) {
    const key = row.categoryId ? `category:${row.categoryId}` : null;
    if (!key) continue;
    addOccupiedSlot(occupied, {
      key,
      priority: 2,
      status: row.status === "pending" ? "pending" : "active",
      businessName: row.businessName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      designUrl: extractDesignUrl(row.notes),
      source: "orders",
    });
  }

  const cityKey = normalizeName(city.name);
  for (const row of legacyRows) {
    const meta = extractMigrationMeta(row.notes);
    if (String(meta?.migrationStatus ?? "") !== "legacy_active") continue;
    if (normalizeName(String(meta?.city ?? "")) !== cityKey) continue;

    const categoryName = firstStringValue(meta, ["category", "categoryName", "businessCategory"]);
    const categoryKey = normalizeName(categoryName);
    if (!categoryKey) continue;
    const categoryAlreadyOccupied = [...occupied.values()].some(
      (slot) => normalizeName(slot.categoryName) === categoryKey
    );
    if (categoryAlreadyOccupied) continue;

    addOccupiedSlot(occupied, {
      key: `legacy:${categoryKey}`,
      priority: 3,
      status: "active",
      businessName: row.businessName,
      categoryId: null,
      categoryName,
      categorySlug: null,
      designUrl: extractDesignUrl(row.notes),
      source: "legacy_migration",
    });
  }

  const fullCardSlot = [...occupied.values()].find((slot) => slot.spotType === "full_card");
  if (fullCardSlot) {
    const slots: SharedPostcardSlot[] = Array.from(
      { length: SHARED_POSTCARD_TOTAL_SPOTS },
      (_, index) => ({
        position: index + 1,
        status: fullCardSlot.status,
        businessName: fullCardSlot.businessName,
        categoryId: fullCardSlot.categoryId,
        categoryName: fullCardSlot.categoryName ?? "Full-card exclusivity",
        categorySlug: fullCardSlot.categorySlug,
        designUrl: fullCardSlot.designUrl,
        source: fullCardSlot.source,
      }),
    );

    return {
      cityId: city.id,
      cityName: city.name,
      totalSpots: SHARED_POSTCARD_TOTAL_SPOTS,
      occupiedSpots: SHARED_POSTCARD_TOTAL_SPOTS,
      availableSpots: 0,
      sizeLabel: SHARED_POSTCARD_SIZE_LABEL,
      slotSizeLabel: SHARED_POSTCARD_SLOT_SIZE_LABEL,
      slots,
    };
  }

  const occupiedSlots = [...occupied.values()]
    .sort((a, b) => {
      const statusScore = (value: OccupiedSlot) => (value.status === "active" ? 0 : 1);
      return (
        statusScore(a) - statusScore(b) ||
        (a.categoryName ?? "").localeCompare(b.categoryName ?? "") ||
        (a.businessName ?? "").localeCompare(b.businessName ?? "")
      );
    })
    .slice(0, SHARED_POSTCARD_TOTAL_SPOTS)
    .map<SharedPostcardSlot>((slot, index) => ({
      position: index + 1,
      status: slot.status,
      businessName: slot.businessName,
      categoryId: slot.categoryId,
      categoryName: slot.categoryName,
      categorySlug: slot.categorySlug,
      designUrl: slot.designUrl,
      source: slot.source,
    }));

  const availableSpots = Math.max(0, SHARED_POSTCARD_TOTAL_SPOTS - occupiedSlots.length);
  const openSlots: SharedPostcardSlot[] = Array.from({ length: availableSpots }, (_, index) => ({
    position: occupiedSlots.length + index + 1,
    status: "available",
    businessName: null,
    categoryId: null,
    categoryName: null,
    categorySlug: null,
    designUrl: null,
    source: "open",
  }));

  return {
    cityId: city.id,
    cityName: city.name,
    totalSpots: SHARED_POSTCARD_TOTAL_SPOTS,
    occupiedSpots: occupiedSlots.length,
    availableSpots,
    sizeLabel: SHARED_POSTCARD_SIZE_LABEL,
    slotSizeLabel: SHARED_POSTCARD_SLOT_SIZE_LABEL,
    slots: [...occupiedSlots, ...openSlots],
  };
}

// ── Step 1: Cities ────────────────────────────────────────────────────────────

export async function getActiveCities(): Promise<CityWithAvailability[]> {
  const allCities = await db
    .select()
    .from(cities)
    .orderBy(cities.name);

  // Calculate total spots remaining from the canonical 12-slot postcard layout.
  const cityResults: CityWithAvailability[] = allCities.map((city) => ({
    ...city,
    totalSpotsRemaining: city.isActive ? SHARED_POSTCARD_TOTAL_SPOTS : 0,
    isComingSoon: !city.isActive,
  }));

  const activeCityIds = allCities
    .filter((c) => c.isActive)
    .map((c) => c.id);

  if (activeCityIds.length === 0) return cityResults;

  const snapshots = await Promise.all(
    activeCityIds.map((id) => getSharedPostcardCitySnapshot(id))
  );
  const availabilityMap = Object.fromEntries(
    snapshots.map((snapshot) => [snapshot.cityId, snapshot.availableSpots])
  );

  return cityResults.map((city) => ({
    ...city,
    totalSpotsRemaining: city.isActive
      ? availabilityMap[city.id] ?? SHARED_POSTCARD_TOTAL_SPOTS
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

  const snapshot = await getSharedPostcardCitySnapshot(cityId);
  const occupiedCategoryIds = new Set(
    snapshot.slots
      .filter((slot) => slot.status !== "available" && slot.categoryId)
      .map((slot) => slot.categoryId!)
  );
  const occupiedCategoryNames = new Set(
    snapshot.slots
      .filter((slot) => slot.status !== "available" && slot.categoryName)
      .map((slot) => normalizeName(slot.categoryName))
  );
  const cityHasOpenSpot = snapshot.availableSpots > 0;

  return allCategories.map((cat) => {
    const categoryTaken =
      occupiedCategoryIds.has(cat.id) ||
      occupiedCategoryNames.has(normalizeName(cat.name));
    const remaining = cityHasOpenSpot && !categoryTaken ? 1 : 0;
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

  const [snapshot, category] = await Promise.all([
    getSharedPostcardCitySnapshot(cityId),
    db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);
  const categoryNameKey = normalizeName(category?.name);
  const categoryTaken = snapshot.slots.some(
    (slot) =>
      slot.status !== "available" &&
      (slot.categoryId === categoryId ||
        (categoryNameKey.length > 0 && normalizeName(slot.categoryName) === categoryNameKey))
  );
  const hasInventory = snapshot.availableSpots > 0 && !categoryTaken;

  return availableBundles
    .map((bundle) => {
      const meta = (bundle.metadata ?? {}) as Record<string, unknown>;
      const maxSpots = 1;
      const spotsTaken = hasInventory ? 0 : 1;
      const spotsRemaining = Math.max(0, maxSpots - spotsTaken);
      const spotType = (meta.spotType as "anchor" | "front" | "back") ?? "back";

      return {
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        description: normalizeBundleDescription(bundle.description, spotType),
        price: bundle.price,
        spotType,
        maxSpots,
        spotsTaken,
        spotsRemaining,
        isSoldOut: spotsRemaining === 0,
        features: normalizeBundleFeatures(meta.features),
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
