import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import {
  db,
  opcopilotAiEvents,
  opcopilotBusinessContexts,
  opcopilotInventoryItems,
  opcopilotPriceSnapshots,
} from "@homereach/db";
import { industryPriceCatalogs } from "@/lib/operations-copilot/industry-catalog";
import {
  formatPriceSourceQuality,
  isLiveSupplierFeedSource,
  resolvePriceFreshness,
  resolvePriceSourceQuality,
  type PriceSourceQuality,
} from "@/lib/operations-copilot/price-confidence";
import { getSupplierConnectors } from "@/lib/operations-copilot/supplier-connectors";
import { searchObservedBenchmarks } from "@/lib/operations-copilot/procurement-benchmark-search";

export type PriceIngestionRunResult = {
  ok: boolean;
  mode: "dry_run" | "write";
  businessesChecked: number;
  catalogsChecked: number;
  snapshotsIngested: number;
  verifiedSourcesConnected: number;
  observedSourcesAvailable: number;
  blockers: string[];
  nextActions: string[];
  sourceSummary: PriceSourceSummary[];
};

export type PriceSourceSummary = {
  supplierName: string;
  category: "supplier_api" | "edi_cxml" | "manual_import" | "observed_web";
  quality: PriceSourceQuality;
  connected: boolean;
  envKeys: string[];
  status: string;
};

export function buildPriceSourceSummary(): PriceSourceSummary[] {
  return [
    {
      supplierName: "Amazon Business",
      category: "supplier_api",
      quality: "verified",
      connected: hasEveryEnv(["AMAZON_BUSINESS_API_CLIENT_ID", "AMAZON_BUSINESS_API_CLIENT_SECRET"]),
      envKeys: ["AMAZON_BUSINESS_API_CLIENT_ID", "AMAZON_BUSINESS_API_CLIENT_SECRET"],
      status: "Official API/Punchout-ready. Requires Amazon Business app approval and account authorization.",
    },
    {
      supplierName: "Gordon Food Service",
      category: "edi_cxml",
      quality: "verified",
      connected: hasAnyEnv(["GFS_EDI_832_INBOX", "GFS_CXML_PUNCHOUT_URL", "PROCUREMENT_EDI_SFTP_URL"]),
      envKeys: ["GFS_EDI_832_INBOX", "GFS_CXML_PUNCHOUT_URL", "PROCUREMENT_EDI_SFTP_URL"],
      status: "EDI 832 price catalog or cXML/Punchout feed can produce verified account pricing.",
    },
    {
      supplierName: "US Foods / Sysco",
      category: "edi_cxml",
      quality: "verified",
      connected: hasAnyEnv(["US_FOODS_EDI_INBOX", "SYSCO_EDI_INBOX", "PROCUREMENT_EDI_SFTP_URL"]),
      envKeys: ["US_FOODS_EDI_INBOX", "SYSCO_EDI_INBOX", "PROCUREMENT_EDI_SFTP_URL"],
      status: "Account-specific EDI, portal export, or rep quote feed required.",
    },
    {
      supplierName: "Manual invoice / quote import",
      category: "manual_import",
      quality: "verified",
      connected: true,
      envKeys: [],
      status: "Ready now. Client inventory sheets, receipts, invoices, and supplier quote files are normalized into verified snapshots after automated extraction.",
    },
    {
      supplierName: "Public web/search benchmarks",
      category: "observed_web",
      quality: "observed",
      connected: hasAnyEnv(["PROCUREMENT_WEB_SEARCH_ENDPOINT", "TAVILY_API_KEY", "SERPAPI_API_KEY", "SERP_API"]),
      envKeys: ["PROCUREMENT_WEB_SEARCH_ENDPOINT", "TAVILY_API_KEY", "SERPAPI_API_KEY", "SERP_API"],
      status: "Observed benchmark only. Never treated as verified account pricing or approval to order.",
    },
  ];
}

