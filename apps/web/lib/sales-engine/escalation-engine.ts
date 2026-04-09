// ─────────────────────────────────────────────────────────────────────────────
// Escalation Engine
//
// When a lead goes HOT:
//   1. Mark conversation as "HUMAN PRIORITY"
//   2. Switch AI to assist mode (hold attention, don't close)
//   3. Fire the SMS alert IMMEDIATELY (via AlertEngine)
//   4. Surface lead at top of dashboard
//
// When human takes over:
//   1. Mark control = "human"
//   2. AI goes silent
//   3. Update escalation status to "human_active"
//
// AI assist mode behavior:
//   - Acknowledge interest (warm, natural)
//   - Keep attention until human arrives
//   - NEVER negotiate, discount, or push commitment
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SalesLead, EscalationStatus, ConversationControl,
} from "./types";
import { fireHotLeadAlert, shouldSendAlert } from "./alert-engine";
import { classifyLead }                      from "./classifier";

// ─────────────────────────────────────────────────────────────────────────────
// Escalation trigger — called the moment a HOT signal is detected
// ─────────────────────────────────────────────────────────────────────────────

export async function triggerEscalation(
  lead:           SalesLead,
  triggerMessage: string
): Promise<{
  lead:    SalesLead;
  alerted: boolean;
  alertId?: string;
}> {
  // Re-classify to ensure we have the latest score
  const freshClassification = classifyLead(lead);

  // Move AI to assist mode — still present but not closing
  const updatedLead: SalesLead = {
    ...lead,
    classification: freshClassification,
    control:     "ai_assist",
    stage:       "hot_escalated",
    escalation:  "alert_sent",
    updatedAt:   new Date().toISOString(),
  };

  // Fire SMS alert IMMEDIATELY — no await blocking the response
  let alerted = false;
  let alertId: string | undefined;

  const alertCheck = shouldSendAlert(updatedLead);
  if (alertCheck.should) {
    const alert = await fireHotLeadAlert(updatedLead, triggerMessage);
    if (alert) {
      alerted  = true;
      alertId  = alert.id;
      updatedLead.alertSentAt = alert.sentAt;
      updatedLead.alertCount  = (updatedLead.alertCount ?? 0) + 1;
    }
  }

  return { lead: updatedLead, alerted, alertId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Human takeover — agent clicks "Take Over" in dashboard
// ─────────────────────────────────────────────────────────────────────────────

export function humanTakeover(
  lead:    SalesLead,
  agentId: string
): SalesLead {
  return {
    ...lead,
    control:    "human",
    escalation: "human_active",
    agentId,
    updatedAt:  new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Return to AI control (human hands back)
// ─────────────────────────────────────────────────────────────────────────────

export function returnToAI(lead: SalesLead): SalesLead {
  return {
    ...lead,
    control:    "ai",
    escalation: "resolved",
    updatedAt:  new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark resolved
// ─────────────────────────────────────────────────────────────────────────────

export function markResolved(
  lead:   SalesLead,
  outcome: "closed_won" | "closed_lost"
): SalesLead {
  return {
    ...lead,
    stage:      outcome,
    control:    "human",
    escalation: "resolved",
    updatedAt:  new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalation display helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getEscalationMeta(status: EscalationStatus): {
  label: string; color: string; bg: string; icon: string;
} {
  const map: Record<EscalationStatus, ReturnType<typeof getEscalationMeta>> = {
    none:          { label: "AI Active",        color: "text-blue-400",   bg: "bg-blue-900/20",   icon: "🤖" },
    alert_sent:    { label: "Alert Sent 🔥",    color: "text-red-400",    bg: "bg-red-900/30",    icon: "📲" },
    human_alerted: { label: "Human Alerted",    color: "text-orange-400", bg: "bg-orange-900/30", icon: "👀" },
    human_active:  { label: "Human Active",     color: "text-green-400",  bg: "bg-green-900/30",  icon: "✋" },
    resolved:      { label: "Resolved",         color: "text-gray-500",   bg: "bg-gray-800",      icon: "✅" },
  };
  return map[status];
}

export function getControlMeta(control: ConversationControl): {
  label: string; color: string; icon: string;
} {
  const map: Record<ConversationControl, ReturnType<typeof getControlMeta>> = {
    ai:         { label: "AI",          color: "text-blue-400",   icon: "🤖" },
    ai_assist:  { label: "AI (Assist)", color: "text-amber-400",  icon: "⏸️" },
    human:      { label: "Human",       color: "text-green-400",  icon: "✋" },
  };
  return map[control];
}

// ─────────────────────────────────────────────────────────────────────────────
// Should we auto-escalate this inbound message?
// ─────────────────────────────────────────────────────────────────────────────

export function shouldAutoEscalate(lead: SalesLead): boolean {
  // Already escalated or human is active
  if (lead.control !== "ai") return false;
  if (lead.stage === "hot_escalated") return false;

  return lead.classification.temperature === "hot";
}
