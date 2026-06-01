// POST /api/targeted/admin/update-status
// Admin manually updates lead or campaign status.

import { NextResponse } from "next/server";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/api-guards";
import { z } from "zod";

const leadAdminStatuses = [
  "new",
  "contacted",
  "intake_sent",
  "intake_started",
  "intake_complete",
  "active",
  "review_requested",
] as const;

const campaignAdminStatuses = [
  "intake_complete",
  "design_queued",
  "design_in_progress",
  "design_ready",
  "approved",
  "cancelled",
] as const;

const optionalNotes = z.string().trim().max(2_000).optional().transform((value) => value || undefined);
const designStatusByCampaignStatus = {
  intake_complete: "not_started",
  design_queued: "queued",
  design_in_progress: "in_progress",
  design_ready: "ready",
  approved: "approved",
  cancelled: "not_started",
} as const;

const UpdateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lead"),
    id: z.string().uuid(),
    status: z.enum(leadAdminStatuses),
    notes: optionalNotes,
  }).strict(),
  z.object({
    type: z.literal("campaign"),
    id: z.string().uuid(),
    status: z.enum(campaignAdminStatuses),
    notes: optionalNotes,
  }).strict(),
]);

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid input. Payment, mailing, and completion statuses must move through their dedicated approval paths.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { type, id, status, notes } = parsed.data;

    if (type === "lead") {
      const leadUpdate = {
        status,
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(leads)
        .set(leadUpdate)
        .where(eq(leads.id, id))
        .returning({ id: leads.id });
      if (!updated) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    } else {
      const campaignUpdate = {
        status,
        designStatus: designStatusByCampaignStatus[status],
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(targetedRouteCampaigns)
        .set(campaignUpdate)
        .where(eq(targetedRouteCampaigns.id, id))
        .returning({ id: targetedRouteCampaigns.id });
      if (!updated) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[api/targeted/admin/update-status] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
