// ─────────────────────────────────────────────────────────────────────────────
// PrintPricingProvider — 48HourPrint Hybrid Pricing
//
// Supports: postcards, magnets, yard signs, door hangers
// Pricing modes (in priority order):
//   1. Manual admin override for a specific product+qty
//   2. In-memory cache from a previous live fetch
//   3. Admin-managed fallback pricing table (always available)
//
// Future: replace TODO blocks with real 48HourPrint / API call.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PrintProductType,
  PrintQuantityTier,
  PrintPricingRecord,
  PrintProductSpec,
  PricingSource,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Product Specifications
// ─────────────────────────────────────────────────────────────────────────────

export const PRINT_PRODUCT_SPECS: Record<PrintProductType, PrintProductSpec> = {
  postcard_4x6: {
    type:            "postcard_4x6",
    label:           "Postcard 4×6",
    defaultSize:     "4×6 in",
    defaultMaterial: "100# Gloss Cover",
    defaultFinish:   "Glossy",
    minimumQty:      500,
  },
  postcard_6x9: {
    type:            "postcard_6x9",
    label:           "Postcard 6×9",
    defaultSize:     "6×9 in",
    defaultMaterial: "100# Gloss Cover",
    defaultFinish:   "Glossy",
    minimumQty:      500,
  },
  postcard_6x11: {
    type:            "postcard_6x11",
    label:           "Postcard 6×11",
    defaultSize:     "6×11 in",
    defaultMaterial: "100# Gloss Cover",
    defaultFinish:   "UV Coating",
    minimumQty:      500,
  },
  magnet: {
    type:            "magnet",
    label:           "Refrigerator Magnet",
    defaultSize:     "4×6 in",
    defaultMaterial: "20 mil Magnetic",
    defaultFinish:   "Gloss Laminate",
    minimumQty:      250,
  },
  yard_sign: {
    type:            "yard_sign",
    label:           "Yard Sign",
    defaultSize:     "18×24 in",
    defaultMaterial: "4mm Corrugated Plastic",
    defaultFinish:   "Single-Sided",
    minimumQty:      25,
  },
  door_hanger: {
    type:            "door_hanger",
    label:           "Door Hanger",
    defaultSize:     "3.5×8.5 in",
    defaultMaterial: "100# Gloss Cover",
    defaultFinish:   "Slit Punch",
    minimumQty:      500,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Pricing Table
// (Admin-managed: update these when vendor quotes change)
// Based on 48HourPrint public pricing — Q1 2024
// ─────────────────────────────────────────────────────────────────────────────

export const PRINT_PRICING_FALLBACK: Record<PrintProductType, PrintQuantityTier[]> = {
  postcard_4x6: [
    { minQty: 500,    maxQty: 999,      pricePerPiece: 0.20 },
    { minQty: 1000,   maxQty: 2499,     pricePerPiece: 0.16 },
    { minQty: 2500,   maxQty: 4999,     pricePerPiece: 0.12 },
    { minQty: 5000,   maxQty: 9999,     pricePerPiece: 0.09 },
    { minQty: 10000,  maxQty: 24999,    pricePerPiece: 0.07 },
    { minQty: 25000,  maxQty: Infinity, pricePerPiece: 0.06 },
  ],
  postcard_6x9: [
    { minQty: 500,    maxQty: 999,      pricePerPiece: 0.28 },
    { minQty: 1000,   maxQty: 2499,     pricePerPiece: 0.22 },
    { minQty: 2500,   maxQty: 4999,     pricePerPiece: 0.17 },
    { minQty: 5000,   maxQty: 9999,     pricePerPiece: 0.13 },
    { minQty: 10000,  maxQty: 24999,    pricePerPiece: 0.10 },
    { minQty: 25000,  maxQty: Infinity, pricePerPiece: 0.08 },
  ],
  postcard_6x11: [
    { minQty: 500,    maxQty: 999,      pricePerPiece: 0.36 },
    { minQty: 1000,   maxQty: 2499,     pricePerPiece: 0.28 },
    { minQty: 2500,   maxQty: 4999,     pricePerPiece: 0.22 },
    { minQty: 5000,   maxQty: 9999,     pricePerPiece: 0.16 },
    { minQty: 10000,  maxQty: 24999,    pricePerPiece: 0.12 },
    { minQty: 25000,  maxQty: Infinity, pricePerPiece: 0.10 },
  ],
  magnet: [
    { minQty: 250,    maxQty: 499,      pricePerPiece: 0.85 },
    { minQty: 500,    maxQty: 999,      pricePerPiece: 0.65 },
    { minQty: 1000,   maxQty: 2499,     pricePerPiece: 0.50 },
    { minQty: 2500,   maxQty: 4999,     pricePerPiece: 0.40 },
    { minQty: 5000,   maxQty: Infinity, pricePerPiece: 0.32 },
  ],
  yard_sign: [
    { minQty: 25,     maxQty: 49,       pricePerPiece: 8.50 },
    { minQty: 50,     maxQty: 99,       pricePerPiece: 6.50 },
    { minQty: 100,    maxQty: 249,      pricePerPiece: 5.00 },
    { minQty: 250,    maxQty: 499,      pricePerPiece: 4.00 },
    { minQty: 500,    maxQty: Infinity, pricePerPiece: 3.25 },
  ],
  door_hanger: [
    { minQty: 500,    maxQty: 999,      pricePerPiece: 0.18 },
    { minQty: 1000,   maxQty: 2499,     pricePerPiece: 0.14 },
    { minQty: 2500,   maxQty: 4999,     pricePerPiece: 0.11 },
    { minQty: 5000,   maxQty: 9999,     pricePerPiece: 0.09 },
    { minQty: 10000,  maxQty: Infinity, pricePerPiece: 0.07 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider Class
// ─────────────────────────────────────────────────────────────────────────────

type CacheKey = `${PrintProductType}:${number}`;

export class PrintPricingProvider {
  private static _cache = new Map<CacheKey, PrintPricingRecord>();
  private static _manualOverrides = new Map<PrintProductType, number>();

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Resolve the best available price for a product at a given quantity */
  static async getPrice(
    productType: PrintProductType,
    quantity: number,
    options?: { size?: string; material?: string; finish?: string }
  ): Promise<PrintPricingRecord> {
    const spec = PRINT_PRODUCT_SPECS[productType];

    // 1. Manual admin override (flat rate for this product, all quantities)
    if (this._manualOverrides.has(productType)) {
      return this._buildRecord(productType, quantity, this._manualOverrides.get(productType)!, "manual", options);
    }

    // 2. In-memory cache
    const cacheKey: CacheKey = `${productType}:${quantity}`;
    if (this._cache.has(cacheKey)) {
      return { ...this._cache.get(cacheKey)!, source: "cached" };
    }

    // 3. Live pricing fetch
    //    TODO: Call 48HourPrint pricing API or scrape product page
    //    const live = await fetch48HourPrintPrice(productType, quantity, options);
    //    if (live) {
    //      const record = this._buildRecord(productType, quantity, live.pricePerPiece, "live", options);
    //      this._cache.set(cacheKey, record);
    //      return record;
    //    }

    // 4. Fallback pricing table — always available
    const pricePerPiece = this._lookupFallback(productType, quantity);
    return this._buildRecord(productType, quantity, pricePerPiece, "manual", options);
  }

  /** Synchronous lookup using fallback table only */
  static getPriceSync(productType: PrintProductType, quantity: number): number {
    if (this._manualOverrides.has(productType)) {
      return this._manualOverrides.get(productType)!;
    }
    const cacheKey: CacheKey = `${productType}:${quantity}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey)!.pricePerPiece;
    }
    return this._lookupFallback(productType, quantity);
  }

  // ── Admin Controls ──────────────────────────────────────────────────────────

  /** Override price per piece for a product type (all quantities) */
  static setManualOverride(productType: PrintProductType, pricePerPiece: number): void {
    this._manualOverrides.set(productType, pricePerPiece);
  }

  /** Remove override for a product type */
  static clearManualOverride(productType: PrintProductType): void {
    this._manualOverrides.delete(productType);
  }

  /** Clear all manual overrides */
  static clearAllOverrides(): void {
    this._manualOverrides.clear();
  }

  /** Populate cache from external live fetch result */
  static updateCache(record: PrintPricingRecord): void {
    const key: CacheKey = `${record.productType}:${record.quantity}`;
    this._cache.set(key, { ...record, source: "live", fetchedAt: new Date().toISOString() });
  }

  /** Clear cache for one product or all products */
  static clearCache(productType?: PrintProductType): void {
    if (!productType) {
      this._cache.clear();
      return;
    }
    for (const key of this._cache.keys()) {
      if (key.startsWith(productType)) this._cache.delete(key);
    }
  }

  // ── Introspection ───────────────────────────────────────────────────────────

  /** Get the full fallback tier table for a product (for admin UI display) */
  static getFallbackTable(productType: PrintProductType): PrintQuantityTier[] {
    return PRINT_PRICING_FALLBACK[productType];
  }

  /** Get all product specs */
  static getAllProductSpecs(): PrintProductSpec[] {
    return Object.values(PRINT_PRODUCT_SPECS);
  }

  /** Get source label for a product */
  static getSourceLabel(productType: PrintProductType): { source: string; label: string } {
    if (this._manualOverrides.has(productType)) return { source: "manual", label: "Admin Override" };
    return { source: "manual", label: "Fallback Table" };
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private static _lookupFallback(productType: PrintProductType, quantity: number): number {
    const tiers = PRINT_PRICING_FALLBACK[productType];
    const tier = tiers.find((t) => quantity >= t.minQty && quantity <= t.maxQty);
    // If below minimum, use the lowest tier
    if (!tier) return tiers[0]?.pricePerPiece ?? 0.20;
    return tier.pricePerPiece;
  }

  private static _buildRecord(
    productType: PrintProductType,
    quantity: number,
    pricePerPiece: number,
    source: "live" | "cached" | "manual",
    options?: { size?: string; material?: string; finish?: string }
  ): PrintPricingRecord {
    const spec = PRINT_PRODUCT_SPECS[productType];
    return {
      productType,
      quantity,
      pricePerPiece,
      size:       options?.size     ?? spec.defaultSize,
      material:   options?.material ?? spec.defaultMaterial,
      finish:     options?.finish   ?? spec.defaultFinish,
      vendorName: "48HourPrint",
      source,
      fetchedAt:  new Date().toISOString(),
    };
  }
}
