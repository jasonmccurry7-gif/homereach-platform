import { NextResponse }       from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/alerts/log
//
// Query the internal alert history.
// Used by the Operator Dashboard System Intelligence panel.
//
// Query params:
//   agent_id   — filter by agent UUID
//   since      — ISO timestamp (default: last 24h)
//   type       — alert_type filter
//   status     — status filter (sent|suppressed|failed)
//   limit      — max records (default: 50, max: 200)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId  = searchParams.get("agent_id");
  const alertType = searchParams.get("type");
  const status   = searchParams.get("status");
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit    = Math.min(Math.max(rawLimit, 1), 200);

  const sinceParam = searchParams.get("since");
  const since = sinceParam
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();

  let query = supabase
    .from("internal_alerts")
    .select("id, agent_id, lead_id, business_name, city, alert_type, urgency, message, phone, sent_at, status, deep_link, dedupe_key, twilio_sid, reason, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (agentId)   query = query.eq("agent_id", agentId);
  if (alertType) query = query.eq("alert_type", alertType);
  if (status)    query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("[AlertLog] Query error:", error);
    return NextResponse.json({ alerts: [], error: error.message }, { status: 500 });
  }

  // Summary stats
  const total     = data?.length ?? 0;
  const sent      = data?.filter(a => a.status === "sent" || a.status === "delivered").length ?? 0;
  const suppressed = data?.filter(a => a.status === "suppressed").length ?? 0;
  const failed    = data?.filter(a => a.status === "failed").length ?? 0;

  return NextResponse.json({
    alerts: data ?? [],
    summary: { total, sent, suppressed, failed },
    since,
    limit,
  });
}
