import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/crm/quarantine?reviewed=false&page=0
// POST /api/admin/crm/quarantine  — restore lead from quarantine
// PUT  /api/admin/crm/quarantine  — manually quarantine a lead
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const sp = req.nextUrl.searchParams;
  const reviewed = sp.get("reviewed");
  const page  = parseInt(sp.get("page")  ?? "0");
  const limit = parseInt(sp.get("limit") ?? "50");

  let query = supabase
    .from("sales_leads")
    .select(`
      id, business_name, contact_name, email, phone, city, category,
      quarantine_reason, quarantined_at, quarantine_reviewed, quarantine_note,
      score, pipeline_stage, total_messages_sent, total_replies
    `, { count: "exact" })
    .eq("is_quarantined", true)
    .order("quarantined_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (reviewed === "false") query = query.eq("quarantine_reviewed", false);
  if (reviewed === "true")  query = query.eq("quarantine_reviewed", true);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Breakdown by reason
  const { data: reasons } = await supabase
    .from("sales_leads")
    .select("quarantine_reason")
    .eq("is_quarantined", true);

  const reasonCounts: Record<string, number> = {};
  (reasons ?? []).forEach(r => {
    const key = r.quarantine_reason ?? "unknown";
    reasonCounts[key] = (reasonCounts[key] ?? 0) + 1;
  });

  return NextResponse.json({
    leads: data ?? [],
    total: count ?? 0,
    page,
    reason_counts: reasonCounts,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { lead_id, note } = await req.json();

  if (!lead_id) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { error } = await supabase.rpc("restore_from_quarantine", {
    p_lead_id: lead_id,
    p_note:    note ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: "restored", lead_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}

export async function PUT(req: NextRequest) {
  try {
  const supabase = await createClient();
  const { lead_id, reason, note } = await req.json();

  if (!lead_id) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { error } = await supabase
    .from("sales_leads")
    .update({
      is_quarantined:    true,
      quarantine_reason: reason ?? "manual",
      quarantined_at:    new Date().toISOString(),
      quarantine_note:   note ?? null,
    })
    .eq("id", lead_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: "quarantined", lead_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
