import { NextResponse }       from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AGENT_ALERT_PHONES,
  SYSTEM_ALERT_PHONE,
  ALERT_DEFAULTS,
  DEFAULT_ENABLED_TYPES,
  buildDeepLink,
  buildDedupeKey,
  buildAlertSms,
  isInQuietHours,
  type AlertType,
  type AlertUrgency,
} from "@/lib/sales-engine/internal-alert-constants";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/alerts/send
//
// Fires an internal alert SMS to an agent's PERSONAL phone.
// COMPLETELY SEPARATE from customer messaging (event/route.ts).
// Uses @homereach/services/outreach sendSms() — same as existing alert-engine.
//
// CRITICAL SAFETY RULES:
//   - Recipient phone ONLY comes from agent_alert_preferences OR AGENT_ALERT_PHONES registry
//   - NEVER uses lead phone or customer phone
//   - No arbitrary phone input accepted from request body
//   - system_failure always goes to Jason regardless of agent_id
// ─────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 15;

interface AlertRequest {
  agent_id:      string;       // profiles.id (UUID) of the agent to alert
  alert_type:    AlertType;
  urgency?:      AlertUrgency;
  lead_id?:      string;
  business_name?: string;
  city?:          string;
  time_context?:  string;
  custom_body?:   string;      // override auto-generated message body
  shadow_mode?:   boolean;     // if true: log but only send to Jason (+13302069639)
}

