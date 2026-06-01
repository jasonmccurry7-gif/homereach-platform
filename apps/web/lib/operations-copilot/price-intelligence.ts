import type {
  IndustryPriceCatalog,
  IndustryPriceItem,
} from "@/lib/operations-copilot/industry-catalog";
import {
  formatFreshnessLabel,
  formatLastUpdatedLabel,
  formatPriceSourceQuality,
  resolvePriceFreshness,
  resolvePriceSourceQuality,
  type PriceFreshness,
  type PriceSourceQuality,
} from "@/lib/operations-copilot/price-confidence";

export type SupplierSourceReadiness = {
  supplierName: string;
  itemCount: number;
  sourceMode:
    | "public_web"
    | "supplier_portal"
    | "quote_request"
    | "invoice_upload"
    | "supplier_api"
    | "edi_cxml";
  priority: "high" | "medium" | "low";
};

export type SupplierPriceSnapshot = {
  id: string;
  sku: string;
  itemName: string;
  category: string;
  supplierName: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  unit: string;
  observedPriceCents: number | null;
  normalizedUnitPriceCents: number | null;
  landedPriceCents: number | null;
  inStock: boolean | null;
  leadTimeDays: number | null;
  capturedAt: Date;
  confidence: string;
  priceBasis: string;
  notes: string | null;
  sourceQuality: PriceSourceQuality;
  sourceQualityLabel: string;
  freshness: PriceFreshness;
  freshnessLabel: string;
  lastUpdatedLabel: string;
};

export type SupplierPriceRow = {
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  suppliers: string[];
  capturedCount: number;
  sourceCount: number;
  bestPriceCents: number | null;
  bestSupplierName: string | null;
  bestSourceQuality: PriceSourceQuality | null;
  bestSourceQualityLabel: string;
  bestFreshnessLabel: string;
  latestCapturedAt: Date | null;
  latestUpdatedLabel: string;
  status: "priced" | "ready" | "needs_source";
};

export type SupplierPriceIntelligence = {
  industryId: string;
  region: string;
  zipCode: string;
  itemCount: number;
  sourceCount: number;
  capturedPriceCount: number;
  verifiedPriceCount: number;
  observedPriceCount: number;
  estimatedPriceCount: number;
  freshPriceCount: number;
  agingPriceCount: number;
  stalePriceCount: number;
  pricedItemCount: number;
  sourceReadiness: SupplierSourceReadiness[];
  rows: SupplierPriceRow[];
  latestSnapshots: SupplierPriceSnapshot[];
  dataNotice: string;
};

export async function buildSupplierPriceIntelligence({
  catalog,
  userId,
  loadSnapshots = true,
}: {
  catalog: IndustryPriceCatalog;
  userId: string;
  loadSnapshots?: boolean;
}): Promise<SupplierPriceIntelligence> {
  const snapshots = loadSnapshots ? await loadPriceSnapshots({ catalog, userId }) : [];
  const bySku = new Map<string, SupplierPriceSnapshot[]>();

  for (const snapshot of snapshots) {
    const group = bySku.get(snapshot.sku) ?? [];
    group.push(snapshot);
    bySku.set(snapshot.sku, group);
  }

  const rows = catalog.items.map((item) => buildPriceRow(item, bySku.get(item.sku) ?? []));
  const sourceReadiness = buildSourceReadiness(catalog);
  const capturedPriceCount = snapshots.filter(
    (snapshot) => snapshot.observedPriceCents !== null
  ).length;
  const verifiedPriceCount = snapshots.filter((snapshot) => snapshot.sourceQuality === "verified").length;
  const observedPriceCount = snapshots.filter((snapshot) => snapshot.sourceQuality === "observed").length;
  const estimatedPriceCount = snapshots.filter((snapshot) => snapshot.sourceQuality === "estimated").length;
  const freshPriceCount = snapshots.filter((snapshot) => snapshot.freshness === "fresh").length;
  const agingPriceCount = snapshots.filter((snapshot) => snapshot.freshness === "aging").length;
  const stalePriceCount = snapshots.filter((snapshot) => snapshot.freshness === "stale").length;

  return {
    industryId: catalog.id,
    region: catalog.defaultRegion,
    zipCode: catalog.defaultZip,
    itemCount: catalog.items.length,
    sourceCount: rows.reduce((sum, row) => sum + row.sourceCount, 0),
    capturedPriceCount,
    verifiedPriceCount,
    observedPriceCount,
    estimatedPriceCount,
    freshPriceCount,
    agingPriceCount,
    stalePriceCount,
    pricedItemCount: rows.filter((row) => row.status === "priced").length,
    sourceReadiness,
    rows,
    latestSnapshots: snapshots.slice(0, 12),
    dataNotice:
      capturedPriceCount > 0
        ? "Showing captured supplier snapshots. Verified means client invoices, receipts, supplier account quotes, API, EDI, cXML, or approved portal data. Observed means public web/search benchmark only. Estimated means planning data."
        : "No captured price snapshots yet. Have the client drop in inventory sheets, receipts, or invoices and HomeReach will standardize them before public/API benchmark search.",
  };
}

