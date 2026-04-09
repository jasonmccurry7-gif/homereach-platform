// ─────────────────────────────────────────────────────────────────────────────
// Supabase Spot Repository
//
// Derives spot data from the orders + businesses tables.
// There is no dedicated "spots" table — availability is inferred from
// paid/active order counts vs bundle maxSpots metadata.
// ─────────────────────────────────────────────────────────────────────────────

import type { Spot } from "../../types";
import type { ISpotRepository, UpdateSpotStatusInput, AssignSpotInput } from "../interfaces";
import { db, orders, businesses, bundles, cities as citiesTable, categories as categoriesTable } from "@homereach/db";
import { eq, and, inArray, sql } from "drizzle-orm";

export class SupabaseSpotRepository implements ISpotRepository {

  // ── Read ──────────────────────────────────────────────────────────────────

  async getAll(): Promise<Spot[]> {
    // Pull all paid/active orders with their city + category + bundle info
    const rows = await db
      .select({
        orderId:      orders.id,
        businessId:   businesses.id,
        businessName: businesses.name,
        cityId:       businesses.cityId,
        categoryId:   businesses.categoryId,
        bundleId:     orders.bundleId,
        orderStatus:  orders.status,
        bundleMeta:   bundles.metadata,
        cityName:     citiesTable.name,
        categoryName: categoriesTable.name,
      })
      .from(orders)
      .innerJoin(businesses,        eq(orders.businessId,   businesses.id))
      .leftJoin(bundles,            eq(orders.bundleId,      bundles.id))
      .leftJoin(citiesTable,        eq(businesses.cityId,    citiesTable.id))
      .leftJoin(categoriesTable,    eq(businesses.categoryId, categoriesTable.id))
      .where(inArray(orders.status, ["paid", "active"]));

    return rows.map((r) => rowToSpot(r));
  }

  async getByCity(cityId: string): Promise<Spot[]> {
    const rows = await db
      .select({
        orderId:      orders.id,
        businessId:   businesses.id,
        businessName: businesses.name,
        cityId:       businesses.cityId,
        categoryId:   businesses.categoryId,
        bundleId:     orders.bundleId,
        orderStatus:  orders.status,
        bundleMeta:   bundles.metadata,
        cityName:     citiesTable.name,
        categoryName: categoriesTable.name,
      })
      .from(orders)
      .innerJoin(businesses,     eq(orders.businessId,    businesses.id))
      .leftJoin(bundles,         eq(orders.bundleId,       bundles.id))
      .leftJoin(citiesTable,     eq(businesses.cityId,     citiesTable.id))
      .leftJoin(categoriesTable, eq(businesses.categoryId, categoriesTable.id))
      .where(
        and(
          eq(businesses.cityId, cityId),
          inArray(orders.status, ["paid", "active"])
        )
      );

    return rows.map((r) => rowToSpot(r));
  }

  async getById(spotId: string): Promise<Spot | null> {
    const all = await this.getAll();
    return all.find((s) => s.id === spotId) ?? null;
  }

  async getByCityAndCategory(cityId: string, categoryId: string): Promise<Spot | null> {
    const rows = await db
      .select({
        orderId:      orders.id,
        businessId:   businesses.id,
        businessName: businesses.name,
        cityId:       businesses.cityId,
        categoryId:   businesses.categoryId,
        bundleId:     orders.bundleId,
        orderStatus:  orders.status,
        bundleMeta:   bundles.metadata,
        cityName:     citiesTable.name,
        categoryName: categoriesTable.name,
      })
      .from(orders)
      .innerJoin(businesses,     eq(orders.businessId,    businesses.id))
      .leftJoin(bundles,         eq(orders.bundleId,       bundles.id))
      .leftJoin(citiesTable,     eq(businesses.cityId,     citiesTable.id))
      .leftJoin(categoriesTable, eq(businesses.categoryId, categoriesTable.id))
      .where(
        and(
          eq(businesses.cityId,     cityId),
          eq(businesses.categoryId, categoryId),
          inArray(orders.status, ["paid", "active"])
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    return rowToSpot(rows[0]!);
  }

  // ── Write (admin operations — update order/business status) ───────────────

  async updateStatus(input: UpdateSpotStatusInput): Promise<Spot> {
    // Map spot status → order status
    const orderStatus =
      input.status === "sold"     ? "active" :
      input.status === "reserved" ? "paid"   : "pending";

    await db
      .update(orders)
      .set({ status: orderStatus as "active" | "paid" | "pending", updatedAt: new Date() })
      .where(eq(orders.id, input.spotId));

    const spot = await this.getById(input.spotId);
    if (!spot) throw new Error(`Spot ${input.spotId} not found after update`);
    return spot;
  }

  async assignToBusiness(input: AssignSpotInput): Promise<Spot> {
    await db
      .update(orders)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(orders.id, input.spotId));

    const spot = await this.getById(input.spotId);
    if (!spot) throw new Error(`Spot ${input.spotId} not found after assign`);
    return spot;
  }

  async release(spotId: string): Promise<Spot> {
    await db
      .update(orders)
      .set({ status: "cancelled" as "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, spotId));

    // Return a synthetic "available" spot
    return {
      id:            spotId,
      cityId:        "",
      cityName:      "",
      categoryId:    "",
      categoryName:  "",
      status:        "available",
      businessId:    null,
      businessName:  null,
      reservedUntil: null,
      basePrice:     299,
      isFullCard:    false,
    };
  }
}

// ── Row mapper ────────────────────────────────────────────────────────────────

type Row = {
  orderId:      string;
  businessId:   string;
  businessName: string;
  cityId:       string | null;
  categoryId:   string | null;
  bundleId:     string | null;
  orderStatus:  string;
  bundleMeta:   unknown;
  cityName:     string | null;
  categoryName: string | null;
};

function rowToSpot(r: Row): Spot {
  const meta = (r.bundleMeta ?? {}) as Record<string, unknown>;
  return {
    id:            r.orderId,
    cityId:        r.cityId    ?? "",
    cityName:      r.cityName  ?? r.cityId ?? "",
    categoryId:    r.categoryId    ?? "",
    categoryName:  r.categoryName  ?? r.categoryId ?? "",
    status:        r.orderStatus === "active" ? "sold" : "sold",
    businessId:    r.businessId,
    businessName:  r.businessName,
    reservedUntil: null,
    basePrice:     (meta.basePrice as number) ?? 299,
    isFullCard:    (meta.spotType as string) === "full_card",
  };
}
