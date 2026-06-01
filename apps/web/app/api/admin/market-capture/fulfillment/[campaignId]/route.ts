import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { isMarketCaptureFulfillmentEnabled } from "@/lib/market-capture/config";
import { recomputeMarketCaptureReadiness } from "@/lib/market-capture/fulfillment";
import { createServiceClient } from "@/lib/supabase/service";

const BodySchema = z.object({
  action: z.enum([
    "update_campaign",
    "update_checklist",
    "update_task",
    "update_asset",
    "update_approval",
    "add_location",
    "add_report",
    "add_note",
  ]),
  campaignStatus: z.string().optional(),
  launchStatus: z.string().optional(),
  creativeStatus: z.string().optional(),
  approvalStatus: z.string().optional(),
  reportingStatus: z.string().optional(),
  directMailStatus: z.string().optional(),
  directMailQuantity: z.coerce.number().int().min(0).optional(),
  directMailEstimatedCostCents: z.coerce.number().int().min(0).optional(),
  landingPageUrl: z.string().trim().max(500).optional(),
  trackingUrl: z.string().trim().max(500).optional(),
  owner: z.string().trim().max(80).optional(),
  reviewer: z.string().trim().max(80).optional(),
  designer: z.string().trim().max(80).optional(),
  accountManager: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  checklistId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  status: z.string().trim().max(60).optional(),
  priority: z.string().trim().max(60).optional(),
  locationType: z.string().trim().max(80).optional(),
  name: z.string().trim().max(180).optional(),
  address: z.string().trim().max(300).optional(),
  radiusMiles: z.coerce.number().min(0).max(250).optional(),
  reportingPeriodStart: z.string().trim().optional(),
  reportingPeriodEnd: z.string().trim().optional(),
  impressions: z.coerce.number().int().min(0).optional(),
  reach: z.coerce.number().int().min(0).optional(),
  clicks: z.coerce.number().int().min(0).optional(),
  spend: z.coerce.number().int().min(0).optional(),
  leads: z.coerce.number().int().min(0).optional(),
  calls: z.coerce.number().int().min(0).optional(),
  landingPageVisits: z.coerce.number().int().min(0).optional(),
  qrScans: z.coerce.number().int().min(0).optional(),
  directMailQuantityReport: z.coerce.number().int().min(0).optional(),
  recommendations: z.string().trim().max(4000).optional(),
  content: z.string().trim().max(4000).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
});

type Params = Promise<{ campaignId: string }>;

function pushHistory(existing: unknown, entry: Record<string, unknown>) {
  return Array.isArray(existing) ? [...existing, entry] : [entry];
}

