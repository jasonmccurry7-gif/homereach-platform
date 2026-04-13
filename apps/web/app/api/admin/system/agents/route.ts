import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/admin/system/agents — list all agent identities + health
// POST /api/admin/system/agents — create or update agent identity
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
  const supabase = await createClient();

  const [identitiesRes, healthRes, countsRes] = await Promise.all([
    supabase
      .from("agent_identities")
      .select(`
        agent_id, from_email, from_name, twilio_phone,
        email_daily_limit, sms_daily_limit, email_ramp_day,
        email_ramp_started, is_active, created_at,
        profiles:agent_id ( full_name, email )
      `)
      .order("created_at"),
    supabase.from("v_sender_health" as never).select("*"),
    supabase
      .from("agent_daily_send_counts")
      .select("agent_id, channel, sent_count, send_date")
      .eq("send_date", new Date().toISOString().slice(0, 10)),
  ]);

  return NextResponse.json({
    identities: identitiesRes.data ?? [],
    health:     healthRes.data ?? [],
    today_counts: countsRes.data ?? [],
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
  const body = await req.json();

  const {
    agent_id,
    from_email,
    from_name,
    twilio_phone,
    email_daily_limit,
    sms_daily_limit,
    email_ramp_day,
    email_ramp_started,
  } = body;

  if (!agent_id) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("agent_identities")
    .upsert({
      agent_id,
      from_email:         from_email ?? null,
      from_name:          from_name  ?? null,
      twilio_phone:       twilio_phone ?? null,
      email_daily_limit:  email_daily_limit ?? 30,
      sms_daily_limit:    sms_daily_limit   ?? 150,
      email_ramp_day:     email_ramp_day    ?? 1,
      email_ramp_started: email_ramp_started ?? new Date().toISOString().slice(0, 10),
      is_active:          true,
      updated_at:         new Date().toISOString(),
    }, { onConflict: "agent_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, identity: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
