import { normalizeEmail, normalizePhone } from "./prospecting";

export type StormReachSendPolicyInput = {
  channel?: "email" | "sms" | "facebook_dm" | "manual" | string | null;
  sendMode?: "automation" | "autopilot" | "manual_admin" | "manual" | string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  approvalStatus?: string | null;
  suppressionStatus?: string | null;
  status?: string | null;
  autopilotEnabled?: boolean;
  sendsToday?: number;
  dailyLimit?: number;
  now?: Date;
};

export type StormReachSendPolicyResult = {
  allowed: boolean;
  reasons: string[];
  requiresHumanApproval: boolean;
};

export function stormReachAutopilotEnabled() {
  return process.env.STORMREACH_SEND_ENABLED === "true" || process.env.STORMREACH_AUTOPILOT_ENABLED === "true" || process.env.STORMREACH_AUTO_SEND_ENABLED === "true";
}

export function stormReachRuntimeVerified() {
  return process.env.STORMREACH_RUNTIME_VERIFIED === "true";
}

export function stormReachDailySendLimit() {
  const limit = Number(process.env.STORMREACH_MAX_SENDS_PER_DAY ?? 0);
  return Number.isFinite(limit) && limit > 0 ? limit : 0;
}

export function evaluateStormReachSendPolicy(input: StormReachSendPolicyInput): StormReachSendPolicyResult {
  const reasons: string[] = [];
  const channel = String(input.channel ?? "email");
  const email = normalizeEmail(input.recipientEmail);
  const phone = normalizePhone(input.recipientPhone);
  const autopilotEnabled = input.autopilotEnabled ?? stormReachAutopilotEnabled();
  const dailyLimit = input.dailyLimit ?? stormReachDailySendLimit();
  const sendMode = String(input.sendMode ?? "automation").toLowerCase();
  const manualAdminSend = sendMode === "manual_admin" || sendMode === "manual";
  const manualAdminEmailSend = manualAdminSend && channel === "email";

  if (channel === "email" && !email) reasons.push("Recipient email is missing.");
  if (channel === "sms" && !phone) reasons.push("Recipient phone is missing.");
  if (channel !== "email" && channel !== "sms") reasons.push(`Channel "${channel}" is not supported for direct StormReach sending.`);
  if (input.suppressionStatus !== "clear") reasons.push("Suppression status is not clear.");
  if (input.approvalStatus !== "approved") reasons.push("Human approval is required before send.");
  if (!manualAdminEmailSend && !autopilotEnabled) reasons.push("Storm Reach autopilot sending is disabled.");
  if (!manualAdminEmailSend && dailyLimit <= 0) reasons.push("Storm Reach daily send limit is zero.");
  if (!manualAdminEmailSend && (input.sendsToday ?? 0) >= dailyLimit && dailyLimit > 0) reasons.push("Storm Reach daily send limit has been reached.");
  if (!manualAdminSend && !isBusinessHours(input.now ?? new Date())) reasons.push("Outside approved business-hours send window.");
  if (["sent", "sending", "suppressed", "archived"].includes(String(input.status ?? "").toLowerCase())) {
    reasons.push(`Message status "${input.status}" cannot be sent.`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    requiresHumanApproval: input.approvalStatus !== "approved",
  };
}

export function isBusinessHours(now: Date) {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = Number(process.env.OUTREACH_BUSINESS_START_MINUTES ?? 510);
  const end = Number(process.env.OUTREACH_BUSINESS_END_MINUTES ?? 1050);
  return minutes >= start && minutes <= end;
}

export const APPROVAL_AND_SEND_ENGINE_GUARDRAILS = {
  noSendWithoutApproval: true,
  suppressionRequired: true,
  unsubscribeRequired: true,
  automatedBusinessHoursOnly: true,
  manualAdminEmailCanBypassAutomationScheduleAndCap: true,
  dailyLimitDefaultsToZero: true,
};
