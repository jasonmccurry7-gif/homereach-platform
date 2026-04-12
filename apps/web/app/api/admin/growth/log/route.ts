// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/growth/log
//
// Upserts a single growth activity log entry.
// One row per (date, channel) — submitting again updates the existing row.
// Admin-only via middleware.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, growthActivityLogs } from "@homereach/db";
import { eq, and } from "drizzle-orm";

const LogSchema = z.object({
  date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  channel:              z.enum(["email", "sms", "facebook_dm", "facebook_post", "facebook_ads"]),
  volumeSent:           z.number().int().min(0).default(0),
  adSpendCents:         z.number().int().min(0).default(0),
  responses:            z.number().int().min(0).default(0),
  conversationsStarted: z.number().int().min(0).default(0),
  dealsClosed:          z.number().int().min(0).default(0),
  notes:                z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = LogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      date,
      channel,
      volumeSent,
      adSpendCents,
      responses,
      conversationsStarted,
      dealsClosed,
      notes,
    } = parsed.data;

    // Upsert: insert or update if (date, channel) already exists
    const [row] = await db
      .insert(growthActivityLogs)
      .values({
        date,
        channel,
        volumeSent,
        adSpendCents,
        responses,
        conversationsStarted,
        dealsClosed,
        notes,
      })
      .onConflictDoUpdate({
        target: [growthActivityLogs.date, growthActivityLogs.channel],
        set: {
          volumeSent,
          adSpendCents,
          responses,
          conversationsStarted,
          dealsClosed,
          notes,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, row });
  } catch (err) {
    console.error("[/api/admin/growth/log] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — fetch logs for a date range (for client-side refreshes)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to   = searchParams.get("to");   // YYYY-MM-DD

    const rows = await db
      .select()
      .from(growthActivityLogs)
      .where(
        from && to
          ? and(
              eq(growthActivityLogs.date, from),  // simple date string comparison works for YYYY-MM-DD
            )
          : undefined
      )
      .orderBy(growthActivityLogs.date);

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/admin/growth/log GET] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
