import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/crm/leads
// Paginated, filterable lead list for admin control center
// Params: stage, city, category, agent, q (search), dnc, page, limit
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient();
  const sp = req.nextUrl.searchParams;

  const stage    = sp.get("stage")    ?? "";
  const city     = sp.get("city")     ?? "";
  const category = sp.get("category") ?? "";
  const agent    = sp.get("agent")    ?? "";
  const q        = sp.get("q")        ?? "";
  const showDnc  = sp.get("dnc")      === "true";
  const page     = parseInt(sp.get("page")  ?? "0");
  const limit    = Math.min(parseInt(sp.get("limit") ?? "50"), 200);

  let query = supabase
    .from("sales_leads")
    .select(`
      id, business_name, contact_name, email, phone, city, category,
      score, priority, pipeline_stage, status, buying_signal,
      is_duplicate, unreachable, fb_never_sent, do_not_contact,
      total_messages_sent, total_replies,
      last_contacted_at, assigned_agent_id,
      profiles:assigned_agent_id ( full_name )
    `, { count: "exact" });

  if (stage)    query = query.eq("pipeline_stage", stage);
  if (city)     query = query.ilike("city", `%${city}%`);
  if (category) query = query.ilike("category", `%${category}%`);
  if (agent)    query = query.eq("assigned_agent_id", agent);
  if (!showDnc) query = query.eq("do_not_contact", false);
  if (q) {
    query = query.or(
      `business_name.ilike.%${q}%,city.ilike.%${q}%,category.ilike.%${q}%,contact_name.ilike.%${q}%`
    );
  }

  query = query
    .order("buying_signal", { ascending: false })
    .order("score",         { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  const { data: leads, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count active (non-DNC, non-suppressed)
  const { count: activeCount } = await supabase
    .from("sales_leads")
    .select("id", { count: "exact", head: true })
    .eq("do_not_contact", false)
    .neq("pipeline_stage", "suppressed");

  return NextResponse.json({
    leads:  leads ?? [],
    total:  count ?? 0,
    active: activeCount ?? 0,
    page,
    limit,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
