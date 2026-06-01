// POST /api/targeted/intake
// Submits the intake form for a targeted route campaign.
// Creates a targetedRouteCampaign record and marks lead status → intake_complete.

import { NextResponse } from "next/server";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  notifyAdminIntakeReceived,
  sendIntakeConfirmationToCustomer,
} from "@homereach/services/targeted";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { signPublicFlowToken } from "@/lib/security/signed-token";
import {
  isTargetedHomesCount,
  resolveTargetedCampaignPriceCents,
  VALID_TARGETED_HOMES_COUNTS,
} from "@/lib/targeted/pricing";

// ── Pricing validation constants ──────────────────────────────────────────
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined);

const IntakeSchema = z.object({
  // Lead identification. Public raw leadId is accepted for backward compatibility but not trusted.
  intakeToken:   z.string().uuid().optional(),
  leadId:        z.string().uuid().optional(),

  // Business info
  businessName:    z.string().trim().min(1).max(160),
  contactName:     optionalText(120),
  email:           z.string().trim().email().max(254),
  phone:           optionalText(40),

  // Target area
  businessAddress:  optionalText(240),
  targetCity:       optionalText(120),
  targetAreaNotes:  z.string().trim().min(1).max(2_000),

  // Optional notes
  notes: optionalText(2_000),

  // Pricing (validated server-side — anti-spoof floor enforced)
  homesCount: z.number().int().positive().optional().default(500),
  priceCents: z.number().int().positive().optional().default(40000),
});

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(req, {
      key: "targeted-intake",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = IntakeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ── Pricing floor enforcement (server-side, anti-spoof) ───────────────────
    if (!isTargetedHomesCount(data.homesCount)) {
      return NextResponse.json(
        {
          error: `homesCount must be one of: ${VALID_TARGETED_HOMES_COUNTS.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const authoritativePriceCents = resolveTargetedCampaignPriceCents(data.homesCount);

    // ── Resolve lead if token/id provided ─────────────────────────────────────
    let leadId: string | null = null;

    if (data.intakeToken) {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.intakeToken, data.intakeToken))
        .limit(1);

      if (!lead) {
        return NextResponse.json(
          { error: "Invalid or expired intake link" },
          { status: 404 },
        );
      }

      leadId = lead.id;

      // Mark intake started (idempotent)
      await db
        .update(leads)
        .set({ status: "intake_started", updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
    }

    if (leadId) {
      const [existingCampaign] = await db
        .select()
        .from(targetedRouteCampaigns)
        .where(eq(targetedRouteCampaigns.leadId, leadId))
        .orderBy(desc(targetedRouteCampaigns.createdAt))
        .limit(1);

      if (existingCampaign && existingCampaign.status !== "cancelled") {
        const checkoutToken = signPublicFlowToken({
          scope: "targeted_checkout",
          campaignId: existingCampaign.id,
        });

        return NextResponse.json({
          success: true,
          reused: true,
          checkoutToken,
          campaign: {
            id:     existingCampaign.id,
            status: existingCampaign.status,
          },
        });
      }
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
        priceCents:      authoritativePriceCents,
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
    const checkoutToken = signPublicFlowToken({
      scope: "targeted_checkout",
      campaignId: campaign.id,
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
    const checkoutUrl = `${appUrl}/targeted/checkout?token=${encodeURIComponent(checkoutToken)}`;

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
        checkoutUrl,
        homesCount:   campaign.homesCount,
        priceCents:   campaign.priceCents,
      }),
    ]).catch(console.error);

    return NextResponse.json({
      success: true,
      checkoutToken,
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
