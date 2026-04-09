// ─────────────────────────────────────────────────────────────────────────────
// Alert Engine — Real-Time Hot Lead SMS Alerts
//
// MISSION-CRITICAL: When a lead goes HOT, fire an SMS to Jason INSTANTLY.
// No delay. No batching. No exceptions.
//
// Alert phone: +13302069639
//
// Format:
//   🔥 HOT LEAD
//   [Business Name] – [City]
//   [Category]
//   Last: '[Lead message]'
//   Act now.
// ─────────────────────────────────────────────────────────────────────────────

import type { SalesLead, HotLeadAlert } from "./types";
import { buildHotLeadSummary } from "./hot-lead-detector";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const ALERT_CONFIG = {
  recipientPhone: "+13302069639",   // Jason's number
  fromNumber:     process.env.TWILIO_PHONE_NUMBER ?? "+1XXXXXXXXXX",
  dedupeWindowMs: 30 * 60 * 1000,  // 30 min — don't re-alert same lead within window
  maxAlertsPerLead: 3,              // hard cap on alerts per lead
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Alert Message Builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildAlertMessage(
  lead: SalesLead,
  triggerMessage: string,
  summary: string
): string {
  const category = lead.category.replace(/_/g, " ").toLowerCase();
  const lastMsg  = triggerMessage.length > 80
    ? triggerMessage.slice(0, 77) + "..."
    : triggerMessage;

  return [
    `🔥 HOT LEAD`,
    `${lead.businessName} – ${lead.city}`,
    `${category}`,
    `Last: '${lastMsg}'`,
    `${summary}`,
    `Act now.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedupe Guard
// ─────────────────────────────────────────────────────────────────────────────

export function shouldSendAlert(lead: SalesLead): {
  should: boolean;
  reason?: string;
} {
  // Never fired before
  if (!lead.alertSentAt) {
    return { should: true };
  }

  // Hard cap
  if (lead.alertCount >= ALERT_CONFIG.maxAlertsPerLead) {
    return { should: false, reason: `Max alerts (${ALERT_CONFIG.maxAlertsPerLead}) already sent.` };
  }

  // Dedupe window
  const elapsed = Date.now() - new Date(lead.alertSentAt).getTime();
  if (elapsed < ALERT_CONFIG.dedupeWindowMs) {
    const minLeft = Math.ceil((ALERT_CONFIG.dedupeWindowMs - elapsed) / 60000);
    return { should: false, reason: `Alert sent ${Math.floor(elapsed / 60000)}m ago. Next allowed in ${minLeft}m.` };
  }

  return { should: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Alert Record (without actually sending)
// ─────────────────────────────────────────────────────────────────────────────

export function buildAlertRecord(
  lead:           SalesLead,
  triggerMessage: string
): HotLeadAlert {
  const summary = buildHotLeadSummary(
    lead.businessName,
    lead.city,
    lead.category,
    triggerMessage,
    lead.classification.signals
  );

  const formattedMessage = buildAlertMessage(lead, triggerMessage, summary);

  return {
    id:               `alert-${Date.now()}-${lead.id}`,
    leadId:           lead.id,
    businessName:     lead.businessName,
    city:             lead.city,
    category:         lead.category,
    summary,
    lastMessage:      triggerMessage,
    sentTo:           ALERT_CONFIG.recipientPhone,
    formattedMessage,
    sentAt:           new Date().toISOString(),
    status:           "sent",  // TODO: update from Twilio delivery webhook
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fire Alert — Twilio Integration Point
//
// In production: call Twilio messages.create()
// In dev/mock:   log to console + store in _alertLog
// ─────────────────────────────────────────────────────────────────────────────

const _alertLog: HotLeadAlert[] = [];

export async function fireHotLeadAlert(
  lead:           SalesLead,
  triggerMessage: string
): Promise<HotLeadAlert | null> {
  // Dedupe check
  const check = shouldSendAlert(lead);
  if (!check.should) {
    console.log(`[AlertEngine] Skipped duplicate alert for ${lead.businessName}: ${check.reason}`);
    return null;
  }

  const alert = buildAlertRecord(lead, triggerMessage);

  try {
    // ─── Twilio: Send real SMS alert ──────────────────────────────────────
    const { sendSms } = await import("@homereach/services/outreach");
    const result = await sendSms({
      body: alert.formattedMessage,
      to:   ALERT_CONFIG.recipientPhone,
    });

    if (result.success) {
      alert.status = "delivered";
      console.log(
        `[AlertEngine] 🔥 HOT LEAD ALERT SENT → ${ALERT_CONFIG.recipientPhone} | SID: ${result.externalId}`
      );
    } else {
      alert.status = "failed";
      console.error(`[AlertEngine] ❌ Alert SMS failed: ${result.error}`);
    }
    // ─────────────────────────────────────────────────────────────────────

    _alertLog.push(alert);
    return alert;

  } catch (err) {
    console.error(`[AlertEngine] ❌ Alert send failed for ${lead.businessName}:`, err);
    return { ...alert, status: "failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────────────────────────────────────

export function getAllAlerts(): HotLeadAlert[] {
  return [..._alertLog];
}

export function getAlertsForLead(leadId: string): HotLeadAlert[] {
  return _alertLog.filter((a) => a.leadId === leadId);
}

export function getAlertsToday(): HotLeadAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return _alertLog.filter((a) => new Date(a.sentAt) >= today);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed mock alerts (for dashboard demo)
// ─────────────────────────────────────────────────────────────────────────────

export function seedMockAlerts(alerts: HotLeadAlert[]): void {
  _alertLog.push(...alerts);
}
