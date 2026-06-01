import { sql } from "drizzle-orm";
import {
  db,
  opcopilotAiEvents,
  opcopilotInventoryItems,
  opcopilotInvoiceAudits,
  opcopilotPriceSnapshots,
  opcopilotSavingsRecommendations,
  opcopilotSuppliers,
} from "@homereach/db";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  guardSupplifyMutation,
  jsonNoStore,
  sanitizeText,
} from "@/lib/operations-copilot/governance";
import {
  searchObservedBenchmarks,
  type BenchmarkSearchItem,
} from "@/lib/operations-copilot/procurement-benchmark-search";
import {
  normalizeProcurementDocuments,
  type NormalizedProcurementLine,
  type ProcurementDocumentType,
  type UploadedProcurementFile,
} from "@/lib/operations-copilot/procurement-document-normalizer";
import {
  syncProcurementInvoiceAuditLedger,
  syncProcurementSavingsLedger,
} from "@/lib/approvals/procurement-ledger";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 8;
const MAX_TEXT_CHARS = 100_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Operations Copilot disabled" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(request, {
    key: "opcopilot_document_import",
    limit: 10,
    userId: user.id,
    windowMs: 10 * 60_000,
  });
  if (guard) return guard;

  const parsed = await readRequest(request);
  if ("error" in parsed) {
    return jsonNoStore({ error: parsed.error }, { status: parsed.status });
  }

  const normalized = await normalizeProcurementDocuments({
    documentType: parsed.documentType,
    files: parsed.files,
    text: parsed.text,
  });

  if (normalized.lines.length === 0) {
    return jsonNoStore(
      {
        error: "No spend, receipt, or invoice lines could be normalized.",
        rejected: normalized.rejected,
        warnings: normalized.warnings,
      },
      { status: 400 }
    );
  }

  const supplierMap = await upsertSuppliers(user.id, normalized.lines);
  const inventoryResult = await upsertInventory(user.id, normalized.lines, parsed.documentType);
  const invoiceSnapshots = await insertInvoiceSnapshots({
    userId: user.id,
    industryId: parsed.industryId,
    region: parsed.region,
    zipCode: parsed.zipCode,
    documentType: parsed.documentType,
    lines: normalized.lines,
  });

  const benchmarkSearch =
    parsed.runPublicBenchmark === false
      ? {
          provider: "none" as const,
          searched: 0,
          benchmarks: [],
          warnings: ["Public benchmark search was disabled for this import."],
        }
      : await searchObservedBenchmarks({
          items: toBenchmarkItems(normalized.lines),
          region: parsed.region,
          zipCode: parsed.zipCode,
          maxItems: 12,
        });

  const benchmarkSnapshots =
    benchmarkSearch.benchmarks.length > 0
      ? await db
          .insert(opcopilotPriceSnapshots)
          .values(
            benchmarkSearch.benchmarks.map((snapshot) => ({
              userId: user.id,
              industryId: parsed.industryId,
              region: parsed.region,
              zipCode: parsed.zipCode,
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
                ingestionMethod: "public_benchmark_search",
                provider: benchmarkSearch.provider,
              },
            }))
          )
          .returning()
      : [];

  const savings = await createSavingsRecommendations({
    userId: user.id,
    lines: normalized.lines,
    benchmarkBySku: new Map(
      benchmarkSearch.benchmarks.map((benchmark) => [benchmark.sku, benchmark])
    ),
  });

  const invoiceAudits = await createInvoiceAuditRecords({
    userId: user.id,
    supplierMap,
    lines: normalized.lines,
    benchmarkBySku: new Map(
      benchmarkSearch.benchmarks.map((benchmark) => [benchmark.sku, benchmark])
    ),
  });

  for (const recommendation of savings) {
    const ledgerResult = await syncProcurementSavingsLedger(
      {
        id: recommendation.id,
        userId: recommendation.userId,
        title: recommendation.title,
        summary: recommendation.summary,
        category: recommendation.category,
        projectedMonthlySavingsCents: recommendation.projectedMonthlySavingsCents,
        projectedAnnualSavingsCents: recommendation.projectedAnnualSavingsCents,
        difficulty: recommendation.difficulty,
        operationalImpact: recommendation.operationalImpact,
        confidence: recommendation.confidence,
        status: recommendation.status,
        approvalRequired: recommendation.approvalRequired,
        relatedSupplierId: recommendation.relatedSupplierId,
        relatedInventoryItemId: recommendation.relatedInventoryItemId,
        recommendationPayload: recommendation.recommendationPayload,
        auditLog: recommendation.auditLog,
        createdAt: recommendation.createdAt,
        updatedAt: recommendation.updatedAt,
      },
      {
        actorId: user.id,
        actorLabel: "procurement_document_import",
        eventType: "procurement_savings_created",
      },
    );
    if (!ledgerResult.ok && ledgerResult.error) {
      console.warn("[approval-ledger] procurement savings sync skipped:", ledgerResult.error);
    }
  }

  for (const invoiceAudit of invoiceAudits) {
    const ledgerResult = await syncProcurementInvoiceAuditLedger(
      {
        id: invoiceAudit.id,
        userId: invoiceAudit.userId,
        supplierId: invoiceAudit.supplierId,
        deliveryId: invoiceAudit.deliveryId,
        invoiceReference: invoiceAudit.invoiceReference,
        status: invoiceAudit.status,
        invoiceTotalCents: invoiceAudit.invoiceTotalCents,
        expectedTotalCents: invoiceAudit.expectedTotalCents,
        varianceCents: invoiceAudit.varianceCents,
        issueType: invoiceAudit.issueType,
        issueSummary: invoiceAudit.issueSummary,
        recommendedAction: invoiceAudit.recommendedAction,
        auditLog: invoiceAudit.auditLog,
        createdAt: invoiceAudit.createdAt,
        updatedAt: invoiceAudit.updatedAt,
      },
      {
        actorId: user.id,
        actorLabel: "procurement_document_import",
        eventType: "procurement_invoice_audit_created",
      },
    );
    if (!ledgerResult.ok && ledgerResult.error) {
      console.warn("[approval-ledger] procurement invoice audit sync skipped:", ledgerResult.error);
    }
  }

  await db.insert(opcopilotAiEvents).values({
    userId: user.id,
    eventType: "procurement_document_import",
    title: "Procurement documents normalized",
    summary: `${normalized.lines.length} line items standardized from ${parsed.files.length || (parsed.text ? 1 : 0)} source${parsed.files.length === 1 ? "" : "s"}. ${benchmarkSnapshots.length} observed benchmark${benchmarkSnapshots.length === 1 ? "" : "s"} captured.`,
    urgency: savings.length > 0 ? "medium" : "low",
    confidence: normalized.warnings.length > 0 ? "medium" : "high",
    estimatedImpactCents: savings.reduce(
      (sum, recommendation) => sum + recommendation.projectedAnnualSavingsCents,
      0
    ),
    riskScore: benchmarkSnapshots.length > 0 ? 35 : 50,
    payload: {
      documentType: parsed.documentType,
      sourceSummaries: normalized.sourceSummaries,
      warnings: [...normalized.warnings, ...benchmarkSearch.warnings],
      recommendedAction:
        savings.length > 0
          ? "Review observed savings opportunities before approving any vendor change."
          : "Keep collecting invoices and supplier benchmark signals.",
    },
  });

  return jsonNoStore(
    {
      ok: true,
      documentType: parsed.documentType,
      standardizedRows: normalized.lines,
      standardizedCsv: normalized.standardizedCsv,
      inserted: {
        inventoryItems: inventoryResult.upserted,
        invoicePriceSnapshots: invoiceSnapshots.length,
        observedBenchmarks: benchmarkSnapshots.length,
        savingsRecommendations: savings.length,
        invoiceAudits: invoiceAudits.length,
      },
      benchmarkSearch,
      rejected: normalized.rejected,
      warnings: [...normalized.warnings, ...benchmarkSearch.warnings],
    },
    { status: 201 }
  );
}

