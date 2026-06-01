// POST /api/targeted/admin/mark-mailed
// Admin marks a targeted campaign as mailed.
// Triggers: customer notification + review request email/SMS.

import { NextResponse } from "next/server";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  sendMailedNotification,
  sendReviewRequest,
} from "@homereach/services/targeted";
import { z } from "zod";

const MarkMailedSchema = z.object({
  campaignId: z.string().uuid(),
  confirmNotify: z.literal(true),
}).strict();

const mailEligibleStatuses = new Set(["approved"]);

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

    const parsed = MarkMailedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "campaignId and explicit notification confirmation are required" },
        { status: 400 },
      );
    }
    const { campaignId } = parsed.data;

    const [campaign] = await db
      .select()
      .from(targetedRouteCampaigns)
      .where(eq(targetedRouteCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.mailingStatus === "mailed" || campaign.status === "mailed") {
      return NextResponse.json({ error: "Campaign is already marked mailed" }, { status: 400 });
    }

    if (!mailEligibleStatuses.has(campaign.status) || campaign.designStatus !== "approved") {
      return NextResponse.json(
        {
          error:
            "Campaign proof must be approved before mailing notifications can be sent.",
        },
        { status: 400 },
      );
    }

    // ── Mark campaign as mailed ───────────────────────────────────────────────
    const [updatedCampaign] = await db
      .update(targetedRouteCampaigns)
      .set({
        status:        "mailed",
        mailingStatus: "mailed",
        updatedAt:     new Date(),
      })
      .where(eq(targetedRouteCampaigns.id, campaignId))
      .returning({ id: targetedRouteCampaigns.id });

    if (!updatedCampaign) {
      return NextResponse.json({ error: "Campaign could not be updated" }, { status: 409 });
    }

    // ── Update lead if linked ─────────────────────────────────────────────────
    if (campaign.leadId) {
      await db
        .update(leads)
        .set({
          status:    "mailed",
          mailedAt:  new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, campaign.leadId));
    }

    // ── Notify customer that postcards are mailed ─────────────────────────────
    await sendMailedNotification({
      contactName: campaign.contactName,
      email:       campaign.email,
      phone:       campaign.phone,
      businessName: campaign.businessName,
      homesCount:  campaign.homesCount,
    });

    // ── Send review request (after short delay conceptually — sent immediately) ─
    // We send it right away. For production, a 3–5 day delay via a job queue
    // would be better, but this is launch-ready.
    // Explicit admin confirmation is required by the request body before these
    // customer-facing messages are sent.
    await sendReviewRequest({
      contactName:  campaign.contactName,
      email:        campaign.email,
      phone:        campaign.phone,
      businessName: campaign.businessName,
    });

    // ── Mark review requested ─────────────────────────────────────────────────
    await db
      .update(targetedRouteCampaigns)
      .set({
        reviewRequested:   true,
        reviewRequestedAt: new Date(),
        updatedAt:         new Date(),
      })
      .where(eq(targetedRouteCampaigns.id, campaignId));

    if (campaign.leadId) {
      await db
        .update(leads)
        .set({
          status:             "review_requested",
          reviewRequested:    true,
          reviewRequestedAt:  new Date(),
          updatedAt:          new Date(),
        })
        .where(eq(leads.id, campaign.leadId));
    }

    return NextResponse.json({ success: true, reviewRequestSent: true });

  } catch (err) {
    console.error("[api/targeted/admin/mark-mailed] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
