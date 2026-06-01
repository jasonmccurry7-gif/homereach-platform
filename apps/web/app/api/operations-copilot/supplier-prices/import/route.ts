import { z } from "zod";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  guardSupplifyMutation,
  jsonNoStore,
} from "@/lib/operations-copilot/governance";
import { normalizePriceImport } from "@/lib/operations-copilot/price-import";

const importSchema = z.object({
  industryId: z.string().trim().min(1).max(48).default("roofing"),
  region: z.string().trim().min(1).max(120).default("Akron / Northeast Ohio"),
  zipCode: z.string().trim().min(3).max(12).default("44309"),
  sourceType: z.string().trim().min(1).max(80).default("manual_quote"),
  sourceLabel: z.string().trim().max(160).optional(),
  csvText: z.string().max(750_000).optional(),
  rows: z.array(z.record(z.unknown())).max(500).optional(),
});

export async function POST(request: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Operations Copilot disabled" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(request, {
    key: "opcopilot_price_import",
    limit: 15,
    userId: user.id,
  });
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Invalid price import", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalized = normalizePriceImport(parsed.data);
  if (normalized.accepted.length === 0) {
    return jsonNoStore(
      {
        error: "No valid price rows found",
        rejected: normalized.rejected,
      },
      { status: 400 }
    );
  }

  const { db, opcopilotPriceSnapshots } = await import("@homereach/db");
  const created = await db
    .insert(opcopilotPriceSnapshots)
    .values(
      normalized.accepted.map((snapshot) => ({
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
        capturedAt: snapshot.capturedAt,
        validUntil: snapshot.validUntil,
        confidence: snapshot.confidence,
        priceBasis: snapshot.priceBasis,
        notes: snapshot.notes,
        metadata: snapshot.metadata,
      }))
    )
    .returning();

  return jsonNoStore(
    {
      ok: true,
      inserted: created.length,
      rejected: normalized.rejected,
      snapshots: created,
    },
    { status: 201 }
  );
}
