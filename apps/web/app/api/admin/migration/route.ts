// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/migration
//
// Persists a migrated/legacy client record to the businesses table.
// GET  /api/admin/migration — returns all businesses with status active/pending
//      that were created by admin (no ownerId from Stripe checkout).
//
// MigratedClient data maps to:
//   businesses table (name, phone, email, cityId, categoryId, status, notes)
//   + a metadata JSON note storing contractStart, remainingMonths, monthlyPrice,
//     spotType, migrationStatus, migratedBy, billingPrevented flags.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, businesses } from "@homereach/db";
import { eq, isNull, or } from "drizzle-orm";

const MigrationSchema = z.object({
  businessName:    z.string().min(1),
  contactName:     z.string().optional(),
  phone:           z.string().optional(),
  email:           z.string().email().optional(),
  cityId:          z.string().optional(),
  city:            z.string().optional(),
  categoryId:      z.string().optional(),
  category:        z.string().optional(),
  spotType:        z.enum(["front", "back", "anchor", "full_card"]).default("front"),
  monthlyPrice:    z.number().min(0).default(299),
  contractStart:   z.string().optional(),
  remainingMonths: z.number().min(0).default(12),
  migrationStatus: z.enum(["legacy_active", "legacy_pending", "new_system"]).default("legacy_active"),
  notes:           z.string().optional(),
  migratedBy:      z.string().default("admin"),
});

// ── POST — create migrated client ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = MigrationSchema.parse(body);

    // Build contract end date from contractStart + remainingMonths
    const contractStart = data.contractStart
      ? new Date(data.contractStart)
      : new Date();
    const contractEnd = new Date(contractStart);
    contractEnd.setMonth(contractEnd.getMonth() + data.remainingMonths);

    // Pack all migration metadata into the notes field as JSON
    // (no dedicated migration table — businesses table is the source of truth)
    const metaNotes = JSON.stringify({
      contactName:     data.contactName ?? null,
      spotType:        data.spotType,
      monthlyPrice:    data.monthlyPrice,
      contractStart:   contractStart.toISOString().split("T")[0],
      contractEnd:     contractEnd.toISOString().split("T")[0],
      remainingMonths: data.remainingMonths,
      migrationStatus: data.migrationStatus,
      migratedBy:      data.migratedBy,
      migratedAt:      new Date().toISOString(),
      billingPrevented: data.migrationStatus !== "new_system",
      appearsInDashboard: data.migrationStatus !== "legacy_pending",
      city:            data.city ?? null,
      category:        data.category ?? null,
    });

    const adminNote = data.notes
      ? `${data.notes}\n\n[migration_meta]${metaNotes}`
      : `[migration_meta]${metaNotes}`;

    const [inserted] = await db
      .insert(businesses)
      .values({
        // ownerId is required (NOT NULL) — use a sentinel system user UUID.
        // The migration admin should set this to a real admin user ID in Supabase.
        // TODO: derive from session when admin auth is fully wired.
        ownerId:    process.env.ADMIN_SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000001",
        name:       data.businessName,
        phone:      data.phone ?? null,
        email:      data.email ?? null,
        cityId:     data.cityId ?? null,
        categoryId: data.categoryId ?? null,
        status:     data.migrationStatus === "legacy_pending" ? "pending" : "active",
        notes:      adminNote,
      })
      .returning({ id: businesses.id, name: businesses.name });

    return NextResponse.json({ success: true, id: inserted!.id, name: inserted!.name });
  } catch (err) {
    console.error("[POST /api/admin/migration]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save migration record" }, { status: 500 });
  }
}

// ── GET — load all migrated clients ───────────────────────────────────────────

export async function GET() {
  try {
    // Return businesses whose notes contain the migration_meta sentinel
    const rows = await db
      .select({
        id:         businesses.id,
        name:       businesses.name,
        phone:      businesses.phone,
        email:      businesses.email,
        cityId:     businesses.cityId,
        categoryId: businesses.categoryId,
        status:     businesses.status,
        notes:      businesses.notes,
        createdAt:  businesses.createdAt,
      })
      .from(businesses)
      .where(
        or(
          eq(businesses.ownerId, process.env.ADMIN_SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000001"),
          isNull(businesses.notes)
        )
      )
      .orderBy(businesses.createdAt);

    // Parse migration metadata from notes field
    const clients = rows
      .filter((r) => r.notes?.includes("[migration_meta]"))
      .map((r) => {
        let meta: Record<string, unknown> = {};
        try {
          const metaStr = r.notes!.split("[migration_meta]")[1];
          meta = JSON.parse(metaStr ?? "{}");
        } catch { /* ignore parse errors */ }

        const contractStart  = (meta.contractStart  as string) ?? new Date().toISOString().split("T")[0];
        const contractEnd    = (meta.contractEnd    as string) ?? contractStart;
        const remaining      = (meta.remainingMonths as number) ?? 0;
        const endDate        = new Date(contractEnd);
        const now            = new Date();
        const msLeft         = endDate.getTime() - now.getTime();
        const daysLeft       = Math.max(0, Math.ceil(msLeft / 86400000));
        const nearingRenewal = daysLeft <= 60;

        return {
          id:              r.id,
          businessName:    r.name,
          contactName:     (meta.contactName as string) ?? "",
          phone:           r.phone ?? "",
          email:           r.email ?? "",
          cityId:          r.cityId ?? "",
          city:            (meta.city as string) ?? "",
          categoryId:      r.categoryId ?? "",
          category:        (meta.category as string) ?? "",
          spotId:          null,
          spotType:        (meta.spotType as string) ?? "front",
          monthlyPrice:    (meta.monthlyPrice as number) ?? 299,
          migrationStatus: (meta.migrationStatus as string) ?? "legacy_active",
          contract: {
            startDate:        contractStart,
            endDate:          contractEnd,
            remainingMonths:  remaining,
            isNearingRenewal: nearingRenewal,
            renewalTriggered: nearingRenewal && daysLeft <= 30,
            renewalNote:      nearingRenewal ? "Renewal conversation should be initiated" : undefined,
          },
          notes: r.notes?.split("[migration_meta]")[0]?.trim() ?? "",
          migratedAt:  (meta.migratedAt as string) ?? r.createdAt.toISOString(),
          migratedBy:  (meta.migratedBy as string) ?? "admin",
          appearsInDashboard: (meta.appearsInDashboard as boolean) ?? true,
          appearsInROI:       (meta.appearsInDashboard as boolean) ?? true,
          billingPrevented:   (meta.billingPrevented as boolean) ?? true,
        };
      });

    return NextResponse.json({ clients });
  } catch (err) {
    console.error("[GET /api/admin/migration]", err);
    return NextResponse.json({ error: "Failed to load migration records" }, { status: 500 });
  }
}