async function loadPriceSnapshots({
  catalog,
  userId,
}: {
  catalog: IndustryPriceCatalog;
  userId: string;
}) {
  try {
    const { db, opcopilotPriceSnapshots } = await import("@homereach/db");
    const { and, desc, eq, isNull, or } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(opcopilotPriceSnapshots)
      .where(
        and(
          eq(opcopilotPriceSnapshots.industryId, catalog.id),
          eq(opcopilotPriceSnapshots.zipCode, catalog.defaultZip),
          or(isNull(opcopilotPriceSnapshots.userId), eq(opcopilotPriceSnapshots.userId, userId))
        )
      )
      .orderBy(desc(opcopilotPriceSnapshots.capturedAt))
      .limit(300);

    return rows.map((row): SupplierPriceSnapshot => {
      const sourceQuality = resolvePriceSourceQuality(row.sourceType);
      const freshness = resolvePriceFreshness({
        capturedAt: row.capturedAt,
        sourceQuality,
      });

      return {
        id: row.id,
        sku: row.sku,
        itemName: row.itemName,
        category: row.category,
        supplierName: row.supplierName,
        sourceType: row.sourceType,
        sourceLabel: row.sourceLabel,
        sourceUrl: row.sourceUrl,
        unit: row.unit,
        observedPriceCents: row.observedPriceCents,
        normalizedUnitPriceCents: row.normalizedUnitPriceCents,
        landedPriceCents: row.landedPriceCents,
        inStock: row.inStock,
        leadTimeDays: row.leadTimeDays,
        capturedAt: row.capturedAt,
        confidence: row.confidence,
        priceBasis: row.priceBasis,
        notes: row.notes,
        sourceQuality,
        sourceQualityLabel: formatPriceSourceQuality(sourceQuality),
        freshness,
        freshnessLabel: formatFreshnessLabel(freshness),
        lastUpdatedLabel: formatLastUpdatedLabel(row.capturedAt),
      };
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    if (code !== "42P01") {
      console.warn("Supplier price snapshots unavailable", error);
    }
    return [];
  }
}

function buildPriceRow(
  item: IndustryPriceItem,
  snapshots: SupplierPriceSnapshot[]
): SupplierPriceRow {
  const priced = snapshots.filter((snapshot) => snapshot.observedPriceCents !== null);
  const best = priced.reduce<SupplierPriceSnapshot | null>((currentBest, snapshot) => {
    if (!currentBest) return snapshot;
    const currentPrice = currentBest.landedPriceCents ?? currentBest.observedPriceCents ?? Infinity;
    const nextPrice = snapshot.landedPriceCents ?? snapshot.observedPriceCents ?? Infinity;
    return nextPrice < currentPrice ? snapshot : currentBest;
  }, null);

  return {
    sku: item.sku,
    itemName: item.itemName,
    category: item.category,
    unit: item.unit,
    suppliers: item.suppliers,
    capturedCount: snapshots.length,
    sourceCount: item.suppliers.length,
    bestPriceCents: best?.landedPriceCents ?? best?.observedPriceCents ?? null,
    bestSupplierName: best?.supplierName ?? null,
    bestSourceQuality: best?.sourceQuality ?? null,
    bestSourceQualityLabel: best?.sourceQualityLabel ?? "Not verified",
    bestFreshnessLabel: best?.freshnessLabel ?? "No snapshot",
    latestCapturedAt: snapshots[0]?.capturedAt ?? null,
    latestUpdatedLabel: formatLastUpdatedLabel(snapshots[0]?.capturedAt),
    status: best ? "priced" : item.suppliers.length > 0 ? "ready" : "needs_source",
  };
}

function buildSourceReadiness(catalog: IndustryPriceCatalog): SupplierSourceReadiness[] {
  const supplierCounts = new Map<string, number>();

  for (const item of catalog.items) {
    for (const supplier of item.suppliers) {
      supplierCounts.set(supplier, (supplierCounts.get(supplier) ?? 0) + 1);
    }
  }

  return Array.from(supplierCounts.entries())
    .map(([supplierName, itemCount]) => ({
      supplierName,
      itemCount,
      sourceMode: resolveSourceMode(supplierName),
      priority: resolveSourcePriority(itemCount),
    }))
    .sort((a, b) => b.itemCount - a.itemCount || a.supplierName.localeCompare(b.supplierName));
}

function resolveSourcePriority(
  itemCount: number
): SupplierSourceReadiness["priority"] {
  if (itemCount >= 12) return "high";
  if (itemCount >= 6) return "medium";
  return "low";
}

function resolveSourceMode(
  supplierName: string
): SupplierSourceReadiness["sourceMode"] {
  const normalized = supplierName.toLowerCase();
  if (normalized.includes("amazon") || normalized.includes("grainger") || normalized.includes("walmart")) {
    return "supplier_api";
  }
  if (normalized.includes("sysco") || normalized.includes("us foods") || normalized.includes("gordon")) {
    return "edi_cxml";
  }
  if (normalized.includes("home depot") || normalized.includes("lowe") || normalized.includes("menards")) {
    return "public_web";
  }
  if (normalized.includes("dumpster") || normalized.includes("haul")) {
    return "quote_request";
  }
  if (normalized.includes("invoice")) {
    return "invoice_upload";
  }
  return "supplier_portal";
}