async function readRequest(request: Request): Promise<
  | {
      documentType: ProcurementDocumentType;
      industryId: string;
      region: string;
      zipCode: string;
      runPublicBenchmark: boolean;
      text?: string;
      files: UploadedProcurementFile[];
    }
  | { error: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text : undefined;
    if (text && text.length > MAX_TEXT_CHARS) {
      return { error: "Pasted text is too large for one import.", status: 413 };
    }
    if (!text?.trim()) {
      return { error: "Add pasted invoice/spend text or upload a file.", status: 400 };
    }
    return {
      documentType: normalizeDocumentType(body.documentType),
      industryId: stringOr(body.industryId, "general", 48),
      region: stringOr(body.region, "Akron / Northeast Ohio", 120),
      zipCode: stringOr(body.zipCode, "44309", 12),
      runPublicBenchmark: body.runPublicBenchmark !== false,
      text,
      files: [],
    };
  }

  const form = await request.formData();
  const files: UploadedProcurementFile[] = [];
  let totalBytes = 0;
  for (const value of form.getAll("files").concat(form.getAll("file"))) {
    if (!(value instanceof File)) continue;
    if (files.length >= MAX_FILES) {
      return { error: `Upload no more than ${MAX_FILES} files at a time.`, status: 413 };
    }
    if (value.size > MAX_FILE_BYTES) {
      return { error: `${value.name} is larger than 20MB.`, status: 413 };
    }
    totalBytes += value.size;
    if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      return { error: "Uploaded files are larger than the 40MB import limit.", status: 413 };
    }
    files.push({
      fileName: sanitizeFileName(value.name || "upload"),
      mediaType: value.type || guessMediaType(value.name),
      buffer: Buffer.from(await value.arrayBuffer()),
    });
  }

  const text = form.get("text");
  if (typeof text === "string" && text.length > MAX_TEXT_CHARS) {
    return { error: "Pasted text is too large for one import.", status: 413 };
  }
  if (files.length === 0 && (typeof text !== "string" || !text.trim())) {
    return { error: "Add pasted invoice/spend text or upload a file.", status: 400 };
  }

  return {
    documentType: normalizeDocumentType(form.get("documentType")),
    industryId: stringOr(form.get("industryId"), "general", 48),
    region: stringOr(form.get("region"), "Akron / Northeast Ohio", 120),
    zipCode: stringOr(form.get("zipCode"), "44309", 12),
    runPublicBenchmark: form.get("runPublicBenchmark") !== "false",
    text: typeof text === "string" ? text : undefined,
    files,
  };
}