export async function runDailyPriceIngestion({
  dryRun = false,
}: {
  dryRun?: boolean;
} = {}): Promise<PriceIngestionRunResult> {
  const sourceSummary = buildPriceSourceSummary();
  const verifiedSourcesConnected = sourceSummary.filter(
    (source) => source.quality === "verified" && source.connected && source.category !== "manual_import"
  ).length;
  const observedSourcesAvailable = sourceSummary.filter(
    (source) => source.quality === "observed" && source.connected
  ).length;
  const blockers = sourceSummary
    .filter((source) => !source.connected && source.category !== "manual_import")
    .map((source) => `${source.supplierName}: ${source.envKeys.join(", ")} not configured`);
  const nextActions = [
    "Collect client inventory sheets, receipts, invoices, and supplier quote files through the upload normalizer.",
    "Connect one supplier API, EDI 832 catalog, cXML Punchout, or approved portal export before claiming daily live pricing.",
    "Use public web/search prices only as observed benchmarks until account pricing is verified.",
  ];

  const contexts = await db
    .select()
    .from(opcopilotBusinessContexts)
    .orderBy(desc(opcopilotBusinessContexts.updatedAt))
    .limit(100);

  let snapshotsIngested = 0;
  const catalogsChecked = industryPriceCatalogs.length;

  if (!dryRun) {
    for (const context of contexts) {
      if (observedSourcesAvailable > 0) {
        const inventory = await db
          .select()
          .from(opcopilotInventoryItems)
          .where(
            and(
              eq(opcopilotInventoryItems.userId, context.userId),
              eq(opcopilotInventoryItems.active, true)
            )
          )
          .limit(8);
        const benchmarks = await searchObservedBenchmarks({
          items: inventory.map((item) => ({
            sku: item.sku,
            itemName: item.itemName,
            category: item.category,
            unit: item.unit,
            baselinePriceCents: item.unitCostCents,
          })),
          region: context.serviceGeography || "Akron / Northeast Ohio",
          zipCode:
            context.preferenceMemory?.deliveryProfile?.businessAddress?.match(/\b\d{5}\b/)?.[0] ??
            "44309",
          maxItems: 6,
        });

        if (benchmarks.benchmarks.length > 0) {
          const created = await db
            .insert(opcopilotPriceSnapshots)
            .values(
              benchmarks.benchmarks.map((snapshot) => ({
                userId: context.userId,
                industryId: context.businessType || "general",
                region: context.serviceGeography || "Akron / Northeast Ohio",
                zipCode:
                  context.preferenceMemory?.deliveryProfile?.businessAddress?.match(/\b\d{5}\b/)?.[0] ??
                  "44309",
                sku: snapshot.sku,
                itemName: snapshot.itemName,
                category: snapshot.category,
                supplierName: snapshot.supplierName,
                sourceType: "public_web_search",
                sourceLabel: snapshot.sourceLabel,
                sourceUrl: snapshot.sourceUrl,
                unit: snapshot.unit,
                observedPriceCents: snapshot.observedPriceCents,
                normalizedUnitPriceCents: snapshot.normalizedUnitPriceCents,
                landedPriceCents: snapshot.observedPriceCents,
                capturedAt: new Date(),
                confidence: snapshot.confidence,
                priceBasis: snapshot.priceBasis,
                notes: snapshot.notes,
                metadata: {
                  sourceQuality: "observed",
                  verifiedForOrdering: false,
                  ingestionMethod: "daily_public_benchmark_search",
                  provider: benchmarks.provider,
                },
              }))
            )
            .returning({ id: opcopilotPriceSnapshots.id });
          snapshotsIngested += created.length;
        }
      }

      const staleCount = await countStaleSnapshotsForUser(context.userId);
      await db.insert(opcopilotAiEvents).values({
        userId: context.userId,
        eventType: "procurement_price_ingestion",
        title:
          verifiedSourcesConnected > 0 || observedSourcesAvailable > 0
            ? "Daily supplier price ingestion checked"
            : "Daily supplier price ingestion needs source connection",
        summary:
          verifiedSourcesConnected > 0
            ? "At least one verified supplier feed appears configured. Review snapshots and approve any savings before action."
            : "No verified supplier API, EDI, cXML, or approved portal feed is connected yet. Use client document normalization and public/API benchmark search for savings discovery.",
        urgency: staleCount > 0 ? "medium" : "low",
        confidence: verifiedSourcesConnected > 0 ? "high" : "medium",
        estimatedImpactCents: 0,
        riskScore: verifiedSourcesConnected > 0 ? 35 : 62,
        payload: {
          staleSnapshotCount: staleCount,
          verifiedSourcesConnected,
          observedSourcesAvailable,
          sourceSummary,
          nextActions,
        },
        status: staleCount > 0 || verifiedSourcesConnected === 0 ? "open" : "resolved",
      });
    }
  }

  return {
    ok: true,
    mode: dryRun ? "dry_run" : "write",
    businessesChecked: contexts.length,
    catalogsChecked,
    snapshotsIngested,
    verifiedSourcesConnected,
    observedSourcesAvailable,
    blockers,
    nextActions,
    sourceSummary,
  };
}

export function buildSupplierFreshnessSummary(snapshots: Array<{
  sourceType: string;
  capturedAt: Date | string;
}>) {
  const summary = {
    verified: { total: 0, fresh: 0, stale: 0 },
    observed: { total: 0, fresh: 0, stale: 0 },
    estimated: { total: 0, fresh: 0, stale: 0 },
    liveFeed: { total: 0, fresh: 0, stale: 0 },
  };

  for (const snapshot of snapshots) {
    const quality = resolvePriceSourceQuality(snapshot.sourceType);
    const freshness = resolvePriceFreshness({
      capturedAt: snapshot.capturedAt,
      sourceQuality: quality,
    });
    summary[quality].total += 1;
    if (freshness === "fresh") summary[quality].fresh += 1;
    if (freshness === "stale") summary[quality].stale += 1;
    if (isLiveSupplierFeedSource(snapshot.sourceType)) {
      summary.liveFeed.total += 1;
      if (freshness === "fresh") summary.liveFeed.fresh += 1;
      if (freshness === "stale") summary.liveFeed.stale += 1;
    }
  }

  return summary;
}

export function describeSourceQuality(sourceType: string) {
  const quality = resolvePriceSourceQuality(sourceType);
  return `${formatPriceSourceQuality(quality)} price source`;
}

async function countStaleSnapshotsForUser(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({
      sourceType: opcopilotPriceSnapshots.sourceType,
      capturedAt: opcopilotPriceSnapshots.capturedAt,
    })
    .from(opcopilotPriceSnapshots)
    .where(
      and(
        or(isNull(opcopilotPriceSnapshots.userId), eq(opcopilotPriceSnapshots.userId, userId)),
        gte(opcopilotPriceSnapshots.capturedAt, weekAgo)
      )
    )
    .limit(500);

  const trackedSupplierNames = new Set(getSupplierConnectors().map((connector) => connector.supplierName));
  if (recent.length === 0 && trackedSupplierNames.size > 0) return trackedSupplierNames.size;
  return recent.filter((snapshot) => {
    const quality = resolvePriceSourceQuality(snapshot.sourceType);
    return resolvePriceFreshness({ capturedAt: snapshot.capturedAt, sourceQuality: quality }) === "stale";
  }).length;
}

function hasEveryEnv(keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

function hasAnyEnv(keys: string[]) {
  return keys.some((key) => Boolean(process.env[key]));
}
