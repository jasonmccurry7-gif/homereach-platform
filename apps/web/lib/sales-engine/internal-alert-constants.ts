// ─────────────────────────────────────────────────────────────────────────────
// Internal Alert Engine — Constants & Registry
//
// CRITICAL: These phone numbers are INTERNAL ONLY.
// NEVER use them as sender numbers.
// NEVER mix with customer messaging threads.
// NEVER expose to the browser.
//
// These are agent personal phones for INTERNAL alerts only.
// Customer-facing outbound SMS uses agent_identities.twilio_phone instead.
// ─────────────────────────────────────────────────────────────────────────────

// ── Agent personal phone registry (hardcoded fallback) ───────────────────────
// Used when agent_alert_preferences has no record for an agent.
// Keyed by first name (lowercase) — matched against profiles.full_name.split(' ')[0].toLowerCase()

export const AGENT_ALERT_PHONES: Record<string, string> = {
  josh:    "+13303222746",
  heather: "+12034176080",
  chris:   "+13302214199",
  jason:   "+13302069639",
} as const;

// Jason always receives system-level alerts regardless of preferences
export const SYSTEM_ALERT_PHONE = "+13302069639"; // Jason

// ── Alert types ───────────────────────────────────────────────────────────────

export type AlertType =
  | "hot_lead"
  | "reply_waiting"
  | "payment_follow_up"
  | "start_of_day"
  | "quota_warning"
  | "system_failure"
  | "intake_issue";

export type AlertUrgency = "low" | "medium" | "high" | "critical";

// ── Default configuration (applied when no preferences record exists) ─────────

export const ALERT_DEFAULTS = {
  max_per_hour:       3,
  quiet_hours_start:  21,   // 9pm local
  quiet_hours_end:    7,    // 7am local
  urgent_override:    true, // critical bypasses quiet hours
  dedupe_window_ms:   30 * 60 * 1000,         // 30 minutes
  system_dedupe_ms:   2  * 60 * 60 * 1000,    // 2 hours for system_failure
  ohio_utc_offset:    -5,   // EST (Ohio)
} as const;

// Alert types enabled by default when no preferences record exists
export const DEFAULT_ENABLED_TYPES: AlertType[] = [
  "hot_lead",
  "reply_waiting",
  "payment_follow_up",
  "quota_warning",
  "start_of_day",
];

// ── Deep link patterns (full URLs) ───────────────────────────────────────────

export function buildDeepLink(alertType: AlertType, leadId?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
  switch (alertType) {
    case "hot_lead":          return leadId ? `${base}/agent/leads/${leadId}` : `${base}/agent/hot-leads`;
    case "reply_waiting":     return leadId ? `${base}/agent/replies/${leadId}` : `${base}/agent/replies`;
    case "payment_follow_up": return leadId ? `${base}/agent/payment-follow-up/${leadId}` : `${base}/agent/queue`;
    case "start_of_day":      return `${base}/agent/hot-leads`;
    case "quota_warning":     return `${base}/agent/activity`;
    case "system_failure":    return `${base}/admin/operator`;
    case "intake_issue":      return `${base}/admin/intake`;
    default:                  return `${base}/agent/queue`;
  }
}

// ── Dedupe key patterns ───────────────────────────────────────────────────────

export function buildDedupeKey(alertType: AlertType, agentId: string, leadId?: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  switch (alertType) {
    case "hot_lead":          return leadId ? `hot_lead_${leadId}` : `hot_lead_${agentId}_${today}`;
    case "reply_waiting":     return leadId ? `reply_waiting_${leadId}` : `reply_waiting_${agentId}_${today}`;
    case "payment_follow_up": return leadId ? `payment_followup_${leadId}_${today}` : `payment_followup_${agentId}_${today}`;
    case "start_of_day":      return `start_of_day_${agentId}_${today}`;
    case "quota_warning":     return `quota_warning_${agentId}_${today}`;
    case "system_failure":    return `system_failure_${today}`;
    case "intake_issue":      return leadId ? `intake_issue_${leadId}_${today}` : `intake_issue_${agentId}_${today}`;
    default:                  return `${alertType}_${agentId}_${today}`;
  }
}

// ── SMS message builder ───────────────────────────────────────────────────────

export interface AlertMessageParams {
  alertType:    AlertType;
  agentName:    string;
  businessName?: string;
  city?:         string;
  timeContext?:  string;
  deepLink:      string;
  customBody?:   string;
}

export function buildAlertSms(params: AlertMessageParams): string {
  const { alertType, agentName, businessName, city, timeContext, deepLink, customBody } = params;

  const firstName = agentName.split(" ")[0];

  if (customBody) {
    return `${customBody}\n${deepLink}`;
  }

  switch (alertType) {
    case "hot_lead":
      return [
        `🔥 HOT LEAD: ${businessName ?? "Unknown"} in ${city ?? "Unknown"}`,
        timeContext ? `${timeContext}. Open now.` : "Replied recently. Open now.",
        deepLink,
      ].join("\n");

    case "reply_waiting":
      return [
        `💬 REPLY WAITING: ${businessName ?? "Unknown"} in ${city ?? "Unknown"}`,
        timeContext ? `${timeContext}. Respond now.` : "Waiting on you. Act now.",
        deepLink,
      ].join("\n");

    case "payment_follow_up":
      return [
        `💰 PAYMENT FOLLOW-UP: ${businessName ?? "Unknown"} in ${city ?? "Unknown"}`,
        timeContext ? `${timeContext}. Close it.` : "Payment link sent. Follow up now.",
        deepLink,
      ].join("\n");

    case "start_of_day":
      return [
        `☀️ Morning, ${firstName}! Your leads are ready.`,
        businessName ?? "Check your pipeline and close today.",
        deepLink,
      ].join("\n");

    case "quota_warning":
      return [
        `⚠️ ${firstName} — you're behind pace today.`,
        businessName ?? "End of day approaching. Push now.",
        deepLink,
      ].join("\n");

    case "system_failure":
      return [
        `🚨 SYSTEM ALERT: HomeReach needs attention.`,
        businessName ?? "Check system status immediately.",
        deepLink,
      ].join("\n");

    case "intake_issue":
      return [
        `📋 INTAKE: ${businessName ?? "A client"} needs review.`,
        timeContext ?? "Intake submitted — action required.",
        deepLink,
      ].join("\n");

    default:
      return [`ACTION REQUIRED: ${businessName ?? "Check your dashboard."}`, deepLink].join("\n");
  }
}

// ── Quiet hours check (Ohio / EST) ───────────────────────────────────────────

export function isInQuietHours(
  quietStart: number,
  quietEnd:   number,
  urgency:    AlertUrgency,
  urgentOverride: boolean
): boolean {
  // Critical always bypasses
  if (urgency === "critical") return false;
  // High bypasses if urgentOverride
  if (urgency === "high" && urgentOverride) return false;

  // Convert UTC to Ohio time (EST = UTC-5, EDT = UTC-4)
  // Using fixed -5 offset as a safe default for internal alerts
  const nowUtc  = new Date();
  const ohioHr  = (nowUtc.getUTCHours() + 24 + ALERT_DEFAULTS.ohio_utc_offset) % 24;

  if (quietStart > quietEnd) {
    // Wraps midnight: quiet if hour >= start OR hour < end
    return ohioHr >= quietStart || ohioHr < quietEnd;
  } else {
    return ohioHr >= quietStart && ohioHr < quietEnd;
  }
}