export async function POST(req: Request) {
  // ── Feature flag guard ─────────────────────────────────────────────────────
  // When ENABLE_INTERNAL_ALERTS is not "true", log and return without sending.
  // This allows the API route to exist and be testable even when flag is OFF.
  const alertsEnabled = process.env.ENABLE_INTERNAL_ALERTS === "true";
  const shadowMode    = process.env.ALERT_SHADOW_MODE === "true";

  let body: AlertRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    agent_id,
    alert_type,
    urgency      = "medium",
    lead_id,
    business_name,
    city,
    time_context,
    custom_body,
    shadow_mode: reqShadowMode,
  } = body;

  if (!agent_id || !alert_type) {
    return NextResponse.json({ error: "agent_id and alert_type are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Step 1: Resolve agent name (for SMS personalisation) ──────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", agent_id)
    .single();

  const agentName  = profile?.full_name ?? "Agent";
  const firstName  = agentName.split(" ")[0].toLowerCase();

  // ── Step 2: Resolve recipient phone ───────────────────────────────────────
  // Priority: agent_alert_preferences → AGENT_ALERT_PHONES registry
  // system_failure: always Jason, regardless of agent_id
  let recipientPhone: string | null = null;
  let prefRecord: { quiet_hours_start: number; quiet_hours_end: number; max_per_hour: number; enabled_types: string[] | null; urgent_override: boolean; enabled: boolean } | null = null;

  if (alert_type === "system_failure") {
    recipientPhone = SYSTEM_ALERT_PHONE;
  } else {
    // Try preferences table first
    const { data: prefs } = await supabase
      .from("agent_alert_preferences")
      .select("phone, quiet_hours_start, quiet_hours_end, max_per_hour, enabled_types, urgent_override, enabled")
      .eq("agent_id", agent_id)
      .single();

    if (prefs) {
      prefRecord = prefs;
      if (!prefs.enabled) {
        return NextResponse.json({ sent: false, reason: "agent_alerts_disabled" });
      }
      recipientPhone = prefs.phone;
    } else {
      // Fall back to hardcoded registry
      recipientPhone = AGENT_ALERT_PHONES[firstName] ?? null;
    }
  }

  if (!recipientPhone) {
    // No phone found — log suppressed record and return gracefully
    await supabase.from("internal_alerts").insert({
      agent_id,
      lead_id:       lead_id ?? null,
      business_name: business_name ?? null,
      city:          city ?? null,
      alert_type,
      urgency,
      message:       "(suppressed — no phone on file)",
      phone:         "unknown",
      status:        "suppressed",
      reason:        "no_phone_on_file",
      dedupe_key:    buildDedupeKey(alert_type, agent_id, lead_id),
    });
    console.warn(`[AlertEngine] No phone for agent ${agent_id} (${agentName}) — suppressed ${alert_type}`);
    return NextResponse.json({ sent: false, reason: "no_phone_on_file" });
  }

  // ── Step 3: Check enabled alert types ────────────────────────────────────
  if (prefRecord?.enabled_types && prefRecord.enabled_types.length > 0) {
    if (!prefRecord.enabled_types.includes(alert_type)) {
      return NextResponse.json({ sent: false, reason: "alert_type_disabled_for_agent" });
    }
  } else if (!DEFAULT_ENABLED_TYPES.includes(alert_type) && alert_type !== "system_failure") {
    return NextResponse.json({ sent: false, reason: "alert_type_not_in_defaults" });
  }

  // ── Step 4: Check quiet hours ─────────────────────────────────────────────
  const qStart  = prefRecord?.quiet_hours_start ?? ALERT_DEFAULTS.quiet_hours_start;
  const qEnd    = prefRecord?.quiet_hours_end   ?? ALERT_DEFAULTS.quiet_hours_end;
  const uOver   = prefRecord?.urgent_override   ?? ALERT_DEFAULTS.urgent_override;

  if (isInQuietHours(qStart, qEnd, urgency, uOver)) {
    await supabase.from("internal_alerts").insert({
      agent_id,
      lead_id:       lead_id ?? null,
      business_name: business_name ?? null,
      city:          city ?? null,
      alert_type,
      urgency,
      message:       "(suppressed — quiet hours)",
      phone:         recipientPhone,
      status:        "suppressed",
      reason:        "quiet_hours",
      dedupe_key:    buildDedupeKey(alert_type, agent_id, lead_id),
    });
    return NextResponse.json({ sent: false, reason: "quiet_hours" });
  }

  // ── Step 5: Deduplicate ───────────────────────────────────────────────────
  const dedupeKey = buildDedupeKey(alert_type, agent_id, lead_id);
  const dedupeWindowMs = alert_type === "system_failure"
    ? ALERT_DEFAULTS.system_dedupe_ms
    : ALERT_DEFAULTS.dedupe_window_ms;
  const dedupeAfter = new Date(Date.now() - dedupeWindowMs).toISOString();

  const { data: dupes } = await supabase
    .from("internal_alerts")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .gte("created_at", dedupeAfter)
    .in("status", ["sent", "queued", "delivered"])
    .limit(1);

  if (dupes && dupes.length > 0) {
    return NextResponse.json({ sent: false, reason: "duplicate_within_window" });
  }

  // ── Step 6: Rate limit check ──────────────────────────────────────────────
  const maxPerHour = prefRecord?.max_per_hour ?? ALERT_DEFAULTS.max_per_hour;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: recentCount } = await supabase
    .from("internal_alerts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent_id)
    .gte("created_at", oneHourAgo)
    .in("status", ["sent", "delivered"]);

  if ((recentCount ?? 0) >= maxPerHour) {
    await supabase.from("internal_alerts").insert({
      agent_id,
      lead_id:       lead_id ?? null,
      business_name: business_name ?? null,
      city:          city ?? null,
      alert_type,
      urgency,
      message:       "(suppressed — rate limited)",
      phone:         recipientPhone,
      status:        "suppressed",
      reason:        `rate_limited_${recentCount}_per_hour`,
      dedupe_key:    dedupeKey,
    });
    return NextResponse.json({ sent: false, reason: "rate_limited" });
  }

  // ── Step 7: Build SMS message ─────────────────────────────────────────────
  const deepLink = buildDeepLink(alert_type, lead_id);
  const smsBody  = buildAlertSms({
    alertType:    alert_type,
    agentName,
    businessName: business_name,
    city,
    timeContext:  time_context,
    deepLink,
    customBody:   custom_body,
  });

  // ── Step 8: Shadow mode — only send to Jason ──────────────────────────────
  const effectiveShadow = shadowMode || reqShadowMode || false;
  const effectivePhone  = effectiveShadow ? SYSTEM_ALERT_PHONE : recipientPhone;

  // ── Step 9: Insert alert record ───────────────────────────────────────────
  const { data: alertRow, error: insertError } = await supabase
    .from("internal_alerts")
    .insert({
      agent_id,
      lead_id:       lead_id ?? null,
      business_name: business_name ?? null,
      city:          city ?? null,
      alert_type,
      urgency,
      message:       smsBody,
      phone:         effectivePhone,
      status:        "queued",
      deep_link:     deepLink,
      dedupe_key:    dedupeKey,
      metadata:      effectiveShadow ? { shadow_mode: true, original_phone: recipientPhone } : null,
    })
    .select("id")
    .single();

  if (insertError || !alertRow) {
    console.error("[AlertEngine] Failed to insert internal_alerts record:", insertError);
    return NextResponse.json({ sent: false, reason: "db_insert_failed" }, { status: 500 });
  }

  // ── Step 10: Feature flag check — skip actual SMS if flag is OFF ──────────
  if (!alertsEnabled) {
    await supabase
      .from("internal_alerts")
      .update({ status: "suppressed", reason: "feature_flag_off" })
      .eq("id", alertRow.id);
    console.log(`[AlertEngine] Flag OFF — suppressed ${alert_type} to ${agentName}`);
    return NextResponse.json({ sent: false, reason: "feature_flag_off", alert_id: alertRow.id });
  }

  // ── Step 11: Send SMS via @homereach/services/outreach ────────────────────
  // This is COMPLETELY SEPARATE from customer messaging (event/route.ts).
  // Sends FROM system Twilio number TO agent's personal phone.
  let twilioSid: string | null  = null;
  let sendStatus: "sent" | "failed" = "failed";
  let sendError: string | null  = null;

  try {
    const { sendSms } = await import("@homereach/services/outreach");
    const result = await sendSms({ body: smsBody, to: effectivePhone });

    if (result.success) {
      twilioSid  = result.externalId ?? null;
      sendStatus = "sent";
      console.log(`[AlertEngine] ✅ ${alert_type} → ${agentName} (${effectivePhone}) SID: ${twilioSid}`);
    } else {
      sendError = result.error ?? "Unknown Twilio error";
      console.error(`[AlertEngine] ❌ ${alert_type} failed for ${agentName}: ${sendError}`);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error(`[AlertEngine] ❌ sendSms threw for ${agentName}:`, err);
  }

  // ── Step 12: Update alert record + write to log ───────────────────────────
  const now = new Date().toISOString();

  await supabase
    .from("internal_alerts")
    .update({ status: sendStatus, twilio_sid: twilioSid, sent_at: now, reason: sendError })
    .eq("id", alertRow.id);

  await supabase.from("agent_alert_log").insert({
    alert_id:   alertRow.id,
    agent_id,
    twilio_sid: twilioSid,
    status:     sendStatus,
    error:      sendError,
  });

  return NextResponse.json({
    sent:       sendStatus === "sent",
    alert_id:   alertRow.id,
    twilio_sid: twilioSid,
    phone:      effectivePhone,
    shadow:     effectiveShadow,
    reason:     sendError ?? undefined,
  });
}
