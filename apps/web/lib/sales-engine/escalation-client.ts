import type { ConversationControl, EscalationStatus } from "./types";

export function getEscalationMeta(status: EscalationStatus): {
  label: string;
  color: string;
  bg: string;
  icon: string;
} {
  const map: Record<EscalationStatus, { label: string; color: string; bg: string; icon: string }> = {
    none: { label: "AI Active", color: "text-blue-400", bg: "bg-blue-900/20", icon: "AI" },
    alert_sent: { label: "Alert Sent", color: "text-red-400", bg: "bg-red-900/30", icon: "SMS" },
    human_alerted: { label: "Human Alerted", color: "text-orange-400", bg: "bg-orange-900/30", icon: "!" },
    human_active: { label: "Human Active", color: "text-green-400", bg: "bg-green-900/30", icon: "H" },
    resolved: { label: "Resolved", color: "text-gray-500", bg: "bg-gray-800", icon: "OK" },
  };
  return map[status];
}

export function getControlMeta(control: ConversationControl): {
  label: string;
  color: string;
  icon: string;
} {
  const map: Record<ConversationControl, { label: string; color: string; icon: string }> = {
    ai: { label: "AI", color: "text-blue-400", icon: "AI" },
    ai_assist: { label: "AI (Assist)", color: "text-amber-400", icon: "A" },
    human: { label: "Human", color: "text-green-400", icon: "H" },
  };
  return map[control];
}
