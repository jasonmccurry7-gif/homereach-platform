// POST /api/targeted/leads
// Creates a new lead (from Facebook ad, landing page, or manual admin entry).
// On creation, notifies admin.

import { NextResponse } from "next/server";
import { db, leads } from "@homereach/db";
import { z } from "zod";
import { notifyAdminNewLead } from "@homereach/services/targeted";

const CreateLeadSchema = z.object({
  name:         z.string().min(1).optional(),
  businessName: z.string().min(1).optional(),
  phone:        z.string().optional(),
  email:        z.string().email().optional(),
  city:         z.string().optional(),
  source:       z.enum(["facebook", "web", "manual", "sms", "referral"]).default("facebook"),
  notes:        z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreateLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Require at least one contact method
    if (!data.email && !data.phone && !data.name) {
      return NextResponse.json(
        { error: "At least one of: email, phone, or name is required" },
        { status: 400 }
      );
    }

    const [lead] = await db
      .insert(leads)
      .values({
        name:         data.name,
        businessName: data.businessName,
        phone:        data.phone,
        email:        data.email,
        city:         data.city,
        source:       data.source,
        notes:        data.notes,
        status:       "new",
      })
      .returning();

    if (!lead) {
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }

    // Notify admin (non-blocking)
    notifyAdminNewLead({
      name:         lead.name,
      businessName: lead.businessName,
      email:        lead.email,
      phone:        lead.phone,
      city:         lead.city,
      source:       lead.source,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      lead: {
        id:          lead.id,
        status:      lead.status,
        intakeToken: lead.intakeToken,
      },
    }, { status: 201 });

  } catch (err) {
    console.error("[api/targeted/leads] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
