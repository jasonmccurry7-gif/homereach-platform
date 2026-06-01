import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseDollarInputToCents } from "@/lib/digital-targeting/config";

const MetricsSchema = z.object({
  campaignId: z.string().uuid(),
  reportingPeriodStart: z.string().min(1),
  reportingPeriodEnd: z.string().min(1),
  impressions: z.coerce.number().int().min(0).optional().default(0),
  clicks: z.coerce.number().int().min(0).optional().default(0),
  spend: z.union([z.string(), z.number()]).optional().default(0),
  leads: z.coerce.number().int().min(0).optional().default(0),
  calls: z.coerce.number().int().min(0).optional().default(0),
  landingPageVisits: z.coerce.number().int().min(0).optional().default(0),
  qrScans: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = MetricsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid metrics", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("digital_campaign_metrics")
    .insert({
      campaign_id: parsed.data.campaignId,
      reporting_period_start: parsed.data.reportingPeriodStart,
      reporting_period_end: parsed.data.reportingPeriodEnd,
      impressions: parsed.data.impressions,
      clicks: parsed.data.clicks,
      spend: parseDollarInputToCents(parsed.data.spend),
      leads: parsed.data.leads,
      calls: parsed.data.calls,
      landing_page_visits: parsed.data.landingPageVisits,
      qr_scans: parsed.data.qrScans,
      notes: parsed.data.notes || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ metric: data }, { status: 201 });
}
