import { z } from "zod";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  guardSupplifyMutation,
  jsonNoStore,
  sanitizeJsonValue,
} from "@/lib/operations-copilot/governance";
import { industryPriceCatalogs } from "@/lib/operations-copilot/industry-catalog";
import { buildSupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";
import {
  resolvePriceSourceQuality,
  supportedPriceSourceTypes,
} from "@/lib/operations-copilot/price-confidence";

const priceSnapshotSchema = z.object({
  industryId: z.string().trim().min(1).max(48).default("roofing"),
  region: z.string().trim().min(1).max(120).default("Akron / Northeast Ohio"),
  zipCode: z.string().trim().min(3).max(12).default("44309"),
  sku: z.string().trim().min(1).max(120),
  itemName: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(100),
  supplierName: z.string().trim().min(1).max(160),
  sourceType: z
    .enum(supportedPriceSourceTypes)
    .default("public_web"),
  sourceLabel: z.string().trim().max(160).default("Captured price"),
  sourceUrl: z.string().url().or(z.literal("")).optional(),
  unit: z.string().trim().min(1).max(80),
  observedPriceCents: z.number().int().nonnegative().max(50_000_000).optional(),
  normalizedUnitPriceCents: z.number().int().nonnegative().max(50_000_000).optional(),
  landedPriceCents: z.number().int().nonnegative().max(50_000_000).optional(),
  availableQuantity: z.string().trim().max(80).optional(),
  inStock: z.boolean().optional(),
  leadTimeDays: z.number().int().nonnegative().max(365).optional(),
  validUntil: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  priceBasis: z.string().trim().max(200).default("observed shelf price"),
  notes: z.string().trim().max(1_000).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export async function GET() {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Operations Copilot disabled" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const roofingCatalog =
    industryPriceCatalogs.find((catalog) => catalog.id === "roofing") ??
    industryPriceCatalogs[0];
  if (!roofingCatalog) {
    return jsonNoStore({ error: "No supplier catalog configured" }, { status: 500 });
  }

  const intelligence = await buildSupplierPriceIntelligence({
    catalog: roofingCatalog,
    userId: user.id,
  });

  return jsonNoStore({ intelligence });
}

export async function POST(request: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Operations Copilot disabled" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(request, {
    key: "opcopilot_price_snapshot",
    limit: 30,
    userId: user.id,
  });
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = priceSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Invalid price snapshot", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const snapshot = parsed.data;
  const sourceQuality = resolvePriceSourceQuality(snapshot.sourceType);
  const { db, opcopilotPriceSnapshots } = await import("@homereach/db");
  const [created] = await db
    .insert(opcopilotPriceSnapshots)
    .values({
      userId: user.id,
      industryId: snapshot.industryId,
      region: snapshot.region,
      zipCode: snapshot.zipCode,
      sku: snapshot.sku,
      itemName: snapshot.itemName,
      category: snapshot.category,
      supplierName: snapshot.supplierName,
      sourceType: snapshot.sourceType,
      sourceLabel: snapshot.sourceLabel,
      sourceUrl: snapshot.sourceUrl || undefined,
      unit: snapshot.unit,
      observedPriceCents: snapshot.observedPriceCents,
      normalizedUnitPriceCents: snapshot.normalizedUnitPriceCents,
      landedPriceCents: snapshot.landedPriceCents,
      availableQuantity: snapshot.availableQuantity,
      inStock: snapshot.inStock,
      leadTimeDays: snapshot.leadTimeDays,
      validUntil: snapshot.validUntil,
      confidence: snapshot.confidence,
      priceBasis: snapshot.priceBasis,
      notes: snapshot.notes,
      metadata: {
        ...(sanitizeJsonValue(snapshot.metadata) as Record<string, unknown>),
        sourceQuality,
        verifiedForOrdering: sourceQuality === "verified",
      },
    })
    .returning();

  return jsonNoStore({ snapshot: created }, { status: 201 });
}