async function upsertSuppliers(userId: string, lines: NormalizedProcurementLine[]) {
  const supplierNames = Array.from(
    new Set(lines.map((line) => line.supplierName).filter(Boolean) as string[])
  );
  if (supplierNames.length === 0) return new Map<string, string>();

  const suppliers = await db
    .insert(opcopilotSuppliers)
    .values(
      supplierNames.map((supplierName) => ({
        userId,
        supplierName,
        categoryCoverage: Array.from(
          new Set(
            lines
              .filter((line) => line.supplierName === supplierName)
              .map((line) => line.category)
          )
        ),
        active: true,
      }))
    )
    .onConflictDoUpdate({
      target: [opcopilotSuppliers.userId, opcopilotSuppliers.supplierName],
      set: {
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  return new Map(suppliers.map((supplier) => [supplier.supplierName, supplier.id]));
}

async function upsertInventory(
  userId: string,
  lines: NormalizedProcurementLine[],
  documentType: ProcurementDocumentType
) {
  const inventoryLines = lines.filter((line) => line.itemName && line.sku);
  if (inventoryLines.length === 0) return { upserted: 0 };

  const upserted = await db
    .insert(opcopilotInventoryItems)
    .values(
      inventoryLines.map((line) => ({
        userId,
        sku: line.sku,
        itemName: line.itemName,
        category: line.category,
        unit: line.unit,
        onHandQuantity: String(line.onHandQuantity ?? 0),
        reorderPointQuantity: String(line.reorderPointQuantity ?? 0),
        targetStockQuantity: String(line.targetStockQuantity ?? 0),
        averageDailyUse: String(line.averageDailyUse ?? 0),
        unitCostCents: line.unitPriceCents ?? 0,
        lastPurchasedAt: line.purchasedAt,
        active: true,
      }))
    )
    .onConflictDoUpdate({
      target: [opcopilotInventoryItems.userId, opcopilotInventoryItems.sku],
      set: {
        itemName: sql`excluded.item_name`,
        category: sql`excluded.category`,
        unit: sql`excluded.unit`,
        onHandQuantity: sql`excluded.on_hand_quantity`,
        reorderPointQuantity: sql`excluded.reorder_point_quantity`,
        targetStockQuantity: sql`excluded.target_stock_quantity`,
        averageDailyUse: sql`excluded.average_daily_use`,
        unitCostCents: sql`excluded.unit_cost_cents`,
        lastPurchasedAt: sql`excluded.last_purchased_at`,
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    upserted: upserted.length,
    documentType,
  };
}

async function insertInvoiceSnapshots({
  userId,
  industryId,
  region,
  zipCode,
  documentType,
  lines,
}: {
  userId: string;
  industryId: string;
  region: string;
  zipCode: string;
  documentType: ProcurementDocumentType;
  lines: NormalizedProcurementLine[];
}) {
  const invoiceLines = lines.filter((line) => line.unitPriceCents || line.lineTotalCents);
  if (invoiceLines.length === 0) return [];

  return db
    .insert(opcopilotPriceSnapshots)
    .values(
      invoiceLines.map((line) => ({
        userId,
        industryId,
        region,
        zipCode,
        sku: line.sku,
        itemName: line.itemName,
        category: line.category,
        supplierName: line.supplierName || "Uploaded invoice",
        sourceType: "invoice_upload",
        sourceLabel:
          documentType === "receipt"
            ? `Uploaded receipt${line.sourceFileName ? `: ${line.sourceFileName}` : ""}`
            : `Uploaded invoice${line.sourceFileName ? `: ${line.sourceFileName}` : ""}`,
        unit: line.unit,
        observedPriceCents: line.unitPriceCents ?? line.lineTotalCents,
        normalizedUnitPriceCents: line.unitPriceCents ?? line.lineTotalCents,
        landedPriceCents: line.unitPriceCents ?? line.lineTotalCents,
        capturedAt: line.purchasedAt ? new Date(line.purchasedAt) : new Date(),
        confidence: line.confidence,
        priceBasis: "verified client invoice or receipt price",
        notes: line.notes,
        metadata: {
          sourceQuality: "verified",
          verifiedForOrdering: true,
          ingestionMethod: documentType,
          quantity: line.quantity,
          lineTotalCents: line.lineTotalCents,
          invoiceReference: line.invoiceReference,
        },
      }))
    )
    .returning();
}

async function createSavingsRecommendations({
  userId,
  lines,
  benchmarkBySku,
}: {
  userId: string;
  lines: NormalizedProcurementLine[];
  benchmarkBySku: Map<string, { observedPriceCents: number; supplierName: string; sourceUrl?: string }>;
}) {
  const recommendations = lines.flatMap((line) => {
    const benchmark = benchmarkBySku.get(line.sku);
    const current = line.unitPriceCents;
    if (!benchmark || !current || benchmark.observedPriceCents >= current * 0.97) return [];
    const quantity = Math.max(1, Math.round(line.quantity ?? line.averageDailyUse ?? 1));
    const monthlySavingsCents = Math.max(0, (current - benchmark.observedPriceCents) * quantity);
    if (monthlySavingsCents < 100) return [];
    return [
      {
        userId,
        source: "invoice_vs_observed_benchmark",
        title: `Review savings on ${line.itemName}`,
        summary: `${benchmark.supplierName} shows an observed benchmark below the uploaded invoice price. Verify package size and delivery cost before approving any switch.`,
        category: line.category,
        projectedMonthlySavingsCents: monthlySavingsCents,
        projectedAnnualSavingsCents: monthlySavingsCents * 12,
        difficulty: "easy",
        operationalImpact: "low",
        confidence: "medium",
        status: "pending_approval",
        approvalRequired: true,
        recommendationPayload: {
          sku: line.sku,
          itemName: line.itemName,
          currentInvoicePriceCents: current,
          observedBenchmarkPriceCents: benchmark.observedPriceCents,
          benchmarkSupplier: benchmark.supplierName,
          sourceUrl: benchmark.sourceUrl,
          verificationRequired: true,
        },
        auditLog: [
          {
            at: new Date().toISOString(),
            actor: "procurement_benchmark_engine",
            event: "savings_recommendation_created_from_invoice_benchmark",
          },
        ],
      },
    ];
  });

  if (recommendations.length === 0) return [];
  return db.insert(opcopilotSavingsRecommendations).values(recommendations).returning();
}

async function createInvoiceAuditRecords({
  userId,
  supplierMap,
  lines,
  benchmarkBySku,
}: {
  userId: string;
  supplierMap: Map<string, string>;
  lines: NormalizedProcurementLine[];
  benchmarkBySku: Map<string, { observedPriceCents: number; supplierName: string }>;
}) {
  const invoiceGroups = new Map<string, NormalizedProcurementLine[]>();
  for (const line of lines) {
    if (!line.invoiceReference && !line.sourceFileName) continue;
    const key = `${line.supplierName ?? "Unknown supplier"}|${line.invoiceReference ?? line.sourceFileName}`;
    invoiceGroups.set(key, [...(invoiceGroups.get(key) ?? []), line]);
  }

  const values = Array.from(invoiceGroups.entries()).flatMap(([key, group]) => {
    const [supplierName, reference] = key.split("|");
    const invoiceTotalCents = group.reduce(
      (sum, line) =>
        sum +
        (line.lineTotalCents ??
          (line.unitPriceCents && line.quantity ? line.unitPriceCents * line.quantity : 0)),
      0
    );
    const expectedTotalCents = group.reduce((sum, line) => {
      const benchmark = benchmarkBySku.get(line.sku);
      const qty = Math.max(1, Math.round(line.quantity ?? 1));
      return sum + (benchmark?.observedPriceCents ?? line.unitPriceCents ?? 0) * qty;
    }, 0);
    if (invoiceTotalCents <= 0 || expectedTotalCents <= 0) return [];
    const varianceCents = invoiceTotalCents - expectedTotalCents;
    return [
      {
        userId,
        supplierId: supplierName ? supplierMap.get(supplierName) : undefined,
        invoiceReference: reference,
        status: varianceCents > 0 ? "needs_review" : "resolved",
        invoiceTotalCents,
        expectedTotalCents,
        varianceCents,
        issueType: varianceCents > 0 ? "benchmark_variance" : "price_check",
        issueSummary:
          varianceCents > 0
            ? "Uploaded invoice appears above observed benchmark pricing on one or more items."
            : "Uploaded invoice is at or below currently observed benchmark pricing.",
        recommendedAction:
          varianceCents > 0
            ? "Review package sizes, delivery fees, and vendor terms before approving a savings action."
            : "Keep this invoice as a verified baseline for future price monitoring.",
        auditLog: [
          {
            at: new Date().toISOString(),
            actor: "procurement_benchmark_engine",
            event: "invoice_audit_created",
          },
        ],
      },
    ];
  });

  if (values.length === 0) return [];
  return db.insert(opcopilotInvoiceAudits).values(values).returning();
}

function toBenchmarkItems(lines: NormalizedProcurementLine[]): BenchmarkSearchItem[] {
  return lines.map((line) => ({
    sku: line.sku,
    itemName: line.itemName,
    category: line.category,
    unit: line.unit,
    baselinePriceCents: line.unitPriceCents,
    supplierName: line.supplierName,
  }));
}

function normalizeDocumentType(value: unknown): ProcurementDocumentType {
  if (
    value === "inventory_sheet" ||
    value === "invoice" ||
    value === "receipt" ||
    value === "purchase_history" ||
    value === "mixed"
  ) {
    return value;
  }
  return "mixed";
}

function stringOr(value: unknown, fallback: string, maxLength = 120) {
  return sanitizeText(value, fallback, maxLength);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_. -]/g, "_").slice(0, 140) || "upload";
}

function guessMediaType(fileName: string) {
  if (/\.csv$/i.test(fileName)) return "text/csv";
  if (/\.xlsx$/i.test(fileName)) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (/\.xls$/i.test(fileName)) return "application/vnd.ms-excel";
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.jpe?g$/i.test(fileName)) return "image/jpeg";
  return "application/octet-stream";
}
