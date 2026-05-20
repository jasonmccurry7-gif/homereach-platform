import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import { industryPriceCatalogs } from "@/lib/operations-copilot/industry-catalog";
import { buildSupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";

const priceSnapshotSchema = z.object({
  industryId: z.string().default("roofing"),
  region: z.string().default("Akron / Northeast Ohio"),
  zipCode: z.string().default("44309"),
  sku: z.string().min(1),
  itemName: z.string().min(1),
  category: z.string().min(1),
  supplierName: z.string().min(1),
  sourceType: z
    .enum(["public_web", "supplier_portal", "quote_request", "invoice_upload"])
    .default("public_web"),
  sourceLabel: z.string().default("Captured price"),
  sourceUrl: z.string().url().optional(),
  unit: z.string().min(1),
  observedPriceCents: z.number().int().nonnegative().optional(),
  normalizedUnitPriceCents: z.number().int().nonnegative().optional(),
  landedPriceCents: z.number().int().nonnegative().optional(),
  availableQuantity: z.string().optional(),
  inStock: z.boolean().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  validUntil: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  priceBasis: z.string().default("observed shelf price"),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export async function GET() {
  if (!isOperationsCopilotEnabled()) {
    return NextResponse.json({ error: "Operations Copilot disabled" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roofingCatalog =
    industryPriceCatalogs.find((catalog) => catalog.id === "roofing") ??
    industryPriceCatalogs[0];
  if (!roofingCatalog) {
    return NextResponse.json({ error: "No supplier catalog configured" }, { status: 500 });
  }

  const intelligence = await buildSupplierPriceIntelligence({
    catalog: roofingCatalog,
    userId: user.id,
  });

  return NextResponse.json({ intelligence });
}

export async function POST(request: Request) {
  if (!isOperationsCopilotEnabled()) {
    return NextResponse.json({ error: "Operations Copilot disabled" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = priceSnapshotSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid price snapshot", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const snapshot = parsed.data;
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
      sourceUrl: snapshot.sourceUrl,
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
      metadata: snapshot.metadata,
    })
    .returning();

  return NextResponse.json({ snapshot: created }, { status: 201 });
}
