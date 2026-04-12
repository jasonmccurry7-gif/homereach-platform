import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/crm/metrics?agent_id=&date=YYYY-MM-DD
// Returns daily metrics rollup per agent
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");
  const date    = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  let q = supabase.from("crm_activity_metrics").select("*, profiles(full_name)");
  if (agentId) q = q.eq("agent_id", agentId);
  else q = q.eq("metric_date", date);

  const { data, error } = await q.order("metric_date", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ metrics: data });
}

// POST — upsert daily metrics for an agent
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { agent_id, metric_date, ...fields } = body;

  if (!agent_id || !metric_date) {
    return NextResponse.json({ error: "agent_id + metric_date required" }, { status: 400 });
  }

  // Compute rates
  const messages = fields.messages_sent ?? 0;
  const replies  = fields.replies_received ?? 0;
  const deals    = fields.deals_closed ?? 0;
  const reply_rate_pct  = messages > 0 ? +(replies / messages * 100).toFixed(2) : 0;
  const close_rate_pct  = messages > 0 ? +(deals   / messages * 100).toFixed(2) : 0;

  const { error } = await supabase.from("crm_activity_metrics").upsert({
    agent_id, metric_date, ...fields, reply_rate_pct, close_rate_pct,
    updated_at: new Date().toISOString(),
  }, { onConflict: "agent_id,metric_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
