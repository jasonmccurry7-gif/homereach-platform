"use server";

import { db, marketingCampaigns, campaignMetrics } from "@homereach/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Add drop results to a campaign
// ─────────────────────────────────────────────────────────────────────────────

interface DropResultsInput {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  impressions: number;
  mailpieces: number;
  qrScans: number;
  phoneLeads: number;
  formLeads: number;
}

export async function addDropResults(
  campaignId: string,
  data: DropResultsInput
): Promise<{ error: string } | void> {
  if (!campaignId) return { error: "Campaign ID is required." };

  const periodStart = new Date(data.periodStart + "T00:00:00");
  const periodEnd = new Date(data.periodEnd + "T23:59:59");

  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    return { error: "Invalid period dates." };
  }
  if (periodEnd <= periodStart) {
    return { error: "Period end must be after period start." };
  }
  if (data.impressions < 0 || data.mailpieces < 0) {
    return { error: "Impression and mailpiece counts must be non-negative." };
  }

  const totalLeads = data.qrScans + data.phoneLeads + data.formLeads;

  try {
    await db.insert(campaignMetrics).values({
      campaignId,
      periodStart,
      periodEnd,
      impressions: data.impressions,
      mailpieces: data.mailpieces,
      qrScans: data.qrScans,
      phoneLeads: data.phoneLeads,
      formLeads: data.formLeads,
      totalLeads,
    });

    revalidatePath(`/admin/campaigns/${campaignId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/campaign");
  } catch (err) {
    console.error("[addDropResults]", err);
    return { error: "Failed to save. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Update campaign status, drops, and dates
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignStatusInput {
  status: string;
  dropsCompleted: number;
  nextDropDate: Date | null;
  renewalDate: Date | null;
}

export async function updateCampaignStatus(
  campaignId: string,
  data: CampaignStatusInput
): Promise<{ error: string } | void> {
  const validStatuses = ["upcoming", "active", "completed", "paused", "cancelled"];
  if (!validStatuses.includes(data.status)) {
    return { error: "Invalid status." };
  }
  if (data.dropsCompleted < 0) {
    return { error: "Drops completed must be non-negative." };
  }

  try {
    await db
      .update(marketingCampaigns)
      .set({
        status: data.status as "upcoming" | "active" | "completed" | "paused" | "cancelled",
        dropsCompleted: data.dropsCompleted,
        nextDropDate: data.nextDropDate,
        renewalDate: data.renewalDate,
        updatedAt: new Date(),
      })
      .where(eq(marketingCampaigns.id, campaignId));

    revalidatePath(`/admin/campaigns/${campaignId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/campaign");
  } catch (err) {
    console.error("[updateCampaignStatus]", err);
    return { error: "Failed to update campaign. Please try again." };
  }
}
