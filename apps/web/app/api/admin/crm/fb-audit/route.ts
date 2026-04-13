import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/crm/fb-audit
// Returns breakdown of all Facebook outreach events by true status.
// Critical: 921 "generated but never delivered" messages must show as never_sent.
//
// PATCH /api/admin/crm/fb-audit  — update a specific event's FB status
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const sp = req.nextUrl.searchParams;
  const statusFilter = sp.get("status") ?? "";  // filter by fb_outreach_status
  const page  = parseInt(sp.get("page")  ?? "0");
  const limit = parseInt(sp.get("limit") ?? "100");

  // Aggregate counts by status
  const { data: statusCounts } = await supabase
    .from("crm_outreach_events")
    .select("fb_outreach_status, fb_actually_sent")
    .eq("channel", "facebook");

  const summary: Record<string, number> = {
    never_sent:      0,
    draft_generated: 0,
    queued:          0,
    sent:            0,
    failed:          0,
    total:           0,
  };
  (statusCounts ?? []).forEach(r => {
    const key = r.fb_outreach_status ?? (r.fb_actually_sent ? "sent" : "never_sent");
    summary[key] = (summary[key] ?? 0) + 1;
    summary.total++;
  });

  // Detail query
  let query = supabase
    .from("crm_outreach_events")
    .select(`
      id, fb_outreach_status, fb_actually_sent, sent_at, message_body, created_at,
      sales_leads!inner ( id, business_name, city, category, facebook_url )
    `, { count: "exact" })
    .eq("channel", "facebook")
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (statusFilter) {
    if (statusFilter === "never_sent") {
      query = query.eq("fb_actually_sent", false);
    } else {
      query = query.eq("fb_outreach_status", statusFilter);
    }
  }

  const { data: events, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    summary,
    warning: summary.never_sent > 0
      ? `⚠️ ${summary.never_sent} Facebook messages were generated in Replit but NEVER delivered. They do NOT count as real outreach.`
      : null,
    events: events ?? [],
    total:  count ?? 0,
    page,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { event_id, fb_outreach_status } = await req.json();

  const validStatuses = ["draft_generated","queued","sent","failed","never_sent"];
  if (!event_id || !validStatuses.includes(fb_outreach_status)) {
    return NextResponse.json({ error: "event_id and valid fb_outreach_status required" }, { status: 400 });
  }

  const fb_actually_sent = fb_outreach_status === "sent";

  const { error } = await supabase
    .from("crm_outreach_events")
    .update({ fb_outreach_status, fb_actually_sent })
    .eq("id", event_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
