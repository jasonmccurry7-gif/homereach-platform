// POST /api/targeted/intake
// Submits the intake form for a targeted route campaign.
// Creates a targetedRouteCampaign record and marks lead status → intake_complete.

import { NextResponse } from "next/server";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  notifyAdminIntakeReceived,
  sendIntakeConfirmationToCustomer,
} from "@homereach/services/targeted";

// ── Pricing validation constants ──────────────────────────────────────────
// Cost basis: ~$0.25 print + ~$0.25 postage = ~$0.50/piece
// Minimum sell price enforced server-side: $0.70/piece
const MIN_PRICE_PER_PIECE_CENTS = 70;
const VALID_HOMES_COUNTS = [500, 1000, 2500, 5000] as const;

function validatePricing(homesCount: number, priceCents: number): string | null {
  if (!VALID_HOMES_COUNTS.includes(homesCount as typeof VALID_HOMES_COUNTS[number])) {
    return `homesCount must be one of: ${VALID_HOMES_COUNTS.join(", ")}`;
  }
  const perPiece = priceCents / homesCount;
  if (perPiece < MIN_PRICE_PER_PIECE_CENTS) {
    return `Price per piece ($${(perPiece / 100).toFixed(2)}) is below minimum ($${(MIN_PRICE_PER_PIECE_CENTS / 100).toFixed(2)})`;
  }
  return null;
}

const IntakeSchema = z.object({
  // Lead identification (either token from the link OR manual)
  intakeToken:   z.string().uuid().optional(),
  leadId:        z.string().uuid().optional(),

  // Business info
  businessName:    z.string().min(1),
  contactName:     z.string().min(1).optional(),
  email:           z.string().email(),
  phone:           z.string().optional(),

  // Target area
  businessAddress:  z.string().min(1).optional(),
  targetCity:       z.string().min(1).optional(),
  targetAreaNotes:  z.string().min(1),

  // Optional notes
  notes: z.string().optional(),

  // Pricing (validated server-side — anti-spoof floor enforced)
  homesCount: z.number().int().positive().optional().default(500),
  priceCents: z.number().int().positive().optional().default(40000),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = IntakeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ── Pricing floor enforcement (server-side, anti-spoof) ───────────────────
    const pricingError = validatePricing(data.homesCount, data.priceCents);
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    // ── Resolve lead if token/id provided ─────────────────────────────────────
    let leadId: string | null = null;

    if (data.intakeToken) {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.intakeToken, data.intakeToken))
        .limit(1);

      if (lead) {
        leadId = lead.id;

        // Mark intake started (idempotent)
        await db
          .update(leads)
          .set({ status: "intake_started", updatedAt: new Date() })
          .where(eq(leads.id, lead.id));
      }
    } else if (data.leadId) {
      leadId = data.leadId;
    }

    // ── Create targeted route campaign ────────────────────────────────────────
    const [campaign] = await db
      .insert(targetedRouteCampaigns)
      .values({
        leadId:          leadId,
        businessName:    data.businessName,
        contactName:     data.contactName,
        email:           data.email,
        phone:           data.phone,
        businessAddress: data.businessAddress,
        targetCity:      data.targetCity,
        targetAreaNotes: data.targetAreaNotes,
        notes:           data.notes,
        homesCount:      data.homesCount,
        priceCents:      data.priceCents,
        status:          "intake_complete",
      })
      .returning();

    if (!campaign) {
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }

    // ── Update lead status ────────────────────────────────────────────────────
    if (leadId) {
      await db
        .update(leads)
        .set({
          status:            "intake_complete",
          intakeSubmittedAt: new Date(),
          updatedAt:         new Date(),
        })
        .where(eq(leads.id, leadId));
    }

    // ── Notify admin + send confirmation to customer ──────────────────────────
    await Promise.all([
      notifyAdminIntakeReceived({
        businessName:    campaign.businessName,
        contactName:     campaign.contactName,
        email:           campaign.email,
        phone:           campaign.phone,
        targetCity:      campaign.targetCity,
        targetAreaNotes: campaign.targetAreaNotes,
        businessAddress: campaign.businessAddress,
        campaignId:      campaign.id,
      }),
      sendIntakeConfirmationToCustomer({
        contactName:  campaign.contactName,
        email:        campaign.email,
        businessName: campaign.businessName,
        campaignId:   campaign.id,
      }),
    ]).catch(console.error);

    return NextResponse.json({
      success: true,
      campaign: {
        id:     campaign.id,
        status: campaign.status,
      },
    }, { status: 201 });

  } catch (err) {
    console.error("[api/targeted/intake] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
