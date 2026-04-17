// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/migration
// Persists a migrated/legacy client record to the businesses table.
// GET  /api/admin/migration — returns all migrated business records.
//
// Uses Supabase service client (not Drizzle) — Drizzle requires a direct
// DATABASE_URL which is not available on Vercel. Supabase REST API works fine.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

// ── POST — create migrated client ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user's ID for ownerId
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = MigrationSchema.parse(body);

    // Build contract dates
    const contractStart = data.contractStart ? new Date(data.contractStart) : new Date();
    const contractEnd   = new Date(contractStart);
    contractEnd.setMonth(contractEnd.getMonth() + data.remainingMonths);

    // Pack migration metadata into notes field
    const metaNotes = JSON.stringify({
      contactName:        data.contactName ?? null,
      spotType:           data.spotType,
      monthlyPrice:       data.monthlyPrice,
      contractStart:      contractStart.toISOString().split("T")[0],
      contractEnd:        contractEnd.toISOString().split("T")[0],
      remainingMonths:    data.remainingMonths,
      migrationStatus:    data.migrationStatus,
      migratedBy:         data.migratedBy,
      migratedAt:         new Date().toISOString(),
      billingPrevented:   data.migrationStatus !== "new_system",
      appearsInDashboard: data.migrationStatus !== "legacy_pending",
      city:               data.city ?? null,
      category:           data.category ?? null,
    });

    const adminNote = data.notes
      ? `${data.notes}\n\n[migration_meta]${metaNotes}`
      : `[migration_meta]${metaNotes}`;

    // Use service client for insert (bypasses RLS)
    const db = createServiceClient();
    const { data: inserted, error } = await db
      .from("businesses")
      .insert({
        owner_id:  user.id,
        name:      data.businessName,
        phone:     data.phone ?? null,
        email:     data.email ?? null,
        city_id:   null,   // stored as text in migration_meta
        category_id: null, // stored as text in migration_meta
        status:    data.migrationStatus === "legacy_pending" ? "pending" : "active",
        notes:     adminNote,
      })
      .select("id, name")
      .single();

    if (error) {
      console.error("[POST /api/admin/migration] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: inserted.id, name: inserted.name });
  } catch (err) {
    console.error("[POST /api/admin/migration]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save migration record" }, { status: 500 });
  }
}

// ── GET — load all migrated clients ──────────────────────────────────────────

export async function GET() {
  try {
    const db = createServiceClient();

    const { data: rows, error } = await db
      .from("businesses")
      .select("id, name, phone, email, city_id, category_id, status, notes, created_at")
      .like("notes", "%[migration_meta]%")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/migration]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clients = (rows ?? []).map((r) => {
      let meta: Record<string, unknown> = {};
      try {
        const metaStr = r.notes?.split("[migration_meta]")[1];
        meta = JSON.parse(metaStr ?? "{}");
      } catch { /* ignore */ }

      const contractStart  = (meta.contractStart  as string) ?? new Date().toISOString().split("T")[0];
      const contractEnd    = (meta.contractEnd    as string) ?? contractStart;
      const remaining      = (meta.remainingMonths as number) ?? 0;
      const daysLeft       = Math.max(0, Math.ceil((new Date(contractEnd).getTime() - Date.now()) / 86400000));
      const nearingRenewal = daysLeft <= 60;

      return {
        id:              r.id,
        businessName:    r.name,
        contactName:     (meta.contactName as string) ?? "",
        phone:           r.phone ?? "",
        email:           r.email ?? "",
        cityId:          r.city_id ?? "",
        city:            (meta.city as string) ?? "",
        categoryId:      r.category_id ?? "",
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
        },
        notes:             r.notes?.split("[migration_meta]")[0]?.trim() ?? "",
        migratedAt:        (meta.migratedAt as string) ?? r.created_at,
        migratedBy:        (meta.migratedBy as string) ?? "admin",
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
