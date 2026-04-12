// POST /api/targeted/admin/mark-mailed
// Admin marks a targeted campaign as mailed.
// Triggers: customer notification + review request email/SMS.

import { NextResponse } from "next/server";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import {
  sendMailedNotification,
  sendReviewRequest,
} from "@homereach/services/targeted";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = await req.json() as { campaignId: string };
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }

    const [campaign] = await db
      .select()
      .from(targetedRouteCampaigns)
      .where(eq(targetedRouteCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // ── Mark campaign as mailed ───────────────────────────────────────────────
    await db
      .update(targetedRouteCampaigns)
      .set({
        status:        "mailed",
        mailingStatus: "mailed",
        updatedAt:     new Date(),
      })
      .where(eq(targetedRouteCampaigns.id, campaignId));

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
