import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/power-mode/check
// Called after every send action to check if agent has hit Power Mode.
// Power Mode = 40 SMS + 40 Email sent in one day.
// Updates streak via Postgres function and returns current status.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const agentId = body.agent_id ?? user.id;

    const db = createServiceClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Count today's sends for this agent
    const { data: events } = await db
      .from("sales_events")
      .select("action_type, channel")
      .eq("agent_id", agentId)
      .gte("created_at", todayStart.toISOString());

    const evs = events ?? [];
    const smsSent   = evs.filter(e =>
      e.action_type === "text_sent" ||
      (e.action_type === "follow_up_sent" && e.channel === "sms")
    ).length;
    const emailSent = evs.filter(e =>
      e.action_type === "email_sent" ||
      (e.action_type === "follow_up_sent" && e.channel === "email")
    ).length;

    // Call the Postgres streak function
    const { data: result, error } = await db.rpc("update_power_mode_streak", {
      p_agent_id:     agentId,
      p_sms_today:    smsSent,
      p_email_today:  emailSent,
      p_sms_target:   40,
      p_email_target: 40,
    });

    if (error) {
      console.error("[power-mode/check] RPC error:", error);
      // Return basic status even if RPC fails
      return NextResponse.json({
        power_mode_hit:  smsSent >= 40 && emailSent >= 40,
        just_activated:  false,
        current_streak:  0,
        sms_today:       smsSent,
        email_today:     emailSent,
        sms_remaining:   Math.max(0, 40 - smsSent),
        email_remaining: Math.max(0, 40 - emailSent),
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[power-mode/check] error:", err);
    return NextResponse.json({ error: "Failed to check power mode" }, { status: 500 });
  }
}

// GET — fetch current streak for agent
export async function GET(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url     = new URL(req.url);
    const agentId = url.searchParams.get("agent_id") ?? user.id;

    const db = createServiceClient();
    const { data: streak } = await db
      .from("agent_streaks")
      .select("*")
      .eq("agent_id", agentId)
      .maybeSingle();

    return NextResponse.json({
      current_streak:    streak?.current_streak    ?? 0,
      longest_streak:    streak?.longest_streak    ?? 0,
      power_mode_days_total: streak?.power_mode_days_total ?? 0,
      today_power_mode:  streak?.today_power_mode  ?? false,
      today_sms_sent:    streak?.today_sms_sent    ?? 0,
      today_email_sent:  streak?.today_email_sent  ?? 0,
      streak_active:     streak?.streak_active     ?? false,
      last_power_mode_date: streak?.last_power_mode_date ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}
