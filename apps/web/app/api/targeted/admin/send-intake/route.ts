// POST /api/targeted/admin/send-intake
// Admin sends the intake link to a lead via email (and optional SMS).
// Requires admin session.

import { NextResponse } from "next/server";
import { db, leads } from "@homereach/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/api-guards";
import { sendIntakeLinkToLead } from "@homereach/services/targeted";
import { z } from "zod";

const SendIntakeSchema = z.object({
  leadId: z.string().uuid(),
  confirmSend: z.literal(true),
}).strict();

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

    const parsed = SendIntakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "leadId and explicit send confirmation are required" },
        { status: 400 },
      );
    }
    const { leadId } = parsed.data;

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const email = lead.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }

    if (!lead.intakeToken) {
      return NextResponse.json({ error: "Lead has no intake token" }, { status: 500 });
    }

    // Send intake link
    const result = await sendIntakeLinkToLead({
      name:        lead.name,
      email,
      phone:       lead.phone,
      intakeToken: lead.intakeToken,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error ?? "Intake link could not be sent",
          emailResult: result,
        },
        { status: 502 },
      );
    }

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
