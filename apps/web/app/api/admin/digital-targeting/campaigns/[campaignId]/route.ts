import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendDigitalLaunchConfirmation } from "@/lib/digital-targeting/messaging";

const CampaignUpdateSchema = z.object({
  campaignStatus: z.string().max(80).optional(),
  paymentStatus: z.string().max(80).optional(),
  adSpendConfirmed: z.boolean().optional(),
  creativeApproved: z.boolean().optional(),
  adminApprovedForLaunch: z.boolean().optional(),
  trackingUrl: z.string().max(500).optional(),
  landingPageUrl: z.string().max(500).optional(),
  notes: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = CampaignUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign update", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing, error: existingError } = await supabase
    .from("digital_targeting_campaigns")
    .select("id, campaign_status, business_name, contact_name, email")
    .eq("id", campaignId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? "Campaign not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.campaignStatus !== undefined) updates.campaign_status = parsed.data.campaignStatus;
  if (parsed.data.paymentStatus !== undefined) updates.payment_status = parsed.data.paymentStatus;
  if (parsed.data.adSpendConfirmed !== undefined) updates.ad_spend_confirmed = parsed.data.adSpendConfirmed;
  if (parsed.data.creativeApproved !== undefined) updates.creative_approved = parsed.data.creativeApproved;
  if (parsed.data.adminApprovedForLaunch !== undefined) updates.admin_approved_for_launch = parsed.data.adminApprovedForLaunch;
  if (parsed.data.trackingUrl !== undefined) updates.tracking_url = parsed.data.trackingUrl || null;
  if (parsed.data.landingPageUrl !== undefined) updates.landing_page_url = parsed.data.landingPageUrl || null;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null;

  const { data, error } = await supabase
    .from("digital_targeting_campaigns")
    .update(updates)
    .eq("id", campaignId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.campaignStatus === "live" && existing.campaign_status !== "live") {
    await sendDigitalLaunchConfirmation({
      businessName: existing.business_name,
      contactName: existing.contact_name,
      email: existing.email,
    }).catch((err) => console.error("[digital-targeting/admin] launch email failed:", err));
  }

  return NextResponse.json({ campaign: data });
}