export async function POST(req: Request, { params }: { params: Params }) {
  if (!isMarketCaptureFulfillmentEnabled()) {
    return NextResponse.json({ error: "Market Capture fulfillment is disabled." }, { status: 404 });
  }

  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const { campaignId } = await params;
  const idCheck = z.string().uuid().safeParse(campaignId);
  if (!idCheck.success) return NextResponse.json({ error: "Invalid campaign id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data: campaign, error: campaignError } = await supabase
    .from("market_capture_campaigns")
    .select("id, market_capture_lead_id")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: campaignError?.message ?? "Campaign not found" }, { status: 404 });
  }

  try {
    if (data.action === "update_campaign") {
      const update: Record<string, unknown> = { updated_at: now };
      if (data.campaignStatus) update.campaign_status = data.campaignStatus;
      if (data.launchStatus) update.launch_status = data.launchStatus;
      if (data.creativeStatus) update.creative_status = data.creativeStatus;
      if (data.approvalStatus) update.approval_status = data.approvalStatus;
      if (data.reportingStatus) update.reporting_status = data.reportingStatus;
      if (data.directMailStatus) update.direct_mail_status = data.directMailStatus;
      if (typeof data.directMailQuantity === "number") update.direct_mail_quantity = data.directMailQuantity;
      if (typeof data.directMailEstimatedCostCents === "number") update.direct_mail_estimated_cost_cents = data.directMailEstimatedCostCents;
      if (data.landingPageUrl !== undefined) update.landing_page_url = data.landingPageUrl || null;
      if (data.trackingUrl !== undefined) update.tracking_url = data.trackingUrl || null;
      if (data.owner !== undefined) update.owner = data.owner || "jason";
      if (data.reviewer !== undefined) update.reviewer = data.reviewer || null;
      if (data.designer !== undefined) update.designer = data.designer || null;
      if (data.accountManager !== undefined) update.account_manager = data.accountManager || null;
      if (data.notes !== undefined) update.notes = data.notes || null;

      const { error } = await supabase.from("market_capture_campaigns").update(update).eq("id", campaignId);
      if (error) throw new Error(error.message);
    }

    if (data.action === "update_checklist") {
      if (!data.checklistId || !data.status) throw new Error("Checklist id and status are required.");
      const { data: row } = await supabase
        .from("market_capture_checklists")
        .select("completion_history")
        .eq("id", data.checklistId)
        .eq("campaign_id", campaignId)
        .single();
      const { error } = await supabase
        .from("market_capture_checklists")
        .update({
          status: data.status,
          completed_at: data.status === "completed" ? now : null,
          notes: data.notes ?? null,
          completion_history: pushHistory(row?.completion_history, {
            status: data.status,
            at: now,
            by: guard.user?.email ?? "admin",
          }),
          updated_at: now,
        })
        .eq("id", data.checklistId)
        .eq("campaign_id", campaignId);
      if (error) throw new Error(error.message);
    }

    if (data.action === "update_task") {
      if (!data.taskId || !data.status) throw new Error("Task id and status are required.");
      const { data: row } = await supabase
        .from("market_capture_tasks")
        .select("completion_history")
        .eq("id", data.taskId)
        .eq("market_capture_lead_id", campaign.market_capture_lead_id)
        .single();
      const { error } = await supabase
        .from("market_capture_tasks")
        .update({
          status: data.status,
          priority: data.priority ?? undefined,
          completed_at: data.status === "completed" ? now : null,
          notes: data.notes ?? null,
          completion_history: pushHistory(row?.completion_history, {
            status: data.status,
            at: now,
            by: guard.user?.email ?? "admin",
          }),
          updated_at: now,
        })
        .eq("id", data.taskId)
        .eq("market_capture_lead_id", campaign.market_capture_lead_id);
      if (error) throw new Error(error.message);
    }

    if (data.action === "update_asset") {
      if (!data.assetId || !data.status) throw new Error("Asset id and status are required.");
      const { error } = await supabase
        .from("market_capture_assets")
        .update({
          approval_status: data.status,
          status: data.status === "approved" ? "approved" : "needs_review",
          reviewed_by: guard.user?.email ?? "admin",
          reviewed_at: now,
          rejection_reason: data.rejectionReason ?? null,
          notes: data.notes ?? null,
          updated_at: now,
        })
        .eq("id", data.assetId)
        .eq("market_capture_lead_id", campaign.market_capture_lead_id);
      if (error) throw new Error(error.message);
    }

    if (data.action === "update_approval") {
      if (!data.approvalId || !data.status) throw new Error("Approval id and status are required.");
      const { error } = await supabase
        .from("market_capture_approvals")
        .update({
          status: data.status,
          responded_at: ["approved", "needs_revision", "rejected"].includes(data.status) ? now : null,
          notes: data.notes ?? null,
          revision_notes: data.status === "needs_revision" ? data.notes ?? null : null,
          updated_at: now,
        })
        .eq("id", data.approvalId)
        .eq("campaign_id", campaignId);
      if (error) throw new Error(error.message);

      await supabase
        .from("market_capture_campaigns")
        .update({ approval_status: data.status, updated_at: now })
        .eq("id", campaignId);
    }

    if (data.action === "add_location") {
      if (!data.locationType || !data.name) throw new Error("Location type and name are required.");
      const { error } = await supabase.from("market_capture_campaign_locations").insert({
        campaign_id: campaignId,
        location_type: data.locationType,
        name: data.name,
        address: data.address ?? null,
        radius_miles: data.radiusMiles ?? null,
        notes: data.notes ?? null,
      });
      if (error) throw new Error(error.message);
    }

    if (data.action === "add_report") {
      const impressions = data.impressions ?? 0;
      const clicks = data.clicks ?? 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const { error } = await supabase.from("market_capture_reports").insert({
        campaign_id: campaignId,
        reporting_period_start: data.reportingPeriodStart || null,
        reporting_period_end: data.reportingPeriodEnd || null,
        impressions,
        reach: data.reach ?? 0,
        clicks,
        ctr,
        spend: data.spend ?? 0,
        leads: data.leads ?? 0,
        calls: data.calls ?? 0,
        landing_page_visits: data.landingPageVisits ?? 0,
        qr_scans: data.qrScans ?? 0,
        direct_mail_quantity: data.directMailQuantityReport ?? 0,
        notes: data.notes ?? null,
        recommendations: data.recommendations ?? null,
        created_by: guard.user?.email ?? "admin",
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("market_capture_campaigns")
        .update({ reporting_status: "submitted", updated_at: now })
        .eq("id", campaignId);
    }

    if (data.action === "add_note") {
      if (!data.content) throw new Error("Note content is required.");
      const { error } = await supabase.from("market_capture_notes").insert({
        market_capture_lead_id: campaign.market_capture_lead_id,
        author: guard.user?.email ?? "admin",
        note_type: "fulfillment",
        content: data.content,
        metadata: { campaign_id: campaignId },
      });
      if (error) throw new Error(error.message);
    }

    await recomputeMarketCaptureReadiness({ supabase, campaignId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/market-capture/fulfillment] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
