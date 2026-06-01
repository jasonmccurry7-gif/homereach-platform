import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { isMarketCaptureFulfillmentEnabled } from "@/lib/market-capture/config";
import { ensureMarketCaptureFulfillment } from "@/lib/market-capture/fulfillment";
import { createServiceClient } from "@/lib/supabase/service";

const InitSchema = z.object({
  leadId: z.string().uuid(),
});

export async function POST(req: Request) {
  if (!isMarketCaptureFulfillmentEnabled()) {
    return NextResponse.json({ error: "Market Capture fulfillment is disabled." }, { status: 404 });
  }

  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = InitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const campaign = await ensureMarketCaptureFulfillment({
      supabase: createServiceClient(),
      leadId: parsed.data.leadId,
      createdBy: guard.user?.email ?? "admin",
    });
    return NextResponse.json({ ok: true, campaignId: campaign.id });
  } catch (err) {
    console.error("[api/admin/market-capture/fulfillment/init] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
