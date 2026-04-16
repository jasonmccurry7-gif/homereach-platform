import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sales/facebook/alert
//
// Sends a Twilio SMS alert to the correct rep when a Facebook interaction
// needs fast response. Separated from customer/lead texting flows.
//
// Body:
//   agent_id:     string       — which rep to alert
//   alert_type:   string       — type of alert (comment_reply, dm_opportunity, etc.)
//   message:      string       — short actionable alert text
//   context:      object       — extra context (business, city, thread_url, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_TYPES: Record<string, { label: string; emoji: string; priority: "high" | "medium" | "low" }> = {
  comment_reply:       { label: "New reply on your Facebook comment",         emoji: "💬", priority: "high"   },
  dm_opportunity:      { label: "High-value thread ready to convert to DM",   emoji: "📩", priority: "high"   },
  hot_thread:          { label: "Active thread needs follow-up NOW",           emoji: "🔥", priority: "high"   },
  biz_owner_engaged:   { label: "Business owner engaged — act fast",          emoji: "🏢", priority: "high"   },
  intake_ready:        { label: "Intake-ready conversation identified",        emoji: "✅", priority: "high"   },
  thread_waiting:      { label: "Thread waiting too long for response",        emoji: "⏰", priority: "medium" },
  warm_opportunity:    { label: "Warm Facebook opportunity for follow-up",     emoji: "🌡️", priority: "medium" },
  daily_mission_done:  { label: "Daily Facebook mission complete!",            emoji: "🏆", priority: "low"    },
  streak_milestone:    { label: "Facebook engagement streak milestone!",       emoji: "🔥", priority: "low"    },
};

async function sendTwilioSms(to: string, from: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return { ok: false, error: "Twilio not configured" };

  try {
    const form = new URLSearchParams();
    form.append("To",   to);
    form.append("From", from);
    form.append("Body", body);

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );

    if (!resp.ok) {
      const detail = await resp.text();
      return { ok: false, error: `Twilio ${resp.status}: ${detail}` };
    }
    const data = await resp.json() as { sid?: string };
    return { ok: true, sid: data.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMS error" };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agent_id, alert_type, message, context } = body;

    if (!agent_id || !alert_type) {
      return NextResponse.json({ error: "agent_id and alert_type required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const meta     = ALERT_TYPES[alert_type] ?? { label: "Facebook Alert", emoji: "📘", priority: "medium" };

    // ── Resolve agent's phone number ────────────────────────────────────────
    const { data: identity } = await supabase
      .from("agent_identities")
      .select("twilio_phone, from_name, is_active")
      .eq("agent_id", agent_id)
      .maybeSingle();

    const agentPhone  = identity?.twilio_phone ?? null;
    const systemPhone = process.env.TWILIO_PHONE_NUMBER ?? null;

    // ── Format alert message ─────────────────────────────────────────────────
    const alertBody = [
      `${meta.emoji} FB ALERT — HomeReach`,
      `${meta.label}`,
      context?.business  ? `Business: ${context.business}` : null,
      context?.city      ? `City: ${context.city}` : null,
      context?.thread    ? `Thread: ${context.thread}` : null,
      message            ? `Action: ${message}` : null,
      context?.thread_url ? `→ ${context.thread_url}` : null,
    ].filter(Boolean).join("\n");

    // ── Attempt Twilio send ──────────────────────────────────────────────────
    let smsResult: { ok: boolean; sid?: string; error?: string } = { ok: false, error: "No phone" };
    if (agentPhone && systemPhone) {
      smsResult = await sendTwilioSms(agentPhone, systemPhone, alertBody);
    } else if (!agentPhone) {
      smsResult = { ok: false, error: "Agent has no Twilio phone configured in agent_identities" };
    }

    // ── Log alert event ──────────────────────────────────────────────────────
    try {
      await supabase.from("facebook_alert_events").insert({
        agent_id,
        alert_type,
        message:         alertBody,
        context:         context ?? {},
        priority:        meta.priority,
        delivery_status: smsResult.ok ? "sent" : "failed",
        twilio_sid:      smsResult.sid ?? null,
        error_detail:    smsResult.error ?? null,
        sent_to_phone:   agentPhone,
      });
    } catch {
      // Table may not exist yet — log to sales_events as fallback
      await supabase.from("sales_events").insert({
        agent_id,
        action_type: "facebook_sent",
        channel: "facebook",
        message: `[FB ALERT] ${alert_type}: ${message ?? ""}`,
        metadata: { alert_type, priority: meta.priority, sms_sent: smsResult.ok },
      }).then(() => {}).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      sms_sent: smsResult.ok,
      error: smsResult.ok ? undefined : smsResult.error,
      alert_type,
      priority: meta.priority,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
