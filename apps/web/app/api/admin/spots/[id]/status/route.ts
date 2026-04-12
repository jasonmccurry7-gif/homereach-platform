import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, spotAssignments } from "@homereach/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/spots/[id]/status
//
// Admin-only: manually override the status of a spot_assignment.
// Used for: activating manually invoiced clients, releasing stuck pending slots,
// correcting webhook failures.
//
// Agent 2 — Fulfillment & Ops (Task 18)
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  status: z.enum(["pending", "active", "paused", "churned", "cancelled"]),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Params) {
  // ── Auth: admin only ───────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role via profiles
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status } = parsed.data;

  const now = new Date();
  const updatePayload: Record<string, unknown> = { status, updatedAt: now };

  // Set timestamps based on status transition
  if (status === "active") {
    updatePayload.activatedAt     = now;
    updatePayload.commitmentEndsAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  } else if (status === "churned" || status === "cancelled") {
    updatePayload.releasedAt = now;
  }

  const [updated] = await db
    .update(spotAssignments)
    .set(updatePayload)
    .where(eq(spotAssignments.id, id))
    .returning({ id: spotAssignments.id, status: spotAssignments.status });

  if (!updated) {
    return NextResponse.json({ error: "Spot assignment not found" }, { status: 404 });
  }

  console.log(`[admin/spots] override: ${id} → ${status} by ${user.email}`);

  return NextResponse.json({ success: true, id: updated.id, status: updated.status });
}
