import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/power-mode/end-of-day
// Cron: 5:30 PM weekdays — closes the day, updates streaks, sends messages
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();

  // Get all agents with their today's stats
  const { data: streaks } = await db
    .from("agent_streaks")
    .select("agent_id, today_power_mode, today_sms_sent, today_email_sent, current_streak");

  const { data: identities } = await db
    .from("agent_identities")
    .select("agent_id, from_name, from_email, twilio_phone");

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email");

  const identityMap = Object.fromEntries((identities ?? []).map(i => [i.agent_id, i]));
  const profileMap  = Object.fromEntries((profiles  ?? []).map(p => [p.id, p]));

  const summary = { power_mode_hit: 0, missed: 0, messages_sent: 0, errors: 0 };

  for (const streak of streaks ?? []) {
    const identity = identityMap[streak.agent_id];
    const profile  = profileMap[streak.agent_id];
    const name     = identity?.from_name ?? profile?.full_name ?? "Agent";
    const email    = identity?.from_email ?? profile?.email;

    // Log end-of-day event to sales_events
    const msg = streak.today_power_mode
      ? `🔥 Strong work today, ${name} — you hit Power Mode. Current streak: ${streak.current_streak} day${streak.current_streak !== 1 ? "s" : ""}. Let's build on it tomorrow.`
      : `⚠️ You missed Power Mode today (${streak.today_sms_sent}/40 SMS, ${streak.today_email_sent}/40 Email). Streak reset. Tomorrow is a fresh start, ${name}.`;

    if (email) {
      await db.from("sales_events").insert({
        agent_id:    streak.agent_id,
        action_type: streak.today_power_mode ? "power_mode_achieved" : "power_mode_missed",
        channel:     "system",
        message:     msg,
        metadata:    {
          sms_sent:       streak.today_sms_sent,
          email_sent:     streak.today_email_sent,
          power_mode:     streak.today_power_mode,
          streak_day:     streak.current_streak,
        },
      }).then(() => {}).catch(() => {});
    }

    if (streak.today_power_mode) summary.power_mode_hit++;
    else summary.missed++;
  }

  // Reset daily counters via DB function
  await db.rpc("reset_daily_power_mode").catch(() => {});

  // ── Alert hook (fire-and-forget, never blocks, additive) ─────────────────
  // Fires quota_warning personal SMS alerts for agents who missed Power Mode today.
  // Guarded by ENABLE_INTERNAL_ALERTS flag.
  if (process.env.ENABLE_INTERNAL_ALERTS === "true") {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const missedAgents = (streaks ?? []).filter(s => !s.today_power_mode);

    for (const streak of missedAgents) {
      const profile = profileMap[streak.agent_id];
      const name    = profile?.full_name ?? "Agent";

      Promise.resolve().then(() =>
        fetch(`${baseUrl}/api/admin/alerts/send`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id:     streak.agent_id,
            alert_type:   "quota_warning",
            urgency:      "high",
            custom_body:  `⚠️ ${name}, you missed Power Mode today (${streak.today_sms_sent}/40 SMS, ${streak.today_email_sent}/40 email). Streak reset. Fresh start tomorrow 💪`,
            shadow_mode:  process.env.ALERT_SHADOW_MODE === "true",
          }),
        }).catch(() => {})
      );
    }
  }

  return NextResponse.json({ ok: true, summary });
}
