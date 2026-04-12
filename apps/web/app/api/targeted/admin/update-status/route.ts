// POST /api/targeted/admin/update-status
// Admin manually updates lead or campaign status.

import { NextResponse } from "next/server";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const UpdateSchema = z.object({
  type:   z.enum(["lead", "campaign"]),
  id:     z.string().uuid(),
  status: z.string().min(1),
  notes:  z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { type, id, status, notes } = parsed.data;

    if (type === "lead") {
      await db
        .update(leads)
        .set({
          status:    status as any,
          notes:     notes,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id));
    } else {
      await db
        .update(targetedRouteCampaigns)
        .set({
          status:    status as any,
          notes:     notes,
          updatedAt: new Date(),
        })
        .where(eq(targetedRouteCampaigns.id, id));
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[api/targeted/admin/update-status] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
