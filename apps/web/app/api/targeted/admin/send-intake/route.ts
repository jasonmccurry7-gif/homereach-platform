// POST /api/targeted/admin/send-intake
// Admin sends the intake link to a lead via email (and optional SMS).
// Requires admin session.

import { NextResponse } from "next/server";
import { db, leads } from "@homereach/db";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { sendIntakeLinkToLead } from "@homereach/services/targeted";

export async function POST(req: Request) {
  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadId } = await req.json() as { leadId: string };
    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }

    if (!lead.intakeToken) {
      return NextResponse.json({ error: "Lead has no intake token" }, { status: 500 });
    }

    // Send intake link
    const result = await sendIntakeLinkToLead({
      name:        lead.name,
      email:       lead.email,
      phone:       lead.phone,
      intakeToken: lead.intakeToken,
    });

    // Update lead status
    await db
      .update(leads)
      .set({
        status:       "intake_sent",
        intakeSentAt: new Date(),
        updatedAt:    new Date(),
      })
      .where(eq(leads.id, leadId));

    return NextResponse.json({ success: true, emailResult: result });

  } catch (err) {
    console.error("[api/targeted/admin/send-intake] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
