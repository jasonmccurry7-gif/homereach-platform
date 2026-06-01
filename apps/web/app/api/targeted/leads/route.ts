// POST /api/targeted/leads
// Creates a new lead (from Facebook ad, landing page, or manual admin entry).
// On creation, notifies admin.

import { NextResponse } from "next/server";
import { db, leads } from "@homereach/db";
import { z } from "zod";
import { notifyAdminNewLead } from "@homereach/services/targeted";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

const CreateLeadSchema = z.object({
  name:         optionalText(120),
  businessName: optionalText(160),
  phone:        optionalText(40),
  email:        z.string().trim().email().max(254).optional(),
  city:         optionalText(120),
  source:       z.enum(["facebook", "web", "manual", "sms", "referral"]).default("facebook"),
  notes:        optionalText(2_000),
  attribution: z.object({
    sessionId: z.string().max(120).optional(),
    landingPath: z.string().max(500).optional(),
    pagePath: z.string().max(500).optional(),
    referrer: z.string().max(1000).optional(),
    source: z.string().max(120).optional(),
    medium: z.string().max(120).optional(),
    campaign: z.string().max(160).optional(),
    term: z.string().max(160).optional(),
    content: z.string().max(160).optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(req, {
      key: "targeted-leads",
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = CreateLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Require a reachable contact method. Name-only leads create dead-end records.
    if (!data.email && !data.phone) {
      return NextResponse.json(
        { error: "Email or phone is required" },
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

    recordSeoLeadAttribution(req, lead.id, data.attribution).catch(console.error);

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

async function recordSeoLeadAttribution(
  req: Request,
  leadId: string,
  attribution?: z.infer<typeof CreateLeadSchema>["attribution"],
) {
  const supa = createServiceClient();
  await supa.from("seo_attribution_events").insert({
    event_name: "lead_submit",
    session_id: attribution?.sessionId ?? null,
    lead_id: leadId,
    landing_path: attribution?.landingPath ?? null,
    page_path: attribution?.pagePath ?? null,
    referrer: attribution?.referrer ?? req.headers.get("referer"),
    source: attribution?.source ?? null,
    medium: attribution?.medium ?? null,
    campaign: attribution?.campaign ?? null,
    term: attribution?.term ?? null,
    content: attribution?.content ?? null,
    metadata: { route: "/api/targeted/leads" },
  });
}
